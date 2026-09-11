// Tune-and-capture: one channel at a time (D005).
//
// Navigates the attached Chrome to a channel deep link, pins 1080p, arms the
// capture extension (task-006: tabCapture needs activeTab, granted by
// Extensions.triggerAction on a "tab" target), and pipes the extension's
// WebM timeslices into ffmpeg, which writes an HLS ladder to disk.

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Cdp, evalIn, findPageTarget, sleep, tabTargetId, type Session } from "./cdp.js";
import { ROOT, type Channel } from "./channels.js";

const EXT_DIR = join(ROOT, "extension");
const EXT_NAME = "Marlin Cast Capture Spike";
export const HLS_ROOT = join(ROOT, "data", "hls");

const CAPTURE_W = Number(process.env.MC_WIDTH ?? 1920);
const CAPTURE_H = Number(process.env.MC_HEIGHT ?? 1080);
const CAPTURE_FPS = Number(process.env.MC_FPS ?? 30);
const TIMESLICE_MS = Number(process.env.MC_TIMESLICE ?? 1000);
/** HLS is pull-based and gives no disconnect signal, so "client gone" is
 *  inferred from silence. See the report. */
export const IDLE_MS = Number(process.env.MC_IDLE_MS ?? 20000);

export type Status = {
  state: "idle" | "starting" | "streaming" | "stopping";
  channelId: string | null;
  channelName: string | null;
  since: string | null;
  chunksIn: number;
  bytesIn: number;
  segments: number;
  lastAccess: string | null;
  lastError: string | null;
};

type Live = {
  channel: Channel;
  token: string;
  dir: string;
  ffmpeg: ChildProcessWithoutNullStreams;
  startedAt: number;
  lastAccess: number;
  chunksIn: number;
  bytesIn: number;
  stopping: boolean;
};

export class Pipeline {
  private cdp!: Cdp;
  private port: string;
  private pageTargetId!: string;
  private page!: Session;
  private extId!: string;
  private live: Live | null = null;
  private starting: Promise<void> | null = null;
  private lastError: string | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;

  constructor(port: string) { this.port = port; }

  async connect(): Promise<string> {
    this.cdp = await Cdp.attach(this.port);
    const t = await findPageTarget(this.port);
    this.pageTargetId = t.id;
    const { sessionId } = await this.cdp.send<any>("Target.attachToTarget", { targetId: t.id, flatten: true });
    this.page = sessionId;
    await this.cdp.send("Page.enable", {}, this.page);
    await this.cdp.send("Runtime.enable", {}, this.page);
    await this.loadExtension();
    this.watchdog = setInterval(() => this.checkIdle(), 2000);
    return this.cdp.browser;
  }

  /** --load-extension is dead on Chrome 153 (task-006); Extensions.loadUnpacked
   *  over the same loopback port installs it with no restart. */
  private async loadExtension(): Promise<void> {
    const { extensions = [] } = await this.cdp.send<any>("Extensions.getExtensions");
    for (const e of extensions.filter((x: any) => x.name === EXT_NAME)) {
      await this.cdp.send("Extensions.uninstall", { id: e.id }).catch(() => {});
    }
    const { id } = await this.cdp.send<any>("Extensions.loadUnpacked", { path: EXT_DIR });
    this.extId = id;
  }

  private async swSession(): Promise<Session> {
    for (let i = 0; i < 30; i++) {
      const { targetInfos } = await this.cdp.send<any>("Target.getTargets");
      const sw = targetInfos.find((t: any) => t.type === "service_worker" && t.url.includes(this.extId));
      if (sw) {
        const { sessionId } = await this.cdp.send<any>("Target.attachToTarget", { targetId: sw.targetId, flatten: true });
        await this.cdp.send("Runtime.enable", {}, sessionId);
        return sessionId;
      }
      if (i === 4 || i === 14) {
        const tid = await tabTargetId(this.cdp, this.page).catch(() => null);
        // An unarmed invocation is a no-op in the extension; it only wakes the worker.
        if (tid) await this.cdp.send("Extensions.triggerAction", { id: this.extId, targetId: tid }).catch(() => {});
      }
      await sleep(500);
    }
    throw new Error("extension service worker never appeared");
  }

  status(): Status {
    const l = this.live;
    return {
      state: l ? (l.stopping ? "stopping" : "streaming") : (this.starting ? "starting" : "idle"),
      channelId: l?.channel.id ?? null,
      channelName: l?.channel.name ?? null,
      since: l ? new Date(l.startedAt).toISOString() : null,
      chunksIn: l?.chunksIn ?? 0,
      bytesIn: l?.bytesIn ?? 0,
      segments: l && existsSync(l.dir) ? readdirSync(l.dir).filter((f) => f.endsWith(".ts")).length : 0,
      lastAccess: l ? new Date(l.lastAccess).toISOString() : null,
      lastError: this.lastError,
    };
  }

  currentChannelId(): string | null { return this.live?.channel.id ?? null; }
  token(): string | null { return this.live?.token ?? null; }

  touch(channelId: string): void {
    if (this.live && this.live.channel.id === channelId) this.live.lastAccess = Date.now();
  }

  dirFor(channelId: string): string { return join(HLS_ROOT, channelId); }

  private checkIdle(): void {
    const l = this.live;
    if (!l || l.stopping) return;
    if (Date.now() - l.lastAccess > IDLE_MS) {
      void this.stop(`idle ${IDLE_MS}ms with no client request`);
    }
  }

  /** D005: one channel at a time. A request for a different channel SWITCHES
   *  the tune — the previous stream is torn down first. */
  async ensure(channel: Channel): Promise<void> {
    if (this.live && this.live.channel.id === channel.id && !this.live.stopping) {
      this.live.lastAccess = Date.now();
      return;
    }
    if (this.starting) await this.starting.catch(() => {});
    if (this.live && this.live.channel.id === channel.id && !this.live.stopping) return;
    this.starting = this.start(channel).finally(() => { this.starting = null; });
    await this.starting;
  }

  private async start(channel: Channel): Promise<void> {
    if (this.live) await this.stop(`switching to ${channel.name}`);
    this.lastError = null;

    const token = Math.random().toString(36).slice(2, 10);
    const dir = this.dirFor(channel.id);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });

    // --- tune -------------------------------------------------------------
    const url = `https://tv.youtube.com/${channel.href.replace(/^\//, "")}`;
    await this.cdp.send("Page.navigate", { url }, this.page);
    await sleep(9000);

    // Force a 16:9 layout so the player fills the captured frame instead of
    // being pillarboxed inside this 2560x1381 (non-16:9) display.
    await this.cdp.send("Emulation.setDeviceMetricsOverride", {
      width: CAPTURE_W, height: CAPTURE_H, deviceScaleFactor: 1, mobile: false,
    }, this.page).catch(() => {});
    await sleep(1500);

    const pinned = await evalIn<any>(this.cdp, this.page, `(async () => {
      const deadline = Date.now() + 25000;
      let v = null, p = null;
      while (Date.now() < deadline) {
        p = document.querySelector("#movie_player");
        v = document.querySelector("#movie_player video.html5-main-video");
        if (p && v && v.videoWidth > 0 && !v.paused) break;
        await new Promise(r => setTimeout(r, 500));
      }
      if (!p || !v || !v.videoWidth) {
        return { ok: false, why: /SIGN IN/i.test(document.body.innerText||"") ? "SIGNED OUT" : "no playing video element" };
      }
      p.setPlaybackQualityRange("hd1080", "hd1080");
      await new Promise(r => setTimeout(r, 3500));
      const r = v.getBoundingClientRect();
      return { ok: true, quality: p.getPlaybackQuality(), video: v.videoWidth + "x" + v.videoHeight,
               box: Math.round(r.width) + "x" + Math.round(r.height),
               viewport: innerWidth + "x" + innerHeight };
    })()`);
    if (!pinned.ok) throw new Error(`tune failed for ${channel.name}: ${pinned.why}`);
    console.log(`[tune] ${channel.name} ${JSON.stringify(pinned)}`);

    // --- ffmpeg -----------------------------------------------------------
    // Input is MediaRecorder's VP8/Opus WebM. HLS needs H.264/AAC, so this
    // transcodes. Software only (D014 / task-007): no VAAPI, no hwaccel.
    const args = [
      "-hide_banner", "-loglevel", "warning",
      // No -use_wallclock_as_timestamps: MediaRecorder's WebM already carries
      // correctly synchronised A/V timestamps, and overriding them with
      // arrival time produced a flood of non-monotonic DTS on the audio
      // stream. Preserving those timestamps is the point of D011.
      "-i", "pipe:0",
      "-map", "0:v:0", "-map", "0:a:0",
      // MediaRecorder's WebM is variable-rate. Without pinning the output
      // rate ffmpeg guessed 50 fps — the refresh rate of this xrdp display —
      // and duplicated frames up to it from a 30 fps capture, paying for
      // ~20 extra encoded frames a second that carry no new picture.
      "-fps_mode", "cfr", "-r", String(CAPTURE_FPS),
      "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high", "-pix_fmt", "yuv420p",
      "-g", String(CAPTURE_FPS * 2), "-keyint_min", String(CAPTURE_FPS * 2), "-sc_threshold", "0",
      "-b:v", "6000k", "-maxrate", "6000k", "-bufsize", "12000k",
      "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000",
      "-f", "hls", "-hls_time", "2", "-hls_list_size", "6",
      "-hls_flags", "delete_segments+independent_segments+temp_file",
      "-hls_segment_filename", join(dir, "seg%05d.ts"),
      join(dir, "index.m3u8"),
    ];
    const ffmpeg = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
    ffmpeg.stderr.on("data", (d) => {
      const s = String(d).trim();
      if (s) { this.lastError = s.split("\n").slice(-1)[0]; console.error(`[ffmpeg] ${s}`); }
    });
    ffmpeg.stdin.on("error", () => { /* closed under us; stop() handles it */ });
    ffmpeg.on("exit", (code, sig) => {
      console.error(`[ffmpeg] exited code=${code} signal=${sig}`);
      if (this.live && this.live.token === token && !this.live.stopping) void this.stop("ffmpeg exited");
    });

    this.live = {
      channel, token, dir, ffmpeg,
      startedAt: Date.now(), lastAccess: Date.now(),
      chunksIn: 0, bytesIn: 0, stopping: false,
    };

    // --- arm the extension and record ------------------------------------
    const sw = await this.swSession();
    await this.cdp.send("Target.activateTarget", { targetId: this.pageTargetId });
    const opts = JSON.stringify({
      video: { maxWidth: CAPTURE_W, maxHeight: CAPTURE_H, maxFrameRate: CAPTURE_FPS },
      ingest: `http://127.0.0.1:8804/ingest/${channel.id}/${token}`,
      timeslice: TIMESLICE_MS,
    });

    let started = await evalIn<any>(this.cdp, sw, `self.mcStart(${opts})`);
    if (started.phase !== "recording") {
      // tabCapture refuses until the extension has been INVOKED on the tab.
      await evalIn(this.cdp, sw, `(() => { self.mcOpts = ${opts}; self.mcArmed = true; return true; })()`);
      await this.cdp.send("Extensions.triggerAction", { id: this.extId, targetId: await tabTargetId(this.cdp, this.page) });
      await sleep(1800);
      started = await evalIn<any>(this.cdp, sw, `self.mcState`);
    }
    if (started.phase !== "recording") throw new Error(`capture did not start: ${started.error}`);
    console.log(`[capture] ${channel.name} recording ${JSON.stringify(started.note?.tracks?.video?.settings ?? {})}`);
  }

  ingest(channelId: string, token: string, buf: Buffer): boolean {
    const l = this.live;
    if (!l || l.channel.id !== channelId || l.token !== token || l.stopping) return false;
    l.chunksIn++;
    l.bytesIn += buf.length;
    if (l.ffmpeg.stdin.writable) l.ffmpeg.stdin.write(buf);
    return true;
  }

  async stop(reason: string): Promise<void> {
    const l = this.live;
    if (!l || l.stopping) return;
    l.stopping = true;
    console.log(`[stop] ${l.channel.name}: ${reason}`);

    try {
      const sw = await this.swSession();
      await evalIn(this.cdp, sw, `self.mcStop({})`);
    } catch (e) { console.error(`[stop] recorder stop failed: ${String(e)}`); }

    try { l.ffmpeg.stdin.end(); } catch { /* already closed */ }
    await new Promise<void>((res) => {
      const t = setTimeout(() => { try { l.ffmpeg.kill("SIGKILL"); } catch {} res(); }, 4000);
      l.ffmpeg.once("exit", () => { clearTimeout(t); res(); });
      try { l.ffmpeg.kill("SIGTERM"); } catch { clearTimeout(t); res(); }
    });

    await this.cdp.send("Emulation.clearDeviceMetricsOverride", {}, this.page).catch(() => {});
    rmSync(l.dir, { recursive: true, force: true });
    this.live = null;
  }

  async shutdown(): Promise<void> {
    if (this.watchdog) clearInterval(this.watchdog);
    await this.stop("server shutting down");
    this.cdp.close();
  }
}

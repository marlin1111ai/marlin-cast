// Tune-and-capture: one channel at a time (D005).
//
// Navigates the attached Chrome to a channel deep link, pins 1080p, arms the
// capture extension (task-006: tabCapture needs activeTab, granted by
// Extensions.triggerAction on a "tab" target), and pipes the extension's
// WebM timeslices into ffmpeg, which writes an fMP4/CMAF HLS stream to disk.

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
/** Where the capture tab parks after an idle stop: the YouTube TV live
 *  guide, logged in, with no channel playing (task-018). */
const GUIDE_URL = "https://tv.youtube.com/live";

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
  quality: string | null;
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

/** Result of a page-side poll probe: `ok` ends the poll, `fatal` aborts it. */
type Probe = { ok: boolean; fatal?: string; [k: string]: unknown };

/**
 * Poll a page-side expression until it reports ok, it reports fatal, or the
 * timeout expires. A timeout is a named, loud failure carrying the last probe
 * — never a silent proceed-anyway (task-011).
 *
 * Exceptions from the evaluate are swallowed *during* the wait on purpose:
 * while a navigation is committing the old execution context is destroyed and
 * Runtime.evaluate throws. That is an expected transient, and the timeout is
 * what stops it becoming an infinite wait.
 */
async function pollPage(
  cdp: Cdp, session: Session, name: string, expression: string,
  timeoutMs: number, intervalMs = 250,
): Promise<Probe> {
  const started = Date.now();
  let last: unknown = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const r = await evalIn<Probe>(cdp, session, expression);
      if (r && r.fatal) throw new Error(`${name}: ${r.fatal} (after ${Date.now() - started}ms)`);
      if (r && r.ok) return r;
      last = r;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith(name + ":")) throw e;
      last = { evaluateError: String(e) };
    }
    await sleep(intervalMs);
  }
  throw new Error(`${name}: not satisfied within ${timeoutMs}ms — last probe ${JSON.stringify(last)}`);
}

export class Pipeline {
  private cdp!: Cdp;
  private port: string;
  private pageTargetId!: string;
  private page!: Session;
  private extId!: string;
  private live: Live | null = null;
  private starting: Promise<void> | null = null;
  private lastError: string | null = null;
  private lastQuality: string | null = null;
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
      segments: l && existsSync(l.dir) ? readdirSync(l.dir).filter((f) => f.endsWith(".m4s")).length : 0,
      lastAccess: l ? new Date(l.lastAccess).toISOString() : null,
      lastError: this.lastError,
      quality: this.lastQuality,
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
      void this.stop(`idle ${IDLE_MS}ms with no client request`, { returnToGuide: true });
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
    // Four polls, no fixed sleeps. Task-010 measured the old 9000/1500/3500 ms
    // sleeps as 14.17 s of a 19.35 s cold tune, against PrismCast's 5.22 s.
    const t0 = Date.now();
    const url = `https://tv.youtube.com/${channel.href.replace(/^\//, "")}`;
    await this.cdp.send("Page.navigate", { url }, this.page);

    // Poll 1 (was sleep 9000): the navigation has actually committed to this
    // channel's document and the player element is mounted. Checking the id is
    // in location.href is what stops the next polls reading the OLD document.
    await pollPage(this.cdp, this.page, "navigation", `(() => {
      const signedOut = /SIGN IN/i.test((document.body && document.body.innerText) || "");
      if (signedOut) return { ok: false, fatal: "SIGNED OUT" };
      const onTarget = location.href.indexOf(${JSON.stringify(channel.id)}) !== -1;
      const player = !!document.querySelector("#movie_player");
      return { ok: onTarget && player, onTarget, player, href: location.href.slice(0, 60) };
    })()`, 30000);
    const tNav = Date.now() - t0;

    // Force a 16:9 layout so the player fills the captured frame instead of
    // being pillarboxed inside this 2560x1381 (non-16:9) display.
    await this.cdp.send("Emulation.setDeviceMetricsOverride", {
      width: CAPTURE_W, height: CAPTURE_H, deviceScaleFactor: 1, mobile: false,
    }, this.page).catch(() => {});

    // Poll 2 (was sleep 1500): the override has actually been applied to the
    // layout, i.e. the page reports the viewport we asked for.
    await pollPage(this.cdp, this.page, "layout override", `(() => ({
      ok: innerWidth === ${CAPTURE_W} && innerHeight === ${CAPTURE_H},
      viewport: innerWidth + "x" + innerHeight
    }))()`, 10000);
    const tLayout = Date.now() - t0;

    // Poll 3 (kept from the old page-side loop, now a named stage): a real
    // video element is decoding and playing.
    await pollPage(this.cdp, this.page, "player ready", `(() => {
      const p = document.querySelector("#movie_player");
      const v = document.querySelector("#movie_player video.html5-main-video");
      if (!v || !p) return { ok: false, why: "no player yet" };
      return { ok: v.videoWidth > 0 && !v.paused && v.readyState >= 2,
               w: v.videoWidth, h: v.videoHeight, paused: v.paused, readyState: v.readyState };
    })()`, 30000);
    const tPlaying = Date.now() - t0;

    // Poll 4 (was sleep 3500): wait on the QUALITY ACTUALLY SETTLING with the
    // element reporting matching real dimensions — not on elapsed time.
    //
    // Task-009 saw tunes report success at hd720 with the element reading 0x0.
    // Two separate causes, and this poll addresses both:
    //   * a STALE element was measured after the pin, so the element is
    //     re-queried every iteration and the pin re-applied (it is idempotent);
    //   * some channels genuinely have NO 1080p rendition — ESPN advertises
    //     only ["hd720","large","medium","small"]. Demanding hd1080 there can
    //     never succeed, so the target is the best level the channel actually
    //     offers at or below hd1080. The level reached is reported, never
    //     silently accepted: a tune below hd1080 warns in the log and shows in
    //     /health.
    const pinned = await pollPage(this.cdp, this.page, "quality pin", `(() => {
      const p = document.querySelector("#movie_player");
      const v = document.querySelector("#movie_player video.html5-main-video");
      if (!p || !v) return { ok: false, why: "player went away" };
      const avail = (p.getAvailableQualityLevels ? p.getAvailableQualityLevels() : []) || [];
      if (!avail.length) return { ok: false, why: "no quality levels advertised yet" };
      const ladder = ["hd1080", "hd720", "large", "medium", "small", "tiny"];
      const target = ladder.find(function (q) { return avail.indexOf(q) !== -1; });
      if (!target) return { ok: false, why: "no usable quality level", available: avail };
      try { p.setPlaybackQualityRange(target, target); } catch (e) {}
      const minH = { hd1080: 1080, hd720: 720, large: 480, medium: 360, small: 240, tiny: 144 }[target] || 1;
      const q = p.getPlaybackQuality();
      const r = v.getBoundingClientRect();
      return {
        ok: q === target && v.videoWidth > 0 && v.videoHeight >= minH,
        target: target,
        quality: q,
        is1080: target === "hd1080",
        video: v.videoWidth + "x" + v.videoHeight,
        box: Math.round(r.width) + "x" + Math.round(r.height),
        viewport: innerWidth + "x" + innerHeight,
        available: avail.slice(0, 6)
      };
    })()`, 20000);
    if (!pinned.is1080) {
      console.warn(`[tune] ${channel.name} WARNING: channel offers no hd1080 — settled at ${pinned.quality} (available: ${JSON.stringify(pinned.available)})`);
    }
    this.lastQuality = String(pinned.quality ?? "unknown");
    const tPinned = Date.now() - t0;

    console.log(`[tune] ${channel.name} ${JSON.stringify(pinned)}`);
    console.log(`[tune-ms] ${channel.name} nav=${tNav} layout=${tLayout} playing=${tPlaying} pinned=${tPinned}`);

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
      // -tune zerolatency drops B-frames and the encoder lookahead. With a
      // live capture the reordering delay buys nothing and costs start-up
      // time, which task-010 measured as the thing that matters.
      "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
      "-profile:v", "high", "-pix_fmt", "yuv420p",
      // repeat-headers=1 writes SPS+PPS in-band before every IDR, so each
      // keyframe is a self-contained random-access point — as the reference
      // stream is (task-015: PrismCast's keyframe samples are (7,8,5,...),
      // ours were (6,5,...) with the parameter sets only in the init avcC).
      // The avcC still carries them; this adds the in-band copy, nothing else.
      "-x264-params", "repeat-headers=1",
      // One-second GOP so a one-second segment can still start on an IDR.
      "-g", String(CAPTURE_FPS), "-keyint_min", String(CAPTURE_FPS), "-sc_threshold", "0",
      "-b:v", "6000k", "-maxrate", "6000k", "-bufsize", "12000k",
      "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000",
      // 1 s segments: the first playable segment is the gate on how fast a
      // client sees picture, and task-010 measured PrismCast (which plays in
      // the same Channels DVR player) returning a playable playlist in 5.2 s
      // against our 19.3 s. hls_list_size 10 keeps the same ~10 s window.
      "-f", "hls", "-hls_time", "1", "-hls_list_size", "10",
      // fMP4/CMAF, not MPEG-TS (task-012): one init segment (ftyp+moov,
      // referenced by #EXT-X-MAP) plus .m4s media fragments. This is the
      // container the reference stream uses (task-010: PrismCast serves
      // init.mp4 + .m4s with EXT-X-VERSION:7). Codec, profile, rate, GOP,
      // segment length and window are unchanged — only the container.
      "-hls_segment_type", "fmp4", "-hls_fmp4_init_filename", "init.mp4",
      // No program_date_time (task-019). It was added in task-010 to match the
      // reference stream, but task-013 found ffmpeg writes it as local time
      // with a strftime %z offset that Go's RFC 3339 parser rejects, and
      // task-014's serve-time rewrite made it valid UTC. It stayed a suspect
      // anyway: Channels logs "[M3U] stream timestamps start_at=end_at" from a
      // pre-fetch of the media playlist (start==end because a cold playlist
      // holds one segment), then stops at last_seq=1. Removing the tag removes
      // the two equal PROGRAM-DATE-TIME values that pre-fetch reads. The
      // task-014 rewrite in src/server.ts is left in place as a no-op.
      "-hls_flags", "delete_segments+independent_segments+temp_file",
      "-hls_segment_filename", join(dir, "seg%05d.m4s"),
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

  async stop(reason: string, opts: { returnToGuide?: boolean } = {}): Promise<void> {
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

    // On an idle stop, park the capture tab on the live guide so no channel
    // keeps playing while nobody is watching (task-018). Not done on a
    // channel switch (start() navigates straight to the next channel) or on
    // shutdown. The tab stays open and logged in; the next tune navigates to
    // its channel URL from here exactly as it would from any other page.
    if (opts.returnToGuide) {
      try {
        await this.cdp.send("Page.navigate", { url: GUIDE_URL }, this.page);
        console.log(`[stop] parked capture tab on the live guide`);
      } catch (e) { console.error(`[stop] guide navigation failed: ${String(e)}`); }
    }
  }

  async shutdown(): Promise<void> {
    if (this.watchdog) clearInterval(this.watchdog);
    await this.stop("server shutting down");
    this.cdp.close();
  }
}

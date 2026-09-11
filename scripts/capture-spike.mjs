#!/usr/bin/env node
// capture-spike.mjs — Task 006.
//
// Attaches over CDP to the Chrome the owner launched (D009), loads the
// capture extension if it is not already loaded, navigates a channel deep
// link, pins 1080p, records for N seconds through chrome.tabCapture (D011),
// stops, and reports the output file path and size.
//
// No new dependencies: the CDP client below is ~50 lines over Node 22's
// built-in global WebSocket.

import { readdirSync, statSync, mkdirSync, renameSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXT_DIR = join(ROOT, "extension");
const OUT_DIR = join(ROOT, "data", "captures");
const EXT_NAME = "Marlin Cast Capture Spike";
const PORT = process.env.CDP_PORT ?? "9333";
const BASE = `http://127.0.0.1:${PORT}`;

// ---------------------------------------------------------------- CDP client
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method) {
        for (const fn of this.listeners.get(m.method) ?? []) fn(m.params);
        return;
      }
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      m.error ? p.reject(new Error(`${m.error.message} (${m.error.code ?? ""})`)) : p.resolve(m.result);
    });
  }
  static async open(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", () => rej(new Error(`cannot open ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  close() { this.ws.close(); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Evaluate an expression string in a session and return its value, throwing
// on an exception rather than silently returning undefined.
async function evalIn(cdp, sessionId, expression) {
  const r = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  }
  return r.result.value;
}

// chrome.tabCapture is only reachable once the extension has been *invoked* on
// the tab (activeTab). Extensions.triggerAction is the CDP equivalent of
// clicking the toolbar icon, and it insists on a "tab" target — which is a
// different target type from the "page" target everything else is driven
// through, and is excluded from Target.getTargets unless asked for.
async function tabTargetId(cdp, pageSession) {
  const { targetInfos } = await cdp.send("Target.getTargets", { filter: [{}] });
  const tabs = targetInfos.filter((t) => t.type === "tab");
  if (tabs.length === 0) throw new Error("no tab target found");
  if (tabs.length === 1) return tabs[0].targetId;
  const here = await evalIn(cdp, pageSession, "location.href").catch(() => null);
  return (tabs.find((t) => t.url === here) ?? tabs[0]).targetId;
}

// ------------------------------------------------------------------- options
function opts(argv) {
  const o = {
    seconds: 60, maximize: true, fullscreen: true, player: true,
    channel: "TNT", url: null, width: null, height: null, fps: null,
    label: "capture", minimize: false, mime: null, activate: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--seconds") o.seconds = Number(next());
    else if (a === "--channel") o.channel = next();
    else if (a === "--url") o.url = next();
    else if (a === "--label") o.label = next();
    else if (a === "--width") o.width = Number(next());
    else if (a === "--height") o.height = Number(next());
    else if (a === "--fps") o.fps = Number(next());
    else if (a === "--mime") o.mime = next();
    else if (a === "--no-maximize") o.maximize = false;
    else if (a === "--no-fullscreen") o.fullscreen = false;
    else if (a === "--no-player") o.player = false;
    else if (a === "--no-activate") o.activate = false;
    else if (a === "--minimize") o.minimize = true;
    else if (a === "--window") { o.maximize = false; o.win = next().split("x").map(Number); }
    else throw new Error(`unknown option ${a}`);
  }
  return o;
}

// ---------------------------------------------------------------------- main
const o = opts(process.argv);
mkdirSync(OUT_DIR, { recursive: true });

const version = await fetch(`${BASE}/json/version`).then((r) => r.json()).catch(() => null);
if (!version) {
  console.error(`No Chrome is listening on ${BASE}.\n` +
    `Start it first:  cd ${ROOT} && ./scripts/start-chrome.sh`);
  process.exit(1);
}
console.log(`attached: yes  (${BASE}, ${version.Browser})`);

const cdp = await Cdp.open(version.webSocketDebuggerUrl);

// --- 1. extension -----------------------------------------------------------
// --load-extension is ignored by this Chrome (see the report); Extensions.loadUnpacked
// over the same loopback debug port is what actually installs it, with no restart.
// Reinstall every run so the on-disk code is always what is being tested.
const { extensions = [] } = await cdp.send("Extensions.getExtensions");
for (const e of extensions.filter((e) => e.name === EXT_NAME)) {
  await cdp.send("Extensions.uninstall", { id: e.id });
}
const { id: extId } = await cdp.send("Extensions.loadUnpacked", { path: EXT_DIR });
const ext = { id: extId, name: EXT_NAME };
console.log(`extension: loaded from ${EXT_DIR}  id=${extId}`);

// --- 2. downloads land in data/captures -------------------------------------
// Point Chrome's downloads at data/captures. With this override in force
// Chrome writes the file under a GUID name, so the extension reports back
// where it actually landed (chrome.downloads.search) and the driver renames it.
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: OUT_DIR });
console.log(`downloads : ${OUT_DIR}`);

// --- 3. the player tab ------------------------------------------------------
const list = await fetch(`${BASE}/json/list`).then((r) => r.json());
let target = list.find((t) => t.type === "page" && t.url.includes("tv.youtube.com"))
          ?? list.find((t) => t.type === "page");
if (!target) throw new Error("no page target to drive");
const { sessionId: page } = await cdp.send("Target.attachToTarget", { targetId: target.id, flatten: true });
await cdp.send("Page.enable", {}, page);
await cdp.send("Runtime.enable", {}, page);

const { windowId } = await cdp.send("Browser.getWindowForTarget", { targetId: target.id });
if (o.maximize) await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "maximized" } });
else if (o.win) {
  await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
  await cdp.send("Browser.setWindowBounds", { windowId, bounds: { left: 0, top: 0, width: o.win[0], height: o.win[1] } });
}

if (o.player) {
  let deep = o.url;
  if (!deep) {
    // Resolve ONE deep link from the live guide. Not a channel list: the first
    // entry whose aria-label matches --channel, and nothing is stored.
    await cdp.send("Page.navigate", { url: "https://tv.youtube.com/live" }, page);
    await sleep(9000);
    deep = await evalIn(cdp, page, `(() => {
      const want = ${JSON.stringify(o.channel)}.toLowerCase();
      for (const el of document.querySelectorAll("ytu-endpoint.tenx-thumb[aria-label]")) {
        const name = el.getAttribute("aria-label").replace(/^watch /i, "");
        if (name.toLowerCase().includes(want)) {
          const a = el.querySelector("a[href]");
          if (a) return new URL(a.getAttribute("href"), "https://tv.youtube.com/").href;
        }
      }
      return null;
    })()`);
    if (!deep) throw new Error(`no guide entry matching "${o.channel}"`);
  }
  console.log(`channel   : ${o.channel} (deep link resolved)`);
  await cdp.send("Page.navigate", { url: deep }, page);
  await sleep(12000);

  const pinned = await evalIn(cdp, page, `(async () => {
    const p = document.querySelector("#movie_player");
    const deadline = Date.now() + 20000;
    let v = null;
    while (Date.now() < deadline) {
      v = document.querySelector("#movie_player video.html5-main-video");
      if (v && v.videoWidth > 0 && !v.paused) break;
      await new Promise(r => setTimeout(r, 500));
    }
    if (!v || !v.videoWidth) return { ok: false, why: "no playing video element" };
    p.setPlaybackQualityRange("hd1080", "hd1080");
    await new Promise(r => setTimeout(r, 4000));
    return {
      ok: true,
      quality: p.getPlaybackQuality(),
      video: v.videoWidth + "x" + v.videoHeight,
      box: Math.round(v.getBoundingClientRect().width) + "x" + Math.round(v.getBoundingClientRect().height),
      viewport: innerWidth + "x" + innerHeight,
      dpr: devicePixelRatio,
      paused: v.paused,
    };
  })()`);
  console.log(`player    : ${JSON.stringify(pinned)}`);
  if (!pinned.ok) throw new Error("player never started");

  if (o.fullscreen) {
    await evalIn(cdp, page, `(() => {
      const b = document.querySelector('button[aria-label^="Full screen"]');
      if (b) b.click();
      return !!b;
    })()`);
    await sleep(3000);
    console.log(`fullscreen: ${JSON.stringify(await evalIn(cdp, page, `({viewport: innerWidth+"x"+innerHeight, box: (() => { const v=document.querySelector("#movie_player video.html5-main-video"); const r=v.getBoundingClientRect(); return Math.round(r.width)+"x"+Math.round(r.height); })()})`))}`);
  }
}

// --- 4. record --------------------------------------------------------------
// An MV3 service worker is lazy and may not exist as a target yet. Triggering
// the action wakes it; the extension treats an unarmed invocation as a no-op.
async function findSw() {
  const { targetInfos } = await cdp.send("Target.getTargets");
  return targetInfos.find((t) => t.type === "service_worker" && t.url.includes(ext.id));
}
let swTarget = null;
for (let i = 0; i < 30 && !swTarget; i++) {
  swTarget = await findSw();
  if (swTarget) break;
  if (i === 4 || i === 14) {
    const tid = await tabTargetId(cdp, page).catch(() => null);
    if (tid) await cdp.send("Extensions.triggerAction", { id: ext.id, targetId: tid }).catch(() => {});
  }
  await sleep(500);
}
if (!swTarget) throw new Error("extension service worker target not found");
const { sessionId: sw } = await cdp.send("Target.attachToTarget", { targetId: swTarget.targetId, flatten: true });
await cdp.send("Runtime.enable", {}, sw);

if (o.activate) await cdp.send("Target.activateTarget", { targetId: target.id });

const video = {};
if (o.width) video.maxWidth = o.width;
if (o.height) video.maxHeight = o.height;
if (o.fps) video.maxFrameRate = o.fps;
const startOpts = JSON.stringify({
  video: Object.keys(video).length ? video : null,
  mimeType: o.mime,
});

let started = await evalIn(cdp, sw, `self.mcStart(${startOpts})`);
if (started.phase !== "recording") {
  // tabCapture may require the extension to have been *invoked* on the tab.
  // Extensions.triggerAction is the CDP equivalent of clicking the icon and
  // is what grants activeTab.
  console.log(`start     : direct call refused -> ${started.error}`);
  console.log(`start     : retrying via Extensions.triggerAction (grants activeTab)`);
  await evalIn(cdp, sw, `(() => { self.mcOpts = ${startOpts}; self.mcArmed = true; return true; })()`);
  await cdp.send("Extensions.triggerAction", { id: ext.id, targetId: await tabTargetId(cdp, page) });
  await sleep(1500);
  started = await evalIn(cdp, sw, `self.mcState`);
}
if (started.phase !== "recording") throw new Error(`capture did not start: ${started.error}`);
console.log(`recording : started  ${JSON.stringify(started.note?.tracks?.video?.settings ?? {})}`);
console.log(`recording : mimeType chosen by MediaRecorder = ${started.note?.mimeType}`);

if (o.minimize) {
  await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "minimized" } });
  console.log(`window    : minimized at t+0`);
}

for (let t = 5; t <= o.seconds; t += 5) {
  await sleep(5000);
  const s = await evalIn(cdp, sw, `self.mcStatus()`);
  process.stdout.write(`  t+${String(t).padStart(3)}s  chunks=${s.offscreen?.chunks} bytes=${s.offscreen?.bytes}\n`);
}

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
const filename = `${o.label}-${stamp}.webm`;
const stopped = await evalIn(cdp, sw, `self.mcStop(${JSON.stringify({ filename })})`);
if (o.minimize) await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
if (stopped.phase !== "saved") throw new Error(`stop failed: ${stopped.error}`);

// --- 5. report --------------------------------------------------------------
const landed = stopped.file.path;
if (!landed) throw new Error(`download never completed: ${JSON.stringify(stopped)}`);
const path = join(OUT_DIR, filename);
if (landed !== path) renameSync(landed, path);
const size = statSync(path).size;
console.log("");
console.log(`OUTPUT_PATH : ${path}`);
console.log(`OUTPUT_BYTES: ${size}`);
console.log(`RECORDER    : mime=${stopped.file.mimeType} blob=${stopped.file.bytes} wallMs=${stopped.file.durationMs} via=${stopped.file.via}`);
console.log(`DIR         : ${readdirSync(OUT_DIR).join(", ")}`);
cdp.close();

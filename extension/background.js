// Marlin Cast capture spike — background service worker.
//
// Only job: get a tabCapture stream id for the active tab, hand it to an
// offscreen document (a service worker has no MediaRecorder and no
// navigator.mediaDevices), and relay start/stop.
//
// Driven two ways, because it is not yet known which one Chrome allows:
//   1. the toolbar action being invoked (Extensions.triggerAction over CDP),
//      which is what grants activeTab; or
//   2. self.mcStart()/self.mcStop() called directly in this worker over CDP.
// Both land in the same code path.

const OFFSCREEN = "offscreen.html";

self.mcState = { phase: "idle", error: null, file: null, note: null };

async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (existing.length > 0) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN,
    reasons: ["USER_MEDIA"],
    justification: "Records the tabCapture MediaStream with MediaRecorder.",
  });
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) return tab.id;
  const [any] = await chrome.tabs.query({ active: true });
  if (!any) throw new Error("no active tab");
  return any.id;
}

// opts: { tabId?, video?: {maxWidth,maxHeight,maxFrameRate}, mimeType?, filename? }
self.mcStart = async function mcStart(opts = {}) {
  try {
    self.mcState = { phase: "starting", error: null, file: null, note: null };
    const tabId = opts.tabId ?? (await activeTabId());
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    await ensureOffscreen();
    const res = await chrome.runtime.sendMessage({
      to: "offscreen",
      cmd: "start",
      streamId,
      video: opts.video ?? null,
      mimeType: opts.mimeType ?? null,
    });
    self.mcState = { phase: res?.ok ? "recording" : "error", error: res?.error ?? null, file: null, note: res?.note ?? null };
    return self.mcState;
  } catch (e) {
    self.mcState = { phase: "error", error: String(e && e.message ? e.message : e), file: null, note: null };
    return self.mcState;
  }
};

self.mcStop = async function mcStop(opts = {}) {
  try {
    const res = await chrome.runtime.sendMessage({ to: "offscreen", cmd: "stop" });
    if (!res?.ok) {
      self.mcState = { phase: "error", error: res?.error ?? "stop failed", file: null, note: null };
      return self.mcState;
    }
    const filename = opts.filename ?? `marlin-cast-${Date.now()}.webm`;
    let downloadId = null;
    let via = null;
    try {
      downloadId = await chrome.downloads.download({ url: res.url, filename, saveAs: false });
      via = "sw";
    } catch (e) {
      // Blob URLs minted in the offscreen document are not always fetchable
      // from the worker; fall back to downloading from the document itself.
      const alt = await chrome.runtime.sendMessage({ to: "offscreen", cmd: "download", filename });
      if (!alt?.ok) throw new Error(`sw download failed (${e}); offscreen fallback failed (${alt?.error})`);
      downloadId = alt.downloadId ?? null;
      via = "offscreen";
    }
    // The driver needs the real path on disk. A CDP download override renames
    // the file to a GUID, so the requested filename cannot be assumed —
    // chrome.downloads.search reports where it actually landed.
    let item = null;
    for (let i = 0; i < 240; i++) {
      const [found] = await chrome.downloads.search({ id: downloadId });
      item = found ?? null;
      if (item && (item.state === "complete" || item.state === "interrupted")) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    self.mcState = {
      phase: item?.state === "complete" ? "saved" : "error",
      error: item ? (item.state === "complete" ? null : `download ${item.state}: ${item.error}`) : "download not found",
      file: {
        requested: filename,
        path: item?.filename ?? null,
        onDiskBytes: item?.bytesReceived ?? null,
        downloadId, via, bytes: res.bytes, mimeType: res.mimeType, durationMs: res.durationMs,
      },
      note: res.note ?? null,
    };
    return self.mcState;
  } catch (e) {
    self.mcState = { phase: "error", error: String(e && e.message ? e.message : e), file: null, note: null };
    return self.mcState;
  }
};

self.mcStatus = async function mcStatus() {
  let off = null;
  try {
    off = await chrome.runtime.sendMessage({ to: "offscreen", cmd: "status" });
  } catch (e) {
    off = { error: String(e) };
  }
  return { sw: self.mcState, offscreen: off };
};

// Path 2: the toolbar action. Invoking it is what grants activeTab, so if
// tabCapture refuses a bare mcStart() this is the route that works.
//
// It only records when the driver has armed it first. An unarmed invocation
// is a no-op, which makes triggering the action a safe way to wake a dormant
// service worker.
self.mcArmed = false;
self.mcOpts = {};
chrome.action.onClicked.addListener(async (tab) => {
  if (!self.mcArmed) {
    self.mcState = { phase: "idle", error: null, file: null, note: "woken, not armed" };
    return;
  }
  self.mcArmed = false;
  await self.mcStart({ ...self.mcOpts, tabId: tab.id });
});

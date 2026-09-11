// Marlin Cast capture spike — offscreen document.
//
// This exists only because a MV3 service worker has neither
// navigator.mediaDevices nor MediaRecorder. It turns a tabCapture stream id
// into a MediaStream, records it, and hands back a blob URL.

let stream = null;
let recorder = null;
let chunks = [];
let blob = null;
let blobUrl = null;
let startedAt = 0;
let stoppedAt = 0;
let audioCtx = null;
let observed = null;

function trackInfo() {
  if (!stream) return null;
  const v = stream.getVideoTracks()[0];
  const a = stream.getAudioTracks()[0];
  return {
    video: v ? { label: v.label, settings: v.getSettings() } : null,
    audio: a ? { label: a.label, settings: a.getSettings() } : null,
  };
}

async function start(msg) {
  if (recorder) throw new Error("already recording");
  chunks = [];
  blob = null;
  if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }

  const video = { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: msg.streamId } };
  if (msg.video) Object.assign(video.mandatory, msg.video);

  stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: msg.streamId } },
    video,
  });

  // Tab capture mutes the tab locally. Route the captured audio back to the
  // default output so the tab keeps making sound while it is recorded.
  audioCtx = new AudioContext();
  audioCtx.createMediaStreamSource(stream).connect(audioCtx.destination);

  // No mimeType is requested on purpose: whatever MediaRecorder picks by
  // default is one of the things this spike is meant to find out.
  recorder = msg.mimeType ? new MediaRecorder(stream, { mimeType: msg.mimeType }) : new MediaRecorder(stream);
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  // A timeslice makes progress observable while recording and keeps the blob
  // from being assembled as one allocation at the end.
  recorder.start(1000);
  startedAt = performance.now();
  stoppedAt = 0;
  observed = { mimeType: recorder.mimeType, state: recorder.state, tracks: trackInfo() };
  return { ok: true, note: observed };
}

function stop() {
  return new Promise((resolve) => {
    if (!recorder) return resolve({ ok: false, error: "not recording" });
    const snapshot = { mimeType: recorder.mimeType, tracks: trackInfo() };
    recorder.onstop = () => {
      stoppedAt = performance.now();
      blob = new Blob(chunks, { type: snapshot.mimeType });
      blobUrl = URL.createObjectURL(blob);
      for (const t of stream.getTracks()) t.stop();
      if (audioCtx) { audioCtx.close(); audioCtx = null; }
      recorder = null;
      resolve({
        ok: true,
        url: blobUrl,
        bytes: blob.size,
        mimeType: snapshot.mimeType,
        durationMs: Math.round(stoppedAt - startedAt),
        note: snapshot,
      });
    };
    recorder.stop();
  });
}

async function download(filename) {
  if (!blobUrl) return { ok: false, error: "nothing recorded" };
  const downloadId = await chrome.downloads.download({ url: blobUrl, filename, saveAs: false });
  return { ok: true, downloadId };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.to !== "offscreen") return false;
  (async () => {
    try {
      if (msg.cmd === "start") sendResponse(await start(msg));
      else if (msg.cmd === "stop") sendResponse(await stop());
      else if (msg.cmd === "download") sendResponse(await download(msg.filename));
      else if (msg.cmd === "status") {
        sendResponse({
          ok: true,
          recording: !!recorder,
          chunks: chunks.length,
          bytes: chunks.reduce((n, c) => n + c.size, 0),
          elapsedMs: startedAt ? Math.round((stoppedAt || performance.now()) - startedAt) : 0,
          observed,
          tracks: trackInfo(),
        });
      } else sendResponse({ ok: false, error: `unknown cmd ${msg.cmd}` });
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  })();
  return true;
});

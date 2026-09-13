// Marlin Cast HTTP server — D006's output contract.
//
//   GET  /                            one plain status page
//   GET  /health                      plain status
//   GET  /playlist                    M3U of the full lineup (D013), both providers
//   GET  /playlist/:slug              the same M3U for one provider (D021)
//   GET  /stream/:key/index.m3u8      HLS playlist for a channel (tunes on demand)
//   GET  /stream/:key/init.mp4        fMP4 init segment (#EXT-X-MAP)
//   GET  /stream/:key/:segment.m4s    fMP4 media segments
//   POST /ingest/:key/:token          the capture extension's WebM timeslices
//
// :key is the channel's stable key (D020): YouTube TV's guide stationId or
// Philo's channelId. A provider's watch/broadcast id never appears in a URL.
//
// Binds 0.0.0.0:8804 and nothing else (D008).

import express from "express";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadChannels, ROOT } from "./channels.js";
import { Pipeline, IDLE_MS } from "./capture.js";
import { PROVIDERS, type Channel, type Provider } from "./providers/index.js";

const PORT = 8804;
const HOST = "0.0.0.0";
const CDP_PORT = process.env.CDP_PORT ?? "9333";
/** How long to wait for ffmpeg to cut the first segments before answering. */
const FIRST_SEGMENT_TIMEOUT_MS = Number(process.env.MC_FIRST_SEGMENT_MS ?? 30000);

const cache = loadChannels();
if (!cache) {
  console.error("No channel cache. Run:  npm run channels");
  process.exit(1);
}
const unkeyed = cache.channels.filter((c) => !c.key);
if (unkeyed.length) {
  console.error(`The channel cache has ${unkeyed.length} channels with no key (it predates D020). Run:  npm run channels`);
  process.exit(1);
}
const byKey = new Map<string, Channel>(cache.channels.map((c) => [c.key, c]));
console.log(`channels: ${cache.count} (enumerated ${cache.enumeratedAt}) ${JSON.stringify(cache.byProvider ?? {})}`);

const pipeline = new Pipeline(CDP_PORT);
const browser = await pipeline.connect();
console.log(`attached to Chrome ${browser} on 127.0.0.1:${CDP_PORT}`);

const app = express();
app.disable("x-powered-by");

// A browser-based HLS player (Channels DVR's web player is Video.js + hls.js)
// fetches the playlist and segments with XHR/fetch, so a stream served from a
// different origin than the page is blocked by CORS before a single byte is
// parsed. Task-009 reproduced exactly that: hls.js reported a fatal
// `manifestLoadError` cross-origin, and played the identical stream when the
// test browser was started with --disable-web-security. A server-side
// remuxer (ffmpeg, curl, Channels' own puller) is unaffected, which is why the
// stream could be "received" and still play nothing.
app.use((req, res, next) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, HEAD, OPTIONS");
  res.setHeader("access-control-allow-headers", "range, origin, accept, content-type");
  res.setHeader("access-control-expose-headers", "content-length, content-range, accept-ranges, date");
  res.setHeader("access-control-max-age", "86400");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  next();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- ingest: raw body straight from the extension ---------------------------
app.post("/ingest/:key/:token", express.raw({ type: "*/*", limit: "64mb" }), (req, res) => {
  const ok = pipeline.ingest(req.params.key, req.params.token, req.body as Buffer);
  res.status(ok ? 204 : 409).end();
});

// --- health -----------------------------------------------------------------
app.get("/health", (_req, res) => {
  const s = pipeline.status();
  res.type("text/plain").send(
    [
      `status: ok`,
      `channels: ${cache.count}`,
      `enumerated: ${cache.enumeratedAt}`,
      `state: ${s.state}`,
      `quality: ${s.quality ?? "-"}`,
      `provider: ${s.provider ?? "-"}`,
      `channel: ${s.channelName ?? "-"} (${s.channelKey ?? "-"})`,
      `since: ${s.since ?? "-"}`,
      `chunks_in: ${s.chunksIn}`,
      `bytes_in: ${s.bytesIn}`,
      `segments: ${s.segments}`,
      `last_access: ${s.lastAccess ?? "-"}`,
      `last_error: ${s.lastError ?? "-"}`,
      "",
    ].join("\n"),
  );
});

// --- playlist ---------------------------------------------------------------
function baseUrl(req: express.Request): string {
  return `http://${req.headers.host ?? `127.0.0.1:${PORT}`}`;
}

/** Test sliver toward D015 (task-017), re-keyed by D020: an explicit Gracenote
 *  station id for ONE channel only — ESPN guide row 17, the regular ESPN feed
 *  the owner tunes. 32645 is PrismCast's own tvc-guide-stationid for ESPN.
 *  Hardcoded on this one key; no mapping table, file, or config. */
const ESPN_SLIVER_KEY = "UCW7W_WAogi3qWDbO9PqOmZQ";

function playlist(req: express.Request, providers: Provider[]): string {
  const base = baseUrl(req);
  const lines = ["#EXTM3U"];
  // Providers in registry order (D017: YouTube TV first, then Philo), each
  // channel in the order its provider enumerated it.
  for (const provider of providers) {
    for (const c of cache.channels.filter((x) => x.provider === provider.id)) {
      const name = c.name;
      const attrs = [
        `tvg-id="${c.key}"`,
        `tvg-name="${name.replace(/"/g, "")}"`,
        c.logo ? `tvg-logo="${c.logo}"` : null,
        `group-title="${provider.label}"`,
        c.key === ESPN_SLIVER_KEY ? `tvc-guide-stationid="32645"` : null,
      ].filter(Boolean).join(" ");
      lines.push(`#EXTINF:-1 ${attrs},${name}`);
      lines.push(`${base}/stream/${c.key}/index.m3u8`);
    }
  }
  return lines.join("\n") + "\n";
}

app.get("/playlist", (req, res) => {
  res.type("application/x-mpegurl").send(playlist(req, PROVIDERS));
});

// D021: the same format, filtered to one provider.
app.get("/playlist/:slug", (req, res) => {
  const provider = PROVIDERS.find((p) => p.slug === req.params.slug);
  if (!provider) return res.status(404).type("text/plain").send("unknown playlist\n");
  res.type("application/x-mpegurl").send(playlist(req, [provider]));
});

// --- HLS --------------------------------------------------------------------

// ffmpeg's hls muxer writes EXT-X-PROGRAM-DATE-TIME as local time with a
// strftime %z suffix ("2026-09-11T18:57:08.959-0400") and places it AFTER
// the segment's #EXTINF line. It has no option for either. Task-013 measured
// what that costs: Go's time.RFC3339 parser rejects "-0400" ("cannot parse
// "-0400" as "Z07:00""), Channels DVR is a Go program, and it logged
// start_at == end_at for our stream while the reference stream — which
// writes "2026-09-11T22:57:42.736Z" BEFORE #EXTINF — produced no such line.
// So the playlist is rewritten at serve time: same instant converted to UTC
// with a trailing Z and millisecond precision, moved to immediately precede
// its segment's #EXTINF. Nothing else in the playlist is touched (task-014).
const PDT_TAG = "#EXT-X-PROGRAM-DATE-TIME:";
const PDT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:?\d{2})?$/;

/** "2026-09-11T18:57:08.959-0400" -> "2026-09-11T22:57:08.959Z"; unparseable
 *  input is returned unchanged rather than relabelled. */
export function pdtToUtc(value: string): string {
  const m = PDT_RE.exec(value.trim());
  if (!m) return value;
  const [, Y, Mo, D, h, mi, s, frac = "0", tz = "Z"] = m;
  const ms = Number((frac + "00").slice(0, 3));
  let utc = Date.UTC(+Y, +Mo - 1, +D, +h, +mi, +s, ms);
  if (tz !== "Z") {
    const sign = tz[0] === "-" ? -1 : 1;
    const digits = tz.slice(1).replace(":", "");
    utc -= sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4))) * 60_000;
  }
  return new Date(utc).toISOString();
}

export function rewritePlaylist(text: string): string {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith(PDT_TAG)) { out.push(line); continue; }
    const fixed = PDT_TAG + pdtToUtc(line.slice(PDT_TAG.length));
    // Walk back over the tags of the pending segment (never past a URI line)
    // to find its #EXTINF, and insert the date-time immediately before it.
    let at = -1;
    for (let i = out.length - 1; i >= 0 && out[i].startsWith("#"); i--) {
      if (out[i].startsWith("#EXTINF:")) { at = i; break; }
    }
    if (at >= 0) out.splice(at, 0, fixed); else out.push(fixed);
  }
  return out.join("\n");
}

app.get("/stream/:key/index.m3u8", async (req, res) => {
  const channel = byKey.get(req.params.key);
  if (!channel) return res.status(404).type("text/plain").send("unknown channel\n");

  try {
    await pipeline.ensure(channel);
  } catch (e) {
    console.error(`[serve] ${String(e)}`);
    return res.status(503).type("text/plain").send(`tune failed: ${String(e)}\n`);
  }

  const file = join(pipeline.dirFor(channel.key), "index.m3u8");
  const deadline = Date.now() + FIRST_SEGMENT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      pipeline.touch(channel.key);
      res.type("application/vnd.apple.mpegurl");
      res.setHeader("cache-control", "no-cache");
      return res.send(rewritePlaylist(readFileSync(file, "utf8")));
    }
    if (pipeline.currentChannelKey() !== channel.key) {
      return res.status(409).type("text/plain").send("tune switched away\n");
    }
    await sleep(400);
  }
  res.status(504).type("text/plain").send("timed out waiting for the first segment\n");
});

app.get("/stream/:key/:file", (req, res) => {
  const { key, file } = req.params;
  if (!/^[A-Za-z0-9_.-]+\.(ts|m4s|mp4)$/.test(file)) return res.status(400).end();
  if (!byKey.has(key)) return res.status(404).end();
  const path = join(pipeline.dirFor(key), file);
  if (!existsSync(path)) return res.status(404).end();
  pipeline.touch(key);
  // sendFile honours Range and sets Accept-Ranges/Content-Range; the previous
  // createReadStream().pipe() answered `Range: bytes=0-99` with a 200 and the
  // whole file.
  //
  // no-cache, NOT immutable. Task-009 marked these immutable on the reasoning
  // that a written segment never changes — true of the file, false of the URL.
  // Every tune wipes the directory and ffmpeg restarts numbering at
  // seg00000.m4s, so the same URL returns different media after a retune and a
  // cached copy would be stale. The reference stream (PrismCast, which plays
  // in the same player) sends `Cache-Control: no-cache` on its segments.
  // fMP4 init segment and .m4s media segments are both video/mp4 (task-012);
  // .ts stays video/mp2t should a TS segment ever be served again.
  res.type(file.endsWith(".ts") ? "video/mp2t" : "video/mp4");
  res.setHeader("cache-control", "no-cache");
  res.sendFile(path, (err) => { if (err && !res.headersSent) res.status(404).end(); });
});

// --- icon -------------------------------------------------------------------
// The owner-supplied 512x512 app icon (task-026), for Unraid's template and any
// consumer that wants one. Static and versioned with the image, so a day of
// caching is safe; sendFile sets Content-Type from the extension.
const ICON = join(ROOT, "assets", "icon.png");
app.get("/icon.png", (_req, res) => {
  res.setHeader("cache-control", "public, max-age=86400");
  res.sendFile(ICON, (err) => { if (err && !res.headersSent) res.status(404).end(); });
});

// --- status page ------------------------------------------------------------
// One plain page: the URLs a client needs — /playlist, one /playlist/<slug> per
// provider (D021), /health — built from the request's Host header so they are
// copyable from whatever address the browser reached us on;
// the server's status, what is tuned, and the last reported quality. No
// framework, no dependency, nothing editable — read-only, like /health.
function esc(v: unknown): string {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

app.get("/", (req, res) => {
  const base = baseUrl(req);
  const s = pipeline.status();
  const tuned = s.channelName
    ? `${esc(s.provider ?? "?")} — ${esc(s.channelName)} <code>${esc(s.channelKey ?? "?")}</code>`
    : "idle — nothing tuned";
  const rows: [string, string][] = [
    ["server", `listening on ${HOST}:${PORT}`],
    ["channels", `${cache.count}${cache.byProvider ? " (" + Object.entries(cache.byProvider).map(([k, v]) => `${esc(k)} ${v}`).join(", ") + ")" : ""}`],
    ["enumerated", esc(cache.enumeratedAt)],
    ["state", esc(s.state)],
    ["tuned", tuned],
    ["last quality", esc(s.quality ?? "—")],
    ["idle stop", `${IDLE_MS} ms with no client request`],
  ];
  const url = (href: string) =>
    `<div class="u"><code id="${esc(href)}">${esc(href)}</code>` +
    `<button type="button" data-url="${esc(href)}">Copy</button></div>`;
  res.type("text/html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Marlin Cast</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 system-ui, sans-serif; margin: 0; padding: 24px; max-width: 720px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.sub { margin: 0 0 24px; opacity: .7; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; opacity: .6; margin: 24px 0 8px; }
  .u { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
  .u code { flex: 1 1 320px; padding: 8px 10px; border: 1px solid rgba(128,128,128,.4); border-radius: 6px; overflow-x: auto; }
  button { padding: 8px 14px; border: 1px solid rgba(128,128,128,.4); border-radius: 6px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
  button:hover { border-color: currentColor; }
  table { border-collapse: collapse; width: 100%; }
  td { padding: 6px 0; border-bottom: 1px solid rgba(128,128,128,.2); vertical-align: top; }
  td:first-child { width: 160px; opacity: .6; }
</style></head><body>
<h1>Marlin Cast</h1>
<p class="sub">Tunes one channel at a time in a logged-in Chrome and serves it as HLS.</p>
<h2>URLs</h2>
${url(`${base}/playlist`)}
${PROVIDERS.map((p) => url(`${base}/playlist/${p.slug}`)).join("\n")}
${url(`${base}/health`)}
<h2>Status</h2>
<table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join("")}</table>
<script>
document.addEventListener("click", function (e) {
  var b = e.target.closest("button[data-url]");
  if (!b) return;
  var text = b.getAttribute("data-url");
  var done = function () { var o = b.textContent; b.textContent = "Copied"; setTimeout(function () { b.textContent = o; }, 1200); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, fallback);
  } else { fallback(); }
  function fallback() {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (err) { b.textContent = "Copy failed"; }
    document.body.removeChild(ta);
  }
});
</script>
</body></html>
`);
});

app.use((_req, res) => res.status(404).type("text/plain").send("not found\n"));

const server = app.listen(PORT, HOST, () => {
  console.log(`Marlin Cast listening on http://${HOST}:${PORT}`);
  console.log(`  playlist : http://127.0.0.1:${PORT}/playlist`);
  console.log(`  health   : http://127.0.0.1:${PORT}/health`);
  console.log(`  idle stop: ${IDLE_MS} ms with no client request`);
});

async function shutdown(sig: string) {
  console.log(`\n${sig} — shutting down`);
  server.close();
  await pipeline.shutdown();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

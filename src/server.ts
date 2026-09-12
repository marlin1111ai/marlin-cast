// Marlin Cast HTTP server — D006's output contract.
//
//   GET  /health                      plain status
//   GET  /playlist                    M3U of the full lineup (D013)
//   GET  /stream/:id/index.m3u8       HLS playlist for a channel (tunes on demand)
//   GET  /stream/:id/init.mp4         fMP4 init segment (#EXT-X-MAP)
//   GET  /stream/:id/:segment.m4s     fMP4 media segments
//   POST /ingest/:id/:token           the capture extension's WebM timeslices
//
// Binds 0.0.0.0:8804 and nothing else (D008).

import express from "express";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadChannels, type Channel } from "./channels.js";
import { Pipeline, IDLE_MS } from "./capture.js";

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
const byId = new Map<string, Channel>(cache.channels.map((c) => [c.id, c]));
console.log(`channels: ${cache.count} (enumerated ${cache.enumeratedAt})`);

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
app.post("/ingest/:id/:token", express.raw({ type: "*/*", limit: "64mb" }), (req, res) => {
  const ok = pipeline.ingest(req.params.id, req.params.token, req.body as Buffer);
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
      `channel: ${s.channelName ?? "-"} (${s.channelId ?? "-"})`,
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

app.get("/playlist", (req, res) => {
  const base = baseUrl(req);
  const lines = ["#EXTM3U"];
  for (const c of cache.channels) {
    const attrs = [
      `tvg-id="${c.id}"`,
      `tvg-name="${c.name.replace(/"/g, "")}"`,
      c.logo ? `tvg-logo="${c.logo}"` : null,
      `group-title="YouTube TV"`,
      // Test sliver toward D015 (task-017): give Channels DVR an explicit
      // Gracenote station id for ONE channel only — ESPN, the channel the
      // owner tunes in every test — to see whether it changes Channels'
      // behaviour. 32645 is PrismCast's own tvc-guide-stationid for ESPN.
      // Hardcoded on this one channel id; no mapping table, file, or config.
      // We carry four channels named "ESPN"; MrXg0chrojg is the tuned one.
      c.id === "MrXg0chrojg" ? `tvc-guide-stationid="32645"` : null,
    ].filter(Boolean).join(" ");
    lines.push(`#EXTINF:-1 ${attrs},${c.name}`);
    lines.push(`${base}/stream/${c.id}/index.m3u8`);
  }
  res.type("application/x-mpegurl").send(lines.join("\n") + "\n");
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

app.get("/stream/:id/index.m3u8", async (req, res) => {
  const channel = byId.get(req.params.id);
  if (!channel) return res.status(404).type("text/plain").send("unknown channel\n");

  try {
    await pipeline.ensure(channel);
  } catch (e) {
    console.error(`[serve] ${String(e)}`);
    return res.status(503).type("text/plain").send(`tune failed: ${String(e)}\n`);
  }

  const file = join(pipeline.dirFor(channel.id), "index.m3u8");
  const deadline = Date.now() + FIRST_SEGMENT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      pipeline.touch(channel.id);
      res.type("application/vnd.apple.mpegurl");
      res.setHeader("cache-control", "no-cache");
      return res.send(rewritePlaylist(readFileSync(file, "utf8")));
    }
    if (pipeline.currentChannelId() !== channel.id) {
      return res.status(409).type("text/plain").send("tune switched away\n");
    }
    await sleep(400);
  }
  res.status(504).type("text/plain").send("timed out waiting for the first segment\n");
});

app.get("/stream/:id/:file", (req, res) => {
  const { id, file } = req.params;
  if (!/^[A-Za-z0-9_.-]+\.(ts|m4s|mp4)$/.test(file)) return res.status(400).end();
  if (!byId.has(id)) return res.status(404).end();
  const path = join(pipeline.dirFor(id), file);
  if (!existsSync(path)) return res.status(404).end();
  pipeline.touch(id);
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

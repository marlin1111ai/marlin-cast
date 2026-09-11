// Marlin Cast HTTP server — D006's output contract.
//
//   GET  /health                      plain status
//   GET  /playlist                    M3U of the full lineup (D013)
//   GET  /stream/:id/index.m3u8       HLS playlist for a channel (tunes on demand)
//   GET  /stream/:id/:segment.ts      HLS segments
//   POST /ingest/:id/:token           the capture extension's WebM timeslices
//
// Binds 0.0.0.0:8804 and nothing else (D008).

import express from "express";
import { createReadStream, existsSync, readFileSync } from "node:fs";
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
    ].filter(Boolean).join(" ");
    lines.push(`#EXTINF:-1 ${attrs},${c.name}`);
    lines.push(`${base}/stream/${c.id}/index.m3u8`);
  }
  res.type("application/x-mpegurl").send(lines.join("\n") + "\n");
});

// --- HLS --------------------------------------------------------------------
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
      return res.send(readFileSync(file));
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
  if (!/^[A-Za-z0-9_.-]+\.(ts|m4s)$/.test(file)) return res.status(400).end();
  if (!byId.has(id)) return res.status(404).end();
  const path = join(pipeline.dirFor(id), file);
  if (!existsSync(path)) return res.status(404).end();
  pipeline.touch(id);
  res.type("video/mp2t");
  createReadStream(path).pipe(res);
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

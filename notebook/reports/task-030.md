# Task 030 — does anything keep a recorded chunk after it is sent? (2026-09-28)

Date: 2026-09-28, 20:25–20:45 EDT (2026-09-29 00:25–00:45Z). Host: marlinpc.
Code read at `ced3234` (`src/` and `extension/` are unchanged since `c876a3a`,
the image the recon measured).

**Result: STOPPED after step 1, on the brief's own branch — nothing keeps a
reference to a chunk after it is sent. No code change was made.** Steps 2–7
(fix, image, run, measurement, clean-up of a run, GHCR check) were not run:
no image was built or pulled, no container was started, the backup was not
read, and nothing was written to the scratchpad. This pass read files and ran
`grep`, `ls`, `git` and `date`; nothing else.

Nothing on 192.168.1.250 or 192.168.1.30 was contacted. `data/chrome-profile`,
`backups/`, `data/chrome-profile-v11-*` and `/Apps/marlin-iptv-editor` were not
read or written. No owner Chrome was touched. No file under `src/`,
`extension/`, `docker/`, `scripts/` or `Dockerfile` was changed.

This report holds no measurement. The only figures in it are quoted from
`notebook/reports/recon-chrome-memory.md`, with the line they come from.

---

## Step 1 — the path of one chunk

On the app's path the extension always streams: `src/capture.ts:357-361`
passes `ingest` and `timeslice` on every tune, so `ingest` is set in the
offscreen document (`extension/offscreen.js:37`) for every recording the app
makes.

| # | file:line | what holds the chunk | from | until |
|---|---|---|---|---|
| 1 | `extension/offscreen.js:56` | the `BlobEvent` `e`; the chunk is the Blob `e.data` | MediaRecorder cuts the timeslice (`:78`, every `TIMESLICE_MS` = 1000 ms, `src/capture.ts:28`) | the handler returns — unless captured, see 3 |
| 2 | `extension/offscreen.js:58` | `chunks.push(e.data)` | — | **not reached when streaming**: the line runs only if `ingest` is unset |
| 3 | `extension/offscreen.js:63-74` | the `async` callback queued on `sendChain`; it reads `e.data` at `:68`, so it captures `e` | the handler runs | the callback finishes (the `fetch` at `:65` has settled, `sent++` at `:70` or the `catch` at `:71-73`) |
| 4 | `extension/offscreen.js:65-69` | the `fetch` request, whose `body` is the Blob | the callback's turn in the chain | the server's answer arrives. The `Response` is assigned to nothing and its body is never read; the server answers 204 or 409 with no body (`src/server.ts:73`) |
| 5 | `extension/offscreen.js:18`, `:63` | `sendChain` | — | holds one promise, the newest; each is replaced by the next (`:63`) and by a fresh one at the next `start()` (`:38`). A promise in the chain resolves to `undefined`, not to a chunk |
| 6 | `src/server.ts:71` | `express.raw({ type: "*/*", limit: "64mb" })` collects the POST body into one `Buffer`, `req.body` | the POST arrives | the request object is dropped after `res.status(…).end()` (`:73`); nothing stores `req` |
| 7 | `src/capture.ts:375-382` | `ingest()`'s parameter `buf`; `l.ffmpeg.stdin.write(buf)` at `:380` | the route handler calls it (`src/server.ts:72`) | `ingest()` returns; Node's stream keeps `buf` queued until the pipe to ffmpeg takes it. `l.chunksIn` and `l.bytesIn` (`:378-379`) are counters |

`extension/background.js` never receives a chunk. Its messages carry the
stream id, the options and, at stop, counts and the ingest URL
(`background.js:44-52`, `:63`, `:72-79`); `self.mcState` (`:15`, `:53`,
`:69-81`) holds those and nothing built from a chunk.

**Places that would hold a whole recording, and why they are not in play:**

| file:line | holds | why not on the app's path |
|---|---|---|
| `extension/offscreen.js:9`, `:58` | `chunks`, every Blob of the recording | file mode only (`!ingest`). Reset at each `start()` (`:34`) |
| `extension/offscreen.js:10`, `:107` | `blob`, one Blob built from `chunks` | file mode only: a streaming stop returns at `:98`, before `:107`. Reset at `:35` |
| `extension/offscreen.js:11`, `:108` | `blobUrl`, an object URL on that Blob | same; revoked at the next `start()` (`:36`) |
| `extension/offscreen.js:140` | reads `chunks` for `status` | reads only; empty when streaming |

**Holders that last until the chunk is sent or consumed, not after:**

- The send chain is a queue while POSTs are outstanding: every chunk cut
  while an earlier POST is in flight waits in its own callback (row 3).
  `stop()` awaits the chain (`extension/offscreen.js:95`), so it is empty
  when the stop is reported.
- `src/capture.ts:380` ignores `write()`'s return value, so there is no
  backpressure: if ffmpeg reads more slowly than chunks arrive, Node queues
  them. The queue goes with the child process at stop
  (`capture.ts:395-400`), and `this.live = null` (`:404`) drops the last
  reference to it. Nothing else holds `l`: the `exit` handler (`:343-346`)
  closes over `this` and `token`, and the kill timer in `stop()` (`:397`) is
  cleared at exit (`:398`).

**CDP.** The app attaches to the provider's page (`src/capture.ts:125-128`)
and, on every `swSession` call, to the extension's service worker
(`:150-151`). It never attaches to the offscreen document, and it enables
`Network` only during YouTube TV enumeration, on the page session, and
disables it again (`src/providers/youtubetv.ts:134`, `:147`). So no inspector
buffer in the app's own sessions sees a chunk POST.

### The searches behind the tables

Run from `/Apps/marlin-cast` at `ced3234`.

```
$ grep -n -E 'e\.data|chunks|\bblob\b|blobUrl|Blob\(|sendChain|body:|req\.body|\bbuf\b|stdin\.(write|end)|arrayBuffer|ArrayBuffer|createObjectURL|revokeObjectURL' extension/*.js src/*.ts src/providers/*.ts
extension/offscreen.js:5:// into a MediaStream, records it, and hands back a blob URL.
extension/offscreen.js:9:let chunks = [];
extension/offscreen.js:10:let blob = null;
extension/offscreen.js:11:let blobUrl = null;
extension/offscreen.js:18:let sendChain = Promise.resolve();
extension/offscreen.js:34:  chunks = [];
extension/offscreen.js:35:  blob = null;
extension/offscreen.js:36:  if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
extension/offscreen.js:38:  seq = 0; sent = 0; sendError = null; sendChain = Promise.resolve();
extension/offscreen.js:57:    if (!e.data || !e.data.size) return;
extension/offscreen.js:58:    if (!ingest) { chunks.push(e.data); return; }
extension/offscreen.js:63:    sendChain = sendChain.then(async () => {
extension/offscreen.js:68:          body: e.data,
extension/offscreen.js:76:  // A timeslice makes progress observable while recording and keeps the blob
extension/offscreen.js:95:        await sendChain;                  // do not report stopped until every chunk is away
extension/offscreen.js:100:          chunksSent: sent, chunksCut: seq, sendError,
extension/offscreen.js:107:      blob = new Blob(chunks, { type: snapshot.mimeType });
extension/offscreen.js:108:      blobUrl = URL.createObjectURL(blob);
extension/offscreen.js:111:        url: blobUrl,
extension/offscreen.js:112:        bytes: blob.size,
extension/offscreen.js:123:  if (!blobUrl) return { ok: false, error: "nothing recorded" };
extension/offscreen.js:124:  const downloadId = await chrome.downloads.download({ url: blobUrl, filename, saveAs: false });
extension/offscreen.js:139:          chunks: ingest ? seq : chunks.length,
extension/offscreen.js:140:          bytes: chunks.reduce((n, c) => n + c.size, 0),
extension/offscreen.js:142:          chunksSent: sent,
extension/background.js:74:          chunksCut: res.chunksCut,
extension/background.js:75:          chunksSent: res.chunksSent,
src/capture.ts:42:  chunksIn: number;
src/capture.ts:61:  chunksIn: number;
src/capture.ts:173:      chunksIn: l?.chunksIn ?? 0,
src/capture.ts:351:      chunksIn: 0, bytesIn: 0, stopping: false,
src/capture.ts:375:  ingest(key: string, token: string, buf: Buffer): boolean {
src/capture.ts:378:    l.chunksIn++;
src/capture.ts:379:    l.bytesIn += buf.length;
src/capture.ts:380:    if (l.ffmpeg.stdin.writable) l.ffmpeg.stdin.write(buf);
src/capture.ts:395:    try { l.ffmpeg.stdin.end(); } catch { /* already closed */ }
src/server.ts:72:  const ok = pipeline.ingest(req.params.key, req.params.token, req.body as Buffer);
src/server.ts:89:      `chunks_in: ${s.chunksIn}`,
src/providers/philo.ts:69:      headers: { "content-type": "application/json" }, body: ${JSON.stringify(payload)} });
```

`src/providers/philo.ts:69` is Philo's guide query, not a chunk.

```
$ grep -n -E 'closeDocument|collectGarbage|HeapProfiler|gc\(\)|expose-gc|js-flags|location\.reload|window\.close' -r extension src scripts docker Dockerfile
(no output, exit 1)
```

Nothing in the repo closes or reloads the offscreen document, and nothing
asks for a garbage collection.

```
$ grep -n -E '\.enable"|attachToTarget|detachFromTarget' src/*.ts src/providers/*.ts
src/capture.ts:125:      const { sessionId } = await this.cdp.send<any>("Target.attachToTarget", { targetId: t.id, flatten: true });
src/capture.ts:127:      await this.cdp.send("Page.enable", {}, session);
src/capture.ts:128:      await this.cdp.send("Runtime.enable", {}, session);
src/capture.ts:150:        const { sessionId } = await this.cdp.send<any>("Target.attachToTarget", { targetId: sw.targetId, flatten: true });
src/capture.ts:151:        await this.cdp.send("Runtime.enable", {}, sessionId);
src/channels.ts:53:      const { sessionId } = await cdp.send<any>("Target.attachToTarget", { targetId: target.id, flatten: true });
src/channels.ts:54:      await cdp.send("Page.enable", {}, sessionId);
src/channels.ts:55:      await cdp.send("Runtime.enable", {}, sessionId);
src/login.ts:43:    const { sessionId } = await cdp.send<any>("Target.attachToTarget", { targetId: target.id, flatten: true });
src/login.ts:45:    await cdp.send("Page.enable", {}, session);
src/login.ts:46:    await cdp.send("Runtime.enable", {}, session);
src/providers/youtubetv.ts:134:    await cdp.send("Network.enable", { maxTotalBufferSize: 64_000_000, maxResourceBufferSize: 32_000_000 }, session);
```

---

## What the finding is, and what it is not

**Found, from the code:** once a chunk's POST has been answered, no variable,
array, queue, closure or pending request in `extension/` or `src/` refers to
it. The last holder is the send callback (rows 3 and 4), and it ends with the
`fetch`.

**Not found, because this pass ran nothing:** why the browser process still
steps up per tune. The recon's reading
(`notebook/reports/recon-chrome-memory.md:448-454`, marked there as
inference) is unchanged by this trace and fits it:

- A chunk nothing refers to is garbage, not freed memory. JavaScript has no
  call that frees a Blob; the Blob goes when the offscreen document's garbage
  collector next collects it.
- Chrome keeps a Blob's bytes in the browser process, not in the page that
  made it, for as long as the Blob object exists.
- The offscreen document is never closed (`recon-chrome-memory.md:138`; the
  second search above), so nothing but a collection ends those Blobs.

That reading predicts what the recon measured: +26,780 to +29,960 kB of
RssAnon per tune in the browser process, one release of 143,172 kB between
cycles 6 and 7, and the extension renderer's only fall in the same interval
(`recon-chrome-memory.md:433-446`). It is still inference. Nothing in this
pass or the recon looked inside the browser process.

**Why no fix was made.** The brief's step 2 allows a change only in a file
that holds the reference. No file does. `extension/offscreen.js` is where the
chunk is last used, but there is nothing in it to release: the code already
lets go, and a Blob cannot be freed from script.

---

## Files touched, mapped to steps

| File | Step | Change |
|---|---|---|
| `notebook/reports/task-030.md` | 1 | this report |
| `notebook/SESSION-STATE.md` | 1 | entry appended at the end |

Nothing else in the repo. Steps 2–7 touched nothing because they were not
run.

## Pushed, and what stayed local

One notebook-only commit on `main`, pushed and verified with `git fetch` plus
a SHA comparison; the SHAs are in the hand-off and `git log`. A notebook-only
push builds no image (D025, `.github/workflows/docker.yml` `paths-ignore`),
so there is no `sha-<short>` tag for this commit and GHCR is unchanged:
`latest` = `sha-c876a3a`.

Nothing stayed local.

## Deleted, and left over

Nothing was created outside the two notebook files, so nothing was deleted.
Checked at 2026-09-29T00:29Z: `docker ps -a` lists no container; `docker
images` lists no Marlin Cast image; the session scratchpad holds 0 entries.
The backup was not read in this pass, so it was not re-hashed; its last
recorded hash is the recon's
(`6ebd9ea976118bcb8c24e10b590680e5d44e405d1b3a9f7f09a0a3982258dbe3`,
`recon-chrome-memory.md:649-650`).

---

## Open questions — the owner's call

The per-tune step is still there. Each way of ending it needs a change in a
file that holds no reference, so each is a question, not something this pass
could do. None has been tried; whether any of them frees the browser
process's memory is not known.

1. **Ask Chrome to collect the offscreen document's garbage, over CDP.**
   `HeapProfiler.collectGarbage` on the offscreen document's target, sent
   from `src/capture.ts` — at stop, or on a timer during a tune, which is the
   only option here that could release chunks while a long tune is still
   running. Needs a CDP session on the offscreen document, which the app
   does not have today.
2. **Close the offscreen document at stop.**
   `chrome.offscreen.closeDocument()` in `extension/background.js` after a
   streamed stop; `ensureOffscreen` (`background.js:17-27`) already creates
   it again at the next tune. Releases per tune at best, never per chunk, so
   a tune lasting hours would still grow until Chrome collects on its own.
3. **Leave it.** The recon saw Chrome release the memory by itself once in
   12 cycles; the highest reading was 530,028 kB
   (`recon-chrome-memory.md:445-446`). Whether there is a ceiling is not
   known (`recon-chrome-memory.md:676-679`).

A fourth, not offered: a Chrome flag to expose or tune garbage collection
lives in `scripts/start-chrome.sh`, which the brief lists as do-not-touch and
whose flag set D024 item 8 treats as ruled.

Separate from the memory question, seen while tracing: `src/capture.ts:380`
writes to ffmpeg with no backpressure. It is not a retained reference and
the recon shows the app's RSS levelling off (116,088–116,428 kB from cycle 9
on, `recon-chrome-memory.md:479`), so it is recorded here and nothing more.

## Least sure of

1. **That "nothing refers to it" holds inside Chrome as well as in the
   code.** The trace covers the repo's JavaScript and TypeScript. What
   MediaRecorder, `fetch` and the network stack keep internally after a
   request completes was not examined and cannot be from the source here.
2. **That the Blob reading is the cause.** It is the recon's inference and
   this trace is consistent with it; consistency is not proof. A pass that
   forced a collection and watched the browser process's RssAnon would
   settle it.
3. **The promise chain.** Row 5 rests on a settled promise dropping the
   callback queued on it, which is how the language specifies it. It was not
   measured here.
4. **That the brief's branch was the intended one for this finding.** The
   code keeps no reference, but the chunk's memory is still not released
   when it is sent. The brief's wording ("if nothing keeps a reference …
   make no code change") was followed as written.

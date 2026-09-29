# Task 031 — forced collection on the offscreen document (2026-09-28)

Date: 2026-09-28, 20:46–21:50 EDT (2026-09-29 00:46–01:50Z). Host: marlinpc.
Code read at `076f92a`; the change is on top of it. Nothing on 192.168.1.250
or 192.168.1.30 was contacted. No owner Chrome was running on marlinpc (0
chrome processes, nothing on 8091/8092/8804/9333 before the run).
`data/chrome-profile` was not read. `backups/` was read once with `tar -xzf`
and hashed. Nothing under `extension/`, `docker/`, `scripts/`, `Dockerfile`,
`src/providers/` or `src/server.ts` was changed. No credentials, cookies,
tokens, session ids or account identifiers appear in this report;
`VNC_PASSWORD` was a throwaway passed by `--env-file` from a 0600 scratch
file, and the raw logs were searched for it before they were copied here (0
hits).

**Owner's call carried out:** Marlin Cast forces a garbage collection on the
capture extension's offscreen document over CDP
(`HeapProfiler.collectGarbage`) every 60 s during a capture and once at stop.

**Result: the cause is proven and the change passes.**

- **Cause (step 2, unchanged image `sha-c876a3a`).** After three tunes the
  browser process held 448,924 kB (RssAnon 177,012), 97,920 kB above its
  startup reading. One `HeapProfiler.collectGarbage` sent to the offscreen
  document took it to 362,520 kB (RssAnon 92,592): 86,404 kB released, 88% of
  the growth in RSS and 97% of the growth in RssAnon.
- **Change (step 4, image built from the working tree).** Across 12 cycles
  the browser process read 356,556–360,084 kB; the largest step between two
  cycles was +1,412 kB, against +26,056 to +29,960 kB in the recon. Across a
  10-minute pull it read 364,372–380,556 kB with no direction. 14 of 14 pulls
  exited 0. The warning line was logged 0 times.

---

## Result per step

| Step | Result |
|---|---|
| 1 recon | done — the offscreen document is a CDP target of its own; the app does not reach it today |
| 2 prove the cause | done — passed; container removed, profile copy kept |
| 3 change | done — `src/capture.ts` only; `src/cdp.ts` needed nothing |
| 4 build, run, measure | done — (a), 12 cycles, the 10-minute pull, the 30 s pull with ffprobe, cold tune times, warning count |
| 5 clean up | done — see "Clean-up" |
| 6 this report, SESSION-STATE | written |
| 7 commit, push, GHCR | after this report is written; SHAs and the GHCR tag are in the hand-off and `git log` |

## Files touched, mapped to steps

| File | Step | Change |
|---|---|---|
| `src/capture.ts` | 3 | the collection: two constants, one field, one method, a timer at the end of `start()`, two lines in `stop()` (+48 −1) |
| `notebook/reports/task-031.md` | 6 | this report |
| `notebook/SESSION-STATE.md` | 6 | entry appended at the end |

Nothing else in the repo. `src/cdp.ts` was not changed.

---

## Step 1 — how the app reaches the extension's targets

Line numbers in this section are at `076f92a`, before the change.

| file:line | what it does |
|---|---|
| `src/cdp.ts:35-44` | `Cdp.attach`: one WebSocket to the browser target, from `/json/version` on the loopback debug port |
| `src/cdp.ts:46-52` | `send(method, params, sessionId)`: any command, to the browser or, with a session id, to an attached target (flat sessions) |
| `src/capture.ts:112-117` | `connect()`: attaches, loads the extension, starts the idle watchdog |
| `src/capture.ts:136-143` | `loadExtension()`: `Extensions.loadUnpacked` returns the extension's id, kept as `this.extId` |
| `src/capture.ts:145-162` | `swSession()`: `Target.getTargets` with no filter (`:147`), picks the target of type `service_worker` whose URL contains `this.extId` (`:148`), `Target.attachToTarget` with `flatten: true` (`:150`), `Runtime.enable` (`:151`). A new session on every call; none is detached |
| `src/capture.ts:363`, `:366`, `:369`, `:392` | everything the app says to the extension is a `Runtime.evaluate` in the service worker: `self.mcStart(…)`, arming, `self.mcState`, `self.mcStop({})` |
| `src/cdp.ts:131-145` | `tabTargetId()`: the one place that asks for `filter: [{}]`, to see `tab` targets |

**The app never reaches the offscreen document.** It talks to the service
worker, and the service worker talks to the offscreen document by
`chrome.runtime.sendMessage` (`extension/background.js:44`, `:63`). No code in
`src/` names `offscreen.html`.

**The offscreen document is reachable as a target.** It is not a child of the
service worker's session; it is a target of its own in the browser's list:

- The recon listed it at every point from cycle 1 on as type
  `background_page`, URL `chrome-extension://<id>/offscreen.html`, and
  attached to it (`notebook/reports/recon-chrome-memory.md:882`). A `tab`
  target with the same URL exists too (`:885`), visible only with
  `filter: [{}]`.
- It exists only after the first tune: `ensureOffscreen` creates it on the
  first `mcStart` (`extension/background.js:17-27`, `:43`) and nothing closes
  it.

**Whether it accepts `HeapProfiler.collectGarbage` cannot be read from the
code.** Step 2 tested it: the unfiltered `Target.getTargets` — the call
`swSession()` already makes — listed it, exactly one target matched, and the
command answered `{}` in 8 ms:

```
Target.getTargets (no filter): 7 targets
  service_worker | 02F88600 | attached=false | https://tv.youtube.com/sw.js
  service_worker | 75363977 | attached=true | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js
  page | B954BD54 | attached=false | https://www.philo.com/player/guide
  browser_ui | 89CB3ADE | attached=false | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html
  browser_ui | C824A8F5 | attached=false | chrome://omnibox-popup.top-chrome/
  page | 0B2F136A | attached=true | https://tv.youtube.com/live
  background_page | DCA5AA2A | attached=false | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
offscreen candidates in the unfiltered list: 1
2026-09-29T00:54:38.926Z attached to background_page DCA5AA2A
2026-09-29T00:54:38.935Z HeapProfiler.collectGarbage -> {} in 8 ms
```

So `src/cdp.ts` needs no change: `send()` already carries any command to any
session.

---

## Step 2 — the cause, on the unchanged image

```
docker pull ghcr.io/marlin1111ai/marlin-cast:sha-c876a3a
  Digest: sha256:9e41035c7f7ccdefdfebe0b55e2fc536a60e0ca1cd84d61cf48ad9bca28fb26a   (the recon's digest)

backups/chrome-profile-2providers-20260913-0746.tgz   1,245,011,110 bytes
  sha256 before: 6ebd9ea976118bcb8c24e10b590680e5d44e405d1b3a9f7f09a0a3982258dbe3
tar -xzf … -C <scratchpad>/data      -> data/chrome-profile, 54,857 entries (find | wc -l), 1.7G (du -sh)

docker run -d --name marlin-cast-t031a --cap-add SYS_ADMIN --shm-size=1g \
  -p 8091:8804 -p 8092:6080 -v <scratchpad>/data:/data \
  --env-file <scratchpad>/run.env -e PUID=99 -e PGID=100 \
  ghcr.io/marlin1111ai/marlin-cast:sha-c876a3a
```

Started 00:47:04Z. **Both providers signed in**; first boot enumerated 375
(YouTube TV 141, Philo 234):

```
[entrypoint] stage 3 ready: Chrome/153.0.8010.36 on 127.0.0.1:9333 (loopback), tabs: tv.youtube.com, www.philo.com
[login] youtubetv: tv.youtube.com: signed in
[login] philo: www.philo.com: signed in (https://www.philo.com/player/mytv)
[entrypoint] stage 5: every provider signed in
[entrypoint] stage 6: no /data/channels.json — first boot, enumerating the lineup
[channels] enumerated 375 channels at 2026-09-29T00:47:25.397Z
[entrypoint] stage 7 ready: app on 0.0.0.0:8804 (pid 490); channels: 375 state: idle
```

Three cycles of the recon's pull
(`ffmpeg -t 60 -i <WBAL 11 URL> -c copy -f null -`, then the idle stop and
the park), one at a time. Each pull exited 0 with 59.98–59.99 s of media
(wall 67.5, 65.1, 64.6 s). Then the collection, then the point.

**The browser process (pid 30, no `--type`), kB:**

| point | UTC | docker stats | RSS | RssAnon | RssFile | RssShmem |
|---|---|---|---|---|---|---|
| s2-startup | 00:50:04 | 729.6MiB | 351004 | 89732 | 257420 | 3852 |
| s2-cycle-01 | 00:51:36 | 1.008GiB | 390716 | 119284 | 265448 | 5984 |
| s2-cycle-02 | 00:53:05 | 1.09GiB | 419828 | 148320 | 265600 | 5984 |
| s2-cycle-03 | 00:54:34 | 1.093GiB | 449496 | 177584 | 265672 | 6240 |
| s2-before-gc | 00:54:36 | 1.112GiB | 448924 | 177012 | 265672 | 6240 |
| *collection sent 00:54:38.9Z* | | | | | | |
| s2-after-gc-10s | 00:55:03 | 875.6MiB | 362520 | 92592 | 265672 | 4256 |

| | RSS | RssAnon |
|---|---|---|
| growth, startup → before the collection | +97,920 | +87,280 |
| change, before → after the collection | −86,404 | −84,420 |
| share of the growth released | 88% | 97% |

The 11,516 kB of RSS that did not come back is file-backed and shared memory
(RssFile +8,252, RssShmem +404 against startup), which the first tune adds
and no tune after it does; RssAnon ended 2,860 kB above startup.

**Passed:** the browser process dropped by most of its growth since startup,
so the code change went ahead.

**The point labelled "10 s" was taken 24 s after the collection,** not 10.
The script that sent the collection stayed alive for 15 s on its own
timeout timer before it exited (`gc script exit=0` at 00:54:53Z), and the 10 s
wait began after that. The drop is therefore shown at 24 s; how much of it
had happened at 10 s was not measured.

The per-tune steps match the recon's: +39,712, +29,112, +29,668 kB RSS here;
+38,048, +28,532, +29,700 there.

The container was stopped (1.29 s, exit 0, `shutdown complete`) and removed.
The profile copy, now owned by 99:100 and holding `channels.json`, was kept
for step 4.

---

## Step 3 — the change

`src/capture.ts` only. Line numbers are after the change.

| lines | what |
|---|---|
| `:32-38` | `GC_MS = 60000` and `GC_TIMEOUT_MS = 5000`. Plain constants, no env knob: the interval is the owner's call |
| `:71-72` | `Live.gc`, the timer |
| `:173-197` | `collectOffscreen(when)`: `Target.getTargets`; the target whose URL is exactly `chrome-extension://<extId>/offscreen.html`; `Target.attachToTarget` (flat); `HeapProfiler.collectGarbage`; `Target.detachFromTarget`. Raced against `GC_TIMEOUT_MS`. Any failure logs the warning and returns |
| `:386` | `gc: null` when the tune's state is created |
| `:409-414` | at the end of `start()`, once the recorder is confirmed running: `setInterval` every `GC_MS`; the tick does nothing unless this tune is still the live one and is not stopping |
| `:430` | `stop()` clears the timer first |
| `:437-440` | `stop()` collects once, after `self.mcStop({})` has returned and before ffmpeg is torn down |

**The warning line:**

```
[gc] WARNING: offscreen collection failed (<interval|stop>): <error>
```

It is written with `console.error`, so the container log shows it as
`[app] [gc] WARNING: …`. Nothing is logged when a collection succeeds.

**Choices made inside the brief's wording:**

- **The collection at stop is awaited**, so the stop waits for it — at most
  `GC_TIMEOUT_MS`. It sits after the recorder stop because the extension
  reports stopped only when every timeslice has been sent
  (`extension/offscreen.js:95`), so that collection takes the last of them.
- **The session is detached after each call.** `swSession()` leaves its
  sessions attached; this does not copy that, since it would add one session
  a minute.
- **A timeout was added** although the brief did not ask for one:
  `Cdp.send()` has none (`src/cdp.ts:46-52`), and without it a collection
  that never answered would hold `stop()` for ever.
- **Nothing in the tune path changed.** The timer is set after the
  `[capture] … recording` line; the only collection outside a capture is the
  one inside `stop()`.

The diff:

```diff
@@ -29,6 +29,13 @@ const TIMESLICE_MS = Number(process.env.MC_TIMESLICE ?? 1000);
 /** HLS is pull-based and gives no disconnect signal, so "client gone" is
  *  inferred from silence. See the report. */
 export const IDLE_MS = Number(process.env.MC_IDLE_MS ?? 20000);
+/** How often the extension's offscreen document is made to collect garbage
+ *  while a capture runs (task-031). Every timeslice is a Blob, and Chrome keeps
+ *  a Blob's bytes in the browser process until the document that cut it
+ *  collects it — which, left alone, it did once in twelve tunes. */
+const GC_MS = 60000;
+/** A collection that has not answered by then is reported, not waited for. */
+const GC_TIMEOUT_MS = 5000;
 
 export type Status = {
   state: "idle" | "starting" | "streaming" | "stopping";
@@ -61,6 +68,8 @@ type Live = {
   chunksIn: number;
   bytesIn: number;
   stopping: boolean;
+  /** The collection timer (task-031); set once the recorder is running. */
+  gc: ReturnType<typeof setInterval> | null;
 };
 
 /**
@@ -161,6 +170,32 @@ export class Pipeline {
     throw new Error("extension service worker never appeared");
   }
 
+  /** Force a garbage collection in the extension's offscreen document
+   *  (task-031). The document is a target of its own, not reached through the
+   *  service worker; the session is attached for the one call and detached
+   *  again. A failure is a loud named warning and never stops the capture. */
+  private async collectOffscreen(when: string): Promise<void> {
+    const collect = async () => {
+      const { targetInfos } = await this.cdp.send<any>("Target.getTargets");
+      const doc = targetInfos.find((t: any) => t.url === `chrome-extension://${this.extId}/offscreen.html`);
+      if (!doc) throw new Error("no offscreen document target");
+      const { sessionId } = await this.cdp.send<any>("Target.attachToTarget", { targetId: doc.targetId, flatten: true });
+      try {
+        await this.cdp.send("HeapProfiler.collectGarbage", {}, sessionId);
+      } finally {
+        await this.cdp.send("Target.detachFromTarget", { sessionId }).catch(() => {});
+      }
+    };
+    try {
+      await Promise.race([
+        collect(),
+        sleep(GC_TIMEOUT_MS).then(() => { throw new Error(`no answer within ${GC_TIMEOUT_MS}ms`); }),
+      ]);
+    } catch (e) {
+      console.error(`[gc] WARNING: offscreen collection failed (${when}): ${String(e)}`);
+    }
+  }
+
   status(): Status {
     const l = this.live;
     return {
@@ -348,7 +383,7 @@ export class Pipeline {
     this.live = {
       channel, provider, session, pageTargetId: tab.id, token, dir, ffmpeg,
       startedAt: Date.now(), lastAccess: Date.now(),
-      chunksIn: 0, bytesIn: 0, stopping: false,
+      chunksIn: 0, bytesIn: 0, stopping: false, gc: null,
     };
 
     // --- arm the extension and record ------------------------------------
@@ -370,6 +405,13 @@ export class Pipeline {
     }
     if (started.phase !== "recording") throw new Error(`capture did not start: ${started.error}`);
     console.log(`[capture] ${channel.name} recording ${JSON.stringify(started.note?.tracks?.video?.settings ?? {})}`);
+
+    const live = this.live;
+    if (live && live.token === token && !live.stopping) {
+      live.gc = setInterval(() => {
+        if (this.live === live && !live.stopping) void this.collectOffscreen("interval");
+      }, GC_MS);
+    }
   }
 
   ingest(key: string, token: string, buf: Buffer): boolean {
@@ -385,6 +427,7 @@ export class Pipeline {
     const l = this.live;
     if (!l || l.stopping) return;
     l.stopping = true;
+    if (l.gc) clearInterval(l.gc);
     console.log(`[stop] ${l.channel.name}: ${reason}`);
 
     try {
@@ -392,6 +435,10 @@ export class Pipeline {
       await evalIn(this.cdp, sw, `self.mcStop({})`);
     } catch (e) { console.error(`[stop] recorder stop failed: ${String(e)}`); }
 
+    // The extension reports stopped only once every timeslice is away, so
+    // this collection takes the last of them (task-031).
+    await this.collectOffscreen("stop");
+
     try { l.ffmpeg.stdin.end(); } catch { /* already closed */ }
     await new Promise<void>((res) => {
       const t = setTimeout(() => { try { l.ffmpeg.kill("SIGKILL"); } catch {} res(); }, 4000);
```

---

## Step 4 — the run on the changed image

```
docker build -t marlin-cast:task031 .        -> Successfully built 142f5570a16e (2.26GB), 2m48.6s

docker run -d --name marlin-cast-t031b --cap-add SYS_ADMIN --shm-size=1g \
  -p 8091:8804 -p 8092:6080 -v <scratchpad>/data:/data \
  --env-file <scratchpad>/run.env -e PUID=99 -e PGID=100 \
  marlin-cast:task031
```

The image was checked to carry the change (`grep` of `/app/src/capture.ts`
in it found `GC_MS`, `collectOffscreen` and the timer). Started 01:00:23Z.
**Both providers signed in**; the channel cache from step 2 was used, so
nothing was enumerated:

```
[entrypoint] removed stale profile locks: SingletonLock SingletonCookie SingletonSocket
[entrypoint] stage 3 ready: Chrome/153.0.8010.36 on 127.0.0.1:9333 (loopback), tabs: tv.youtube.com, www.philo.com
[login] youtubetv: tv.youtube.com: signed in
[login] philo: www.philo.com: signed in (https://www.philo.com/player/mytv)
[entrypoint] stage 5: every provider signed in
[entrypoint] stage 6: channel cache present (/data/channels.json)
[app] channels: 375 (enumerated 2026-09-29T00:47:25.397Z) {"youtubetv":141,"philo":234}
[entrypoint] stage 7 ready: app on 0.0.0.0:8804 (pid 415); channels: 375 state: idle
```

### Method, and where it differs from the recon's

Each point is `docker stats --no-stream`, then `ps` with
`/proc/<pid>/status` for every process (the recon's `ps.sh`, unchanged).
**No page was probed:** no CDP connection was made by the measurement in
step 4 at all. The only CDP traffic was the app's own.

**One difference from the recon's cycle.** The recon let ffmpeg make the cold
request. Here the cold request is a timed `curl` of the playlist, and the 60 s
pull starts as soon as it answers — this is how each cycle's cold tune time
was measured. The capture is the same length (tune, 60 s, 20 s idle); the
pull's wall time is 60 s instead of the recon's 64–67 s, which included the
tune. Point (a) was taken 3 minutes after the container started, as in the
recon.

### (b) 12 cycles — the browser process beside the recon's

Browser process pid 32 here, pid 30 in the recon. kB. "Δ" is against the
previous row; the recon's first Δ is against its point (b).

| cycle | UTC | docker stats | RSS | Δ RSS | RssAnon | Δ RssAnon | recon RSS | recon Δ RSS |
|---|---|---|---|---|---|---|---|---|
| startup | 01:03:23 | 609.2MiB | 345008 | – | 86724 | – | 348836 (a), 349276 (b) | – |
| 01 | 01:05:04 | 882.2MiB | 356556 | +11548 | 88536 | +1812 | 387324 | +38048 |
| 02 | 01:06:44 | 898MiB | 357340 | +784 | 89128 | +592 | 415856 | +28532 |
| 03 | 01:08:23 | 909.5MiB | 357844 | +504 | 89504 | +376 | 445556 | +29700 |
| 04 | 01:10:02 | 824.7MiB | 359256 | +1412 | 90916 | +1412 | 472900 | +27344 |
| 05 | 01:11:41 | 922.8MiB | 359308 | +52 | 90960 | +44 | 502432 | +29532 |
| 06 | 01:13:23 | 831.3MiB | 358648 | -660 | 90300 | -660 | 530028 | +27596 |
| 07 | 01:15:03 | 968.5MiB | 358632 | -16 | 90284 | -16 | 386856 | -143172 |
| 08 | 01:16:42 | 968.1MiB | 358628 | -4 | 90280 | -4 | 412912 | +26056 |
| 09 | 01:18:20 | 943.7MiB | 358792 | +164 | 90440 | +160 | 441676 | +28764 |
| 10 | 01:19:59 | 941.2MiB | 358744 | -48 | 90392 | -48 | 469712 | +28036 |
| 11 | 01:21:38 | 947.8MiB | 358832 | +88 | 90476 | +84 | 497136 | +27424 |
| 12 | 01:23:18 | 963.8MiB | 360084 | +1252 | 91728 | +1252 | 527096 | +29960 |

- **No step per tune.** Cycles 2–12: −660 to +1,412 kB. The recon's:
  +26,056 to +29,960, and one release of 143,172.
- The first tune adds 11,548 kB, of which 9,332 is RssFile (254,272 →
  263,604) and 1,812 RssAnon. The recon's first tune shows the same
  file-backed step (256,428 → 264,576).
- From cycle 1 to cycle 12 the process rose 3,528 kB (RssAnon 3,192). After
  two more tunes — the 10-minute pull and the 30 s pull — it read 359,688 kB
  (RssAnon 90,948), below cycle 12.
- `docker stats` ran 824.7–968.5 MiB over the 12 cycles; the recon's ran
  903.2 MiB–1.154 GiB.

### (c) the 10-minute pull, once a minute

Cold request 01:23:20Z, pull 01:23:24Z–01:33:24Z. kB. The last column is the
three parts added up, shown because one row does not add up to its RSS.

| point | UTC | docker stats | RSS | RssAnon | RssFile | RssShmem | Anon+File+Shmem |
|---|---|---|---|---|---|---|---|
| b-cycle-12 (parked, before) | 01:23:18 | 963.8MiB | 360084 | 91728 | 263940 | 4416 | 360084 |
| c-minute-01 | 01:24:21 | 1.158GiB | 365852 | 97360 | 263940 | 4552 | 365852 |
| c-minute-02 | 01:25:21 | 1.159GiB | 380556 | 97284 | 263940 | 4416 | 365640 |
| c-minute-03 | 01:26:21 | 1.177GiB | 365016 | 96660 | 263940 | 4416 | 365016 |
| c-minute-04 | 01:27:21 | 1.2GiB | 376788 | 108432 | 263940 | 4416 | 376788 |
| c-minute-05 | 01:28:21 | 1.218GiB | 364372 | 96016 | 263940 | 4416 | 364372 |
| c-minute-06 | 01:29:21 | 1.225GiB | 380296 | 111944 | 263940 | 4412 | 380296 |
| c-minute-07 | 01:30:21 | 1.224GiB | 365676 | 97324 | 263940 | 4412 | 365676 |
| c-minute-08 | 01:31:21 | 1.261GiB | 379508 | 111156 | 263940 | 4412 | 379508 |
| c-minute-09 | 01:32:21 | 1.23GiB | 364872 | 96520 | 263940 | 4412 | 364872 |
| c-minute-10 | 01:33:21 | 1.235GiB | 373076 | 110920 | 257744 | 4412 | 373076 |
| c-after-stop (parked) | 01:33:56 | 967.3MiB | 356808 | 90756 | 261636 | 4416 | 356808 |
| d-after-30s-pull (parked) | 01:35:05 | 870MiB | 359688 | 90948 | 264324 | 4416 | 359688 |

- **No steady climb.** RSS stayed between 364,372 and 380,556 kB for ten
  minutes; minute 1 read 365,852 and minute 9 read 364,872. Unchanged, ten
  minutes of recording at the measured 27–30 MB a minute would have added
  about 280,000 kB.
- **Two levels, not a slope.** RssAnon read 96,016–97,360 at minutes 1, 2, 3,
  5, 7 and 9, and 108,432–111,944 at minutes 4, 6, 8 and 10. After the stop
  it read 90,756, the parked level.
- **Minute 2's RSS does not equal its parts** (380,556 against 365,640).
  `ps` reads RSS an instant before the script reads `/proc/<pid>/status`, so
  14,916 kB left the process between the two reads.
- **Reading, not measured:** the points and the collections both run on a
  60 s beat that starts within a couple of seconds of each other, so every point
  lands close to a collection — some just before the memory is handed back,
  some just after, and minute 2 in the middle of it. Successful collections
  are not logged, so their times are not known and this cannot be checked
  from the log.
- **The container rose during the pull**, 1.158 → 1.235 GiB, highest
  1.261 GiB, and returned to 967.3 MiB at the stop. It was not the browser
  process. Between minute 1 and minute 10 the renderer with
  `renderer-client-id=8` (pid 202; the recon mapped that id to the YouTube TV
  tab, this run mapped nothing) went 474,108 → 541,548 kB, inside the band
  the recon recorded for it (506,428–649,196 parked); ffmpeg inside the container 201,008 → 206,120;
  the extension's renderer 228,752 → 229,612; the app 115,292 → 116,116.
  `docker stats` also counts page cache.

### Pulls, cold tune times, the stream

| tune | cold request → playlist (s) | HTTP | `tune-ms` nav / layout / playing / pinned | pull exit | pull wall (s) | media | segments opened | speed |
|---|---|---|---|---|---|---|---|---|
| cycle 01 | 6.711800 | 200 | 429 / 437 / 1706 / 1711 | 0 | 60.5 | 00:00:59.98 | 61 | 0.992x |
| cycle 02 | 4.617979 | 200 | 631 / 650 / 2166 / 2170 | 0 | 60.5 | 00:00:59.98 | 61 | 0.993x |
| cycle 03 | 4.586190 | 200 | 589 / 603 / 2139 / 2144 | 0 | 59.9 | 00:00:59.98 | 61 | 1x |
| cycle 04 | 4.516250 | 200 | 898 / 931 / 2060 / 2061 | 0 | 60.5 | 00:00:59.98 | 61 | 0.993x |
| cycle 05 | 4.104962 | 200 | 599 / 616 / 1649 / 1654 | 0 | 60.5 | 00:00:59.98 | 61 | 0.993x |
| cycle 06 | 7.386768 | 200 | 596 / 621 / 4930 / 4933 | 0 | 60.5 | 00:00:59.98 | 61 | 0.993x |
| cycle 07 | 4.416699 | 200 | 617 / 633 / 1965 / 1969 | 0 | 60.5 | 00:00:59.98 | 61 | 0.993x |
| cycle 08 | 4.308564 | 200 | 578 / 597 / 1869 / 1870 | 0 | 60.5 | 00:00:59.98 | 61 | 0.993x |
| cycle 09 | 4.085288 | 200 | 589 / 600 / 1640 / 1641 | 0 | 60.0 | 00:00:59.98 | 61 | 1x |
| cycle 10 | 4.198968 | 200 | 581 / 618 / 1754 / 1760 | 0 | 60.5 | 00:00:59.98 | 61 | 0.993x |
| cycle 11 | 4.400711 | 200 | 602 / 613 / 1951 / 1952 | 0 | 60.5 | 00:00:59.98 | 61 | 0.993x |
| cycle 12 | 4.362393 | 200 | 590 / 636 / 1913 / 1918 | 0 | 60.5 | 00:00:59.98 | 61 | 0.993x |
| 10-minute pull | 4.330135 | 200 | 585 / 597 / 1884 / 1888 | 0 | 599.7 | 00:09:59.98 | 608 | 1x |
| 30 s pull | 4.353913 | 200 | 578 / 627 / 1896 / 1901 | 0 | 30.2 | 00:00:29.99 | 31 | 0.993x |

Media copied, from each pull's log: cycles 1–12 video 43,252–44,679 kB and
audio 948–972 kB; the 10-minute pull video 437,803 kB, audio 9,509 kB; the
30 s pull video 22,351 kB, audio 476 kB. No pull log holds an error-like
line other than ffmpeg's "duplicated MOOV" notices (KNOWN-FIXES). Every tune
logged `target hd1080, quality hd1080, video 1920x1080, box 1920x1080,
viewport 1920x1080` and a 1920×1080 30 fps capture.

**Cold tune times.** 12 of 14 were 4.09–4.62 s. Two were not:

- **Cycle 1, 6.71 s** — the container's first tune. Its tune path was normal
  (`pinned=1711`), so the extra time came after it, while the extension was
  started for the first time. The unchanged image shows the same: the first
  pull took 67.5 s against 65.1 and 64.6 in step 2, and 67.2 s against
  64.0–65.1 in the recon (`recon-chrome-memory.md:384-395`).
- **Cycle 6, 7.39 s** — the player took 4,930 ms to start playing, against
  1,640–2,166 for the others. The unchanged image did the same once in the
  recon: `playing` 4,219 ms at its cycle 5 (`recon-chrome-memory.md:400`).

Neither can come from the change: no collection runs between the request and
the recorder starting, and the collection at the previous stop had finished
more than 30 s earlier.

**The 30 s pull, ffprobe** (`ffmpeg -t 30 -i <URL> -c copy pull-30s.mp4`,
23,402,182 bytes):

```
$ ffprobe -v error -show_entries stream=index,codec_type,codec_name,profile,width,height,r_frame_rate,sample_rate,channels,duration -show_entries format=format_name,duration,size -of default=noprint_wrappers=1 pull-30s.mp4
index=0
codec_name=h264
profile=High
codec_type=video
width=1920
height=1080
r_frame_rate=30/1
duration=30.000000
index=1
codec_name=aac
profile=LC
codec_type=audio
sample_rate=48000
channels=2
r_frame_rate=0/0
duration=30.016000
format_name=mov,mp4,m4a,3gp,3g2,mj2
duration=30.021029
size=23402182
```

H.264 High 1920×1080 at 30 fps, and AAC-LC 48 kHz stereo.

**The app log, counted with `grep -c` over the whole container log:**

```
\[stop\] WBAL 11: idle : 14
\[stop\] parked : 14
\[ffmpeg\] exited code=255 : 14
File ended prematurely : 11
\[gc\] WARNING : 0
\[gc\] : 0
recorder stop failed : 0
\[serve\] : 0
```

14 tunes (14 `[tune-ms]` lines), 14 idle stops, 14 parks. **The warning line
was logged 0 times.** ffmpeg's exit 255 at the idle stop is the known one
(D030 note).

---

## The pass criteria

| criterion | result | evidence |
|---|---|---|
| the browser process no longer steps up about 27–30 MB per tune | **holds** | cycles 2–12: −660 to +1,412 kB per tune |
| it does not climb steadily across the 10-minute pull | **holds** | 364,372–380,556 kB, two levels, minute 9 below minute 1 |
| every pull exits 0 with about as much media as wall time | **holds** | 14 of 14 exit 0; 59.98 s in 59.9–60.5 s; 599.98 s in 599.7 s; 29.99 s in 30.2 s |
| cold tune times in line with the ~4 s baseline | **holds, on a judgement** | 12 of 14 at 4.09–4.62 s; 6.71 s and 7.39 s explained above and seen on the unchanged image |

The fourth is the builder's judgement, not a bare reading: two tunes were
well over 4 s. They were passed because the unchanged image shows both
patterns and the change has nothing in the tune path. The baseline itself
(3.85–4.36 s, `notebook/reports/task-011-tune-latency.md:100-109`) was
measured on the dev server with MPEG-TS output, not in the container.

---

## Clean-up

`<scratchpad>` is
`/tmp/claude-1000/-Apps-marlin-cast/48682dfb-ac6c-4452-bca2-0434df9b4712/scratchpad`.

```
$ time docker stop marlin-cast-t031b
marlin-cast-t031b
real	0m1.360s
$ docker logs --tail 9 marlin-cast-t031b
[entrypoint] shutting down (exit 0)
[app] 
[app] SIGTERM — shutting down
[entrypoint] app stopped
[entrypoint] chrome stopped
[entrypoint] novnc stopped
[entrypoint] x11vnc stopped
[entrypoint] xvfb stopped
[entrypoint] shutdown complete: no chrome/Xvfb/ffmpeg/x11vnc/websockify/node left
$ docker rm marlin-cast-t031b
marlin-cast-t031b
$ docker ps -a
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
host processes: chrome 0 Xvfb 0 x11vnc 0 websockify 2 ffmpeg 0
$ ss -tln | grep -E ":(8091|8092|8804|9333)\b"
(exit 1)
$ docker run --rm --entrypoint sh -v <scratchpad>/data:/target marlin-cast:task031 -c ...
inside: uid=0(root) gid=0(root) groups=0(root)
entries under /target before: 56814
1.8G
find -delete exit 0
entries under /target after: 0
$ rmdir <scratchpad>/data
(exit 0)
$ docker rmi marlin-cast:task031
Untagged: marlin-cast:task031
Deleted: sha256:142f5570a16e8e5f9d33b94462833016ddceb0cd54e862d3e397c03f3282cd96
$ docker rmi ghcr.io/marlin1111ai/marlin-cast:sha-c876a3a
Untagged: ghcr.io/marlin1111ai/marlin-cast:sha-c876a3a
Deleted: sha256:9e41035c7f7ccdefdfebe0b55e2fc536a60e0ca1cd84d61cf48ad9bca28fb26a
$ docker images
WARNING: This output is designed for human readability. For machine-readable output, please use --format.
IMAGE                                      ID             DISK USAGE   CONTENT SIZE   EXTRA
alpine:3.21                                48b0309ca019       12.2MB         3.73MB        
ghcr.io/marlin1111ai/marlin-media:0.4.0    1e69391c5c7c        211MB         57.5MB        
ghcr.io/marlin1111ai/marlin-media:latest   1e69391c5c7c        211MB         57.5MB        
golang:1.27                                512690a56605       1.31GB          327MB        
golang:1.27-alpine                         cf6fca664188        381MB         75.4MB        
ubuntu:24.04                               33ceb71981b6        119MB         31.7MB        
$ docker ps -a
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
$ sha256sum backups/chrome-profile-2providers-20260913-0746.tgz
6ebd9ea976118bcb8c24e10b590680e5d44e405d1b3a9f7f09a0a3982258dbe3  backups/chrome-profile-2providers-20260913-0746.tgz
1245011110 bytes, mtime 2026-09-13 07:47:01.430643094 -0400
```

**"websockify 2" is the check counting itself,** not a leftover: `pgrep -f`
matched the shell running the check, whose command line holds the word. The
check was run again another way:

```
$ ps -eo pid,comm,args | grep -i -E '[w]ebsockify|[x]11vnc|[X]vfb|[c]hrome' | grep -v -E 'grep|bash -c'
(exit 1 — 1 means none)
$ docker images -f dangling=true -q | wc -l
0
$ docker volume ls
DRIVER    VOLUME NAME
$ docker system df
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          5         0         1.951GB   -6.619e+07B (-3%)
Containers      0         0         0B        0B
Local Volumes   0         0         0B        0B
Build Cache     0         0         0B        0B
```

- **Containers:** `marlin-cast-t031a` (step 2) and `marlin-cast-t031b` (step
  4) stopped and removed; none left.
- **Profile copy:** deleted through a throwaway root container of the local
  image (`--rm`), then the empty directory removed.
- **Images:** the local `marlin-cast:task031` and the pulled
  `ghcr.io/marlin1111ai/marlin-cast:sha-c876a3a` removed. No Marlin Cast
  image, dangling image, volume or build cache is left. The six images
  listed were there before this pass.
- **Backup:** sha256 identical before extraction and after the clean-up,
  and equal to the brief's.
- **Scratch files:** the raw logs, the 17 pull logs, the 30 s recording, the
  five scripts, three small files of script output and state, and `run.env`
  (the throwaway password) were deleted after the appendices below were
  compared with the raw logs. The listing after
  deletion is at the end of this section.
- **Left on marlinpc:** the builder's own background-task output files, in
  the harness's `tasks/` directory beside the scratchpad
  (`/tmp/claude-1000/-Apps-marlin-cast/8b3f200b-47ba-44fe-a971-87df9ab3a1c5/tasks/`):
  four from this pass (`bv5oolehg.output`, `bbe9gbe81.output`,
  `bka9xpsc3.output`, `bv7u38hb2.output`) beside the recon's three. They are
  the harness's files, outside the scratchpad, and were not deleted. They
  hold run-log lines that are also in the appendices, and no password
  (searched).

```
$ ls -la <scratchpad>
total 8
drwx------ 2 marlinai marlinai 4096 Sep 28 21:41 .
drwx------ 3 marlinai marlinai 4096 Sep 28 20:19 ..
entries in scratchpad: 0
```

---

## Open questions — the owner's call

1. **`VERSION` was not bumped.** It stays 0.1.2; the brief's step 3 said "no
   other change". The pushed commit publishes `latest` and `sha-<short>`
   (D025); both carry 0.1.2, as `sha-c876a3a` does.
2. **The owner's call has no decision number.** The brief did not ask for a
   DECISIONS.md entry and none was written. The code comments cite task-031.
3. **"Where things stand" is now out of date.** The top of
   `SESSION-STATE.md` and `MARLIN-CAST-BRIEF.md:11` both say GHCR `latest` =
   `sha-c876a3a`. After this push `latest` is the new commit. Neither was
   edited (not in the steps).
4. **Unraid and the QNAP are untouched.** Unraid runs `latest` as pulled on
   2026-09-13 and gets this change only when the owner updates the container;
   the QNAP is pinned to `sha-c876a3a` and does not get it until re-pinned.
5. **Whether a successful collection should be logged.** Today only a failure
   is. A line per collection would make the log show that they run.

## Least sure of

1. **The warning path.** It never fired, so the line, the 5 s timeout and
   "does not stop the capture" were read, not seen. No failure was induced;
   that was outside the steps.
2. **That the collections run on time.** No log line marks one. That they
   run is inferred from the memory figures — strongly, but it is inference.
3. **The two levels in the 10-minute series.** The explanation given is a
   reading. A slow rise hidden under the two levels cannot be ruled out in
   ten points; the even minutes read 108,432, 111,944, 111,156, 110,920.
4. **A small residual slope.** Cycles 1–12 rose 3,528 kB in all. The two
   tunes after them ended lower, but 14 tunes cannot tell a slope of a few
   hundred kB a tune from noise.
5. **Hours, not minutes.** The longest capture here was about 10 minutes
   20 seconds. An evening-long tune was not run.
6. **The cold tune judgement** (above): passed on the argument that the
   unchanged image does the same, from 3 + 12 tunes of comparison.
7. **Philo.** WBAL 11 only, by the brief. The change is provider-blind, but
   no Philo capture was run with it.
8. **That marlinpc predicts Unraid and the QNAP**, as in the recon.

---
## Appendix A — step 2, raw output of every measurement point

The file the measurement script wrote, unedited: 6 points, image `sha-c876a3a`, container `marlin-cast-t031a`.

````
===== POINT s2-startup =====
utc: 2026-09-29T00:50:04Z
health: state: idle quality: - channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031a 729.6MiB / 62.62GiB 1.14% 36.50% 301
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1392      92        1300      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4240      920       3320      0         bash             -              bash /entrypoint.sh 
26     7      40716     11980     7908      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      351004    89732     257420    3852      chrome           (no --type)    -
40     30     1864      116       1748      0         cat              -              cat 
41     30     1868      120       1748      0         cat              -              cat 
43     1      3848      344       3504      0         chrome_crashpad  (no --type)    -
45     1      3580      320       3260      0         chrome_crashpad  (no --type)    -
51     30     68908     15308     53600     0         chrome           zygote         -
52     30     70160     15220     54940     0         chrome           zygote         -
54     52     20060     15316     4744      0         chrome           zygote         -
73     51     202820    40208     133120    29496     chrome           gpu-process    -
74     30     141152    25416     115012    724       chrome           utility         sub=network.mojom.NetworkService
77     54     58536     16340     41916     280       chrome           utility         sub=storage.mojom.StorageService
172    54     144928    33836     110596    496       chrome           renderer        renderer-client-id=5
181    54     224828    96676     127048    1104      chrome           renderer        renderer-client-id=7
199    54     458316    282536    154880    20032     chrome           renderer        renderer-client-id=8
255    7      19016     10084     8932      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
276    7      37976     21460     16516     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
280    54     81828     21020     60536     272       chrome           renderer        renderer-client-id=9
359    30     86720     16044     70556     124       chrome           utility         sub=audio.mojom.AudioService
490    7      86592     30604     55988     0         node             -              node --import tsx src/server.ts 
491    7      2200      152       2048      0         sed              -              sed -u s/^/[app] / 
500    490    15188     5804      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
1926   7      2020      112       1908      0         sleep            -              sleep 2 
1927   0      3576      284       3292      0         bash             -              bash -s 
1934   1927   1960      336       2112      0         bash             -              bash -s 
===== END s2-startup =====

===== POINT s2-cycle-01 =====
utc: 2026-09-29T00:51:36Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031a 1.008GiB / 62.62GiB 1.61% 87.86% 335
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1392      92        1300      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4240      920       3320      0         bash             -              bash /entrypoint.sh 
26     7      40716     11980     7908      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      390716    119284    265448    5984      chrome           (no --type)    -
40     30     1864      116       1748      0         cat              -              cat 
41     30     1868      120       1748      0         cat              -              cat 
43     1      3848      344       3504      0         chrome_crashpad  (no --type)    -
45     1      3580      320       3260      0         chrome_crashpad  (no --type)    -
51     30     68908     15308     53600     0         chrome           zygote         -
52     30     70160     15220     54940     0         chrome           zygote         -
54     52     20060     15316     4744      0         chrome           zygote         -
73     51     215932    40288     134572    38488     chrome           gpu-process    -
74     30     141400    25232     115336    832       chrome           utility         sub=network.mojom.NetworkService
77     54     58612     16352     41980     280       chrome           utility         sub=storage.mojom.StorageService
172    54     145716    34624     110596    496       chrome           renderer        renderer-client-id=5
181    54     199276    71040     127128    1108      chrome           renderer        renderer-client-id=7
199    54     613940    423104    158520    32628     chrome           renderer        renderer-client-id=8
255    7      19016     10084     8932      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
276    7      37976     21460     16516     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
359    30     93440     16468     76768     204       chrome           utility         sub=audio.mojom.AudioService
490    7      102020    45844     56180     0         node             -              node --import tsx src/server.ts 
491    7      2204      156       2048      0         sed              -              sed -u s/^/[app] / 
500    490    14608     5224      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2450   51     104584    42904     61560     120       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2451   2450   20672     15628     5044      0         chrome           broker         -
2458   54     137336    75184     61948     204       chrome           utility         sub=media.mojom.CdmServiceBroker
2488   54     142252    31332     110124    796       chrome           renderer        renderer-client-id=45 extension-process
2514   54     81620     20988     60376     256       chrome           renderer        renderer-client-id=46
3277   30     88228     15828     72220     180       chrome           utility         sub=video_capture.mojom.VideoCaptureService
3306   0      3584      280       3304      0         bash             -              bash -s 
3313   3306   1936      332       2080      0         bash             -              bash -s 
===== END s2-cycle-01 =====

===== POINT s2-cycle-02 =====
utc: 2026-09-29T00:53:05Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031a 1.09GiB / 62.62GiB 1.74% 78.76% 337
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1392      92        1300      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4240      920       3320      0         bash             -              bash /entrypoint.sh 
26     7      40716     11980     7908      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      419828    148320    265600    5984      chrome           (no --type)    -
40     30     1864      116       1748      0         cat              -              cat 
41     30     1868      120       1748      0         cat              -              cat 
43     1      3848      344       3504      0         chrome_crashpad  (no --type)    -
45     1      3580      320       3260      0         chrome_crashpad  (no --type)    -
51     30     68908     15308     53600     0         chrome           zygote         -
52     30     70160     15220     54940     0         chrome           zygote         -
54     52     20060     15316     4744      0         chrome           zygote         -
73     51     215148    44268     134572    36308     chrome           gpu-process    -
74     30     142008    25796     115416    832       chrome           utility         sub=network.mojom.NetworkService
77     54     58624     16396     41980     280       chrome           utility         sub=storage.mojom.StorageService
172    54     146260    35168     110596    496       chrome           renderer        renderer-client-id=5
181    54     212152    83892     127128    1132      chrome           renderer        renderer-client-id=7
199    54     649152    461220    158652    29692     chrome           renderer        renderer-client-id=8
255    7      19016     10084     8932      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
276    7      37976     21460     16516     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
359    30     93352     16344     76768     240       chrome           utility         sub=audio.mojom.AudioService
490    7      105724    49356     56372     0         node             -              node --import tsx src/server.ts 
491    7      2204      156       2048      0         sed              -              sed -u s/^/[app] / 
500    490    14628     5244      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2450   51     105364    42884     61560     120       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2451   2450   20672     15628     5044      0         chrome           broker         -
2458   54     137704    75328     61948     208       chrome           utility         sub=media.mojom.CdmServiceBroker
2488   54     143928    32956     110172    800       chrome           renderer        renderer-client-id=45 extension-process
2514   54     81812     20988     60568     256       chrome           renderer        renderer-client-id=46
4709   30     84608     15824     68596     188       chrome           utility         sub=video_capture.mojom.VideoCaptureService
4740   0      3792      280       3512      0         bash             -              bash -s 
4747   4740   1972      336       2168      0         bash             -              bash -s 
===== END s2-cycle-02 =====

===== POINT s2-cycle-03 =====
utc: 2026-09-29T00:54:34Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031a 1.093GiB / 62.62GiB 1.75% 187.28% 330
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1392      92        1300      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4240      920       3320      0         bash             -              bash /entrypoint.sh 
26     7      40716     11980     7908      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      449496    177584    265672    6240      chrome           (no --type)    -
40     30     1864      116       1748      0         cat              -              cat 
41     30     1868      120       1748      0         cat              -              cat 
43     1      3848      344       3504      0         chrome_crashpad  (no --type)    -
45     1      3580      320       3260      0         chrome_crashpad  (no --type)    -
51     30     68908     15308     53600     0         chrome           zygote         -
52     30     70160     15220     54940     0         chrome           zygote         -
54     52     20060     15316     4744      0         chrome           zygote         -
73     51     198412    40544     134684    27700     chrome           gpu-process    -
74     30     142396    25912     115560    836       chrome           utility         sub=network.mojom.NetworkService
77     54     58632     16372     41980     280       chrome           utility         sub=storage.mojom.StorageService
172    54     146872    35780     110596    496       chrome           renderer        renderer-client-id=5
181    54     201524    73264     127128    1132      chrome           renderer        renderer-client-id=7
199    54     627028    445964    158716    18168     chrome           renderer        renderer-client-id=8
255    7      19016     10084     8932      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
276    7      37976     21460     16516     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
359    30     93476     16464     76768     244       chrome           utility         sub=audio.mojom.AudioService
490    7      111728    55356     56372     0         node             -              node --import tsx src/server.ts 
491    7      2204      156       2048      0         sed              -              sed -u s/^/[app] / 
500    490    14656     5272      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2450   51     104572    42892     61560     120       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2451   2450   20672     15628     5044      0         chrome           broker         -
2458   54     137800    75644     61948     208       chrome           utility         sub=media.mojom.CdmServiceBroker
2488   54     147960    35440     110636    800       chrome           renderer        renderer-client-id=45 extension-process
2514   54     81812     20988     60568     256       chrome           renderer        renderer-client-id=46
6158   7      2016      108       1908      0         sleep            -              sleep 2 
6159   30     87112     15828     71096     188       chrome           utility         sub=video_capture.mojom.VideoCaptureService
6165   0      3528      280       3248      0         bash             -              bash -s 
6172   6165   2008      336       2136      0         bash             -              bash -s 
===== END s2-cycle-03 =====

===== POINT s2-before-gc =====
utc: 2026-09-29T00:54:36Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031a 1.112GiB / 62.62GiB 1.78% 55.96% 337
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1392      92        1300      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4240      920       3320      0         bash             -              bash /entrypoint.sh 
26     7      40716     11980     7908      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      448924    177012    265672    6240      chrome           (no --type)    -
40     30     1864      116       1748      0         cat              -              cat 
41     30     1868      120       1748      0         cat              -              cat 
43     1      3848      344       3504      0         chrome_crashpad  (no --type)    -
45     1      3580      320       3260      0         chrome_crashpad  (no --type)    -
51     30     68908     15308     53600     0         chrome           zygote         -
52     30     70160     15220     54940     0         chrome           zygote         -
54     52     20060     15316     4744      0         chrome           zygote         -
73     51     213624    40660     134684    38288     chrome           gpu-process    -
74     30     141876    25720     115560    836       chrome           utility         sub=network.mojom.NetworkService
77     54     58704     16444     41980     280       chrome           utility         sub=storage.mojom.StorageService
172    54     146872    35780     110596    496       chrome           renderer        renderer-client-id=5
181    54     201524    73264     127128    1132      chrome           renderer        renderer-client-id=7
199    54     648488    455940    158716    32164     chrome           renderer        renderer-client-id=8
255    7      19016     10084     8932      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
276    7      37976     21460     16516     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
359    30     93476     16352     76768     244       chrome           utility         sub=audio.mojom.AudioService
490    7      111728    55356     56372     0         node             -              node --import tsx src/server.ts 
491    7      2204      156       2048      0         sed              -              sed -u s/^/[app] / 
500    490    14656     5272      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2450   51     104572    42892     61560     120       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2451   2450   20672     15628     5044      0         chrome           broker         -
2458   54     137800    75644     61948     208       chrome           utility         sub=media.mojom.CdmServiceBroker
2488   54     146876    35440     110636    800       chrome           renderer        renderer-client-id=45 extension-process
2514   54     81812     20988     60568     256       chrome           renderer        renderer-client-id=46
6159   30     87112     15828     71096     188       chrome           utility         sub=video_capture.mojom.VideoCaptureService
6814   0      3588      280       3308      0         bash             -              bash -s 
6821   6814   2036      336       2196      0         bash             -              bash -s 
===== END s2-before-gc =====

===== POINT s2-after-gc-10s =====
utc: 2026-09-29T00:55:03Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031a 875.6MiB / 62.62GiB 1.37% 30.24% 337
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1392      92        1300      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4240      920       3320      0         bash             -              bash /entrypoint.sh 
26     7      40716     11980     7908      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      362520    92592     265672    4256      chrome           (no --type)    -
40     30     1864      116       1748      0         cat              -              cat 
41     30     1868      120       1748      0         cat              -              cat 
43     1      3848      344       3504      0         chrome_crashpad  (no --type)    -
45     1      3580      320       3260      0         chrome_crashpad  (no --type)    -
51     30     68908     15308     53600     0         chrome           zygote         -
52     30     70160     15220     54940     0         chrome           zygote         -
54     52     20060     15316     4744      0         chrome           zygote         -
73     51     204548    40504     134684    29364     chrome           gpu-process    -
74     30     141676    25276     115560    840       chrome           utility         sub=network.mojom.NetworkService
77     54     58640     16380     41980     280       chrome           utility         sub=storage.mojom.StorageService
172    54     146872    35780     110596    496       chrome           renderer        renderer-client-id=5
181    54     212940    84680     127128    1132      chrome           renderer        renderer-client-id=7
199    54     537908    358364    158716    21168     chrome           renderer        renderer-client-id=8
255    7      19016     10084     8932      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
276    7      37976     21460     16516     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
359    30     93340     16328     76768     244       chrome           utility         sub=audio.mojom.AudioService
490    7      111728    55356     56372     0         node             -              node --import tsx src/server.ts 
491    7      2204      156       2048      0         sed              -              sed -u s/^/[app] / 
500    490    14664     5280      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2450   51     104556    42876     61560     120       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2451   2450   20672     15628     5044      0         chrome           broker         -
2488   54     147688    31684     115172    832       chrome           renderer        renderer-client-id=45 extension-process
2514   54     81812     20988     60568     256       chrome           renderer        renderer-client-id=46
7667   0      3484      280       3204      0         bash             -              bash -s 
7675   7667   2060      336       2140      0         bash             -              bash -s 
===== END s2-after-gc-10s =====

````

## Appendix B — step 2, the run log

The cycle script's own log, unedited, with the output of the script that sent the collection.

````
2026-09-29T00:50:06Z startup measured
2026-09-29T00:50:06Z cycle 01: tune + pull start
2026-09-29T00:51:13Z cycle 01: pull exit=0 wall=67.5s | size=N/A time=00:00:59.99 bitrate=N/A speed=0.992x     | 
2026-09-29T00:51:36Z cycle 01: idle stop + park seen 22.3 s after the pull ended
--- cycle 01 app log (docker logs --since 2026-09-29T00:50:06Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 0B2F136A160185CFC1A20AEE3473D9DD (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=859 layout=863 playing=1879 pinned=1887
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:21?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x634849fb1440] File ended prematurely at pos. 27651995 (0x1a5ef9b)
[app] [matroska,webm @ 0x634849fb1440] Seek to desired resync point failed. Seeking to earliest point available instead.
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T00:51:38Z cycle 01: measured
2026-09-29T00:51:38Z cycle 02: tune + pull start
2026-09-29T00:52:43Z cycle 02: pull exit=0 wall=65.1s | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x     | 
2026-09-29T00:53:05Z cycle 02: idle stop + park seen 22.3 s after the pull ended
--- cycle 02 app log (docker logs --since 2026-09-29T00:51:38Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 0B2F136A160185CFC1A20AEE3473D9DD (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=564 layout=572 playing=2100 pinned=2105
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:32?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x5f4c71c31440] File ended prematurely at pos. 27992714 (0x1ab228a)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T00:53:07Z cycle 02: measured
2026-09-29T00:53:07Z cycle 03: tune + pull start
2026-09-29T00:54:12Z cycle 03: pull exit=0 wall=64.6s | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x     | 
2026-09-29T00:54:34Z cycle 03: idle stop + park seen 22.2 s after the pull ended
--- cycle 03 app log (docker logs --since 2026-09-29T00:53:07Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 0B2F136A160185CFC1A20AEE3473D9DD (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=583 layout=594 playing=1674 pinned=1679
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:42?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T00:54:36Z cycle 03: measured
2026-09-29T00:54:38Z before-gc measured
2026-09-29T00:54:38Z sending HeapProfiler.collectGarbage to the offscreen document
Target.getTargets (no filter): 7 targets
  service_worker | 02F88600 | attached=false | https://tv.youtube.com/sw.js
  service_worker | 75363977 | attached=true | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js
  page | B954BD54 | attached=false | https://www.philo.com/player/guide
  browser_ui | 89CB3ADE | attached=false | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html
  browser_ui | C824A8F5 | attached=false | chrome://omnibox-popup.top-chrome/
  page | 0B2F136A | attached=true | https://tv.youtube.com/live
  background_page | DCA5AA2A | attached=false | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
offscreen candidates in the unfiltered list: 1
2026-09-29T00:54:38.926Z attached to background_page DCA5AA2A
2026-09-29T00:54:38.935Z HeapProfiler.collectGarbage -> {} in 8 ms
2026-09-29T00:54:53Z gc script exit=0
2026-09-29T00:55:06Z after-gc measured
2026-09-29T00:55:06Z STEP 2 RUN DONE
````

## Appendix C — step 4, raw output of every measurement point

The file the measurement script wrote, unedited: 25 points, image built from the working tree, container `marlin-cast-t031b`.

````
===== POINT a-startup =====
utc: 2026-09-29T01:03:23Z
health: state: idle quality: - channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 609.2MiB / 62.62GiB 0.95% 44.63% 316
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      345008    86724     254272    4012      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     201236    40076     133992    27136     chrome           gpu-process    -
76     32     139260    23800     114596    864       chrome           utility         sub=network.mojom.NetworkService
81     56     57616     16340     41048     228       chrome           utility         sub=storage.mojom.StorageService
174    56     144132    34120     109480    532       chrome           renderer        renderer-client-id=5
188    56     205840    79496     125224    1120      chrome           renderer        renderer-client-id=7
189    56     131416    30336     100556    524       chrome           renderer        renderer-client-id=6
202    56     324336    162512    145812    16028     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
283    56     80380     21076     58996     308       chrome           renderer        renderer-client-id=9
346    32     89972     16052     73816     104       chrome           utility         sub=audio.mojom.AudioService
415    7      91004     36788     54220     0         node             -              node --import tsx src/server.ts 
416    7      2488      152       2336      0         sed              -              sed -u s/^/[app] / 
425    415    15920     6536      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
1835   7      2352      112       2240      0         sleep            -              sleep 2 
1836   0      3972      284       3688      0         bash             -              bash -s 
1843   1836   2432      332       2508      0         bash             -              bash -s 
===== END a-startup =====

===== POINT b-cycle-01 =====
utc: 2026-09-29T01:05:04Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 882.2MiB / 62.62GiB 1.38% 31.61% 351
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      356556    88536     263604    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     202748    40360     135480    26988     chrome           gpu-process    -
76     32     140044    23884     115236    944       chrome           utility         sub=network.mojom.NetworkService
81     56     57708     16368     41112     228       chrome           utility         sub=storage.mojom.StorageService
174    56     145040    34960     109544    536       chrome           renderer        renderer-client-id=5
188    56     200368    73948     125288    1132      chrome           renderer        renderer-client-id=7
189    56     134336    32996     100812    528       chrome           renderer        renderer-client-id=6
202    56     543640    375700    151632    17008     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     96832     16348     80296     188       chrome           utility         sub=audio.mojom.AudioService
415    7      103960    49552     54412     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14624     5240      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2391   53     105948    42900     62904     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2394   2391   21244     15632     5612      0         chrome           broker         -
2421   56     144132    30352     112928    852       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
3331   7      2384      104       2280      0         sleep            -              sleep 2 
3332   0      3840      280       3560      0         bash             -              bash -s 
3339   3332   2260      336       2276      0         bash             -              bash -s 
===== END b-cycle-01 =====

===== POINT b-cycle-02 =====
utc: 2026-09-29T01:06:44Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 898MiB / 62.62GiB 1.40% 36.80% 359
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      357340    89128     263796    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     202700    40332     135480    26856     chrome           gpu-process    -
76     32     140444    24068     115428    948       chrome           utility         sub=network.mojom.NetworkService
81     56     57768     16364     41176     228       chrome           utility         sub=storage.mojom.StorageService
174    56     145556    35476     109544    536       chrome           renderer        renderer-client-id=5
188    56     188932    62492     125288    1152      chrome           renderer        renderer-client-id=7
189    56     137692    36116     101004    572       chrome           renderer        renderer-client-id=6
202    56     563236    392952    151760    18588     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     96896     16328     80296     252       chrome           utility         sub=audio.mojom.AudioService
415    7      106192    51656     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14652     5268      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2391   53     105916    42868     62904     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2394   2391   21244     15632     5612      0         chrome           broker         -
2421   56     144660    30812     112992    856       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
4850   7      2220      108       2112      0         sleep            -              sleep 2 
4851   0      4020      280       3740      0         bash             -              bash -s 
4858   4851   2576      336       2652      0         bash             -              bash -s 
===== END b-cycle-02 =====

===== POINT b-cycle-03 =====
utc: 2026-09-29T01:08:23Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 909.5MiB / 62.62GiB 1.42% 29.25% 361
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      357844    89504     263924    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     202828    40500     135544    26864     chrome           gpu-process    -
76     32     140648    24136     115428    948       chrome           utility         sub=network.mojom.NetworkService
81     56     57780     16364     41304     232       chrome           utility         sub=storage.mojom.StorageService
174    56     146188    36108     109544    536       chrome           renderer        renderer-client-id=5
188    56     188948    62504     125288    1156      chrome           renderer        renderer-client-id=7
189    56     140084    38316     101196    572       chrome           renderer        renderer-client-id=6
202    56     568356    398148    152016    18508     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     96900     16348     80296     256       chrome           utility         sub=audio.mojom.AudioService
415    7      109028    54488     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14652     5268      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2391   53     105936    42888     62904     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2394   2391   21244     15632     5612      0         chrome           broker         -
2421   56     145112    30864     113376    872       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
6363   7      2108      104       2004      0         sleep            -              sleep 2 
6364   0      3840      280       3560      0         bash             -              bash -s 
6371   6364   2428      332       2452      0         bash             -              bash -s 
===== END b-cycle-03 =====

===== POINT b-cycle-04 =====
utc: 2026-09-29T01:10:02Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 824.7MiB / 62.62GiB 1.29% 36.59% 361
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      359256    90916     263924    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     202944    40400     135608    26936     chrome           gpu-process    -
76     32     140660    24280     115428    952       chrome           utility         sub=network.mojom.NetworkService
81     56     57864     16324     41304     236       chrome           utility         sub=storage.mojom.StorageService
174    56     146748    36668     109544    536       chrome           renderer        renderer-client-id=5
188    56     201308    74864     125288    1156      chrome           renderer        renderer-client-id=7
189    56     142812    41044     101196    572       chrome           renderer        renderer-client-id=6
202    56     461708    288688    152208    18596     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     96876     16324     80296     256       chrome           utility         sub=audio.mojom.AudioService
415    7      111432    56892     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14692     5308      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2391   53     111932    42932     68856     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2394   2391   21244     15632     5612      0         chrome           broker         -
2421   56     145396    31148     113376    872       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
7874   7      2212      104       2108      0         sleep            -              sleep 2 
7875   0      3916      276       3640      0         bash             -              bash -s 
7882   7875   2404      332       2440      0         bash             -              bash -s 
===== END b-cycle-04 =====

===== POINT b-cycle-05 =====
utc: 2026-09-29T01:11:41Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 922.8MiB / 62.62GiB 1.44% 26.41% 361
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      359308    90960     263932    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     203272    40564     135608    27100     chrome           gpu-process    -
76     32     140744    24360     115428    956       chrome           utility         sub=network.mojom.NetworkService
81     56     57868     16328     41304     236       chrome           utility         sub=storage.mojom.StorageService
174    56     147576    37364     109672    540       chrome           renderer        renderer-client-id=5
188    56     187436    60988     125288    1160      chrome           renderer        renderer-client-id=7
189    56     145200    43428     101196    576       chrome           renderer        renderer-client-id=6
202    56     571240    400420    152272    18768     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     96900     16348     80296     256       chrome           utility         sub=audio.mojom.AudioService
415    7      113088    58548     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14648     5272      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2391   53     111936    42936     68856     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2394   2391   21244     15632     5612      0         chrome           broker         -
2421   56     147864    31376     115616    872       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
9370   0      3800      280       3520      0         bash             -              bash -s 
9377   9370   2344      336       2448      0         bash             -              bash -s 
===== END b-cycle-05 =====

===== POINT b-cycle-06 =====
utc: 2026-09-29T01:13:23Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 831.3MiB / 62.62GiB 1.30% 33.38% 361
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      358648    90300     263932    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     203208    40628     135608    26984     chrome           gpu-process    -
76     32     140584    24200     115428    956       chrome           utility         sub=network.mojom.NetworkService
81     56     59996     18456     41304     236       chrome           utility         sub=storage.mojom.StorageService
174    56     148100    37888     109672    540       chrome           renderer        renderer-client-id=5
188    56     189756    63308     125288    1160      chrome           renderer        renderer-client-id=7
189    56     148232    46460     101196    576       chrome           renderer        renderer-client-id=6
202    56     467404    296496    152544    18624     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     96904     16352     80296     256       chrome           utility         sub=audio.mojom.AudioService
415    7      113488    58948     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14764     5380      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2391   53     105936    42888     62904     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2394   2391   21244     15632     5612      0         chrome           broker         -
2421   56     148420    31928     115616    876       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
10902  7      2316      108       2208      0         sleep            -              sleep 2 
10903  0      3868      284       3584      0         bash             -              bash -s 
10910  10903  2436      336       2472      0         bash             -              bash -s 
===== END b-cycle-06 =====

===== POINT b-cycle-07 =====
utc: 2026-09-29T01:15:03Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 968.5MiB / 62.62GiB 1.51% 32.51% 361
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      358632    90284     263932    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     203316    40660     135608    27048     chrome           gpu-process    -
76     32     140780    24176     115428    956       chrome           utility         sub=network.mojom.NetworkService
81     56     60000     18460     41304     236       chrome           utility         sub=storage.mojom.StorageService
174    56     148688    38476     109672    540       chrome           renderer        renderer-client-id=5
188    56     202516    76068     125288    1160      chrome           renderer        renderer-client-id=7
189    56     150888    49116     101196    576       chrome           renderer        renderer-client-id=6
202    56     588412    417328    152544    18676     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     96900     16348     80296     256       chrome           utility         sub=audio.mojom.AudioService
415    7      114744    60204     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14836     5452      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2391   53     105936    42888     62904     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2394   2391   21244     15632     5612      0         chrome           broker         -
2421   56     147544    30924     115744    876       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
12413  7      2396      112       2284      0         sleep            -              sleep 2 
12414  0      3748      280       3468      0         bash             -              bash -s 
12421  12414  2216      336       2268      0         bash             -              bash -s 
===== END b-cycle-07 =====

===== POINT b-cycle-08 =====
utc: 2026-09-29T01:16:42Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 968.1MiB / 62.62GiB 1.51% 27.07% 361
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      358628    90280     263932    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     203232    40584     135608    27008     chrome           gpu-process    -
76     32     140864    24480     115428    956       chrome           utility         sub=network.mojom.NetworkService
81     56     59984     18444     41304     236       chrome           utility         sub=storage.mojom.StorageService
174    56     149392    39116     109736    540       chrome           renderer        renderer-client-id=5
188    56     187964    61452     125352    1160      chrome           renderer        renderer-client-id=7
189    56     153556    51784     101196    576       chrome           renderer        renderer-client-id=6
202    56     601704    430392    152672    18700     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     96896     16344     80296     256       chrome           utility         sub=audio.mojom.AudioService
415    7      114896    60356     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14880     5496      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2391   53     105936    42888     62904     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2394   2391   21244     15632     5612      0         chrome           broker         -
2421   56     148488    31868     115744    876       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
13909  0      3844      276       3568      0         bash             -              bash -s 
13916  13909  2300      332       2328      0         bash             -              bash -s 
===== END b-cycle-08 =====

===== POINT b-cycle-09 =====
utc: 2026-09-29T01:18:20Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 943.7MiB / 62.62GiB 1.47% 37.04% 361
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      358792    90440     263936    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     203336    40676     135608    27052     chrome           gpu-process    -
76     32     140684    24300     115428    956       chrome           utility         sub=network.mojom.NetworkService
81     56     60004     18464     41304     236       chrome           utility         sub=storage.mojom.StorageService
174    56     150188    39776     109864    548       chrome           renderer        renderer-client-id=5
188    56     190120    63608     125352    1160      chrome           renderer        renderer-client-id=7
189    56     141112    39276     101260    576       chrome           renderer        renderer-client-id=6
202    56     584128    412804    152672    18700     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     96896     16344     80296     256       chrome           utility         sub=audio.mojom.AudioService
415    7      115028    60488     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14960     5576      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2391   53     105908    42860     62904     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2394   2391   21244     15632     5612      0         chrome           broker         -
2421   56     148512    31892     115744    876       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
15408  7      2428      108       2320      0         sleep            -              sleep 2 
15409  0      3852      284       3568      0         bash             -              bash -s 
15416  15409  2496      336       2528      0         bash             -              bash -s 
===== END b-cycle-09 =====

===== POINT b-cycle-10 =====
utc: 2026-09-29T01:19:59Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 941.2MiB / 62.62GiB 1.47% 35.14% 361
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      358744    90392     263936    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     203484    40788     135608    27088     chrome           gpu-process    -
76     32     140788    24444     115428    960       chrome           utility         sub=network.mojom.NetworkService
81     56     57872     16332     41304     236       chrome           utility         sub=storage.mojom.StorageService
174    56     150900    40488     109864    548       chrome           renderer        renderer-client-id=5
188    56     187528    74804     125352    1164      chrome           renderer        renderer-client-id=7
189    56     142008    40172     101260    576       chrome           renderer        renderer-client-id=6
202    56     584672    414848    152672    17160     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     96896     16344     80296     256       chrome           utility         sub=audio.mojom.AudioService
415    7      115036    60496     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14832     5448      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2391   53     105936    42888     62904     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2394   2391   21244     15632     5612      0         chrome           broker         -
2421   56     148552    31864     115808    880       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
16919  7      2100      112       1988      0         sleep            -              sleep 2 
16920  0      3972      280       3692      0         bash             -              bash -s 
16927  16920  2360      332       2484      0         bash             -              bash -s 
===== END b-cycle-10 =====

===== POINT b-cycle-11 =====
utc: 2026-09-29T01:21:38Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 947.8MiB / 62.62GiB 1.48% 30.20% 366
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      358832    90476     263940    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     203164    40504     135608    26952     chrome           gpu-process    -
76     32     140944    24292     115428    968       chrome           utility         sub=network.mojom.NetworkService
81     56     57880     16336     41304     236       chrome           utility         sub=storage.mojom.StorageService
174    56     151432    41020     109864    548       chrome           renderer        renderer-client-id=5
188    56     188404    61884     125352    1168      chrome           renderer        renderer-client-id=7
189    56     143080    41240     101260    580       chrome           renderer        renderer-client-id=6
202    56     587144    415880    152672    18644     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     96904     16352     80296     256       chrome           utility         sub=audio.mojom.AudioService
415    7      115064    60524     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14928     5544      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2391   53     105916    42868     62904     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2394   2391   21244     15632     5612      0         chrome           broker         -
2421   56     148524    31836     115808    880       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
18433  7      2096      112       1984      0         sleep            -              sleep 2 
18434  0      3768      280       3488      0         bash             -              bash -s 
18441  18434  2284      336       2272      0         bash             -              bash -s 
===== END b-cycle-11 =====

===== POINT b-cycle-12 =====
utc: 2026-09-29T01:23:18Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 963.8MiB / 62.62GiB 1.50% 22.82% 364
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      360084    91728     263940    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     203348    40704     135608    27036     chrome           gpu-process    -
76     32     141096    24700     115428    968       chrome           utility         sub=network.mojom.NetworkService
81     56     57896     16352     41304     240       chrome           utility         sub=storage.mojom.StorageService
174    56     152008    41596     109864    548       chrome           renderer        renderer-client-id=5
188    56     202764    76244     125352    1168      chrome           renderer        renderer-client-id=7
189    56     144608    42768     101260    580       chrome           renderer        renderer-client-id=6
202    56     585656    414580    152672    18692     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     96896     16344     80296     256       chrome           utility         sub=audio.mojom.AudioService
415    7      115180    60640     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14936     5552      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2391   53     112016    42952     68920     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2394   2391   21244     15632     5612      0         chrome           broker         -
2421   56     148816    32128     115808    880       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
19929  0      3832      276       3556      0         bash             -              bash -s 
19948  19929  2284      332       2292      0         bash             -              bash -s 
===== END b-cycle-12 =====

===== POINT c-minute-01 =====
utc: 2026-09-29T01:24:21Z
health: state: streaming quality: hd1080 channel: WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ) segments: 11 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 1.158GiB / 62.62GiB 1.85% 326.54% 463
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      365852    97360     263940    4552      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     229180    59872     135624    36852     chrome           gpu-process    -
76     32     140804    24408     115428    972       chrome           utility         sub=network.mojom.NetworkService
81     56     57892     16348     41304     240       chrome           utility         sub=storage.mojom.StorageService
174    56     152208    41796     109864    548       chrome           renderer        renderer-client-id=5
188    56     190984    64464     125352    1168      chrome           renderer        renderer-client-id=7
189    56     145616    43776     101260    580       chrome           renderer        renderer-client-id=6
202    56     474108    292788    152672    28628     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     97092     16488     80296     308       chrome           utility         sub=audio.mojom.AudioService
415    7      115292    60752     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14944     5560      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2391   53     58680     16576     41960     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
2394   2391   21244     15632     5612      0         chrome           broker         -
2421   56     228752    109072    115808    920       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
20541  56     189016    103364    59844     26184     chrome           utility         sub=media.mojom.CdmServiceBroker
20568  415    201008    156436    44572     0         ffmpeg           -              ffmpeg -hide_banner -loglevel warning -i pipe:0 -map 0:v:0 -
21143  7      2252      112       2140      0         sleep            -              sleep 2 
21144  0      3860      280       3580      0         bash             -              bash -s 
21151  21144  2344      336       2392      0         bash             -              bash -s 
===== END c-minute-01 =====

===== POINT c-minute-02 =====
utc: 2026-09-29T01:25:21Z
health: state: streaming quality: hd1080 channel: WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ) segments: 11 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 1.159GiB / 62.62GiB 1.85% 300.18% 455
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      380556    97284     263940    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     229316    56840     135624    36852     chrome           gpu-process    -
76     32     140752    24356     115428    968       chrome           utility         sub=network.mojom.NetworkService
81     56     57888     16344     41304     240       chrome           utility         sub=storage.mojom.StorageService
174    56     152208    41796     109864    548       chrome           renderer        renderer-client-id=5
188    56     191700    65180     125352    1168      chrome           renderer        renderer-client-id=7
189    56     145704    43864     101260    580       chrome           renderer        renderer-client-id=6
202    56     459060    275876    152672    30520     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     97092     16488     80296     308       chrome           utility         sub=audio.mojom.AudioService
415    7      115532    61120     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14860     5476      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2421   56     226940    108980    115808    3960      chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
20541  56     191824    103616    59844     28084     chrome           utility         sub=media.mojom.CdmServiceBroker
20568  415    200344    155772    44572     0         ffmpeg           -              ffmpeg -hide_banner -loglevel warning -i pipe:0 -map 0:v:0 -
22244  7      2300      108       2192      0         sleep            -              sleep 2 
22245  0      4012      284       3728      0         bash             -              bash -s 
22252  22245  2560      336       2580      0         bash             -              bash -s 
===== END c-minute-02 =====

===== POINT c-minute-03 =====
utc: 2026-09-29T01:26:21Z
health: state: streaming quality: hd1080 channel: WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ) segments: 11 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 1.177GiB / 62.62GiB 1.88% 368.19% 457
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      365016    96660     263940    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     229064    48416     135624    36852     chrome           gpu-process    -
76     32     140704    24308     115428    968       chrome           utility         sub=network.mojom.NetworkService
81     56     57888     16344     41304     240       chrome           utility         sub=storage.mojom.StorageService
174    56     152208    41796     109864    548       chrome           renderer        renderer-client-id=5
188    56     190924    64404     125352    1168      chrome           renderer        renderer-client-id=7
189    56     145892    44052     101260    580       chrome           renderer        renderer-client-id=6
202    56     504816    321276    152672    30760     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     97092     16488     80296     308       chrome           utility         sub=audio.mojom.AudioService
415    7      116044    61504     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14876     5492      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2421   56     225540    108668    115808    920       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
20541  56     191544    103368    59844     28324     chrome           utility         sub=media.mojom.CdmServiceBroker
20568  415    202544    157972    44572     0         ffmpeg           -              ffmpeg -hide_banner -loglevel warning -i pipe:0 -map 0:v:0 -
23313  7      2348      108       2240      0         sleep            -              sleep 2 
23314  0      3816      280       3536      0         bash             -              bash -s 
23321  23314  2492      332       2532      0         bash             -              bash -s 
===== END c-minute-03 =====

===== POINT c-minute-04 =====
utc: 2026-09-29T01:27:21Z
health: state: streaming quality: hd1080 channel: WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ) segments: 11 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 1.2GiB / 62.62GiB 1.92% 284.62% 457
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      376788    108432    263940    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     229100    56624     135624    36852     chrome           gpu-process    -
76     32     140764    24364     115428    1004      chrome           utility         sub=network.mojom.NetworkService
81     56     57908     16364     41304     240       chrome           utility         sub=storage.mojom.StorageService
174    56     152208    41796     109864    548       chrome           renderer        renderer-client-id=5
188    56     191036    64516     125352    1168      chrome           renderer        renderer-client-id=7
189    56     146124    44284     101260    580       chrome           renderer        renderer-client-id=6
202    56     513152    329856    152672    30796     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     97092     16488     80296     308       chrome           utility         sub=audio.mojom.AudioService
415    7      116052    61512     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14888     5504      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2421   56     226224    108660    115808    920       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
20541  56     192436    104032    59844     28324     chrome           utility         sub=media.mojom.CdmServiceBroker
20568  415    202684    158112    44572     0         ffmpeg           -              ffmpeg -hide_banner -loglevel warning -i pipe:0 -map 0:v:0 -
24364  7      2316      108       2208      0         sleep            -              sleep 2 
24365  0      4020      284       3736      0         bash             -              bash -s 
24372  24365  2344      336       2512      0         bash             -              bash -s 
===== END c-minute-04 =====

===== POINT c-minute-05 =====
utc: 2026-09-29T01:28:21Z
health: state: streaming quality: hd1080 channel: WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ) segments: 11 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 1.218GiB / 62.62GiB 1.94% 317.58% 457
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      364372    96016     263940    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     229172    56696     135624    36852     chrome           gpu-process    -
76     32     141456    24432     115428    2532      chrome           utility         sub=network.mojom.NetworkService
81     56     57908     16364     41304     240       chrome           utility         sub=storage.mojom.StorageService
174    56     152208    41796     109864    548       chrome           renderer        renderer-client-id=5
188    56     190100    63580     125352    1168      chrome           renderer        renderer-client-id=7
189    56     146364    44524     101260    580       chrome           renderer        renderer-client-id=6
202    56     530944    349424    152736    32700     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     97092     16488     80296     308       chrome           utility         sub=audio.mojom.AudioService
415    7      116076    61536     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14896     5512      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2421   56     225488    109140    115808    920       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
20541  56     191988    103652    59844     28324     chrome           utility         sub=media.mojom.CdmServiceBroker
20568  415    203916    159344    44572     0         ffmpeg           -              ffmpeg -hide_banner -loglevel warning -i pipe:0 -map 0:v:0 -
25431  7      2300      108       2192      0         sleep            -              sleep 2 
25432  0      3968      280       3688      0         bash             -              bash -s 
25439  25432  2324      336       2472      0         bash             -              bash -s 
===== END c-minute-05 =====

===== POINT c-minute-06 =====
utc: 2026-09-29T01:29:21Z
health: state: streaming quality: hd1080 channel: WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ) segments: 11 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 1.225GiB / 62.62GiB 1.96% 345.58% 457
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      380296    111944    263940    4412      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     227896    56680     135624    36852     chrome           gpu-process    -
76     32     140724    24292     115428    1036      chrome           utility         sub=network.mojom.NetworkService
81     56     57892     16348     41304     240       chrome           utility         sub=storage.mojom.StorageService
174    56     152208    41796     109864    548       chrome           renderer        renderer-client-id=5
188    56     190020    63500     125352    1168      chrome           renderer        renderer-client-id=7
189    56     146576    44736     101260    580       chrome           renderer        renderer-client-id=6
202    56     526064    347908    152736    28040     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     97092     16488     80296     308       chrome           utility         sub=audio.mojom.AudioService
415    7      116080    61540     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14896     5512      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2421   56     226324    108200    115808    920       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
20541  56     191876    103700    59908     28324     chrome           utility         sub=media.mojom.CdmServiceBroker
20568  415    206292    161720    44572     0         ffmpeg           -              ffmpeg -hide_banner -loglevel warning -i pipe:0 -map 0:v:0 -
26483  0      3844      280       3564      0         bash             -              bash -s 
26490  26483  2416      332       2436      0         bash             -              bash -s 
===== END c-minute-06 =====

===== POINT c-minute-07 =====
utc: 2026-09-29T01:30:21Z
health: state: streaming quality: hd1080 channel: WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ) segments: 11 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 1.224GiB / 62.62GiB 1.96% 392.88% 457
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      365676    97324     263940    4412      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     221144    64320     135624    36852     chrome           gpu-process    -
76     32     141724    24332     115428    2952      chrome           utility         sub=network.mojom.NetworkService
81     56     57892     16348     41304     240       chrome           utility         sub=storage.mojom.StorageService
174    56     152208    41796     109864    548       chrome           renderer        renderer-client-id=5
188    56     190072    63552     125352    1168      chrome           renderer        renderer-client-id=7
189    56     146880    45040     101260    580       chrome           renderer        renderer-client-id=6
202    56     543760    365632    152736    29436     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     97092     16488     80296     308       chrome           utility         sub=audio.mojom.AudioService
415    7      116084    61544     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14896     5512      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2421   56     225468    108644    115808    920       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
20541  56     192560    104240    59908     28324     chrome           utility         sub=media.mojom.CdmServiceBroker
20568  415    205688    161116    44572     0         ffmpeg           -              ffmpeg -hide_banner -loglevel warning -i pipe:0 -map 0:v:0 -
27538  7      2176      104       2072      0         sleep            -              sleep 2 
27539  0      3828      280       3548      0         bash             -              bash -s 
27546  27539  2304      332       2308      0         bash             -              bash -s 
===== END c-minute-07 =====

===== POINT c-minute-08 =====
utc: 2026-09-29T01:31:21Z
health: state: streaming quality: hd1080 channel: WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ) segments: 11 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 1.261GiB / 62.62GiB 2.01% 403.53% 457
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      379508    111156    263940    4412      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     229068    50224     135624    36852     chrome           gpu-process    -
76     32     140592    24160     115428    1004      chrome           utility         sub=network.mojom.NetworkService
81     56     57892     16348     41304     240       chrome           utility         sub=storage.mojom.StorageService
174    56     152208    41796     109864    548       chrome           renderer        renderer-client-id=5
188    56     190152    63632     125352    1168      chrome           renderer        renderer-client-id=7
189    56     147092    45252     101260    580       chrome           renderer        renderer-client-id=6
202    56     554276    374192    152736    27424     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     97092     16488     80296     308       chrome           utility         sub=audio.mojom.AudioService
415    7      116104    61564     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14912     5528      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2421   56     226140    109072    115808    920       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
20541  56     192352    104060    59908     28324     chrome           utility         sub=media.mojom.CdmServiceBroker
20568  415    205824    161252    44572     0         ffmpeg           -              ffmpeg -hide_banner -loglevel warning -i pipe:0 -map 0:v:0 -
28605  7      2300      108       2192      0         sleep            -              sleep 2 
28606  0      3864      280       3584      0         bash             -              bash -s 
28613  28606  2336      332       2328      0         bash             -              bash -s 
===== END c-minute-08 =====

===== POINT c-minute-09 =====
utc: 2026-09-29T01:32:21Z
health: state: streaming quality: hd1080 channel: WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ) segments: 11 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 1.23GiB / 62.62GiB 1.96% 316.00% 457
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      364872    96520     263940    4412      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     220928    56624     135624    36852     chrome           gpu-process    -
76     32     141612    24184     115428    2132      chrome           utility         sub=network.mojom.NetworkService
81     56     57892     16348     41304     240       chrome           utility         sub=storage.mojom.StorageService
174    56     152208    41796     109864    548       chrome           renderer        renderer-client-id=5
188    56     190240    63720     125352    1168      chrome           renderer        renderer-client-id=7
189    56     147260    45420     101260    580       chrome           renderer        renderer-client-id=6
202    56     544064    362668    152736    28988     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     97092     16488     80296     308       chrome           utility         sub=audio.mojom.AudioService
415    7      116108    61568     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14912     5528      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2421   56     225468    108740    115808    920       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
20541  56     192500    104372    59908     28324     chrome           utility         sub=media.mojom.CdmServiceBroker
20568  415    206108    159740    44572     0         ffmpeg           -              ffmpeg -hide_banner -loglevel warning -i pipe:0 -map 0:v:0 -
29657  0      3968      280       3688      0         bash             -              bash -s 
29664  29657  2452      332       2512      0         bash             -              bash -s 
===== END c-minute-09 =====

===== POINT c-minute-10 =====
utc: 2026-09-29T01:33:21Z
health: state: streaming quality: hd1080 channel: WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ) segments: 11 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 1.235GiB / 62.62GiB 1.97% 335.12% 457
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      373076    110920    257744    4412      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     229168    56692     135624    36852     chrome           gpu-process    -
76     32     140632    24200     115428    1004      chrome           utility         sub=network.mojom.NetworkService
81     56     57900     16356     41304     240       chrome           utility         sub=storage.mojom.StorageService
174    56     152208    41796     109864    548       chrome           renderer        renderer-client-id=5
188    56     191100    64580     125352    1168      chrome           renderer        renderer-client-id=7
189    56     147464    45624     101260    580       chrome           renderer        renderer-client-id=6
202    56     541548    363856    152736    27812     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     97092     16488     80296     308       chrome           utility         sub=audio.mojom.AudioService
415    7      116116    61576     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14960     5576      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2421   56     229612    109308    115808    920       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
20541  56     191804    103680    59908     28324     chrome           utility         sub=media.mojom.CdmServiceBroker
20568  415    206120    161548    44572     0         ffmpeg           -              ffmpeg -hide_banner -loglevel warning -i pipe:0 -map 0:v:0 -
30712  7      2308      112       2196      0         sleep            -              sleep 2 
30713  0      3716      280       3436      0         bash             -              bash -s 
30720  30713  2236      332       2244      0         bash             -              bash -s 
===== END c-minute-10 =====

===== POINT c-after-stop =====
utc: 2026-09-29T01:33:56Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 967.3MiB / 62.62GiB 1.51% 30.28% 367
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      356808    90756     261636    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     206308    40800     135608    29900     chrome           gpu-process    -
76     32     140768    24372     115428    968       chrome           utility         sub=network.mojom.NetworkService
81     56     57916     16372     41304     240       chrome           utility         sub=storage.mojom.StorageService
174    56     152488    42076     109864    548       chrome           renderer        renderer-client-id=5
188    56     203156    76636     125352    1168      chrome           renderer        renderer-client-id=7
189    56     148564    46724     101260    580       chrome           renderer        renderer-client-id=6
202    56     581160    407908    152736    20596     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     96904     16352     80296     256       chrome           utility         sub=audio.mojom.AudioService
415    7      116128    61588     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14960     5576      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2421   56     149092    32400     115808    884       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
31498  53     105680    43720     61816     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
31499  31498  21244     15632     5612      0         chrome           broker         -
31594  0      3832      280       3552      0         bash             -              bash -s 
31601  31594  2284      336       2316      0         bash             -              bash -s 
===== END c-after-stop =====

===== POINT d-after-30s-pull =====
utc: 2026-09-29T01:35:05Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-t031b 870MiB / 62.62GiB 1.36% 26.26% 367
--- processes
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1804      88        1716      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4568      924       3644      0         bash             -              bash /entrypoint.sh 
28     7      41080     11972     8280      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
32     7      359688    90948     264324    4416      chrome           (no --type)    -
42     32     2140      116       2024      0         cat              -              cat 
43     32     2256      120       2136      0         cat              -              cat 
45     1      4180      344       3836      0         chrome_crashpad  (no --type)    -
47     1      3852      324       3528      0         chrome_crashpad  (no --type)    -
53     32     68100     15308     52792     0         chrome           zygote         -
54     32     68952     15212     53740     0         chrome           zygote         -
56     54     20136     15312     4824      0         chrome           zygote         -
74     53     206176    40956     135608    29624     chrome           gpu-process    -
76     32     140972    24572     115428    972       chrome           utility         sub=network.mojom.NetworkService
81     56     57916     16372     41304     240       chrome           utility         sub=storage.mojom.StorageService
174    56     153096    42684     109864    548       chrome           renderer        renderer-client-id=5
188    56     203308    76788     125352    1168      chrome           renderer        renderer-client-id=7
189    56     149424    47584     101260    580       chrome           renderer        renderer-client-id=6
202    56     480352    306460    152736    18888     chrome           renderer        renderer-client-id=8
259    7      19380     10084     9296      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
280    7      38448     21460     16988     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
346    32     96908     16356     80296     256       chrome           utility         sub=audio.mojom.AudioService
415    7      116128    61588     54540     0         node             -              node --import tsx src/server.ts 
416    7      2492      156       2336      0         sed              -              sed -u s/^/[app] / 
425    415    14972     5588      9384      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
2421   56     148836    32144     115808    884       chrome           renderer        renderer-client-id=20 extension-process
2431   56     80236     21060     58868     308       chrome           renderer        renderer-client-id=21
31498  53     106924    42916     63864     144       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
31499  31498  21244     15632     5612      0         chrome           broker         -
32855  0      3852      284       3568      0         bash             -              bash -s 
32862  32855  2200      336       2284      0         bash             -              bash -s 
===== END d-after-30s-pull =====

````

## Appendix D — step 4, the run log

The cycle script's own log, unedited. The `pull exit=` lines end in an empty field: the script looked for a line starting `video:`, which ffmpeg prefixes with `[out#0/null @ …]`; the media figures in the report were taken from each pull log with `grep -o`.

````
2026-09-29T01:00:40Z waiting 163 s for point (a) at 2026-09-29T01:03:23Z
2026-09-29T01:03:25Z point (a) measured
2026-09-29T01:03:25Z cycle 01: tune start
2026-09-29T01:03:32Z cycle 01: cold request -> playlist: HTTP 200 in 6.711800 s
2026-09-29T01:04:32Z cycle 01: pull exit=0 wall=60.5s segments_opened=61 | size=N/A time=00:00:59.98 bitrate=N/A speed=0.992x     | 
2026-09-29T01:04:54Z cycle 01: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 01 app log (docker logs --since 2026-09-29T01:03:25Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 4E911524677A8AC0277D01E9F0528F44 (https://tv.youtube.com/)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=429 layout=437 playing=1706 pinned=1711
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:16?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x5cee7fdbb440] File ended prematurely at pos. 28510253 (0x1b3082d)
[app] [matroska,webm @ 0x5cee7fdbb440] Seek to desired resync point failed. Seeking to earliest point available instead.
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T01:05:06Z cycle 01: measured
2026-09-29T01:05:06Z cycle 02: tune start
2026-09-29T01:05:11Z cycle 02: cold request -> playlist: HTTP 200 in 4.617979 s
2026-09-29T01:06:11Z cycle 02: pull exit=0 wall=60.5s segments_opened=61 | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x     | 
2026-09-29T01:06:34Z cycle 02: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 02 app log (docker logs --since 2026-09-29T01:05:06Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 4E911524677A8AC0277D01E9F0528F44 (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=631 layout=650 playing=2166 pinned=2170
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:26?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x5a8793287440] File ended prematurely at pos. 28804403 (0x1b78533)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T01:06:46Z cycle 02: measured
2026-09-29T01:06:46Z cycle 03: tune start
2026-09-29T01:06:50Z cycle 03: cold request -> playlist: HTTP 200 in 4.586190 s
2026-09-29T01:07:50Z cycle 03: pull exit=0 wall=59.9s segments_opened=61 | size=N/A time=00:00:59.98 bitrate=N/A speed=   1x     | 
2026-09-29T01:08:13Z cycle 03: idle stop + park seen 22.3 s after the pull ended; settling 10s
--- cycle 03 app log (docker logs --since 2026-09-29T01:06:46Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 4E911524677A8AC0277D01E9F0528F44 (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=589 layout=603 playing=2139 pinned=2144
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:36?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x620d34293440] File ended prematurely at pos. 26780656 (0x198a3f0)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T01:08:25Z cycle 03: measured
2026-09-29T01:08:25Z cycle 04: tune start
2026-09-29T01:08:29Z cycle 04: cold request -> playlist: HTTP 200 in 4.516250 s
2026-09-29T01:09:30Z cycle 04: pull exit=0 wall=60.5s segments_opened=61 | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x     | 
2026-09-29T01:09:52Z cycle 04: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 04 app log (docker logs --since 2026-09-29T01:08:25Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 4E911524677A8AC0277D01E9F0528F44 (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=898 layout=931 playing=2060 pinned=2061
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:46?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T01:10:04Z cycle 04: measured
2026-09-29T01:10:04Z cycle 05: tune start
2026-09-29T01:10:08Z cycle 05: cold request -> playlist: HTTP 200 in 4.104962 s
2026-09-29T01:11:09Z cycle 05: pull exit=0 wall=60.5s segments_opened=61 | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x     | 
2026-09-29T01:11:31Z cycle 05: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 05 app log (docker logs --since 2026-09-29T01:10:04Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 4E911524677A8AC0277D01E9F0528F44 (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=599 layout=616 playing=1649 pinned=1654
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:56?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T01:11:43Z cycle 05: measured
2026-09-29T01:11:43Z cycle 06: tune start
2026-09-29T01:11:51Z cycle 06: cold request -> playlist: HTTP 200 in 7.386768 s
2026-09-29T01:12:51Z cycle 06: pull exit=0 wall=60.5s segments_opened=61 | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x     | 
2026-09-29T01:13:13Z cycle 06: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 06 app log (docker logs --since 2026-09-29T01:11:43Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 4E911524677A8AC0277D01E9F0528F44 (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=596 layout=621 playing=4930 pinned=4933
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:66?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x634ad2058440] File ended prematurely at pos. 28030491 (0x1abb61b)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T01:13:25Z cycle 06: measured
2026-09-29T01:13:25Z cycle 07: tune start
2026-09-29T01:13:30Z cycle 07: cold request -> playlist: HTTP 200 in 4.416699 s
2026-09-29T01:14:30Z cycle 07: pull exit=0 wall=60.5s segments_opened=61 | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x     | 
2026-09-29T01:14:52Z cycle 07: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 07 app log (docker logs --since 2026-09-29T01:13:25Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 4E911524677A8AC0277D01E9F0528F44 (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=617 layout=633 playing=1965 pinned=1969
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:76?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x5e6e01cd4440] File ended prematurely at pos. 28119312 (0x1ad1110)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T01:15:05Z cycle 07: measured
2026-09-29T01:15:05Z cycle 08: tune start
2026-09-29T01:15:09Z cycle 08: cold request -> playlist: HTTP 200 in 4.308564 s
2026-09-29T01:16:09Z cycle 08: pull exit=0 wall=60.5s segments_opened=61 | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x     | 
2026-09-29T01:16:32Z cycle 08: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 08 app log (docker logs --since 2026-09-29T01:15:05Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 4E911524677A8AC0277D01E9F0528F44 (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=578 layout=597 playing=1869 pinned=1870
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:86?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x5ac4ceaf9440] File ended prematurely at pos. 28537594 (0x1b372fa)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T01:16:44Z cycle 08: measured
2026-09-29T01:16:44Z cycle 09: tune start
2026-09-29T01:16:48Z cycle 09: cold request -> playlist: HTTP 200 in 4.085288 s
2026-09-29T01:17:48Z cycle 09: pull exit=0 wall=60.0s segments_opened=61 | size=N/A time=00:00:59.98 bitrate=N/A speed=   1x     | 
2026-09-29T01:18:10Z cycle 09: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 09 app log (docker logs --since 2026-09-29T01:16:44Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 4E911524677A8AC0277D01E9F0528F44 (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=589 layout=600 playing=1640 pinned=1641
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:96?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x56a8f71c4440] File ended prematurely at pos. 27798583 (0x1a82c37)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T01:18:22Z cycle 09: measured
2026-09-29T01:18:22Z cycle 10: tune start
2026-09-29T01:18:26Z cycle 10: cold request -> playlist: HTTP 200 in 4.198968 s
2026-09-29T01:19:27Z cycle 10: pull exit=0 wall=60.5s segments_opened=61 | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x     | 
2026-09-29T01:19:49Z cycle 10: idle stop + park seen 22.3 s after the pull ended; settling 10s
--- cycle 10 app log (docker logs --since 2026-09-29T01:18:22Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 4E911524677A8AC0277D01E9F0528F44 (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=581 layout=618 playing=1754 pinned=1760
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:106?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x5b591c677440] File ended prematurely at pos. 29909060 (0x1c86044)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T01:20:01Z cycle 10: measured
2026-09-29T01:20:01Z cycle 11: tune start
2026-09-29T01:20:06Z cycle 11: cold request -> playlist: HTTP 200 in 4.400711 s
2026-09-29T01:21:06Z cycle 11: pull exit=0 wall=60.5s segments_opened=61 | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x     | 
2026-09-29T01:21:28Z cycle 11: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 11 app log (docker logs --since 2026-09-29T01:20:01Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 4E911524677A8AC0277D01E9F0528F44 (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=602 layout=613 playing=1951 pinned=1952
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:116?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x5e2a30b55440] File ended prematurely at pos. 28548759 (0x1b39e97)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T01:21:41Z cycle 11: measured
2026-09-29T01:21:41Z cycle 12: tune start
2026-09-29T01:21:45Z cycle 12: cold request -> playlist: HTTP 200 in 4.362393 s
2026-09-29T01:22:46Z cycle 12: pull exit=0 wall=60.5s segments_opened=61 | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x     | 
2026-09-29T01:23:08Z cycle 12: idle stop + park seen 22.3 s after the pull ended; settling 10s
--- cycle 12 app log (docker logs --since 2026-09-29T01:21:41Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 4E911524677A8AC0277D01E9F0528F44 (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=590 layout=636 playing=1913 pinned=1918
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:126?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T01:23:20Z cycle 12: measured
2026-09-29T01:23:20Z 12 CYCLES DONE
2026-09-29T01:23:20Z 10-minute pull: tune start
2026-09-29T01:23:24Z 10-minute pull: cold request -> playlist: HTTP 200 in 4.330135 s
2026-09-29T01:24:23Z 10-minute pull: minute 1 measured
2026-09-29T01:25:22Z 10-minute pull: minute 2 measured
2026-09-29T01:26:23Z 10-minute pull: minute 3 measured
2026-09-29T01:27:22Z 10-minute pull: minute 4 measured
2026-09-29T01:28:23Z 10-minute pull: minute 5 measured
2026-09-29T01:29:22Z 10-minute pull: minute 6 measured
2026-09-29T01:30:23Z 10-minute pull: minute 7 measured
2026-09-29T01:31:22Z 10-minute pull: minute 8 measured
2026-09-29T01:32:23Z 10-minute pull: minute 9 measured
2026-09-29T01:33:22Z 10-minute pull: minute 10 measured
2026-09-29T01:33:24Z 10-minute pull: pull exit=0 wall=599.7s segments_opened=608 | size=N/A time=00:09:59.98 bitrate=N/A speed=   1x     | 
2026-09-29T01:33:46Z 10-minute pull: idle stop + park seen 22.3 s after the pull ended; settling 10s
--- 10-minute pull app log (docker logs --since 2026-09-29T01:23:20Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 4E911524677A8AC0277D01E9F0528F44 (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=585 layout=597 playing=1884 pinned=1888
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:136?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x60eb767ca440] File ended prematurely at pos. 206335602 (0xc4c6e72)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T01:33:58Z 10-minute pull: measured after the stop
2026-09-29T01:33:58Z 30 s pull: tune start
2026-09-29T01:34:03Z 30 s pull: cold request -> playlist: HTTP 200 in 4.353913 s
2026-09-29T01:34:33Z 30 s pull: pull exit=0 wall=30.2s segments_opened=31 | size=   22854kB time=00:00:29.99 bitrate=6241.7kbits/s speed=0.993x     | 
2026-09-29T01:34:55Z 30 s pull: idle stop + park seen 22.3 s after the pull ended; settling 10s
--- 30 s pull app log (docker logs --since 2026-09-29T01:33:58Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab 4E911524677A8AC0277D01E9F0528F44 (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=578 layout=627 playing=1896 pinned=1901
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:146?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x5c584ebb6440] File ended prematurely at pos. 17536948 (0x10b97b4)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-29T01:35:07Z 30 s pull: measured after the stop
2026-09-29T01:35:07Z gc warning lines in the container log: 0
2026-09-29T01:35:07Z STEP 4 RUN DONE
````

## Appendix E — the scripts

Run from the scratchpad on marlinpc; none is in the repo or the image.

**`measure.sh`**

````
#!/usr/bin/env bash
# measure.sh <container> <label> <logfile> — one point: docker stats, then every process. No page is probed.
set -uo pipefail
S=/tmp/claude-1000/-Apps-marlin-cast/48682dfb-ac6c-4452-bca2-0434df9b4712/scratchpad
C="$1"; LABEL="$2"; LOG="$3"
{
  echo "===== POINT ${LABEL} ====="
  echo "utc: $(date -u +%FT%TZ)"
  echo "health: $(curl -s -m 5 http://127.0.0.1:8091/health | grep -E '^(state|quality|channel|segments):' | tr '\n' ' ')"
  echo "--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)"
  docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.MemPerc}} {{.CPUPerc}} {{.PIDs}}' "$C"
  echo "--- processes"
  docker exec -i "$C" bash -s < "$S/ps.sh"
  echo "===== END ${LABEL} ====="
  echo
} >> "$LOG" 2>&1
````

**`ps.sh`**

````
#!/usr/bin/env bash
# Runs INSIDE the container (docker exec -i <c> bash -s < ps.sh). Same as the recon's ps.sh. Read-only.
printf '%-6s %-6s %-9s %-9s %-9s %-9s %-16s %-14s %s\n' PID PPID RSS_kB RssAnon RssFile RssShmem COMM TYPE DETAIL
ps -eo pid=,ppid=,rss=,comm= | while read -r pid ppid rss comm; do
  [ -r "/proc/$pid/cmdline" ] || continue
  args="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null)"
  anon="$(awk '/^RssAnon:/ {print $2}' "/proc/$pid/status" 2>/dev/null)"
  file="$(awk '/^RssFile:/ {print $2}' "/proc/$pid/status" 2>/dev/null)"
  shm="$(awk '/^RssShmem:/ {print $2}' "/proc/$pid/status" 2>/dev/null)"
  type="-"; detail="-"
  case "$comm" in
    chrome*)
      type="$(printf '%s' "$args" | grep -o -- '--type=[^ ]*' | head -1 | cut -d= -f2)"
      [ -n "$type" ] || type="(no --type)"
      detail=""
      sub="$(printf '%s' "$args" | grep -o -- '--utility-sub-type=[^ ]*' | head -1 | cut -d= -f2)"
      [ -n "$sub" ] && detail="$detail sub=$sub"
      rid="$(printf '%s' "$args" | grep -o -- '--renderer-client-id=[^ ]*' | head -1 | cut -d= -f2)"
      [ -n "$rid" ] && detail="$detail renderer-client-id=$rid"
      printf '%s' "$args" | grep -q -- '--extension-process' && detail="$detail extension-process"
      [ -n "$detail" ] || detail="-"
      ;;
    *)
      detail="$(printf '%s' "$args" | cut -c1-60)"
      ;;
  esac
  printf '%-6s %-6s %-9s %-9s %-9s %-9s %-16s %-14s %s\n' "$pid" "$ppid" "$rss" "${anon:--}" "${file:--}" "${shm:--}" "$comm" "$type" "$detail"
done
````

**`gc.mjs`**

````
// Sends HeapProfiler.collectGarbage to the capture extension's offscreen document
// over the container's loopback CDP. Run INSIDE the container:
//   docker exec -i -u 99:100 <c> node --input-type=module - < gc.mjs
// No page is evaluated, navigated or clicked. The session is detached afterwards.
const version = await (await fetch("http://127.0.0.1:9333/json/version")).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", () => rej(new Error("ws open failed")), { once: true }); });
let id = 0; const pending = new Map();
ws.addEventListener("message", (ev) => { const m = JSON.parse(String(ev.data)); const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); });
const send = (method, params = {}, sessionId) => { const i = ++id; const msg = { id: i, method, params }; if (sessionId) msg.sessionId = sessionId; ws.send(JSON.stringify(msg)); return new Promise((res, rej) => { pending.set(i, { res, rej }); setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error("timeout " + method)); } }, 15000); }); };
const short = (u) => { try { const x = new URL(u); return x.protocol + "//" + x.host + x.pathname; } catch { return String(u).slice(0, 80); } };
const plain = (await send("Target.getTargets")).targetInfos;
console.log(`Target.getTargets (no filter): ${plain.length} targets`);
for (const t of plain) console.log(`  ${t.type} | ${t.targetId.slice(0, 8)} | attached=${t.attached} | ${short(t.url)}`);
const off = plain.filter((t) => t.url.startsWith("chrome-extension://") && t.url.endsWith("/offscreen.html"));
console.log(`offscreen candidates in the unfiltered list: ${off.length}`);
if (off.length !== 1) { console.log("FAILED: expected exactly one"); ws.close(); process.exit(2); }
const t = off[0];
const { sessionId } = await send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
console.log(`${new Date().toISOString()} attached to ${t.type} ${t.targetId.slice(0, 8)}`);
const t0 = performance.now();
try {
  const r = await send("HeapProfiler.collectGarbage", {}, sessionId);
  console.log(`${new Date().toISOString()} HeapProfiler.collectGarbage -> ${JSON.stringify(r)} in ${Math.round(performance.now() - t0)} ms`);
} catch (e) {
  console.log(`${new Date().toISOString()} HeapProfiler.collectGarbage FAILED: ${e.message}`);
  process.exitCode = 3;
}
await send("Target.detachFromTarget", { sessionId }).catch(() => {});
ws.close();
````

**`step2.sh`**

````
#!/usr/bin/env bash
# Step 2: 3 cycles on sha-c876a3a, then one forced collection on the offscreen document.
# Stops at the first failure with a snapshot; never retries.
set -uo pipefail
S=/tmp/claude-1000/-Apps-marlin-cast/48682dfb-ac6c-4452-bca2-0434df9b4712/scratchpad
C=marlin-cast-t031a
KEY=UCZmySpv9dwlwsU2ZxS0pipQ
URL="http://127.0.0.1:8091/stream/${KEY}/index.m3u8"
LOG="$S/out/step2-cycles.log"
M="$S/out/step2-measure.log"
say() { echo "$(date -u +%FT%TZ) $*" | tee -a "$LOG"; }
fail() {
  say "FAILURE: $*"
  { echo "--- snapshot: health"; curl -s -m 5 http://127.0.0.1:8091/health
    echo "--- snapshot: docker ps"; docker ps -a --filter "name=$C" --format '{{.Names}} {{.Status}}'
    echo "--- snapshot: last 60 log lines"; docker logs --tail 60 "$C" 2>&1 | cut -c1-400; } >> "$LOG" 2>&1
  bash "$S/measure.sh" "$C" "failure-snapshot" "$M"
  say "STOPPED"; exit 1
}
bash "$S/measure.sh" "$C" "s2-startup" "$M"; say "startup measured"
for i in 1 2 3; do
  n=$(printf '%02d' "$i")
  state=$(curl -s -m 5 http://127.0.0.1:8091/health | awk '/^state:/ {print $2}')
  [ "$state" = idle ] || fail "cycle $n: state is '$state' before the tune, expected idle"
  since=$(date -u +%FT%TZ); t0=$(date +%s.%N)
  say "cycle $n: tune + pull start"
  timeout 110 ffmpeg -hide_banner -nostdin -loglevel info -nostats -t 60 -i "$URL" -c copy -f null - > "$S/out/s2-pull-$n.log" 2>&1
  rc=$?; t1=$(date +%s.%N)
  wall=$(awk -v a="$t0" -v b="$t1" 'BEGIN {printf "%.1f", b - a}')
  last=$(tr '\r' '\n' < "$S/out/s2-pull-$n.log" | grep -E 'time=' | tail -1)
  vid=$(grep -E '^video:' "$S/out/s2-pull-$n.log" | tail -1)
  say "cycle $n: pull exit=$rc wall=${wall}s | $last | $vid"
  [ "$rc" = 0 ] || { tail -5 "$S/out/s2-pull-$n.log" >> "$LOG"; fail "cycle $n: pull exited $rc"; }
  ok=0
  for w in $(seq 1 60); do
    lines=$(docker logs --since "$since" "$C" 2>&1)
    if echo "$lines" | grep -q '\[stop\] WBAL 11: idle' && echo "$lines" | grep -q '\[stop\] parked the youtubetv tab'; then ok=1; break; fi
    sleep 2
  done
  [ "$ok" = 1 ] || fail "cycle $n: no idle stop + park in the log within 120 s of the pull ending"
  say "cycle $n: idle stop + park seen $(awk -v a="$t1" -v b="$(date +%s.%N)" 'BEGIN {printf "%.1f", b - a}') s after the pull ended"
  echo "--- cycle $n app log (docker logs --since $since)" >> "$LOG"
  docker logs --since "$since" "$C" 2>&1 | grep -E '^\[app\]' | cut -c1-260 >> "$LOG"
  bash "$S/measure.sh" "$C" "s2-cycle-$n" "$M"; say "cycle $n: measured"
done
bash "$S/measure.sh" "$C" "s2-before-gc" "$M"; say "before-gc measured"
say "sending HeapProfiler.collectGarbage to the offscreen document"
docker exec -i -u 99:100 "$C" node --input-type=module - < "$S/gc.mjs" >> "$LOG" 2>&1
say "gc script exit=$?"
sleep 10
bash "$S/measure.sh" "$C" "s2-after-gc-10s" "$M"; say "after-gc measured"
say "STEP 2 RUN DONE"
````

**`step4.sh`**

````
#!/usr/bin/env bash
# Step 4 on the local image: startup point, 12 cycles, one 10-minute pull measured
# once a minute, one 30 s pull saved for ffprobe. Stops at the first failure with a
# snapshot; never retries.
set -uo pipefail
S=/tmp/claude-1000/-Apps-marlin-cast/48682dfb-ac6c-4452-bca2-0434df9b4712/scratchpad
C=marlin-cast-t031b
KEY=UCZmySpv9dwlwsU2ZxS0pipQ
URL="http://127.0.0.1:8091/stream/${KEY}/index.m3u8"
LOG="$S/out/step4-cycles.log"
M="$S/out/step4-measure.log"
A_AT="$1"
say() { echo "$(date -u +%FT%TZ) $*" | tee -a "$LOG"; }
fail() {
  say "FAILURE: $*"
  { echo "--- snapshot: health"; curl -s -m 5 http://127.0.0.1:8091/health
    echo "--- snapshot: docker ps"; docker ps -a --filter "name=$C" --format '{{.Names}} {{.Status}}'
    echo "--- snapshot: last 60 log lines"; docker logs --tail 60 "$C" 2>&1 | cut -c1-400; } >> "$LOG" 2>&1
  bash "$S/measure.sh" "$C" "failure-snapshot" "$M"
  say "STOPPED"; exit 1
}
idle_or_fail() {
  state=$(curl -s -m 5 http://127.0.0.1:8091/health | awk '/^state:/ {print $2}')
  [ "$state" = idle ] || fail "$1: state is '$state' before the tune, expected idle"
}
cold_tune() {   # the cold request: GET the playlist, timed to the 200
  r=$(curl -s -m 60 -o /dev/null -w '%{http_code} %{time_total}' "$URL")
  say "$1: cold request -> playlist: HTTP ${r% *} in ${r#* } s"
  [ "${r% *}" = 200 ] || fail "$1: cold request answered ${r% *}"
}
wait_stop() {   # $1 label, $2 since, $3 t1
  ok=0
  for w in $(seq 1 60); do
    lines=$(docker logs --since "$2" "$C" 2>&1)
    if echo "$lines" | grep -q '\[stop\] WBAL 11: idle' && echo "$lines" | grep -q '\[stop\] parked the youtubetv tab'; then ok=1; break; fi
    sleep 2
  done
  [ "$ok" = 1 ] || fail "$1: no idle stop + park in the log within 120 s of the pull ending"
  say "$1: idle stop + park seen $(awk -v a="$3" -v b="$(date +%s.%N)" 'BEGIN {printf "%.1f", b - a}') s after the pull ended; settling 10s"
  sleep 10
  echo "--- $1 app log (docker logs --since $2)" >> "$LOG"
  docker logs --since "$2" "$C" 2>&1 | grep -E '^\[app\]' | cut -c1-260 >> "$LOG"
}
pull_summary() {  # $1 label, $2 logfile, $3 rc, $4 wall
  last=$(tr '\r' '\n' < "$2" | grep -E 'time=' | tail -1)
  vid=$(grep -E '^video:' "$2" | tail -1)
  segs=$(grep -c "Opening '.*\.m4s' for reading" "$2")
  say "$1: pull exit=$3 wall=$4s segments_opened=$segs | $last | $vid"
}

# ---- (a) startup ----------------------------------------------------------------
now=$(date -u +%s); at=$(date -u -d "$A_AT" +%s)
if [ "$at" -gt "$now" ]; then say "waiting $((at - now)) s for point (a) at $A_AT"; sleep $((at - now)); fi
tunes=$(docker logs "$C" 2>&1 | grep -c '\[app\] \[tune\]')
[ "$tunes" = 0 ] || fail "a tune happened before point (a)"
bash "$S/measure.sh" "$C" "a-startup" "$M"; say "point (a) measured"

# ---- (b) 12 cycles ---------------------------------------------------------------
for i in $(seq 1 12); do
  n=$(printf '%02d' "$i")
  idle_or_fail "cycle $n"
  since=$(date -u +%FT%TZ)
  say "cycle $n: tune start"
  cold_tune "cycle $n"
  t0=$(date +%s.%N)
  timeout 110 ffmpeg -hide_banner -nostdin -loglevel info -nostats -t 60 -i "$URL" -c copy -f null - > "$S/out/pull-$n.log" 2>&1
  rc=$?; t1=$(date +%s.%N)
  wall=$(awk -v a="$t0" -v b="$t1" 'BEGIN {printf "%.1f", b - a}')
  pull_summary "cycle $n" "$S/out/pull-$n.log" "$rc" "$wall"
  [ "$rc" = 0 ] || { tail -5 "$S/out/pull-$n.log" >> "$LOG"; fail "cycle $n: pull exited $rc"; }
  wait_stop "cycle $n" "$since" "$t1"
  bash "$S/measure.sh" "$C" "b-cycle-$n" "$M"; say "cycle $n: measured"
done
say "12 CYCLES DONE"

# ---- (c) one 10-minute pull, measured once a minute ---------------------------
idle_or_fail "10-minute pull"
since=$(date -u +%FT%TZ)
say "10-minute pull: tune start"
cold_tune "10-minute pull"
t0=$(date +%s.%N); t0s=$(date +%s)
timeout 700 ffmpeg -hide_banner -nostdin -loglevel info -nostats -t 600 -i "$URL" -c copy -f null - > "$S/out/pull-10min.log" 2>&1 &
PULL=$!
for m in $(seq 1 10); do
  target=$((t0s + m * 60 - 3))          # a point takes about 3 s; the last one must land inside the pull
  now=$(date +%s); [ "$target" -gt "$now" ] && sleep $((target - now))
  kill -0 "$PULL" 2>/dev/null || say "10-minute pull: minute $m: the pull has already ended"
  bash "$S/measure.sh" "$C" "c-minute-$(printf '%02d' "$m")" "$M"; say "10-minute pull: minute $m measured"
done
wait "$PULL"; rc=$?; t1=$(date +%s.%N)
wall=$(awk -v a="$t0" -v b="$t1" 'BEGIN {printf "%.1f", b - a}')
pull_summary "10-minute pull" "$S/out/pull-10min.log" "$rc" "$wall"
[ "$rc" = 0 ] || { tail -5 "$S/out/pull-10min.log" >> "$LOG"; fail "10-minute pull exited $rc"; }
wait_stop "10-minute pull" "$since" "$t1"
bash "$S/measure.sh" "$C" "c-after-stop" "$M"; say "10-minute pull: measured after the stop"

# ---- one 30 s pull, saved, for ffprobe ------------------------------------------
idle_or_fail "30 s pull"
since=$(date -u +%FT%TZ)
say "30 s pull: tune start"
cold_tune "30 s pull"
t0=$(date +%s.%N)
timeout 80 ffmpeg -hide_banner -nostdin -loglevel info -nostats -y -t 30 -i "$URL" -c copy "$S/out/pull-30s.mp4" > "$S/out/pull-30s.log" 2>&1
rc=$?; t1=$(date +%s.%N)
wall=$(awk -v a="$t0" -v b="$t1" 'BEGIN {printf "%.1f", b - a}')
pull_summary "30 s pull" "$S/out/pull-30s.log" "$rc" "$wall"
[ "$rc" = 0 ] || { tail -5 "$S/out/pull-30s.log" >> "$LOG"; fail "30 s pull exited $rc"; }
wait_stop "30 s pull" "$since" "$t1"
bash "$S/measure.sh" "$C" "d-after-30s-pull" "$M"; say "30 s pull: measured after the stop"
say "gc warning lines in the container log: $(docker logs "$C" 2>&1 | grep -c '\[gc\] WARNING')"
say "STEP 4 RUN DONE"
````


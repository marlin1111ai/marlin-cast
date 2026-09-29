# Recon — Chrome memory across tunes (2026-09-28) — closed at 12 of 20 cycles (D032)

Date: measurement 2026-09-28, 19:10–20:00 EDT (23:10–00:00Z); clean-up and
close-out 2026-09-28, 20:10 EDT (2026-09-29 00:10Z). Host: marlinpc. Image
`ghcr.io/marlin1111ai/marlin-cast:sha-c876a3a`, run as container
`marlin-cast-recon` on a working copy of the two-provider backup. Nothing on
192.168.1.250 or 192.168.1.30 was contacted. No owner Chrome was running on
marlinpc (0 chrome processes, nothing on 9333/8804/8091/8092 before the run).
`data/chrome-profile` was not read. `backups/` was read once with `tar -xzf`.
No file under `src/`, `extension/`, `docker/`, `scripts/` or `Dockerfile` was
changed; no code change, no fix, no dependency. No credentials, cookies,
tokens, session ids or account identifiers appear in this report;
`VNC_PASSWORD` was a throwaway passed by `--env-file` from a 0600 scratch file.

**Result: closed at 12 of 20 cycles, recorded as it stands (D032,
owner-ruled).** Points (a) and (b) and cycles 1–12 were measured. The tune for
cycle 13 failed (`player ready: not satisfied within 30000ms`, HTTP 503); the
pass stopped there under the brief's on-failure rule — state snapshotted,
diagnosed read-only, no retry. The owner's calls on the stopped pass:

- **1a** — the cycle-13 stall is closed, not pursued; reopen if seen on Unraid.
- **2a** — the measurement stops at 12 cycles and the result is recorded as it
  stands.

Cycles 13–20 were never run. The clean-up was done in a close-out pass and is
recorded under "Clean-up". No measurement in this report was changed by the
close-out.

**What the 12 cycles show:**

- **The browser process (pid 30, the `chrome` with no `--type`) grows in step
  with tunes, not with time.** Its RSS was 348,836 kB at startup and
  349,276 kB after 15 minutes idle (RssAnon 89,056 → 88,996 kB). Each tune
  then added 26,780–29,960 kB of RssAnon. After cycle 6 it read 530,028 kB;
  between cycles 6 and 7 it fell by 143,172 kB to 386,856 kB (the level after
  cycle 1), then climbed again at the same rate to 527,096 kB after cycle 12.
- The per-tune step is the size of one tune's recording: ffmpeg's read
  position at each stop was 27,872,779–29,861,723 bytes.
- **The YouTube TV tab's renderer (pid 192) stepped up after the first tune
  and then stayed in a band.** 452,492 kB idle → 506,428–649,196 kB across the
  12 parked measurements, with no upward trend (612,296 after cycle 1,
  634,492 after cycle 12).
- **Container memory (`docker stats`)**: 704.8 MiB at startup, 723.7 MiB after
  15 minutes idle, 903.2 MiB–1.154 GiB across cycles 1–12, following the
  browser process's sawtooth.

---

## Result per step

The measurement pass (its brief's steps 1–8):

| Step | Result |
|---|---|
| 1 DECISIONS.md | done — note appended under D030 |
| 2 recon | done — (a) and (b) below |
| 3 reproduce | done — image pulled, working copy extracted, container up with the brief's run line, both providers signed in |
| 4 measure | (a), (b), cycles 1–12 measured; cycle 13's tune failed; cycles 13–20 not run — closed at 12 by D032 |
| 5 clean up | not run in that pass; done in the close-out pass |
| 6 this report | written |
| 7 SESSION-STATE | entry written |
| 8 commit and push | not run in that pass; done in the close-out pass |

The close-out pass (its brief's steps 1–7):

| Step | Result |
|---|---|
| 1 container | stopped and removed; `docker ps -a` lists nothing |
| 2 working copy and scratchpad | deleted; the scratchpad is empty |
| 3 image | removed; no Marlin Cast image is left |
| 4 backup hash | unchanged |
| 5 DECISIONS.md | D032 appended |
| 6 report and SESSION-STATE | status and open questions replaced with the owner's calls; clean-up recorded |
| 7 commit and push | the three notebook files, one commit on main (SHA in `git log` and the hand-off) |

## Files touched, mapped to steps

| File | Measurement pass | Close-out pass | Change |
|---|---|---|---|
| `notebook/DECISIONS.md` | 1 | 5 | note under D030; D032 — both dated 2026-09-28, owner-ruled |
| `notebook/reports/recon-chrome-memory.md` | 6 | 6 | this report; status, owner's calls and clean-up |
| `notebook/SESSION-STATE.md` | 7 | 6 | entry appended at the end; status, owner's calls and clean-up |

Nothing else in the repo.

---

## Step 2(a) — the capture tab at tune, at stop and at park; ffmpeg's input

Traced from the code at c876a3a (the image under test). Nothing here was run.

**One tab per provider, for the life of Chrome.** The entrypoint starts Chrome
through `scripts/start-chrome.sh` with two start URLs
(`docker/entrypoint.sh:165`, `scripts/start-chrome.sh:72-79`). The app never
creates, closes or reloads a tab: a search of `src/` and `extension/` for
`detachFromTarget|closeTarget|createTarget|closeDocument|Page.reload` returns
nothing. Every tune, stop and park below happens in the same YouTube TV tab
and therefore the same renderer process.

**Tune.**

| file:line | what happens |
|---|---|
| `src/server.ts:190-195` | `GET /stream/:key/index.m3u8` calls `pipeline.ensure(channel)` |
| `src/capture.ts:203-212` | `ensure` starts a tune unless this channel is already live |
| `src/capture.ts:215` | a live tune on another channel is stopped first (no park) |
| `src/capture.ts:221-222` | the channel's HLS directory is wiped and recreated |
| `src/capture.ts:225`, `121-132`; `src/cdp.ts:109-123` | the tab is the page target whose URL host is the provider's (D018); a CDP session is attached once per page target and reused (`capture.ts:123-130`) |
| `src/capture.ts:227` | `Target.activateTarget` brings the tab to the front |
| `src/capture.ts:255`; `src/providers/youtubetv.ts:236-263`, `191-205` | `Page.navigate` to `https://tv.youtube.com/<watch href>` in that tab (`youtubetv.ts:193`), then poll 1 |
| `src/capture.ts:260-262`, `266-269` | `Emulation.setDeviceMetricsOverride` to 1920×1080, then poll 2 |
| `src/capture.ts:272`; `youtubetv.ts:265-275` | poll 3, "player ready": `videoWidth > 0 && !paused && readyState >= 2`, 30 s timeout |
| `src/capture.ts:275`; `youtubetv.ts:277-326` | poll 4, quality pin (`setPlaybackQualityRange` at `youtubetv.ts:307`) |
| `src/capture.ts:285-337` | ffmpeg is spawned (`-i pipe:0` at line 291; `stdio: ["pipe", "ignore", "pipe"]` at 337) |
| `src/capture.ts:348-352` | `this.live` is set — only here, after the polls and the spawn |
| `src/capture.ts:355`, `145-162` | `swSession`: finds the extension's service worker and **attaches a new CDP session to it on every call** (`capture.ts:150`); nothing detaches it |
| `src/capture.ts:356-371` | the tab is activated again; `self.mcStart(opts)` is evaluated in the worker; if that does not record, the extension is armed and `Extensions.triggerAction` invoked on the tab target |
| `extension/background.js:38-59` | `mcStart`: `chrome.tabCapture.getMediaStreamId` (line 42), `ensureOffscreen` (line 43; `17-27` creates the offscreen document only if none exists), message to the offscreen document |
| `extension/offscreen.js:32-83` | `getUserMedia` on the tab stream (43-46); a new `AudioContext` wired to the output (50-51); `new MediaRecorder(stream)` with no mime type requested (55); `recorder.start(timeslice)` (78) |
| `extension/offscreen.js:56-75` | each timeslice (`e.data`, a Blob) is POSTed in order to the ingest URL with `fetch` (65-69) |
| `src/server.ts:71-74`; `src/capture.ts:375-382` | `POST /ingest/:key/:token` hands the body to `ingest()`, which writes it to `ffmpeg.stdin` (`capture.ts:380`) |

**What ffmpeg reads as its input:** its own stdin (`-i pipe:0`,
`src/capture.ts:291`). The bytes are MediaRecorder's WebM timeslices of the
tab-capture stream, cut every `TIMESLICE_MS` = 1000 ms (`capture.ts:28`, `360`),
POSTed by the extension's offscreen document to `127.0.0.1:8804/ingest/…`
(`capture.ts:359`) and written to the pipe by the app. ffmpeg reads no file,
no URL and no display. The run confirms the demuxer: ffmpeg's stop line names
`[matroska,webm @ …]`.

**Stop (idle).**

| file:line | what happens |
|---|---|
| `src/capture.ts:115`, `193-199`, `31` | a watchdog runs every 2000 ms; when no playlist or segment request has touched the channel for `IDLE_MS` = 20000 ms it calls `stop(reason, { returnToGuide: true })` |
| `src/server.ts:205`, `224`; `src/capture.ts:187-189` | what counts as a touch |
| `src/capture.ts:391-392` | `self.mcStop({})` in the service worker, through another new `swSession` |
| `extension/background.js:61-83`; `extension/offscreen.js:85-120` | the recorder is stopped (118), the stream's tracks stopped (91), the `AudioContext` closed (92), the send chain awaited (95). **The offscreen document stays open** — nothing closes it |
| `src/capture.ts:395-400` | `ffmpeg.stdin.end()`, then SIGTERM, SIGKILL after 4000 ms |
| `src/capture.ts:402-404` | `Emulation.clearDeviceMetricsOverride`, the HLS directory removed, `this.live = null` |

`stop()` has four callers: the idle watchdog (`capture.ts:197`), a channel
switch (`215`), ffmpeg exiting (`345`) and shutdown (`422`). Only the idle
watchdog parks.

**Park.** `Page.navigate` to `provider.parkUrl` on the same session
(`src/capture.ts:412-417`); for YouTube TV that is
`https://tv.youtube.com/live` (`src/providers/youtubetv.ts:15`, `213`). The tab
is not closed and the renderer is not replaced; the next tune navigates the
same tab again.

**A failed tune does not stop or park.** If poll 3 or 4 throws, `start()`
exits before `this.live` is set (`capture.ts:272-275` precede `348`), so
`stop()` has nothing to stop (`capture.ts:385-386`): the tab stays on the
watch URL, the device-metrics override stays on, the HLS directory created at
`capture.ts:222` stays, and the server answers 503 (`server.ts:196-199`). This
is what cycle 13 left behind (failure snapshot: tab on
`/watch/jhOr9QgdOqQ`, viewport 1920x1080, 1 HLS directory).

## Step 2(b) — notebook passages about Chrome memory, RSS, or the parked guide

Found by `grep -n -i` over `MARLIN-CAST-BRIEF.md`, `notebook/*.md` and
`notebook/reports/*.md` for
`RSS|memory|mem|OOM|leak|heap|swap|low on|MiB|GiB|/dev/shm|shm-size|resident`
and for `park|returnToGuide|live guide|idle guide|movie_player|autoplay|preview`,
then read. DECISIONS.md line numbers are as of this pass (after the step-1
note).

**Chrome's own memory or RSS, or the container's memory: none.** No passage in
the notebook records the RSS or memory of a Chrome process, of the app, or of a
container. Every memory passage is one of the three kinds below.

**Host memory on marlinpc (another process's RSS, the builder's memory guard):**

- `notebook/reports/recon-stable-ids.md:42-46` — after Chrome was found gone:
  no kernel OOM lines, oomd inactive, memory pressure 0, 5966 MB available,
  largest process `python` RSS 50,898,192 kB. `:53-55`, `:336-338` — cause of
  exit not determined.
- `notebook/reports/task-021.md:644-649` — a 51.9 GB RSS `python` process; the
  harness killed three background tasks, one the shell that had launched the
  owner's Chrome. `:688-692` — why.
- `notebook/reports/task-023.md:180-181`, `187`, `191-193`;
  `notebook/SESSION-STATE.md:1121-1123` — the harness stopped the dev server's
  background task "because the system is running low on memory".
- `notebook/reports/recon-docker.md:65`, `639-642` — 5 GB available; a
  container survives the builder's memory guard.
- `notebook/reports/fios-splash.md:24` — 5.4 GB available of 64 GB.
- `MARLIN-CAST-BRIEF.md:75`; `notebook/DECISIONS.md:636-637` — Chrome died
  twice while a ~51 GB Python process ran; closed by D030.

**`/dev/shm` / `--shm-size=1g`:**

- `notebook/DECISIONS.md:386`, `393-394` (D024 item 8), `448` (D026).
- `notebook/KNOWN-FIXES.md:647-650`.
- `MARLIN-CAST-BRIEF.md:31`, `60`, `80` (QNAP: `/dev/shm` reads 1.0G).
- `notebook/SESSION-STATE.md:23-24`, `30`, `1137`.
- `notebook/reports/recon-docker.md:523-525`, `596`, `766`.
- Run lines and notes: `notebook/reports/task-024.md:16`, `63`, `103`, `112`;
  `task-026.md:48`; `task-027.md:74`; `task-028.md:19`, `69`.

**The parked guide:**

- `notebook/reports/task-018.md` — the whole report. Tab state after the park
  at `:60-91` (paused, readyState 0, 0x0). `:135-140` — the guide keeps
  `#movie_player` mounted, "the tab is not completely inert". `:144-149` — a
  preview auto-starting after a longer dwell was not ruled out. `:159` — closed
  by D030.
- `notebook/DECISIONS.md:627-628` — D030 closes "the parked guide keeps
  `#movie_player` mounted; a longer-dwell check".
- `MARLIN-CAST-BRIEF.md:44` — "Parking on the guide leaves a paused 0×0
  `#movie_player`"; `:55` — Philo's idle guide, no autoplay after 60 s.
- `notebook/SESSION-STATE.md:856-884` (task 018), `910-911`, `939-940`,
  `1003-1004`, `1164`.
- `notebook/reports/task-019.md:9-10`, `128-129`; `task-021.md:421-429`,
  `636-637`; `task-022.md:177`, `276`, `365`; `task-023.md:159-160`, `184-185`;
  `task-024.md:244-247`.
- Philo's guide: `notebook/reports/recon-philo.md:89-95`, `349-360`, `395`,
  `434-437` (no `<video>` at all on Philo's guide).

Matched the search but are about something else, listed so the search can be
re-run: `task-006-capture-spike.md:337`, `461`; `task-007-gpu-drm-capture.md:233`;
`recon-docker.md:152`, `755`; `task-021.md:143`, `560`.

---

## Step 3 — the reproduction

```
docker pull ghcr.io/marlin1111ai/marlin-cast:sha-c876a3a
  Digest: sha256:9e41035c7f7ccdefdfebe0b55e2fc536a60e0ca1cd84d61cf48ad9bca28fb26a   (2.25GB as listed by docker images)

backups/chrome-profile-2providers-20260913-0746.tgz   1,245,011,110 bytes
  sha256 before: 6ebd9ea976118bcb8c24e10b590680e5d44e405d1b3a9f7f09a0a3982258dbe3
tar -xzf … -C <scratchpad>/data      -> data/chrome-profile, 54,447 files, 1.7G (du -sh)

docker run -d --name marlin-cast-recon --cap-add SYS_ADMIN --shm-size=1g \
  -p 8091:8804 -p 8092:6080 -v <scratchpad>/data:/data \
  --env-file <scratchpad>/run.env -e PUID=99 -e PGID=100 \
  ghcr.io/marlin1111ai/marlin-cast:sha-c876a3a
```

`run.env` holds one line, `VNC_PASSWORD=<10 random characters>`, mode 0600. No
size env was set. Started 23:12:25Z; stage 7 ready by 23:12:50Z.

```
[entrypoint] re-owning /data to 99:100 (was 1000:1000)
[entrypoint] user marlin (99:100); profile /data/chrome-profile; hls /tmp/marlin-cast/hls; display :99 1920x1080x24
[entrypoint] no stale profile locks
[entrypoint] stage 2 ready: Xvfb :99 1920x1080x24 (pid 26)
[entrypoint] stage 3 ready: Chrome/153.0.8010.36 on 127.0.0.1:9333 (loopback), tabs: tv.youtube.com, www.philo.com
[entrypoint] chrome stderr: 0 Fontconfig lines
[entrypoint] stage 4 ready: noVNC on 0.0.0.0:6080 -> x11vnc 127.0.0.1:5900 (password required)
[login] youtubetv: tv.youtube.com: signed in
[login] philo: www.philo.com: signed in (https://www.philo.com/player/mytv)
[entrypoint] stage 5: every provider signed in
[entrypoint] stage 6: no /data/channels.json — first boot, enumerating the lineup
[channels] [youtubetv] guide rows 144, tiles 142, channels 141, skipped 3
[channels] [philo] 234 channels, totalCount 234, tiers {"Favorite channels":2,"All channels":74,"Free channels":158}
[channels] enumerated 375 channels at 2026-09-28T23:12:47.198Z
[entrypoint] stage 7 ready: app on 0.0.0.0:8804 (pid 486); channels: 375 state: idle
```

**Both providers signed in.** 375 channels (YouTube TV 141, Philo 234). WBAL 11
is key `UCZmySpv9dwlwsU2ZxS0pipQ`
(`http://127.0.0.1:8091/stream/UCZmySpv9dwlwsU2ZxS0pipQ/index.m3u8`, read from
`/playlist`).

---

## Step 4 — method

Each point runs, in this order (scripts in Appendix B):

1. `docker stats --no-stream` for the container.
2. `/sys/fs/cgroup/memory.current` and `memory.stat` inside the container.
3. `ps -eo pid,ppid,rss,comm` inside the container, with `RssAnon`, `RssFile`,
   `RssShmem` from `/proc/<pid>/status` and `--type` from
   `/proc/<pid>/cmdline`, for every process.
4. The renderer-to-tab mapping, by a Node script run inside the container
   against `127.0.0.1:9333`.

The mapping's own process and probes run after 1–3, so they are not in that
point's memory figures.

**How a renderer is mapped to a tab.** Two independent traces per CDP target,
which agreed at every point:

- **requestId.** The script attaches to the target, enables `Network`, and
  evaluates `fetch("data:text/plain,<marker>")` in it. Chrome names a
  renderer-issued request `<pid>.<n>`; the prefix is the renderer's pid. No
  network traffic results.
- **CPU burn.** A 400 ms busy loop is evaluated in the target, and the process
  whose `SystemInfo.getProcessInfo` `cpuTime` rose most across it is named,
  with the rise in seconds.

**Cycle.** `ffmpeg -t 60 -i <WBAL 11 URL> -c copy -f null -` on marlinpc (one
cold request, then 60 s of media, no output file); then wait for both
`[stop] WBAL 11: idle` and `[stop] parked the youtubetv tab` in `docker logs`;
then **10 s** for the guide to load; then the point. One tune at a time; the
script checks `state: idle` before each tune.

Beyond what the brief asks, each point also records the V8 heap
(`Runtime.getHeapUsage`) and DOM counters (`Memory.getDOMCounters`) of every
target. These were added after point (a), so (a) has none.

**The measurement touches the pages.** At each point every page gets one
`data:` fetch, one 400 ms busy loop and two read-only CDP queries. In Chrome's
own omnibox pages the fetch is refused by their Content Security Policy and
logs two console errors per page per point into `chrome.log`.

## Step 4 — which renderer serves which tab

The mapping was the same at every point where the process existed (Appendix A
has each point's lines).

| pid | `--type` | serves | traced by |
|---|---|---|---|
| 192 | renderer | **the YouTube TV tab** (`tv.youtube.com/live` when parked) and YouTube TV's service worker (`tv.youtube.com/sw.js`) | requestId and CPU burn, both targets |
| 181 | renderer | the Philo tab (`www.philo.com/player/guide`) | requestId and CPU burn |
| 172 | renderer | Chrome's own omnibox pages (`chrome://omnibox-popup.top-chrome/`, two `browser_ui` targets) — no tab | CPU burn only; the `data:` fetch is refused there |
| 10157 | renderer (`--extension-process`) | the capture extension's service worker and its offscreen document — first seen after cycle 1 | requestId and CPU burn, both targets |
| 282, then 10167 | renderer | **could not be mapped to a tab.** No CDP target resolved to it at any point. Traced: every target from `Target.getTargets` with `filter: [{}]` was probed both ways and none landed on it; its command line carries no `--extension-process`. 282 was present at (a) and (b), gone after cycle 1, when 10167 appeared. What it is was not determined |

Processes with no renderer role: browser 30, GPU 74, network service 76,
storage service 82, audio service 338, three zygotes 51/52/54, two crashpad
handlers 43/45; from cycle 1 on, a passage-embeddings utility 10129 and its
broker 10130; at the failure snapshot only, a CDM (Widevine) utility 29780.

## Step 4 — measurements

All RSS figures are kB as printed by `ps`; `docker stats` as printed. UTC is
2026-09-28. "unmapped" is the renderer that served no target. Every figure is
copied by script from the raw output in Appendix A.

**Table 1 — container memory and RSS per Chrome process**

| point | UTC | docker stats | browser 30 | YouTube TV renderer 192 | Philo renderer 181 | omnibox renderer 172 | extension renderer | unmapped renderer | GPU 74 | network 76 | storage 82 | audio 338 | passage embeddings | chrome processes | sum of their RSS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| a-startup-idle | 23:15:24 | 704.8MiB | 348836 | 456956 | 200088 | 145560 | – | 82008 (282) | 202676 | 141120 | 58948 | 87808 | – | 14 | 1889240 |
| b-15min-idle | 23:30:24 | 723.7MiB | 349276 | 452492 | 207252 | 149576 | – | 83528 (282) | 203308 | 142052 | 60232 | 88824 | – | 14 | 1901780 |
| c-cycle-01 | 23:32:20 | 975.6MiB | 387324 | 612296 | 206960 | 151376 | 142532 (10157) | 81920 (10167) | 204000 | 142240 | 60260 | 95324 | 105892 (10129) | 17 | 2376240 |
| c-cycle-02 | 23:34:14 | 911.9MiB | 415856 | 506428 | 219632 | 151884 | 150564 (10157) | 81920 (10167) | 205064 | 142372 | 60284 | 95388 | 105876 (10129) | 17 | 2321384 |
| c-cycle-03 | 23:36:06 | 1.043GiB | 445556 | 634052 | 213928 | 152456 | 153944 (10157) | 83408 (10167) | 205708 | 142432 | 60284 | 95392 | 112780 (10129) | 17 | 2486056 |
| c-cycle-04 | 23:38:01 | 1.089GiB | 472900 | 641792 | 214992 | 153000 | 157440 (10157) | 83408 (10167) | 205496 | 142708 | 60296 | 95380 | 107060 (10129) | 17 | 2520588 |
| c-cycle-05 | 23:39:57 | 1.092GiB | 502432 | 636840 | 203392 | 153680 | 160136 (10157) | 83408 (10167) | 205244 | 142440 | 60348 | 95420 | 112784 (10129) | 17 | 2542240 |
| c-cycle-06 | 23:41:52 | 1.147GiB | 530028 | 649196 | 203288 | 154148 | 162556 (10157) | 83408 (10167) | 205764 | 142520 | 60352 | 95416 | 107048 (10129) | 17 | 2579840 |
| c-cycle-07 | 23:43:46 | 903.2MiB | 386856 | 520888 | 203460 | 154884 | 157848 (10157) | 83424 (10167) | 205180 | 142396 | 60348 | 95416 | 112780 (10129) | 17 | 2309596 |
| c-cycle-08 | 23:45:40 | 923.7MiB | 412912 | 510844 | 203412 | 155720 | 159676 (10157) | 83424 (10167) | 205436 | 142548 | 60356 | 95412 | 113020 (10129) | 17 | 2328876 |
| c-cycle-09 | 23:47:34 | 1.043GiB | 441676 | 627196 | 205096 | 156264 | 160360 (10157) | 83424 (10167) | 205452 | 142324 | 60344 | 95400 | 107056 (10129) | 17 | 2470708 |
| c-cycle-10 | 23:49:29 | 1.09GiB | 469712 | 641420 | 205160 | 156932 | 162356 (10157) | 83424 (10167) | 205068 | 142644 | 60368 | 95404 | 107044 (10129) | 17 | 2515648 |
| c-cycle-11 | 23:51:23 | 1.107GiB | 497136 | 631912 | 205700 | 157600 | 164836 (10157) | 83424 (10167) | 205564 | 142420 | 60356 | 95404 | 107044 (10129) | 17 | 2537512 |
| c-cycle-12 | 23:53:17 | 1.154GiB | 527096 | 634492 | 218252 | 158136 | 166668 (10157) | 83424 (10167) | 205472 | 142392 | 60360 | 95408 | 107040 (10129) | 17 | 2584856 |
| failure-snapshot | 23:54:06 | 1.077GiB | 527140 | 477808 | 220580 | 158404 | 166812 (10157) | 83424 (10167) | 191584 | 142292 | 60376 | 95372 | 109016 (10129) | 18 | 2558604 |

"chrome processes" counts every process whose name starts with `chrome`
(crashpad handlers, zygotes and the broker included); the columns not shown
individually are in Appendix A. The sum counts shared pages once per process
that maps them, so it is larger than the container's memory.

**Table 2 — where the RSS sits, and the YouTube TV page's own counters**

| point | browser 30 RssAnon | RssFile | RssShmem | renderer 192 RssAnon | RssFile | RssShmem | extension renderer RssAnon | YouTube TV tab path | page V8 heap | page DOM counters |
|---|---|---|---|---|---|---|---|---|---|---|
| a-startup-idle | 89056 | 255928 | 3852 | 285256 | 153432 | 17628 | – | /live | not recorded | not recorded |
| b-15min-idle | 88996 | 256428 | 3852 | 283216 | 153576 | 15876 | – | /live | jsHeapUsed=66176kB jsHeapTotal=76440kB | documents=6 nodes=103666 listeners=17229 |
| c-cycle-01 | 118492 | 264576 | 4256 | 438592 | 157336 | 16712 | 31208 | /live | jsHeapUsed=139211kB jsHeapTotal=191644kB | documents=12 nodes=160383 listeners=18941 |
| c-cycle-02 | 147024 | 264576 | 4256 | 328700 | 157516 | 19396 | 33352 | /live | jsHeapUsed=103951kB jsHeapTotal=137360kB | documents=6 nodes=110922 listeners=18843 |
| c-cycle-03 | 176660 | 264640 | 4256 | 456344 | 157628 | 20356 | 36024 | /live | jsHeapUsed=152807kB jsHeapTotal=205724kB | documents=12 nodes=159556 listeners=18897 |
| c-cycle-04 | 204004 | 264640 | 4256 | 464520 | 157628 | 18908 | 39052 | /live | jsHeapUsed=157905kB jsHeapTotal=207260kB | documents=12 nodes=159549 listeners=18895 |
| c-cycle-05 | 233536 | 264640 | 4256 | 459500 | 157708 | 18712 | 41300 | /live | jsHeapUsed=104491kB jsHeapTotal=134032kB | documents=6 nodes=110776 listeners=18803 |
| c-cycle-06 | 261132 | 264640 | 4256 | 472664 | 157708 | 19080 | 43716 | /live | jsHeapUsed=149603kB jsHeapTotal=208028kB | documents=12 nodes=161111 listeners=18899 |
| c-cycle-07 | 117960 | 264640 | 4256 | 344752 | 157756 | 18340 | 35584 | /live | jsHeapUsed=104708kB jsHeapTotal=133520kB | documents=6 nodes=110630 listeners=18763 |
| c-cycle-08 | 145608 | 263048 | 4256 | 335140 | 157820 | 19468 | 37412 | /live | jsHeapUsed=104098kB jsHeapTotal=110992kB | documents=6 nodes=110196 listeners=18704 |
| c-cycle-09 | 172388 | 265032 | 4256 | 452388 | 157820 | 17060 | 38016 | /live | jsHeapUsed=148167kB jsHeapTotal=211100kB | documents=12 nodes=159401 listeners=18794 |
| c-cycle-10 | 200424 | 265032 | 4256 | 465428 | 157820 | 18328 | 39984 | /live | jsHeapUsed=148161kB jsHeapTotal=210076kB | documents=12 nodes=160097 listeners=18766 |
| c-cycle-11 | 227836 | 265044 | 4256 | 455972 | 157820 | 19728 | 42464 | /live | jsHeapUsed=104997kB jsHeapTotal=132496kB | documents=6 nodes=110069 listeners=18676 |
| c-cycle-12 | 257796 | 265044 | 4256 | 458608 | 157820 | 19600 | 44296 | /live | jsHeapUsed=152617kB jsHeapTotal=212892kB | documents=12 nodes=159568 listeners=18736 |
| failure-snapshot | 257704 | 265044 | 4392 | 315652 | 157820 | 4440 | 44440 | /watch/jhOr9QgdOqQ | jsHeapUsed=97180kB jsHeapTotal=102156kB | documents=6 nodes=48806 listeners=6363 |

**Table 3 — the cycles**

| cycle | pull exit | wall | ffmpeg's last line | media copied | segments opened | idle stop + park seen after the pull ended (s) |
|---|---|---|---|---|---|---|
| 01 | 0 | 67.2s | size=N/A time=00:00:59.98 bitrate=N/A speed=0.992x | video:43911kB audio:940kB | 61 | 22.2 |
| 02 | 0 | 64.8s | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x | video:43945kB audio:941kB | 61 | 22.3 |
| 03 | 0 | 64.8s | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x | video:44389kB audio:939kB | 61 | 20.2 |
| 04 | 0 | 64.9s | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x | video:44603kB audio:936kB | 61 | 22.2 |
| 05 | 0 | 66.7s | size=N/A time=00:00:59.98 bitrate=N/A speed= 1x | video:44035kB audio:947kB | 61 | 22.3 |
| 06 | 0 | 64.9s | size=N/A time=00:00:59.98 bitrate=N/A speed=0.992x | video:44183kB audio:939kB | 61 | 22.2 |
| 07 | 0 | 64.8s | size=N/A time=00:00:59.98 bitrate=N/A speed=0.994x | video:43083kB audio:940kB | 61 | 22.2 |
| 08 | 0 | 64.9s | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x | video:44535kB audio:937kB | 61 | 22.2 |
| 09 | 0 | 64.0s | size=N/A time=00:00:59.99 bitrate=N/A speed= 1x | video:43657kB audio:941kB | 61 | 22.3 |
| 10 | 0 | 65.1s | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x | video:44404kB audio:957kB | 61 | 22.2 |
| 11 | 0 | 64.7s | size=N/A time=00:00:59.99 bitrate=N/A speed=0.993x | video:43964kB audio:955kB | 61 | 22.2 |
| 12 | 0 | 64.9s | size=N/A time=00:00:59.98 bitrate=N/A speed=0.993x | video:44586kB audio:951kB | 61 | 22.3 |
| 13 | 8 | 30.7s | – (HTTP 503) | – | 0 | – (no stop, no park) |

Every one of the 12 tunes logged `target hd1080, quality hd1080, video
1920x1080, box 1920x1080, viewport 1920x1080` and a 1920×1080 30 fps capture.
`tune-ms` "playing" ran 1614–2143 ms, with one at 4219 ms (cycle 5).

Counts in the container's log at the stop, re-checked by hand against
Appendix C: `[tune]` starts 13; idle stops 12; parks 12; `[ffmpeg] exited
code=255` 12; `File ended prematurely` 8 (cycles 1–7 and 12; cycles 8–11 logged
the exit line alone); `[serve] Error` 1. Measurement points in Appendix A: 15
(a, b, 12 cycles, the failure snapshot).

---

## Which process grew, by how much, and in step with what

### The browser process (pid 30) — grows with tunes; released once

RSS and RssAnon of pid 30 between consecutive points:

```
a-startup-idle -> b-15min-idle : RSS +440 kB, RssAnon -60 kB
b-15min-idle -> c-cycle-01 : RSS +38048 kB, RssAnon +29496 kB
c-cycle-01 -> c-cycle-02 : RSS +28532 kB, RssAnon +28532 kB
c-cycle-02 -> c-cycle-03 : RSS +29700 kB, RssAnon +29636 kB
c-cycle-03 -> c-cycle-04 : RSS +27344 kB, RssAnon +27344 kB
c-cycle-04 -> c-cycle-05 : RSS +29532 kB, RssAnon +29532 kB
c-cycle-05 -> c-cycle-06 : RSS +27596 kB, RssAnon +27596 kB
c-cycle-06 -> c-cycle-07 : RSS -143172 kB, RssAnon -143172 kB
c-cycle-07 -> c-cycle-08 : RSS +26056 kB, RssAnon +27648 kB
c-cycle-08 -> c-cycle-09 : RSS +28764 kB, RssAnon +26780 kB
c-cycle-09 -> c-cycle-10 : RSS +28036 kB, RssAnon +28036 kB
c-cycle-10 -> c-cycle-11 : RSS +27424 kB, RssAnon +27412 kB
c-cycle-11 -> c-cycle-12 : RSS +29960 kB, RssAnon +29960 kB
c-cycle-12 -> failure-snapshot : RSS +44 kB, RssAnon -92 kB
```

- **Tunes, not time.** 15 minutes idle: RssAnon −60 kB. Each ~115 s cycle:
  +26,780 to +29,960 kB. The failed tune, which never recorded: −92 kB.
- **It is anonymous memory.** RssFile moved 255,928 → 265,044 kB over the whole
  run and RssShmem 3,852 → 4,392 kB; the growth is all in RssAnon.
- **The step matches one tune's recording.** ffmpeg's read position at the
  stop (Appendix C): 28,109,714; 28,075,860; 27,902,396; 27,872,779;
  28,037,095; 28,277,165; 29,861,723 (cycles 1–7) and 29,645,339 (cycle 12)
  bytes.
- **It was released once, in one step.** Between the cycle-6 and cycle-7 points
  RssAnon fell 143,172 kB, to 117,960 kB — the cycle-1 level (118,492), not the
  idle level (88,996). In the same interval the extension renderer's RssAnon
  fell from 43,716 to 35,584 kB, its only fall in the run.
- **Range over cycles 1–12:** RSS 386,856–530,028 kB against 349,276 idle.
  Highest minus idle: 180,752 kB.

**Inference, not measured:** the recorded timeslices are Blobs
(`extension/offscreen.js:56-69`), and Chrome keeps Blob bytes in the browser
process until the page that made them lets go, which happens when that page's
JavaScript garbage collector runs. That would explain a per-tune step the size
of the recording, held after the stop, and freed together when the extension's
renderer collected. Nothing in this run looked inside the browser process, so
what the 27–30 MB per tune actually is was not observed.

### The YouTube TV tab's renderer (pid 192) — stepped up after the first tune, then a band

- Idle: 456,956 (a), 452,492 (b).
- Parked after a tune: 506,428–649,196 kB across 12 points. Against (b):
  +53,936 at the lowest (cycle 2), +196,704 at the highest (cycle 6).
- No trend across the 12: 612,296 after cycle 1, 634,492 after cycle 12.
- It sits in one of two states when measured 10 s after the park, and Table 2
  shows them: `documents=12, nodes ≈160,000, jsHeapUsed ≈139,000–158,000 kB`
  (cycles 1, 3, 4, 6, 9, 10, 12; RSS 612,296–649,196) or `documents=6, nodes
  ≈110,000, jsHeapUsed ≈104,000–105,000 kB` (cycles 2, 5, 7, 8, 11; RSS
  506,428–636,840). Twelve documents is twice the idle guide's six.
- The parked guide after a tune never returned to the never-tuned guide's
  figures: nodes 103,666 and jsHeapUsed 66,176 kB at (b), against at least
  110,069 and 103,951 kB after any tune.
- Tunes or time: the step came with the first tune (idle was flat over 15
  minutes). Beyond that the 12 points show no growth with either.

### Smaller movers

| process | startup (a) | 15 min idle (b) | after cycle 12 | reading |
|---|---|---|---|---|
| extension renderer 10157 | not running | not running | 166,668 (142,532 after cycle 1) | +24,136 kB over 11 cycles; RssAnon rises 604–3,028 kB per cycle and fell once, by 8,132 kB (cycle 6 → 7). Tracks tunes |
| omnibox renderer 172 | 145,560 | 149,576 | 158,136 | rises at every point, idle included (+4,016 over the idle 15 min, +8,560 over cycles 1–12). Its DOM counters read `documents=6` at (b), `42` after cycle 1, `438` at the failure snapshot. The measurement's own probes reach this process; whether they cause the rise was not separated |
| app (node 486) | 86,812 | 89,500 | 116,428 | +26,928 kB by cycle 12; 116,088–116,428 from cycle 9 on |
| audio service 338 | 87,808 | 88,824 | 95,408 | stepped once, at the first tune |
| Philo renderer 181 | 200,088 | 207,252 | 218,252 | 203,288–219,632 with no direction; never tuned |
| GPU 74, network 76, storage 82 | 202,676 / 141,120 / 58,948 | 203,308 / 142,052 / 60,232 | 205,472 / 142,392 / 60,360 | flat |
| unmapped renderer | 82,008 | 83,528 | 83,424 | flat |

New processes after the first tune and present from then on: extension
renderer 10157, passage-embeddings utility 10129 (105,876–113,020 kB) and its
broker 10130 (20,876 kB). Chrome process count 14 → 17.

### The container

`docker stats`: 704.8 MiB (a) → 723.7 MiB (b) → 975.6 MiB after the first tune
→ between 903.2 MiB and 1.154 GiB over cycles 1–12, highest at cycle 12. The
first tune added 251.9 MiB. `/dev/shm` use stayed at 3–4% of 1 GiB
(30,840–39,996 kB). HLS scratch was empty at every parked point.

---

## The failure — cycle 13

**What happened.** 23:53:35Z, state `idle`, tune requested. The app navigated
the tab (the `[tune] WBAL 11 (…)` line is logged) and 30.7 s later answered 503:

```
[app] [serve] Error: player ready: not satisfied within 30000ms — last probe {"ok":false,"w":1920,"h":1080,"paused":false,"readyState":1}
```

```
[http @ …] HTTP error 503 Service Unavailable
Error opening input file http://127.0.0.1:8091/stream/UCZmySpv9dwlwsU2ZxS0pipQ/index.m3u8.
```

Poll 3 needs `readyState >= 2` (`youtubetv.ts:272`); the video element had its
dimensions and was not paused, but never got past `readyState: 1`.

**State snapshot** (the `failure-snapshot` rows above; Appendix A). `/health`:
`state: idle`, `last_error: -`. Container up. No encoder. Tab left on
`/watch/jhOr9QgdOqQ` with the 1920×1080 override on (section 2a).

**Read-only probes of the tab, 23:55:11Z–23:57:50Z** (in-page evaluates and a
15 s network watch on a separate CDP session; no navigation, no click):

```
23:55:11.779Z {"path":"/watch/jhOr9QgdOqQ","visibility":"visible","inner":"1920x1080","videoElements":84,"videosWithSrc":1,"videosPlaying":0,"main":{"paused":false,"readyState":1,"networkState":2,"currentTime":45335.1,"w":1920,"h":1080,"error":null,"buffered":null,"ended":false,"seeking":true},"playerState":-1,"quality":"hd1080","errorOverlay":null,"jsHeap":{"usedMB":134,"totalMB":153,"limitMB":4192}}
23:55:14.800Z … identical but jsHeap usedMB 140, totalMB 158
23:55:17.818Z … identical but jsHeap usedMB 140, totalMB 159
23:57:05.099Z {"path":"/watch/jhOr9QgdOqQ","main":{"paused":false,"readyState":1,"networkState":2,"currentTime":45335.1,"seeking":true,"bufferedRanges":0,"error":null},"playerState":-1,"duration":405367,"playability":{"status":"OK","reason":null},"videoData":{"isLive":true,"isPlayable":true,"errorCode":null},"online":true}
```

```
23:57:50.218Z network events in 15 s on the YouTube TV tab:
   1 FAILED   net::ERR_ABORTED (canceled) tv.youtube.com/api/stats/qoe
   7 request  POST *.googlevideo.com/videoplayback
   1 request  POST tv.youtube.com/api/stats/qoe
   1 request  POST tv.youtube.com/youtubei/v1/check_client_freshness
   1 request  POST tv.youtube.com/youtubei/v1/log_event
   1 request  POST tv.youtube.com/youtubei/v1/player/heartbeat
   7 response 200 *.googlevideo.com/videoplayback
   1 response 200 tv.youtube.com/youtubei/v1/check_client_freshness
   1 response 200 tv.youtube.com/youtubei/v1/log_event
   1 response 200 tv.youtube.com/youtubei/v1/player/heartbeat
   1 response 204 tv.youtube.com/api/stats/qoe
```

**What the evidence says.**

- The player is stuck in a seek: `seeking: true`, `currentTime` fixed at
  45335.1, no buffered range, player state −1, for at least 3 min 30 s after
  the tune began (23:53:35Z → 23:57:05Z).
- YouTube TV did not refuse the stream: playability `OK`, `isPlayable: true`,
  no error on the element, no error overlay, heartbeat 200, and media requests
  to `googlevideo.com` answering 200 at about one every two seconds.
- **It was not memory exhaustion.** Container 1.077 GiB on a host with
  55,593 MB available and no memory limit on the container; page V8 heap
  134–140 MB of a 4,192 MB limit; `/dev/shm` 3%. The renderer was not at a
  high point: 477,808 kB.
- **No Chrome process died.** Pids 30, 74, 76, 82, 172, 181, 192, 338, 10129,
  10157, 10167 are the same before and after. The one new process is the CDM
  utility 29780, which a playing or loading tune is expected to have.
- `chrome.log` shows nothing at 23:53:35–23:54:06 that the 12 good tunes do
  not also show: one `WebGL1 blocklisted` line (27 in the run), the ALSA
  "cannot find card" block, and `gcm … net error: -2` (56 in the run).

**Cause: not determined.** Media arrives and is not played. Whether the fault
is in the player, the CDM, the decoder, or something the measurement probes
did to the page is not known. Nothing was retried.

**Closed by D032 (2026-09-28, owner-ruled):** not pursued; reopen if seen on
Unraid.

---

## Clean-up (close-out pass, 2026-09-29 00:10Z)

`<scratchpad>` is
`/tmp/claude-1000/-Apps-marlin-cast/8b3f200b-47ba-44fe-a971-87df9ab3a1c5/scratchpad`.

**Container.** `docker stop marlin-cast-recon` returned in 1.26 s, exit code 0:

```
[entrypoint] shutting down (exit 0)
[app] SIGTERM — shutting down
[entrypoint] app stopped
[entrypoint] chrome stopped
[entrypoint] novnc stopped
[entrypoint] x11vnc stopped
[entrypoint] xvfb stopped
[entrypoint] shutdown complete: no chrome/Xvfb/ffmpeg/x11vnc/websockify/node left
```

Then `docker rm marlin-cast-recon`. `docker ps -a` afterwards:

```
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

On the host afterwards: 0 chrome, 0 Xvfb, 0 x11vnc, 0 websockify, 0 ffmpeg
processes; nothing listening on 8091, 8092, 8804 or 9333.

**The profile working copy** (`<scratchpad>/data`, owned by 99:100) was deleted
through a throwaway container of the same image, as root, with that directory
mounted: `docker run --rm --entrypoint sh -v <scratchpad>/data:/target
ghcr.io/marlin1111ai/marlin-cast:sha-c876a3a -c 'find /target -mindepth 1
-delete'`.

```
inside: uid=0(root) gid=0(root) groups=0(root)
entries under /target before: 58097
1.8G
find -delete exit 0
entries under /target after: 0
```

The empty `data` directory was then removed with `rmdir` from the host. No
container was left by the run (`--rm`).

**The rest of the scratchpad** — `out/` (the two raw logs, their two snapshot
copies and 13 pull logs), the seven scripts, the pre-extraction hash file and
`run.env` (the throwaway password) — was deleted. Before deletion Appendix A
was compared with `out/measure.log` (byte-identical) and Appendix C with
`out/cycles.log` (identical, lines cut at 400 characters). Listing afterwards:

```
total 8
drwx------ 2 marlinai marlinai 4096 Sep 28 20:10 .
drwx------ 4 marlinai marlinai 4096 Sep 28 19:10 ..
entries in scratchpad: 0
```

**Image.** `docker rmi ghcr.io/marlin1111ai/marlin-cast:sha-c876a3a`
(`Untagged`, then `Deleted: sha256:9e41035c7f7c…`). `docker images` afterwards:

```
IMAGE                                      ID             DISK USAGE   CONTENT SIZE   EXTRA
alpine:3.21                                48b0309ca019       12.2MB         3.73MB
ghcr.io/marlin1111ai/marlin-media:0.4.0    1e69391c5c7c        211MB         57.5MB
ghcr.io/marlin1111ai/marlin-media:latest   1e69391c5c7c        211MB         57.5MB
golang:1.27                                512690a56605       1.31GB          327MB
golang:1.27-alpine                         cf6fca664188        381MB         75.4MB
ubuntu:24.04                               33ceb71981b6        119MB         31.7MB
```

No Marlin Cast image is left. The six listed were there before the
measurement pass and were not touched.

**Backup.** `backups/chrome-profile-2providers-20260913-0746.tgz`,
1,245,011,110 bytes, mtime 2026-09-13 07:47:01 -0400:

```
before extraction: 6ebd9ea976118bcb8c24e10b590680e5d44e405d1b3a9f7f09a0a3982258dbe3
after the clean-up: 6ebd9ea976118bcb8c24e10b590680e5d44e405d1b3a9f7f09a0a3982258dbe3
```

Identical.

**Left on marlinpc:** three output files of the builder's own background
tasks from the measurement pass, in the builder's `tasks/` directory beside
the scratchpad: `b4lckvmvx.output` (3,749 bytes), `bkgr18amn.output` (5,332
bytes), `biwwa73i3.output` (409 bytes). They are the harness's files, outside
the scratchpad, and were not deleted. They hold run-log and measurement lines
that are also in the appendices, and no password (searched).

## Owner's calls (D032, 2026-09-28)

- **1a — the cycle-13 stall is closed, not pursued; reopen if seen on Unraid.**
  This closes why the player stalled and whether the measurement contributed
  to it (the probes touched the YouTube TV page 14 times before the failed
  tune).
- **2a — the measurement stops at 12 cycles and the result is recorded as it
  stands.** Cycles 13–20 are not run.

Recorded as it stands, not determined in this pass:

- What the browser process holds per tune, and what decides when it is
  released. The Blob reading is inference; the release happened once in 12
  cycles.
- Whether the browser process's growth has a ceiling. The highest reading was
  530,028 kB, after six tunes without a release. A tune lasting hours, where
  the recording is far larger than 28 MB, was not measured (the brief set 60 s
  tunes).
- What the unmapped renderer is.
- Why the omnibox renderer's `documents` counter went 6 → 438.

## Least sure of

1. **That the browser process's growth is Blob retention.** The arithmetic
   fits and the release coincided with the extension renderer's drop; neither
   is proof.
2. **That 12 cycles are enough to call the YouTube TV renderer "a band".** It
   shows no trend over 23 minutes of tunes; a slow rise under the two-state
   swing would not be visible yet.
3. **The 10 s settle.** The two states of the parked guide may be the same
   page caught at different moments of loading. One reading per cycle cannot
   tell.
4. **That RSS is the right measure for the renderer.** RSS counts shared pages
   in every process that maps them; PSS was not recorded.
5. **That marlinpc predicts Unraid.** Same image and profile source, a
   different host, and no consumer other than a 60 s ffmpeg pull.

---

## Appendix A — raw output of every measurement point

The file the measurement script wrote, unedited: 15 points.

````
===== POINT a-startup-idle =====
utc: 2026-09-28T23:15:24Z
health: state: idle quality: - channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 704.8MiB / 62.62GiB 1.10% 33.16% 299
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
893747200
anon 640679936
file 210104320
kernel 38690816
shmem 55586816
inactive_file 154370048
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 33456   1015120   4% /dev/shm
0
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      348836    89056     255928    3852      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     202676    40152     134324    28200     chrome           gpu-process    -
76     30     141120    25088     115336    696       chrome           utility         sub=network.mojom.NetworkService
82     54     58948     16344     42288     316       chrome           utility         sub=storage.mojom.StorageService
172    54     145560    34624     110464    472       chrome           renderer        renderer-client-id=5
181    54     200088    71848     127168    1072      chrome           renderer        renderer-client-id=7
192    54     456956    285256    153432    17628     chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
282    54     82008     21020     60692     296       chrome           renderer        renderer-client-id=9
338    30     87808     16044     71664     100       chrome           utility         sub=audio.mojom.AudioService
486    7      86812     30744     56072     0         node             -              node --import tsx src/server.ts 
487    7      2232      156       2076      0         sed              -              sed -u s/^/[app] / 
496    486    15244     5988      9256      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
1924   0      3664      276       3388      0         bash             -              bash -s 
1931   1924   2048      328       2088      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:282  renderer:192  renderer:181  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338
CDP Target.getTargets filter [{}]: 7 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL
service_worker | B04B4695 | 192 | 192(0.42) | https://tv.youtube.com/sw.js
page | 1BBD901F | 181 | 181(0.40) | https://www.philo.com/player/guide
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/
page | E59215A8 | 192 | 192(0.42) | https://tv.youtube.com/live
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 54685834 | n/a | n/a | https://tv.youtube.com/live
===== END a-startup-idle =====

===== POINT b-15min-idle =====
utc: 2026-09-28T23:30:24Z
health: state: idle quality: - channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 723.7MiB / 62.62GiB 1.13% 40.57% 309
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
1127526400
anon 648331264
file 424058880
kernel 50270208
shmem 55586816
inactive_file 368316416
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 33456   1015120   4% /dev/shm
0
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      349276    88996     256428    3852      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     203308    40240     134740    28292     chrome           gpu-process    -
76     30     142052    25520     115804    728       chrome           utility         sub=network.mojom.NetworkService
82     54     60232     16412     43472     348       chrome           utility         sub=storage.mojom.StorageService
172    54     149576    35540     113480    556       chrome           renderer        renderer-client-id=5
181    54     207252    78204     127956    1092      chrome           renderer        renderer-client-id=7
192    54     452492    283216    153576    15876     chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
282    54     83528     21344     61844     340       chrome           renderer        renderer-client-id=9
338    30     88824     16104     72608     112       chrome           utility         sub=audio.mojom.AudioService
486    7      89500     33364     56136     0         node             -              node --import tsx src/server.ts 
487    7      2232      156       2076      0         sed              -              sed -u s/^/[app] / 
496    486    14592     5336      9256      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
9448   7      1916      112       1804      0         sleep            -              sleep 2 
9467   0      3580      276       3304      0         bash             -              bash -s 
9474   9467   1824      328       2044      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:282  renderer:192  renderer:181  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338
CDP Target.getTargets filter [{}]: 7 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL | JS_HEAP | DOM_COUNTERS
service_worker | B04B4695 | 192 | 192(0.42) | https://tv.youtube.com/sw.js | jsHeapUsed=9458kB jsHeapTotal=10980kB | dom error: 'Memory.getDOMCounters' wasn't found
page | 1BBD901F | 181 | 181(0.40) | https://www.philo.com/player/guide | jsHeapUsed=33855kB jsHeapTotal=36932kB | documents=2 nodes=633 listeners=211
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html | jsHeapUsed=4434kB jsHeapTotal=6656kB | documents=6 nodes=2053 listeners=104
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/ | jsHeapUsed=4492kB jsHeapTotal=6656kB | documents=6 nodes=2053 listeners=104
page | E59215A8 | 192 | 192(0.42) | https://tv.youtube.com/live | jsHeapUsed=66176kB jsHeapTotal=76440kB | documents=6 nodes=103666 listeners=17229
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 54685834 | n/a | n/a | https://tv.youtube.com/live
===== END b-15min-idle =====

===== POINT c-cycle-01 =====
utc: 2026-09-28T23:32:20Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 975.6MiB / 62.62GiB 1.52% 38.44% 330
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
1407569920
anon 902619136
file 443756544
kernel 55951360
shmem 58630144
inactive_file 384974848
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 36428   1012148   4% /dev/shm
0
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      387324    118492    264576    4256      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     204000    40540     136016    27552     chrome           gpu-process    -
76     30     142240    25048     116336    856       chrome           utility         sub=network.mojom.NetworkService
82     54     60260     16436     43472     352       chrome           utility         sub=storage.mojom.StorageService
172    54     151376    37324     113480    572       chrome           renderer        renderer-client-id=5
181    54     206960    77904     127956    1100      chrome           renderer        renderer-client-id=7
192    54     612296    438592    157336    16712     chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
338    30     95324     16408     78720     196       chrome           utility         sub=audio.mojom.AudioService
486    7      106940    50676     56264     0         node             -              node --import tsx src/server.ts 
487    7      2236      160       2076      0         sed              -              sed -u s/^/[app] / 
496    486    14612     5356      9256      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
10129  51     105892    42896     62836     160       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
10130  10129  20876     15628     5248      0         chrome           broker         -
10157  54     142532    31208     110528    796       chrome           renderer        renderer-client-id=45 extension-process
10167  54     81920     21008     60632     280       chrome           renderer        renderer-client-id=46
11055  7      2012      108       1904      0         sleep            -              sleep 2 
11074  0      3668      280       3388      0         bash             -              bash -s 
11081  11074  2036      336       2072      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:10167  renderer:192  renderer:181  renderer:10157  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338  passage_embeddings.mojom.PassageEmbeddingsService:10129
CDP Target.getTargets filter [{}]: 10 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL | JS_HEAP | DOM_COUNTERS
service_worker | B04B4695 | 192 | 192(0.42) | https://tv.youtube.com/sw.js | jsHeapUsed=10107kB jsHeapTotal=11492kB | dom error: 'Memory.getDOMCounters' wasn't found
service_worker | 1E4F49E4 | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js | jsHeapUsed=717kB jsHeapTotal=1792kB | dom error: 'Memory.getDOMCounters' wasn't found
page | 1BBD901F | 181 | 181(0.40) | https://www.philo.com/player/guide | jsHeapUsed=34519kB jsHeapTotal=37444kB | documents=2 nodes=633 listeners=211
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html | jsHeapUsed=4841kB jsHeapTotal=6656kB | documents=42 nodes=2449 listeners=104
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/ | jsHeapUsed=4245kB jsHeapTotal=6656kB | documents=42 nodes=2449 listeners=104
page | E59215A8 | 192 | 192(0.41) | https://tv.youtube.com/live | jsHeapUsed=139211kB jsHeapTotal=191644kB | documents=12 nodes=160383 listeners=18941
background_page | D9ABBADA | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html | jsHeapUsed=907kB jsHeapTotal=2048kB | documents=2 nodes=16 listeners=2
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 54685834 | n/a | n/a | https://tv.youtube.com/live
tab | 453728ED | n/a | n/a | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
===== END c-cycle-01 =====

===== POINT c-cycle-02 =====
utc: 2026-09-28T23:34:14Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 911.9MiB / 62.62GiB 1.42% 32.25% 331
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
1356148736
anon 832917504
file 461733888
kernel 57274368
shmem 61349888
inactive_file 400236544
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 39084   1009492   4% /dev/shm
0
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      415856    147024    264576    4256      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     205064    40520     136060    28480     chrome           gpu-process    -
76     30     142372    25108     116400    864       chrome           utility         sub=network.mojom.NetworkService
82     54     60284     16460     43472     352       chrome           utility         sub=storage.mojom.StorageService
172    54     151884    37832     113480    572       chrome           renderer        renderer-client-id=5
181    54     219632    90572     127956    1104      chrome           renderer        renderer-client-id=7
192    54     506428    328700    157516    19396     chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
338    30     95388     16412     78720     256       chrome           utility         sub=audio.mojom.AudioService
486    7      104304    47848     56456     0         node             -              node --import tsx src/server.ts 
487    7      2236      160       2076      0         sed              -              sed -u s/^/[app] / 
496    486    14632     5376      9256      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
10129  51     105876    42880     62836     160       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
10130  10129  20876     15628     5248      0         chrome           broker         -
10157  54     150564    33352     116408    804       chrome           renderer        renderer-client-id=45 extension-process
10167  54     81920     21008     60632     280       chrome           renderer        renderer-client-id=46
12709  0      3484      276       3208      0         bash             -              bash -s 
12716  12709  1980      332       2144      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:10167  renderer:192  renderer:181  renderer:10157  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338  passage_embeddings.mojom.PassageEmbeddingsService:10129
CDP Target.getTargets filter [{}]: 10 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL | JS_HEAP | DOM_COUNTERS
service_worker | B04B4695 | 192 | 192(0.42) | https://tv.youtube.com/sw.js | jsHeapUsed=10029kB jsHeapTotal=11236kB | dom error: 'Memory.getDOMCounters' wasn't found
service_worker | 1E4F49E4 | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js | jsHeapUsed=821kB jsHeapTotal=1792kB | dom error: 'Memory.getDOMCounters' wasn't found
page | 1BBD901F | 181 | 181(0.40) | https://www.philo.com/player/guide | jsHeapUsed=34483kB jsHeapTotal=37956kB | documents=2 nodes=633 listeners=211
page | E59215A8 | 192 | 192(0.42) | https://tv.youtube.com/live | jsHeapUsed=103951kB jsHeapTotal=137360kB | documents=6 nodes=110922 listeners=18843
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html | jsHeapUsed=4736kB jsHeapTotal=6656kB | documents=72 nodes=2779 listeners=104
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/ | jsHeapUsed=4453kB jsHeapTotal=6656kB | documents=72 nodes=2779 listeners=104
background_page | D9ABBADA | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html | jsHeapUsed=1194kB jsHeapTotal=2304kB | documents=2 nodes=16 listeners=4
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 54685834 | n/a | n/a | https://tv.youtube.com/live
tab | 453728ED | n/a | n/a | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
===== END c-cycle-02 =====

===== POINT c-cycle-03 =====
utc: 2026-09-28T23:36:06Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 1.043GiB / 62.62GiB 1.67% 41.10% 334
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
1538199552
anon 995192832
file 480415744
kernel 58429440
shmem 62283776
inactive_file 417964032
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 39996   1008580   4% /dev/shm
0
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      445556    176660    264640    4256      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     205708    40456     136096    29156     chrome           gpu-process    -
76     30     142432    25164     116400    868       chrome           utility         sub=network.mojom.NetworkService
82     54     60284     16460     43472     352       chrome           utility         sub=storage.mojom.StorageService
172    54     152456    38396     113480    580       chrome           renderer        renderer-client-id=5
181    54     213928    84868     127956    1104      chrome           renderer        renderer-client-id=7
192    54     634052    456344    157628    20356     chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
338    30     95392     16416     78720     256       chrome           utility         sub=audio.mojom.AudioService
486    7      108088    51632     56456     0         node             -              node --import tsx src/server.ts 
487    7      2236      160       2076      0         sed              -              sed -u s/^/[app] / 
496    486    14616     5360      9256      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
10129  51     112780    43004     69604     172       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
10130  10129  20876     15628     5248      0         chrome           broker         -
10157  54     153944    36024     117076    844       chrome           renderer        renderer-client-id=45 extension-process
10167  54     83408     21320     61784     304       chrome           renderer        renderer-client-id=46
14320  0      3612      284       3328      0         bash             -              bash -s 
14342  14320  1928      336       2068      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:10167  renderer:192  renderer:181  renderer:10157  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338  passage_embeddings.mojom.PassageEmbeddingsService:10129
CDP Target.getTargets filter [{}]: 10 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL | JS_HEAP | DOM_COUNTERS
service_worker | B04B4695 | 192 | 192(0.42) | https://tv.youtube.com/sw.js | jsHeapUsed=10112kB jsHeapTotal=11236kB | dom error: 'Memory.getDOMCounters' wasn't found
service_worker | 1E4F49E4 | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js | jsHeapUsed=971kB jsHeapTotal=2048kB | dom error: 'Memory.getDOMCounters' wasn't found
page | 1BBD901F | 181 | 181(0.40) | https://www.philo.com/player/guide | jsHeapUsed=26552kB jsHeapTotal=37828kB | documents=2 nodes=631 listeners=211
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.41) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html | jsHeapUsed=4273kB jsHeapTotal=6656kB | documents=108 nodes=3175 listeners=104
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/ | jsHeapUsed=4277kB jsHeapTotal=6656kB | documents=108 nodes=3175 listeners=104
background_page | D9ABBADA | 10157 | 10157(0.41) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html | jsHeapUsed=1486kB jsHeapTotal=2304kB | documents=2 nodes=16 listeners=6
page | E59215A8 | 192 | 192(0.42) | https://tv.youtube.com/live | jsHeapUsed=152807kB jsHeapTotal=205724kB | documents=12 nodes=159556 listeners=18897
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 453728ED | n/a | n/a | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
tab | 54685834 | n/a | n/a | https://tv.youtube.com/live
===== END c-cycle-03 =====

===== POINT c-cycle-04 =====
utc: 2026-09-28T23:38:01Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 1.089GiB / 62.62GiB 1.74% 43.83% 335
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
1604374528
anon 1044013056
file 496349184
kernel 59502592
shmem 61825024
inactive_file 434364416
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 39548   1009028   4% /dev/shm
0
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      472900    204004    264640    4256      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     205496    40516     136096    28892     chrome           gpu-process    -
76     30     142708    25012     116464    868       chrome           utility         sub=network.mojom.NetworkService
82     54     60296     16472     43472     352       chrome           utility         sub=storage.mojom.StorageService
172    54     153000    38940     113480    580       chrome           renderer        renderer-client-id=5
181    54     214992    85928     127956    1108      chrome           renderer        renderer-client-id=7
192    54     641792    464520    157628    18908     chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
338    30     95380     16404     78720     256       chrome           utility         sub=audio.mojom.AudioService
486    7      115356    58900     56456     0         node             -              node --import tsx src/server.ts 
487    7      2236      160       2076      0         sed              -              sed -u s/^/[app] / 
496    486    14624     5368      9256      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
10129  51     107060    42980     63908     172       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
10130  10129  20876     15628     5248      0         chrome           broker         -
10157  54     157440    39052     117540    848       chrome           renderer        renderer-client-id=45 extension-process
10167  54     83408     21320     61784     304       chrome           renderer        renderer-client-id=46
15941  7      2080      112       1968      0         sleep            -              sleep 2 
15960  0      3516      284       3232      0         bash             -              bash -s 
15967  15960  1992      336       2124      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:10167  renderer:192  renderer:181  renderer:10157  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338  passage_embeddings.mojom.PassageEmbeddingsService:10129
CDP Target.getTargets filter [{}]: 10 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL | JS_HEAP | DOM_COUNTERS
service_worker | B04B4695 | 192 | 192(0.42) | https://tv.youtube.com/sw.js | jsHeapUsed=10164kB jsHeapTotal=12260kB | dom error: 'Memory.getDOMCounters' wasn't found
service_worker | 1E4F49E4 | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js | jsHeapUsed=1099kB jsHeapTotal=2048kB | dom error: 'Memory.getDOMCounters' wasn't found
page | 1BBD901F | 181 | 181(0.40) | https://www.philo.com/player/guide | jsHeapUsed=28103kB jsHeapTotal=39876kB | documents=2 nodes=631 listeners=211
page | E59215A8 | 192 | 192(0.42) | https://tv.youtube.com/live | jsHeapUsed=157905kB jsHeapTotal=207260kB | documents=12 nodes=159549 listeners=18895
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html | jsHeapUsed=5092kB jsHeapTotal=6656kB | documents=144 nodes=3571 listeners=104
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/ | jsHeapUsed=4892kB jsHeapTotal=6656kB | documents=144 nodes=3571 listeners=104
background_page | D9ABBADA | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html | jsHeapUsed=1188kB jsHeapTotal=2304kB | documents=2 nodes=16 listeners=8
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 54685834 | n/a | n/a | https://tv.youtube.com/live
tab | 453728ED | n/a | n/a | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
===== END c-cycle-04 =====

===== POINT c-cycle-05 =====
utc: 2026-09-28T23:39:57Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 1.092GiB / 62.62GiB 1.74% 40.33% 335
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
1622700032
anon 1046085632
file 511537152
kernel 60530688
shmem 61628416
inactive_file 449765376
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 39356   1009220   4% /dev/shm
0
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      502432    233536    264640    4256      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     205244    40588     136084    28556     chrome           gpu-process    -
76     30     142440    25104     116464    872       chrome           utility         sub=network.mojom.NetworkService
82     54     60348     16444     43552     352       chrome           utility         sub=storage.mojom.StorageService
172    54     153680    39572     113528    580       chrome           renderer        renderer-client-id=5
181    54     203392    74328     127956    1108      chrome           renderer        renderer-client-id=7
192    54     636840    459500    157708    18712     chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
338    30     95420     16440     78720     260       chrome           utility         sub=audio.mojom.AudioService
486    7      101620    45164     56456     0         node             -              node --import tsx src/server.ts 
487    7      2236      160       2076      0         sed              -              sed -u s/^/[app] / 
496    486    14612     5356      9256      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
10129  51     112784    43008     69604     172       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
10130  10129  20876     15628     5248      0         chrome           broker         -
10157  54     160136    41300     117988    848       chrome           renderer        renderer-client-id=45 extension-process
10167  54     83408     21320     61784     304       chrome           renderer        renderer-client-id=46
17592  7      2012      104       1908      0         sleep            -              sleep 2 
17611  0      3660      284       3376      0         bash             -              bash -s 
17618  17611  2040      336       2080      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:10167  renderer:192  renderer:181  renderer:10157  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338  passage_embeddings.mojom.PassageEmbeddingsService:10129
CDP Target.getTargets filter [{}]: 10 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL | JS_HEAP | DOM_COUNTERS
service_worker | B04B4695 | 192 | 192(0.75) | https://tv.youtube.com/sw.js | jsHeapUsed=10732kB jsHeapTotal=12516kB | dom error: 'Memory.getDOMCounters' wasn't found
service_worker | 1E4F49E4 | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js | jsHeapUsed=1233kB jsHeapTotal=2048kB | dom error: 'Memory.getDOMCounters' wasn't found
page | 1BBD901F | 181 | 181(0.40) | https://www.philo.com/player/guide | jsHeapUsed=28381kB jsHeapTotal=37828kB | documents=2 nodes=631 listeners=211
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html | jsHeapUsed=4782kB jsHeapTotal=6656kB | documents=186 nodes=4033 listeners=104
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.41) | chrome://omnibox-popup.top-chrome/ | jsHeapUsed=4554kB jsHeapTotal=6656kB | documents=186 nodes=4033 listeners=104
background_page | D9ABBADA | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html | jsHeapUsed=1577kB jsHeapTotal=2816kB | documents=2 nodes=16 listeners=10
page | E59215A8 | 192 | 192(0.41) | https://tv.youtube.com/live | jsHeapUsed=104491kB jsHeapTotal=134032kB | documents=6 nodes=110776 listeners=18803
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 453728ED | n/a | n/a | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
tab | 54685834 | n/a | n/a | https://tv.youtube.com/live
===== END c-cycle-05 =====

===== POINT c-cycle-06 =====
utc: 2026-09-28T23:41:52Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 1.147GiB / 62.62GiB 1.83% 33.30% 335
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
1698902016
anon 1105612800
file 527122432
kernel 61382656
shmem 62267392
inactive_file 464711680
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 39980   1008596   4% /dev/shm
0
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      530028    261132    264640    4256      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     205764    40516     136096    29152     chrome           gpu-process    -
76     30     142520    25184     116464    872       chrome           utility         sub=network.mojom.NetworkService
82     54     60352     16448     43552     352       chrome           utility         sub=storage.mojom.StorageService
172    54     154148    40040     113528    580       chrome           renderer        renderer-client-id=5
181    54     203288    74224     127956    1108      chrome           renderer        renderer-client-id=7
192    54     649196    472664    157708    19080     chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
338    30     95416     16436     78720     260       chrome           utility         sub=audio.mojom.AudioService
486    7      113608    57152     56456     0         node             -              node --import tsx src/server.ts 
487    7      2236      160       2076      0         sed              -              sed -u s/^/[app] / 
496    486    14620     5364      9256      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
10129  51     107048    42968     63908     172       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
10130  10129  20876     15628     5248      0         chrome           broker         -
10157  54     162556    43716     117988    852       chrome           renderer        renderer-client-id=45 extension-process
10167  54     83408     21320     61784     304       chrome           renderer        renderer-client-id=46
19245  0      3764      284       3480      0         bash             -              bash -s 
19252  19245  1932      340       2128      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:10167  renderer:192  renderer:181  renderer:10157  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338  passage_embeddings.mojom.PassageEmbeddingsService:10129
CDP Target.getTargets filter [{}]: 10 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL | JS_HEAP | DOM_COUNTERS
service_worker | B04B4695 | 192 | 192(0.42) | https://tv.youtube.com/sw.js | jsHeapUsed=10765kB jsHeapTotal=12260kB | dom error: 'Memory.getDOMCounters' wasn't found
service_worker | 1E4F49E4 | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js | jsHeapUsed=628kB jsHeapTotal=1536kB | dom error: 'Memory.getDOMCounters' wasn't found
page | 1BBD901F | 181 | 181(0.40) | https://www.philo.com/player/guide | jsHeapUsed=28870kB jsHeapTotal=37828kB | documents=2 nodes=631 listeners=211
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html | jsHeapUsed=4829kB jsHeapTotal=6912kB | documents=222 nodes=4429 listeners=104
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/ | jsHeapUsed=4894kB jsHeapTotal=6912kB | documents=222 nodes=4429 listeners=104
background_page | D9ABBADA | 10157 | 10157(0.41) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html | jsHeapUsed=1297kB jsHeapTotal=2560kB | documents=2 nodes=16 listeners=12
page | E59215A8 | 192 | 192(0.41) | https://tv.youtube.com/live | jsHeapUsed=149603kB jsHeapTotal=208028kB | documents=12 nodes=161111 listeners=18899
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 453728ED | n/a | n/a | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
tab | 54685834 | n/a | n/a | https://tv.youtube.com/live
===== END c-cycle-06 =====

===== POINT c-cycle-07 =====
utc: 2026-09-28T23:43:46Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 903.2MiB / 62.62GiB 1.41% 26.82% 340
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
1427632128
anon 819892224
file 539250688
kernel 63516672
shmem 61235200
inactive_file 477872128
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 38972   1009604   4% /dev/shm
0
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      386856    117960    264640    4256      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     205180    40684     136096    28424     chrome           gpu-process    -
76     30     142396    25056     116464    876       chrome           utility         sub=network.mojom.NetworkService
82     54     60348     16444     43552     352       chrome           utility         sub=storage.mojom.StorageService
172    54     154884    40776     113528    580       chrome           renderer        renderer-client-id=5
181    54     203460    74396     127956    1108      chrome           renderer        renderer-client-id=7
192    54     520888    344752    157756    18340     chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
338    30     95416     16436     78720     260       chrome           utility         sub=audio.mojom.AudioService
486    7      114492    58036     56456     0         node             -              node --import tsx src/server.ts 
487    7      2236      160       2076      0         sed              -              sed -u s/^/[app] / 
496    486    14800     5480      9320      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
10129  51     112780    43004     69604     172       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
10130  10129  20876     15628     5248      0         chrome           broker         -
10157  54     157848    35584     121364    900       chrome           renderer        renderer-client-id=45 extension-process
10167  54     83424     21320     61784     320       chrome           renderer        renderer-client-id=46
20876  7      1864      108       1756      0         sleep            -              sleep 2 
20889  0      3672      284       3388      0         bash             -              bash -s 
20896  20889  2056      336       2088      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:10167  renderer:192  renderer:181  renderer:10157  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338  passage_embeddings.mojom.PassageEmbeddingsService:10129
CDP Target.getTargets filter [{}]: 10 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL | JS_HEAP | DOM_COUNTERS
service_worker | B04B4695 | 192 | 192(0.42) | https://tv.youtube.com/sw.js | jsHeapUsed=10835kB jsHeapTotal=12004kB | dom error: 'Memory.getDOMCounters' wasn't found
service_worker | 1E4F49E4 | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js | jsHeapUsed=725kB jsHeapTotal=1536kB | dom error: 'Memory.getDOMCounters' wasn't found
page | 1BBD901F | 181 | 181(0.40) | https://www.philo.com/player/guide | jsHeapUsed=28633kB jsHeapTotal=37828kB | documents=2 nodes=631 listeners=211
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html | jsHeapUsed=5097kB jsHeapTotal=6912kB | documents=258 nodes=4825 listeners=104
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/ | jsHeapUsed=4806kB jsHeapTotal=6912kB | documents=258 nodes=4825 listeners=104
page | E59215A8 | 192 | 192(0.41) | https://tv.youtube.com/live | jsHeapUsed=104708kB jsHeapTotal=133520kB | documents=6 nodes=110630 listeners=18763
background_page | D9ABBADA | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html | jsHeapUsed=802kB jsHeapTotal=1792kB | documents=1 nodes=12 listeners=2
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 54685834 | n/a | n/a | https://tv.youtube.com/live
tab | 453728ED | n/a | n/a | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
===== END c-cycle-07 =====

===== POINT c-cycle-08 =====
utc: 2026-09-28T23:45:40Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 923.7MiB / 62.62GiB 1.44% 32.53% 340
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
1459568640
anon 839741440
file 552439808
kernel 62963712
shmem 61366272
inactive_file 490930176
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 39100   1009476   4% /dev/shm
0
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      412912    145608    263048    4256      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     205436    40656     136096    28692     chrome           gpu-process    -
76     30     142548    25208     116464    876       chrome           utility         sub=network.mojom.NetworkService
82     54     60356     16452     43552     352       chrome           utility         sub=storage.mojom.StorageService
172    54     155720    41404     113736    580       chrome           renderer        renderer-client-id=5
181    54     203412    74348     127956    1108      chrome           renderer        renderer-client-id=7
192    54     510844    335140    157820    19468     chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
338    30     95412     16432     78720     260       chrome           utility         sub=audio.mojom.AudioService
486    7      114692    58236     56456     0         node             -              node --import tsx src/server.ts 
487    7      2236      160       2076      0         sed              -              sed -u s/^/[app] / 
496    486    14712     5392      9320      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
10129  51     113020    42988     69860     172       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
10130  10129  20876     15628     5248      0         chrome           broker         -
10157  54     159676    37412     121364    900       chrome           renderer        renderer-client-id=45 extension-process
10167  54     83424     21320     61784     320       chrome           renderer        renderer-client-id=46
22504  7      2084      112       1972      0         sleep            -              sleep 2 
22523  0      3728      276       3452      0         bash             -              bash -s 
22530  22523  2060      332       2136      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:10167  renderer:192  renderer:181  renderer:10157  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338  passage_embeddings.mojom.PassageEmbeddingsService:10129
CDP Target.getTargets filter [{}]: 10 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL | JS_HEAP | DOM_COUNTERS
service_worker | B04B4695 | 192 | 192(0.42) | https://tv.youtube.com/sw.js | jsHeapUsed=1310kB jsHeapTotal=7936kB | dom error: 'Memory.getDOMCounters' wasn't found
service_worker | 1E4F49E4 | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js | jsHeapUsed=823kB jsHeapTotal=1792kB | dom error: 'Memory.getDOMCounters' wasn't found
page | 1BBD901F | 181 | 181(0.40) | https://www.philo.com/player/guide | jsHeapUsed=29134kB jsHeapTotal=37828kB | documents=2 nodes=631 listeners=211
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html | jsHeapUsed=4643kB jsHeapTotal=6912kB | documents=294 nodes=5221 listeners=104
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/ | jsHeapUsed=4551kB jsHeapTotal=6912kB | documents=294 nodes=5221 listeners=104
page | E59215A8 | 192 | 192(0.41) | https://tv.youtube.com/live | jsHeapUsed=104098kB jsHeapTotal=110992kB | documents=6 nodes=110196 listeners=18704
background_page | D9ABBADA | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html | jsHeapUsed=1179kB jsHeapTotal=2048kB | documents=1 nodes=12 listeners=4
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 54685834 | n/a | n/a | https://tv.youtube.com/live
tab | 453728ED | n/a | n/a | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
===== END c-cycle-08 =====

===== POINT c-cycle-09 =====
utc: 2026-09-28T23:47:34Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 1.043GiB / 62.62GiB 1.67% 35.26% 340
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
1628205056
anon 992161792
file 566972416
kernel 63602688
shmem 59924480
inactive_file 506896384
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 37692   1010884   4% /dev/shm
0
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      441676    172388    265032    4256      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     205452    40588     136092    28772     chrome           gpu-process    -
76     30     142324    24984     116464    876       chrome           utility         sub=network.mojom.NetworkService
82     54     60344     16440     43552     352       chrome           utility         sub=storage.mojom.StorageService
172    54     156264    41948     113736    580       chrome           renderer        renderer-client-id=5
181    54     205096    76032     127956    1108      chrome           renderer        renderer-client-id=7
192    54     627196    452388    157820    17060     chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
338    30     95400     16384     78720     260       chrome           utility         sub=audio.mojom.AudioService
486    7      116088    59632     56456     0         node             -              node --import tsx src/server.ts 
487    7      2236      160       2076      0         sed              -              sed -u s/^/[app] / 
496    486    14852     5532      9320      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
10129  51     107056    42976     63908     172       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
10130  10129  20876     15628     5248      0         chrome           broker         -
10157  54     160360    38016     121444    900       chrome           renderer        renderer-client-id=45 extension-process
10167  54     83424     21320     61784     320       chrome           renderer        renderer-client-id=46
24138  7      2012      108       1904      0         sleep            -              sleep 2 
24157  0      3640      280       3360      0         bash             -              bash -s 
24164  24157  1964      332       2076      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:10167  renderer:192  renderer:181  renderer:10157  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338  passage_embeddings.mojom.PassageEmbeddingsService:10129
CDP Target.getTargets filter [{}]: 10 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL | JS_HEAP | DOM_COUNTERS
service_worker | B04B4695 | 192 | 192(0.41) | https://tv.youtube.com/sw.js | jsHeapUsed=1838kB jsHeapTotal=8192kB | dom error: 'Memory.getDOMCounters' wasn't found
service_worker | 1E4F49E4 | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js | jsHeapUsed=991kB jsHeapTotal=1792kB | dom error: 'Memory.getDOMCounters' wasn't found
page | 1BBD901F | 181 | 181(0.40) | https://www.philo.com/player/guide | jsHeapUsed=29664kB jsHeapTotal=37828kB | documents=2 nodes=631 listeners=211
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html | jsHeapUsed=4966kB jsHeapTotal=6912kB | documents=324 nodes=5551 listeners=104
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/ | jsHeapUsed=4937kB jsHeapTotal=6912kB | documents=324 nodes=5551 listeners=104
page | E59215A8 | 192 | 192(0.42) | https://tv.youtube.com/live | jsHeapUsed=148167kB jsHeapTotal=211100kB | documents=12 nodes=159401 listeners=18794
background_page | D9ABBADA | 10157 | 10157(0.41) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html | jsHeapUsed=1480kB jsHeapTotal=2304kB | documents=1 nodes=12 listeners=6
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 54685834 | n/a | n/a | https://tv.youtube.com/live
tab | 453728ED | n/a | n/a | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
===== END c-cycle-09 =====

===== POINT c-cycle-10 =====
utc: 2026-09-28T23:49:29Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 1.09GiB / 62.62GiB 1.74% 36.38% 340
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
1692172288
anon 1039937536
file 583663616
kernel 64512000
shmem 61222912
inactive_file 522297344
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 38960   1009616   4% /dev/shm
0
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      469712    200424    265032    4256      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     205068    40644     136084    28340     chrome           gpu-process    -
76     30     142644    25304     116464    876       chrome           utility         sub=network.mojom.NetworkService
82     54     60368     16456     43552     352       chrome           utility         sub=storage.mojom.StorageService
172    54     156932    42616     113736    580       chrome           renderer        renderer-client-id=5
181    54     205160    76096     127956    1108      chrome           renderer        renderer-client-id=7
192    54     641420    465428    157820    18328     chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
338    30     95404     16424     78720     260       chrome           utility         sub=audio.mojom.AudioService
486    7      116324    59868     56456     0         node             -              node --import tsx src/server.ts 
487    7      2236      160       2076      0         sed              -              sed -u s/^/[app] / 
496    486    14764     5444      9320      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
10129  51     107044    42964     63908     172       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
10130  10129  20876     15628     5248      0         chrome           broker         -
10157  54     162356    39984     121444    928       chrome           renderer        renderer-client-id=45 extension-process
10167  54     83424     21320     61784     320       chrome           renderer        renderer-client-id=46
25791  0      3668      280       3388      0         bash             -              bash -s 
25798  25791  2052      336       2088      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:10167  renderer:192  renderer:181  renderer:10157  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338  passage_embeddings.mojom.PassageEmbeddingsService:10129
CDP Target.getTargets filter [{}]: 10 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL | JS_HEAP | DOM_COUNTERS
service_worker | B04B4695 | 192 | 192(0.42) | https://tv.youtube.com/sw.js | jsHeapUsed=1810kB jsHeapTotal=8192kB | dom error: 'Memory.getDOMCounters' wasn't found
service_worker | 1E4F49E4 | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js | jsHeapUsed=1093kB jsHeapTotal=2048kB | dom error: 'Memory.getDOMCounters' wasn't found
page | 1BBD901F | 181 | 181(0.40) | https://www.philo.com/player/guide | jsHeapUsed=30199kB jsHeapTotal=37828kB | documents=2 nodes=631 listeners=211
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html | jsHeapUsed=4966kB jsHeapTotal=6912kB | documents=360 nodes=5947 listeners=104
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/ | jsHeapUsed=4386kB jsHeapTotal=6912kB | documents=360 nodes=5947 listeners=104
page | E59215A8 | 192 | 192(0.41) | https://tv.youtube.com/live | jsHeapUsed=148161kB jsHeapTotal=210076kB | documents=12 nodes=160097 listeners=18766
background_page | D9ABBADA | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html | jsHeapUsed=1175kB jsHeapTotal=2304kB | documents=1 nodes=12 listeners=8
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 54685834 | n/a | n/a | https://tv.youtube.com/live
tab | 453728ED | n/a | n/a | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
===== END c-cycle-10 =====

===== POINT c-cycle-11 =====
utc: 2026-09-28T23:51:23Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 1.107GiB / 62.62GiB 1.77% 33.49% 340
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
1726349312
anon 1058697216
file 598208512
kernel 65187840
shmem 61632512
inactive_file 536432640
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 39360   1009216   4% /dev/shm
0
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      497136    227836    265044    4256      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     205564    40660     136084    28820     chrome           gpu-process    -
76     30     142420    25080     116464    876       chrome           utility         sub=network.mojom.NetworkService
82     54     60356     16452     43552     352       chrome           utility         sub=storage.mojom.StorageService
172    54     157600    43284     113736    580       chrome           renderer        renderer-client-id=5
181    54     205700    76636     127956    1108      chrome           renderer        renderer-client-id=7
192    54     631912    455972    157820    19728     chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
338    30     95404     16424     78720     260       chrome           utility         sub=audio.mojom.AudioService
486    7      116340    59884     56456     0         node             -              node --import tsx src/server.ts 
487    7      2236      160       2076      0         sed              -              sed -u s/^/[app] / 
496    486    14788     5468      9320      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
10129  51     107044    42964     63908     172       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
10130  10129  20876     15628     5248      0         chrome           broker         -
10157  54     164836    42464     121444    928       chrome           renderer        renderer-client-id=45 extension-process
10167  54     83424     21320     61784     320       chrome           renderer        renderer-client-id=46
27414  0      3676      276       3400      0         bash             -              bash -s 
27421  27414  1960      332       2112      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:10167  renderer:192  renderer:181  renderer:10157  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338  passage_embeddings.mojom.PassageEmbeddingsService:10129
CDP Target.getTargets filter [{}]: 10 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL | JS_HEAP | DOM_COUNTERS
service_worker | B04B4695 | 192 | 192(0.43) | https://tv.youtube.com/sw.js | jsHeapUsed=1897kB jsHeapTotal=8960kB | dom error: 'Memory.getDOMCounters' wasn't found
service_worker | 1E4F49E4 | 10157 | 10157(0.41) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js | jsHeapUsed=1205kB jsHeapTotal=2048kB | dom error: 'Memory.getDOMCounters' wasn't found
page | 1BBD901F | 181 | 181(0.40) | https://www.philo.com/player/guide | jsHeapUsed=30721kB jsHeapTotal=37828kB | documents=2 nodes=631 listeners=211
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html | jsHeapUsed=5146kB jsHeapTotal=6912kB | documents=396 nodes=6343 listeners=104
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/ | jsHeapUsed=4703kB jsHeapTotal=6912kB | documents=396 nodes=6343 listeners=104
page | E59215A8 | 192 | 192(0.42) | https://tv.youtube.com/live | jsHeapUsed=104997kB jsHeapTotal=132496kB | documents=6 nodes=110069 listeners=18676
background_page | D9ABBADA | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html | jsHeapUsed=1470kB jsHeapTotal=2560kB | documents=1 nodes=12 listeners=10
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 54685834 | n/a | n/a | https://tv.youtube.com/live
tab | 453728ED | n/a | n/a | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
===== END c-cycle-11 =====

===== POINT c-cycle-12 =====
utc: 2026-09-28T23:53:17Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 1.154GiB / 62.62GiB 1.84% 37.73% 340
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
1790705664
anon 1107632128
file 612708352
kernel 65884160
shmem 61501440
inactive_file 551047168
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 39232   1009344   4% /dev/shm
0
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      527096    257796    265044    4256      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     205472    40812     136096    28528     chrome           gpu-process    -
76     30     142392    25052     116464    876       chrome           utility         sub=network.mojom.NetworkService
82     54     60360     16456     43552     352       chrome           utility         sub=storage.mojom.StorageService
172    54     158136    43820     113736    580       chrome           renderer        renderer-client-id=5
181    54     218252    89188     127956    1108      chrome           renderer        renderer-client-id=7
192    54     634492    458608    157820    19600     chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
338    30     95408     16428     78720     260       chrome           utility         sub=audio.mojom.AudioService
486    7      116428    59972     56456     0         node             -              node --import tsx src/server.ts 
487    7      2236      160       2076      0         sed              -              sed -u s/^/[app] / 
496    486    14788     5468      9320      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
10129  51     107040    42960     63908     172       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
10130  10129  20876     15628     5248      0         chrome           broker         -
10157  54     166668    44296     121444    928       chrome           renderer        renderer-client-id=45 extension-process
10167  54     83424     21320     61784     320       chrome           renderer        renderer-client-id=46
29034  7      1900      108       1792      0         sleep            -              sleep 2 
29053  0      3700      280       3420      0         bash             -              bash -s 
29060  29053  2068      336       2104      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:10167  renderer:192  renderer:181  renderer:10157  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338  passage_embeddings.mojom.PassageEmbeddingsService:10129
CDP Target.getTargets filter [{}]: 10 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL | JS_HEAP | DOM_COUNTERS
service_worker | B04B4695 | 192 | 192(0.42) | https://tv.youtube.com/sw.js | jsHeapUsed=1879kB jsHeapTotal=8448kB | dom error: 'Memory.getDOMCounters' wasn't found
service_worker | 1E4F49E4 | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js | jsHeapUsed=1312kB jsHeapTotal=2304kB | dom error: 'Memory.getDOMCounters' wasn't found
page | 1BBD901F | 181 | 181(0.39) | https://www.philo.com/player/guide | jsHeapUsed=32051kB jsHeapTotal=39876kB | documents=2 nodes=631 listeners=211
page | E59215A8 | 192 | 192(0.42) | https://tv.youtube.com/live | jsHeapUsed=152617kB jsHeapTotal=212892kB | documents=12 nodes=159568 listeners=18736
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html | jsHeapUsed=4407kB jsHeapTotal=6912kB | documents=426 nodes=6673 listeners=104
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/ | jsHeapUsed=5034kB jsHeapTotal=6912kB | documents=426 nodes=6673 listeners=104
background_page | D9ABBADA | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html | jsHeapUsed=1805kB jsHeapTotal=2816kB | documents=1 nodes=12 listeners=12
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 54685834 | n/a | n/a | https://tv.youtube.com/live
tab | 453728ED | n/a | n/a | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
===== END c-cycle-12 =====

===== POINT failure-snapshot =====
utc: 2026-09-28T23:54:06Z
health: state: idle quality: hd1080 channel: - (-) segments: 0 
--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)
marlin-cast-recon 1.077GiB / 62.62GiB 1.72% 28.77% 340
--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file
1720586240
anon 1031544832
file 615038976
kernel 67076096
shmem 52908032
inactive_file 561987584
active_file 143360
--- /dev/shm and HLS scratch
shm              1048576 30840   1017736   3% /dev/shm
1
--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)
PID    PPID   RSS_kB    RssAnon   RssFile   RssShmem  COMM             TYPE           DETAIL
1      0      1504      92        1412      0         tini             -              /usr/bin/tini -- /entrypoint.sh 
7      1      4188      916       3272      0         bash             -              bash /entrypoint.sh 
26     7      40704     11972     7904      20828     Xvfb             -              Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nocursor 
30     7      527140    257704    265044    4392      chrome           (no --type)    -
40     30     1968      108       1860      0         cat              -              cat 
41     30     1856      116       1740      0         cat              -              cat 
43     1      3688      344       3344      0         chrome_crashpad  (no --type)    -
45     1      3536      324       3212      0         chrome_crashpad  (no --type)    -
51     30     68416     15312     53104     0         chrome           zygote         -
52     30     69300     15216     54084     0         chrome           zygote         -
54     52     20300     15316     4984      0         chrome           zygote         -
74     51     191584    40824     136028    14720     chrome           gpu-process    -
76     30     142292    24968     116464    880       chrome           utility         sub=network.mojom.NetworkService
82     54     60376     16472     43552     352       chrome           utility         sub=storage.mojom.StorageService
172    54     158404    44088     113736    580       chrome           renderer        renderer-client-id=5
181    54     220580    91512     127956    1112      chrome           renderer        renderer-client-id=7
192    54     477808    315652    157820    4440      chrome           renderer        renderer-client-id=8
257    7      19196     10088     9108      0         x11vnc           -              x11vnc -display :99 -rfbauth /tmp/marlin-cast/vncpasswd -rfb
278    7      38136     21464     16672     0         websockify       -              /usr/bin/python3 /usr/bin/websockify --web=/tmp/marlin-cast/
338    30     95372     16380     78720     272       chrome           utility         sub=audio.mojom.AudioService
486    7      116428    59972     56456     0         node             -              node --import tsx src/server.ts 
487    7      2236      160       2076      0         sed              -              sed -u s/^/[app] / 
496    486    14788     5468      9320      0         esbuild          -              /app/node_modules/@esbuild/linux-x64/bin/esbuild --service=0
10129  51     109016    42952     65892     172       chrome           utility         sub=passage_embeddings.mojom.PassageEmbeddingsService
10130  10129  20876     15628     5248      0         chrome           broker         -
10157  54     166812    44440     121444    928       chrome           renderer        renderer-client-id=45 extension-process
10167  54     83424     21320     61784     320       chrome           renderer        renderer-client-id=46
29780  54     139680    80696     58832     152       chrome           utility         sub=media.mojom.CdmServiceBroker
30048  0      3616      276       3340      0         bash             -              bash -s 
30055  30048  2032      332       2164      0         bash             -              bash -s 
--- renderer-to-tab mapping (loopback CDP inside the container)
CDP SystemInfo.getProcessInfo (type pid):
  browser:30  renderer:10167  renderer:192  renderer:181  renderer:10157  renderer:172  GPU:74  network.mojom.NetworkService:76  storage.mojom.StorageService:82  audio.mojom.AudioService:338  passage_embeddings.mojom.PassageEmbeddingsService:10129  media.mojom.CdmServiceBroker:29780
CDP Target.getTargets filter [{}]: 10 targets
TARGET_TYPE | TARGET_ID | PID_requestId | PID_cpuburn(delta_s) | URL | JS_HEAP | DOM_COUNTERS
service_worker | B04B4695 | 192 | 192(0.41) | https://tv.youtube.com/sw.js | jsHeapUsed=2148kB jsHeapTotal=8448kB | dom error: 'Memory.getDOMCounters' wasn't found
service_worker | 1E4F49E4 | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/background.js | jsHeapUsed=698kB jsHeapTotal=2048kB | dom error: 'Memory.getDOMCounters' wasn't found
page | 1BBD901F | 181 | 181(0.40) | https://www.philo.com/player/guide | jsHeapUsed=32247kB jsHeapTotal=37828kB | documents=2 nodes=631 listeners=211
browser_ui | A3BF93D8 | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/omnibox_popup_aim.html | jsHeapUsed=4930kB jsHeapTotal=6912kB | documents=438 nodes=6805 listeners=104
browser_ui | 2F224B7B | no event (fetch failed: TypeError: Failed to fetch) | 172(0.40) | chrome://omnibox-popup.top-chrome/ | jsHeapUsed=5133kB jsHeapTotal=6912kB | documents=438 nodes=6805 listeners=104
page | E59215A8 | 192 | 192(0.40) | https://tv.youtube.com/watch/jhOr9QgdOqQ | jsHeapUsed=97180kB jsHeapTotal=102156kB | documents=6 nodes=48806 listeners=6363
background_page | D9ABBADA | 10157 | 10157(0.40) | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html | jsHeapUsed=1254kB jsHeapTotal=2560kB | documents=1 nodes=12 listeners=12
tab | 0DEDC785 | n/a | n/a | https://www.philo.com/player/guide
tab | 54685834 | n/a | n/a | https://tv.youtube.com/watch/jhOr9QgdOqQ
tab | 453728ED | n/a | n/a | chrome-extension://edoicfpldmlabgdalemfgflpldiijdmm/offscreen.html
===== END failure-snapshot =====

````

## Appendix B — the scripts

Run from the scratchpad on marlinpc; none is in the repo or the image.

**`measure.sh`**

````
#!/usr/bin/env bash
# measure.sh <label> — one measurement point, appended to out/measure.log.
# Order: docker stats first, then ps, then the CDP mapping (so the mapping's
# own node process and probes are not inside this point's memory figures).
set -uo pipefail
S=/tmp/claude-1000/-Apps-marlin-cast/8b3f200b-47ba-44fe-a971-87df9ab3a1c5/scratchpad
C=marlin-cast-recon
LABEL="$1"
{
  echo "===== POINT ${LABEL} ====="
  echo "utc: $(date -u +%FT%TZ)"
  echo "health: $(curl -s -m 5 http://127.0.0.1:8091/health | grep -E '^(state|quality|channel|segments):' | tr '\n' ' ')"
  echo "--- docker stats --no-stream (NAME MEMUSAGE MEMPERC CPUPERC PIDS)"
  docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.MemPerc}} {{.CPUPerc}} {{.PIDs}}' "$C"
  echo "--- cgroup (bytes): memory.current, then memory.stat anon/file/shmem/kernel/inactive_file"
  docker exec "$C" sh -c 'cat /sys/fs/cgroup/memory.current; grep -E "^(anon|file|shmem|kernel|inactive_file|active_file) " /sys/fs/cgroup/memory.stat'
  echo "--- /dev/shm and HLS scratch"
  docker exec "$C" sh -c 'df -k /dev/shm | tail -1; ls /tmp/marlin-cast/hls 2>/dev/null | wc -l'
  echo "--- processes (ps -eo pid,ppid,rss,comm + /proc/<pid>/status + --type from /proc/<pid>/cmdline)"
  docker exec -i "$C" bash -s < "$S/ps.sh"
  echo "--- renderer-to-tab mapping (loopback CDP inside the container)"
  docker exec -i -u 99:100 "$C" node --input-type=module - < "$S/map.mjs" 2>&1
  echo "===== END ${LABEL} ====="
  echo
} >> "$S/out/measure.log" 2>&1
````

**`ps.sh`**

````
#!/usr/bin/env bash
# Runs INSIDE the container (docker exec -i marlin-cast-recon bash -s < ps.sh).
# One line per process: pid, ppid, RSS (ps, kB), RssAnon/RssFile/RssShmem
# (/proc/<pid>/status, kB), comm, Chrome's --type, and the flags that tell
# Chrome's children apart. Read-only.
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

**`map.mjs`**

````
// Renderer-to-tab mapping over the container's own loopback CDP (127.0.0.1:9333).
// Run INSIDE the container: docker exec -i marlin-cast-recon node --input-type=module - < map.mjs
//
// Two independent traces per target:
//   A. requestId: a fetch of a data: URL issued in the target; Blink names a
//      renderer-issued request "<pid>.<n>", so the prefix is the renderer pid.
//   B. cpu burn: a 400 ms busy loop in the target, and the process whose
//      SystemInfo.getProcessInfo cpuTime rose the most across it.
// Read-only apart from those two probes: no navigation, no click, no reload.

const PORT = 9333;
const base = `http://127.0.0.1:${PORT}`;
const version = await (await fetch(`${base}/json/version`)).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener("open", res, { once: true });
  ws.addEventListener("error", () => rej(new Error("ws open failed")), { once: true });
});

let id = 0;
const pending = new Map();
const events = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(String(ev.data));
  if (m.method) { events.push(m); return; }
  const p = pending.get(m.id);
  if (!p) return;
  pending.delete(m.id);
  m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
});
const send = (method, params = {}, sessionId) => {
  const i = ++id;
  const msg = { id: i, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => {
    pending.set(i, { res, rej });
    setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error(`timeout: ${method}`)); } }, 8000);
  });
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = async () => {
  const { processInfo } = await send("SystemInfo.getProcessInfo");
  return new Map(processInfo.map((p) => [p.id, p]));
};
const shortUrl = (u) => {
  try { const x = new URL(u); return (x.protocol + "//" + x.host + x.pathname).slice(0, 90); } catch { return String(u).slice(0, 90); }
};

const before = await procs();
console.log("CDP SystemInfo.getProcessInfo (type pid):");
console.log("  " + [...before.values()].map((p) => `${p.type}:${p.id}`).join("  "));

const { targetInfos } = await send("Target.getTargets", { filter: [{}] });
console.log(`CDP Target.getTargets filter [{}]: ${targetInfos.length} targets`);
console.log(["TARGET_TYPE", "TARGET_ID", "PID_requestId", "PID_cpuburn(delta_s)", "URL", "JS_HEAP", "DOM_COUNTERS"].join(" | "));

for (const t of targetInfos) {
  const idShort = t.targetId.slice(0, 8);
  if (t.type === "browser" || t.type === "tab") {
    console.log([t.type, idShort, "n/a", "n/a", shortUrl(t.url)].join(" | "));
    continue;
  }
  let viaReq = "not traced", viaCpu = "not traced";
  let sessionId = null;
  try {
    ({ sessionId } = await send("Target.attachToTarget", { targetId: t.targetId, flatten: true }));
  } catch (e) {
    console.log([t.type, idShort, `attach failed: ${e.message}`, "-", shortUrl(t.url)].join(" | "));
    continue;
  }
  try {
    // A. requestId
    const mark = `mcprobe${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const from = events.length;
    await send("Network.enable", {}, sessionId);
    const r = await send("Runtime.evaluate", {
      expression: `fetch("data:text/plain,${mark}").then(r => r.text()).then(() => "ok").catch(e => "fetch failed: " + e)`,
      awaitPromise: true, returnByValue: true,
    }, sessionId);
    let hit = null;
    for (let i = 0; i < 20 && !hit; i++) {
      hit = events.slice(from).find((e) => e.method === "Network.requestWillBeSent" && e.sessionId === sessionId
        && String(e.params?.request?.url ?? "").includes(mark));
      if (!hit) await sleep(100);
    }
    await send("Network.disable", {}, sessionId).catch(() => {});
    if (hit) {
      const m = /^(\d+)\.\d+$/.exec(hit.params.requestId);
      viaReq = m ? m[1] : `unparsed requestId ${hit.params.requestId}`;
    } else {
      viaReq = `no event (${String(r?.result?.value ?? r?.exceptionDetails?.text ?? "?").slice(0, 60)})`;
    }
  } catch (e) { viaReq = `error: ${e.message}`; }
  try {
    // B. cpu burn
    const p0 = await procs();
    await send("Runtime.evaluate", {
      expression: `(() => { const t = performance.now(); let n = 0; while (performance.now() - t < 400) n++; return n; })()`,
      returnByValue: true,
    }, sessionId);
    const p1 = await procs();
    let best = null;
    for (const [pid, p] of p1) {
      const d = p.cpuTime - (p0.get(pid)?.cpuTime ?? p.cpuTime);
      if (!best || d > best.d) best = { pid, d, type: p.type };
    }
    viaCpu = best ? `${best.pid}(${best.d.toFixed(2)})` : "no process info";
  } catch (e) { viaCpu = `error: ${e.message}`; }
  // Read-only extras (added after point a): V8 heap and DOM counters of the target.
  let heap = "heap n/a", dom = "dom n/a";
  try {
    const h = await send("Runtime.getHeapUsage", {}, sessionId);
    heap = `jsHeapUsed=${Math.round(h.usedSize / 1024)}kB jsHeapTotal=${Math.round(h.totalSize / 1024)}kB`;
  } catch (e) { heap = `heap error: ${e.message}`; }
  try {
    const d = await send("Memory.getDOMCounters", {}, sessionId);
    dom = `documents=${d.documents} nodes=${d.nodes} listeners=${d.jsEventListeners}`;
  } catch (e) { dom = `dom error: ${e.message}`; }
  await send("Target.detachFromTarget", { sessionId }).catch(() => {});
  console.log([t.type, idShort, viaReq, viaCpu, shortUrl(t.url), heap, dom].join(" | "));
}
ws.close();
````

**`cycles.sh`**

````
#!/usr/bin/env bash
# Point (b) at a fixed UTC time, then 20 tune cycles on WBAL 11, one at a time.
# Stops at the first failure with a snapshot; never retries.
set -uo pipefail
S=/tmp/claude-1000/-Apps-marlin-cast/8b3f200b-47ba-44fe-a971-87df9ab3a1c5/scratchpad
C=marlin-cast-recon
KEY=UCZmySpv9dwlwsU2ZxS0pipQ
URL="http://127.0.0.1:8091/stream/${KEY}/index.m3u8"
B_AT="2026-09-28T23:30:24Z"     # point (a) was 23:15:24Z
LOG="$S/out/cycles.log"
SETTLE=10

say() { echo "$(date -u +%FT%TZ) $*" | tee -a "$LOG"; }

fail() {
  say "FAILURE: $*"
  {
    echo "--- snapshot: health"; curl -s -m 5 http://127.0.0.1:8091/health
    echo "--- snapshot: docker ps"; docker ps -a --filter "name=$C" --format '{{.Names}} {{.Status}}'
    echo "--- snapshot: last 60 log lines"; docker logs --tail 60 "$C" 2>&1
  } >> "$LOG" 2>&1
  bash "$S/measure.sh" "failure-snapshot"
  say "STOPPED"
  exit 1
}

# ---- point (b): 15 minutes idle, no tune -------------------------------------
now=$(date -u +%s); at=$(date -u -d "$B_AT" +%s)
if [ "$at" -gt "$now" ]; then say "waiting $((at - now)) s for point (b) at $B_AT"; sleep $((at - now)); fi
tunes=$(docker logs "$C" 2>&1 | grep -c '\[app\] \[tune\]')
say "point (b): [tune] lines in the log so far: $tunes"
[ "$tunes" = 0 ] || fail "a tune happened before point (b)"
bash "$S/measure.sh" "b-15min-idle"
say "point (b) measured"

# ---- 20 cycles ----------------------------------------------------------------
for i in $(seq 1 20); do
  n=$(printf '%02d' "$i")
  state=$(curl -s -m 5 http://127.0.0.1:8091/health | awk '/^state:/ {print $2}')
  [ "$state" = idle ] || fail "cycle $n: state is '$state' before the tune, expected idle"
  since=$(date -u +%FT%TZ)
  t0=$(date +%s.%N)
  say "cycle $n: tune + pull start"
  timeout 110 ffmpeg -hide_banner -nostdin -loglevel info -nostats -t 60 -i "$URL" -c copy -f null - > "$S/out/pull-$n.log" 2>&1
  rc=$?
  t1=$(date +%s.%N)
  wall=$(awk -v a="$t0" -v b="$t1" 'BEGIN {printf "%.1f", b - a}')
  last=$(tr '\r' '\n' < "$S/out/pull-$n.log" | grep -E '^frame=' | tail -1)
  moov=$(grep -c 'duplicated MOOV' "$S/out/pull-$n.log")
  other=$(grep -v -E 'duplicated MOOV|^frame=|^\[hls @|^Input #|^Output #|^Stream mapping|^  |^Press|^video:' "$S/out/pull-$n.log" | grep -c -i -E 'error|fail|invalid')
  say "cycle $n: pull exit=$rc wall=${wall}s moov_warnings=$moov error_like_lines=$other | $last"
  [ "$rc" = 0 ] || { tail -5 "$S/out/pull-$n.log" >> "$LOG"; fail "cycle $n: pull exited $rc"; }

  # wait for the idle stop and the park in the container log
  ok=0
  for w in $(seq 1 60); do
    lines=$(docker logs --since "$since" "$C" 2>&1)
    if echo "$lines" | grep -q '\[stop\] WBAL 11: idle' && echo "$lines" | grep -q '\[stop\] parked the youtubetv tab'; then ok=1; break; fi
    sleep 2
  done
  [ "$ok" = 1 ] || fail "cycle $n: no idle stop + park in the log within 120 s of the pull ending"
  say "cycle $n: idle stop + park seen $(awk -v a="$t1" -v b="$(date +%s.%N)" 'BEGIN {printf "%.1f", b - a}') s after the pull ended; settling ${SETTLE}s"
  sleep "$SETTLE"
  echo "--- cycle $n app log (docker logs --since $since)" >> "$LOG"
  docker logs --since "$since" "$C" 2>&1 | grep -E '^\[app\]' | cut -c1-260 >> "$LOG"
  bash "$S/measure.sh" "c-cycle-$n"
  say "cycle $n: measured"
done
say "ALL 20 CYCLES DONE"
````

**`probe.mjs`**

````
// Read-only probe of the YouTube TV tab after the failed tune. No navigation, no click.
const base = "http://127.0.0.1:9333";
const version = await (await fetch(`${base}/json/version`)).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", () => rej(new Error("ws")), { once: true }); });
let id = 0; const pending = new Map();
ws.addEventListener("message", (ev) => { const m = JSON.parse(String(ev.data)); const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); });
const send = (method, params = {}, sessionId) => { const i = ++id; const msg = { id: i, method, params }; if (sessionId) msg.sessionId = sessionId; ws.send(JSON.stringify(msg)); return new Promise((res, rej) => { pending.set(i, { res, rej }); setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error("timeout " + method)); } }, 8000); }); };
const { targetInfos } = await send("Target.getTargets", { filter: [{}] });
for (const t of targetInfos) console.log("target", t.type, t.targetId.slice(0, 8), (() => { try { const u = new URL(t.url); return u.protocol + "//" + u.host + u.pathname; } catch { return t.url.slice(0, 80); } })());
const page = targetInfos.find((t) => t.type === "page" && t.url.includes("tv.youtube.com"));
const { sessionId } = await send("Target.attachToTarget", { targetId: page.targetId, flatten: true });
const expr = `(() => {
  const p = document.querySelector("#movie_player");
  const v = document.querySelector("#movie_player video.html5-main-video");
  const vids = [...document.querySelectorAll("video")];
  const err = document.querySelector(".ytp-error, .ytp-error-content, ytu-playback-error, [class*='playback-error']");
  const buf = v && v.buffered && v.buffered.length ? [v.buffered.start(0).toFixed(1), v.buffered.end(v.buffered.length - 1).toFixed(1)] : null;
  return {
    path: location.pathname,
    visibility: document.visibilityState,
    inner: innerWidth + "x" + innerHeight,
    videoElements: vids.length,
    videosWithSrc: vids.filter((x) => x.src || x.currentSrc).length,
    videosPlaying: vids.filter((x) => !x.paused && x.readyState >= 2).length,
    main: v ? { paused: v.paused, readyState: v.readyState, networkState: v.networkState, currentTime: Number(v.currentTime.toFixed(1)), w: v.videoWidth, h: v.videoHeight, error: v.error ? { code: v.error.code, message: v.error.message } : null, buffered: buf, ended: v.ended, seeking: v.seeking } : null,
    playerState: p && p.getPlayerState ? p.getPlayerState() : null,
    quality: p && p.getPlaybackQuality ? p.getPlaybackQuality() : null,
    errorOverlay: err ? (err.innerText || "").replace(/\\s+/g, " ").slice(0, 200) : null,
    jsHeap: performance.memory ? { usedMB: Math.round(performance.memory.usedJSHeapSize / 1048576), totalMB: Math.round(performance.memory.totalJSHeapSize / 1048576), limitMB: Math.round(performance.memory.jsHeapSizeLimit / 1048576) } : null,
  };
})()`;
for (let i = 0; i < 3; i++) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true }, sessionId);
  console.log(new Date().toISOString(), JSON.stringify(r.result?.value ?? r.exceptionDetails?.text));
  await new Promise((r) => setTimeout(r, 3000));
}
await send("Target.detachFromTarget", { sessionId }).catch(() => {});
ws.close();
````

**`probe2.mjs`**

````
// Read-only: player state + playability status of the YouTube TV tab. No navigation, no click.
const version = await (await fetch("http://127.0.0.1:9333/json/version")).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", () => rej(new Error("ws")), { once: true }); });
let id = 0; const pending = new Map();
ws.addEventListener("message", (ev) => { const m = JSON.parse(String(ev.data)); const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); });
const send = (method, params = {}, sessionId) => { const i = ++id; const msg = { id: i, method, params }; if (sessionId) msg.sessionId = sessionId; ws.send(JSON.stringify(msg)); return new Promise((res, rej) => { pending.set(i, { res, rej }); setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error("timeout " + method)); } }, 8000); }); };
const { targetInfos } = await send("Target.getTargets", { filter: [{}] });
const page = targetInfos.find((t) => t.type === "page" && t.url.includes("tv.youtube.com"));
const { sessionId } = await send("Target.attachToTarget", { targetId: page.targetId, flatten: true });
const expr = `(() => {
  const p = document.querySelector("#movie_player");
  const v = document.querySelector("#movie_player video.html5-main-video");
  let ps = null, vd = null;
  try { const r = p.getPlayerResponse && p.getPlayerResponse(); ps = r && r.playabilityStatus ? { status: r.playabilityStatus.status, reason: r.playabilityStatus.reason || null } : "no playabilityStatus"; } catch (e) { ps = "err " + e; }
  try { const d = p.getVideoData && p.getVideoData(); vd = d ? { isLive: d.isLive, isPlayable: d.isPlayable, errorCode: d.errorCode || null } : null; } catch (e) { vd = "err " + e; }
  return {
    path: location.pathname,
    main: v ? { paused: v.paused, readyState: v.readyState, networkState: v.networkState, currentTime: Number(v.currentTime.toFixed(1)), seeking: v.seeking, bufferedRanges: v.buffered.length, error: v.error ? v.error.code : null } : null,
    playerState: p && p.getPlayerState ? p.getPlayerState() : null,
    duration: p && p.getDuration ? Math.round(p.getDuration()) : null,
    playability: ps, videoData: vd,
    online: navigator.onLine,
  };
})()`;
const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true }, sessionId);
console.log(new Date().toISOString(), JSON.stringify(r.result?.value ?? r.exceptionDetails?.text));
await send("Target.detachFromTarget", { sessionId }).catch(() => {});
ws.close();
````

**`probe3.mjs`**

````
// Read-only: watch the YouTube TV tab's network events for 15 s. Hosts, paths and statuses only; no query strings.
const version = await (await fetch("http://127.0.0.1:9333/json/version")).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", () => rej(new Error("ws")), { once: true }); });
let id = 0; const pending = new Map(); const counts = new Map(); const urls = new Map();
const bump = (k) => counts.set(k, (counts.get(k) ?? 0) + 1);
const short = (u) => { try { const x = new URL(u); const h = x.host.replace(/^[a-z0-9-]+(\.googlevideo\.com)$/, "*$1"); return h + x.pathname.slice(0, 40); } catch { return String(u).slice(0, 40); } };
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(String(ev.data));
  if (m.method === "Network.requestWillBeSent") { urls.set(m.params.requestId, short(m.params.request.url)); bump("request  " + m.params.request.method + " " + short(m.params.request.url)); }
  if (m.method === "Network.responseReceived") bump("response " + m.params.response.status + " " + short(m.params.response.url));
  if (m.method === "Network.loadingFailed") bump("FAILED   " + (m.params.errorText || "?") + (m.params.canceled ? " (canceled)" : "") + " " + (urls.get(m.params.requestId) ?? "(request started before the watch)"));
  const p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
});
const send = (method, params = {}, sessionId) => { const i = ++id; const msg = { id: i, method, params }; if (sessionId) msg.sessionId = sessionId; ws.send(JSON.stringify(msg)); return new Promise((res, rej) => { pending.set(i, { res, rej }); setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error("timeout " + method)); } }, 8000); }); };
const { targetInfos } = await send("Target.getTargets", { filter: [{}] });
const page = targetInfos.find((t) => t.type === "page" && t.url.includes("tv.youtube.com"));
const { sessionId } = await send("Target.attachToTarget", { targetId: page.targetId, flatten: true });
await send("Network.enable", {}, sessionId);
await new Promise((r) => setTimeout(r, 15000));
await send("Network.disable", {}, sessionId).catch(() => {});
await send("Target.detachFromTarget", { sessionId }).catch(() => {});
console.log(new Date().toISOString(), "network events in 15 s on the YouTube TV tab:", counts.size ? "" : "NONE");
for (const [k, n] of [...counts].sort()) console.log(String(n).padStart(4), k);
ws.close();
````

## Appendix C — the run log

The cycle script's own log, unedited: point (b), each cycle's pull result and the
app's log lines for that cycle, then the failure snapshot (which repeats the
last 60 lines of the container log). The `pull exit=` lines end in an empty
field: the script looked for a `frame=` line that ffmpeg does not print when
copying; Table 3 takes the last line from each pull log instead.

````
2026-09-28T23:16:59Z waiting 805 s for point (b) at 2026-09-28T23:30:24Z
2026-09-28T23:30:24Z point (b): [tune] lines in the log so far: 0
2026-09-28T23:30:40Z point (b) measured
2026-09-28T23:30:40Z cycle 01: tune + pull start
2026-09-28T23:31:47Z cycle 01: pull exit=0 wall=67.2s moov_warnings=60 error_like_lines=0 | 
2026-09-28T23:32:10Z cycle 01: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 01 app log (docker logs --since 2026-09-28T23:30:40Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=594 layout=608 playing=1620 pinned=1622
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:21?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x651452b4e440] File ended prematurely at pos. 28109714 (0x1aceb92)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-28T23:32:37Z cycle 01: measured
2026-09-28T23:32:37Z cycle 02: tune + pull start
2026-09-28T23:33:42Z cycle 02: pull exit=0 wall=64.8s moov_warnings=60 error_like_lines=0 | 
2026-09-28T23:34:04Z cycle 02: idle stop + park seen 22.3 s after the pull ended; settling 10s
--- cycle 02 app log (docker logs --since 2026-09-28T23:32:37Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=583 layout=605 playing=1872 pinned=1874
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:31?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x6167baba2440] File ended prematurely at pos. 28075860 (0x1ac6754)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-28T23:34:31Z cycle 02: measured
2026-09-28T23:34:31Z cycle 03: tune + pull start
2026-09-28T23:35:36Z cycle 03: pull exit=0 wall=64.8s moov_warnings=60 error_like_lines=0 | 
2026-09-28T23:35:56Z cycle 03: idle stop + park seen 20.2 s after the pull ended; settling 10s
--- cycle 03 app log (docker logs --since 2026-09-28T23:34:31Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=565 layout=583 playing=1885 pinned=1892
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:41?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x63a9e91d2440] File ended prematurely at pos. 27902396 (0x1a9c1bc)
[app] [matroska,webm @ 0x63a9e91d2440] Seek to desired resync point failed. Seeking to earliest point available instead.
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-28T23:36:24Z cycle 03: measured
2026-09-28T23:36:24Z cycle 04: tune + pull start
2026-09-28T23:37:29Z cycle 04: pull exit=0 wall=64.9s moov_warnings=60 error_like_lines=0 | 
2026-09-28T23:37:51Z cycle 04: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 04 app log (docker logs --since 2026-09-28T23:36:24Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=591 layout=646 playing=1909 pinned=1910
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:51?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x5928288f2440] File ended prematurely at pos. 27872779 (0x1a94e0b)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-28T23:38:18Z cycle 04: measured
2026-09-28T23:38:18Z cycle 05: tune + pull start
2026-09-28T23:39:25Z cycle 05: pull exit=0 wall=66.7s moov_warnings=59 error_like_lines=0 | 
2026-09-28T23:39:47Z cycle 05: idle stop + park seen 22.3 s after the pull ended; settling 10s
--- cycle 05 app log (docker logs --since 2026-09-28T23:38:18Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=599 layout=612 playing=4219 pinned=4225
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:61?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x57ccbfd70440] File ended prematurely at pos. 28037095 (0x1abcfe7)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-28T23:40:14Z cycle 05: measured
2026-09-28T23:40:14Z cycle 06: tune + pull start
2026-09-28T23:41:19Z cycle 06: pull exit=0 wall=64.9s moov_warnings=60 error_like_lines=0 | 
2026-09-28T23:41:42Z cycle 06: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 06 app log (docker logs --since 2026-09-28T23:40:14Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=853 layout=856 playing=1901 pinned=1903
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:71?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x585236b61440] File ended prematurely at pos. 28277165 (0x1af79ad)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-28T23:42:09Z cycle 06: measured
2026-09-28T23:42:09Z cycle 07: tune + pull start
2026-09-28T23:43:14Z cycle 07: pull exit=0 wall=64.8s moov_warnings=60 error_like_lines=0 | 
2026-09-28T23:43:36Z cycle 07: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 07 app log (docker logs --since 2026-09-28T23:42:09Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=561 layout=594 playing=1869 pinned=1871
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:81?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x5a52c7335440] File ended prematurely at pos. 29861723 (0x1c7a75b)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-28T23:44:03Z cycle 07: measured
2026-09-28T23:44:03Z cycle 08: tune + pull start
2026-09-28T23:45:08Z cycle 08: pull exit=0 wall=64.9s moov_warnings=60 error_like_lines=0 | 
2026-09-28T23:45:30Z cycle 08: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 08 app log (docker logs --since 2026-09-28T23:44:03Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=568 layout=588 playing=1953 pinned=1955
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:91?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-28T23:45:58Z cycle 08: measured
2026-09-28T23:45:58Z cycle 09: tune + pull start
2026-09-28T23:47:02Z cycle 09: pull exit=0 wall=64.0s moov_warnings=59 error_like_lines=0 | 
2026-09-28T23:47:24Z cycle 09: idle stop + park seen 22.3 s after the pull ended; settling 10s
--- cycle 09 app log (docker logs --since 2026-09-28T23:45:58Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=581 layout=601 playing=1614 pinned=1615
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:101?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-28T23:47:51Z cycle 09: measured
2026-09-28T23:47:51Z cycle 10: tune + pull start
2026-09-28T23:48:56Z cycle 10: pull exit=0 wall=65.1s moov_warnings=60 error_like_lines=0 | 
2026-09-28T23:49:19Z cycle 10: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 10 app log (docker logs --since 2026-09-28T23:47:51Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=569 layout=578 playing=2143 pinned=2145
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:111?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-28T23:49:46Z cycle 10: measured
2026-09-28T23:49:46Z cycle 11: tune + pull start
2026-09-28T23:50:51Z cycle 11: pull exit=0 wall=64.7s moov_warnings=60 error_like_lines=0 | 
2026-09-28T23:51:13Z cycle 11: idle stop + park seen 22.2 s after the pull ended; settling 10s
--- cycle 11 app log (docker logs --since 2026-09-28T23:49:46Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=556 layout=564 playing=1719 pinned=1724
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:121?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-28T23:51:40Z cycle 11: measured
2026-09-28T23:51:40Z cycle 12: tune + pull start
2026-09-28T23:52:45Z cycle 12: pull exit=0 wall=64.9s moov_warnings=60 error_like_lines=0 | 
2026-09-28T23:53:07Z cycle 12: idle stop + park seen 22.3 s after the pull ended; settling 10s
--- cycle 12 app log (docker logs --since 2026-09-28T23:51:40Z)
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=569 layout=583 playing=1977 pinned=1982
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:131?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x63e77b1a2440] File ended prematurely at pos. 29645339 (0x1c45a1b)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
2026-09-28T23:53:35Z cycle 12: measured
2026-09-28T23:53:35Z cycle 13: tune + pull start
2026-09-28T23:54:05Z cycle 13: pull exit=8 wall=30.7s moov_warnings=0 error_like_lines=4 | 
[http @ 0x59452359c540] HTTP error 503 Service Unavailable
[in#0 @ 0x59452359be40] Error opening input: Server returned 5XX Server Error reply
Error opening input file http://127.0.0.1:8091/stream/UCZmySpv9dwlwsU2ZxS0pipQ/index.m3u8.
Error opening input files: Server returned 5XX Server Error reply
2026-09-28T23:54:05Z FAILURE: cycle 13: pull exited 8
--- snapshot: health
status: ok
channels: 375
enumerated: 2026-09-28T23:12:47.198Z
state: idle
quality: hd1080
provider: -
channel: - (-)
since: -
chunks_in: 0
bytes_in: 0
segments: 0
last_access: -
last_error: -
--- snapshot: docker ps
marlin-cast-recon Up 41 minutes
--- snapshot: last 60 log lines
[app] [tune-ms] WBAL 11 nav=599 layout=612 playing=4219 pinned=4225
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:61?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x57ccbfd70440] File ended prematurely at pos. 28037095 (0x1abcfe7)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=853 layout=856 playing=1901 pinned=1903
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:71?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x585236b61440] File ended prematurely at pos. 28277165 (0x1af79ad)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=561 layout=594 playing=1869 pinned=1871
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:81?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x5a52c7335440] File ended prematurely at pos. 29861723 (0x1c7a75b)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=568 layout=588 playing=1953 pinned=1955
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:91?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=581 layout=601 playing=1614 pinned=1615
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:101?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=569 layout=578 playing=2143 pinned=2145
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:111?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=556 layout=564 playing=1719 pinned=1724
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:121?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080","available":["hd1080","hd720","large","medium","small","auto"]}
[app] [tune-ms] WBAL 11 nav=569 layout=583 playing=1977 pinned=1982
[app] [capture] WBAL 11 recording {"aspectRatio":1.7777777777777777,"deviceId":"web-contents-media-stream://8:131?local_echo=false","frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
[app] [stop] WBAL 11: idle 20000ms with no client request
[app] [ffmpeg] [matroska,webm @ 0x63e77b1a2440] File ended prematurely at pos. 29645339 (0x1c45a1b)
[app] [ffmpeg] exited code=255 signal=null
[app] [stop] parked the youtubetv tab on https://tv.youtube.com/live
[app] [tune] WBAL 11 (UCZmySpv9dwlwsU2ZxS0pipQ): provider youtubetv, tab E59215A850BA71DC06F85877A831F91B (https://tv.youtube.com/live)
[app] [serve] Error: player ready: not satisfied within 30000ms — last probe {"ok":false,"w":1920,"h":1080,"paused":false,"readyState":1}
2026-09-28T23:54:23Z STOPPED
````

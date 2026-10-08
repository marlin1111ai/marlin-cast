# Recon — idle CPU, network and memory; the park pages (2026-10-07) — D038

Date: 2026-10-07, 08:51–10:37 EDT (12:51–14:37Z) for the recon; the fix and
its acceptance from 11:00 EDT, with an overnight idle into 2026-10-08. Host:
marlinpc. Directed by the owner (no foreman since 2026-10-07; `CLAUDE.md`).
Nothing on 192.168.1.250 or 192.168.1.30 was contacted. No owner Chrome was
running on marlinpc (nothing on 8091/8092/8804/9333). `data/chrome-profile`
was not read. `backups/` was read with `tar -xzf` and hashed (sha256
`6ebd9ea9…258dbe3`, unchanged). `VNC_PASSWORD` was a throwaway passed by
`--env-file` from a 0600 scratch file. No credential appears in this report.

**The owner's question.** The Unraid container keeps using CPU, downloading
and slowly growing while nothing is watched: 973.2 MiB / 14.82% CPU at 10-06
22:55 EDT; 1.202 GiB / 13.25% at 10-07 08:26, network in 2.34 GB → 10.8 GB
and out 1.22 GB → 4.4 GB over the night (≈5 GB downloaded and never served,
≈0.5 GB/hour). Working theory: the tab parked on `tv.youtube.com/live` keeps
playing video. The owner asked for findings before any code change.

**Result.** The theory holds in substance: the parked YouTube TV guide plays
the live thumbnails of every channel row on screen — seven muted 426×240
streams (`video.ytu-tenx-video`, 144 such elements on the page) — for as long
as that tab is the visible one. Measured idle, YouTube TV guide in front:
1.6–2.4 Mbit/s from `googlevideo.com` (≈0.75 GB/hour), 37–40% of one core
(renderer 21–25%, GPU process 10%). The previews stop the moment another tab
is in front. Philo's parked guide downloads nothing but keeps its renderer at
about a fifth of a core while visible, and is silent when hidden. No ffmpeg,
HLS directory or capture survives an idle stop. The fix (D038): park YouTube
TV on `/library` (0 kbit/s, <1% CPU, no video) and, after a Philo park, bring
the YouTube TV tab to the front.

---

## Method

A throwaway container `marlin-cast-idle` from `ghcr.io/marlin1111ai/marlin-cast:sha-0f042a9`
(the image Unraid runs) on a working copy of the two-provider backup, the
brief's run line (`--cap-add SYS_ADMIN --shm-size=1g`, 8091→8804, 8092→6080,
PUID/PGID 99/100, no size env). One measurement point = `docker stats
--no-stream`; inside the container, per process: RSS, RssAnon and cumulative
CPU from `/proc`, plus `eth0` byte counters; then a read-only CDP probe over
the container's own loopback 9333 that attaches to each page target, reads
every `<video>` (paused, currentTime, readyState, size, src) before and after
a 60 s window, counts `Network.loadingFinished` bytes per host over the
window, reads `Performance.getMetrics` (TaskDuration, JSHeapUsed, Nodes,
Documents) and differences `SystemInfo.getProcessInfo` cpuTime per Chrome
process. A tune = a player-like pull (playlist every 2 s, newest segment)
for 60 s, then the 20 s idle stop and park. Scripts: `ps.sh`, `probe.mjs`,
`measure.sh`, `pull.sh` (scratchpad, deleted after).

The 2026-09-13 backup's YouTube TV tab read SIGNED OUT at boot (landed on
`/welcome`, as in task-033's first part) and was signed in two minutes later
with the guide rendered and the account avatar present; nothing was done
about it. Both providers tuned.

## Measurements

**Table 1 — what each parked page does while it is the visible tab** (60 s
windows; CPU is the sum over Chrome processes as a share of one core)

| front tab, page | download | Chrome CPU | `<video>` playing | page TaskDuration / 60 s |
|---|---|---|---|---|
| YouTube TV `/live` (park, task-018) | 1616–2361 kbit/s, 168–170 responses, all `r*.googlevideo.com` XHR | 34.9–40.0% (renderer 196: 21–25%; GPU 73: 10–11.6%; network service 2%) | 7 of 145 (426×240, muted, blob src, currentTime advancing) | 3.0–3.3 s |
| YouTube TV `/` (home; the login check leaves the tab here) | 1670 kbit/s | 29.8% | 6 | 1.0 s |
| YouTube TV `/library` | 0 (1 response, 0 kB) | 0.9% | 0 | 0.1 s |
| YouTube TV `/settings` (→ `/settings/subscriptions`) | 0 | 0.9% | 0 | 0.1 s |
| `about:blank` | 0 | 0.3% | 0 | 0.0 s — **but the next tune fails: "no youtubetv tab open — no page target with host tv.youtube.com"** (D018 selects the tab by host) |
| Philo `/player/guide` (park) | 0 | 20.1–20.7% (renderer 181: 17.7–18.7%; GPU 1.7%) | 0 (no `<video>` on the page) | 7.5 s |
| Philo `/player/mytv` | 0 | 17.2% (renderer 11.4%, GPU 5.2%) | 0 | 3.2 s |

The hidden tab, whichever it was, read 0 responses and 0.0–0.1 s TaskDuration
in every window: YouTube TV `/live` behind Philo for 20 minutes (4 points),
Philo's guide behind YouTube TV for 60 minutes (7 points).

**Table 2 — the hour idle with YouTube TV `/live` in front, after one WBAL 11
tune** (y0 is 10 s after the park)

| point | UTC | docker stats | container net in | renderer 196 RssAnon | all Chrome RssAnon | YouTube TV tab kbit/s |
|---|---|---|---|---|---|---|
| y0 | 13:18 | 1.22 GiB | 249 MB | 390,948 kB | 967,160 kB | 1666 |
| y5 | 13:23 | 1.012 GiB | 309 MB | 265,936 | — | 1848 |
| y10 | 13:28 | 1.076 GiB | 370 MB | 253,536 | 647,664 | 1564 |
| y20 | 13:38 | 1.214 GiB | 498 MB | 270,620 | — | 1919 |
| y30 | 13:48 | 1.339 GiB | 632 MB | 274,896 | 670,440 | 1944 |
| y45 | 14:03 | 1.556 GiB | 850 MB | 278,924 | — | 1974 |
| y60 | 14:18 | 1.78 GiB | 1.05 GB | 313,852 | 711,348 | 1992 |

Net in grew 12–14 MB/minute throughout (0.72–0.84 GB/hour). Process memory:
the YouTube TV renderer's anonymous memory rose from 253,536 to 313,852 kB
between y10 and y60 (+59 MB in 50 minutes, ≈1.2 MB/minute); every other
process was flat (browser 30: 91.3 MB; GPU 73: 40.6 MB; Philo renderer 181:
85.7–87.7 MB; app node: 47.9–49.0 MB; extension renderer 2688: 30.8 MB). The
page's JS heap stayed at 65–86 MB and its node count at 102,837, so the
growth is not script objects; it is consistent with media buffers for seven
streams and was not seen to level off within the hour. With Philo in front
instead (p0–p20, 20 minutes, 0 kbit/s) all-Chrome RssAnon read 647,664 kB at
both ends.

**`docker stats` on this host is not the memory to read.** It climbed 13
MB/minute while no process did. `/sys/fs/cgroup/memory.stat` at 13:48 and
14:17: `anon` 673 → 797 MB; `shmem` 689 → 1093 MB; `inactive_file` 6–7 MB;
`active_file` 0. The 404 MB of shmem growth is not `/dev/shm` (32 MB), not
SysV segments (65, 33 MB, none unattached), not memfd (0), not deleted-open
files (0): it is the profile working copy itself, which lives on marlinpc's
tmpfs `/tmp`. Chrome's HTTP cache there (`Default/Cache`, 1.24 → 1.20 GB,
at its cap) churns at the download rate, and each new entry is charged to
the container while the evicted one had been charged to the host's `tar`.
On Unraid `/data` is on disk, so the same writes are reclaimable page cache;
the owner's `memory.stat` reading from the real container is the number to
compare (asked for, pending).

**Tune time from each park page** (one WBAL 11 tune each, `[tune-ms]` playing
stage, ms; the earlier baseline from `/live` was 1740): `/live` 1740 ·
`/library` 1816 · `/` 2245 · `/settings` 1442 · `about:blank` failed (above).
Philo AMC from `/player/mytv` 5131, from `/player/guide` 4667 (Philo's seek
past the DVR window dominates either way).

**Stops.** Every idle stop in the run (Philo ×3, YouTube TV ×7) logged
`[stop] … idle 20000ms`, `[ffmpeg] exited code=255`, `parked the … tab`; 0
ffmpeg processes and an empty HLS scratch at every parked point; the app's
CPU 0.5–3.8 s cumulative over two hours.

**Startup.** Fresh boot with enumeration leaves the YouTube TV tab on `/live`,
visible, 7 previews playing. A restart with `channels.json` present leaves
it on `/` (the login check's home URL), visible, 6 previews playing. Either
way the container idles loud until the first YouTube TV tune parks it — a
decision for the owner (open question 1).

## The fix (D038) — files touched

| File | Change |
|---|---|
| `src/providers/types.ts` | `Provider.parkHidden: boolean` — the parked page keeps its renderer busy while visible |
| `src/providers/youtubetv.ts` | `PARK_URL = https://tv.youtube.com/library`; `parkUrl` uses it; `GUIDE_URL` stays for enumeration; `parkHidden: false` |
| `src/providers/philo.ts` | `parkHidden: true`; comment |
| `src/capture.ts` | `stop()`: after an idle park of a `parkHidden` provider, `findPageTarget` for another provider and `Target.activateTarget` it; logged, never thrown; imports `PROVIDERS` |
| `notebook/DECISIONS.md`, `notebook/SESSION-STATE.md`, `notebook/COLD-START.md`, this report | records |

No dependency added, no entrypoint or Dockerfile change, `IDLE_MS` unchanged.
The type check (`tsc --noEmit --strict`, no `@types/node` in the project)
reports the same 79 pre-existing errors before and after.

## Acceptance (owner's conditions)

Test container `marlin-cast-d038` from a local build of the change (same
Dockerfile), same working copy and run line. Both providers signed in at boot.

**A. Philo tunes from the hidden state.** Before each tune the probe read the
YouTube TV tab visible on `/library` and the Philo tab hidden on its guide.
Six channels in a row, each pulled 30 s, then the idle stop; after every stop
the log carried `parked the philo tab` and `brought the youtubetv tab to the
front`, and the next tune found that state.

| # | channel | first playlist (ms) | tune-ms playing | overlay |
|---|---|---|---|---|
| 1 | AMC | 5684 | 3216 | clear after 1 sweep |
| 2 | HISTORY | 17240 | 14767 | **did NOT clear after 3 sweeps** (task-021 warning; controls burnt in) |
| 3 | A&E | 17332 | 14854 | **did NOT clear after 3 sweeps** |
| 4 | AccuWeather Network | 7186 | 4727 | clear after 1 sweep |
| 5 | American Heroes Channel | 18344 | 15880 | clear after 2 sweeps |
| 6 | AMC | 7698 | 5235 | clear after 1 sweep |

All six tuned (`ok:true`, 720p, 15 segments each); no error, no 503. Across
the day's 21 Philo tunes in this container (about 15 of them from the hidden
state), 18 cleared the overlay after one sweep, one after two, and the two
above stuck — the first stuck overlays seen today, back to back, on channels
that had cleared in one sweep 15 minutes earlier from the same hidden start.
Whether the hidden start plays any part is not shown by this sample; the
overlay behaviour is the one task-021 recorded and D029 closed. Tune time
otherwise 3.2–5.2 s, as before the change.

**B. Cross-provider switch, YouTube TV live → Philo, then idle (before D039).** After
Philo's idle park and the bring-forward, the YouTube TV tab was in front on
its *watch* page, still playing WBAL 11 at 4197 kbit/s with Chrome at 141%
of a core. **C. Philo live → YouTube TV, then idle.** YouTube TV parked on
`/library` (quiet); the Philo tab, hidden, was still on its broadcast page
playing AMC at 4262 kbit/s. A channel switch stops the capture but does not
park the previous tab (task-018 gated the park on the idle path), so a
switch between providers leaves the old channel playing indefinitely — in
B's case now visibly. This is pre-existing and larger than the previews;
raised to the owner (open question 1).

**D. The overnight state.** Philo tuned once more and parked: YouTube TV
`/library` visible, Philo guide hidden; 60 s window: 0 kbit/s on both tabs,
Chrome 0.8% of a core in total, `docker stats` CPU 7.86% (the viewer's
x11vnc and Xvfb). Left idle from 15:28Z.

**E. Side-by-side: Philo tunes from a hidden start against a visible start
(owner's condition before accepting the bring-forward half).** Second test
container `marlin-cast-d040` (image from the three commits), 16:00–16:39Z.
Same five channels (AMC, HISTORY, A&E, AccuWeather Network, American Heroes
Channel), two passes of 20 tunes, arms alternating: *hidden* = the YouTube
TV tab in front on `/library`, as the new code leaves it; *visible* = the
Philo tab activated (no navigation) four seconds before the tune. Each tune
pulled 20 s, then the idle stop. All 40 tuned (`ok:true`, HTTP 200).

| arm (20 each) | overlay clear on sweep 1 | cleared on sweep 2–3 | stuck after 3 sweeps | tune-ms playing: median / mean / range |
|---|---|---|---|---|
| hidden start | 11 | 2 | 7 | 5.0 s / 8.7 s / 3.2–14.7 s |
| visible start | 14 | 1 | 5 | 3.5 s / 6.3 s / 3.2–13.0 s |

Per pass: pass 1 hidden 7 / 1 / 2, visible 9 / 0 / 1; pass 2 hidden 4 / 1 /
5, visible 5 / 1 / 4. The stuck rate rose through the afternoon in both arms
(0 of the day's first 13 Philo tunes, then 3 of 20 in pass 1, 9 of 20 in pass
2), and stuck tunes came in runs across both arms (pass 1 tunes 13–15; pass 2
tunes 1–4, 9–11, 14–15), which points at a Philo-side condition rather than
the start state. A stuck tune costs about 11 s more and, per task-021, the
player's title bar, scrubber and buttons are in the capture. The hidden arm
read worse by two stuck tunes in 20 and a 1.5 s longer median; with this
sample that is not a clear difference, and it is the owner's call.

For the owner's count: of the first test container's 21 Philo tunes
(14:58–15:26Z), 19 started hidden and 2 started with the Philo tab visible
on a playing broadcast page (channel switches, not guide starts); the recon
container's 3 Philo tunes were 1 hidden, 2 visible. Note that before D038 a
Philo tune after any YouTube TV tune already started hidden (the YouTube TV
tab is activated at tune and stays in front after its park), so dropping the
bring-forward would not remove hidden Philo starts; it would only make them
less frequent.

**F. The morning after (the owner's second condition): passed.** The test
container `marlin-cast-d038` (image with D038 only; D039 and D040 do not
touch this path) sat idle from 15:28Z on 2026-10-07 to 12:03Z on
2026-10-08, about 20.5 hours, with YouTube TV on `/library` in front and
Philo's guide hidden. The check was run by the PC's own cron
(`~/marlin-cast-overnight-check/run.sh`, a one-shot line that removed
itself), so it did not depend on the Claude window, which had reset once
that day.

- Before any tune: both tabs on their park pages, 0 videos playing, 0
  kbit/s on both tabs over 60 s, Chrome 0.7% of a core. Container network
  in: 1.60 GB at 15:28Z, 1.61 GB at 02:55Z, 1.62 GB at 12:03Z — about 20 MB
  in 20.5 hours, against ≈0.75 GB/hour with the guide in front.
- Memory: all-Chrome RssAnon 554,276 kB, below the 647,664 kB of the
  previous day's startup and the 711,348 kB after an hour of previews;
  cgroup `anon` 530 MB. No overnight growth.
- The YouTube TV page read signed in (`signInText:false`, avatar present).
- First YouTube TV tune (WBAL 11, from `/library`): HTTP 200, playing at
  2271 ms, hd1080; parked on `/library` after the idle stop.
- First Philo tune (AMC): HTTP 200, playing at 3828 ms, overlay clear after
  one sweep; parked, YouTube TV brought forward.
- Neither tune met a sign-in page.

## Open questions — the owner's call

1. ~~A switch between providers leaves the old tab playing~~ — ruled and
   done as **D039** (own commit `e02bb79`). Verified on a second test
   container (`marlin-cast-d040`, image from the two new commits): YouTube
   TV → Philo left YouTube TV on `/library` hidden; Philo → YouTube TV left
   Philo on its guide hidden with YouTube TV brought forward; after the idle
   stop both tabs read 0 kbit/s, Chrome 2.0% of a core.
2. ~~Startup state~~ — ruled and done as **D040** (own commit `2b1c63c`),
   with the owner's condition: a tab is parked only once it is confirmed
   signed in on the page it is on, and a tab on a sign-in page is never
   navigated. Verified on both boot paths: `[start] parked the youtubetv tab
   on …/library (was …/live)` after a fresh enumeration and `(was
   https://tv.youtube.com/)` after a restart with the cache present; Philo
   parked from `/player/mytv`; YouTube TV brought to the front; nothing
   playing.
3. ~~`VERSION`~~ — the owner ruled 0.1.3, its own commit (`d4dd858`).
   The bring-forward half of D038 stays after the side-by-side (E); the
   stuck overlay is its own open item in `notebook/OPEN-ITEMS.md`.
4. **The Unraid readings** (three read-only commands) were requested on
   2026-10-07 and had not arrived when this report was written.

## Least sure of

1. Whether the ≈1.2 MB/minute growth of the YouTube TV renderer with previews
   playing levels off; one hour was not enough to say, and with `/library`
   parked the question is moot unless the tab is left on the guide.
2. That `/library` never grows a preview of its own. Measured at one dwell
   (about 3 minutes) and overnight (below); YouTube TV can change its pages.
3. The first-boot SIGNED OUT reading of the backup's YouTube TV tab, as in
   task-033: not pursued.

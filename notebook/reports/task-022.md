# Task 022 — stable stream URLs keyed on stationId / channelId

Date: 2026-09-12, 20:44–21:08 EDT (2026-09-13 00:44–01:08Z). Host: marlinpc.
The owner's Chrome (pid 211475) was never restarted. The owner's YouTube TV tab
(`2ECEBF96E5AFE582C2D58E386A6D3DBA`) and Philo tab
(`76E9F816D85770921EF954D0ED6767D3`) were driven **only** through the app's own
enumerate/tune/park paths. One throwaway status-page tab was created for V7 and
closed; page/tab target ids were identical before and after. Nothing on
192.168.1.250 was contacted. `extension/` and `scripts/` are unchanged. No
credentials, cookies, tokens, session ids or account identifiers appear in
code, logs, this report or the notebook.

**Result: STOPPED at V5.** Steps 1–6 are built and V1–V4 and V7 pass. V5 (the
rotation drill) failed: a genuinely rotated YouTube TV watch id **still plays**
(an ESPN logo slate). Step 4's trigger (poll 1 fails) never fires for it, so
the re-read did not run and the cache was not corrected. Per STOP-AND-REPORT:
no retry, and the owner-specified trigger was not widened.

**After the stop, on the owner's instruction:** the build was committed and
pushed as-is, and `npm run channels` was re-run. That run is V6, and it also
replaced the drilled cache row. **V6 found the D020 key is not durable for
discrete event feeds:** 20 minutes after V2, ESPN rows 24 and 25 came back
with new stationIds (and new watch ids). Row 23, and all 142 other YouTube TV
keys present in both runs, were unchanged.

---

## Result per step

| Step | Result |
|---|---|
| 1 notebook | done — D020, D021, D022 appended to `notebook/DECISIONS.md` (dated 2026-09-12, owner-ruled); notes added under D013 and D015 |
| 2 YouTube TV enumeration | done — rows read from the guide page's own `/youtubei/v1/browse` response; per row `key` (stationId), current watch id, name, `discrete`, `position`, logo (unchanged DOM source); skipped rows counted and named. Philo unchanged apart from `key` = channelId |
| 3 playlist writer | done — `tvg-id` = key, `/stream/<key>/index.m3u8`, D022 names, `/playlist/youtube-tv` and `/playlist/philo`, D015 line re-keyed |
| 4 router and tune | done — routes, HLS directory, ingest, `byKey`, duplicate check all on `key`; YouTube TV poll-1 miss → one guide re-read → cache update → one retry → fatal with stationId and both watch ids. **V5 shows the trigger does not cover a stale watch id that still plays** |
| 5 status page | done — tuned row shows provider, name and key |
| 6 SESSION-STATE | done — entry recorded as STOPPED at V5 |

---

## Files touched, mapped to steps

| File | Step | Change |
|---|---|---|
| `notebook/DECISIONS.md` | 1 | D020, D021, D022; note under D013 (browse-only rows are not channels); note under D015 (sliver re-keyed to `UCW7W_WAogi3qWDbO9PqOmZQ`) |
| `src/providers/types.ts` | 2, 3, 4 | `Channel.key`, `discrete`, `position`; `Provider.slug`; `Enumerated` / `Skipped`; `TuneCtx.saveChannel` |
| `src/providers/youtubetv.ts` | 2, 3, 4 | `readGuide`: Network capture of the guide's `/youtubei/v1/browse` body, `parseGuide`, join to tiles on watch id, skip rows with no stationId / no watch link; `slug: "youtube-tv"`; `navigate` with the single re-read + retry. Polls 3 and 4, the tile DOM read and `checkSignedIn` are unchanged in content |
| `src/providers/philo.ts` | 2, 3 | `key: row.channelId`; `slug: "philo"`; returns `{ channels, skipped: [] }` |
| `src/cdp.ts` | 2 | listeners receive the event's `sessionId`; `off()` added |
| `src/channels.ts` | 2, 4 | skipped rows logged per provider; duplicate check on `key` (and missing key is an error); `saveChannel()` writes one changed row back, matched on provider + key |
| `src/capture.ts` | 4, 5 | `dirFor` / `touch` / `ensure` / ingest URL / `ingest()` on `key`; `ctx.saveChannel`; `Status.channelKey`. **ffmpeg arguments untouched** (not in the diff) |
| `src/server.ts` | 3, 4, 5 | `byKey`; refuses a cache with no keys; `playlist()` writer (tvg-id, URL, D022 names, D015 key); `/playlist/:slug`; `/stream/:key/…`, `/ingest/:key/:token`; status page and `/health` channel line show the key |
| `notebook/SESSION-STATE.md` | 6 | Task 022 entry |
| `notebook/reports/task-022/` | V5, V7 | `status-tuned.png`, `v5-stale-watch-id-frame.png`, `v4-event1-current-watch-id-frame.png` |

Not touched: `extension/*`, `scripts/*`, `src/login.ts`, `src/providers/index.ts`, `package.json`.

Typecheck: `tsc --noEmit --strict` over `src/` reports no error in
`src/providers/*`, `src/channels.ts` or `src/cdp.ts` beyond missing Node type
definitions (`@types/node` is not installed; no installs). One real finding in
the new code was fixed: TypeScript typed `rows` as `never` after `try/finally`,
now declared explicitly. The remaining errors (`cache` possibly null, implicit
`any` on express handlers, `login.ts`, ffmpeg callbacks) come from the missing
typings or predate this task.

---

## V1 — baselines before any code change

```
/tmp/channels-pre-task022.json   177,614 bytes   md5 14c4e31b3b85948d45f9f3d98b0257f5  (= data/channels.json at the time)
/tmp/playlist-pre-task022.m3u    HTTP 200, 111,435 bytes, 743 lines, 371 entries, md5 a11dbde5ce00f2568cd413aa9b4aca4d
```

The playlist was served by the pre-change code, started in background mode for
this purpose and stopped with the task handle (no `pkill`).

## V2 — `npm run channels`

20:52:05–20:52:18 EDT:

```
[youtubetv] guide rows 151, tiles 144, channels 144, skipped 7
[channels] youtubetv: 144 (skipped 7)
[philo] 226 channels, totalCount 226, tiers {"Favorite channels":2,"All channels":74,"Free channels":150}
[channels] philo: 226 (skipped 0)
enumerated 370 channels at 2026-09-13T00:52:18.461Z
  skipped guide rows (7):
      row 8  Univision  — no watch link
      row 26  ESPN  — no stationId, no watch link
      row 30  NBCSN Extra  — no watch link
      row 31  NBCSN Extra  — no watch link
      row 32  NBCSN Extra  — no watch link
      row 46  Cartoon Network  — no watch link
      row 133  WNBA on ION  — no watch link
```

The `/youtubei/v1/browse` response was obtained from the app's own guide
navigation (151 rows), so the step-2 STOP condition did not arise.

**Seven skipped, not the six the D013 note names:** Univision (row 8) had a
watch id `AGPTgVlWtnk` at the 17:39Z enumeration and no watch link in this
read. That is lineup drift observed by this run, not a code effect.

Hand verification of `data/channels.json`:

```
count 370, byProvider {youtubetv: 144, philo: 226}; counted yt 144, philo 226
keys missing: 0 | distinct keys: 370 of 370 | duplicates: []
keys not [A-Za-z0-9_-]: []
yt keys all "UC"+22: True | philo key == id: True | yt/philo key overlap: False
yt distinct watch ids 144 | discrete true: rows 23, 24, 25 (all "ESPN")
{"position": 17, "name": "ESPN", "key": "UCW7W_WAogi3qWDbO9PqOmZQ", "id": "MrXg0chrojg", "discrete": false}
{"position": 23, "name": "ESPN", "key": "UCeQPSwZWpyy-hv5ilkHLQDA", "id": "1oayVaJRVjQ", "discrete": true}
{"position": 24, "name": "ESPN", "key": "UCuVFZEpGlcrfG3BiZ6XJo8g", "id": "zYW9jZ58KJg", "discrete": true}
{"position": 25, "name": "ESPN", "key": "UCaGNTzawhkMIUtu5_OKM-ng", "id": "FMOpHKcYYos", "discrete": true}
```

Saved as `/tmp/channels-v2-task022.json` (md5 `25ca7dbc71c6a0b2a1be90a5e57ae596`)
for V6.

## V3 — the three playlists

```
/playlist             741 lines, 370 entries
/playlist/youtube-tv  289 lines, 144 entries
/playlist/philo       453 lines, 226 entries
entries 144 + 226 == 370; body lines (288 + 452) == 740; /playlist body == youtube-tv body + philo body, in order
370 URLs, all http://127.0.0.1:8804/stream/<seg>/index.m3u8, every <seg> a key, tvg-id == URL key on every entry
URLs containing any YouTube TV watch id: []   URLs containing a Philo broadcast id: []   any "watch" in a URL: False
group-titles: /playlist {Philo, YouTube TV}; youtube-tv {YouTube TV}; philo {Philo}
```

```
#EXTINF:-1 tvg-id="UCW7W_WAogi3qWDbO9PqOmZQ" tvg-name="ESPN" group-title="YouTube TV" tvc-guide-stationid="32645",ESPN
#EXTINF:-1 tvg-id="UCeQPSwZWpyy-hv5ilkHLQDA" tvg-name="ESPN (event 1)" group-title="YouTube TV",ESPN (event 1)
#EXTINF:-1 tvg-id="UCuVFZEpGlcrfG3BiZ6XJo8g" tvg-name="ESPN (event 2)" group-title="YouTube TV",ESPN (event 2)
#EXTINF:-1 tvg-id="UCaGNTzawhkMIUtu5_OKM-ng" tvg-name="ESPN (event 3)" group-title="YouTube TV",ESPN (event 3)
```

(`tvg-logo` omitted above for width.) Exactly one `tvc-guide-stationid` line,
and exactly three `(event` lines.

Against V1:
- **Philo section:** byte-identical (226 entries). Philo's key equals its id,
  so its URLs did not change.
- **YouTube TV:** 0 of the stream URLs are shared (every URL moved from watch
  id to stationId, as D020 intends).
- **YouTube TV names:** the only differences are D022 and lineup drift. Only
  before: Cartoon Network, NBCSN Extra, Univision. Only now: Adult Swim,
  BTN Overflow 1, ESPN (event 1/2/3).

```
/stream/MrXg0chrojg/index.m3u8 -> 404      (old watch-id URL)
/stream/1oayVaJRVjQ/index.m3u8 -> 404      (current watch id is not a key)
/playlist/nope                 -> 404
```

## V4 — tunes via the app, pulled with a local ffmpeg

`node pull.mjs <key> <seconds>`, a scratchpad helper, does the following:
- cold `GET /stream/<key>/index.m3u8`
- `ffmpeg -c copy -t <s>` pull
- `/health` every 30 s
- ffprobe of the result
- 30 s wait, then `/health`, `pgrep -x ffmpeg` and the HLS directory count

| | real ESPN (row 17) | ESPN (event 1) (row 23) | Philo AMC |
|---|---|---|---|
| key | `UCW7W_WAogi3qWDbO9PqOmZQ` | `UCeQPSwZWpyy-hv5ilkHLQDA` | `Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk1MDg` |
| cold tune (HTTP 200) | 7.16 s | 4.08 s | 8.49 s |
| provider id used | watch `MrXg0chrojg` | watch `1oayVaJRVjQ` | broadcast `QnJvYWRjYXN0OjYwODU0ODg5OTY4MjY3NDUyNw` "The Lost World: Jurassic Park", resolved at tune time |
| `/health` quality | hd720 | hd720 | 720p |
| pull | 125.02 s, exit 0 | 125.02 s, exit 0 | 125.01 s, exit 0 |
| ffprobe | h264 High 1920×1080 30/1 + aac LC 48 kHz 2ch | same | same |
| pull log | 0 error-like lines; only "Found duplicated MOOV Atom" (task-015 artifact) | same | same |
| after 30 s idle | `state: idle`, 0 ffmpeg, 0 HLS dirs, tab parked on `/live` | same | same, tab parked on `/player/guide` |

`/health` during the ESPN run:

```
state: streaming | quality: hd720 | provider: YouTube TV | channel: ESPN (UCW7W_WAogi3qWDbO9PqOmZQ) | chunks_in: 61 | segments: 11
```

Server lines for the three runs:

```
[tune] ESPN (UCW7W_WAogi3qWDbO9PqOmZQ): provider youtubetv, tab 2ECEBF96E5AFE582C2D58E386A6D3DBA (https://tv.youtube.com/live)
[tune] ESPN WARNING: channel offers no hd1080 — settled at hd720 (available: ["hd720","large","medium","small","auto"])
[tune-ms] ESPN nav=714 layout=731 playing=2114 pinned=2119
[tune] ESPN (UCeQPSwZWpyy-hv5ilkHLQDA): provider youtubetv, tab 2ECEBF96E5AFE582C2D58E386A6D3DBA (https://tv.youtube.com/live)
[tune-ms] ESPN nav=565 layout=579 playing=1602 pinned=1606
[tune] AMC (Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk1MDg): provider philo, tab 76E9F816D85770921EF954D0ED6767D3 (https://www.philo.com/player/guide)
[philo] AMC: broadcast QnJvYWRjYXN0OjYwODU0ODg5OTY4MjY3NDUyNw "The Lost World: Jurassic Park" (2026-09-13T00:00:00.000Z -> 2026-09-13T03:00:00.000Z) via tileGroupId
[philo] AMC: seek to live 4s -> 3068s
[philo] AMC: control overlay clear after 1 sweep(s) (playerOverlayContainer___XBnR5)
[tune-ms] AMC nav=788 layout=794 playing=5842 pinned=5844
```

**"Real ESPN by stationId (hd1080 reached)" — hd1080 cannot be reached on
ESPN.** It advertises `["hd720","large","medium","small","auto"]`: the recorded
task-011 property of that channel (KNOWN-FIXES). To show the hd1080 path still
works under key routing, TNT was tuned by key for a 15 s pull:

```
[tune] TNT (UCMrLeKNQLIcj2l1k4yqkILQ): provider youtubetv, tab 2ECEBF96E5AFE582C2D58E386A6D3DBA (https://tv.youtube.com/live)
[tune] TNT {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080",…}
HTTP 200 in 4.41 s; 15.02 s pulled; idle: 0 ffmpeg, 0 HLS dirs
```

Encoder teardown logs `[ffmpeg] exited code=255` with a `matroska … File ended
prematurely` last error on every idle stop. Nothing changed there; it is
the encoder's stdin being closed mid-cluster by `stop()`.

## V5 — rotation drill: FAILED (the stop)

**Setup.**
1. Stopped the server.
2. In `data/channels.json`, set ESPN (event 1) row 23, key
   `UCeQPSwZWpyy-hv5ilkHLQDA`, to its own **genuinely rotated** watch id from
   the 17:39Z enumeration. That id was absent from the V2 guide read.

   ```
   before: {"id": "1oayVaJRVjQ", "href": "watch/1oayVaJRVjQ?vp=0gEEEgIwAQ%3D%3D"}
   after : {"id": "I1jTpQKv5A0", "href": "watch/I1jTpQKv5A0?vp=0gEEEgIwAQ%3D%3D"}
   ```

3. Restarted the server and tuned the key.

**What happened:**

```
[01:05:33Z] GET /stream/UCeQPSwZWpyy-hv5ilkHLQDA/index.m3u8 (cold tune)
[01:05:37Z] HTTP 200 in 4.34 s
[tune] ESPN (UCeQPSwZWpyy-hv5ilkHLQDA): provider youtubetv, tab 2ECEBF96E5AFE582C2D58E386A6D3DBA (https://tv.youtube.com/live)
[tune] ESPN {"ok":true,"target":"hd720","quality":"hd720","is1080":false,"video":"1280x720",…}
[tune-ms] ESPN nav=590 layout=608 playing=1684 pinned=1687
20.01 s pulled, h264 1920x1080 + aac; idle stop clean
```

- **No `[youtubetv] … did not load — re-reading the guide once` line.** Poll 1
  was satisfied in 590 ms.
- **Cache after:** still `I1jTpQKv5A0`, `enumeratedAt` unchanged.

**Diagnosis, with evidence.** Poll 1 (`src/providers/youtubetv.ts:198-200`)
is `location.href` contains the cached id **and** `#movie_player` exists. The
retry fires only on `navigation: not satisfied within`
(`youtubetv.ts:240`, raised by `capture.ts:92`). With the rotated id, YouTube
TV still loaded `/watch/I1jTpQKv5A0`, mounted `#movie_player`, and played at
hd720, so poll 1, poll 3 and poll 4 all passed. What it played:

| capture | frame | luma (YAVG) over the pull |
|---|---|---|
| rotated id `I1jTpQKv5A0` (V5, 01:05Z) | a static red ESPN logo card (`task-022/v5-stale-watch-id-frame.png`) | 92.2–105.0, mean 98.2 (600 frames, nearly flat) |
| current id `1oayVaJRVjQ` (V4, 00:57–00:59Z) | ESPN "COMMERCIAL BREAK / WE'LL BE RIGHT BACK" slate (`task-022/v4-event1-current-watch-id-frame.png`) | 53.9–57.9, mean 56.1 |

A rotated event watch id is therefore **not a dead id**: it resolves to a
playable ESPN slate. The trigger specified in step 4 ("URL does not contain
it or #movie_player missing") cannot detect this. The drill channel would have
been served as a logo slate indefinitely, with nothing logged.

A slate is also not a reliable signal on its own: the *current* event-1 feed
was itself showing a break slate at the time.

**Not done, per STOP-AND-REPORT:**
- no retry of the drill with a different wrong value
- no change to the trigger (step 4 defines it, and "no retry loops beyond the
  single retry" constrains it)
- no restore of the cache

**State at the stop** (superseded by V6):
- `data/channels.json` differed from the V2 run
  (`/tmp/channels-v2-task022.json`) in exactly one row: key
  `UCeQPSwZWpyy-hv5ilkHLQDA`, `id` and `href` planted as above.
- The dev server was running (background task) on 0.0.0.0:8804, idle.
- Both owner tabs were parked on their guides.

On the owner's instruction, `npm run channels` then re-enumerated (V6). That
put the row back to `1oayVaJRVjQ`, and the server was restarted on the V6
cache.

## V6 — durability re-run (after the stop, on the owner's instruction)

`npm run channels`, 21:12:34–21:12:48 EDT
(`enumeratedAt 2026-09-13T01:12:48.023Z`), 20 minutes after V2:

```
[youtubetv] guide rows 151, tiles 145, channels 145, skipped 6
[channels] philo: 226 (skipped 0)
  skipped guide rows (6):
      row 26  ESPN  — no stationId, no watch link
      row 30  NBCSN Extra  — no watch link
      row 31  NBCSN Extra  — no watch link
      row 32  NBCSN Extra  — no watch link
      row 46  Cartoon Network  — no watch link
      row 133  WNBA on ION  — no watch link
```

Diff against V2 (`/tmp/channels-v2-task022.json`), matched by key:

| | YouTube TV | Philo |
|---|---|---|
| keys, V2 → V6 | 144 → 145 | 226 → 226 |
| keys present in both runs | 142 | 226 |
| provider id changed on a shared key | **0** | **0** |
| name / position / `discrete` changed on a shared key | none | none (names) |

YouTube TV keys that changed:

| row | name | V2 key / watch id | V6 key / watch id |
|---|---|---|---|
| 8 | Univision | — (skipped in V2: no watch link) | `UCJc8oTwG4BuXZhkYSimpXNw` / `AGPTgVlWtnk` (the same watch id as the 17:39Z cache) |
| 24 | ESPN (`discrete: true`) | `UCuVFZEpGlcrfG3BiZ6XJo8g` / `zYW9jZ58KJg` | `UC_OWNFPvwjhcVCNXMjR6aDw` / `bA5ib80cW4M` |
| 25 | ESPN (`discrete: true`) | `UCaGNTzawhkMIUtu5_OKM-ng` / `FMOpHKcYYos` | `UChlYQKF11IQno9OJs9d1oRg` / `kj4bSBeVqYo` |

- Row 23 (ESPN, `discrete: true`) kept `UCeQPSwZWpyy-hv5ilkHLQDA` /
  `1oayVaJRVjQ`, which also replaced the V5 drill value.
- Row 17 kept `UCW7W_WAogi3qWDbO9PqOmZQ` / `MrXg0chrojg`.
- 371 keys, all distinct.

**Which watch ids changed:** none on a key present in both runs.

**Did any stationId change:** yes, on two discrete event rows. The row at the
same guide position, with the same name and the same `discrete` flag, now
carries a different stationId and a different watch id. No regular
(non-discrete) row's stationId changed. Whether rows 24/25 are "the same feed
under a new key" or "a new event feed replacing an ended one" cannot be told
from these fields.

**Consequence under D020 as built:**
- `/stream/UCuVFZEpGlcrfG3BiZ6XJo8g/index.m3u8` and
  `/stream/UCaGNTzawhkMIUtu5_OKM-ng/index.m3u8` came from the V3 playlist and
  are 404 on the V6 cache (checked live after the restart; see "State at
  hand-off").
- `ESPN (event 2)` and `ESPN (event 3)` now name the new keys.

## V7 — status page while tuned

Taken during the ESPN (event 1) run, in a throwaway window, closed afterwards.
`notebook/reports/task-022/status-tuned.png`:

```
server listening on 0.0.0.0:8804 | channels 370 (youtubetv 144, philo 226) | enumerated 2026-09-13T00:52:18.461Z
state streaming | tuned YouTube TV — ESPN UCeQPSwZWpyy-hv5ilkHLQDA | last quality hd720 | idle stop 20000 ms with no client request
closeTarget 81E0AC840F294FCB8843F6A6CFCB83DC: {"success":true}
page/tab targets before == after: true
```

Not testable live and only traced: the "no rendered guide tile" skip reason
and the second-failure fatal message (`youtubetv.ts:236-259`). The in-server
guide re-read has never executed live either; V5 was meant to exercise it.

---

## What pushed vs local

**Committed and pushed on `main` on the owner's instruction after the stop**
(the `git fetch` + SHA check is in the closing summary):
- the 8 modified files listed above
- `notebook/reports/task-022/` (3 PNGs)
- `notebook/SESSION-STATE.md`
- this report

**State at hand-off:** the dev server was restarted on the V6 cache and is
running on 0.0.0.0:8804, idle. Both owner tabs are parked on their guides.
- **Scratchpad only, outside the repo:** the helper scripts (`pull.mjs`,
  `status-shot.mjs`), the pulls and the server logs.
- **Baselines:** `/tmp/playlist-pre-task022.m3u`,
  `/tmp/channels-pre-task022.json`, `/tmp/channels-v2-task022.json`.

## Open questions

1. **V5 / step 4 trigger (the stop).** A rotated YouTube TV event watch id
   still plays a slate, so a poll-1 miss never happens for it. How should a
   stale watch id be detected, given that the owner specified the trigger and
   capped retries at one? Nothing was built or chosen here. (The planted drill
   row was re-enumerated on the owner's instruction; see V6.)
2. **hd1080 on "real ESPN".** Not reachable on that channel (task-011). TNT
   demonstrated hd1080 under key routing instead. Is that acceptable for V4?
3. **Univision (row 8)** lost its watch link between 17:39Z and 00:52Z, so it
   is skipped. That makes seven skipped rows, not the six the D013 note lists.
4. **D022 display name.** `(event N)` is applied to both `tvg-name` and the
   M3U display title after the comma. D022's wording names `tvg-name` only.
5. **`/health`'s channel line** now shows the key instead of the watch id.
   Step 5 named only the status page.
6. **Every YouTube TV stream URL changed** (0 of 144 shared with V1). The
   editor has to pick the new URLs up once; no migration was built, per the
   constraints. Philo's URLs are unchanged.
7. **D020 — the key rotates for discrete event feeds (V6).** Between 00:52Z
   and 01:12Z, ESPN rows 24 and 25 (`isDiscreteStation: true`) came back with
   new stationIds as well as new watch ids. The stream URLs for those two feeds
   therefore changed, and the old ones are 404. D020's premise ("watch ids
   rotate", with stationId as the stable key) held for every regular row over
   those 20 minutes, but not for event feeds, and D022's `(event N)` names
   now point at different URLs than they did in V3. How D020/D022 should treat
   event feeds is the owner's call; nothing was changed.

## What I am least sure of

1. **That the step-4 fallback does anything useful in practice.** Its one live
   test showed the trigger misses a real rotated id, and the re-read path
   itself has never executed.
2. **Whether a rotated regular-channel watch id behaves like the event one.**
   Only an event feed (`isDiscreteStation: true`) was drilled. `MrXg0chrojg`
   has never been seen to rotate.
3. **stationId durability beyond 20 minutes.** V6 shows regular rows'
   stationIds (and watch ids) unchanged over 20 minutes and two discrete event
   rows' stationIds rotating. Nothing longer, and no regular row across a real
   watch-id rotation, has been observed.
4. **Reading a ~2.4 MB guide body through `Network.getResponseBody` in the
   owner's tab.** It worked once (V2). The buffer sizes were set explicitly,
   and a larger guide is untested.

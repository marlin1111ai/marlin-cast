# Task 023 — YouTube TV event feeds excluded (D023)

Date: 2026-09-12, 21:13–21:23 EDT (2026-09-13 01:13–01:23Z). Host: marlinpc.
The owner's Chrome (pid 211475) was never restarted. The owner's tabs
(`2ECEBF96E5AFE582C2D58E386A6D3DBA` YouTube TV, `76E9F816D85770921EF954D0ED6767D3`
Philo) were driven only through the app's enumerate/tune/park paths. Nothing
on 192.168.1.250 was contacted. `extension/` and `scripts/` are unchanged. No
credentials, cookies, tokens, session ids or account identifiers appear in
code, logs, the notebook or this report.

**Result: done.** Steps 1–4 are complete, and V1, V2 and V4 pass.

V3 passes on every code effect:
- exactly the three event rows are gone
- no `(event` remains in any playlist
- Philo is byte-identical

But the literal condition "all other lines byte-identical" is **not** met.
Four YouTube TV lines differ in `tvg-logo` only, traced below to lineup drift
between the two enumerations rather than to code. It is recorded as a
deviation, not a pass.

---

## Result per step

| Step | Result |
|---|---|
| 1 notebook | done — D023 appended; D022 marked superseded by D023; note under D020 parking stale-watch-id detection; all dated 2026-09-12, owner-ruled |
| 2 enumeration + naming | done — `isDiscreteStation: true` rows skipped with reason `isDiscreteStation (event feed)` and listed with the no-stream rows; D022 `(event N)` naming removed from `tvg-name` and the display title |
| 3 no other change | kept — the task-022 single re-read + retry in `youtubetv.ts` `navigate` is untouched (not in the diff), as are routes, keys, capture and Philo |
| 4 SESSION-STATE | done |

## Files touched, mapped to steps

| File | Step | Change |
|---|---|---|
| `notebook/DECISIONS.md` | 1 | D023; `SUPERSEDED by D023` under D022's heading; note under D020 |
| `src/providers/youtubetv.ts` | 2 | three lines in `readGuide`'s row loop: `if (r.discrete) why.push("isDiscreteStation (event feed)")` with a D023 comment |
| `src/server.ts` | 2 | `eventNames()` and `const eventName` removed; the writer uses `const name = c.name` |
| `src/providers/types.ts` | 2 | comments only: `discrete` now cites D023; `position` no longer cites D022 |
| `notebook/SESSION-STATE.md` | 4 | Task 023 entry |
| `notebook/reports/task-023.md` | — | this report |

---

## V1 — before any change

Served by the running task-022 server:

```
/tmp/yt-pre-task023.m3u      291 lines   md5 d4462b9587272b4770b64afbf7db2c06   "(event" occurrences: 3
/tmp/philo-pre-task023.m3u   453 lines   md5 d0322a458d308ca9b3199ae2ea5a24c8
/tmp/all-pre-task023.m3u     743 lines   md5 9e2983cfd82216672a2463f279eecc0a
/tmp/channels-pre-task023.json            md5 4ecd2d21c5284644ca633c21b5c511d7  (enumeratedAt 2026-09-13T01:12:48.023Z)
```

## V2 — `npm run channels`

21:18:54–21:19:07 EDT:

```
[youtubetv] guide rows 151, tiles 145, channels 142, skipped 9
[channels] youtubetv: 142 (skipped 9)
[philo] 226 channels, totalCount 226, tiers {"Favorite channels":2,"All channels":74,"Free channels":150}
[channels] philo: 226 (skipped 0)
enumerated 368 channels at 2026-09-13T01:19:07.197Z
  skipped guide rows (9):
      row 23  ESPN  — isDiscreteStation (event feed)
      row 24  ESPN  — isDiscreteStation (event feed)
      row 25  ESPN  — isDiscreteStation (event feed)
      row 26  ESPN  — no stationId, no watch link
      row 30  NBCSN Extra  — no watch link
      row 31  NBCSN Extra  — no watch link
      row 32  NBCSN Extra  — no watch link
      row 46  Cartoon Network  — no watch link
      row 133  WNBA on ION  — no watch link
```

Hand count of `data/channels.json`:
- YouTube TV 142, Philo 226.
- 368 keys, all distinct.
- `discrete: true` rows in the cache: 0.
- The only ESPN left is row 17, `UCW7W_WAogi3qWDbO9PqOmZQ` / `MrXg0chrojg`.

## V3 — playlists against V1

```
/playlist/youtube-tv   291 -> 285 lines
/playlist/philo        453 lines — cmp: byte-identical to V1
/playlist              737 lines; == youtube-tv body + philo body; 368 entries = 142 + 226
"(event" occurrences: youtube-tv 0, philo 0, /playlist 0
D015 line: #EXTINF:-1 tvg-id="UCW7W_WAogi3qWDbO9PqOmZQ" tvg-name="ESPN" tvg-logo=… group-title="YouTube TV" tvc-guide-stationid="32645",ESPN
/stream/UCeQPSwZWpyy-hv5ilkHLQDA/index.m3u8 -> 404
/stream/UC_OWNFPvwjhcVCNXMjR6aDw/index.m3u8 -> 404
/stream/UChlYQKF11IQno9OJs9d1oRg/index.m3u8 -> 404
```

Line diff of `/playlist/youtube-tv` (logos elided for width):

```
removed:
- #EXTINF:-1 tvg-id="UCeQPSwZWpyy-hv5ilkHLQDA" tvg-name="ESPN (event 1)" tvg-logo=… group-title="YouTube TV",ESPN (event 1)
- http://127.0.0.1:8804/stream/UCeQPSwZWpyy-hv5ilkHLQDA/index.m3u8
- #EXTINF:-1 tvg-id="UC_OWNFPvwjhcVCNXMjR6aDw" tvg-name="ESPN (event 2)" tvg-logo=… group-title="YouTube TV",ESPN (event 2)
- http://127.0.0.1:8804/stream/UC_OWNFPvwjhcVCNXMjR6aDw/index.m3u8
- #EXTINF:-1 tvg-id="UChlYQKF11IQno9OJs9d1oRg" tvg-name="ESPN (event 3)" tvg-logo=… group-title="YouTube TV",ESPN (event 3)
- http://127.0.0.1:8804/stream/UChlYQKF11IQno9OJs9d1oRg/index.m3u8
changed in place (removed + re-added, same position):
  Disney Channel  UCVN4FmqZlqjiNT9uR48Ll1Q
  Nicktoons       UCRpa59GI1QwGkXq2V0kSCVQ
  Portlandia      UCXgV84lI09EqItQYLxCrZ0w
  C-SPAN2         UCm20W8G3leJQev6jDzW2WpQ
added: nothing else
```

**The four changed lines: evidence that this is drift, not code.** Each
differs from V1 in exactly one attribute, `tvg-logo`. The display title,
`tvg-id`, `tvg-name` and `group-title` are all the same.

In every case the V1 line's logo equals the 01:12Z cache's `logo`, and the new
line's logo equals the 01:19Z cache's `logo`. The writer reproduced its own
cache each time, and the source value changed between the two enumerations.
Example, Disney Channel:

```
V1  tvg-logo=https://yt3.ggpht.com/GQWrRXg4whjA8Dcr_hOsEClzIREg0zKeDcyPMAwRPOUTR-zDPxozywYOXpkF3e5Vh34yVBHbZ8gJ=ns-nd
now tvg-logo=https://yt3.ggpht.com/OF0MR0330sOqUoRknF57aW-XlimEUvoFAUEiXcnDfoeyK0lLjZ6-nwp7jbze_Km_5tyXJo7biouR=ns-nd
```

The cached logo is the tile thumbnail, which is the **current airing's**
thumbnail (recon-stable-ids step 2: 151 of 151 rows). A programme change
between 01:12Z and 01:19Z changes it.

Cache-to-cache, over the 142 YouTube TV keys present in both runs:
- `id`, `name`, `position` and `discrete` are identical.
- `logo` differs on exactly those 4.
- `href` differs on 28, only in the `vpp` query parameter appearing (10) or
  disappearing (18), always with the value `0gcJCRUA3bTjb5HI` and the same
  watch path. `href` is not in the playlist.
- Keys only in the V1 cache: the three discrete ESPN rows (23, 24, 25).
- Keys only in the new cache: none.

So the code's entire effect on the playlist is removing the three event rows.
The byte-identical expectation cannot hold across two separate enumerations
while logos track the airing.

## V4 — ESPN row 17 by key, 60 s

```
[01:20:40Z] GET /stream/UCW7W_WAogi3qWDbO9PqOmZQ/index.m3u8 (cold tune)
[01:20:47Z] HTTP 200 in 6.83 s
/health: state: streaming | quality: hd720 | provider: YouTube TV | channel: ESPN (UCW7W_WAogi3qWDbO9PqOmZQ)
[tune] ESPN {"ok":true,"target":"hd720","quality":"hd720","is1080":false,"video":"1280x720","box":"1920x1080","viewport":"1920x1080","available":["hd720","large","medium","small","auto"]}
[tune-ms] ESPN nav=692 layout=696 playing=1802 pinned=1803
ffmpeg pull exit 0; ffprobe: h264 High 1920x1080 30/1 + aac LC 48000 Hz 2ch; duration=60.012667
pull log: 0 error-like lines (only "Found duplicated MOOV Atom", the task-015 artifact)
[01:22:18Z] /health: state: idle; ffmpeg processes (pgrep -x): 0; HLS directories: 0
[stop] ESPN: idle 20000ms with no client request
[stop] parked the youtubetv tab on https://tv.youtube.com/live
```

hd720 is ESPN's own ceiling (task-011).

---

## What pushed

Committed on `main` and pushed. The `git fetch` + SHA check is in the closing
summary. The commit holds:
- `src/providers/youtubetv.ts`, `src/server.ts`, `src/providers/types.ts`
- `notebook/DECISIONS.md`, `notebook/SESSION-STATE.md`
- this report

Outside the repo: the V1 baselines under `/tmp/*-pre-task023.*`, and the
scratchpad pull helper and logs.

**State at hand-off:** the dev server is running on 0.0.0.0:8804 (background
task) on the new cache (368 channels), idle. Both owner tabs are parked on
their guides.

## What I am least sure of

1. **That `isDiscreteStation` only ever marks event feeds.** It has been seen
   `true` on exactly three rows, all ESPN event feeds, across three guide
   reads on one evening. If YouTube TV ever sets it on a regular channel, D023
   silently drops that channel from the lineup; it would show only as a
   skipped row in `npm run channels` output.
2. **Byte-identical checks across two enumerations.** Logos follow the current
   airing, and `vpp` flaps on about 20% of hrefs within minutes. Any future
   "unchanged" check has to compare within one cache or mask `tvg-logo`,
   otherwise it fails on drift, as V3 did.
3. **The parked D020 risk.** If a regular channel's watch id ever rotates while
   the old id still plays, as the event feed's did in task-022 V5, a tune
   serves stale content silently until the next `npm run channels`. It has
   never been observed on a regular channel.

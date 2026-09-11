# Task 014 — EXT-X-PROGRAM-DATE-TIME: RFC 3339 UTC, placed before EXTINF

Date: 2026-09-11. Host: marlinpc. Owner's Chrome pid 76888, never
restarted, still signed in. Nothing on 192.168.1.250 was contacted.

**Result: done and verified live.** Every `EXT-X-PROGRAM-DATE-TIME` the
server emits now reads as UTC with a trailing `Z` and millisecond
precision and sits immediately before its segment's `#EXTINF`, exactly
PrismCast's layout. The instant is unchanged: served `23:15:05.977Z`
against ffmpeg's raw `19:15:05.977-0400` differ by 0 ms. Go 1.27's
`time.RFC3339` parser accepts the emitted value and still rejects the
raw one. hls.js and ffmpeg play the stream as before.

---

## Mechanism used, and why the preferred one was not possible

**Used: serve-time rewrite of the playlist text in `src/server.ts`.**

**Not possible: ffmpeg muxer flags.** The hls muxer's only related
option is `-hls_flags +program_date_time`, which we already set. Its
output format is hard-coded in libavformat (confirmed by reading the
installed library's strings):

```
#EXT-X-PROGRAM-DATE-TIME:%s.%03d%s
```

where `%s` is `strftime("%Y-%m-%dT%H:%M:%S")` of **localtime**, `%03d`
the milliseconds, and the trailing `%s` a `strftime("%z")` offset —
`-0400`, no colon. There is no option for UTC, for the `Z` designator,
or for the tag's position, which is always after `#EXTINF`. Running
ffmpeg under `TZ=UTC` would yield `+0000`, still not `Z` and still in
the wrong place. `ffmpeg -h muxer=hls` lists nothing else touching
date-time. So the muxer path cannot produce the required output even
partially, and the ffmpeg command line was left untouched.

The rewrite, in the `index.m3u8` handler:

- `pdtToUtc()` parses `YYYY-MM-DDTHH:MM:SS[.fff](Z|±HH[:]MM)`, builds the
  UTC epoch from the components, subtracts the offset, and returns
  `Date#toISOString()` — always `.fffZ`. Anything it cannot parse is
  returned unchanged rather than relabelled.
- `rewritePlaylist()` walks the lines; on a date-time line it walks back
  over the pending segment's tags (never past a URI line) to the
  `#EXTINF` and inserts the converted tag immediately before it. Any tag
  that ffmpeg might write before `#EXTINF` (`EXT-X-DISCONTINUITY`, if it
  ever appears) stays ahead of the date-time, which is PrismCast's order
  too.

Unit-checked before going live: `-0400`, `+0530`, `-04:00`, `Z`, a
1-digit fraction and garbage all behave; a sample playlist with a
discontinuity rewrote in the expected order.

---

## Files touched, mapped to steps

| File | Step | Change |
|---|---|---|
| `src/server.ts` | 1 | `pdtToUtc()`, `rewritePlaylist()`, and the playlist handler now sends the rewritten text; a comment block records why |
| `notebook/KNOWN-FIXES.md` | 3 | entry: ffmpeg's date-time is not RFC 3339 and Go readers reject it; the fix and the diagnostic rule |
| `notebook/SESSION-STATE.md` | 3 | Task 013 and Task 014 sections |
| `notebook/reports/task-013.md` | (pre-step) | the task-013 recon report, saved verbatim before starting |
| `notebook/reports/task-014.md` | 3 | this report |

Nothing else. `src/capture.ts` and the ffmpeg command line are
untouched. No dependency, config, refactor or other tag change. Step 2
holds: VERSION, TARGETDURATION, MEDIA-SEQUENCE, INDEPENDENT-SEGMENTS,
MAP, segment durations, window and discontinuity handling are exactly as
task-012 left them — visible in the excerpts below, where every other
line is identical to the task-012/013 captures.

---

## Playlist excerpts, verbatim

Cold tune requested 23:15:02.141Z, answered 200 in 4.307 s at
23:15:06.455Z:

```
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:1
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MAP:URI="init.mp4"
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T23:15:05.977Z
#EXTINF:1.000000,
seg00000.m4s
```

ffmpeg's own file on disk at the same moment, for comparison (this is
what was served before this task):

```
#EXTINF:1.000000,
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T19:15:05.977-0400
seg00000.m4s
```

Poll at 23:15:11.459Z, five seconds later:

```
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:1
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MAP:URI="init.mp4"
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T23:15:05.977Z
#EXTINF:1.000000,
seg00000.m4s
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T23:15:06.977Z
#EXTINF:1.000000,
seg00001.m4s
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T23:15:07.977Z
#EXTINF:1.000000,
seg00002.m4s
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T23:15:08.977Z
#EXTINF:1.000000,
seg00003.m4s
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T23:15:09.977Z
#EXTINF:1.000000,
seg00004.m4s
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T23:15:10.977Z
#EXTINF:1.000000,
seg00005.m4s
```

Served against raw, segment by segment at that poll:

```
served 2026-09-11T23:15:05.977Z   raw 2026-09-11T19:15:05.977-0400
served 2026-09-11T23:15:06.977Z   raw 2026-09-11T19:15:06.977-0400
served 2026-09-11T23:15:07.977Z   raw 2026-09-11T19:15:07.977-0400
served 2026-09-11T23:15:08.977Z   raw 2026-09-11T19:15:08.977-0400
served 2026-09-11T23:15:09.977Z   raw 2026-09-11T19:15:09.977-0400
served 2026-09-11T23:15:10.977Z   raw 2026-09-11T19:15:10.977-0400
```

---

## Go parse and same-instant checks

Go 1.27, `time.Parse(time.RFC3339, s)` on the served and raw value of
segment 0:

```
2026-09-11T23:15:05.977Z         OK  unix_ms=1789168505977  2026-09-11T23:15:05.977Z
2026-09-11T19:15:05.977-0400     ERR parsing time "2026-09-11T19:15:05.977-0400" as "2006-01-02T15:04:05Z07:00": cannot parse "-0400" as "Z07:00"
```

Same instant: `Date.parse` of served and raw both give
`1789168505977` ms — **diff 0 ms**. Wall clock: the value is
23:15:05.977Z and the cold response arrived at 23:15:06.455Z, so the
first segment's stamp is 0.48 s before the response, inside the 1 s
bound.

---

## Playback unchanged

**hls.js 1.5.13**, page on 127.0.0.1:8807, stream on :8804, CORS
enforced, throwaway headless Chrome 153 (torn down afterwards):

```
title PLAYING  playing true  videoSize 1920x1080
decodedFrames 604  droppedFrames 0  fatal []  errors []
MANIFEST_PARSED / LEVEL_LOADED live=true frags=10 target=1
FRAG_LOADED sn=22 / 23 / 24 / VIDEO PLAYING / 25 / 26 / 27 …
```

**ffmpeg 30 s pull** (a cold tune of its own, seg00000 to seg00030):

| | |
|---|---|
| segments opened | 31 |
| warnings | 0 |
| video | 900 frames, 30.03 fps, **every PTS step exactly 0.0333 s** |
| audio span | 30.00 s vs video 29.97 s, **A/V skew +30.0 ms** |
| luma, 15 samples | 77–119, varying; no black intervals |
| audio | mean −25.9 dB, no silence ≥ 1 s |

ffmpeg's demuxer log shows it reading the rewritten tag
(`Skip ('#EXT-X-PROGRAM-DATE-TIME:2026-09-11T23:16:19.213Z')`) — and
skipping it, as it always has. Neither hls.js nor ffmpeg uses this tag,
which is why three tasks of playback verification never saw the defect.

Cold tune latency this task, one run: **4.307 s** (task-012: 4.096 s;
task-011 TS: 3.930 s). The rewrite is a string pass over a ~1 KB file
and is not measurable in that figure.

---

## What was committed

One commit on `main`, **not pushed**: `src/server.ts`, the three
notebook files, and `notebook/reports/task-013.md`. Task-012's commit
`74e09c1` is also still unpushed; both wait for the owner.

Server left running on `0.0.0.0:8804` for the Channels DVR test.

---

## Open questions

1. **Does Channels' `[M3U] stream timestamps` line now show a real
   window** (`start_at` ≠ `end_at`), and does `last_seq` advance past 1?
   That is the whole test of task-013's top candidate, and only the
   owner's log can answer it.
2. **If it still stops after one segment**, task-013's remaining
   candidates are, in order: MEDIA-SEQUENCE restarting at 0 with no
   `EXT-X-DISCONTINUITY` on every retune (PrismCast restarts at 15 behind
   a discontinuity), and the fMP4 shape (`styp`/`sidx`, edit list in
   `moov`, one fragment per segment). Neither was touched here.
3. **The rewrite happens on every playlist request**, roughly once per
   second per client. It is trivial work, but it is work the muxer could
   have done if it had the option; if this ever matters, the alternative
   is to post-process the file once when ffmpeg renames it into place.
   Not built.

---

## Least sure of

1. **That the format, rather than the position, is what Channels
   tripped on** — or that either is. Both are fixed at once, so a
   successful retest will not say which mattered. That is acceptable
   for a fix and would matter only for a write-up.
2. **That `Date#toISOString()` is the right output for every future
   value.** It always emits exactly three fraction digits and `Z`, which
   is what was asked for and what PrismCast emits; it would also emit
   `+`-prefixed six-digit years for dates outside 0000–9999, which
   cannot occur here.
3. **That the walk-back to `#EXTINF` is right for every playlist ffmpeg
   can write.** It is right for everything ffmpeg writes today with our
   flags (`EXTINF`, date-time, URI; `MAP` before the first `EXTINF`), and
   it degrades safely — a date-time with no preceding `EXTINF` is left
   where it was. `EXT-X-BYTERANGE` (single-file mode, which we do not
   use) would sit between `EXTINF` and the date-time and is handled by
   the walk-back skipping tag lines.

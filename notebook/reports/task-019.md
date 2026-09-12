# Task 019 — remove EXT-X-PROGRAM-DATE-TIME from the media playlist

Date: 2026-09-11. Host: marlinpc. Owner's Chrome pid 76888, never
restarted, driven only through ordinary ESPN tunes. Nothing on
192.168.1.250 was contacted.

**Result: done and verified live.** The media playlist no longer carries
any `EXT-X-PROGRAM-DATE-TIME` line. Everything else — codec, profile,
segments, window, MAP, the task-014 serve-time rewrite, and the task-018
guide parking — is unchanged. hls.js still plays with 0 errors, the
30 s pull is continuous, and cold tune latency is unchanged at 4.228 s.

Whether this fixes Channels' `last_seq=1` is for the owner's retest;
task-015 established it cannot be reproduced locally.

---

## New evidence this task acts on

Owner-supplied Channels log, after task-017 gave ESPN a
`tvc-guide-stationid`:

```
[M3U] stream timestamps: ESPN: start_at=21:01:44 end_at=21:01:44 live_delay=3s
```

logged at 21:01:45.3, **before** `Opened connection`; `last_seq=1` again.
So the explicit station id changed neither the timestamps line nor the
stop. The line precedes the connection and shows `start_at == end_at`,
which fits Channels **pre-fetching the media playlist** and reading its
first and last `EXT-X-PROGRAM-DATE-TIME` — equal on a cold one-segment
playlist, hence a zero window. This task removes the tag.

---

## Files touched, mapped to steps

| File | Step | Change |
|---|---|---|
| `src/capture.ts` | 1 | dropped `program_date_time` from `-hls_flags` (now `delete_segments+independent_segments+temp_file`); removed the two stale comment lines about it and added a note |
| `notebook/KNOWN-FIXES.md` | 2 | entry: guide data did not change last_seq or the timestamps line; the line is consistent with a media-playlist pre-fetch |
| `notebook/SESSION-STATE.md` | 2 | Task 019 section |
| `notebook/reports/task-019.md` | 2 | this report |

Nothing else. `src/server.ts` is untouched: the task-014 serve-time PDT
rewrite stays in place and is now a no-op (there are no PROGRAM-DATE-TIME
lines to convert). No dependency added, no other flag changed. The
`-hls_flags` diff, in full:

```
- delete_segments+independent_segments+temp_file+program_date_time
+ delete_segments+independent_segments+temp_file
```

---

## Playlist excerpts, verbatim

Cold tune requested 01:06:49.596Z, answered 200 in 4.228 s at
01:06:53.835Z:

```
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:1
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MAP:URI="init.mp4"
#EXTINF:1.000000,
seg00000.m4s
```

Poll at 01:06:58Z, five seconds later:

```
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:1
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MAP:URI="init.mp4"
#EXTINF:1.000000,
seg00000.m4s
#EXTINF:1.000000,
seg00001.m4s
#EXTINF:1.000000,
seg00002.m4s
#EXTINF:1.000000,
seg00003.m4s
#EXTINF:1.000000,
seg00004.m4s
#EXTINF:1.000000,
seg00005.m4s
```

`EXT-X-PROGRAM-DATE-TIME` occurrences across both: **0**. Compared to the
task-014 playlist, the only difference is the removed date-time lines;
VERSION, TARGETDURATION, MEDIA-SEQUENCE, INDEPENDENT-SEGMENTS, MAP,
EXTINF, and the `.m4s` names are identical.

---

## Playback and pull

**hls.js 1.5.13**, page on 127.0.0.1:8807, stream on :8804,
cross-origin, CORS enforced, throwaway headless Chrome (torn down after):

```
PLAYING  playing true  frames 604  dropped 0  manifestParsed true  fatal []  errors []
```

**30 s ffmpeg pull**, `-c copy`:

| | |
|---|---|
| exit | 0, wall 28.2 s |
| segments opened | 31 |
| new warning classes | none |
| pre-existing | "Found duplicated MOOV Atom. Skipped it" ×28 |

The duplicated-MOOV warning is the known task-015 artifact of ffmpeg
re-reading `EXT-X-MAP`/init on every 1 s reload; unchanged by this task.
No DTS discontinuity, no duration-0, no out-of-range in the pull.

**Cold tune latency (task-011 method):** 4.228 s (task-018 4.212 s,
task-016 4.317 s). Removing a playlist tag has no effect on tune time.

Server left idle with the tab parked on the live guide (task-018),
re-confirmed by a read-only probe: `https://tv.youtube.com/live`, player
paused, readyState 0, 0x0.

---

## What was committed

One commit on `main`, **not pushed**: `src/capture.ts`,
`notebook/KNOWN-FIXES.md`, `notebook/SESSION-STATE.md`, and this report.
Commits `ded91c6` (task-018), `53651b2` (task-017), `ea788bb` (task-016),
`953b6cd` (task-014) and `74e09c1` (task-012) are also still unpushed;
all wait for the owner.

Server left running on `0.0.0.0:8804`.

---

## Open questions

1. **Does removing the tag change `last_seq`?** Only the owner's Channels
   log can say. If the timestamps line disappears (or `start_at != end_at`)
   and `last_seq` advances, the pre-fetch theory is confirmed. If the line
   persists with the tag gone, the theory is wrong and the line comes from
   elsewhere (the M3U entry, or Channels' own clock).
2. **If the tag was the live-edge cue,** removing it could in principle
   make Channels place the live edge differently. hls.js was indifferent
   (0 errors), but hls.js is not Channels. This is the main risk of the
   change and is unobservable without the owner's log.
3. **Reference stream carries the tag.** PrismCast, which works, emits
   `EXT-X-PROGRAM-DATE-TIME` (in UTC, before EXTINF). Removing ours makes
   us differ from the reference in the opposite direction from task-014.
   The bet is that Channels' pre-fetch reads the *values*, and PrismCast's
   are unequal (variable-length segments, live edge advancing) while ours
   were equal on a cold one-segment window — so the tag's mere presence is
   not the issue, its equal values were. Unverified.

## Least sure of

1. **The whole pre-fetch theory.** It is inference from three log lines:
   the timestamps line precedes `Opened connection`, shows equal
   start/end, and survived both the task-014 UTC fix and the task-017
   station id. Removing the only source of those two equal values is the
   cleanest next test, but it is a test, not a known fix.
2. **That a bare playlist (no PDT) is acceptable to Channels at all.**
   Every local validator is fine with it and PrismCast's *format* is not
   what we're matching here, but Channels may expect a date-time on a live
   playlist. If so, this makes things worse, and the fix is to restore the
   tag but with unequal values — which would require more than one segment
   in the cold window, a different change.

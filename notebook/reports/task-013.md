# Task 013 — read-only recon: our HLS vs PrismCast, tag by tag

Date: 2026-09-11. Host: marlinpc. Read-only: nothing changed, nothing
committed at the time of the recon (this file was saved at the start of
task-014). Raw captures live in the task-013 session scratchpad `t13/`.
All times are UTC from marlinpc's clock. PrismCast contact was plain
GETs on port 5589 only. The owner's Chrome was used only for two
ordinary ESPN tunes.

**Owner-supplied evidence from Channels DVR's log** (not fetched):

- Marlin Cast ESPN: `[M3U] stream timestamps: ESPN:
  start_at=2026-09-11T18:52:30-04:00 end_at=2026-09-11T18:52:30-04:00
  live_delay=3s`, probed OK (h264 1920x1080 5.7 Mbps), session started
  in 1.08 s, stopped after 12 s with `first_seq=1 last_seq=1`.
- PrismCast AMC: no `[M3U] stream timestamps` line; remuxer logs
  `[mpegts @ …] DTS discontinuity` and `[hls @ …] packet … has duration
  0`; session started in 3.07 s, ran 30 s to `last_seq=16`.

**Headline.** The one tag that carries timestamps,
`EXT-X-PROGRAM-DATE-TIME`, is the tag where our playlist differs from
PrismCast's in two ways at once. Ours is written as
`2026-09-11T18:57:08.959-0400`, which Go's standard RFC 3339 parser
rejects; PrismCast's `2026-09-11T22:57:42.736Z` parses. Ours sits
between `EXTINF` and the URI; PrismCast's precedes `EXTINF`. Channels
DVR is a Go program that printed `start_at=end_at` with a `-04:00` zone
for us and printed no timestamps line at all for PrismCast.

---

## Captures

**Our /playlist entry for ESPN** (22:57:05Z, with Channels' Host header
so the URL is what Channels sees):

```
#EXTINF:-1 tvg-id="MrXg0chrojg" tvg-name="ESPN" tvg-logo="https://yt3.ggpht.com/[…]=ns-nd" group-title="YouTube TV",ESPN
http://192.168.1.245:8804/stream/MrXg0chrojg/index.m3u8
```

**PrismCast /playlist entry for AMC** (22:57:37Z):

```
#EXTINF:-1 channel-id="amc" group-title="Entertainment;Movies" tvg-name="AMC" tvc-guide-stationid="59337",AMC
http://192.168.1.250:5589/hls/amc/stream.m3u8
```

**Our media playlist.** Cold tune answered in 4.22 s at 22:57:09.300Z;
polls at 22:57:12.304Z, 22:57:15.314Z, 22:57:18.322Z.

```
#EXTM3U                                   (cold, 22:57:09.300Z)
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:1
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MAP:URI="init.mp4"
#EXTINF:1.000000,
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T18:57:08.959-0400
seg00000.m4s

#EXTM3U                                   (poll 1, 22:57:12.304Z)
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:1
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MAP:URI="init.mp4"
#EXTINF:1.000000,
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T18:57:08.959-0400
seg00000.m4s
#EXTINF:1.000000,
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T18:57:09.959-0400
seg00001.m4s
#EXTINF:1.000000,
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T18:57:10.959-0400
seg00002.m4s
#EXTINF:1.000000,
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T18:57:11.959-0400
seg00003.m4s
```

Poll 2: same header, MEDIA-SEQUENCE 0, seg00000 to seg00006 (7 entries).
Poll 3: MEDIA-SEQUENCE 0, seg00000 to seg00009 (10 entries). A second
session polled at 12 s intervals showed the window sliding once full:
MEDIA-SEQUENCE 3, then 14, then 27, always 10 entries, always
`EXTINF:1.000000`.

**PrismCast media playlist.** Cold request answered in 5.55 s at
22:57:42.743Z; polls at 22:57:45.754Z, 22:57:48.765Z, 22:57:51.779Z.

```
#EXTM3U                                   (cold, 22:57:42.743Z; poll 1 byte-identical)
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:3
#EXT-X-MEDIA-SEQUENCE:15
#EXT-X-DISCONTINUITY-SEQUENCE:0
#EXT-X-MAP:URI="init.mp4?v=1"
#EXT-X-DISCONTINUITY
#EXT-X-MAP:URI="init.mp4?v=1"
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T22:57:42.736Z
#EXTINF:2.155,
segment15.m4s

#EXTM3U                                   (poll 3, 22:57:51.779Z)
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:5
#EXT-X-MEDIA-SEQUENCE:15
#EXT-X-DISCONTINUITY-SEQUENCE:0
#EXT-X-MAP:URI="init.mp4?v=1"
#EXT-X-DISCONTINUITY
#EXT-X-MAP:URI="init.mp4?v=1"
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T22:57:42.736Z
#EXTINF:2.155,
segment15.m4s
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T22:57:46.480Z
#EXTINF:4.917,
segment16.m4s
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T22:57:49.360Z
#EXTINF:2.368,
segment17.m4s
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T22:57:51.640Z
#EXTINF:2.743,
segment18.m4s
```

Poll 2 had segments 15 and 16 with TARGETDURATION 5. A second PrismCast
session (23:00:49Z) again began at MEDIA-SEQUENCE 15 with one segment;
over 36 s its window grew to 10 entries then slid (sequence 15, 16,
21), and DISCONTINUITY-SEQUENCE went 0 to 1 the moment segment15 with
its `EXT-X-DISCONTINUITY` left the window.

**Headers** (media playlist, init, one segment):

| | Marlin Cast | PrismCast |
|---|---|---|
| playlist Content-Type | `application/vnd.apple.mpegurl` | `application/vnd.apple.mpegurl; charset=utf-8` |
| playlist Cache-Control | `no-cache` | `no-cache` |
| init / segment Content-Type | `video/mp4` / `video/mp4` | `video/mp4` / `video/mp4` |
| segment Cache-Control | `no-cache` | `no-cache` |
| Accept-Ranges | `bytes` | absent |
| CORS headers | present | absent |
| init size | 1384 B | 1304 B |

**PrismCast container verdict: fMP4, not MPEG-TS.** First 64 bytes of
`segment18.m4s`:

```
00000000: 0000 0744 6d6f 6f66 0000 0010 6d66 6864  ...Dmoof....mfhd
00000010: 0000 0000 0000 000a 0000 050c 7472 6166  ............traf
00000020: 0000 001c 7466 6864 0002 0038 0000 0001  ....tfhd...8....
00000030: 0000 0180 0001 5b32 0101 0000 0000 0014  ......[2........
```

No 0x47 sync byte; the segment opens directly with `moof`. Its
`init.mp4?v=1` opens `ftyp iso5` then `moov`. ffprobe on the pair: H.264
Constrained Baseline L4.2, 1920x1080, AAC-LC 48 kHz stereo, video
timescale 16000. Ours opens `styp` + two `sidx` then `moof`.

---

## Tag diff

| Tag / property | Marlin Cast | PrismCast |
|---|---|---|
| M3U attributes | `tvg-id`, `tvg-name`, `tvg-logo`, `group-title` | `channel-id`, `group-title`, `tvg-name`, `tvc-guide-stationid` |
| catchup / timeshift attributes | none | none |
| EXT-X-VERSION | 7 | 7 |
| TARGETDURATION | 1, constant | 2 to 5, changes as longer segments appear |
| MEDIA-SEQUENCE at cold start | 0, every tune | 15, every tune |
| MEDIA-SEQUENCE advance | 0 until 10 entries, then slides | 15 until 10 entries, then slides |
| PROGRAM-DATE-TIME format | `…T18:57:08.959-0400` local, no colon in offset | `…T22:57:42.736Z` UTC |
| PROGRAM-DATE-TIME position | after `EXTINF`, before URI | before `EXTINF` |
| PROGRAM-DATE-TIME values | encoder start plus exact 1.000 s steps | wall clock at each segment |
| DISCONTINUITY-SEQUENCE | absent | present, increments when the discontinuity leaves the window |
| DISCONTINUITY | absent | one, before the first segment of every session |
| INDEPENDENT-SEGMENTS | present | absent |
| MAP | once, `init.mp4` | twice, `init.mp4?v=1`, repeated after the discontinuity |
| segment duration | exactly 1.000 s | 0.94 to 4.92 s, variable |
| window | 10 segments, about 10 s | 10 segments, about 25 s |
| segment interior | `styp`, `sidx` x2, one `moof`/`mdat`, 30 frames, 1 keyframe | no `styp`/`sidx`, two `moof`/`mdat` pairs, 115 frames, 2 keyframes |
| init `moov` | has `edts`/`elst` on both tracks (video: empty edit of 21 ms) | no edit lists |

Go parse test, run locally with Go 1.27:

| string | `time.RFC3339` | `time.RFC3339Nano` |
|---|---|---|
| ours `…08.959-0400` | error: cannot parse "-0400" as "Z07:00" | same error |
| PrismCast `…42.736Z` | OK | OK |

ffmpeg's own HLS demuxer, where Channels' `[hls @ …]` lines come from,
read both streams for a full 30 s without a single warning (ours: 31
segments, 30.000 s out; PrismCast: 15 segments, 29.99 s out). ffmpeg
6.1 prints `Skip` for every PROGRAM-DATE-TIME line on both, so the
timestamps logic in Channels is not libavformat's.

---

## Ranked candidates

For the `start_at=end_at` line:

1. **PROGRAM-DATE-TIME is unparseable or misattributed by a Go
   reader.** The `-0400` offset fails Go's RFC 3339 parse; PrismCast's
   `Z` form passes. If Channels falls back to "now" for both bounds on
   a parse failure, `start_at == end_at` to the second follows directly,
   and PrismCast would never take that path, which fits it having no
   line at all. The tag position is a second, independent route to the
   same result: a parser that opens a segment on `EXTINF` and treats
   `PROGRAM-DATE-TIME` as the start of the next one assigns our
   durations to the wrong segment, leaving a last segment of zero
   length. Evidence: the Go test, both captures, and the fact that every
   other tag Channels could read as a time is absent from both M3U
   entries.
2. **One-segment cold window.** If Channels defines `end_at` as the
   last segment's date-time rather than date-time plus duration, a
   single-segment playlist yields `start_at == end_at` by construction.
   Both servers serve exactly one segment cold, so this cannot be the
   distinguishing factor on its own.
3. **TARGETDURATION 1** explains `live_delay=3s`: three target
   durations is the standard live-edge offset. Confirms Channels read
   our tags; does not produce the equality.

For the segmenter stopping after one output segment at 12 s:

1. **A zero-length timestamp window bounding the fetch.** If Channels
   uses `start_at`/`end_at` to decide what to fetch, a window of zero
   length fetches one segment, waits for more that "never arrive", and
   its stall timeout ends the session — `first_seq=1 last_seq=1`, 12 s.
   Matches history: before task-010 there was no PROGRAM-DATE-TIME and
   Channels' remuxer ran 31 s at 1.02x; the tag arrived in task-010 and
   the reader now stops early.
2. **MEDIA-SEQUENCE restarting at 0 with no DISCONTINUITY.** PrismCast
   also restarts (always at 15) but announces it with
   `EXT-X-DISCONTINUITY` and a discontinuity sequence. Weaker: Channels
   logs a fresh session each time.
3. **fMP4 shape.** `styp` and two `sidx` per segment, an edit list in
   `moov`, one fragment per segment. libavformat reads ours cleanly, so
   low; Channels' ffmpeg build is unknown.
4. **1 s segments and window.** Not supported by evidence here.

**Open questions**

- Whether Channels logs `[M3U] stream timestamps` for every HLS source
  or only on a fallback path. A fuller PrismCast log would settle it.
- Whether the pre-task-010 failure (player error at 15 s while the
  remuxer ran 31 s) and today's failure (remuxer stops at 12 s) are the
  same defect. The shapes differ.
- Cheapest next experiment, not done by scope: drop
  `+program_date_time`, or emit it in PrismCast's form, and re-read
  Channels' log for the timestamps line and `last_seq`.

**Least sure of**

- That "no timestamps line for PrismCast" means the line is a fallback
  diagnostic. It could be an excerpt gap.
- Which of the two date-time defects bites, format or position.
- Everything about Channels' internals is inferred from three log lines
  and a Go parser test, not observed.

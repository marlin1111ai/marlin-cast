# Task 012 — HLS output MPEG-TS → fMP4/CMAF

Date: 2026-09-11. Host: marlinpc. Owner's Chrome pid 76888, never
restarted, still signed in.

**Result: done and verified.** Marlin Cast now serves fMP4/CMAF HLS —
one `init.mp4` referenced by `#EXT-X-MAP`, `.m4s` media segments,
`#EXT-X-VERSION:7` — with everything else byte-for-byte the same
intent: H.264 High L4.0, 1920x1080, 30 fps, 6000k, 1 s segments, a
10-segment window, the 20 s idle watchdog, the CORS headers, and the
`/playlist` and `/stream/<id>/index.m3u8` URLs. Channels DVR's source
needs no edit.

**Cold tune latency: 4.096 s** (ESPN, task-011 method). Task-011's TS
figure for the same channel was 3.930 s; the container change costs
nothing measurable.

Whether this is what Channels' player was refusing is the one thing only
the owner's Channels DVR can answer — see the open questions.

**Not found:** the task named "the current cold-start brief (v2)". Only
`MARLIN-CAST-BRIEF.md` (v1) and `notebook/BRIEF-v1.md` exist on disk. I
read those plus DECISIONS, KNOWN-FIXES, SESSION-STATE and the task-010
and task-011 reports. If v2 says something v1 does not, I have not seen it.

---

## Files touched, mapped to steps

| File | Step | Change |
|---|---|---|
| `src/capture.ts` | 1 | ffmpeg segmenter: `-hls_segment_type fmp4`, `-hls_fmp4_init_filename init.mp4`, segment name `seg%05d.m4s`; `/health` segment count now counts `.m4s`; one header comment |
| `src/server.ts` | 2 | segment route accepts `init.mp4`; `Content-Type` is `video/mp4` for `.mp4` and `.m4s` (`.ts` would still be `video/mp2t`); playlist type and CORS untouched; route comment block and one stale comment updated |
| `notebook/KNOWN-FIXES.md` | 3 | two entries: latency was not the cause (31 s → 8 s, still fails) alongside CORS; fMP4-from-ffmpeg notes and the new mp4-muxer audio warning |
| `notebook/SESSION-STATE.md` | 3 | Task 012 section |
| `notebook/reports/task-012.md` | 3 | this report |

Nothing else. No dependency added (`package.json` untouched), no config,
no refactor, no profile or bitrate change, no extension change. The
diagnostic rig (an hls.js test page, a loopback `python3 -m http.server`
on 8807, and a throwaway **headless** Chrome on port 9447 with its own
profile directory) lived in the session scratchpad and is torn down; its
profile is deleted. The owner's Chrome was used only for the tunes.

The ffmpeg diff, in full:

```
-f hls -hls_time 1 -hls_list_size 10
+ -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4
-hls_flags delete_segments+independent_segments+temp_file+program_date_time
- -hls_segment_filename <dir>/seg%05d.ts
+ -hls_segment_filename <dir>/seg%05d.m4s
```

---

## Playlist

Cold response (the one the 4.096 s was measured to), then the same
playlist three seconds later:

```
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:1
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MAP:URI="init.mp4"
#EXTINF:1.000000,
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T18:39:26.031-0400
seg00000.m4s
```

```
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:1
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MAP:URI="init.mp4"
#EXTINF:1.000000,
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T18:39:26.031-0400
seg00000.m4s
#EXTINF:1.000000,
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T18:39:27.031-0400
seg00001.m4s
#EXTINF:1.000000,
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T18:39:28.031-0400
seg00002.m4s
#EXTINF:1.000000,
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T18:39:29.031-0400
seg00003.m4s
```

Headers, as served:

| | `index.m3u8` | `init.mp4` | `seg00003.m4s` |
|---|---|---|---|
| Status | 200 | 200 | 200 |
| `Content-Type` | `application/vnd.apple.mpegurl` | **`video/mp4`** | **`video/mp4`** |
| `Cache-Control` | `no-cache` | `no-cache` | `no-cache` |
| `Access-Control-Allow-Origin` | `*` | `*` | `*` |
| `Accept-Ranges` | — | `bytes` | `bytes` |
| `Content-Length` | 467 | 1384 | 958758 |

Against the task-010 reference: PrismCast's playlist also carries
`EXT-X-DISCONTINUITY-SEQUENCE` and an `EXT-X-DISCONTINUITY` before its
first segment, and its `init.mp4` is 1305 bytes with a `?v=1` query;
ours has neither discontinuity tag and no query. ffmpeg's
`EXT-X-PROGRAM-DATE-TIME` still sits between `EXTINF` and the URI, as in
task-010. hls.js accepted all of it.

---

## ffprobe on the downloaded init + segment pair

`cat init.mp4 seg00003.m4s > joined.mp4`, then:

```
format_name=mov,mp4,m4a,3gp,3g2,mj2
duration=4.026667
TAG:major_brand=iso5
TAG:compatible_brands=iso5iso6mp41

index=0  codec_name=h264  profile=High  level=40  width=1920  height=1080
         pix_fmt=yuv420p  r_frame_rate=30/1  time_base=1/15360
index=1  codec_name=aac   profile=LC  sample_rate=48000  channels=2  time_base=1/48000
```

Box tree, proving it is *fragmented* MP4 and not a progressive file:

```
init.mp4          seg00003.m4s
ftyp (28 B)       styp (24 B)
moov (1356 B)     sidx (52 B)
  mvhd            sidx (52 B)
  trak [avc1]     moof (676 B)
  trak [mp4a]       mfhd
  mvex (72 B)       traf { tfhd tfdt trun }   <- video
    trex            traf { tfhd tfdt trun }   <- audio
    trex          mdat (957954 B)
  udta
```

The init `moov` has empty sample tables and an `mvex` with one `trex`
per track — no samples live in it. Every sample is in the segment's
`moof`/`mdat`. The segment decodes to **30 video frames with exactly one
keyframe, at its head**, PTS starting at 3.000 s for segment 3 —
continuous numbering, so `EXT-X-INDEPENDENT-SEGMENTS` is still true.

---

## hls.js

hls.js 1.5.13 served from `127.0.0.1:8807`, stream on `127.0.0.1:8804` —
cross-origin, CORS enforced, no `--disable-web-security`. Throwaway
headless Chrome 153, MSE available.

```
title          : PLAYING
playing        : true
videoSize      : 1920x1080
decodedFrames  : 605     droppedFrames: 0
manifestParsed : true
fatal          : []      errors: []
MANIFEST_PARSED levels=1
LEVEL_LOADED live=true frags=10 target=1
FRAG_LOADED sn=70 / sn=71 / sn=72 / VIDEO PLAYING / sn=73 / sn=74 / sn=75 …
```

hls.js fetches the init segment as part of the first fragment load (it
does not appear as a separate `FRAG_LOADED`), then plays the `.m4s`
chain straight through MSE with no transmux step — which is the point of
fMP4 for a browser player.

**30 s pulled through ffmpeg and measured from the file:** 1920x1080
h264 / aac, 750 frames at 30.04 fps, video 24.97 s vs audio 24.98 s
(**A/V skew +16.7 ms**), whole-frame luma 67–124 varying, no black
intervals, audio mean −28.7 dB, no silence ≥ 1 s. (ffmpeg's live pull
stopped short of the requested 30 s of media; the continuity of what it
did pull is the measurement.)

---

## Latency

Task-011 method: wait for `/health` to read `state: idle`, then time a
single `curl` of the channel's `index.m3u8` through to a `200` carrying
a playable segment.

| | cold tune → playable playlist |
|---|---|
| ESPN, **fMP4 (this task)** | **4.096 s** |
| ESPN, TS (task-011) | 3.930 s |
| PrismCast (task-010) | 5.222 s |

Stage split from the log: `nav=687 layout=705 playing=1469 pinned=1473`
ms, so the tune path was 1.47 s and ffmpeg start-up plus the first 1 s
fragment the remaining ~2.6 s — the same shape as task-011. One run, one
channel; not a distribution.

ESPN again settled at hd720 by the channel's own ceiling
(`available: ["hd720","large","medium","small","auto"]`), warned in the
log and shown on `/health`, exactly as task-011 left it.

---

## Idle stop

After the last client request: `state: idle` inside the 20 s window,
**0 `ffmpeg` processes, 0 HLS directories**. `delete_segments` and
`temp_file` behave the same on `.m4s` as they did on `.ts`.

---

## What was committed

One commit on `main`, **not pushed**: the two source files and the three
notebook files above. Push waits for the owner.

---

## Open questions

1. **Does Channels DVR's player now start?** Only the owner's install can
   answer it, and the server is left running on `0.0.0.0:8804` for that.
   If it does not, the last unacted item on the task-010 diff is the
   H.264 **profile** (High L4.0 here, Constrained Baseline L4.2 in
   PrismCast) — out of scope here and not built.
2. **The mp4 muxer's audio warning.** `Packet duration: -192 / dts: N is
   out of range` (and `-240`), 24 times over roughly six minutes of
   streaming, always on the audio track at a whole-second dts — the 1 s
   MediaRecorder timeslice boundary. The TS muxer never reported this in
   eleven task-011 tunes on identical input because it does not derive a
   packet's duration from the next packet's dts. No effect was found on
   any measurement (hls.js 0 errors, continuous pull, +16.7 ms skew). Not
   acted on. If it turns out to matter to Channels' remuxer, the lever is
   on the audio filter side, and that is a question, not a change.
3. **`EXT-X-DISCONTINUITY` at stream start.** PrismCast emits one before
   its first segment; we emit none. hls.js does not care. Whether
   Channels' player treats its absence differently is unobserved.
4. **Brief v2** was not on disk; see the top of this report.

---

## Least sure of

1. **That the container is what the player was refusing.** Two theories
   have already died on contact with the real player; this is the third.
   It is the more plausible of the two remaining differences, because an
   MSE-based player consumes fMP4 natively and needs a transmux step for
   TS — but I have still never watched Channels' player fail or succeed
   myself, and the retest is the whole verdict.
2. **That the audio warning is truly harmless.** Every measurement says
   so, but "hls.js and ffmpeg accept it" is exactly the kind of evidence
   task-009 taught us not to over-trust for a different player's media
   stack.
3. **That one 4.096 s run represents the fMP4 latency.** Task-011's six
   channels ranged 3.85–4.36 s; one fMP4 run at 4.10 s sits inside that
   spread, which is consistent with "no cost" but does not prove it.

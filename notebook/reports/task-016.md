# Task 016 — repeat SPS/PPS in-band at every keyframe

Date: 2026-09-11. Host: marlinpc. Owner's Chrome pid 76888, never
restarted, still signed in. Nothing on 192.168.1.250 was contacted.

**Result: done and verified live.** libx264 now writes SPS and PPS
in-band before every IDR, so each keyframe is a self-contained
random-access point — matching the reference stream (task-015: PrismCast
keyframes are `(7,8,5,…)`; ours were `(6,5,…)` with the parameter sets
only in the init `avcC`). The `avcC` still carries them; this adds the
in-band copy and changes nothing else.

Whether this is what Channels' remuxer needed is for the owner's retest —
task-015 established `last_seq=1` cannot be reproduced with a local
ffmpeg stream-copy segmenter, so this cannot be confirmed here.

---

## Files touched, mapped to steps

| File | Step | Change |
|---|---|---|
| `src/capture.ts` | 1 | one arg pair added: `-x264-params repeat-headers=1`, with a comment |
| `notebook/KNOWN-FIXES.md` | 2 | two entries: local segmenter cuts our stream fine / `last_seq=1` not reproducible; libx264 keeps SPS/PPS in avcC only unless repeat-headers=1 |
| `notebook/SESSION-STATE.md` | 2 | Task 015 and Task 016 sections |
| `notebook/reports/task-015.md` | (pre-step) | the task-015 recon report, saved before starting |
| `notebook/reports/task-016.md` | 2 | this report |

Nothing else. No encoder, muxer, or playlist setting changed: profile
High, `-g 30 -keyint_min 30 -sc_threshold 0`, `-tune zerolatency`,
`-hls_time 1`, fMP4, and the task-014 PROGRAM-DATE-TIME rewrite are all
byte-for-byte as they were. No dependency added.

The encoder diff, in full:

```
-c:v libx264 -preset veryfast -tune zerolatency
-profile:v high -pix_fmt yuv420p
+ -x264-params repeat-headers=1
-g 30 -keyint_min 30 -sc_threshold 0
```

---

## NAL sequence evidence

Three consecutive keyframe samples, read from the actual `mdat` bytes of
the served `.m4s` segments (not via a bitstream filter, which would
inject parameter sets and hide the truth — the trap noted in task-015).
Cold tune at 23:52:26Z, segments read 23:52:31Z.

```
seg00000.m4s : (6, 7, 8, 6, 5, 5, 5, …)   SEI, SPS, PPS, SEI, IDR…
seg00001.m4s : (7, 8, 5, 5, 5, 5, 5, …)   SPS, PPS, IDR…
seg00002.m4s : (7, 8, 5, 5, 5, 5, 5, …)   SPS, PPS, IDR…
```

Before this task (task-015), the same samples were `(6,5,5,…)` — SEI
then IDR, no SPS/PPS. NAL types: 5 = IDR slice, 6 = SEI, 7 = SPS,
8 = PPS.

Init segment still carries the parameter sets in `avcC`:

```
avcC: profile_idc=100 (High)  level_idc=40  SPS count=1 (type 7)  PPS count=1
```

ffprobe on the live stream, unchanged from before:

```
profile=High  level=40  width=1920  height=1080  has_b_frames=0
keyframe spacing: 1.000 s ×11, 12 keyframes in 12 s
```

---

## Playback and pull

**hls.js 1.5.13**, page on 127.0.0.1:8807, stream on :8804,
cross-origin, CORS enforced, throwaway headless Chrome (torn down after):

```
title PLAYING  playing true  videoSize 1920x1080
decodedFrames 606  droppedFrames 0  manifestParsed true  fatal []  errors []
MANIFEST_PARSED / LEVEL_LOADED live=true frags=4 target=1
FRAG_LOADED sn=1 / sn=2 / sn=3 / VIDEO PLAYING …
```

(An earlier run reported a single non-fatal `bufferStalledError` while a
30 s ffmpeg pull was competing for the same live edge; a clean run with
the stream held warm showed 0 errors. It is a transient live-edge stall,
not a property of this change.)

**30 s ffmpeg pull**, `-c copy`:

| | |
|---|---|
| exit | 0, wall 27.2 s |
| segments opened | 31 |
| new warning classes | **none** |
| pre-existing warnings | "Found duplicated MOOV Atom. Skipped it" ×26 |

The duplicated-MOOV warning is the known task-015 artifact of ffmpeg
re-reading `EXT-X-MAP`/init on every 1 s playlist reload; it was present
before this change and is unrelated to it. No "out of range", no DTS
discontinuity, no duration-0 in the pull.

**Cold tune latency (task-011 method):** 4.317 s (task-014: 4.307 s;
task-012: 4.096 s). The extra in-band parameter sets are a few hundred
bytes per keyframe and are not measurable in the tune time.

---

## What was committed

One commit on `main`, **not pushed**: `src/capture.ts`, the three
notebook files, and `notebook/reports/task-015.md`. Commits `74e09c1`
(task-012) and `953b6cd` (task-014) are also still unpushed; all three
wait for the owner.

Server left running on `0.0.0.0:8804` for the Channels DVR test.

---

## Open questions

1. **Does Channels now reach `last_seq > 1`?** Only the owner's log can
   answer it — the reproduction gap from task-015 means it cannot be
   tested locally. If it still stops at 1, the next candidates (task-015
   ranking) are the repeated `EXT-X-MAP`/duplicated-MOOV on reload, then
   the `styp`/`sidx` segment boxes.
2. **Does the in-band repetition matter if Channels outputs MPEG-TS?**
   ffmpeg's mpegts muxer already injects SPS/PPS at keyframes, so if
   Channels' path did that, our old stream would have worked. That it
   did not is weak evidence Channels' copy path does *not* inject — which
   is exactly the case this change addresses — but it is inference, not
   observation.

## Least sure of

1. **That this fixes `last_seq=1`.** It closes the single biggest media
   difference from the working reference and is cheap and correct on its
   own terms, but task-015 could not reproduce the failure locally, so
   the fix is unverified against the actual consumer.
2. **That there are no second-order effects on Channels' probe.** The
   stream now carries SPS/PPS both in `avcC` and in-band; every local
   validator is happy with the redundancy, but a probe that counts or
   diffs parameter sets could conceivably react — unobserved.

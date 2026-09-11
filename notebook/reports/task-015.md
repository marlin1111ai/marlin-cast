# Task 015 — read-only recon: reproduce Channels' remux locally

Date: 2026-09-11. Host: marlinpc. Read-only: nothing changed, nothing
committed. Raw captures in the task-015 session scratchpad `t15/`. All
times UTC from marlinpc's clock. PrismCast contact was plain GETs on
port 5589 only. The owner's Chrome was used only for ESPN tunes.

**New evidence from Channels' log (owner-supplied, not fetched):** after
task-014, `[M3U] stream timestamps … start_at=end_at` is logged BEFORE
`[TNR] Opened connection`, so it is not derived from our media playlist
— dropped as a lead. Our ESPN session ran 31.02 s, `first_seq=1
last_seq=1`. PrismCast AMC reaches `last_seq=16` in 30 s. Channels'
remuxer is ffmpeg-based stream-copy (its logs carry `[mpegts @ …]` and
`[hls @ …]` tags).

**Headline: `last_seq=1` did not reproduce with any local stream-copy
segmenter.** Our media cuts into 16–17 segments in every configuration
tried, the same as PrismCast (16). So `last_seq=1` is most likely a
property of Channels' specific remux path, not of our media or HLS
output as a standard ffmpeg segmenter sees them.

---

## Step 1 — keyframe findings (ffprobe over 12 s of each live URL)

**Ours (ESPN), 23:28Z.** 12 keyframes in 12 s, spacing **exactly
1.000 s** every gap, all `pict_type=I`. Reading the actual `mdat` sample
bytes, every keyframe sample is `(6,5,5,…)` — SEI then IDR slices — with
**no in-band SPS(7)/PPS(8)**; the parameter sets are only in the init
`avcC` (profile_idc 100 / High, level 40). Every IDR sample is
sync-flagged in `trun` (non_sync=0); all 33 fragments' first video
sample is sync-flagged.

**PrismCast (AMC), 23:29Z.** 14 keyframes in 12 s, **irregular** spacing
(0.025–2.167 s), all `I`. Every keyframe sample is `(7,8,5,5,…)` — SPS +
PPS **repeated in-band** before the IDR slices — plus the same in `avcC`
(profile_idc 66 / Constrained Baseline, level 42). Also sync-flagged.

| property | ours | PrismCast |
|---|---|---|
| keyframes / 12 s | 12 | 14 |
| keyframe spacing | exactly 1.000 s | 0.025–2.167 s |
| all keyframes IDR (NAL 5) | yes | yes |
| SPS/PPS in avcC (init) | yes | yes |
| **SPS/PPS in-band per keyframe** | **no** | **yes** |
| IDR samples sync-flagged in trun | yes | yes |
| init edit list (elst) | yes (identity `(0,0)`) | no |
| segment boxes | `styp`+`sidx`+`sidx`+`moof` | bare `moof` |
| B-frames (has_b_frames) | 0 | 0 |

---

## Step 2 — reproducing the remux

Live `-c copy -f hls -hls_time 2` is distorted by the live pull ending
early, so the faithful run is on 30 s of harvested bytes (init +
concatenated segments), which removes that confound.

| `-c copy -hls_time 2` | ours | PrismCast |
|---|---|---|
| live, fmp4 output | 15 segs | 1 seg (pull ended ~11 s) |
| **deterministic, fmp4** | **17 segs** | **16 segs** |
| **deterministic, mpegts** | **17 segs** | **16 segs** |
| ours via mpegts first, then hls | 17 segs | — |

Deterministic runs: **zero warnings** on both. PrismCast's warnings
appear only on the live pull:

```
[hls @ …] Stream 0 packet with pts N has duration 0. The segment duration may not be precise.   (×86)
[hls @ …] DTS discontinuity in stream 0: packet 5 with DTS 481467, packet 6 with DTS 488790     (×1)
[mp4 @ …] Estimating the duration of the last packet in a fragment …
```

Ours, on the live pull, produced one PrismCast never did:

```
[mov,mp4,m4a,3gp,3g2,mj2 @ …] Found duplicated MOOV Atom. Skipped it     (×29)
```

---

## Step 3 — isolation

The premise ("ours yields one segment") never held locally, so each
named lever was isolated instead.

- **(a) sync-sample flags.** Flipping every IDR's `trun` first-sample
  flag to non-sync (`0x01010000`) → still **17 segments**. ffmpeg cuts
  on the IDR NAL in the bitstream, not the `trun` flag. Ours are already
  correct anyway.
- **(b) mpegts-first.** 17 segments. And the mpegts muxer **injects**
  SPS/PPS at each keyframe — the first output segment's NALs are
  `[9,6,7,8,5,…]` (AUD, SEI, SPS, PPS, IDR). An ffmpeg mpegts path
  auto-heals our missing in-band parameter sets.
- **(c) `src/capture.ts` encoder.** `-g 30 -keyint_min 30
  -sc_threshold 0` (1 s GOP, matching the 1.000 s spacing),
  `-tune zerolatency` (no B-frames, confirmed `has_b_frames=0`),
  `-profile:v high`, `-hls_time 1`, fMP4. No `repeat-headers` and global
  header not disabled, so libx264 keeps SPS/PPS in `avcC` only — the
  source of the in-band difference.
- **Static single-MAP VOD playlist over our exact segments:** 17
  segments, **0 duplicated-MOOV**. So the "duplicated MOOV" comes from
  the live playlist reload re-reading `EXT-X-MAP`, not the segment bytes.
- **Live init re-fetch:** ours 16 init-opens / 16 segment-opens (15
  duplicated-MOOV); PrismCast 5 / 6 (4 duplicated-MOOV). ffmpeg
  tolerates both and keeps cutting.

**No single property, when changed, flipped ours from one segment to
many — because ours is never one segment locally.**

---

## Ranked causes of `last_seq=1`

1. **No in-band SPS/PPS.** Our parameter sets are only in the init
   `avcC`; PrismCast repeats them before every keyframe. This is the
   classic requirement for a remuxer to treat each keyframe as an
   independent random-access point. Caveat: ffmpeg's mpegts muxer
   auto-injects them (3b), so an ffmpeg-based Channels outputting mpegts
   would heal it — this bites only if Channels' copy path does not
   inject (fMP4 output, or a stricter muxer).
2. **Repeated `EXT-X-MAP` → per-reload init/moov re-read.** Our 1 s
   segments make the playlist reload ~once a second; each re-signals the
   init and produces a "duplicated MOOV". ffmpeg skips it; a remuxer that
   re-initializes its output on each new moov would restart output
   segment 1.
3. **`styp`+`sidx` boxes in our segments** (PrismCast: bare `moof`).
   Ignored by ffmpeg; a stricter demuxer could mis-handle.
4. **Edit list in init moov.** Demoted: the video `elst` is an identity
   `(0,0)` no-op.

## The one-line fix (named)

Repeat SPS/PPS in-band, matching PrismCast: add
`-x264-params repeat-headers=1` to the ffmpeg args in `src/capture.ts`.
Cleanest single-line lever for candidate 1 and the biggest media
difference from the working reference. (Applied in task-016.)

---

## Open questions

1. Channels' actual output container (mpegts vs fMP4) and whether it
   injects SPS/PPS — decides whether the fix applies. Only the owner's
   install can show it.
2. Channels' exact ffmpeg invocation/version — its logs are
   ffmpeg-tagged, yet ffmpeg 6.1.1 segments ours fine.
3. Why our init is re-fetched per live reload more than PrismCast's.

## Least sure of

1. That in-band SPS/PPS is the cause at all — ffmpeg heals it for mpegts
   and `last_seq=1` never reproduced.
2. That `last_seq=1` is a media/HLS-output property rather than a
   Channels-internal behavior; every local stream-copy segmenter cut
   ours into 16–17 segments.

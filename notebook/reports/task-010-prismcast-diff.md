# Task 010 — Marlin Cast vs PrismCast, layer by layer

Date: 2026-09-11. Host: marlinpc. DISPLAY=:10.

**The headline, and it corrects Task 009: PrismCast sends no CORS
headers at all, and it plays.** Measured directly — a GET to its variant
playlist carrying `Origin: http://192.168.1.250:8089` comes back with no
`Access-Control-Allow-Origin`. So Channels DVR's player does **not**
need CORS, Task 009's fix was not the cure, and the owner's symptom was
never a CORS failure. Task 009 fixed a real defect that would break a
browser fetching our stream directly; it was not this bug. Stating that
plainly before anything else.

**The difference that survives the evidence is time.** PrismCast returns
a playlist containing a playable segment **5.22 s** after a cold
request. Marlin Cast took **19.35 s**. The owner's player gives up at
around 15 s — which is why the patient server-side remuxer succeeds
("Remux Starting: 31s @ 1.02x") while the impatient player shows
"could not be loaded". PrismCast lands inside the window; we did not.

Fixed what the HLS output path allows: **19.35 s → 16.72 s**. That is
still **11.5 s slower than PrismCast**, and the remaining **14.17 s
lives in the tune path**, which step 7 forbids me to touch without
asking. That question is at the end, with numbers.

Chrome pid 76888 was used throughout, never restarted, still signed in.
Only ordinary GETs were made to 192.168.1.250:5589. Port 8089 was never
touched; no container, log, or config was inspected.

---

## (i) HTTP header diff — step 4a

| Header | **Marlin Cast** | **PrismCast** |
|---|---|---|
| Playlist status | `200` | `200` |
| Playlist `Content-Type` | `application/vnd.apple.mpegurl` | `application/vnd.apple.mpegurl; charset=utf-8` |
| `/playlist` `Content-Type` | `application/x-mpegurl; charset=utf-8` | `audio/x-mpegurl; charset=utf-8` |
| Playlist `Cache-Control` | `no-cache` | `no-cache` |
| Segment `Content-Type` | `video/mp2t` | `video/mp4` |
| Segment `Cache-Control` | **`public, max-age=31536000, immutable`** | **`no-cache`** |
| `Access-Control-Allow-Origin` | `*` (added Task 009) | **ABSENT** |
| CORS preflight (`OPTIONS`) | `204` + allow headers | not offered |
| `Range: bytes=0-99` on a segment | `206 Partial Content` + `Content-Range` | **`200`, whole body, no `Content-Range`** |
| `Transfer-Encoding` | none — `Content-Length` | none — `Content-Length` |
| `Connection` | `keep-alive`, `timeout=5` | `keep-alive`, `timeout=5` |
| `ETag` | yes (weak) | yes (weak) |
| `X-Powered-By` | disabled | `Express` |

**Two things this kills as candidates.** PrismCast has **no CORS** and
**no Range support**, and it plays. Neither can be what separates them.

**One thing it raises.** PrismCast marks segments `no-cache`; Task 009
marked ours `immutable` for a year. That reasoning was wrong and it is
fixed in (vii) — see there for why the URL, not the file, is what
matters.

---

## (ii) Playlist diff — step 4b

**PrismCast** (ESPN, cold):

```
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:15
#EXT-X-DISCONTINUITY-SEQUENCE:0
#EXT-X-MAP:URI="init.mp4?v=1"
#EXT-X-DISCONTINUITY
#EXT-X-MAP:URI="init.mp4?v=1"
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T21:41:51.135Z
#EXTINF:1.792,
segment15.m4s
```

**Marlin Cast, before this task** (ESPN, cold):

```
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-INDEPENDENT-SEGMENTS
#EXTINF:2.000000,
seg00000.ts
```

| Tag | Marlin Cast | PrismCast |
|---|---|---|
| `EXT-X-VERSION` | 6 | **7** (required by `EXT-X-MAP`) |
| `EXT-X-TARGETDURATION` | 2 | 2 |
| `EXT-X-MEDIA-SEQUENCE` | 0 | 15 |
| `EXT-X-INDEPENDENT-SEGMENTS` | **present** | absent |
| `EXT-X-MAP` | absent | **present** (fMP4 init segment) |
| `EXT-X-DISCONTINUITY-SEQUENCE` | absent | **present** |
| `EXT-X-DISCONTINUITY` | absent | **present** |
| `EXT-X-PROGRAM-DATE-TIME` | absent | **present** |
| `EXT-X-ENDLIST` | absent (live) | absent (live) |
| `EXT-X-PLAYLIST-TYPE` | absent (live) | absent (live) |
| Segments in the window | **1** | **1** |
| `EXTINF` | 2.000000 | 1.792 (variable) |

**The one-segment cold window is identical in both**, which finally
settles a candidate Task 009 left open: PrismCast serves exactly one
segment on a cold request and plays fine, so a short start-up window is
**not** the problem in either stream.

---

## (iii) Structural difference — step 4c

**There is none at this level, and that is a finding worth stating
plainly.** Both `/playlist` entries point **directly at a media
playlist**, not at a master playlist:

```
PrismCast :  http://192.168.1.250:5589/hls/espn/stream.m3u8   -> #EXTINF + segments
Marlin    :  http://192.168.1.245:8804/stream/<id>/index.m3u8 -> #EXTINF + segments
```

Neither serves an `#EXT-X-STREAM-INF` master playlist. Both are
single-level, single-rendition live playlists. **"Channels DVR needs a
master playlist" is ruled out.**

---

## (iv) Segment format diff — step 4d

| | **Marlin Cast** | **PrismCast** |
|---|---|---|
| Container | **MPEG-TS** (`.ts`) | **fMP4 / CMAF** (`init.mp4` + `.m4s`) |
| Init segment | none (TS is self-contained) | **`init.mp4`, 1305 bytes**, `ftyp`+`moov` with two `trex` |
| Video codec | h264 | h264 |
| **Profile / Level** | **High / 4.0** | **Constrained Baseline / 4.2** |
| Resolution | 1920x1080 | 1920x1080 |
| Pixel format | yuv420p | yuv420p |
| Audio | AAC-LC 48 kHz stereo | AAC-LC 48 kHz stereo |
| Segment duration | 2.000 s (now 1.0 s) | ~1.77–1.79 s, variable |
| Keyframe placement | one IDR at the head of every segment | one per segment |
| Video timescale | 90 kHz (TS) | 16 kHz (`time_base=1/16000`) |
| First video PTS | 1.4667 s | n/a (fMP4, per-fragment `baseMediaDecodeTime`) |

Two genuine differences here: **container** (TS vs fMP4) and **profile**
(High vs Constrained Baseline — no B-frames, no CABAC, the maximally
compatible choice).

**Neither was changed, because the evidence does not support it.**
Task 009 established that hls.js — the library behind the Video.js
player whose error string the owner sees — plays our MPEG-TS/High stream
to 739 decoded frames with zero errors. A format a browser player
demonstrably decodes is not the reason that player refuses to start.
Both remain ranked candidates in (vi).

---

## (v) Latency comparison — steps 4e and 6

Cold request, channel not currently tuned, wall-clock to a `200`
carrying a playable segment:

| | Time |
|---|---|
| **PrismCast** | **5.222 s** |
| **Marlin Cast, before** | **19.355 s** |
| **Difference** | **+14.13 s — 3.7x slower** |

Instrumented breakdown of our 19.35 s, measured from the HTTP request:

| Stage | Elapsed |
|---|---|
| Page navigation, layout override, player ready, 1080p pin — the **tune path** | **14.17 s** |
| ffmpeg start-up + first complete segment — the **HLS output path** | **+5.12 s** |
| **Total** | **19.29 s** |

The 14.17 s is almost exactly the sum of three hardcoded sleeps in the
tune path: `9000 + 1500 + 3500 = 14000 ms`.

**Could latency alone produce this error? Yes, and it is the best
explanation on the evidence.** The owner waited ~15 s and got the error;
at 15 s our server had returned nothing at all. The failure is
timeout-shaped: the component that is patient (Channels' server-side
remuxer, which happily waited and then ran at 1.02x for 31 s) succeeded,
and the component that is not (the player) failed. PrismCast, at 5.22 s,
never puts the player in that position.

---

## (vi) The named difference — step 5

**Ranked.**

1. **First-playlist latency — 19.35 s against PrismCast's 5.22 s.**
   The only measured difference large enough to explain a
   timeout-shaped failure, and the failure is timeout-shaped. Supported
   by the split above: everything that is patient works, everything
   that is not, does not. **This is the finding acted on.**
2. **Segment cache headers.** PrismCast: `no-cache`. Ours since Task
   009: `immutable, max-age=1 year` — on URLs that are **reused with
   different media on every tune**, because each tune wipes the
   directory and ffmpeg restarts numbering at `seg00000.ts`. A retune
   of a previously-tuned channel could be served stale segments by any
   cache in the path. This cannot explain the original failure (the
   header did not exist before Task 009) but it is a real defect and
   would corrupt exactly the retune the owner performed. **Fixed.**
3. **Container: MPEG-TS vs fMP4.** A real difference. Not acted on —
   hls.js decodes our TS.
4. **Profile: High vs Constrained Baseline.** A real difference. Not
   acted on — same reason.

**Ruled out by measurement, not by argument:** CORS (PrismCast has
none), Range support (PrismCast has none), master-vs-media playlist
structure (both single-level), one-segment cold window (both do it),
`EXT-X-ENDLIST`/`PLAYLIST-TYPE` handling (identical), keyframe placement,
resolution, audio codec, `Transfer-Encoding`, and keep-alive behaviour.

---

## (vii) Fix applied, mapped to the finding

Both changes are in the HLS output path and the server. The capture
method, codec target, dependency list and tune path are untouched.

**Fix 1 — cut HLS-output latency (finding 1).** `src/capture.ts`,
ffmpeg output flags and segmenter settings only:

| Change | Why |
|---|---|
| `-hls_time 2` → **`-hls_time 1`** | the first complete segment is the gate on first playback; halving it halves that wait |
| `-g 60 -keyint_min 60` → **`-g 30 -keyint_min 30`** | a 1 s GOP so a 1 s segment still starts on an IDR (verified: 65 keyframes in 1950 frames) |
| added **`-tune zerolatency`** | drops B-frames and encoder lookahead; reordering delay buys nothing on a live capture |
| `-hls_list_size 6` → **`10`** | keeps the window at ~10 s now that segments are 1 s |
| added **`+program_date_time`** | matches the reference stream, which carries `EXT-X-PROGRAM-DATE-TIME` |

Measured effect: HLS output path **5.12 s → ~2.5 s**; cold total
**19.35 s → 16.72 s**.

**Fix 2 — segment cache header (finding 2).** `src/server.ts`:
`public, max-age=31536000, immutable` → **`no-cache`**, matching
PrismCast. Task 009's reasoning ("a written segment never changes") was
true of the *file* and false of the *URL*.

**Deliberately not changed:** container format, H.264 profile, and the
tune path. The first two have no supporting evidence; the third is
forbidden without asking, and the question is in (x).

---

## (viii) Post-fix verification — step 8

**hls.js, cross-origin (page on `:8807`, stream on `:8804`), CORS
enforced, no `--disable-web-security`:**

```
document.title : PLAYING
playing        : true
decoded frames : 647
fatal errors   : []
all errors     : []
MANIFEST_PARSED / LEVEL_LOADED live=true frags=10 target=1
FRAG_LOADED sn=11 / sn=12 / sn=13 / VIDEO PLAYING / sn=14 / sn=15 / sn=16 ...
```

**65 s pulled over HTTP and measured from the output:**

| | Measured |
|---|---|
| Received | 50,902,504 bytes |
| Video | **H.264 High, Level 4.0, yuv420p, 1920x1080**, `r_frame_rate=30/1` |
| Audio | **AAC-LC, 48 000 Hz, stereo** |
| Frame rate | **30.02 fps** (1950 packets over 64.97 s) |
| Duration | **64.97 s**; decode pass `frame=1950 time=00:01:04.96` |
| Bitrate | **6.27 Mbps** |
| Keyframes | **65 in 1950 frames** — exactly one per second, confirming the 1 s GOP |
| Luma, 33 samples | **48.42 – 132.11, VARYING** |
| `blackdetect` | **no black intervals** |
| Audio | mean **−29.9 dB**, peak **−3.1 dB**, **0** silent runs ≥ 1 s |
| **A/V sync** | start **+8.3 ms**, end **+22.0 ms**, **drift +13.7 ms over 65 s** |
| **Cold first-request latency** | **16.72 s** (was 19.35 s) |

Final playlist and segment headers:

```
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:1
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-INDEPENDENT-SEGMENTS
#EXTINF:1.000000,
#EXT-X-PROGRAM-DATE-TIME:2026-09-11T17:49:43.657-0400
seg00000.ts

HTTP/1.1 200 OK      (segment)
access-control-allow-origin: *
Content-Type: video/mp2t
cache-control: no-cache
Accept-Ranges: bytes
```

**One cosmetic difference from the reference worth recording:** ffmpeg
emits `EXT-X-PROGRAM-DATE-TIME` *between* `EXTINF` and the segment URI,
while PrismCast emits it *before* `EXTINF`. hls.js parsed ours without
complaint (647 frames, zero errors), so it is noted rather than treated
as a defect.

---

## (ix) Files touched — step mapping

| File | Step | Change |
|---|---|---|
| `src/capture.ts` | 7 | ffmpeg output flags and segmenter settings: `-hls_time 1`, `-g 30 -keyint_min 30`, `-tune zerolatency`, `-hls_list_size 10`, `+program_date_time` |
| `src/server.ts` | 7 | segment `cache-control` `immutable` → `no-cache` |
| `notebook/reports/task-010-prismcast-diff.md` | 11 | this report |

Nothing else. `src/channels.ts`, `src/cdp.ts`, `extension/`, `scripts/`
and `package.json` unchanged; **no dependency added**. No Dockerfile, no
Xvfb, no container, no XMLTV or station IDs, no hardware encoding, no
authentication, no UI, no concurrency change. The 720p pin defect is
still present and was **not** this task's work, as instructed — it
appeared again in this task's logs
(`[tune] ESPN {"ok":true,"quality":"hd720","video":"0x0","box":"0x0"}`).

**Unraid contact was limited to ordinary GETs on port 5589**:
`/playlist`, `/hls/espn/stream.m3u8`, `/hls/espn/init.mp4?v=1` and one
`.m4s` segment. No ssh, no docker, no container inspection, no logs, no
config, nothing on port 8089, no POST.

**Diagnostic rig** (scratchpad, removed): a throwaway Chrome on port
9447 with its own profile, `python3 -m http.server 8807` on loopback for
the hls.js test page, and the CDP driver from Task 009.

---

## (x) What only Channels DVR can confirm — and the question I must ask

1. **Its player's actual timeout.** The latency finding rests on the
   owner's "waited ~15 s, error appeared" plus the fact that the patient
   component succeeded and the impatient one failed. I could not measure
   Channels' timeout, because inspecting it is out of scope. **16.72 s
   may still be too slow.**
2. **Whether the player fetches our URL or a remuxed copy.** Still not
   observed, and now more interesting: PrismCast works without CORS,
   which is evidence the player does *not* fetch the source directly.
3. **Whether MPEG-TS/High is acceptable to it.** PrismCast uses
   fMP4/Constrained Baseline. I have no evidence TS fails, and changing
   it blind would be guessing.

### STOP — the question, with numbers

**14.17 of the remaining 16.72 seconds is three hardcoded sleeps in the
tune path** (`9000 ms` after `Page.navigate`, `1500 ms` after the layout
override, `3500 ms` after the quality pin). Step 7 forbids me to touch
the tune path without asking, so I did not.

**May I replace those fixed sleeps with polls that exit as soon as the
condition is true?** The player-ready poll already exists immediately
after the 9 s sleep, so most of that 9 s is dead time on a page that is
usually ready sooner. My estimate is this brings a cold tune to roughly
**6–8 s**, comparable to PrismCast's 5.22 s — and on the latency finding
that is the difference between the player waiting and the player giving
up. It is the single highest-value change left, and I will not make it
unasked.

---

## (xi) Least certain

1. **That latency is actually the cause.** It is the largest measured
   difference, it is the right *shape* for the symptom, and every other
   candidate the diff surfaced has been eliminated by PrismCast itself
   doing the same thing and working. But I never observed Channels DVR's
   player failing or succeeding — I inferred it from the owner's report
   and from which of its two components survived. If the true cause is
   the container format, this task's fix will not help and the next
   experiment is fMP4.
2. **That 16.72 s is now fast enough.** Probably not, honestly. Without
   the tune-path change we have closed 2.6 s of a 14.1 s gap. I would
   not expect the owner's retune to succeed yet, and I would rather say
   so than imply a fix that may not hold.
3. **That adding `EXT-X-PROGRAM-DATE-TIME` was justified.** The evidence
   for it is only "the working reference has it". hls.js is indifferent.
   It is emitted in a different position than PrismCast's, and if
   anything downstream parses tag order strictly, it is the change most
   likely to have made things marginally worse rather than better.

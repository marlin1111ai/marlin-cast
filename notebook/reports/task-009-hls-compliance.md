# Task 009 — Why Channels DVR received the stream but played nothing

Date: 2026-09-11. Host: marlinpc. DISPLAY=:10.

**Status: diagnosed, reproduced, fixed, and verified.**

**The cause is CORS.** Marlin Cast sent no `Access-Control-Allow-Origin`
header on the playlist or the segments, and answered a CORS preflight
with `404`. A server-side puller — ffmpeg, curl, Channels DVR's own
remuxer — is unaffected by CORS and pulls happily, which is exactly why
Channels could report `Remux Starting: 17s @ 1.04x` while the picture
stayed black. A **browser** HLS player fetches the playlist with
XHR/fetch, and the browser refuses to hand it the response at all.

Reproduced against the real server with hls.js (the library behind
Video.js, whose "The media could not be loaded…" string is the error the
owner saw):

| | Before | After |
|---|---|---|
| hls.js, cross-origin, CORS enforced | **FATAL `manifestLoadError`, 0 frames decoded, never played** | **PLAYING, 739 frames, 0 errors** |

The decisive control: with the identical stream and an identical player,
starting the test browser with `--disable-web-security` made it play.
Nothing about the media changed — only whether the browser was willing
to read it.

Chrome pid 76888 was used throughout, never restarted, and is still
signed in and playing 1080p. Nothing was queried on Unraid.

---

## (i) Playlist verbatim — before and after

**Unchanged by the fix.** The playlist was never the problem, and it is
reproduced here so that is on the record.

### The FIRST request for a channel, from a cold server

```
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-INDEPENDENT-SEGMENTS
#EXTINF:2.000000,
seg00000.ts
```

`EXT-X-PLAYLIST-TYPE`: **absent** (correct — it is a live playlist).
`EXT-X-ENDLIST`: **absent** (correct, same reason).

### Mid-stream, once the window has filled

```
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:2
#EXT-X-MEDIA-SEQUENCE:72
#EXT-X-INDEPENDENT-SEGMENTS
#EXTINF:2.000000,
seg00072.ts
#EXTINF:2.000000,
seg00073.ts
#EXTINF:2.000000,
seg00074.ts
#EXTINF:2.000000,
seg00075.ts
#EXTINF:2.000000,
seg00076.ts
#EXTINF:2.000000,
seg00077.ts
```

### (c) Sliding window, and durations against target duration

**It is a live sliding window, not an ever-growing list.** Sampled at
0 s / 3 s / 9 s, `EXT-X-MEDIA-SEQUENCE` advanced **72 → 74 → 77** while
the list stayed at six entries, so old segments leave as new ones
arrive.

**Segment durations match the target duration exactly**: every `EXTINF`
mid-stream is `2.000000` against `EXT-X-TARGETDURATION:2`. No segment
exceeds it.

One historical note, since task-008 recorded it: that task's very first
playlist showed `#EXTINF:2.400000` under `#EXT-X-TARGETDURATION:2`,
which *is* an RFC 8216 §4.3.3.1 violation (2.4 rounds to 2, so it is
borderline legal; a 2.5 s segment would not be). It did **not** recur in
any playlist measured today — every first segment came out at 2.000000.
Recorded as observed-once, not reproduced.

---

## (ii) Segment probe results — step 4b

Twenty segments were fetched over HTTP exactly as a client fetches them
and probed individually. **They are clean.** Representative results:

| | seg00000 | seg00001 | seg00002 | seg00005 |
|---|---|---|---|---|
| Video | h264 High **Level 4.0** 1920x1080 | same | same | same |
| Frame rate | 30/1 | 30/1 | 30/1 | 30/1 |
| Audio | aac **LC** 48 kHz stereo | same | same | same |
| Video packets | 60 | 60 | 60 | 60 |
| Keyframes | 1 | 1 | 1 | 1 |
| **Starts with a keyframe** | **yes** (`K__`) | **yes** | **yes** | **yes** |
| First video PTS / DTS | 1.4667 / 1.4000 | 3.4667 / 3.4000 | 5.4667 / 5.4000 | 11.4667 / 11.4000 |
| Audio packets | 91 | 93 | 94 | 94 |

- **Both streams are present in every segment.**
- **Every segment begins with an IDR**, so the
  `#EXT-X-INDEPENDENT-SEGMENTS` tag is honest.
- **Keyframe interval is exactly one per 2 s segment** (60 packets at
  30 fps, one keyframe) — GOP and segment boundaries are aligned.
- **PTS is continuous across every boundary**: 1.4667 → 3.4667 → 5.4667
  → … → 11.4667, a clean 2.000 s step with no gap, overlap or reset.
  DTS trails PTS by a constant 0.0667 s (two frames of B-pyramid), which
  is normal.
- Video PTS starts at **1.4667 s, not zero**. Not a violation; noted
  because a non-zero start trips some naive players.

**Correction, because it appeared in my own tooling:** a conformance
script I wrote for this task reported "NO VIDEO stream / NO AUDIO
stream / does NOT start with a keyframe" for every segment. That was a
**bug in my script's ffprobe field parsing**, not a property of the
media — the direct probes above, with explicit `key=value` output,
show video, audio and a leading keyframe in all of them. Stating it
because the wrong output was generated during this task and should not
be mistaken for evidence.

---

## (iii) HTTP layer — step 4d

### Before the fix

| Check | Result |
|---|---|
| Playlist status / type | `200`, `Content-Type: application/vnd.apple.mpegurl` ✅ |
| `/playlist` type | `200`, `application/x-mpegurl; charset=utf-8` ✅ |
| Segment status / type | `200`, `Content-Type: video/mp2t` ✅ |
| Playlist `cache-control` | `no-cache` ✅ |
| Segment `cache-control` | **absent** (segments are immutable; should be cacheable) |
| **`Access-Control-Allow-Origin`** | **ABSENT**, even when the request carried `Origin: http://192.168.1.250:8089` ❌ |
| **CORS preflight (`OPTIONS`)** | **`HTTP 404`** ❌ |
| **`Range: bytes=0-99` on a segment** | **`HTTP 200` with the whole file**, no `Content-Range`, no `Accept-Ranges` ❌ |

### First-request latency

**19.35 s** (cold, server idle, measured wall-clock from request to a
`200` carrying at least one playable segment). Confirmed repeatedly:
19.35 / 19.38 / 21.11 / 21.12 s across the task. Warm requests return in
**0.0007 s**.

---

## (iv) What a strict player rejected, and why — steps 4e and 5

Three validators were used, because they disagree, and the disagreement
is the whole diagnosis.

| Validator | Before the fix | What it proves |
|---|---|---|
| **ffprobe** | accepts — h264 High / aac LC, 1920x1080, 30/1 | the media is well-formed |
| **GStreamer `hlsdemux`** (`uridecodebin` → `fakesink`) | **reaches PLAYING, 0 errors**, decodes via `nvh264dec` | a non-browser HLS client accepts the playlist *and* the media |
| **hls.js 1.5.13 in Chrome** (the library behind Video.js) | **`FATAL networkError / manifestLoadError`, 0 frames, never played** | a *browser* client cannot even read the playlist |

`document.title` went to `FATAL:manifestLoadError` and the event trace
contained one line: `ERROR networkError / manifestLoadError fatal=true`.
No `MANIFEST_PARSED`, no `FRAG_LOADED` — it never got the bytes.

### The discriminating experiment

Four arms, same media each time:

| Arm | Playlist source | Browser security | Result |
|---|---|---|---|
| A | 1-segment playlist, static, **same origin** as the page | enforced | **PLAYING**, 56 frames |
| B | 6-segment playlist, static, **same origin** | enforced | **PLAYING**, 176 frames |
| C/D | live server `:8804`, **cross-origin** from the page on `:8807` | enforced | **FATAL `manifestLoadError`** |
| E/F | live server `:8804`, **cross-origin**, `--disable-web-security` | **disabled** | **PLAYING**, 736 / 614 frames |

Arms E and F are the proof. Nothing about the stream changed between C
and E — same URL, same server, same segments. Only the browser's
willingness to read a cross-origin response changed, and that flipped it
from "cannot be loaded" to playing.

### (4e) Ranked causes

1. **Missing CORS headers — the cause.** No
   `Access-Control-Allow-Origin` on the playlist or segments, and a
   `404` on preflight. Fatal to any browser HLS player served from an
   origin other than Marlin Cast's; invisible to every server-side
   puller. Proven by the A/B above.
2. **19-second blocking first request — real, not fatal.** hls.js
   survived it (arm F played from a cold start), so it is not the bug.
   It remains a genuine liability: hls.js's default
   `manifestLoadingTimeOut` is 10 s and it only survived because it
   retries. A client that does not retry would fail here.
3. **One-segment first window — real, not fatal.** A cold start offers a
   single 2 s segment with no `EXT-X-ENDLIST`, which is less than the
   three target durations RFC 8216 §6.3.3 says a client needs to pick a
   start point. hls.js reported a **non-fatal** `bufferStalledError`,
   then recovered as segments appeared. Cosmetic stall, not the failure.

Candidates **ruled out by measurement**: codec/profile/level
(h264 High L4.0 + aac LC, accepted by all three validators), resolution,
frame rate, keyframe alignment, segment independence, PTS/DTS
continuity, missing audio or video, target-duration mismatch,
sliding-window behaviour, playlist tag syntax, and Content-Type.

---

## (v) The fix, mapped to the finding

Applied to `src/server.ts` only — the HLS output path. The capture
method, codec target, tune path and dependency list are untouched.

**Fix 1 — CORS (justified by finding 1, the named cause).** One
middleware ahead of every route:

```ts
res.setHeader("access-control-allow-origin", "*");
res.setHeader("access-control-allow-methods", "GET, HEAD, OPTIONS");
res.setHeader("access-control-allow-headers", "range, origin, accept, content-type");
res.setHeader("access-control-expose-headers", "content-length, content-range, accept-ranges, date");
res.setHeader("access-control-max-age", "86400");
if (req.method === "OPTIONS") { res.status(204).end(); return; }
```

**Fix 2 — honour `Range` on segments (justified by the finding in (iii)
that `Range` returned `200` and the whole file).** Segments now go out
through `res.sendFile`, which implements `Range`, `Accept-Ranges` and
`Content-Range`, instead of `createReadStream().pipe()`, which ignored
them. Segments also gained
`cache-control: public, max-age=31536000, immutable`, which is safe
because a written segment never changes.

**Deliberately NOT changed**, because the evidence did not name them and
step 6 forbids guessing: the 19 s first-request latency, the one-segment
first window, the codec target, the capture path, and the tune path.
Both are in OPEN QUESTIONS with a recommendation.

### Verified after the fix

```
$ curl -D - -X OPTIONS -H 'Origin: http://192.168.1.250:8089' .../index.m3u8
HTTP/1.1 204 No Content
access-control-allow-origin: *
access-control-allow-methods: GET, HEAD, OPTIONS
access-control-allow-headers: range, origin, accept, content-type
access-control-expose-headers: content-length, content-range, accept-ranges, date
access-control-max-age: 86400

$ curl -D - -H 'Range: bytes=0-99' .../seg00019.ts
HTTP/1.1 206 Partial Content
access-control-allow-origin: *
Accept-Ranges: bytes
Content-Range: bytes 0-99/1361684
Content-Length: 100

$ curl -D - .../seg00019.ts
HTTP/1.1 200 OK
Content-Type: video/mp2t
cache-control: public, max-age=31536000, immutable
Accept-Ranges: bytes
```

| Check | Before | After |
|---|---|---|
| hls.js cross-origin, CORS enforced | FATAL `manifestLoadError`, 0 frames | **PLAYING, 739 frames, 0 errors** |
| `OPTIONS` preflight | `404` | **`204` + allow headers** |
| `Range: bytes=0-99` | `200`, whole file | **`206` + `Content-Range`** |
| `Access-Control-Allow-Origin` | absent | `*` |
| GStreamer `hlsdemux` | PLAYING, 0 errors | PLAYING, 0 errors |
| ffprobe | accepts | accepts |

The post-fix hls.js trace is the one that matters — cross-origin, with
normal browser security:

```
MANIFEST_PARSED
LEVEL_LOADED live=true frags=2 target=2
FRAG_LOADED sn=0
FRAG_LOADED sn=1
VIDEO PLAYING
LEVEL_LOADED live=true frags=3 target=2
FRAG_LOADED sn=2
...
```

---

## (vi) Post-fix stream measurement — step 7

65 s pulled over HTTP from `:8804` with ffmpeg and measured **from the
received file**, not from settings.

| | Measured |
|---|---|
| Received | **50,183,592 bytes** |
| Video | **H.264 High, Level 4.0, yuv420p, 1920x1080**, `r_frame_rate=30/1` |
| Audio | **AAC-LC, 48 000 Hz, stereo** |
| Frame rate | **30.02 fps** (1951 packets over 65.00 s) |
| Duration | **65.00 s** video / 65.00 s audio; decode pass `frame=1951 time=00:01:05.00` |
| Bitrate | **6.18 Mbps** |
| Whole-frame luma, 33 samples | **28.24 – 181.76, VARYING** |
| `blackdetect` | **no black intervals** |
| Audio | mean **−24.6 dB**, peak **−6.1 dB** |
| Silence ≥ 1 s at −50 dB | **0 runs** |
| **A/V sync** | start **−54.0 ms**, end **−52.3 ms**, **drift +1.7 ms over 65 s** |
| **First-request latency (cold)** | **21.12 s** — unchanged, the fix does not touch it |

**A note on the drift figure, so it is not over-claimed.** Task-008
measured −139.7 ms of drift over 70 s; this run shows **+1.7 ms** over
65 s. I changed nothing that should affect A/V timing, so I am **not**
claiming credit for it. Two runs of live television are not a
controlled comparison, and the honest reading is that drift varies
between runs and has not been characterised.

---

## (vii) Files touched — step mapping

| File | Step | Change |
|---|---|---|
| `src/server.ts` | 6 | CORS middleware + `OPTIONS` preflight (fix 1); segments via `res.sendFile` for `Range`, plus immutable `cache-control` (fix 2) |
| `notebook/reports/task-009-hls-compliance.md` | 10 | this report |

**Nothing else.** `src/capture.ts`, `src/channels.ts`, `src/cdp.ts`,
`extension/`, `scripts/`, `package.json` and the dependency list are
unchanged. No Dockerfile, no Xvfb, no container, no XMLTV, no hardware
encoding, no authentication, no UI, no concurrency change, no new
dependency. Only 8804 is bound by the product.

**Diagnostic rig** (scratchpad, all removed): a throwaway Chrome on
port 9447 with its own profile; `python3 -m http.server 8807` bound to
127.0.0.1 to serve the hls.js test page and the static A/B playlists;
`hlsjs.mjs` to drive it over CDP; an RFC 8216 checker (whose stream
parsing was buggy — see (ii)); and `probe.sh` to archive playlists and
segments. **Nothing on Unraid was contacted; the Channels DVR container
was never queried, including its logs.** `backups/` and
`data/chrome-profile-v11-*` were not read or written.

---

## (viii) What remains unverified — only Channels DVR can confirm it

1. **That CORS is what Channels DVR's player was hitting.** This is the
   honest limit of the diagnosis. I proved that a browser HLS player
   cannot load this stream cross-origin and can once CORS headers are
   present. Whether Channels DVR's player fetches Marlin Cast's URL
   **directly** (CORS applies, and this fix is the cure) or plays a
   **remuxed copy from its own origin** (CORS would not apply, and
   something else is wrong) is **not observed** — determining it would
   mean inspecting the Channels DVR container, which is forbidden. The
   "Remux Starting" line the owner saw suggests a server-side remux
   exists; it does not establish which URL the player element is given.
2. **That the 21 s first-request latency is inside Channels DVR's tuner
   timeout.** Not observed. Channels tuned within ~3 s per the owner,
   which suggests it fires the request and waits, but its patience limit
   is unknown.
3. **Whether Channels DVR sends `Range` requests for segments.** Now
   supported either way, but not observed to be needed.
4. **End-to-end playback in Channels DVR itself.** Not attempted — it
   would require driving the Channels DVR UI on Unraid.

---

## (ix) OPEN QUESTIONS

1. **Should the first request wait for three segments?** It would remove
   the non-fatal `bufferStalledError` on cold start and satisfy RFC 8216
   §6.3.3, at the cost of roughly 4 more seconds on an already 21 s
   tune. That trade is the owner's call, so it was not made.
2. **Can the 21 s tune latency come down at all?** It is ~9 s of page
   navigation, ~1.5 s of layout override, the player wait, a 3.5 s
   settle after the quality pin, then ffmpeg cutting a first segment. It
   is the single worst number in the product.
3. **The 1080p pin does not always hold.** The server log from the
   owner's own session recorded
   `[tune] Freeform {"ok":true,"quality":"hd720","video":"0x0","box":"0x0"}`
   — the tune reported success while the player was at **720p** and the
   video element read **0x0**, meaning the element reference had gone
   stale by the time it was measured (KNOWN-FIXES already warns the page
   carries 40 `<video>` elements). Two separate issues hide there: a
   measurement that can report a stale element, and 720p actually being
   served. Out of scope today — the tune path was explicitly not to be
   touched — but it directly affects picture quality.
4. **Should `access-control-allow-origin` be `*`?** It is the standard
   choice for a LAN media server and matches what other HLS servers do,
   but it does mean any web page the owner visits can read the stream
   URLs if it knows the address. There is no authentication (out of
   scope).

---

## (x) Least certain

1. **That this actually fixes the owner's symptom.** I reproduced a
   fatal browser-player failure against the real server, fixed it, and
   verified the same player now plays. What I could not do is confirm
   that Channels DVR's player was failing for *that* reason rather than
   a second, unrelated one that happens to produce the same Video.js
   error string. The fix is correct and necessary regardless; whether it
   is sufficient is the owner's next test.
2. **That hls.js in my rig behaves like Channels DVR's player.** It is
   the right family — Video.js's error text is what the owner saw, and
   Video.js uses hls.js for HLS in Chrome — but version, configuration
   and how Channels wires it are all unknown.
3. **That nothing else in the stream is marginal.** Every validator I
   could run now accepts it, but the strictest one in common use —
   Apple's `mediastreamvalidator` — is not installed and installing is
   out of scope, so the RFC 8216 checks in (ii) are my own
   implementation of the spec's rules, and one of them had a real bug.

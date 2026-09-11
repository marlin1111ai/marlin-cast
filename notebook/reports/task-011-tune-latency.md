# Task 011 — Replacing the tune-path sleeps with polls

Date: 2026-09-11. Host: marlinpc. DISPLAY=:10.

**Cold tune latency: 16.72 s → 4.05 s mean, 4.36 s worst case across six
channels.** PrismCast, the reference that plays in the owner's player,
measures 5.22 s. We are now faster than it on every channel tested.

The tune path itself went from **14.17 s to 1.38–1.92 s**.

**The 720p defect turned out to be two different things**, and one of
them is not a defect at all: **ESPN genuinely has no 1080p rendition**.
It advertises `["hd720","large","medium","small","auto"]`. Demanding
hd1080 there can never succeed — and my first implementation, which did
demand it, made ESPN **untunable** (a 503 after a 20 s timeout). That is
reported in full below, because ESPN is the channel the owner tested.

Chrome pid 76888 was used throughout, never restarted, still signed in.

---

## (i) Each sleep replaced, the condition polled, and its timeout

All three fixed sleeps are gone (`grep` for them returns zero). Four
named polls replace them, each with a short interval (250 ms), a hard
timeout, and a loud named failure carrying the last probe. There is no
proceed-anyway path.

| # | Was | Poll name | **Condition actually waited on** | Timeout |
|---|---|---|---|---|
| 1 | `sleep(9000)` after `Page.navigate` | `navigation` | `location.href` contains this channel's video id **and** `#movie_player` exists. Aborts immediately with a `fatal` if the page reads SIGNED OUT. | **30 s** |
| 2 | `sleep(1500)` after the layout override | `layout override` | `innerWidth === 1920 && innerHeight === 1080` — the override has actually reached layout, not merely been sent | **10 s** |
| 3 | *(the existing page-side loop — kept)* | `player ready` | `videoWidth > 0 && !paused && readyState >= 2` on a freshly queried element | **30 s** |
| 4 | `sleep(3500)` after the quality pin | `quality pin` | `getPlaybackQuality() === target` **and** `videoWidth > 0` **and** `videoHeight >= target height`, where `target` is the best level the channel actually advertises at or below hd1080 | **20 s** |

**On 4c — the existing player-ready poll was not removed.** It was
lifted out of the old page-side `while` loop and made poll 3, a named
stage with its own timeout and its own error. It is **not** redundant:
poll 1 only proves the document and player element exist, and poll 4
would otherwise be measuring a video element that has not started
decoding.

**Why the poll helper swallows evaluate exceptions during the wait:**
while a navigation commits, the old execution context is destroyed and
`Runtime.evaluate` throws. That is an expected transient, not a
condition failure. The hard timeout is what stops it becoming an
infinite wait, and the timeout message carries the last probe, including
any evaluate error.

### The 720p defect — step 5, and a correction worth stating plainly

Task-009 saw `[tune] Freeform {"quality":"hd720","video":"0x0"}`. There
were **two** causes:

1. **A stale element reference.** The old code captured `v` *before*
   `setPlaybackQualityRange`, slept 3500 ms, then read `v.videoWidth`.
   If the player swapped elements during the quality change — which
   KNOWN-FIXES already warns about, the page carries 40 `<video>`
   elements — the reading came from a detached element, hence `0x0`.
   Poll 4 re-queries `#movie_player video.html5-main-video` on **every**
   iteration, so it can never report a stale element.
2. **Some channels have no 1080p at all.** This was not known before
   today. ESPN advertises only `["hd720","large","medium","small"]`.

My first implementation demanded `hd1080` unconditionally. Measured
result: **ESPN failed the poll and returned HTTP 503 after 23.47 s** —

```
[serve] Error: 1080p pin: not satisfied within 20000ms — last probe
  {"ok":false,"quality":"hd720","video":"1280x720","box":"1920x1080",
   "viewport":"1920x1080","available":["hd720","large","medium","small"...]}
```

That is worse than the bug it was meant to fix: it makes the owner's own
test channel unstreamable. The poll now targets **the best level the
channel advertises at or below hd1080**, waits for that level to
actually be reached with matching real dimensions, and **says so loudly**
when it is below 1080p:

```
[tune] ESPN WARNING: channel offers no hd1080 — settled at hd720
       (available: ["hd720","large","medium","small","auto"])
```

The reached quality is also exposed on `/health` as a `quality:` line,
so a 720p tune is visible without reading logs. This is a named,
reported outcome, not a silent fallback — but it *is* a proceed-anyway
for sub-1080p channels, and I am flagging that as a deliberate departure
from the letter of step 4a: failing instead would take ESPN off the air.
**If the owner prefers a hard failure there, it is one line.**

---

## (ii) Cold tune latency, per channel

Each measured from a genuinely cold server (waited for `state: idle`),
request to a playlist containing a playable segment, 24 s of idle
between channels so nothing is warm.

| Channel | **Before** | **After** | Δ |
|---|---|---|---|
| TNT | 16.72 s | **3.990 s** | −12.73 s |
| ESPN | 16.72 s | **3.930 s** | −12.79 s |
| AMC | 16.72 s | **3.946 s** | −12.77 s |
| CNN | 16.72 s | **4.217 s** | −12.50 s |
| HGTV | 16.72 s | **3.845 s** | −12.88 s |
| Food Network | 16.72 s | **4.359 s** | −12.36 s |

**Worst case 4.359 s. Best 3.845 s. Mean 4.048 s.**
**PrismCast reference: 5.222 s — every channel beats it.**

Stage timings, milliseconds from the HTTP request (`[tune-ms]` in the
server log):

| Channel | navigation | layout | player playing | quality pinned |
|---|---|---|---|---|
| TNT | 617 | 618 | 1376 | **1378** |
| ESPN | 610 | 619 | 1479 | **1481** |
| AMC | 621 | 630 | 1502 | **1504** |
| CNN | 620 | 629 | 1776 | **1777** |
| HGTV | 630 | 634 | 1390 | **1397** |
| Food Network | 632 | 640 | 1915 | **1916** |

**The tune path is now 1.38–1.92 s, against 14.17 s of fixed sleeps.**
The remaining ~2.2–2.5 s of each cold tune is ffmpeg starting and
cutting the first 1 s segment — the HLS output path, already shortened
in task-010.

The old 9000 ms sleep was standing in for a condition that is satisfied
in **~620 ms**, and the 3500 ms post-pin sleep for one satisfied in
**2–7 ms** after the player is playing.

---

## (iii) Did 1080p hold?

**Five of six at hd1080. One channel has no 1080p rendition to hold.**

| Channel | target | reached | video element | 1080p? |
|---|---|---|---|---|
| TNT | hd1080 | hd1080 | 1920x1080 | **yes** |
| **ESPN** | **hd720** | **hd720** | **1280x720** | **no — channel advertises no hd1080** |
| AMC | hd1080 | hd1080 | 1920x1080 | **yes** |
| CNN | hd1080 | hd1080 | 1920x1080 | **yes** |
| HGTV | hd1080 | hd1080 | 1920x1080 | **yes** |
| Food Network | hd1080 | hd1080 | 1920x1080 | **yes** |

**Not one tune reported `0x0`.** Every tune's video element reported
real dimensions matching the quality it settled at, which is the stale
reference defect closed.

Reported rather than hidden: **ESPN streams at 720p**, upscaled into the
1920x1080 capture frame. On the evidence that is the channel's ceiling
on this account, not a pin failure — but I have only observed it on this
one account at one moment, so I would not call it permanent.

---

## (iv) Switch behaviour and encoder count

| Step | Result |
|---|---|
| Cold tune TNT | `HTTP 200 in 3.997 s`, `quality: hd1080`, hls dir `K3F9ZXlDx34`, **1 encoder** |
| Request AMC while TNT streams | `HTTP 200 in 3.974 s`, `channel: AMC`, `quality: hd1080` |
| hls dirs after the switch | `fvcHs7wIpnQ` only — **TNT's directory removed** |
| Encoders after the switch | **exactly 1** (`ps -eo args \| grep -c '^ffmpeg'` → 1) |

D005 still holds: one tune at a time, the switch tears the previous one
down, and no second encoder survives. Unchanged from task-008, and a
channel switch is now also ~4 s instead of ~19 s.

---

## (v) Stream verification

**hls.js, cross-origin (page on `:8807`, stream on `:8804`), CORS
enforced:**

```
document.title : PLAYING
playing        : true
decoded frames : 737
fatal errors   : []
all errors     : []
MANIFEST_PARSED / LEVEL_LOADED live=true frags=4 target=1
FRAG_LOADED sn=1 / sn=2 / sn=3 / VIDEO PLAYING / sn=4 / sn=5 / sn=6 ...
```

**65 s pulled over HTTP, measured from the received file:**

| | Measured |
|---|---|
| Received | 50,973,944 bytes |
| Video | **H.264 High, Level 4.0, yuv420p, 1920x1080**, `r_frame_rate=30/1` |
| Audio | **AAC-LC, 48 000 Hz, stereo** |
| Frame rate | **30.02 fps** (1950 packets over 64.97 s) |
| Duration | **64.97 s**; decode pass `frame=1950 time=00:01:04.96` |
| Bitrate | **6.28 Mbps** |
| Luma, 33 samples | **26.33 – 64.71, VARYING** |
| `blackdetect` | **no black intervals** |
| Audio | mean **−24.7 dB**, peak **−6.0 dB**, **0** silent runs ≥ 1 s |
| **A/V sync** | start **+25.0 ms**, end **+13.3 ms**, **drift −11.7 ms over 65 s** |

---

## (vi) Files touched — step mapping

| File | Step | Change |
|---|---|---|
| `src/capture.ts` | 4, 5 | `pollPage` helper added; the three sleeps replaced by four named polls; quality poll targets the best advertised level ≤ hd1080, re-queries the element each iteration, warns when below 1080p; `[tune-ms]` stage timing logged; `lastQuality` tracked |
| `src/server.ts` | 5 | `/health` gained a `quality:` line |
| `notebook/reports/task-011-tune-latency.md` | 10 | this report |

Nothing else. The capture method, codec target, task-010 segmenter
settings, the extension and profile handling are all untouched; **no
dependency added**. No Dockerfile, no Xvfb, no container, no XMLTV, no
hardware encoding, no authentication, no UI, no concurrency change.
Nothing on the Unraid host was contacted at all this task — the
PrismCast 5.222 s figure is quoted from task-010's measurement, not
re-fetched.

---

## (vii) What only Channels DVR itself can confirm

1. **Whether 4.36 s is inside its player's patience.** It is now
   comfortably faster than PrismCast, which is known to work on that
   install — the strongest available proxy, and still a proxy. I have
   never observed the Channels player succeed or fail directly.
2. **Whether latency was actually the cause.** Task-010 named it on the
   evidence available. If the real blocker is the container format
   (MPEG-TS vs PrismCast's fMP4) or the H.264 profile (High vs
   Constrained Baseline), this task will not have fixed it, and those
   remain the next experiments.
3. **Whether ESPN at 720p is acceptable.** It will now stream, upscaled
   to a 1080p frame.

---

## (viii) Least certain

1. **That six channels generalise to 144.** Every one landed between
   3.85 s and 4.36 s, which is a tight spread, but they were all
   well-known national channels tuned on an idle machine with nothing
   else streaming. A local station, a channel mid-ad-break, or a machine
   under load could behave differently, and the poll timeouts (10–30 s)
   are exactly what a slow tune would run into.
2. **That the quality poll's "best available" logic is right in every
   case.** It reads `getAvailableQualityLevels()` once the player
   advertises anything at all. If that list is populated progressively —
   720p first, 1080p a moment later — the poll could latch onto hd720
   for a channel that does have hd1080. I did not observe that (five of
   six reached hd1080 promptly), but I did not rule it out either, and
   it would show up as an unexplained 720p tune.
3. **That proceeding below 1080p is the behaviour the owner wants.** It
   is a deliberate departure from step 4a's "no proceed-anyway", taken
   because the alternative took ESPN off the air entirely. It is loud —
   log warning plus a `/health` field — but it is still a proceed.

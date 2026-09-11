# Task 008 — The pipeline

Date: 2026-09-11. Host: marlinpc. DISPLAY=:10.

**Status: complete, and a channel streams end to end.** Channels DVR can
be pointed at `http://192.168.1.245:8804/playlist` and given a
144-channel M3U; requesting any entry tunes the live Chrome to that
channel, pins 1080p, captures the tab, and serves HLS. The measured
output is **1920x1080 H.264 High + AAC-LC at 29.97 fps**, real picture,
real audio, no black frames.

Chrome pid 76888 was used, never restarted, and is still signed in.
No dependency was added — the count is still playwright, express,
typescript, tsx.

Two genuine defects were found by measuring rather than asserting, and
both are fixed: ffmpeg was being told to overwrite MediaRecorder's
timestamps, and it was inventing a 50 fps output from a 30 fps capture.
Both are in (iv).

---

## (i) D013 and D014 recorded — step 4

Appended verbatim to `notebook/DECISIONS.md` after D012, as
`## D013 — Channel list` and `## D014 — Hardware decode testing`. No
existing entry was edited.

---

## (ii) Enumeration result and count — step 5a

```
$ npm run channels
enumerated 144 channels at 2026-09-11T18:25:32.867Z
cached to /Apps/marlin-cast/data/channels.json
```

| | |
|---|---|
| Channels | **144** |
| Unique IDs | **144** (no duplicate IDs) |
| With a real logo URL | **144 / 144** |
| Selector | `ytu-endpoint.tenx-thumb[aria-label]` — task-002's, verified still correct |
| Cache | `data/channels.json` (gitignored under `/data/`) |
| Re-enumerates | only on `npm run channels`, never on a request |

**The count is never hardcoded, and it is right that it is not:** this
project has now measured **150** (task-002), **153** (task-005) and
**144** (today) from the same account. The lineup moves.

Two things worth recording about the data:

- **Logos needed a second attempt.** The first pass returned a 1x1
  transparent GIF `data:` URI for every channel — the guide's lazy-load
  placeholder. Taking the first **non-`data:`** `<img src>` (and
  normalising the protocol-relative `//yt3.ggpht.com/...` the guide
  emits) got a real URL for all 144. These are the guide's **programme
  thumbnails**, not fixed channel logos, so they will drift as
  programming changes — flagged in OPEN QUESTIONS.
- **Deep links held.** TNT enumerated as `K3F9ZXlDx34`, which is the
  identical video id task-007 observed in `kFrameUrl` hours earlier.
  That is one channel across one afternoon, not a durability proof, but
  it is the first evidence either way and it is encouraging.

Local-market call signs are present in the lineup and are withheld from
this report; the excerpt in (iii) shows national channels only.

---

## (iii) Endpoints built — step 5b

Bound to **0.0.0.0:8804** and nothing else (D008):

```
$ ss -tlnp | grep 8804
LISTEN 0 511  0.0.0.0:8804  0.0.0.0:*  users:(("node",pid=92003,fd=33))
```

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | plain-text status: channel count, state, current channel, chunks/bytes in, segment count, last error |
| GET | `/playlist` | M3U of the full lineup (D013) |
| GET | `/stream/:id/index.m3u8` | HLS media playlist; **tunes on demand** |
| GET | `/stream/:id/:seg.ts` | HLS segments |
| POST | `/ingest/:id/:token` | the extension's WebM timeslices (loopback only) |

`/playlist` — **144 `#EXTINF` lines, 144 URLs, every one pointing at
this server**, checked mechanically:

```
#EXTINF lines                                   : 144
stream URLs                                     : 144
channel cache count                             : 144
URLs NOT pointing at /stream/<id>/index.m3u8    : 0
```

Excerpt (fetched over the LAN address, logo URLs shortened for
readability, national channels only):

```
#EXTM3U
#EXTINF:-1 tvg-id="K3F9ZXlDx34" tvg-name="TNT" tvg-logo="https://yt3.ggpht.com/[...]" group-title="YouTube TV",TNT
http://192.168.1.245:8804/stream/K3F9ZXlDx34/index.m3u8
#EXTINF:-1 tvg-id="MrXg0chrojg" tvg-name="ESPN" tvg-logo="https://yt3.ggpht.com/[...]" group-title="YouTube TV",ESPN
http://192.168.1.245:8804/stream/MrXg0chrojg/index.m3u8
```

The stream URLs are built from the request's `Host` header, so the
playlist a machine fetches always points back at the address that
machine used. Fetching over loopback yields `127.0.0.1:8804` URLs
(36,924 bytes); fetching over the LAN address yields
`192.168.1.245:8804` URLs (37,500 bytes). That is what makes the same
endpoint usable from Channels DVR without configuration.

---

## (iv) Measured stream — step 7b

Pulled as a real HLS client — `ffmpeg -i http://127.0.0.1:8804/stream/K3F9ZXlDx34/index.m3u8 -t 70 -c copy`
— and then measured **from the received file**, never from settings.

| | Measured |
|---|---|
| Received | **51,525,536 bytes** |
| Video codec | **H.264 High, yuv420p** |
| Resolution | **1920x1080** |
| Frame rate | **29.97 fps** (2102 packets over 70.13 s) |
| Declared rate | `r_frame_rate=30/1` |
| Audio codec | **AAC-LC, 48 000 Hz, stereo** |
| Duration | **70.13 s** video / 69.99 s audio; full decode pass `frame=2102 time=00:01:10.13` |
| Bitrate | **≈5.88 Mbps** |
| Whole-frame luma, 36 samples | **32.39 – 142.66, VARYING** |
| `blackdetect` (d=0.5, pix_th=0.10) | **no black intervals** |
| Audio level | mean **−26.9 dB**, peak **−7.0 dB**, 6,721,536 samples |
| Silence ≥ 1 s at −50 dB | **none** |
| A/V sync | start **−20.3 ms**, end **−160.0 ms**, **drift −139.7 ms over 70.1 s** |
| **Picture present?** | **YES** |
| **Audio present?** | **YES** |

**Screenshot:** `notebook/reports/task-008-hls-frame-t35.png` — the
frame at t = 35 s of the received stream, 1920x1080: a dim interior
scene, two figures, a TNT bug and a programme promo bottom-right.
No account name, email, avatar or player chrome is present, so nothing
was blurred or cropped. The black bands top and bottom are the
programme's own cinematic aspect ratio, not page letterboxing — the
tune log confirms the player filled the frame exactly:

```
[tune] AMC {"ok":true,"quality":"hd1080","video":"1920x1080",
            "box":"1920x1080","viewport":"1920x1080"}
```

That `box == viewport == 1920x1080` is the result of forcing a 16:9
layout with `Emulation.setDeviceMetricsOverride` before capture. Without
it the page lays out at this display's 2560x1267, the 16:9 player is
pillarboxed inside it, and the capture spends bitrate on side bars.

### It runs in real time

The thing most likely to sink this design is the encoder not keeping up,
so it was measured directly rather than inferred from the file:

```
wall elapsed      : 30s
chunks_in         : 51 -> 80   (29 one-second timeslices)
capture real-time : 0.97x
ffmpeg (libx264)  : 85.7% of one core
```

**0.97x** — capture and encode keep pace with live television, with one
core doing the H.264 work on a 32-thread CPU. Chrome's own VP8 encode
and the software compositor are on top of that (task-007: this session
has no GPU at all), but the pipeline is not falling behind.

### Two defects found by measuring

**1. ffmpeg was being told to overwrite the timestamps that D011 exists
to protect.** The first build passed `-use_wallclock_as_timestamps 1`,
which replaces the container's timestamps with arrival time. It produced
a continuous flood of:

```
[hls] Non-monotonic DTS in output stream 0:1; previous: 5291, current: 1320; changing to 5292.
[aac] Queue input is backward in time
```

MediaRecorder's WebM already carries correctly synchronised A/V
timestamps — that is the entire reason D011 chose tab capture. The flag
was removed.

**2. ffmpeg invented a 50 fps output from a 30 fps capture.** The first
measured pull came back `r_frame_rate=50/1`, 3502 frames in 70.08 s —
**49.97 fps**. MediaRecorder's WebM is variable-rate, so with no output
rate pinned ffmpeg guessed, and it guessed **50**, which is this xrdp
display's refresh rate. It was duplicating roughly twenty frames a
second that carried no new picture, and paying libx264 to encode them.
Pinning `-fps_mode cfr -r 30` brought it to the measured 29.97 fps above.

**The A/V drift is not fully closed.** −139.7 ms over 70 s is inside the
range most viewers tolerate but it is four times task-006's 46 ms over a
comparable minute, and the likely cause is the CFR conversion holding
video at exactly 30 fps while audio follows its own clock. Over an
hour-long recording that trend, if it is linear, would matter. Raised in
OPEN QUESTIONS rather than guessed at.

---

## (v) Channel-switch behaviour — step 5d, 7d

**Implemented: SWITCH. A request for a second channel tears down the
first and retunes.** The alternative — refusing the second request —
was rejected for one reason: D006 wires this into Channels DVR as a
Custom Channels source with **stream limit 1**, and when a viewer
changes channel Channels DVR requests the new channel's URL. If the
server refused, every channel change would fail until an idle timeout
expired, which is indistinguishable from the product being broken. No
queuing and no concurrency were added; D005 still holds, because only
ever one tune is live.

Measured:

```
1. tune TNT                     HTTP 200 in 19.3s
   state: streaming             channel: TNT (K3F9ZXlDx34)
   hls dirs: K3F9ZXlDx34

2. request AMC while TNT is streaming
                                HTTP 200 in 19.5s
   state: streaming             channel: AMC (fvcHs7wIpnQ)
   hls dirs: fvcHs7wIpnQ        <- TNT's directory is gone
```

**Exactly one encoder survives the switch** — not two:

```
$ ps -eo pid,etime,args | grep '[f]fmpeg'
93254  00:14  ffmpeg -hide_banner -loglevel warning -i pipe:0 ... -fps_mode cfr -r 30 -c:v libx264 ...
$ ps -eo args | grep -c '^ffmpeg'
1
```

And the switched-to channel is a real working stream, not just a
playlist — 12 s pulled from AMC:

```
h264, 1920, 1080, 30/1
luma n=13 min=36.7 max=51.5 -> PICTURE
mean_volume: -30.3 dB
```

### Stopping and release — step 5e

**HLS gives no disconnect signal.** It is pull-based: the client fetches
a playlist and segments over separate short-lived requests, so there is
no socket whose close means "the viewer left". "Client gone" is
therefore inferred from silence — a watchdog stops the capture after
**20 s** (`MC_IDLE_MS`) with no request for the playlist or a segment.
Saying that plainly because it is an inference, not an event.

It works. After the pull stopped:

```
state: idle          channel: - (-)          segments: 0
ffmpeg processes: 0
hls directories : 0
```

Server log for the teardown:

```
[stop] AMC: idle 20000ms with no client request
[ffmpeg] [matroska,webm @ ...] File ended prematurely at pos. 13133191
[ffmpeg] exited code=255 signal=null
```

The "File ended prematurely" line is cosmetic — it is ffmpeg reporting
that its stdin closed mid-stream, which is exactly what a clean stop
does to a live pipe. It surfaces in `/health` as `last_error`, which is
misleading, and is listed in OPEN QUESTIONS.

**No orphans in any arm**: after the switch, after idle release, and
after killing the server, `ps` showed zero ffmpeg processes each time.

---

## (vi) Dependencies added — step 6

**None. Zero.** The dependency list is unchanged:

```
dependencies    : express ^5.2.1, playwright ^1.63.0
devDependencies : tsx ^4.23.13, typescript ^5.9.3
```

ffmpeg piping needed nothing new: `node:child_process.spawn` is built in,
and the extension's timeslices arrive as ordinary HTTP request bodies
that `express.raw()` already handles.

**Two things I deliberately did not add**, since "what breaks without
it" is the test:

- **A CDP library.** `src/cdp.ts` is ~80 lines over Node 22's built-in
  global `WebSocket`. Playwright is present and could have done page
  work, but the pipeline needs browser-level commands Playwright does
  not surface directly (`Extensions.loadUnpacked`,
  `Extensions.triggerAction`, `Target.getTargets` with a `tab` filter),
  so a wrapper would have been carried for nothing.
- **`@types/node`.** Absent since task-002 by choice. `tsx` runs
  TypeScript without typechecking, so nothing breaks at runtime; the
  cost is that `tsc --noEmit` cannot be run clean as a gate. Flagged,
  not fixed.

One permission was added to the extension, which is a real widening and
is named here rather than buried: **`host_permissions:
["http://127.0.0.1:8804/*"]`**, so the offscreen document can POST its
timeslices to the local server. Without it every chunk POST fails CORS
and nothing reaches ffmpeg. It is loopback-scoped and grants no access
to any site.

---

## (vii) LAN URL — step 7e

**`http://192.168.1.245:8804/playlist`**

What was verified: the server binds `0.0.0.0:8804` (not loopback), and
fetching that exact LAN URL **from this host** returns HTTP 200 and
37,500 bytes with every stream URL rewritten to `192.168.1.245:8804`.

```
$ curl -o /dev/null -w "%{http_code} %{size_download}\n" http://192.168.1.245:8804/playlist
200 37500
```

**What was NOT verified: reachability from a different machine.** No
second host was used, and per the do-not-touch list nothing was run
from or against the Unraid box. The host firewall could not be queried
either — `ufw` is installed but `ufw status` needs sudo, which is not
available here. So: **bound and served on the LAN interface, observed;
traversal from another machine, not observed.**

---

## (viii) Files touched — step mapping

| File | Step | Change |
|---|---|---|
| `notebook/DECISIONS.md` | 4 | D013 and D014 appended verbatim |
| `src/cdp.ts` | 5a/5c | **new** — minimal CDP client (no dependency) |
| `src/channels.ts` | 5a | **new** — guide enumeration, disk cache, `npm run channels` |
| `src/capture.ts` | 5c/5d/5e | **new** — tune, pin 1080p, arm extension, ffmpeg→HLS, switch, idle release |
| `src/server.ts` | 5b | **new** — Express on 0.0.0.0:8804, the five endpoints |
| `extension/manifest.json` | 5c | `host_permissions` for `http://127.0.0.1:8804/*`; version 0.0.1 → 0.0.2 |
| `extension/offscreen.js` | 5c | streaming mode — POST each timeslice in order; file mode kept intact |
| `extension/background.js` | 5c | pass `ingest`/`timeslice` through; skip the download path when streaming |
| `package.json` | 5a/5b | two scripts: `channels`, `serve`. **Dependencies unchanged** |
| `notebook/reports/task-008-pipeline.md` | 10 | this report |
| `notebook/reports/task-008-hls-frame-t35.png` | 7c | frame from the middle of the received stream |
| `data/channels.json`, `data/hls/` | 5a/5c | cache and segment scratch — **gitignored via `.gitignore:3:/data/`, not committed** |

`src/login.ts` and `scripts/` were not modified. No Dockerfile, no Xvfb,
no container, no workflow, no XMLTV, no hardware encoding, no
authentication, no UI. Nothing binds any port but 8804. `backups/` and
`data/chrome-profile-v11-20260911-104559` were never read or written.
Nothing touched Unraid or `/Apps/marlin-iptv-editor`. No installer ran.
`accounts.google.com` was never navigated to.

---

## (ix) OPEN QUESTIONS

1. **Tune latency is ~19–22 s.** Every tune measured: 18.7, 19.3, 19.5,
   21.9 s from HTTP request to a playable playlist — page navigation,
   waiting for the player, the 1080p pin, then ffmpeg cutting a first
   segment. Whether Channels DVR tolerates that before declaring the
   source dead is **not observed**, and it is the single most likely
   thing to make this feel broken in real use.

2. **The A/V drift trend.** −139.7 ms over 70 s, against task-006's
   −46 ms over 62 s of the same capture path. The CFR conversion is the
   prime suspect. Whether it is linear (and so unacceptable over an
   hour) or bounded is unmeasured.

3. **Duplicate channel names.** The lineup contains three separate
   entries all displaying `ESPN`, and two displaying `MPT`, with
   different IDs. D013 says unfiltered, so the playlist carries them —
   but whether Channels DVR's Gracenote matching copes with identical
   `tvg-name` values is unknown.

4. **Logos are programme thumbnails, not channel logos.** They come from
   the guide tile image and will change as programming changes, so a
   cached playlist's artwork will drift. Whether Channels DVR caches
   them once or re-fetches is not observed.

5. **`last_error` reports a normal stop as an error.** The clean
   teardown path leaves `File ended prematurely` in `/health`. Harmless
   but misleading to anyone using `/health` as a monitor.

6. **Nothing has run longer than about two minutes.** No hour-long
   stream, no ad break, no channel-change storm, no overnight run.
   Task-002's open question — whether the 1080p pin survives an ad break
   — is still open and now matters more, because a silent drop to 720p
   mid-stream would change the HLS output's resolution.

---

## (x) Least certain

1. **That this survives contact with Channels DVR.** Everything here was
   driven by `curl` and `ffmpeg`, which are forgiving clients. Channels
   DVR has its own timeouts, its own probing, and its own opinion about
   playlists that appear 19 seconds after they are requested. I have
   measured that the stream is well-formed; I have not measured that the
   consumer it was built for will accept it.

2. **That one channel at a time genuinely holds under a switch storm.**
   The switch was tested once, cleanly, with a ~20 s gap. Two requests
   arriving within the tune window take the `starting` promise path, and
   that path is the least-exercised code in this task — one test is not
   enough to claim it is race-free.

3. **That the idle timeout is the right mechanism, or the right
   length.** 20 s is a guess dressed as a default. Too short and a
   client that pauses briefly loses its tune; too long and the browser
   sits captured with nobody watching. HLS gives no disconnect signal,
   so something like this is necessary — but the number has no evidence
   behind it at all.

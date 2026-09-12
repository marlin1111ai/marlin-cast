# KNOWN-FIXES.md

Fresh as of 2026-09-11, at project creation. Carries traps and fixes
that apply to this project's app and tooling.

## Playwright's Chrome cannot read cookies written by plain Chrome (Linux)

Surfaced 2026-09-11 (Task 001b). A hand-login performed in plain
`google-chrome --user-data-dir=<profile>` does not carry into a
Playwright `launchPersistentContext` on the *same* directory. The
profile path is not the problem — both processes genuinely share it.

Cause: Playwright injects `--password-store=basic` into every Chrome
launch. That makes Chrome derive its cookie-encryption key from a
hardcoded string and tag rows `v10`. Plain Chrome on this desktop
autodetects gnome-libsecret and tags rows `v11`. A `v10` Chrome cannot
decrypt `v11` rows, silently drops them — and then rewrites the cookie
DB in `v10`, **destroying the login permanently**.

Detect: read `Default/Cookies` and check the first three bytes of
`encrypted_value` (`v10` vs `v11`). Mixed prefixes mean both kinds of
launch have touched the profile.

Fix: append `--password-store=gnome-libsecret` to the Playwright
`args`. Chrome honours the LAST occurrence of a repeated switch, so
the appended flag overrides Playwright's default. Verified by
controlled test — same Chrome, same profile shape, only that flag
differing, produced `v11` vs `v10`.

Consequence when it bites: the old login is not recoverable. Wipe the
profile and hand-login again *after* the fix is in place.

**Measured directly 2026-09-11 (Task 004).** Launching a logged-in
`v11` profile once with `--password-store=basic` took its cookie store
from **48 rows / 17 auth cookies** to **10 rows / 0 auth cookies**, all
`v10`. Chrome starts cleanly, warns about nothing, and silently discards
every row it cannot decrypt — the profile is then unrecoverable. There
is **no supported migration** between the two schemes: re-encryption
would require decrypting first, which is exactly what fails. Re-login in
the target scheme; do not attempt to convert a profile.

**Confirmed workable 2026-09-11 (Task 005).** A login taken *natively*
in the basic scheme is fine — it is only *converting* an existing v11
profile that is impossible. A fresh hand-login under
`--password-store=basic` produced 46 rows tagged `v10` with all 17
auth-shaped cookies, played 1080p60 with Widevine L3 unchanged, and
survived two graceful relaunches with the store unchanged. The rule is
therefore: pick the scheme *before* the login, never after.

Conversely, Task 004 also showed what does **not** break a profile:
copying it, moving it to a completely different path, and changing its
group ownership and permissions all preserved the session exactly
(48/`v11`/47/17 in every arm). Path and ownership are not the hazard.
The scheme is.

**Scope, corrected 2026-09-11 (Task 001c).** This fix is real and
load-bearing — controlled arms on throwaway profiles put it beyond
doubt: without the flag a profile's persistent rows go 6 → 0; with it
they survive, and the result is byte-identical to what plain Chrome
leaves behind (session cookies dropped, persistent rows kept, `v11`
tags intact). It holds for Google's own domain too — 9 of 9 persistent
`.youtube.com` cookies survived.

**But it is not the whole story.** The owner's YouTube TV session kept
dying *after* this fix was in place, and 001c shows local cookie
destruction is not the cause. Do not read this entry as "profile
persistence is solved". It means one specific destroyer was removed.
See notebook/reports/task-001c-cookie-destruction.md.

**Measuring trap:** Chrome batches cookie commits. A profile inspected
less than ~60 s after launch shows a store last written at startup, and
reads as 0 rows. Dwell ~70 s before shutting down, or the test silently
measures nothing. Also never judge by row count alone — a revisit to
the same site repopulates the store with fresh rows and hides a total
wipe (count identical, tags flipped `v11` → `v10`).


## YouTube TV: querySelector("video") returns an empty element

Surfaced 2026-09-11 (Task 002). A playing YouTube TV page carries **40
`<video>` elements**. `document.querySelector("video")` returns one with
`readyState: 0`, `networkState: 0`, `videoWidth: 0` — reading it makes
live playback look dead. Task 002's first probe concluded "playback did
not start" while the screen was visibly playing.

Use `#movie_player video.html5-main-video`, or pick the element with
`videoWidth > 0 && !paused`. Both verified against a live 1080p stream.

## YouTube TV serves 720p unless 1080p is explicitly demanded

Surfaced 2026-09-11 (Task 002). `getAvailableQualityLevels()` lists
`hd1080`, but ABR stays on `hd720` through page fullscreen *and* a
maximized window at a 2252x1267 player box. Only
`#movie_player.setPlaybackQualityRange("hd1080","hd1080")` moved it, and
it then delivered a measured 1920x1080@59.96.

Do not rely on window size or fullscreen to reach 1080p. Pin it.

## Frame drops on the xrdp display are a 50 Hz artifact, not a decode fault

Surfaced 2026-09-11 (Task 002). Steady 16.7% dropped frames (150 of 900)
during 1080p60 playback — exactly 1/6, which is 60 fps content presented
on a 50 Hz screen. `xrandr` reports this xrdp session as
`2468x1381 50.00*`. The media clock advanced 15.0 s in 15.0 s, so decode
is keeping up; the loss is at presentation.

Any capture method that reads the composited screen inherits this
ceiling. Benchmark capture on a 60 Hz virtual display, not here.

## esbuild breaks page.evaluate with "__name is not defined"

Surfaced 2026-09-11 (Task 002). A named arrow/function inside a
`page.evaluate(() => ...)` callback makes esbuild (via tsx) emit a
`__name` helper that does not exist in the page, and the evaluate throws
`ReferenceError: __name is not defined`.

Either avoid named inner functions inside evaluate callbacks, or pass
the body as a **string** to ``page.evaluate(`(() => { ... })()`)``, which
skips the transform entirely.

## --load-extension is ignored by Chrome 137+; use Extensions.loadUnpacked

Surfaced 2026-09-11 (Task 006). `--load-extension=<dir>` silently does
nothing on Chrome 153.0.8010.36 — Chrome starts normally, warns about
nothing, and the extension is simply absent. Five throwaway-profile arms
all reported an empty `Extensions.getExtensions` and no extension service
worker: the flag alone; plus `--disable-extensions-except=<same dir>`;
plus `--enable-unsafe-extension-debugging`; plus
`--disable-features=DisableLoadExtensionCommandLineSwitch`; and plus both.

Fix: install it at run time over CDP instead —
`Extensions.loadUnpacked({ path })` on the **browser-level** session.
It works over the ordinary loopback `--remote-debugging-port` (no
`--remote-debugging-pipe` needed), needs no Developer Mode, and needs
**no Chrome restart** — which is what makes it safe to use against a
live logged-in browser. `Extensions.uninstall({ id })` reloads it after
a code change.

## chrome.tabCapture needs activeTab, and triggerAction needs a *tab* target

Surfaced 2026-09-11 (Task 006). `chrome.tabCapture.getMediaStreamId()`
fails with *"Extension has not been invoked for the current page (see
activeTab permission)"* if the extension was merely installed. Declaring
`activeTab` is not enough — something must **invoke** the extension on
that tab.

Over CDP the equivalent of clicking the toolbar icon is
`Extensions.triggerAction({ id, targetId })`. The trap: `targetId` must
be a **`tab` target, not the `page` target**. Passing a page target
returns *"Action can only be triggered on a tab target."* `tab` targets
are hidden from `Target.getTargets()` unless asked for explicitly:

```js
await cdp.send("Target.getTargets", { filter: [{}] });   // includes type "tab"
```

Also: an MV3 service worker is lazy and often has no target yet.
`triggerAction` wakes it — so make the extension's `onClicked` handler a
no-op unless the driver has armed it first, or waking it starts a
recording by accident.

## Tab capture: resolution follows the display, not the window or the video

Surfaced 2026-09-11 (Task 006). With no `getUserMedia` size constraint,
`chrome.tabCapture` output is the size of the **display**, regardless of
window size, viewport size, or the video element's own resolution. The
Chrome window was measured at 1219x1334 (viewport 1211x1243) mid-capture
while playing a 1920x1080 stream; the file came out **2560x1380** — the
2560x1381 screen, height rounded even. Shrinking the window only lays
the page out smaller inside the same frame.

Control it with the constraint, not the window:

```js
video: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: id,
                      maxWidth: 1920, maxHeight: 1080, maxFrameRate: 30 } }
```

Asking for 1920x1080 delivered exactly 1920x1080. Default frame rate is
**30**, so a 60 fps source is halved unless asked otherwise — and asking
for 60 delivered 38.6 fps on this 50 Hz software-rendered session.

This is a *second*, independent 1080p pin. `setPlaybackQualityRange`
controls what is decoded; the capture constraint controls what is
encoded. Neither implies the other.

## Minimizing the Chrome window makes tab capture record black

Surfaced 2026-09-11 (Task 006). Minimizing does **not** stop the
recording — frames and audio keep flowing at 30 fps — but the picture
goes black and freezes, producing a plausible-looking file with sound
over a black screen. Mean luma went 65 → 14 and then identical to four
decimal places, recovering the moment the window was restored.

**Occlusion is harmless**: a second maximized window completely covering
the browser produced a recording indistinguishable from an unobstructed
one. So what matters is that the window is *mapped and rendering*, not
that anyone can see it. Never minimize a capturing window; covering it
is fine.

## MediaRecorder.isTypeSupported is optimistic — cross-check WebCodecs

Surfaced 2026-09-11 (Task 006). `MediaRecorder.isTypeSupported(
"video/webm;codecs=h264,opus")` returned `true` on a machine where
`VideoEncoder.isConfigSupported` reported H.264 encoding **unsupported
at every** `hardwareAcceleration` setting. Do not pick a recording codec
from `isTypeSupported` alone.

Left to itself, MediaRecorder chose **`video/webm;codecs=vp8,opus`** —
VP8, even though the YouTube TV source is VP9.

## chrome://gpu reports policy, not silicon — check media-internals instead

Surfaced 2026-09-11 (Task 007). Launched with `--ignore-gpu-blocklist`
plus the usual VAAPI feature flags, `chrome://gpu` reported
**"Video Decode: Hardware accelerated"**, along with Canvas, Compositing,
Rasterization and WebGL. None of it meant a hardware decoder was running.
In the same browser:

```
GL_RENDERER   : ANGLE (Mesa, llvmpipe ...)   <- still the software rasterizer
videoDecoding : (none)                        <- zero HW decode profiles
```

and `chrome://media-internals`, read while the stream was playing:

```
kVideoDecoderName       = "DecryptingVideoDecoder"
kIsPlatformVideoDecoder = false      <- the authoritative answer
use_hw_secure_codecs    : false      <- still Widevine L3
```

`--ignore-gpu-blocklist` removes a *block*; it does not create a decoder.
To find out what is really decoding, open `chrome://media-internals`,
click the active player in `#player-list` (the entries are
`div.tree-item`, the live one carries `active-player`; click its
`.tree-item-header`), and read `#player-property-table`. Never conclude
"hardware decode is on" from the green text on `chrome://gpu`.

## Chrome cannot hardware-decode on marlinpc — there is no VAAPI driver for the GPU

Surfaced 2026-09-11 (Task 007). Chrome on Linux hardware-decodes video
**only** through VAAPI. On marlinpc:

- the only GPU is NVIDIA (`/sys/class/drm/renderD128/device/uevent` →
  `DRIVER=nvidia`, one `/dev/dri/by-path` entry at `pci-0000:01:00.0`);
- the CPU is an **i9-14900KF** — the `F` means no integrated graphics;
- `/usr/lib/x86_64-linux-gnu/dri/` carries VAAPI drivers for Intel
  (`i965`, `iHD`), nouveau, AMD, d3d12 and virtio — none for the
  proprietary NVIDIA driver;
- a whole-filesystem `find / -name '*nvidia*drv_video*'` returns nothing.

So no flag combination enables hardware decode here, and every "no
hardware acceleration" result in this project is **a fact about
marlinpc, not a prediction about Unraid**. The Unraid target's UHD 770
uses `iHD_drv_video.so`, which *is* present in a normal image — so
hardware decode, and possibly Widevine L1 with it, is a live
first-run risk there rather than a closed question.

## ffmpeg guesses 50 fps from MediaRecorder WebM — pin the output rate

Surfaced 2026-09-11 (Task 008). MediaRecorder's WebM is variable-rate.
Transcoding it with no output frame rate pinned made ffmpeg guess **50
fps** — this xrdp display's refresh rate — from a capture constrained to
30 fps. The measured result was `r_frame_rate=50/1`, 3502 frames in
70.08 s (49.97 fps): roughly twenty duplicated frames per second, each
one paid for in libx264 time and bitrate.

Fix: pin it to the capture rate.

```
-fps_mode cfr -r 30
```

Measured after: `r_frame_rate=30/1`, 2102 packets over 70.13 s = 29.97 fps.

Related caution: this raised A/V drift to −139.7 ms over 70 s (task-006's
comparable figure on the same capture path was −46 ms over 62 s). The CFR
conversion holds video at exactly 30 fps while audio follows its own
clock. Not yet characterised over long runs.

## Never pass -use_wallclock_as_timestamps to MediaRecorder WebM

Surfaced 2026-09-11 (Task 008). It replaces the container's timestamps
with packet arrival time and produced an unending flood of:

```
[hls] Non-monotonic DTS in output stream 0:1; previous: 5291, current: 1320; changing to 5292.
[aac] Queue input is backward in time
```

MediaRecorder already emits correctly synchronised A/V timestamps — that
is the whole reason D011 chose tab capture over screen grabbing. Let
ffmpeg use them.

## Tab capture is pillarboxed unless the viewport is forced to 16:9

Surfaced 2026-09-11 (Task 008). This display is 2560x1381 and the page
viewport 2560x1267 — neither is 16:9 — so a 16:9 player sits in it with
side bars, and tab capture encodes those bars. Fullscreen does not fix
it (task-002 measured the player box staying 2252x1267).

Fix: force the layout before capturing, over CDP on the page session:

```js
Emulation.setDeviceMetricsOverride({ width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
```

Verified: the tune log then reports `box == viewport == 1920x1080`, and
the player fills the captured frame. Clear it with
`Emulation.clearDeviceMetricsOverride` on teardown.

## HLS gives no client-disconnect signal — use an idle watchdog

Surfaced 2026-09-11 (Task 008). HLS is pull-based: the client fetches a
playlist and segments over separate short-lived requests, so no socket
close means "the viewer left". Stopping capture on response end would
stop it after the first playlist fetch.

Marlin Cast stops the tune after **20 s** with no request for that
channel's playlist or any segment (`MC_IDLE_MS`). Verified: after the
client stopped, state went idle with 0 ffmpeg processes and 0 HLS
directories. The 20 s figure is a default with no evidence behind it —
too short loses a paused client's tune, too long holds the browser
captured with nobody watching.

## An HLS server needs CORS headers or no browser player can read it

Surfaced 2026-09-11 (Task 009). Marlin Cast served a perfectly
well-formed HLS stream that ffmpeg, curl and GStreamer all played, and
that **no browser-based player could load at all**. Symptom: Channels DVR
reported `Remux Starting: 17s @ 1.04x` — it was pulling real video at
real time — while its player showed
"The media could not be loaded, either because the server or network
failed or because the format is not supported."

Cause: no `Access-Control-Allow-Origin` header, and `OPTIONS` preflight
returning `404`. A server-side puller does not care. A browser player
fetches the playlist with XHR/fetch and the browser blocks the response
before a byte is parsed. hls.js reports it as a fatal
`networkError / manifestLoadError` with no `MANIFEST_PARSED` — which
looks like "bad media" and is not.

Fix: send CORS on every route and answer preflight.

```ts
res.setHeader("access-control-allow-origin", "*");
res.setHeader("access-control-allow-methods", "GET, HEAD, OPTIONS");
res.setHeader("access-control-allow-headers", "range, origin, accept, content-type");
res.setHeader("access-control-expose-headers", "content-length, content-range, accept-ranges, date");
if (req.method === "OPTIONS") { res.status(204).end(); return; }
```

**Diagnostic rule this taught:** ffprobe and ffmpeg are the wrong
validators for a browser playback bug. They share no code with a browser
media stack and will happily accept a stream a browser refuses to
*fetch*. Test with hls.js in a real browser, and use
`--disable-web-security` in a throwaway browser as the A/B control — if
disabling it makes the stream play, the problem is CORS, not the media.

## express createReadStream().pipe() ignores Range — use res.sendFile

Surfaced 2026-09-11 (Task 009). HLS segments served with
`createReadStream(path).pipe(res)` answered `Range: bytes=0-99` with
`HTTP 200` and the entire file — no `Content-Range`, no `Accept-Ranges`.
A client doing a partial retry gets the wrong bytes silently.

`res.sendFile(absolutePath)` implements `Range`, `Accept-Ranges` and
`Content-Range` correctly (verified: `206 Partial Content`,
`Content-Range: bytes 0-99/1361684`). Segments are immutable once
written, so they can also carry
`cache-control: public, max-age=31536000, immutable`.

## Channels DVR's player does NOT need CORS — PrismCast proves it

Surfaced 2026-09-11 (Task 010), correcting Task 009. The reference
implementation that plays correctly in the same Channels DVR install
sends **no** `Access-Control-Allow-Origin` at all — verified with a GET
carrying `Origin: http://192.168.1.250:8089`. It also does **not**
support Range (`Range: bytes=0-99` → `200` with the whole body).

So neither CORS nor Range can be what separates a stream that plays from
one that does not in that player. Task 009's CORS fix is still correct
for a browser fetching Marlin Cast directly, but it did not fix the
owner's bug. Keep it; do not credit it.

Corollary for diagnosis: when a reference implementation is available,
diff against it *before* theorising. Three candidates that survived
careful reasoning in Task 009 — CORS, Range, and the one-segment cold
window — were all eliminated in minutes by observing that PrismCast does
the same thing and works.

## Live HLS segment URLs are reused — never mark them immutable

Surfaced 2026-09-11 (Task 010). Task 009 set
`cache-control: public, max-age=31536000, immutable` on segments,
reasoning that a written segment never changes. True of the *file*,
false of the *URL*: every tune wipes the channel's directory and ffmpeg
restarts numbering at `seg00000.ts`, so the same URL returns different
media after a retune, and any cache in the path may serve the old one.

Use `cache-control: no-cache`, which is what PrismCast sends.

## First-playlist latency is a first-class HLS defect

Surfaced 2026-09-11 (Task 010). A server-side remuxer waits patiently;
a player does not. Channels DVR pulled and remuxed Marlin Cast at 1.02x
while its player showed "The media could not be loaded" — the classic
signature of a source that is *correct* but *too slow to start*.

Benchmark measured against PrismCast on the same install:

| cold request -> playlist with a playable segment | |
|---|---|
| PrismCast | 5.2 s |
| Marlin Cast | 19.4 s |

Instrument the split before optimising. Ours was **14.2 s tune path**
(hardcoded sleeps) **+ 5.1 s HLS output**. Segmenter levers that help
the output half: `-hls_time 1`, a matching `-g`/`-keyint_min` so 1 s
segments still start on an IDR, and `-tune zerolatency` to drop B-frames
and encoder lookahead.

## Not every YouTube TV channel has a 1080p rendition

Surfaced 2026-09-11 (Task 011). **ESPN advertises only
`["hd720","large","medium","small","auto"]`** — no `hd1080` at all.
`setPlaybackQualityRange("hd1080","hd1080")` can never succeed there, and
code that *waits* for hd1080 will hang until its timeout and then fail
the tune. An implementation that demanded hd1080 unconditionally turned
ESPN into an HTTP 503 after 20 s.

Read `getAvailableQualityLevels()` first and pin the best level the
channel actually offers at or below hd1080:

```js
const avail = p.getAvailableQualityLevels() || [];
const ladder = ["hd1080","hd720","large","medium","small","tiny"];
const target = ladder.find(q => avail.indexOf(q) !== -1);
p.setPlaybackQualityRange(target, target);
```

Then wait on `getPlaybackQuality() === target` **and** the element's
`videoHeight` matching that level. Report loudly when the result is below
1080p — it is a property of the channel, not a bug, but it must be
visible.

This also revises part of the task-009 "720p pin defect": some of those
720p tunes were channels with no 1080p to reach.

## Re-query the YouTube TV video element after a quality change

Surfaced 2026-09-11 (Task 011). Task-009 saw tunes report
`{"quality":"hd720","video":"0x0"}`. Cause: the element was captured
*before* `setPlaybackQualityRange`, then read after a sleep. The player
can swap elements during a quality change (the page carries 40 `<video>`
elements — see the querySelector entry above), so the stored reference
goes detached and reads `0x0`.

Re-query `#movie_player video.html5-main-video` on **every** poll
iteration and re-apply the pin, which is idempotent. After this change,
not one tune across six channels reported 0x0.

## Poll the condition, never sleep a guess — 14.17 s -> 1.4 s

Surfaced 2026-09-11 (Task 011). The tune path carried three fixed sleeps
(9000 ms after navigate, 1500 ms after a layout override, 3500 ms after
the quality pin) totalling **14.17 s of a 19.35 s cold tune**. Measured
against the real conditions they were standing in for:

| sleep | condition it stood for | actually satisfied in |
|---|---|---|
| 9000 ms | navigation committed + player element mounted | **~620 ms** |
| 1500 ms | `innerWidth/innerHeight` equal the override | **~10 ms after** |
| 3500 ms | quality settled at target with real dimensions | **2–7 ms after playing** |

Result: cold tune **16.72 s -> 3.85–4.36 s** across six channels.

Give every poll a short interval, a hard timeout, and a named failure
that carries the last probe. Swallow evaluate exceptions *during* the
wait — while a navigation commits, the old execution context is
destroyed and `Runtime.evaluate` throws; that is a transient, and the
timeout is what stops it becoming an infinite wait.

## Latency was not the cause either — Channels' player still fails at 8 s

Surfaced 2026-09-11 (task-012, from the owner's task-011 retest). Task
011 cut the cold tune from 16.72 s to ~4 s, and on the owner's Channels
DVR install that moved "Remux Starting" from **31 s to 8 s** — proof the
faster source reached Channels — **and the player still failed.** So the
two leading explanations are now both dead by direct observation:

- **CORS was not the cause** (task-010: PrismCast sends none and plays).
- **Latency was not the cause** (task-011's retest: 8 s and still fails).

What remains of the task-010 diff is the media itself: **MPEG-TS vs
fMP4/CMAF** and **High vs Constrained Baseline**. Task-012 switched the
container (the larger and more plausible of the two, since Channels' web
player is MSE-based and fMP4 is what MSE consumes natively). Do not
re-derive the CORS or latency theories; both have been tested against the
real player and eliminated.

## fMP4 HLS from ffmpeg: init.mp4 + .m4s is two flags, and the mp4 muxer is chattier than TS

Surfaced 2026-09-11 (task-012). `-hls_segment_type fmp4
-hls_fmp4_init_filename init.mp4` plus a `.m4s` segment filename is the
entire change; ffmpeg 6.1 then emits `#EXT-X-VERSION:7` and
`#EXT-X-MAP:URI="init.mp4"` itself. `delete_segments`, `temp_file`,
`independent_segments` and `program_date_time` all keep working. Serve
the init segment and the `.m4s` files as `video/mp4`.

One new thing to expect in the log: the mp4 muxer prints
`Packet duration: -192 / dts: N is out of range` (also `-240`) at roughly
one segment boundary in fifteen, always on the **audio** track and always
at a whole-second dts. The MPEG-TS muxer never said this across eleven
task-011 tunes on the same input, because it does not derive a packet's
duration from the next packet's dts; the mp4 muxer does, and MediaRecorder's
1 s timeslices occasionally hand it audio that steps back 4–5 ms. Measured
effect on the output: none found — hls.js played 605 frames with 0 errors,
a 30 s pull was continuous at 30.04 fps with +16.7 ms A/V skew and no
silence. Treat it as a known warning, not a failure signal; if it ever
needs fixing the lever is on the audio filter side, not the muxer.

## ffmpeg's EXT-X-PROGRAM-DATE-TIME is not RFC 3339, and Go readers reject it

Surfaced 2026-09-11 (task-013 recon, fixed task-014). ffmpeg's hls muxer
(`-hls_flags +program_date_time`) formats the tag as local time with a
strftime `%z` suffix — `2026-09-11T18:57:08.959-0400` — and always writes
it **after** the segment's `#EXTINF` line. The format string in
libavformat is literally `#EXT-X-PROGRAM-DATE-TIME:%s.%03d%s`; there is no
option for UTC, for a `Z`, or for the position. Under `TZ=UTC` you get
`+0000`, still not `Z`.

`-0400` (no colon) is **not** RFC 3339. Go's `time.Parse(time.RFC3339, …)`
fails with `cannot parse "-0400" as "Z07:00"` — measured with Go 1.27.
Channels DVR is a Go program, and on this playlist it logged
`[M3U] stream timestamps: … start_at=X end_at=X live_delay=3s` with
start and end identical, then stopped after one output segment. The
reference stream that plays (PrismCast) writes `2026-09-11T22:57:42.736Z`
and places it **before** `#EXTINF`, and Channels logs no timestamps line
for it at all.

Fix (task-014): rewrite the playlist at serve time in `src/server.ts`.
Every date-time is converted to the **same instant** in UTC with a
trailing `Z` and millisecond precision, and moved to immediately precede
its segment's `#EXTINF`. Verified: served `23:15:05.977Z` against raw
`19:15:05.977-0400` differ by 0 ms; Go RFC3339 parse OK; hls.js and
ffmpeg unaffected. Do not try to fix this with muxer flags — there are
none. Whether it is what Channels' player was refusing is for the
owner's retest; the format defect is real regardless.

Diagnostic rule this taught: when a downstream consumer is written in a
known language, run its standard parser on your output. One `go run`
settled in seconds what three tasks of playback testing could not see,
because hls.js and ffmpeg both *ignore* this tag.

## last_seq=1 is not reproducible with a local ffmpeg stream-copy segmenter

Surfaced 2026-09-11 (task-015). Channels DVR stops our stream after one
output segment (`first_seq=1 last_seq=1`), but a local ffmpeg 6.1.1
stream-copy segmenter cuts our stream into 16–17 segments in **every**
configuration tried: live pull, deterministic 30 s harvested file, fMP4
output, MPEG-TS output, an MPEG-TS-first pass, the trun sync-sample flags
flipped, and a static single-MAP VOD playlist. PrismCast cuts into 16 the
same way. So `last_seq=1` is a property of Channels' specific remux path,
not of our media as a standard ffmpeg segmenter sees it.

Do not re-run local remux reproductions expecting to see `last_seq=1` —
it does not appear outside Channels. Diagnosis has to come from Channels'
own log after a change, not from local ffmpeg.

What task-015 *did* find, ranked, as differences from the working
reference that ffmpeg tolerates but a stricter remuxer might not:
1. **No in-band SPS/PPS** — our keyframe samples were `(6,5,…)`, params
   only in the init `avcC`; PrismCast repeats `(7,8,5,…)` before every
   IDR. Caveat: ffmpeg's mpegts muxer auto-injects them, so this bites
   only if Channels' copy path does not. Addressed in task-016.
2. Repeated `EXT-X-MAP` on every 1 s reload → ffmpeg logs "Found
   duplicated MOOV Atom. Skipped it" (~1 per segment); it keeps cutting.
   A remuxer that re-inits its output on each moov could stall at seq 1.
3. `styp`+`sidx` boxes in our segments (PrismCast: bare `moof`).
4. Identity edit list `(0,0)` in our init moov — a no-op; PrismCast has
   none.

## libx264 keeps SPS/PPS in avcC only unless repeat-headers=1

Surfaced 2026-09-11 (task-016). By default libx264 with a global-header
container (fMP4/MP4) writes SPS/PPS **only** in the init `avcC`, not
in-band. Adding `-x264-params repeat-headers=1` makes it also emit SPS
and PPS before every IDR while the `avcC` still carries them. Verified:
keyframe samples went from `(6,5,…)` to `(6,7,8,…,5)` / `(7,8,5,…)`,
`avcC` still has 1 SPS + 1 PPS, profile stayed High, `has_b_frames=0`,
1.000 s spacing unchanged, hls.js still PLAYING 0 errors, 30 s pull still
continuous. This makes each keyframe a self-contained random-access
point, matching the reference stream.

## Channels' "stream timestamps start_at=end_at" is logged before it opens the connection

Surfaced 2026-09-11 (task-015, owner-supplied log). Channels DVR's
`[M3U] stream timestamps … start_at=X end_at=X live_delay=Ns` line is
printed **before** `[TNR] Opened connection`, i.e. before Channels
fetches our media playlist at all. So it is **not derived from our media
playlist** — it comes from the M3U/source entry or Channels' own state,
not from EXT-X-PROGRAM-DATE-TIME or the segment list. Do not chase the
media playlist to explain that line; it was already a dead lead by
task-014 (start_at=end_at persisted after the PDT fix) and this confirms
the mechanism.

## Guide data did not change last_seq=1; the timestamps line is a media-playlist pre-fetch

Surfaced 2026-09-11 (task-019, owner-supplied log). After task-017 gave
ESPN a `tvc-guide-stationid`, Channels still logged
`[M3U] stream timestamps: ESPN: start_at=21:01:44 end_at=21:01:44
live_delay=3s` at 21:01:45.3 — **before** `Opened connection` — and still
stopped at `last_seq=1`. So an explicit station id changed neither the
timestamps line nor the stop.

The `start_at == end_at` line is consistent with Channels **pre-fetching
the media playlist** and reading its first and last
`EXT-X-PROGRAM-DATE-TIME`: on a cold playlist those are the *same*
segment's value (one segment in the window), so the window is zero and
Channels appears to fetch nothing further. This is why it precedes
`Opened connection` (the pre-fetch happens first) yet still reflects our
media playlist. Task-019 removes the tag (`-hls_flags` no longer carries
`program_date_time`) to eliminate the two equal values that pre-fetch
reads. The task-014 serve-time UTC rewrite in src/server.ts stays as a
no-op. Whether this changes Channels' behaviour is unverified — it cannot
be reproduced locally (task-015), only the owner's log can confirm.

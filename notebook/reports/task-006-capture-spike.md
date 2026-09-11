# Task 006 — Capture spike

Date: 2026-09-11. Host: marlinpc. DISPLAY=:10.

**Status: complete, and the make-or-break question came back the good
way. DRM-protected YouTube TV video IS captured by `chrome.tabCapture`.
It is not black.** A 60-second recording of TNT produced a 20.4 MB
WebM carrying real, moving 1080p-sourced picture and real audio, with
audio and video 28 ms apart at the start and 46 ms of drift across the
whole minute.

**Chrome was never restarted.** pid 76888 is the same process that was
running when this task started, still signed in, still playing, and
`navigator.webdriver` still reads `false`. The extension was installed
into the *running* browser. No login was performed, `accounts.google.com`
was never navigated to.

Two findings changed how the extension has to be delivered, and one
changes what the container needs. They are in (iii).

---

## (i) D011 and D012 recorded — step 4

Both appended verbatim to `notebook/DECISIONS.md` after D010, as
`## D011 — Capture method` and `## D012 — Deployment target`. No
existing entry was edited.

---

## (ii) Extension structure and permissions — step 5a

```
extension/
├── manifest.json      manifest v3
├── background.js      service worker — gets the stream id, relays start/stop
├── offscreen.html     3 lines; exists only to host offscreen.js
└── offscreen.js       getUserMedia + MediaRecorder + the blob
```

### Permissions: four, and why each one is unavoidable

```json
"permissions": ["tabCapture", "offscreen", "activeTab", "downloads"]
```

| Permission | Why it cannot be dropped |
|---|---|
| `tabCapture` | the API itself |
| `activeTab` | **measured, not assumed** — without an invocation on the tab the API refuses outright (see below) |
| `offscreen` | a MV3 service worker has neither `navigator.mediaDevices` nor `MediaRecorder`; there is nowhere else to record |
| `downloads` | the only way an extension writes a file to disk without a save dialog |

**No `host_permissions`. No `<all_urls>`. No `tabs`. No content
scripts. No `storage`.** `chrome.tabs.query` is used to find the active
tab and works without the `tabs` permission because only `id` is read.
An earlier draft used `chrome.storage.session` to pass options to the
worker; that was replaced with worker globals specifically to delete the
`storage` permission.

### Why an offscreen document at all

The service worker can obtain a stream *id* but cannot turn it into a
`MediaStream`. So `background.js` calls
`chrome.tabCapture.getMediaStreamId({targetTabId})`, and `offscreen.js`
turns that id into the stream:

```js
navigator.mediaDevices.getUserMedia({
  audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: id } },
  video: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: id } },
})
```

One deliberate extra: tab capture mutes the tab locally, so the
offscreen document routes the captured audio back to the default output
through an `AudioContext`. Three lines. Without it the tab goes silent
whenever it is being recorded, which would have been a confusing thing
to leave for the owner to discover.

### `activeTab` is enforced — this is a real constraint

Every run logged the same refusal on the first, direct attempt:

```
start : direct call refused -> Extension has not been invoked for the current page
        (see activeTab permission). Chrome pages cannot be captured.
start : retrying via Extensions.triggerAction (grants activeTab)
```

`chrome.tabCapture` cannot be started by an extension that has merely
been installed. Something must *invoke* it on that tab. Over CDP the
equivalent of clicking the toolbar icon is `Extensions.triggerAction`,
and it worked on every one of the seven recordings made today.

Two details cost time and are worth writing down:

- `Extensions.triggerAction` takes `{ id, targetId }`, and `targetId`
  must be a **`tab` target — not the `page` target** everything else is
  driven through. `tab` targets are excluded from `Target.getTargets`
  unless you ask: `Target.getTargets({ filter: [{}] })`. Passing the
  page target returns `Action can only be triggered on a tab target.`
- The MV3 worker is lazy and often has no target yet. The driver polls
  for it and uses `triggerAction` as the wake. To make that safe the
  extension only records when the driver has **armed** it first; an
  unarmed invocation is a deliberate no-op.

---

## (iii) The four findings — step 6

### (a) What governs the captured resolution

**Neither the window nor the video. With no constraint the capture is
the size of the *display*; with a constraint it is exactly the
constraint.** The video's own 1920x1080 has no influence at all.

Controlled arms, all on the same live tab playing the same 1920x1080
stream, window bounds read back over CDP *during* the recording:

| Arm | Window (measured, live) | Page viewport | Video element | Constraint | **File (ffprobe)** |
|---|---|---|---|---|---|
| main 60 s | 2560x1354 maximized | 2560x1267 | 1920x1080 | none | **2560x1380** |
| small window | **1219x1334 normal** | **1211x1243** | 1920x1080 | none | **2560x1380** |
| constrained | 2560x1354 maximized | 2552x1263 | 1920x1080 | `1920x1080` | **1920x1080** |

The small-window arm is the discriminating one. The Chrome window was
genuinely 1219x1334 — read back mid-recording, not assumed — and the
file still came out 2560x1380. `xrandr` reports this screen as
**2560x1381**; 1380 is that height rounded down to an even number for
the encoder.

**So: shrink the window and you do not shrink the capture, you just get
the same frame with the page laid out smaller inside it.** What the
owner must control is the `getUserMedia` constraint:

```js
video: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: id,
                      maxWidth: 1920, maxHeight: 1080, maxFrameRate: 30 } }
```

Asking for 1920x1080 produced exactly 1920x1080. This also means the
Task 002 rule still stands and is now two independent rules: **pin the
player quality with `setPlaybackQualityRange` so 1080p is what gets
decoded, and pin the capture constraint so 1080p is what gets encoded.**
Neither implies the other.

Frame rate behaves the same way — a default, and a ceiling:

| Requested | Negotiated by the track | **Measured in the file** |
|---|---|---|
| (nothing) | 30 | **30.01 fps** |
| `maxFrameRate: 60` | 60 | **38.62 fps** |

The default is 30, so a 60 fps source is **halved unless asked
otherwise** — and asking for 60 did not deliver 60 here. 38.6 fps is
what this box managed with a 50 Hz display, a software rasterizer and a
software encoder (see (c)).

### (b) Minimized, occluded, or unwatched display

**Occluded is fine. Minimized is fatal. Unwatched is not observed.**

| State | Verified how | Frames | fps | Picture | Audio |
|---|---|---|---|---|---|
| Normal / maximized | — | 1851 | 30.01 | luma 36–92, varying | −23.4 dB mean |
| **Occluded** by another maximized window | second Chrome window raised over it | 343 | 30.00 | **luma 41–94, varying** | −21.8 dB mean |
| **Minimized** | `windowState:"minimized"` read back mid-capture | 488 | 29.77 | **goes black** | −26.2 dB, continues |

Occlusion changes nothing. Covering the live window completely with
another application's maximized window produced a recording
indistinguishable from an unobstructed one.

Minimizing does not stop the recording — frames and audio keep flowing
at 30 fps — but the **picture goes black and freezes**. The luma trace
is unambiguous:

```
t=0.0 .. 8.2s   YAVG 65.6, 60.6, 61.8, 62.5, 70.1  <- real picture
t=8.7s          YAVG 16.8                          <- window actually minimised
t=9.2 ..15.1s   YAVG 14.18, 15.55, 14.0788, 14.0788, 14.0768, 14.0768, 14.0768
                                                   <- identical to 4 d.p.: frozen
t=15.6s         YAVG 36.8, 45.9                    <- window restored, picture back
```

An extracted frame from the frozen stretch is a black image. Audio ran
normally throughout, so a minimized capture yields **sound over a black
screen** — the worst possible failure, because it produces a plausible
file rather than an error.

**"A display nobody is connected to" was NOT tested.** `Xvfb`,
`xvfb-run` and `Xephyr` are all absent from this machine and installing
is out of scope, so no arm exists for it. What the two arms above
establish is that the thing that matters is whether the window is
*mapped and rendering*, not whether a human can see it — occluded
pixels nobody can see captured perfectly. That makes a virtual display
the likely answer, but it is an inference, not a measurement.

### (c) Codec, container, and hardware acceleration

**MediaRecorder produced VP8 video + Opus audio in a WebM (Matroska)
container, and encoding on this machine is entirely software.**

No `mimeType` was requested — the recorder was constructed bare
specifically so its own default would be the finding:

```
recorder.mimeType                         -> video/webm;codecs=vp8,opus
ffprobe format_name                       -> matroska,webm
ffprobe stream 0                          -> vp8, profile 0, yuv420p, bt709
ffprobe stream 1                          -> opus, 48000 Hz, stereo
```

**VP8, not VP9** — worth flagging, since the *source* is VP9 (Task 002).
The tab is decoded and then re-encoded to a different, older codec.

Hardware acceleration: **none, and not because of the codec choice.**
Chrome in this session is not on the GPU at all:

```
SystemInfo.getInfo -> devices: ANGLE (Mesa, llvmpipe (LLVM 20.1.2 256 bits))
                      videoDecoding profiles: (none)
                      videoEncoding profiles: (none reported)
```

`llvmpipe` is Mesa's software rasterizer. Probed directly through
WebCodecs in the live page, every codec refuses hardware:

| Codec | `prefer-hardware` | `prefer-software` |
|---|---|---|
| VP8 | **false** | supported |
| VP9 | **false** | supported |
| H.264 | **false** | **false** |
| AV1 | **false** | supported |

The hardware present is an **i9-14900KF** (the `F` means *no integrated
graphics*) plus an **RTX 4070 Ti SUPER**, driver 595.84. So even if
Chrome were on the GPU, NVENC encodes H.264/HEVC/AV1 and **not VP8 or
VP9** — the codec MediaRecorder actually picked could not have been
hardware-encoded on this box in any case.

One trap: `MediaRecorder.isTypeSupported()` is optimistic and disagrees
with WebCodecs. It returns `true` for `video/webm;codecs=h264,opus`
while WebCodecs reports H.264 encoding unsupported at every acceleration
setting. Do not select a recording codec from `isTypeSupported` alone.

### (d) Does the DRM-protected video come through, or black?

**It comes through. In full.** See (v) — this is the headline result and
it gets its own section.

---

## (iv) Measured output — step 7

Everything below is measured **from the file**, not read off the
recorder. The recorder's own claims are in (iii)(c) and are reported
separately on purpose.

`data/captures/drm-1080p-20260911T152744.webm` — 20,365,091 bytes

| | Measured | How |
|---|---|---|
| Resolution | **2560x1380** | `ffprobe` stream 0 |
| Frame rate | **30.01 fps** | 1851 packets over 61.688 s |
| Duration | **61.69 s** (video), **61.74 s** (audio) | packet PTS; 2,963,520 samples/ch ÷ 48 kHz |
| Frames decoded | **1851** | full `ffmpeg -f null -` decode pass |
| Bitrate | **2.64 Mbps** | size ÷ duration |
| Video present | **yes, and not black** | below |
| Audio present | **yes** | mean −23.4 dB, peak −4.1 dB, 5,927,040 samples |
| A/V sync | **+28 ms at start, +46 ms drift over the minute** | packet PTS per stream |

The container carries no duration header — MediaRecorder writes a live
stream — so `ffprobe` alone reports `duration=N/A`. Every duration above
comes from decoding or from packet timestamps.

**Not black, measured two ways.** Whole-frame mean luma sampled every
~2 s across the full minute never settles and never goes dark:

```
89.98  45.54  59.02  49.51  76.37  71.22  38.19  47.08  77.75  48.74
48.61  44.59  82.50  73.20  36.68  55.12  58.21  38.19  37.33  37.71
38.22  64.24  71.34  37.72  37.71  36.38  38.33  92.48  82.47  77.87  36.50
```

`blackdetect` (d=0.5, pix_th=0.10) reported **no black intervals at
all**. Because a whole-frame average could in principle be lifted by
bright page chrome around a black video box, luma was also measured on a
1600x900 crop of the frame **centre**, which is inside the video area:
44.5 / 97.8 / 68.8 / 44.5 / 104.6 at t = 5/15/30/45/58 s. Varying
content, not a dark still.

**Audio is real, not a silent track.** `volumedetect` gives mean −23.4 dB
and peak −4.1 dB; `astats` gives a flat factor of 0.000000 (no stuck
samples); `silencedetect` at −50 dB found **no silent run of 1 s or
more** anywhere in the minute.

**Sync.** Audio starts 28.0 ms after video and ends 74.0 ms after it, so
the two tracks drifted **46 ms apart over 61.7 seconds**. That is well
inside the perceptual window and, more importantly, shows no runaway
drift — which is the specific failure D011 was written to avoid. Stated
precisely: this measures the alignment of the two tracks *in the
container*. It is not a lip-sync measurement against the broadcast, and
nothing here was clapper-tested.

**Screenshot:** `notebook/reports/task-006-capture-frame-t30.png` —
the frame at t=30 s, extracted from the middle of the recording,
2560x1380. It shows a man in a dark shirt in front of a window blind,
with the TNT bug bottom-right and black pillarbox bars either side.
**Nothing was blurred or cropped because there was nothing to hide** —
the frame contains no account name, no email, no avatar, and no player
chrome.

---

## (v) DRM: captured, not black — step 6d

**This is the result the task was built around, and it is positive.**

Widevine-protected YouTube TV video passes through `chrome.tabCapture`
intact. The picture in the captured file is the programme. There is no
black frame, no blanking, no "protected content" placeholder, at any
point in 61.7 seconds.

Playback at capture time was the same configuration Task 002 and 005
measured — Widevine **L3**, software robustness, 1920x1080 pinned with
`setPlaybackQualityRange("hd1080","hd1080")`, confirmed by the player
itself before recording started:

```
player : {"ok":true,"quality":"hd1080","video":"1920x1080",
          "box":"2252x1267","viewport":"2560x1267","dpr":1,"paused":false}
```

The honest scope of that claim: **this was measured at L3 only.** The
common reason tab capture returns black for DRM is hardware-backed
(L1) decode, where frames live in protected memory the browser cannot
read back. Task 002 recorded `HW_SECURE_ALL: DENIED` on this machine
and (iii)(c) now shows Chrome has no GPU video path here at all. So
capture succeeded in precisely the conditions where it is *expected* to
succeed. **If a future container ever gets hardware decode working and
YouTube TV promotes the session to L1, this result does not carry
over** — it would need re-measuring, and black frames would be the
predictable outcome.

---

## (vi) What this means for the container design

1. **A virtual display is almost certainly required — and it must not
   be a minimized window.** The minimized arm is the warning: the
   recording keeps running and keeps writing audio while the video is
   black. Whatever the container does, the Chrome window must be mapped
   and rendering. The occluded arm shows nobody needs to be *looking* at
   it. `Xvfb` was not testable here, so this is the strongest
   recommendation the evidence supports, not a proven requirement.

2. **Window size is not a tuning knob; the capture constraint is.**
   Nothing in the container needs `--start-maximized`, window bounds
   management, or fullscreen. It needs `maxWidth: 1920, maxHeight: 1080`
   on the `getUserMedia` constraint. Left unconstrained, the capture
   would silently take the size of whatever virtual display is
   configured — which on a 4K virtual display would mean encoding 4K.

3. **Two separate 1080p pins, and both can regress silently.**
   `setPlaybackQualityRange` controls what is decoded; the capture
   constraint controls what is encoded. Task 002's open question about
   whether the quality pin survives ad breaks and channel changes now
   matters twice over.

4. **The extension cannot be loaded with a command-line flag.** This is
   the delivery finding, and it shapes the container entrypoint — see
   (iii) and the `start-chrome.sh` comment block. The container will
   have to load the extension over CDP after Chrome is up, exactly as
   `capture-spike.mjs` does, or ship it pre-installed inside the profile
   volume. The latter is untested.

5. **`activeTab` means something must invoke the extension per tab.**
   In the container that is another CDP call (`Extensions.triggerAction`
   against a `tab` target), not a user click. It worked seven times out
   of seven today, but it is a moving part with no fallback.

6. **Encoding cost is real and currently all CPU.** 2560x1380 VP8 at
   30 fps came out at 2.64 Mbps and could not reach 60 fps when asked.
   Chrome on this host has no GPU at all, so nothing here measures what
   the Unraid UHD 770 would do. Note the mismatch worth resolving
   before D006's HLS contract is built: MediaRecorder emits **VP8**,
   and Channels DVR consumes HLS, which normally means H.264.

---

## (vii) Files touched — step mapping

| File | Step | Change |
|---|---|---|
| `notebook/DECISIONS.md` | 4 | D011 and D012 appended verbatim |
| `extension/manifest.json` | 5a | new — MV3, four permissions |
| `extension/background.js` | 5a | new — service worker, stream id, start/stop, download |
| `extension/offscreen.html` | 5a | new — hosts the recorder |
| `extension/offscreen.js` | 5a | new — `getUserMedia` + `MediaRecorder` + blob |
| `scripts/start-chrome.sh` | 5b | comment block only — names `--load-extension`, records that it is inert on Chrome 153, points at the CDP route. **The `exec` line is byte-for-byte unchanged**: same port 9333, same `--password-store=basic`, same profile |
| `scripts/capture-spike.mjs` | 5c | new — CDP attach, load extension, deep link, pin 1080p, record 60 s, stop, report path and size |
| `notebook/reports/task-006-capture-spike.md` | 10 | this report |
| `notebook/reports/task-006-capture-frame-t30.png` | 7 | frame from the middle of the 60 s recording |
| `data/captures/*.webm` | 5a | eight recordings — **gitignored via `.gitignore:3:/data/`, not committed** |

Nothing else was touched. No HLS server, no `/playlist`, no channel
list, no transcoding, no ffmpeg in any shipped code, no Dockerfile, no
Xvfb, **no new dependencies** — the CDP client in `capture-spike.mjs` is
about fifty lines over Node 22's built-in global `WebSocket`.
`src/login.ts` and `package.json` were not modified. Nothing binds 8804.
`backups/` and `data/chrome-profile-v11-20260911-104559` were never
read, written, or launched against. Nothing touched Unraid or
`/Apps/marlin-iptv-editor`. Nothing was installed.

**ffmpeg and ffprobe were used, and only as measuring instruments** for
step 7 — no shipped code invokes them. Saying so plainly because step 5d
forbids ffmpeg in the build and step 7 requires the output to be
measured rather than asserted.

**Throwaway Chrome instances** on separate profiles under the scratchpad
(ports 9444/9555/9666) were used for the extension-loading arms and the
occlusion test. All were killed; only pid 76888 remains.

---

## (viii) OPEN QUESTIONS

1. **Does the container need Xvfb?** Not answerable on this machine —
   `Xvfb` is not installed and installing is out of scope. Occluded
   capture works and minimized capture goes black, which points at "a
   mapped window on some display", but no arm has ever run without a
   real X session behind it.

2. **How should the extension be loaded in the container?** Three
   options and none is tested: load over CDP at startup (what this spike
   does), pre-install it into the profile volume so it is already in
   `Preferences`, or pin a Chrome old enough to honour
   `--load-extension`. The first works but adds a startup ordering
   dependency; the second would remove it entirely and is worth trying.

3. **VP8 out, H.264 needed?** MediaRecorder produces VP8/Opus in WebM.
   D006's contract is HLS into Channels DVR. Whether that is served by
   re-encoding, by asking MediaRecorder for a different codec (VP9 and
   H.264 both report supported, though H.264 contradicts WebCodecs), or
   by a fragmented-MP4 path, is undecided and materially affects CPU
   cost on Unraid.

4. **Can 60 fps be reached at all?** Asking for it gave 38.6 fps here,
   on a 50 Hz display with a software rasterizer. Whether that is the
   display, the rasterizer or the encoder is unseparated, and whether
   1080p60 is even wanted — versus 1080p30 at half the encode cost — is
   the owner's call.

5. **Does `activeTab` survive a long recording?** The grant is tied to
   the tab and is documented to end on navigation. A channel change
   navigates. Whether `triggerAction` must be re-issued per tune, and
   what happens to an in-flight capture when it is not, is unobserved.

6. **Is the 46 ms drift constant or cumulative?** One 61-second sample
   cannot tell a fixed offset from a slow leak. An hour-long recording
   would, and that is the case D011 exists for.

---

## (ix) Least certain

1. **That DRM capture keeps working.** It worked today, at Widevine L3,
   with Chrome on a software rasterizer and no GPU video path — which
   is exactly the configuration where capture is *expected* to succeed.
   The whole result may be a side effect of this box having no working
   hardware decode. A container with `/dev/dri` passed through, doing
   the thing D007 explicitly wants, is the configuration most likely to
   turn these frames black. I would not treat "DRM captures" as settled
   until it has been measured once with hardware decode active.

2. **That the minimized-window result generalises to a headless
   display.** I am reasoning from "occluded works, minimized doesn't"
   to "a mapped window on a virtual display will work". That is a
   plausible reading of Chrome's render throttling and it is still an
   inference across an untested gap — there was no way to test it here.

3. **That `Extensions.triggerAction` is a dependable mechanism.** It is
   the load-bearing step: without it `tabCapture` refuses outright. It
   succeeded seven times for seven recordings, all within one browser
   session, all on the same tab, none across a channel change. It is
   also a relatively new CDP surface, undocumented in the places one
   would look, and I found its `tab`-versus-`page` target requirement
   only by hitting the error. It is the part of this design I would
   least want to discover was fragile in month three.

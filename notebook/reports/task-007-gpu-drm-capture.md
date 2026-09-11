# Task 007 — GPU path vs DRM capture

Date: 2026-09-11. Host: marlinpc. DISPLAY=:10.

**Status: complete, with a negative result on the central question.
Hardware video decode could not be enabled on this machine at all, so
the question "does hardware decode black the capture" is NOT ANSWERED —
and no flag combination would have answered it.** The reason is
structural and is proven below: Chrome on Linux hardware-decodes only
through VAAPI, and this box has no VAAPI backend for its GPU.

Arm 2 was launched with the standard VAAPI flags and `chrome://gpu`
duly turned green — **"Video Decode: Hardware accelerated"** — but the
decoder actually running the stream was still a software one. That gap
between what `chrome://gpu` claims and what is really decoding is the
most useful thing this task found, and it is the reason step 4 asked for
the fallback check.

Both arms captured a real picture. Neither came through black.

**Live session untouched and proven so at the end:** Chrome pid 76888,
2 h 38 m uptime, signed in, playing 1080p, port 9333 loopback only,
`navigator.webdriver` false. It was never stopped, never relaunched, and
never had a second Chrome pointed at its profile.

---

## (i) Per-arm configuration, with proof each arm was what it claimed

Every arm: its **own fresh `cp -a` copy** of
`backups/chrome-profile-basic-20260911-110129`, its own port, loopback
only, `--password-store=basic`, `Singleton*` cleared before launch,
deleted afterwards. The backup was read from and never written to; it
is byte-identical at the end of this task (verified in (vii)).

Each copy verified at launch: **1842 files, 270,807,537 bytes** — the
same counts Task 005 recorded for the backup.

### Arm 1 — baseline, software (port 9444)

Flags beyond the Task 006 baseline: **none.** Read back off the running
process:

```
--user-data-dir=<throwaway copy>
--remote-debugging-port=9444
--password-store=basic
--no-first-run
--no-default-browser-check
```

```
$ ss -tln | grep 9444
LISTEN 0 10  127.0.0.1:9444  0.0.0.0:*
```

**`chrome://gpu` — Graphics Feature Status:**

```
Canvas                             : Software only. Hardware acceleration disabled
Direct Rendering Display Compositor: Disabled
Compositing                        : Software only. Hardware acceleration disabled
Multiple Raster Threads            : Disabled
OpenGL                             : Disabled
Rasterization                      : Software only. Hardware acceleration disabled
Video Decode                       : Software only. Hardware acceleration disabled
Video Encode                       : Software only. Hardware acceleration disabled
Vulkan                             : Disabled
WebGL                              : Disabled
```

```
GL_RENDERER   : ANGLE (Mesa, llvmpipe (LLVM 20.1.2 256 bits), OpenGL 4.5 ...)
videoDecoding : (none)
videoEncoding : (none)
```

**This is Task 006's configuration exactly, and the harness reproduced
its result** — see (ii). That was the point of Arm 1 and it passed.

### Arm 2 — hardware video decode enabled (port 9445)

Flags added:

```
--ignore-gpu-blocklist
--enable-features=VaapiVideoDecoder,VaapiVideoDecodeLinuxGL,
                  AcceleratedVideoDecodeLinuxGL,
                  AcceleratedVideoDecodeLinuxZeroCopyGL,
                  VaapiIgnoreDriverChecks
--enable-gpu-rasterization
--enable-zero-copy
--use-gl=angle
--use-angle=gl
```

All present on the running process; port 9445 loopback only.

**`chrome://gpu` — Graphics Feature Status, and this is the trap:**

```
Canvas                             : Hardware accelerated
Compositing                        : Hardware accelerated
Multiple Raster Threads            : Enabled
OpenGL                             : Enabled
Rasterization                      : Hardware accelerated on all pages
Video Decode                       : Hardware accelerated      <-- says yes
Video Encode                       : Software only. Hardware acceleration disabled
WebGL                              : Hardware accelerated
WebGPU                             : Hardware accelerated
Vulkan                             : Disabled
```

**It is not true.** Three independent readings contradict that line:

```
GL_RENDERER   : ANGLE (Mesa, llvmpipe (LLVM 20.1.2 256 bits), ...)   <- still the software rasterizer
videoDecoding : (none)                                               <- zero HW decode profiles advertised
videoEncoding : (none)
```

and, decisively, `chrome://media-internals` read **while the stream was
playing**, for the active player on the channel deep link:

```
kVideoDecoderName        = "DecryptingVideoDecoder"
kIsPlatformVideoDecoder  = false        <-- NOT a hardware decoder
kAudioDecoderName        = "FFmpegAudioDecoder"
kIsPlatformAudioDecoder  = false
kResolution              = "1920x1080"
"use_hw_secure_codecs"   : false        <-- still Widevine L3
"codec"                  : "vp9"
```

**So `chrome://gpu`'s green "Hardware accelerated" is a *policy*
readout, not a statement about silicon.** `--ignore-gpu-blocklist`
removes the block; it does not conjure a decoder. What Arm 2 actually
changed was that Chrome routed compositing, rasterization and canvas
through ANGLE→GL instead of its own software compositor — but that GL is
*itself* Mesa llvmpipe, so no NVIDIA silicon entered the path either.

**Arm 2 therefore did not test what it was meant to test.** Stated
plainly, as step 4 requires.

### Why no flag could have fixed it

This is structural, not a matter of finding the right switch:

| Fact | Evidence |
|---|---|
| Chrome on Linux hardware-decodes video **only** via VAAPI | Chrome's only Linux HW decode path; no NVDEC/CUVID path exists in Chrome |
| The only GPU is NVIDIA | `lspci`: `AD103 [GeForce RTX 4070 Ti SUPER]`; `/dev/dri/by-path/` has one entry, `pci-0000:01:00.0`, and `/sys/class/drm/renderD128/device/uevent` reads `DRIVER=nvidia` |
| The CPU has **no** integrated GPU | `i9-14900KF` — the `F` suffix means no iGPU |
| VAAPI backends installed are Intel / nouveau / AMD / virtio only | `/usr/lib/x86_64-linux-gnu/dri/`: `i965_drv_video.so`, `iHD_drv_video.so`, `nouveau_drv_video.so`, `r600_drv_video.so`, `radeonsi_drv_video.so`, `d3d12_drv_video.so`, `virtio_gpu_drv_video.so` |
| The NVIDIA VAAPI bridge is **absent from the entire filesystem** | whole-filesystem `find / -name '*nvidia*drv_video*'` returned nothing |
| `libva` itself is present, so the flags "work" — they just find no driver for this GPU | `libva.so.2`, `libva-drm.so.2`, `libva-x11.so.2` present |

Installing `nvidia-vaapi-driver` would be the only route, and installers
are out of scope. **Per step 6 I did not iterate through flag
combinations**; the table above is why there was nothing to iterate
toward.

---

## (ii) Per-arm measured results, side by side

Measured identically by one script, from the output files only, never
from recorder settings.

| | **Arm 1 — software** | **Arm 2 — HW-decode flags** |
|---|---|---|
| File size | 13,757,223 bytes | 11,374,042 bytes |
| Resolution | **2560x1380** | **2560x1380** |
| Codecs | vp8 / opus | vp8 / opus |
| Duration (video / audio) | 61.68 s / 61.62 s | 61.66 s / 61.62 s |
| Frames | 1845 | 1825 |
| Frame rate | **29.91 fps** | **29.60 fps** |
| A/V skew across recording | −60.0 ms | −40.0 ms |
| Whole-frame luma, 31 samples | **18.71 – 24.19, VARYING** | **19.69 – 30.32, VARYING** |
| Centre-crop luma (t=5/15/30/45/55) | 22.7 / 26.2 / 29.1 / 24.4 / 27.7 | 25.5 / 24.8 / 26.0 / 26.1 / 26.4 |
| `blackdetect` (d=0.5, pix_th=0.10) | **no black intervals** | **no black intervals** |
| Audio | mean −35.9 dB, peak −13.1 dB | mean −34.2 dB, peak −7.7 dB |
| Silence ≥ 1 s at −50 dB | none | none |
| **Is there a picture?** | **YES** | **YES** |

Both player readouts before recording confirmed the intended state:
`{"ok":true,"quality":"hd1080","video":"1920x1080",...}`.

**Screenshots** (middle frame, t = 30 s, full 2560x1380):

- `notebook/reports/task-007-arm1-software-t30.png` — a dark interior
  scene, a figure beside a panelled door, TNT bug and a programme promo
  banner bottom-right.
- `notebook/reports/task-007-arm2-hwdecflags-t30.png` — the same
  programme later on, a figure in a veiled headdress in a library.

Neither contains an account name, email, avatar, or player chrome.
Nothing was blurred or cropped because there was nothing to hide.

**Two honest caveats about this table.**

The luma figures are much lower than Task 006's 36–92, and that is
**the programme, not the capture**. The frames show a deliberately
dark-graded drama; Task 006 recorded a brightly-lit scene. Low luma here
is content, and the extracted frames are the check that stops that being
misread.

The arms ran about **three and a half minutes apart on live
television**, so they recorded *different content*. Comparisons that
survive that are the ones that matter — picture present, no black
intervals, resolution, frame rate, audio present. Comparisons that do
**not** survive it are file size, bitrate and absolute luma; the 0.3 fps
difference between arms is noise, not a measurement of the GPU path.

---

## (iii) Does hardware decode black the capture — yes or no?

**Not answered, and it could not be answered on this machine.**

The honest statement in three parts:

1. **No arm on marlinpc has ever had a hardware video decoder in the
   path.** Arm 2 was built to be that arm and was not, proven by
   `kIsPlatformVideoDecoder = false` at the moment of capture.
2. **What Arm 2 did establish is narrower and still useful:** turning on
   Chrome's *accelerated compositing and rasterization* path — Canvas,
   Compositing, Rasterization and WebGL all flipping to "Hardware
   accelerated" — **did not black the capture.** Picture present, no
   black intervals, audio normal.
3. The classic mechanism for DRM capture returning black is
   **hardware-backed protected decode**, where decoded frames live in
   protected memory the renderer cannot read back — normally alongside
   Widevine **L1**. This session stayed on **L3**
   (`use_hw_secure_codecs: false`), which is precisely the configuration
   where capture is expected to work. Task 006 said this was the
   outstanding risk; it remains outstanding.

---

## (iv) Decode vs compositing split

**Step 6's further arm was not run, because its trigger did not fire —
Arm 2 did not come through black.** Recording that as a deliberate
decision rather than an omission.

What can be said about the split from the arms that did run:

| Path | Engaged? | Capture blacked? |
|---|---|---|
| Chrome's accelerated **compositing / rasterization / canvas / WebGL** | **Yes** (Arm 2, `chrome://gpu` green, confirmed) | **No** |
| **Hardware video decode** | **No** — never engaged in any arm | **Unknown** |
| GPU **silicon** of any kind | **No** — `GL_RENDERER` was llvmpipe in both arms | n/a |

So the compositing half of the question has a partial answer —
*accelerated compositing on a software GL does not black the capture* —
and the decode half has none. The stronger version of the compositing
question, *does compositing on real GPU silicon black the capture*, is
also unanswered, because Chrome never reached the NVIDIA GPU in this
xrdp session at all.

**For the container this is the operative point:** the decode/compositing
separation the owner wanted, so that `/dev/dri` could be used for
encoding while decode stayed in software, is a real and available
configuration — `--disable-accelerated-video-decode` turns decode off
independently of the rest — but **whether it is necessary is untested**,
because nothing has yet shown decode causes a problem.

---

## (v) What `/dev/dri` is actually for under D011

The question is whether `/dev/dri` buys anything on the capture path at
all, given MediaRecorder encodes inside Chrome.

**It is not a no-op. Under D011 the potential benefit is inside Chrome,
not in a later ffmpeg step.** There are three distinct consumers:

| Consumer | What `/dev/dri` would do | Status here |
|---|---|---|
| **Video decode** — the incoming VP9 stream | VAAPI decode instead of libvpx on CPU | **EVIDENCE:** never engaged; `videoDecoding: (none)`, `kIsPlatformVideoDecoder=false` |
| **Video encode** — MediaRecorder's own VP8/VP9 output | VAAPI encode instead of libvpx on CPU | **EVIDENCE:** `Video Encode: Software only` in **both** arms; Task 006 measured `VideoEncoder.isConfigSupported({hardwareAcceleration:"prefer-hardware"})` false for VP8, VP9, H.264 and AV1 |
| **Compositing / rasterization** | page and video layers composited on GPU | **EVIDENCE:** Arm 2 flipped these to "Hardware accelerated", but on llvmpipe, so no silicon was used |

**REASONING, labelled as such:** Chrome's MediaRecorder uses a hardware
video encode accelerator when one advertises support for the profile and
resolution — that is what the `Video Encode` line in `chrome://gpu`
reports. So on a host where VAAPI *does* work, `/dev/dri` would plausibly
move MediaRecorder's encode off the CPU without any change to D011's
design and without any ffmpeg step existing. **This is inference from
Chrome's documented behaviour and the `chrome://gpu` field, not
something observed** — it has never been seen to happen on this project,
because no arm has ever had a working VAAPI encoder.

**The Unraid target is materially different from marlinpc, and that is
the whole point.** D007 names the UHD 770; D012 makes Unraid the home.
`iHD_drv_video.so` — the Intel VAAPI driver an UHD 770 needs — **is
already present on this machine** and would be present in a normal
container image. So the Unraid box is a host where all three consumers
above could genuinely engage, while marlinpc is a host where none of
them can. **Every "no hardware acceleration" result in this project and
in Task 006 is a fact about marlinpc, not a prediction about Unraid.**

**What `/dev/dri` does NOT buy under D011 as it stands:** there is no
ffmpeg process in the design, so the familiar "pass `/dev/dri` for
VAAPI transcoding" benefit does not apply yet. D006's HLS contract will
eventually need something to produce an HLS-compatible stream from
MediaRecorder's VP8/WebM, and *that* step — which does not exist — is
where a conventional ffmpeg VAAPI pipeline would use `/dev/dri`.

---

## (vi) What this means for D007 and the container design

1. **D007's premise cannot be validated on marlinpc.** D007 says VAAPI
   on `/dev/dri` is "tested during development, not deferred to deploy",
   and D004 was superseded specifically because marlinpc *has* a
   `/dev/dri`. It does — but it is an NVIDIA render node with no VAAPI
   driver behind it, and the CPU has no iGPU. **For VAAPI purposes
   marlinpc is as bare as the Mac was.** This does not overturn D007 —
   that is the owner's call — but the fact it rests on is not true here.

2. **The black-frame risk moves to deploy, unchanged.** Task 006 flagged
   hardware decode as the thing most likely to turn captured frames
   black. This task was meant to close that and could not. It is now a
   first-run risk on Unraid, where an Intel iGPU plus `iHD` is exactly
   the configuration that could produce hardware decode — and plausibly
   Widevine L1 with it.

3. **There is a safe first move, and it is cheap.** The container can
   run with `/dev/dri` passed through but Chrome launched with
   `--disable-accelerated-video-decode`, keeping decode in software
   where capture is known to work while leaving the device available.
   Then enable decode deliberately, as one change, and re-measure. That
   ordering is a suggestion, not a decision — D011 and D007 are the
   owner's.

4. **Do not trust `chrome://gpu` alone in the container.** The single
   most transferable finding: `chrome://gpu` said "Video Decode:
   Hardware accelerated" while a software decoder was running. The
   check that told the truth was `chrome://media-internals` →
   `kIsPlatformVideoDecoder`. Any container acceptance test should read
   that field, not the green text.

5. **Encoding cost on Unraid is still unknown.** Task 006 measured VP8
   software encode failing to reach 60 fps here. Whether an UHD 770 can
   hardware-encode what MediaRecorder asks for is unobserved, and it
   bears directly on whether one channel at 1080p is comfortable on a
   box already running Channels DVR.

---

## (vii) Files touched — step mapping

| File | Step | Change |
|---|---|---|
| `notebook/reports/task-007-gpu-drm-capture.md` | 10 | this report |
| `notebook/reports/task-007-arm1-software-t30.png` | 5 | Arm 1 middle frame |
| `notebook/reports/task-007-arm2-hwdecflags-t30.png` | 5 | Arm 2 middle frame |
| `data/captures/arm1-sw-*.webm`, `arm2-hwdec-*.webm` | 4 | the two recordings — **gitignored via `.gitignore:3:/data/`, not committed** |

**Nothing else in the repository was modified.** No changes to `src/`,
`scripts/`, or `extension/` — `scripts/capture-spike.mjs` was *invoked*
with `CDP_PORT` pointing at each arm, exactly as written, and not
edited. `notebook/DECISIONS.md` and `notebook/KNOWN-FIXES.md` were read
only. No HLS server, no `/playlist`, no channel list, no ffmpeg
pipeline, no Dockerfile, no Xvfb, no container, no new dependencies.
Nothing binds 8804.

`git status` before committing showed only the three files above as
additions, and `git check-ignore` confirms the captures are ignored.

**Read-only paths honoured.** `backups/` was read from and never written
to; verified unchanged at the end:

```
backups/chrome-profile-basic-20260911-110129/
  1842 files, 270,807,537 bytes    (Task 005 recorded: 1842 files, 270,807,537 bytes)
```

`data/chrome-profile-v11-20260911-104559` was never touched. Nothing
went near Unraid 192.168.1.250 or `/Apps/marlin-iptv-editor`. No
installer ran. `accounts.google.com` was never navigated to and no
credential was ever typed — both arms landed **already signed in** from
the copied profile, so no arm ever needed a login.

**Throwaway harness** (scratchpad, deleted): `arm.sh` (copy + launch),
`gpuinfo.mjs` / `gpufeat.mjs` (`chrome://gpu`), `mi5.mjs`
(`chrome://media-internals`), `measure.sh` (identical measurement),
`health.mjs` (live-session check). ffmpeg/ffprobe were used **only as
measuring instruments**, as in Task 006.

**Cleanup, per step 11 — proven:**

```
throwaway profile copies remaining : 0
throwaway Chrome processes         : 0
listening ports                    : 127.0.0.1:9333 only  (9444/9445 gone)

$ ps -o pid=,etime= -p 76888
  76888  02:38:43
$ ss -tlnp | grep 9333
LISTEN 0 10 127.0.0.1:9333 0.0.0.0:* users:(("chrome",pid=76888,fd=88))
$ node health.mjs
LIVE SESSION HEALTH: {"signedOut":false,"playing":true,"res":"1920x1080",
                      "quality":"hd1080","webdriver":false}
$ bash -c '</dev/tcp/192.168.1.245/9333'
bash: connect: Connection refused
```

---

## (viii) Least certain

1. **That hardware decode is truly impossible here, rather than that I
   found the wrong switch.** The reasoning is structural — Chrome
   decodes via VAAPI, the only GPU is NVIDIA, no NVIDIA VAAPI driver
   exists anywhere on the filesystem — and I believe it. But I proved it
   by absence, and absence is the weakest kind of proof. I did not try
   `--use-gl=egl`, a Vulkan/ANGLE backend, or `__GLX_VENDOR_LIBRARY_NAME`
   to reach the NVIDIA GPU, because step 6 says not to iterate flags and
   because none of them supply the missing VAAPI driver. If someone
   later gets Chrome onto the NVIDIA GPU here, the compositing half of
   this report should be re-run; the decode half still could not be.

2. **That Arm 2's "no black" tells us anything about real GPU
   compositing.** Arm 2 flipped the accelerated-compositing *policy* on
   while the underlying GL stayed llvmpipe. Whether compositing on
   actual silicon — with the video layer promoted to a hardware overlay,
   which is the mechanism that can make a captured layer read back
   blank — behaves the same way is genuinely untested. I would not carry
   "compositing is safe" into the container on this evidence.

3. **That the two arms are comparable at all.** They recorded different
   live television three and a half minutes apart, and the run happened
   while the live Chrome was also signed in and playing on the same
   account. The binary result (picture, not black) is robust to that.
   Anything finer — the 0.3 fps gap, the 2.4 MB size difference — is
   not, and I would not read those numbers as measuring the GPU path.

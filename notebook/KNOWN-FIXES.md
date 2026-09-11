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

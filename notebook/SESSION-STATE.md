# SESSION-STATE.md

Updated 2026-09-11. This is a cold-start brief for the Marlin Cast
project. See DECISIONS.md for the standing rules that govern every
session.

---

## Where things stand

Nothing existed before 2026-09-11. Task 001 created the repo and the
scaffold; no application code beyond a single manual-login launcher
exists, and no capture code exists by design (Task 001 scope lock).

---

## Task 001 — kickoff: scaffold, login, investigation (2026-09-11)

Repo initialized on main at /Apps/marlin-cast, origin set to
https://github.com/marlin1111ai/marlin-cast.git (remote pre-existed and
was empty; not created by this task).

Scaffold: package.json pinned to exactly four dependencies —
playwright, express, typescript, tsx — plus .gitignore, a gitignored
data/chrome-profile/, and src/login.ts as the only file in src/.

Prerequisites all present on marlinpc: Node v22.23.2, ffmpeg 6.1.1,
git 2.43.0, Google Chrome 153.0.8010.36, /dev/dri with card0 and
renderD128. Recorded in the Task 001 report as command output.

**The live X display on this machine is :10, not :0.** :0 belongs to
the cosmic-greeter login screen; :10 is the xrdp Xorg session the
owner reaches with Jump Desktop. Anything that needs to put a window
in front of the owner uses DISPLAY=:10.

**Playwright drives the real Chrome successfully and YouTube TV serves
it the normal site** — no unsupported-browser wall, no bot wall, and
Widevine L3 (com.widevine.alpha, SW_SECURE_CRYPTO) is available.
Widevine L1 (HW_SECURE_ALL) is not. navigator.webdriver reports true.

**Two things did not happen and are not deferred quietly:**
MARLIN-CAST-BRIEF.md was never supplied, so D001–D006 are unrecorded
and notebook/BRIEF-v1.md does not exist. And the manual login (5e)
needs the owner at a Jump Desktop session, so login persistence and
the entire logged-in investigation (5f) are unobserved. The capture
comparison (5g) was completed by reading PrismCast's source and is
the substantive finding of this task.

See notebook/reports/task-001-kickoff.md.

---

## Task 001b — Chrome profile persistence diagnosed and fixed (2026-09-11)

The brief arrived. `notebook/BRIEF-v1.md` and D001–D006 are now
recorded verbatim, closing Task 001's only unfinished notebook items.

**The hand-login did not carry into Playwright, and the cause was not
the profile path** — both launches use the identical
`--user-data-dir=/Apps/marlin-cast/data/chrome-profile` and the same
`Default/` profile. Playwright injects `--password-store=basic`, so its
Chrome encrypts cookies with the hardcoded-key `v10` scheme while plain
Chrome uses keyring-backed `v11`. The `v10` Chrome cannot read `v11`
rows, drops them, and rewrites the store — which is what destroyed the
owner's session at 09:14:36.

Fixed by appending `--password-store=gnome-libsecret` to the Playwright
args in `src/login.ts` (Chrome honours the last repeated switch;
verified by controlled test). See KNOWN-FIXES.md for the trap.

**The old login is gone and cannot be recovered.** The owner must wipe
`data/chrome-profile` and hand-login once more — this time the app's own
Chrome window is keyring-backed, so logging in there is enough.

Playback, resolution and frame rate remain NOT OBSERVED; the Widevine
L3 → 1080p question is still open and still the biggest unknown.

See notebook/reports/task-001b-profile-persistence.md.

---

## Task 001c — cookie destruction ruled out locally (2026-09-11)

Reproduced the whole question on throwaway profiles with no Google
account, no login, no `accounts.google.com`.

**The 001b fix holds.** With `--password-store=gnome-libsecret`,
Playwright preserves every persistent cookie and leaves a profile
indistinguishable from what plain Chrome leaves — proven on github.com
(2 of 2 persistent rows kept, matching a plain-Chrome control exactly)
and on `.youtube.com` anonymously (9 of 9 persistent rows kept,
`__Secure-` ones included). Without the flag the same profile goes to
**0 rows**. The flag is load-bearing; `launchPersistentContext` does
**not** re-initialise the profile.

**So the session is not dying locally.** The owner's symptom — plain
Chrome also signed out afterwards — cannot come from a decryption
fault. The leading explanation is now **server-side invalidation by
Google** once the session is used from a browser it flags as automated.
That is inference from elimination, not a measurement, and it stays
labelled as such.

**CDP attach is the promising route.** `connectOverCDP` against a Chrome
started independently with `--remote-debugging-port` gives full
automation *and reports `navigator.webdriver === false`*, where
`launchPersistentContext` reports `true`. Playwright never owns the
profile, so the 001b trap cannot recur. Cost: we manage Chrome's
lifecycle, and the debug port is an unauthenticated local control
channel. Recommended to the owner; `src/login.ts` deliberately
unchanged pending his call.

Keyring is reachable and unlocked from both the SSH session and the
`:10` desktop session — same bus, same daemon, no silent fallback.

See notebook/reports/task-001c-cookie-destruction.md.

---

## Task 002 — CDP attach works; YouTube TV plays at 1080p (2026-09-11)

D009 recorded: the app attaches to an owner-launched Chrome
(`scripts/start-chrome.sh` + `connectOverCDP`) and never launches or
owns the profile. `src/login.ts` rewritten accordingly. Debug port
listens on 127.0.0.1:9333 only — refused on the LAN address.

**The hand-login held.** `navigator.webdriver` reads `false` under
attach (it read `true` under launchPersistentContext), and the session
survived six attach/detach cycles — `browser.close()` detaches without
killing Chrome.

**YouTube TV plays: 1920x1080 @ 59.96 fps, VP9 + AAC, ~43 Mbps, on
Widevine L3.** No wall of any kind. Task 001's worry that L3 might be
capped below 1080p is **closed** — L3 reaches 1080p.

Three things to carry forward:
- **1080p must be pinned explicitly.** The player serves 720p by
  default and stayed there through page fullscreen *and* a maximized
  window; only `setPlaybackQualityRange("hd1080","hd1080")` moved it.
- **The page has 40 `<video>` elements** and `querySelector("video")`
  returns an empty one. Use `#movie_player video.html5-main-video`.
- **16.7% of frames drop at presentation** — exactly 1/6, because this
  xrdp screen is 50 Hz and the content is 60 fps. Decode keeps up
  fine. Any capture benchmark on this display will under-report.

Deep link confirmed live: `https://tv.youtube.com/watch/<ID>?vp=<opaque>`,
guide at `/live`, 150 channels via `ytu-endpoint.tenx-thumb[aria-label]`.

Chrome (pid 70364) is deliberately left running with the session live.
Do not restart it without reason — the durability of the login across a
Chrome restart is the biggest untested question.

See notebook/reports/task-002-cdp-attach.md.

---

## Task 003 — the session survives a Chrome relaunch (2026-09-11)

**Yes, twice.** Graceful `SIGTERM` stop, restart via
`scripts/start-chrome.sh`, attach — `signed in` both times, with
`navigator.webdriver: false`. Playback after relaunch measured at
**1920x1080 @ 60.03 fps**. The fifth login was **not** spent; the
session is still live.

The cookie store came through **byte-identical**: 48 rows, all `v11`,
47 persistent, 17 auth-shaped, before and after. That is the clean
opposite of the 001b/001c signature (0 rows, or every tag flipped to
`v10`). D009's attach model needs no change to handle restarts.

**A verified backup of the logged-in profile now exists** at
`backups/chrome-profile-loggedin-20260911-101619/` — 1408 files,
214,080,533 bytes, file count and byte size both matched, gitignored
via a new `/backups/` line. It is the rollback path and the only copy
of a working logged-in profile. Never commit it.

**The untested gap that matters:** this proves a restart *in place*, not
that a **copied or moved** profile works — and a container start is the
second thing. Step 5e's restore test was scoped to the signed-out
branch and never ran. The backup exists so it can be tried without
risking the live profile.

**Docker warning, reasoned not measured:** every cookie is `v11`, the
gnome-libsecret scheme, and a stock container has no keyring. 001c
measured what a scheme mismatch costs (persistent rows 6 → 0). Either
the image provides a keyring, or the container commits to
`--password-store=basic` and takes its own hand-login in that scheme.

Two smaller observations: the guide enumerated **153** channels this
time against 150 in Task 002, so a channel list must not assume a fixed
count; and `SIGTERM` leaves `Singleton*` lock files behind, which
Chrome reclaims but a container supervisor should clear at startup.

Chrome is left running (browser pid 72933) with the session live.

See notebook/reports/task-003-relaunch-survival.md.

---

## Task 004 — a copied profile carries the session (2026-09-11)

**Yes.** Three arms on fresh copies of the backup — a plain copy, a copy
at a deeply different path, and a copy group-owned by `docker` at mode
770 — all attached and all read **SIGNED IN**, with cookie stores equal
to the baseline (48 rows, `v11`, 47 persistent, 17 auth-shaped). Copying,
relocating and re-permissioning a profile are all harmless. That closes
Task 003's biggest open question.

**One thing breaks it, totally: the password-store scheme.** Arm D
launched the same profile once with `--password-store=basic` and took it
from 48 rows / 17 auth cookies to **10 rows / 0 auth cookies**, all
`v10`, landing signed out. Chrome starts cleanly and warns about
nothing. **No supported migration exists** between `v11` and `v10` —
re-encryption needs decryption first, which is what fails.

**Consequence for Docker: the profile on this machine is not the profile
that will run in Docker.** A stock container has no keyring, so a `v11`
profile is unreadable there. Recommended (owner's call): use
`--password-store=basic` in the container and take the login in that
scheme — it removes the keyring entirely, and the keyring is the only
thing measured to destroy a session. A cheap alternative worth weighing:
switch `scripts/start-chrome.sh` to `basic` and spend one more
hand-login now, producing a profile that moves to Unraid unchanged.

**Still unknown:** uid. Arm C varied group and mode but not uid (needs
root; sudo forbidden), and a volume mount commonly presents a different
uid. That is the remaining portability gap.

Live session untouched: Chrome pid 72933 still alive and signed in,
cookie store still 48/`v11`/47/17. The backup is unmodified to the
nanosecond. All arm copies deleted.

See notebook/reports/task-004-profile-portability.md.

---

## Task 005 — converted to the basic (v10) scheme; login holds (2026-09-11)

D010 recorded. `scripts/start-chrome.sh` now passes
`--password-store=basic`; the adjacent rationale comment was updated to
match and cite D010 so it is not reverted.

**The conversion worked.** The old v11 profile was **moved, not
deleted**, to `data/chrome-profile-v11-20260911-104559` (verified intact
at 48/`v11`/47/17). A fresh hand-login on an empty profile produced
**46 rows, tags `v10`, 45 persistent, 17 auth-shaped** — the full auth
set, no keyring involved.

**No capability was lost:** TNT played at **1920x1080 @ 60.04 fps**,
Widevine still L3 (software granted, hardware denied). It started at
720p and needed `setPlaybackQualityRange("hd1080","hd1080")` — the Task
002 rule reproduced on a fresh profile.

**Two clean relaunches, both signed in**, cookie store unchanged at
46/`v10`/45/17 across both.

**New backup:** `backups/chrome-profile-basic-<ts>/` — 1842 files,
270,807,537 bytes, count and size matched, gitignored. **This is the
container-portable asset.** The two `v11` copies are machine-bound
fallbacks for this host only and are not a Docker asset.

**Docker blocker status:** the keyring problem is gone by construction —
there are no v11 rows left to fail on. Still untested: **uid** (needs
root or a container), and the fact that **no container has ever been
run** in this project.

See notebook/reports/task-005-basic-scheme.md.

---

## Task 006 — capture spike: DRM video captures, it is not black (2026-09-11)

D011 (capture via a `chrome.tabCapture` extension) and D012 (Unraid
Docker is the deployment target; marlinpc is development only) recorded.

**The make-or-break result is positive: Widevine-protected YouTube TV
video passes through `chrome.tabCapture` intact.** A 60-second TNT
recording produced a 20.4 MB WebM — 2560x1380, 30.01 fps, 61.69 s,
1851 frames, real moving picture (whole-frame luma 36–92, `blackdetect`
found nothing), real audio (mean −23.4 dB, peak −4.1 dB, no silence
≥1 s), audio 28 ms behind video at the start and 46 ms of drift across
the whole minute. Measured from the file, not from the recorder.

**Caveat that matters:** this was measured at Widevine **L3**, with
Chrome on Mesa `llvmpipe` and no GPU video path at all. That is exactly
where capture is expected to work. Hardware decode / L1 is the
configuration that classically returns black, and it is untested.

**`--load-extension` is dead on Chrome 153** — five controlled arms
(alone, with `--disable-extensions-except`, with
`--enable-unsafe-extension-debugging`, with
`--disable-features=DisableLoadExtensionCommandLineSwitch`, and with
both) every one reporting an empty `Extensions.getExtensions`. The
working route is the CDP command **`Extensions.loadUnpacked`** over the
existing loopback port — no extra flag, **no Chrome restart**.
`scripts/start-chrome.sh` gained a comment block recording this; its
`exec` line is byte-for-byte unchanged.

**`chrome.tabCapture` requires `activeTab`**, i.e. the extension must be
*invoked* on the tab. Over CDP that is `Extensions.triggerAction`, which
needs a **`tab` target, not a `page` target** (`Target.getTargets({filter:[{}]})`).

**Capture resolution follows neither the window nor the video.**
Unconstrained it is the *display* size — proven with the window measured
at 1219x1334 mid-recording and the file still 2560x1380. Constrained to
1920x1080 it is exactly 1920x1080. Default frame rate is 30; asking for
60 gave 38.6.

**Occluded capture is fine; minimized capture goes black** while audio
keeps running — a plausible-looking file with no picture. `Xvfb` is not
installed, so "a display nobody is connected to" is **not observed**.

MediaRecorder's default output is **VP8 + Opus in WebM** (source is VP9).
Encoding is **all software**: `prefer-hardware` is false for VP8, VP9,
H.264 and AV1; the host is an i9-14900KF (no iGPU) with an RTX 4070 Ti
SUPER that Chrome is not using.

**Live session untouched:** Chrome pid 76888 was never restarted, is
still signed in, still playing 1080p, `navigator.webdriver` still false.

See notebook/reports/task-006-capture-spike.md.

---

## Task 007 — GPU path vs DRM capture: not answerable on marlinpc (2026-09-11)

**The central question is still open, and now we know why it will stay
open on this machine.** Hardware video decode cannot be enabled in
Chrome on marlinpc at all: Chrome hardware-decodes on Linux only through
VAAPI, the only GPU here is the NVIDIA RTX 4070 Ti SUPER (the i9-14900KF
has no iGPU), and `nvidia_drv_video.so` is absent from the entire
filesystem. The VAAPI drivers that are installed are Intel/nouveau/AMD.

**Arm 1 (baseline software)** reproduced Task 006 on a copy of the
backup profile: 2560x1380, 29.91 fps, 61.68 s, picture present, no black
intervals, audio present. The copy-based harness is sound.

**Arm 2 (VAAPI flags) did not test what it was meant to.** `chrome://gpu`
went green and reported **"Video Decode: Hardware accelerated"** — and it
was not true. `GL_RENDERER` was still Mesa llvmpipe, `videoDecoding`
advertised no profiles, and `chrome://media-internals` read during
playback showed `kVideoDecoderName = "DecryptingVideoDecoder"` with
`kIsPlatformVideoDecoder = false` and `use_hw_secure_codecs: false`.
**`chrome://gpu` reports policy, not silicon** — `--ignore-gpu-blocklist`
removes the block, it does not conjure a decoder.

**Neither arm came through black.** Arm 2 did flip Canvas / Compositing /
Rasterization / WebGL to "Hardware accelerated" and capture was
unaffected — so *accelerated compositing on a software GL* does not black
the capture. Hardware decode remains untested, and Widevine stayed L3
throughout, which is exactly where capture is expected to work.

Step 6's decode-vs-compositing arm was **not run**: its trigger (Arm 2
black) did not fire.

**For the container:** marlinpc has a `/dev/dri` with no VAAPI driver
behind it, so **D007's premise that VAAPI can be tested during
development is not true on this host** — the black-frame risk moves to
first run on Unraid, where `iHD_drv_video.so` plus an UHD 770 is exactly
the configuration that could produce hardware decode and L1. Under D011,
`/dev/dri` is *not* a no-op: it could feed decode, MediaRecorder's own
encode, and compositing, all inside Chrome — no ffmpeg step exists yet.
Any container acceptance test should read
`chrome://media-internals` → `kIsPlatformVideoDecoder`, not the green
text on `chrome://gpu`.

**Live session untouched:** Chrome pid 76888, 2 h 38 m, signed in,
playing 1080p, port 9333 loopback only. Every throwaway copy deleted,
every throwaway Chrome killed, backup verified byte-identical at 1842
files / 270,807,537 bytes.

See notebook/reports/task-007-gpu-drm-capture.md.

---

## Task 008 — the pipeline: a channel streams end to end (2026-09-11)

D013 (full unfiltered lineup) and D014 (GPU decode deferred to Unraid)
recorded.

**It works.** `http://192.168.1.245:8804/playlist` serves a **144-channel**
M3U; requesting an entry tunes the live Chrome, pins 1080p, tab-captures,
and serves HLS. Pulled back over HTTP and measured from the received
file: **1920x1080 H.264 High + AAC-LC 48 kHz stereo, 29.97 fps, 70.13 s,
≈5.88 Mbps**, whole-frame luma 32–143 varying, **no black intervals**,
audio mean −26.9 dB with no silence ≥ 1 s. A/V drift −139.7 ms over 70 s.

**Real-time confirmed by direct measurement: 0.97x** (29 one-second
timeslices in 30 s wall), libx264 at ~86 % of one core. The pipeline
keeps pace with live TV on software encoding alone.

**Two defects found by measuring, both fixed.** `-use_wallclock_as_timestamps`
was overwriting the timestamps D011 exists to preserve and produced a
flood of non-monotonic DTS — removed. And ffmpeg, given VFR WebM with no
output rate pinned, guessed **50 fps** (this xrdp display's refresh rate)
and duplicated ~20 frames/s from a 30 fps capture — fixed with
`-fps_mode cfr -r 30`.

**Layout:** `Emulation.setDeviceMetricsOverride` forces a 1920x1080
viewport before capture, so the player fills the frame
(`box == viewport == 1920x1080`) instead of being pillarboxed inside this
2560x1267 non-16:9 display.

**D005 — switch, not refuse.** A request for a second channel tears down
the first and retunes; refusing would break every Channels DVR channel
change until an idle timeout expired. Verified: TNT → AMC swapped the HLS
directory, left **exactly one** ffmpeg encoder, and AMC came through at
1920x1080 with picture and audio.

**Stopping:** HLS is pull-based and gives no disconnect signal, so "client
gone" is a **20 s idle watchdog**. After the pull stopped: state idle,
**0 ffmpeg, 0 HLS directories**. No orphans in any arm.

**Dependencies added: none.** `src/cdp.ts` is ~80 lines over Node 22's
built-in WebSocket. One extension permission was widened —
`host_permissions: ["http://127.0.0.1:8804/*"]` — so the offscreen
document can POST timeslices to the server.

**Not observed:** reachability from a second machine (no other host used,
firewall not queryable without sudo); anything longer than ~2 minutes;
Channels DVR actually consuming it. Tune latency is **19–22 s**, which is
the most likely thing to make it feel broken in real use.

**Live session untouched:** Chrome pid 76888, never restarted, still
signed in and playing 1080p.

See notebook/reports/task-008-pipeline.md.

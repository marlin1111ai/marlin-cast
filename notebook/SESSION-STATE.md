# SESSION-STATE.md

Updated 2026-09-29. This is a cold-start brief for the Marlin Cast
project. See DECISIONS.md for the standing rules that govern every
session.

---

## Where things stand (2026-09-29, handoff after D036)

**2026-10-07 — the owner directs the work (no foreman; `CLAUDE.md`).** The
idle recon, D038, D039, D040 and `VERSION` 0.1.3 are **pushed** (2026-10-08,
on the owner's "push it" after the overnight check passed): parking YouTube
TV on `/library`, putting the Philo tab behind, parking on a cross-provider
switch and at server start. main → `bd0f90f` (verified with `git fetch` +
SHA comparison), then the tag `v0.1.3` on that commit. Both workflow runs
succeeded: GHCR `latest` = `sha-bd0f90f` (same digest) and `0.1.3`.
**Unraid now runs the 0.1.3 code** (`latest` = `sha-bd0f90f`; owner
force-updated on the morning of 2026-10-08 and reported it live); the QNAP
stays pinned to `sha-c876a3a`. Philo's guide seen in front on Unraid at
09:41 EDT turned out to be a click in the viewer; closed, no code change
("Closed 2026-10-08" at the end of this file). Marlin DVR uses only the
YouTube TV playlist (owner, 2026-10-08). Section "Recon idle / D038" at the end of this
file; report `notebook/reports/recon-idle.md`. One open item: the Philo
stuck overlay.

**Pushed.** main is pushed through the commit that records D036 (2026-09-29,
verified with `git fetch` + SHA comparison). The last code commit is 0f042a9
(task-033, D035 note; the station table only); it is the image `sha-0f042a9`,
which GHCR `latest` also points to (same digest). Also in GHCR:
`sha-1d307b1` (task-032, D035), `sha-13071d7` (task-031, D033),
`sha-c876a3a` (task-028) and the rollback tag `sha-e28689d`. Notebook- and
brief-only commits build no image (D025). `VERSION` is 0.1.2 (D036); no git
tag exists, so GHCR holds no `X.Y.Z` image tag.

**Deployed where:**
- **Unraid** (D026): container `marlin-cast` on `ghcr.io/marlin1111ai/marlin-cast:latest`
  with no size env, so 1080p (D028). Deployed 2026-09-13 at `VERSION` 0.1.1.
  Force-updated to `latest` = `sha-0f042a9` (D036, owner-confirmed
  2026-09-29): in Marlin DVR the guide is present and channels play;
  `docker stats` read 869.8 MiB after one tune. The memory recheck is closed
  on that reading; reopen if it climbs past 2 GiB (D036). App on host 8091,
  viewer on host 8092, `/mnt/user/appdata/marlin-cast/data` → `/data`,
  `--cap-add SYS_ADMIN --shm-size=1g`. Unraid served 367 channels (YouTube TV
  141, Philo 226) per the Marlin DVR report of 2026-09-28. marlinpc is
  dev-only (D012 fulfilled).
- **Consumer** (D036): Marlin DVR reads Marlin Cast directly through two
  sources, `/playlist/youtube-tv` and `/playlist/philo`, and takes its guide
  from Schedules Direct joined by `tvc-guide-stationid` (D035). This updates
  D026's 2026-09-13 note that the editor used the single `/playlist` source.
- **QNAP** (the owner's father's, second install): Container Station
  application pinned to `ghcr.io/marlin1111ai/marlin-cast:sha-c876a3a` (the
  owner's choice, D036) at 720p (`MC_WIDTH=1280` `MC_HEIGHT=720`, no
  `MC_XVFB_SCREEN`), so it has neither the D033 memory fix nor the D035
  station ids. Total CPU ~33% against 97.4% at 1080p (D028 note); WBAL 11 and
  Philo History both play at normal speed (owner). `/dev/shm` reads 1.0G
  there. WBAL 11 seen about 6 hours behind live once, not pursued (D034).

**Since D031:** the Chrome memory recon closed at 12 of 20 cycles (D032); the
browser process's per-tune step is gone with a forced collection on the
extension's offscreen document every 60 s and at stop (D033); every playlist
line with a credible station carries `tvc-guide-stationid` from
`src/stations.json`, built on the owner's Schedules Direct lineups — 217
entries, 217 of 375 lines on the marlinpc test enumeration (YouTube TV 128 of
141, Philo 89 of 234) (D035 and its note); every item the recon and tasks
030–033 left for the owner is closed, each with file:line (D036).

**Closed, not pursued, reopen if seen:** D029, D030, D031 (2026-09-26); D032
and D034 (2026-09-28); D036 (2026-09-29). **No open items are left.**

**Parked, unchanged:** Fios (notebook/reports/fios-splash.md); stale-watch-id
detection (D020 note); the Channels DVR playback defect (D016).

**marlinpc** (checked 2026-09-29): no Marlin Cast container, image or process;
the builder's scratchpads are empty; the builder's leftover files are deleted
and three recordings a report names are kept in `data/captures/`
(notebook/reports/handoff-2026-09-29.md). The backup's sha256 is unchanged:
`6ebd9ea976118bcb8c24e10b590680e5d44e405d1b3a9f7f09a0a3982258dbe3`.

The task records below are the history, oldest first.

---

## Task 001 — the starting point (2026-09-11)

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

**Note (2026-09-26):** closed by D029.

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

**Note (2026-09-26):** closed by D029.

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

**Note (2026-09-26):** closed by D030.

**Live session untouched:** Chrome pid 76888, never restarted, still
signed in and playing 1080p.

See notebook/reports/task-008-pipeline.md.

---

## Task 009 — Channels DVR played nothing: it was CORS (2026-09-11)

**Diagnosed, reproduced, fixed, verified.** Marlin Cast sent no
`Access-Control-Allow-Origin` on the playlist or segments and answered a
CORS preflight with `404`. A server-side puller — ffmpeg, curl, Channels
DVR's own remuxer — is unaffected, which is exactly why Channels could
report `Remux Starting: 17s @ 1.04x` while the picture stayed black. A
**browser** player fetches the playlist with XHR/fetch and the browser
refuses to hand it the response.

Reproduced with hls.js (the library behind Video.js, whose
"The media could not be loaded…" string is what the owner saw):

| hls.js, cross-origin, CORS enforced | before | after |
|---|---|---|
| | FATAL `manifestLoadError`, 0 frames | **PLAYING, 739 frames, 0 errors** |

The control that settles it: identical stream, identical player, browser
started with `--disable-web-security` → **plays**. Only the browser's
willingness to read a cross-origin response changed.

**Three validators disagreed, and that disagreement was the diagnosis:**
ffprobe accepted it; GStreamer `hlsdemux` reached PLAYING with 0 errors;
hls.js could not read the manifest at all.

**The media was never the problem.** Every segment: h264 High Level 4.0
1920x1080 + AAC-LC 48 kHz stereo, 60 video packets, exactly one keyframe,
**starts with an IDR**, PTS continuous across every boundary
(1.4667 → 3.4667 → 5.4667 → …). Sliding window confirmed
(MEDIA-SEQUENCE 72 → 74 → 77, six entries). EXTINF 2.000000 against
TARGETDURATION 2.

**Fix, in `src/server.ts` only:** CORS middleware + `OPTIONS` preflight
(the named cause), and segments served via `res.sendFile` so `Range` is
honoured — it previously answered `Range: bytes=0-99` with `200` and the
whole file. Segments also gained immutable `cache-control`.

**Post-fix, 65 s pulled and measured from the output:** 1920x1080 H.264
High L4.0 + AAC-LC, **30.02 fps**, 65.00 s, 6.18 Mbps, luma 28–182
varying, **no black intervals**, audio mean −24.6 dB, 0 silent runs,
**A/V drift +1.7 ms over 65 s**. First-request latency **21.12 s** —
unchanged; the fix does not touch it.

**Ruled out by measurement:** codec/profile/level, resolution, frame
rate, keyframe alignment, segment independence, PTS/DTS continuity,
missing streams, target-duration mismatch, playlist syntax, Content-Type.
The 19 s blocking first request and the one-segment cold-start window are
**real but not fatal** (hls.js survived both) — left alone deliberately,
raised as questions.

**Only Channels DVR can confirm the last step:** whether its player
fetches Marlin Cast's URL directly (CORS applies, this is the cure) or
plays a remuxed copy from its own origin (something else is wrong). The
container was never queried, per the scope lock.

**Also spotted, not fixed (tune path was out of scope):** the server log
recorded `[tune] Freeform {"ok":true,"quality":"hd720","video":"0x0"}` —
a tune reporting success at 720p with a stale video element reference.

Live session untouched: Chrome pid 76888, never restarted, signed in,
playing 1080p.

See notebook/reports/task-009-hls-compliance.md.

---

## Task 010 — PrismCast diff: CORS was never the cause; latency is (2026-09-11)

**Correction to Task 009, measured directly: PrismCast sends NO CORS
headers and plays fine in the same Channels DVR player.** A GET carrying
`Origin: http://192.168.1.250:8089` comes back with no
`Access-Control-Allow-Origin`. Channels' player does not need CORS, so
Task 009's fix — a real defect fix for direct browser access — was not
the cure for this bug.

**The difference that survives is time.**

| cold request -> playlist with a playable segment | |
|---|---|
| PrismCast | **5.222 s** |
| Marlin Cast (before) | **19.355 s** |

Instrumented split of our 19.35 s: **14.17 s tune path** (almost exactly
the three hardcoded sleeps, 9000+1500+3500 ms) **+ 5.12 s HLS output**.
The failure is timeout-shaped: the patient component (Channels'
server-side remuxer) succeeded and ran at 1.02x for 31 s; the impatient
one (the player) gave up at ~15 s, when our server had returned nothing.

**Ruled out by the diff, not by argument** — PrismCast does all of these
and works: no CORS, no Range support (200, not 206), single-level media
playlist with no master, and a **one-segment cold window**. Both are
single-level; neither serves `EXT-X-STREAM-INF`.

**Real but unacted differences:** container **MPEG-TS vs fMP4/CMAF**
(PrismCast: `EXT-X-MAP`+`init.mp4`+`.m4s`, `EXT-X-VERSION:7`) and profile
**High/4.0 vs Constrained Baseline/4.2**. Not changed — Task 009 showed
hls.js decodes our TS to 739 frames with zero errors, so a format the
player demonstrably decodes is not why it refuses to start.

**Fixed (HLS output path + server only):** `-hls_time 1`, `-g 30
-keyint_min 30`, `-tune zerolatency`, `-hls_list_size 10`,
`+program_date_time`; and segment `cache-control` `immutable` →
**`no-cache`**. That last is a defect Task 009 introduced — segment URLs
are reused because every tune wipes the directory and ffmpeg restarts at
`seg00000.ts`, so a year-long immutable cache could serve stale media on
exactly the retune the owner performed.

**Result: 19.35 s → 16.72 s.** hls.js cross-origin under enforced CORS:
PLAYING, 647 frames, 0 errors. 65 s pulled and measured: 1920x1080 H.264
High L4.0 + AAC-LC, 30.02 fps, 64.97 s, 6.27 Mbps, **65 keyframes in
1950 frames** (1 s GOP confirmed), luma 48–132 varying, no black
intervals, audio mean −29.9 dB, 0 silent runs, **A/V drift +13.7 ms over
65 s**.

**STOP / QUESTION RAISED:** 14.17 s of the remaining 16.72 s is three
hardcoded sleeps in the tune path, which step 7 forbade touching without
asking. Replacing them with polls should reach ~6–8 s, comparable to
PrismCast. **Not done — awaiting the owner.** Honest expectation: the
retune probably still fails at 16.72 s.

720p pin defect seen again and left alone as instructed:
`[tune] ESPN {"ok":true,"quality":"hd720","video":"0x0","box":"0x0"}`.

Live session untouched: Chrome pid 76888, never restarted, signed in.

See notebook/reports/task-010-prismcast-diff.md.

---

## Task 011 — tune-path sleeps replaced with polls: 16.72 s -> 4.05 s (2026-09-11)

Owner approved touching the tune path. All three fixed sleeps
(9000/1500/3500 ms) are gone, replaced by **four named polls**, each with
a 250 ms interval, a hard timeout, and a loud named failure carrying the
last probe:

| # | poll | condition actually waited on | timeout |
|---|---|---|---|
| 1 | `navigation` | `location.href` contains the channel's video id **and** `#movie_player` exists; aborts immediately on SIGNED OUT | 30 s |
| 2 | `layout override` | `innerWidth===1920 && innerHeight===1080` — the override reached layout | 10 s |
| 3 | `player ready` | `videoWidth>0 && !paused && readyState>=2` (the old page-side loop, kept as a named stage) | 30 s |
| 4 | `quality pin` | `getPlaybackQuality()===target` **and** real dimensions matching it | 20 s |

**Cold tune latency, six channels, genuinely cold each time:**

| | before | after |
|---|---|---|
| TNT / ESPN / AMC | 16.72 s | 3.990 / 3.930 / 3.946 s |
| CNN / HGTV / Food Network | 16.72 s | 4.217 / 3.845 / 4.359 s |

**Worst case 4.359 s, mean 4.048 s — every channel beats PrismCast's
5.222 s.** The tune path itself went **14.17 s -> 1.38–1.92 s**. The old
9000 ms sleep stood in for a condition met in ~620 ms; the 3500 ms
post-pin sleep for one met in 2–7 ms.

**The 720p defect was two things, and one is not a defect.**
(a) The old code measured a STALE video element after the pin, hence
`0x0` — poll 4 re-queries the element every iteration, and not one tune
reported 0x0 this task. (b) **ESPN genuinely has no 1080p rendition** —
it advertises only `["hd720","large","medium","small","auto"]`.

My first implementation demanded hd1080 unconditionally and **made ESPN
untunable** (HTTP 503 after a 23.47 s timeout) — worse than the bug, and
on the exact channel the owner tested. Poll 4 now targets the best level
the channel advertises at or below hd1080, waits for it to actually be
reached with matching dimensions, and warns loudly when below 1080p:
`[tune] ESPN WARNING: channel offers no hd1080 — settled at hd720`.
`/health` gained a `quality:` line so this is visible without logs.
**Flagged: this is a deliberate proceed-anyway for sub-1080p channels;
one line to make it hard-fail if the owner prefers.**

**Note (2026-09-26):** closed by D030.

**1080p held on 5 of 6** (TNT, AMC, CNN, HGTV, Food Network all
hd1080/1920x1080); ESPN at hd720/1280x720 by the channel's own ceiling.

**Switch still correct:** TNT -> AMC in 3.97 s, TNT's hls dir removed,
**exactly one encoder**.

**Verified:** hls.js cross-origin under enforced CORS — PLAYING, 737
frames, 0 errors. 65 s pulled and measured: 1920x1080 H.264 High L4.0 +
AAC-LC, 30.02 fps, 64.97 s, 6.28 Mbps, luma 26–65 varying, no black
intervals, audio mean −24.7 dB, 0 silent runs, A/V drift −11.7 ms.

Nothing on Unraid was contacted this task. Live session untouched:
Chrome pid 76888, never restarted, signed in.

See notebook/reports/task-011-tune-latency.md.

---

## Task 012 — HLS output switched from MPEG-TS to fMP4/CMAF (2026-09-11)

**Why:** the owner retested after task-011. Channels DVR's "Remux
Starting" went from 31 s to 8 s — the faster source reached it — and the
player **still failed**. Latency joins CORS as a cause eliminated by the
real player (both recorded in KNOWN-FIXES). What remains of the task-010
diff is the media: container and profile. This task changed the
container only.

**Done, two files.** ffmpeg's segmenter now writes an fMP4 init segment
plus `.m4s` fragments (`-hls_segment_type fmp4 -hls_fmp4_init_filename
init.mp4`, segment name `seg%05d.m4s`); the server serves `init.mp4` and
`.m4s` as `video/mp4`. Codec (H.264 High L4.0 + AAC-LC), resolution,
frame rate, bitrate, 1 s segments, 10-segment window, CORS, the 20 s idle
watchdog, the `/playlist` URL and the per-channel stream URLs are all
unchanged — Channels' source needs no edit.

**Verified live on the owner's Chrome (pid 76888, never restarted):**
cold ESPN tune **4.096 s** to a playlist carrying a playable segment
(task-011 method; task-011 measured 3.930 s for ESPN under TS). Playlist
is `#EXT-X-VERSION:7` with `#EXT-X-MAP:URI="init.mp4"` and `.m4s`
entries. ffprobe on init+segment: `ftyp`+`moov` (two `trex`) then
`styp`+`sidx`+`moof`+`mdat`, H.264 High L4.0 1920x1080 30 fps + AAC-LC
48 kHz stereo, one IDR at the head of every 30-frame segment. hls.js
1.5.13 cross-origin under enforced CORS: PLAYING, 605 decoded frames,
0 dropped, 0 errors. 30 s pulled: continuous at 30.04 fps, luma varying,
no black, audio present, A/V skew +16.7 ms. Idle stop still clean: 0
ffmpeg, 0 HLS directories.

**New in the log:** the mp4 muxer's `Packet duration: -192 … out of
range` audio warning at ~1 in 15 segment boundaries — absent under TS,
harmless on every measurement, recorded in KNOWN-FIXES, not acted on.

**Not done, by scope:** H.264 profile still High (PrismCast: Constrained
Baseline). If fMP4 alone does not make Channels' player start, the
profile is the last item on the task-010 diff.

Committed on main, **not pushed**. Server left running on 0.0.0.0:8804
for the owner's Channels DVR test. Nothing on 192.168.1.250 was
contacted this task.

See notebook/reports/task-012.md.

---

## Task 013 — read-only recon against PrismCast, tag by tag (2026-09-11)

Owner supplied Channels DVR log lines: for our ESPN stream `[M3U] stream
timestamps: … start_at=2026-09-11T18:52:30-04:00 end_at=<same>
live_delay=3s`, session stopped after 12 s with `first_seq=1 last_seq=1`;
for PrismCast AMC no timestamps line, 30 s to `last_seq=16`.

**Finding:** the one tag carrying timestamps is where we differ from the
reference in two ways at once. ffmpeg writes `EXT-X-PROGRAM-DATE-TIME` as
`…T18:57:08.959-0400` (not RFC 3339 — Go 1.27 `time.RFC3339` rejects it)
and places it after `#EXTINF`; PrismCast writes `…T22:57:42.736Z` before
`#EXTINF`. PrismCast's segments are **fMP4** (`moof` first byte, no TS
sync byte), Constrained Baseline L4.2, two fragments per segment, no
`styp`/`sidx`, no edit lists; it starts every session at MEDIA-SEQUENCE
15 behind an `EXT-X-DISCONTINUITY`. Neither M3U carries any catchup or
time attribute. ffmpeg's own hls demuxer read both streams 30 s clean.
Ranked candidates and full captures in notebook/reports/task-013.md.
No changes, no commit at the time; report saved at the start of task-014.

---

## Task 014 — PROGRAM-DATE-TIME as RFC 3339 UTC, before EXTINF (2026-09-11)

**Done, one source file.** The media playlist is rewritten at serve time
in `src/server.ts`: each `EXT-X-PROGRAM-DATE-TIME` is converted to the
same instant in UTC with a trailing `Z` and millisecond precision and
moved to immediately precede its segment's `#EXTINF`, matching
PrismCast's layout. **Muxer flags could not do it** — libavformat's
format is hard-coded `%s.%03d%s` with a strftime `%z` suffix and the tag
is always written after `EXTINF`; `TZ=UTC` would only yield `+0000`.
ffmpeg's command line is untouched; VERSION, TARGETDURATION,
MEDIA-SEQUENCE, INDEPENDENT-SEGMENTS, MAP, durations, window and
discontinuity handling are byte-for-byte as task-012 left them.

**Verified live (owner's Chrome pid 76888, never restarted):** cold ESPN
tune 4.31 s; served `2026-09-11T23:15:05.977Z` against ffmpeg's raw
`2026-09-11T19:15:05.977-0400` — **0 ms difference**, and 0.48 s before
the cold response; Go 1.27 `time.Parse(time.RFC3339)` **OK** on the
emitted value, still ERR on the raw one. hls.js 1.5.13 cross-origin:
PLAYING, 604 frames, 0 dropped, 0 errors. 30 s ffmpeg pull: 31 segments,
900 frames at 30.03 fps, every PTS step exactly 33.3 ms, A/V skew
+30 ms, no warnings, no black, no silence.

Committed on main with the task-013 report, **not pushed** (task-012's
74e09c1 is also still unpushed). Server left running on 0.0.0.0:8804 for
the owner's Channels DVR test. Nothing on 192.168.1.250 was contacted.

See notebook/reports/task-014.md.

---

## Task 015 — recon: Channels' last_seq=1 not reproducible locally (2026-09-11)

New owner-supplied evidence: after task-014, Channels' `[M3U] stream
timestamps start_at=end_at` is logged *before* `[TNR] Opened
connection`, so it is not derived from our media playlist — dropped as a
lead. Our ESPN session ran 31 s, `first_seq=1 last_seq=1`; PrismCast AMC
reaches `last_seq=16` in 30 s.

**A local ffmpeg 6.1.1 stream-copy segmenter cuts our stream into 16–17
segments in every configuration** (live pull, deterministic file, fMP4,
MPEG-TS, mpegts-first, sync-flags flipped, static playlist), same as
PrismCast's 16. `last_seq=1` did not reproduce outside Channels. The one
concrete media difference from the reference: our keyframe samples carry
**no in-band SPS/PPS** (params only in the init avcC); PrismCast repeats
them before every IDR. ffmpeg's mpegts muxer auto-injects them, so it is
uncertain whether Channels trips on this, but it is the cleanest
one-line lever and the biggest media difference. Full ranking and
captures in notebook/reports/task-015.md.

---

## Task 016 — repeat SPS/PPS in-band at every keyframe (2026-09-11)

**Done, one line.** `src/capture.ts` gained `-x264-params
repeat-headers=1` in the libx264 args; nothing else changed — profile
High, `-g 30 -keyint_min 30 -sc_threshold 0`, zerolatency, `-hls_time 1`,
fMP4, and the task-014 playlist rewrite are all exactly as they were.

**Verified live (owner's Chrome pid 76888, never restarted):** three
consecutive keyframe samples read from the actual `mdat` are now
`(6,7,8,6,5,…)`, `(7,8,5,…)`, `(7,8,5,…)` — SPS + PPS in-band before the
IDR, where before they were `(6,5,…)`. The init `avcC` still carries 1
SPS + 1 PPS. ffprobe: profile High, level 40, `has_b_frames=0`, keyframe
spacing exactly 1.000 s (12 in 12 s). hls.js 1.5.13 cross-origin, CORS
enforced: PLAYING, 606 frames, 0 dropped, 0 errors. 30 s ffmpeg pull:
exit 0, 31 segments, continuous — the only warnings are the pre-existing
"Found duplicated MOOV Atom" from the live EXT-X-MAP reload (task-015),
no new class. Cold tune 4.317 s (task-011 method).

Committed on main, **not pushed** (74e09c1, 953b6cd also still unpushed).
Server left running on 0.0.0.0:8804 for the owner's Channels DVR test.
Nothing on 192.168.1.250 was contacted.

See notebook/reports/task-016.md.

---

## Task 017 — tvc-guide-stationid on ESPN only (test sliver of D015) (2026-09-11)

**Done, one line in the /playlist generator.** The ESPN entry the owner
tunes in every test (channel id `MrXg0chrojg`) now carries
`tvc-guide-stationid="32645"` — PrismCast's own Gracenote station id for
ESPN, read live from its /playlist. Every other attribute on that entry
(tvg-id, tvg-name, tvg-logo, group-title) is unchanged, and every other
channel's entry is untouched, including the three other channels also
named "ESPN" (gaT2Q_KZxns, arlkwb9_uTw, n33BiPboLfo), which get no
station id.

**Why a test sliver:** D006 says guide data comes from Channels' own
Gracenote matching and Marlin Cast produces no XMLTV. PrismCast
nonetheless ships an explicit `tvc-guide-stationid` per channel. This
task adds it to one channel only to see whether Channels' behaviour
changes, without committing to a mapping table for 144 channels. **Note:
there is no D015 recorded in DECISIONS.md yet** — the brief refers to it
as the decision this is a sliver of; it remains to be written by the
owner. Hardcoded, no mapping/file/config (task scope).

**Verified live (server restarted, owner's Chrome untouched):** /playlist
still 144 channels (289 lines, unchanged); exactly one
`tvc-guide-stationid` in the whole playlist; the full prior-vs-new diff
is a single line (the ESPN #EXTINF). Our new ESPN line and PrismCast's:

```
ours: #EXTINF:-1 tvg-id="MrXg0chrojg" tvg-name="ESPN" tvg-logo="…=ns-nd" group-title="YouTube TV" tvc-guide-stationid="32645",ESPN
pc:   #EXTINF:-1 channel-id="espn" group-title="Sports" tvg-name="ESPN" tvc-guide-stationid="32645",ESPN
```

Committed on main, **not pushed** (ea788bb, 953b6cd, 74e09c1 also still
unpushed). Server left running on 0.0.0.0:8804 for the owner's Channels
DVR test. Only PrismCast's /playlist on 5589 was fetched; nothing else on
192.168.1.250.

See notebook/reports/task-017.md.

---

## Task 018 — park the capture tab on the live guide after an idle stop (2026-09-11)

**Done, `src/capture.ts` only.** When the 20 s idle watchdog fires and the
encoder is torn down, `stop()` now navigates the capture tab to
`https://tv.youtube.com/live` so no channel keeps playing while nobody is
watching. The navigation is gated by a new `stop(reason, { returnToGuide })`
option, passed only from `checkIdle`; a channel switch (which navigates
straight to the next channel) and shutdown do not park. The idle value,
the tune path, and the encoder/playlist settings are unchanged.

**Step 2:** the next tune works unchanged from the guide — `start()`
always navigates to the channel URL and poll 1 waits on `location.href`
containing the channel id plus `#movie_player`, assuming nothing about
the prior page. No code change was needed there.

**Verified live (server restarted, owner's Chrome never restarted):**
tuned ESPN, pulled 10 s, stopped, waited 25 s. Server log shows
`[stop] parked capture tab on the live guide`. A read-only in-page eval
reported tab URL `https://tv.youtube.com/live`, the
`#movie_player video.html5-main-video` element present but **paused,
readyState 0, 0x0** — nothing playing — with 0 ffmpeg and 0 HLS
directories. Re-tuning ESPN from the guide: **4.212 s** (baseline ~4.3 s;
task-016 4.317 s), tune-ms nav=644. Left idle with the tab parked on the
guide again for the owner's Channels DVR test.

Committed on main, **not pushed** (53651b2, ea788bb, 953b6cd, 74e09c1
also unpushed). Nothing on 192.168.1.250 was contacted.

See notebook/reports/task-018.md.

---

## Task 019 — remove EXT-X-PROGRAM-DATE-TIME from the media playlist (2026-09-11)

**Done, one flag in `src/capture.ts`.** `program_date_time` is gone from
the ffmpeg `-hls_flags` (now `delete_segments+independent_segments+temp_file`),
so no `EXT-X-PROGRAM-DATE-TIME` line is written. Every other encoder,
muxer, and playlist setting is unchanged. The task-014 serve-time rewrite
in `src/server.ts` is left in place, now a no-op (no PDT lines to fix).

**Why:** with guide data present (task-017), Channels still logged
`[M3U] stream timestamps start_at=end_at` before `Opened connection` and
still stopped at `last_seq=1`. The working theory: Channels pre-fetches
the media playlist and reads the first and last PROGRAM-DATE-TIME, which
on a cold one-segment playlist are equal → a zero window. Removing the
tag removes those two equal values.

**Verified live (server restarted, owner's Chrome never restarted):**
cold and +5 s playlists carry **no PROGRAM-DATE-TIME** (0 occurrences),
everything else unchanged (VERSION 7, TARGETDURATION 1, MEDIA-SEQUENCE 0,
INDEPENDENT-SEGMENTS, MAP, EXTINF 1.0, .m4s). hls.js cross-origin, CORS
enforced: PLAYING, 604 frames, 0 dropped, 0 errors. 30 s ffmpeg pull:
exit 0, 31 segments, continuous — only the pre-existing duplicated-MOOV
warnings (task-015 EXT-X-MAP reload artifact), no new class. Cold tune
**4.228 s** (baseline ~4.3 s). Left idle with the tab parked on the guide
(task-018).

Committed on main, **not pushed** (ded91c6, 53651b2, ea788bb, 953b6cd,
74e09c1 also unpushed). Nothing on 192.168.1.250 was contacted.

See notebook/reports/task-019.md.

---

## Task 020 — deployment decision recorded; main pushed (2026-09-11 evening)

**Two decisions recorded in DECISIONS.md.** D016: Marlin Cast is consumed
by Marlin DVR via Marlin IPTV Editor (playlist + guide from the editor),
confirmed playing on Apple TV; PrismCast stays the Channels DVR source;
the Channels playback defect (one output segment then stall) is **parked,
not fixed** — tasks 009–019 ruled out CORS, tune latency, container,
PROGRAM-DATE-TIME format and presence, in-band SPS/PPS, and guide data;
untested remaining differences are the 1 s segments / TARGETDURATION 1 and
MEDIA-SEQUENCE restarting at 0 with no DISCONTINUITY. D015: station-ID
guide matching via `tvc-guide-stationid`, name→ID pairs sourced from
PrismCast's /playlist with a hand mapping as fallback — only the task-017
ESPN test sliver is built.

**main pushed to origin.** The six previously-unpushed task commits
(012, 014, 016, 017, 018, 019) plus this task's commit — seven in all —
are now on `origin/main`. Nothing left unpushed.

**The dev server is left running on 0.0.0.0:8804** for Marlin DVR use,
idle, with the capture tab parked on the live guide (task-018). The
owner's Chrome (pid 76888) is untouched.

See notebook/reports/ for the per-task reports; this task added no report
(decision + push only).

---

## Task 021 — Philo as a second provider (2026-09-12)

**Shipped.** Marlin Cast now serves two providers. `/playlist` carries 145
YouTube TV entries then 226 Philo entries (`group-title="Philo"`), 371 in
all; a Philo channel tunes, plays at the live edge, and captures.

**Decisions recorded (D017–D019).** D017: Philo is a second provider,
superseding D002's "one provider to start"; Philo tops out at 1280×720 under
Widevine L3 and is upscaled into the 1920×1080 capture as ESPN is; D005
means one *tune* at a time, and two logged-in sessions in the one profile is
normal. D018: one tab per provider, selected by URL host, no fallback to
"any page", `fatal: no <provider> tab open` if it is missing. D019: the
whole Philo guide, all three tiers, unfiltered.

**Structure.** Everything provider-specific now lives in `src/providers/`
(`types.ts`, `youtubetv.ts`, `philo.ts`, `index.ts`). A grep for
`tv.youtube.com|philo.com|movie_player|setPlaybackQualityRange|html5-main-video|tenx-thumb|SIGN IN|video#video`
over `src/` outside that directory returns nothing. YouTube TV was **moved,
not rewritten**: enumerate body, poll 1, poll 3, poll 4 and the ffmpeg
argument list are all identical to `HEAD`.

**Philo mechanics, all measured:** the lineup is the guide's own persisted
`page` GraphQL query re-issued in the page with the page's own session,
paged on `groups.pageInfo` (5 requests, ~1.4 s, 226 rows = `totalCount`);
logo is `colorSquare` with `${width}` filled with 400; a tune resolves the
currently-airing Broadcast id from the channel's `tileGroupId` (opaque and
server-validated, so it is carried from enumeration, not derived) and
navigates straight to `/player/player/broadcast/<id>`.

**Two things the recon had not seen, both found here and both fixed:**

1. **Direct navigation does not land at the live edge** — it starts at the
   beginning of the DVR availability window. Measured 2 h 05 m behind wall
   clock on AMC. Fixed by assigning a `currentTime` past the seek range and
   letting the page's own player clamp to live.
2. **Philo's control overlay was being burnt into every captured frame.**
   The click that satisfies Chrome's autoplay policy also shows the
   controls, and Philo arms the auto-hide timer from a `mousemove` handler
   only — so a tune that clicks and never moves the pointer leaves the
   title, scrubber, START OVER, LIVE and the button row on the picture
   indefinitely (49 of 49 samples across a 5.7-minute capture). Tab capture
   and tab activation were both eliminated by single-variable tests first.
   Fixed by sweeping the pointer and polling the overlay's own state
   classes until they clear, warning loudly if they do not. **This fix is
   the least certain part of the task** — one tune cleared after 1 sweep,
   another needed 3, an earlier single-sweep version failed.

   **Note (2026-09-26):** closed by D029.

**Verified live** (server restarted, owner's Chrome pid 174888 never
restarted, no tab ever closed): `/playlist` YouTube TV section byte-identical
to the pre-change baseline (same md5, run as a code-isolation diff);
226 Philo = `totalCount`; a 330 s Philo capture in 165 segments with zero
errors, H.264 High L4.0 1920×1080 + AAC-LC, the overlay clear in all 69
samples; provider switching drives the tab matching the host each way and
leaves the other alone; hd1080 still reached on YouTube TV channels that
advertise it (TNT, USA, Discovery Channel); idle stop parks only the tab it
drove; a provider with no tab fails loud with a 503 and
`fatal: no philo tab open`; `GET /` renders with both copy buttons verified
against the clipboard.

**Two facts that are lineup drift, not regressions:** YouTube TV enumerated
**145** channels today against 144 yesterday (3 ESPN ids rotated, NBCSN
Extra added, 138 logo URLs refreshed), and ESPN still advertises no
`hd1080` — the recorded task-011 property of that channel.

**Not done, deliberately:** no Philo `tvc-guide-stationid` mapping (step 10
was a read-only check; 28 exact name matches are recorded in the report),
`scripts/capture-spike.mjs` untouched, `extension/` untouched,
`scripts/start-chrome.sh` updated but **not executed** — the owner runs it at
the next Chrome launch, and until then the Philo tab is the one already
open.

**Biggest open question:** a programme boundary *inside* a running capture
is untested. The boundary was handled correctly between tunes (2012 → The
Perfect Storm), but a capture still running when its broadcast ends may
stop. Test that on a long recording before trusting Philo for a DVR job.

**Note (2026-09-26):** closed by D029.

See notebook/reports/task-021.md.

---

## Task 022 — stable stream URLs keyed on stationId / channelId (2026-09-12) — STOPPED at V5

**Decisions recorded:** D020 (stream URL key = YouTube TV guide `stationId` or
Philo `channelId`; the watch/broadcast id is resolved at tune time), D021
(`/playlist/youtube-tv`, `/playlist/philo`), D022 (discrete duplicate-name feeds
named `<name> (event N)`), plus notes under D013 (browse-only guide rows are not
channels) and D015 (ESPN sliver re-keyed to `UCW7W_WAogi3qWDbO9PqOmZQ`).

**Built (uncommitted at stop):**
- YouTube TV enumeration reads the guide page's own `/youtubei/v1/browse`
  response (`contents.epgRenderer…contents[N].epgRowRenderer`) and joins it to
  the rendered tiles on the watch id.
- `data/channels.json` carries `key` (plus `discrete` and `position` for YouTube TV).
- The router, HLS directory, ingest, `byKey` and the cross-provider duplicate
  check are keyed on `key`.
- The playlist writer emits `tvg-id` = key, `/stream/<key>/index.m3u8`, D022
  names, the D021 routes and the re-keyed D015 line.
- The status page shows the tuned key.
- A poll-1 miss on YouTube TV re-reads the guide once and retries once.

**Verified live:**
- **V1:** baselines saved.
- **V2:** 144 YouTube TV channels from 151 guide rows. 7 rows skipped: Univision 8
  had no watch link in this read, and ESPN 26, NBCSN Extra 30–32, Cartoon Network 46
  and WNBA on ION 133 are browse-only. Philo 226; all 370 keys distinct.
- **V3:** 289 + 453 = 741 lines. No watch or broadcast id in any URL.
  `ESPN (event 1…3)` present, and row 17 carries `32645`.
- **V4:**
  - real ESPN by key: 125 s, hd720 (ESPN has no hd1080, task-011)
  - ESPN event 1: 125 s
  - Philo AMC: 125 s
  - TNT: hd1080 reached
  - every idle stop was clean
- **V7:** screenshot taken.

**STOP — V5 failed.** A rotated event watch id (`I1jTpQKv5A0`, gone from the
guide since 17:39Z) planted in the cache for ESPN event 1 **still plays**:
YouTube TV serves an ESPN logo slate at hd720. Poll 1 (URL contains the id,
`#movie_player` present) passes, so the step-4 re-read never fires and the
cache keeps the stale id. The trigger as specified cannot detect a
stale-but-playable watch id.

**After the stop (owner's instruction):** committed and pushed as-is, and
`npm run channels` re-run (V6, 01:12Z), which replaced the drilled row.
- **YouTube TV:** 145. Univision has a watch link again, and the 6 browse-only
  rows are skipped.
- **Philo:** 226.
- **Stable:** the 142 YouTube TV keys present in both runs are unchanged, with
  0 watch-id changes.
- **Rotated:** ESPN event rows 24 and 25 came back with **new stationIds**
  (and new watch ids). The D020 key is not durable for discrete event feeds.

The dev server was restarted on the V6 cache.

See notebook/reports/task-022.md.

---

## Task 023 — YouTube TV event feeds excluded (2026-09-12)

**Decisions recorded:**
- **D023:** guide rows with `isDiscreteStation: true` (event feeds) are not
  channels and are excluded from the lineup and the playlist. It amends D013
  in the spirit of its no-stream note.
- **D022** is marked superseded by D023.
- **Note under D020:** stale-watch-id detection is PARKED, to reopen only when
  a regular channel's watch id is observed to change. The task-022 single
  re-read + retry stays as built.

**Built:**
- YouTube TV enumeration skips discrete rows with the reason
  `isDiscreteStation (event feed)`, listed alongside the no-stream rows.
- The D022 `(event N)` naming is removed from the playlist writer; names are
  the guide's own again.
- Nothing else changed.

**Verified live:**
- **V2:** 142 YouTube TV channels from 151 guide rows. 9 rows skipped: ESPN
  23, 24, 25 (event feed); ESPN 26, NBCSN Extra 30–32, Cartoon Network 46,
  WNBA on ION 133 (no stream). Philo 226; all 368 keys distinct.
- **V3:** `/playlist/youtube-tv` lost exactly the three event rows' 6 lines,
  and their keys return 404. No `(event` in any playlist. `/playlist/philo`
  is byte-identical.
  - 4 other YouTube TV lines (Disney Channel, Nicktoons, Portlandia, C-SPAN2)
    differ **only in `tvg-logo`**. Each line matches its own enumeration's
    cache: the cached logo is the current airing's thumbnail, and it changed
    between the 01:12Z and 01:19Z reads. That is lineup drift, not code.
- **V4:** ESPN row 17 by key, 60 s, hd720 (that channel's ceiling), 0 error
  lines, clean idle stop.

**Hand-off correction:** the dev server was started from a builder background
task, and the harness stopped it after the push because the system was low on
memory (~23:13 EDT). Chrome (pid 211475) and both owner tabs are unaffected.
Nothing is listening on 8804. The owner starts the server from a desktop
terminal: `cd /Apps/marlin-cast && npm run serve`.

See notebook/reports/task-023.md.

---

## Task 024 — the container: image, entrypoint, viewer; V1–V7 pass (2026-09-13)

**D024 recorded** (ports 8804 in / host 8091, `ubuntu:24.04`, ffmpeg 6.1.x
gate, Chrome pinned `153.0.8010.36-1`, noVNC on 6080 / host 8092 with
`VNC_PASSWORD`, PUID/PGID default 99/100, `/data/chrome-profile` volume,
first-boot enumeration, Xvfb 1920×1080 on :99) plus **item 8: the container
must run with `--cap-add SYS_ADMIN` and `--shm-size=1g`** — without
`SYS_ADMIN` Chrome's sandbox cannot create its namespaces and Chrome never
starts (KNOWN-FIXES). `--no-sandbox` was not used; `start-chrome.sh`'s flags
are unchanged.

**Built:** `Dockerfile`, `docker/entrypoint.sh` (7 gated stages, ordered
SIGTERM shutdown, sweep), `.dockerignore`; `MC_PROFILE` / `MC_DATA_DIR` /
`MC_HLS_DIR` env overrides (all unset on marlinpc, so nothing changes there);
`MC_PROVIDERS` test knob (loud; unset in production). Host-header URL
building needed no change — `src/server.ts` already did it.

**Verified for real, YouTube TV only, on a copy of the basic backup mounted
at `/data` with the container running as 99:100:**
- V1: ffmpeg `6.1.1-3ubuntu5`, Chrome `153.0.8010.36`, Node `v22.23.2`.
- V2: every stage ready; **0 Fontconfig lines**; `navigator.webdriver:
  false`; **signed in** — the uid-1000 profile copy works after the
  entrypoint's `chown -R` (closes the task-004/005 uid gap for this path).
- V3: noVNC renders Chrome on the 1920×1080 display (image in the report);
  wrong password → `password check failed!`.
- V4: first boot enumerated **141** YouTube TV channels from 147 guide rows
  (task-023: 142 from 151 — Sunday-morning guide drift, no event rows today).
- V5: ESPN row 17 via 8091, **190 s pull**: H.264 High 1920×1080 30 fps +
  **AAC 48 kHz stereo, mean −27.3 dB, peak −7.9 dB — audio is present in the
  container**, closing the recon's default-output-device gap. Picture varying
  (luma 35–88). One 1.4 s silent run and two black runs (1.9 s, 0.7 s)
  mid-stream with content either side, judged ad transitions. Cold tune
  6.3 s first start, 4.0 s second. `/health` streaming throughout; idle stop
  clean (0 ffmpeg, 0 HLS dirs, tab parked).
- V6: `docker stop` **1.16 s / 1.19 s**, nothing left on the host either
  time; Chrome's Singleton symlinks were left in the volume and **removed at
  the next start**; second start took the cache-present branch, tuned in
  4.0 s, stopped clean.
- V7: all 141 stream URLs carry the requesting `Host` (`127.0.0.1:8091`;
  `192.168.1.250:8091` when sent as such), none carry 8804.

**Defect found by V6 and fixed:** the entrypoint's `sed` prefix pipe
block-buffered the app log — no `[app]` line reached `docker logs` until
exit. `sed -u` now; confirmed live on the second start.

**Not done, by scope:** GHCR workflow and tags, the Unraid deploy, the
two-provider profile copy (needs the live Chrome stopped — the owner's
step), VAAPI/decode (D014), hardware encoding. Philo in the container is
untested until deploy.

**Note (2026-09-26):** VAAPI/decode (D014) closed by D029.

**Note (2026-09-26):** hardware encoding closed by D030.

**Hand-off:** the live Chrome is still quit (owner's action before V2) and
the dev server is not running; nothing listens on 8804/9333/8091/8092. The
staged test profile remains at `/tmp/mc-test/data` owned by 99:100 (this
account cannot delete it). Image `marlin-cast:task024` is in the local
Docker cache; no container exists. Backup verified untouched.

See notebook/reports/task-024.md.

---

## Task 025 — GHCR publishing workflow and D025 (2026-09-13)

**D025 recorded:** image `ghcr.io/marlin1111ai/marlin-cast`; a push to
`main` publishes `latest` + `sha-<short>`; a git tag `vX.Y.Z` publishes
`X.Y.Z` (must equal `VERSION`, must not already exist — immutable);
`GITHUB_TOKEN`, buildx GHA cache, `linux/amd64`; package visibility is the
owner's one-time GitHub setting.

**Built:** `.github/workflows/docker.yml` (the iptv-editor
`publish-image.yml` skeleton plus a `v*` tag trigger, tag-gated tag list,
buildx cache, no build-args) and `VERSION` = `0.1.0`. Dockerfile and
entrypoint untouched.

**Verified:** V1 — both workflows parse; same trigger/permissions/login/
VERSION/immutability-check/metadata/build-push structure; full diff in the
report. V2 — the run could not be watched (`gh` not installed, repo
private), but **the image appeared in GHCR at 11:35:04Z, 1 min 56 s after
the push**, labelled with the commit SHA, under both `latest` and
`sha-97d5d0d`. V3 — pulled here through the Docker daemon's existing GHCR
login (18 s) and `google-chrome --version` in it reads `153.0.8010.36`;
ffmpeg `6.1.1-3ubuntu5`, node `v22.23.2`.

**Owner's step:** the package is **private** (anonymous pull token refused).
GitHub → Packages → `marlin-cast` → settings → visibility Public, so Unraid
pulls without a token. Also check the run's log page once at
github.com/marlin1111ai/marlin-cast/actions.

**Pushed:** `97d5d0d` (workflow, VERSION, D025, report) — the commit that
published the image — then a notebook-only follow-up with the V2/V3 evidence,
which `paths-ignore` correctly does not build.

**Hand-off:** unchanged from task-024 — live Chrome quit, dev server not
running, `/tmp/mc-test/data` still present (owned by 99:100), image
`marlin-cast:task024` in the local cache, no container.

See notebook/reports/task-025.md.

---

## Task 026 — app icon at /icon.png; viewer opens at / (2026-09-13)

**Built:** the owner's 512×512 icon at `assets/icon.png` (sha256
`3387b83f…`), copied into the image and served by the app at `GET
/icon.png` (`image/png`, `cache-control: public, max-age=86400`); the
noVNC web root is now a scratch directory of symlinks plus an `index.html`
that forwards to `vnc.html`, so `http://host:8092/` opens the viewer
(KNOWN-FIXES). `VERSION` 0.1.0 → 0.1.1. No other viewer change; extension,
data, backups untouched.

**Verified (V1):** image built; run on an empty throwaway profile with a
zero-channel cache (so the app starts without a login — both providers
reported SIGNED OUT, as expected, and nothing was tuned): `/icon.png` →
200 `image/png`, 239,699 bytes, byte-identical to the source; `8092/` →
200, the forwarding page, `vnc.html` and `app/ui.js` still 200;
`docker stop` 1.36 s, nothing left. V2 is in the report (GHCR image for
this commit).

**Hand-off:** unchanged — live Chrome quit, dev server not running,
`/tmp/mc-test/data` still present, no container running. Images
`marlin-cast:task024`, `:task026` and the pulled `ghcr.io/…:latest` in the
local cache.

See notebook/reports/task-026.md.

---

## Task 027 — deployed: D026, D027; status page lists four URLs (2026-09-13)

**Recorded:** D026 (deployed on Unraid as `marlin-cast`, full template in the
decision; D012 fulfilled, marlinpc dev-only), D027 (repo public; the
no-credentials rule unchanged), a D014 note (GPU decode test on Unraid still
open; CPU decode/encode today), a KNOWN-FIXES entry (Unraid fetches the icon
at Apply time, so serve it from the public repo). "Where things stand" at the
top of this file is rewritten to the deployed state.

**Note (2026-09-26):** the D014 GPU decode test is closed by D029.

**Built:** the status page's URLs section lists `/playlist`,
`/playlist/youtube-tv`, `/playlist/philo`, `/health` — each from the request
Host, each with its copy button; the per-provider lines come from the
provider registry (D021 slugs). No other page change. `VERSION` 0.1.1 →
0.1.2.

**Verified (V1):** the dev server does not start without Chrome (exits at
CDP attach, `ECONNREFUSED 127.0.0.1:9333`), so V1 ran on a locally built image
with an empty throwaway profile: `GET /` → 200 with the four URLs for
`127.0.0.1:8091` and, sent as `Host: 192.168.1.250:8091`, for that host; all
four answer 200. V2 (GHCR image for the commit) is in the report.

**Hand-off:** live Chrome quit, dev server not running, no container
running. `/tmp/mc-test` still present — owner's `sudo rm -rf /tmp/mc-test`.
Image `marlin-cast:task027` added to the local cache.

See notebook/reports/task-027.md.

---

## Recon — Chrome memory across tunes (2026-09-28) — closed at 12 of 20 cycles (D032)

**Recorded:** a note under D030 — ffmpeg exit 255 at idle stop was re-seen on
Unraid on 2026-09-28 on three consecutive WBAL 11 tunes and stays closed
(D006, live only). **D032** — the Chrome memory recon stopped at 12 of 20
cycles and is recorded as it stands; the cycle-13 tune stall is not pursued,
reopen if seen on Unraid.

**Run on marlinpc:** image `sha-c876a3a` as container `marlin-cast-recon`, a
working copy of the 2026-09-13 two-provider backup as `/data`, the D024 run
line, no size env (1080p). Both providers signed in; first boot enumerated 375
(YouTube TV 141, Philo 234). Measured at startup, after 15 minutes idle, and
after each of 12 tune cycles on WBAL 11 (60 s pull, idle stop, park, 10 s
settle): `docker stats`, every process's RSS, and each renderer's tab through
the container's loopback CDP.

**Cycle 13's tune failed** (`player ready: not satisfied within 30000ms`, last
probe `readyState: 1`, HTTP 503) and the pass stopped there; cycles 13–20 were
not run and nothing was retried. The player was stuck in a seek with nothing
buffered while YouTube TV reported the stream playable and media requests
answered 200. Memory was not exhausted and no Chrome process died. Cause not
determined. **Owner's calls (D032):** the stall is closed, not pursued, reopen
if seen on Unraid; the measurement stops at 12 cycles and the result is
recorded as it stands.

**What 12 cycles show:**
- **The browser process grows with tunes, not time.** RSS 348,836 kB at
  startup, 349,276 kB after 15 minutes idle, then +26,780 to +29,960 kB of
  RssAnon per tune — the size of one tune's recording (27.9–29.9 MB at
  ffmpeg's stop). It was released once, by 143,172 kB between cycles 6 and 7,
  and climbed again to 527,096 kB by cycle 12. Highest reading 530,028 kB.
- **The YouTube TV tab's renderer** stepped from 452,492 kB idle to a band of
  506,428–649,196 kB once tuned and parked, with no trend across the 12.
- **Container (`docker stats`):** 704.8 MiB at startup, 723.7 MiB after 15
  minutes idle, 903.2 MiB–1.154 GiB over cycles 1–12.
- One renderer could not be mapped to any tab.

**Cleaned up (close-out pass, 2026-09-29 00:10Z):**
- Container `marlin-cast-recon` stopped (1.26 s, exit 0) and removed;
  `docker ps -a` lists nothing; no chrome/Xvfb/x11vnc/websockify/ffmpeg on
  the host, nothing on 8091/8092/8804/9333.
- The profile working copy (owned by 99:100; 58,097 entries, 1.8G) deleted
  through a throwaway root container of the same image; the rest of the
  scratchpad (raw logs, pull logs, scripts, the throwaway password file)
  deleted; the scratchpad is empty. The raw logs are in the report's
  appendices, checked identical before deletion.
- Image `ghcr.io/marlin1111ai/marlin-cast:sha-c876a3a` removed; no Marlin
  Cast image is left locally.
- The backup's sha256 is unchanged:
  `6ebd9ea976118bcb8c24e10b590680e5d44e405d1b3a9f7f09a0a3982258dbe3` before
  extraction and after the clean-up.

**Hand-off:** the D030 note, D032, the report and this entry are committed and
pushed in one notebook-only commit, which builds no image (D025). Left on
marlinpc: three output files of the builder's own background tasks in its
`tasks/` directory (named in the report); nothing else. No owner Chrome and no
dev server was running during either pass. "Where things stand" at the top of
this file is unchanged and predates this pass.

See notebook/reports/recon-chrome-memory.md.

---

## Task 030 — chunk references traced; nothing holds a sent chunk; no code change (2026-09-28)

**Stopped after step 1, on the brief's own branch.** The brief asked for every
place that keeps a reference to a recorded chunk after it is sent, then a fix
in the file holding it. The trace of `extension/` and `src/` found none, so no
fix was made and steps 2–7 (image, run, 12-cycle measurement, GHCR check) were
not run.

**The path of one chunk:** MediaRecorder's `dataavailable`
(`extension/offscreen.js:56`) → a callback queued on the send chain that
captures the event (`:63-74`) → `fetch` with the Blob as its body (`:65-69`) →
`express.raw` builds `req.body` (`src/server.ts:71`) → `ingest()` writes it to
ffmpeg's stdin (`src/capture.ts:375-382`). The last holder in the extension is
the send callback, which ends when the POST is answered; the server keeps
nothing past the request. The arrays and Blob that would hold a whole
recording (`offscreen.js:9-11`, `:58`, `:107-108`) are file mode only and the
app always streams (`src/capture.ts:357-361`). `background.js` never receives
a chunk.

**Not determined:** why the browser process still steps up 27–30 MB per tune.
The recon's inference stands and fits the trace — a sent chunk is garbage, not
freed memory; Chrome holds a Blob's bytes in the browser process until the
offscreen document's garbage collector takes the Blob; nothing closes that
document or asks for a collection. Nothing was run to test it.

**Open, the owner's call** (each needs a change in a file that holds no
reference; none tried): force a collection on the offscreen document over CDP
from `src/capture.ts`; close the offscreen document at stop in
`extension/background.js`; or leave it.

**Hand-off:** the report and this entry are committed and pushed in one
notebook-only commit, which builds no image (D025); GHCR is unchanged,
`latest` = `sha-c876a3a`. No image was built or pulled, no container was run,
the backup was not read, the scratchpad is empty. No owner Chrome and no dev
server was touched. "Where things stand" at the top of this file is unchanged
and predates this pass.

See notebook/reports/task-030.md.

---

## Task 031 — forced collection on the offscreen document; the per-tune step is gone (2026-09-28)

**Owner's call carried out:** Marlin Cast forces a garbage collection on the
capture extension's offscreen document over CDP
(`HeapProfiler.collectGarbage`) every 60 s during a capture and once at stop.

**Cause proven first, on the unchanged image** (`sha-c876a3a`, container on a
working copy of the 2026-09-13 two-provider backup, the D024 run line, 1080p,
both providers signed in, 375 channels). After three WBAL 11 tunes the
browser process read 448,924 kB (RssAnon 177,012) against 351,004 (89,732) at
startup. One collection sent to the offscreen document took it to 362,520
(92,592): 88% of the RSS growth and 97% of the RssAnon growth released. The
point was taken 24 s after the collection, not the 10 s intended.

**Reached how:** the offscreen document is a CDP target of its own — type
`background_page`, URL `chrome-extension://<id>/offscreen.html` — listed by
the unfiltered `Target.getTargets` the app already uses. The app did not
reach it before; it only talked to the service worker.

**Built:** `src/capture.ts` only (+48 −1). `collectOffscreen()` attaches to
that target, sends the collection and detaches, raced against a 5 s timeout;
a timer set once the recorder is running calls it every 60 s; `stop()` clears
the timer and calls it once after the recorder has stopped. A failure logs
`[gc] WARNING: offscreen collection failed (<interval|stop>): <error>` and
the capture goes on. A success logs nothing. `src/cdp.ts` needed no change.
`VERSION` stays 0.1.2.

**Measured on an image built from the working tree** (same run line and
profile copy; no page probed):
- **12 cycles** (60 s pull, idle stop, park, 10 s): browser process
  356,556–360,084 kB; per-tune change −660 to +1,412 kB from cycle 2 on,
  against +26,056 to +29,960 in the recon.
- **One 10-minute pull, a point a minute:** 364,372–380,556 kB, two levels
  (RssAnon about 96,000–97,400 and about 108,400–111,900), no climb; 356,808
  after the stop.
- **Pulls:** 14 of 14 exited 0 with as much media as wall time (59.98 s in
  59.9–60.5 s; 599.98 s in 599.7 s; 29.99 s in 30.2 s). ffprobe on the 30 s
  pull: H.264 High 1920×1080 30 fps, AAC-LC 48 kHz stereo.
- **Cold tune:** 12 of 14 at 4.09–4.62 s; 6.71 s on the container's first
  tune and 7.39 s on one where the player took 4,930 ms to start. The
  unchanged image shows both patterns; passed on that judgement.
- **Warning line:** 0 times in 14 tunes.

**Cleaned up:** both containers removed; the profile copy deleted through a
throwaway root container of the local image; the local image and the pulled
`sha-c876a3a` removed; the scratchpad emptied after the raw logs were checked
identical to the report's appendices. The backup's sha256 is unchanged:
`6ebd9ea976118bcb8c24e10b590680e5d44e405d1b3a9f7f09a0a3982258dbe3`.

**Open, the owner's call:** `VERSION` not bumped; the call has no decision
number in DECISIONS.md; "Where things stand" at the top of this file and
`MARLIN-CAST-BRIEF.md` still name `sha-c876a3a` as `latest`; Unraid and the
QNAP do not run this change until the owner updates them; whether a
successful collection should be logged.

**Not seen:** the warning path (never fired, no failure induced); a capture
longer than about 10 minutes; Philo with the change.

**Hand-off:** the code change, the report and this entry are one commit on
main, pushed; a push that touches `src/` builds an image (D025), so GHCR gets
`latest` and `sha-<short>` for it. No container, image or scratch file is
left on marlinpc; the builder's background-task output files remain in the
harness's `tasks/` directory (named in the report). No owner Chrome and no
dev server was running during the pass.

See notebook/reports/task-031.md.

---

## Task 032 — tvc-guide-stationid from a table built on Schedules Direct; 208 of 375 lines tagged (2026-09-29)

**Owner's calls carried out (D035):** every playlist line carries
`tvc-guide-stationid` where a credible station exists; the ids come from a
table in the repo, `src/stations.json`, built from the owner's Schedules
Direct lineups `USA-YTBE512-X` and `USA-PHILO-X` and keyed on the D020 key.
Amends D015. **Also recorded:** D033 (the task-031 forced collection), D034
(QNAP: WBAL 11 seen about 6 hours behind live, not pursued), and a note under
D026 (Unraid force-updated to `latest` = `sha-13071d7` on 2026-09-28).

**Run in two parts.** The first stopped at step 3: the Schedules Direct env
file did not exist. The owner supplied it and ruled: a Marlin Cast name
matched against a callsign is a callsign pair; the table holds only key,
station id and basis; Schedules Direct names and callsigns go in the report
only.

**Lineups:** one token request, two lineup reads, nothing changed on the
account. `USA-YTBE512-X` 401 station entries (393 distinct ids),
`USA-PHILO-X` 109. The lineup data stayed in the scratchpad.

**Channel list:** image `sha-13071d7` in a throwaway container on a working
copy of the 2026-09-13 two-provider backup, the D024 run line, no size env.
Both providers signed in; first boot enumerated 375 (YouTube TV 141, Philo
234).

**The table, 208 entries:**

| | channels | tagged | untagged | name | callsign | hand |
|---|---|---|---|---|---|---|
| YouTube TV | 141 | 127 | 14 | 28 | 5 | 94 |
| Philo | 234 | 81 | 153 | 19 | 0 | 62 |

Each provider is paired against its own lineup only. East feeds, not Pacific;
main feeds, not 4K or overflow. ESPN stays `32645`. WBAL 11 is `21231` in
`USA-YTBE512-X`, the same id as the owner's pick in Marlin DVR. Left out
because nothing tells the candidates apart: CNBC (two stations), the two MPT
channels (one station), Philo's Cheddar News (two stations). Eight Philo
channels have their exact name in the YouTube TV lineup only and carry no
tag.

**Built:** `src/server.ts` (+15 −6) reads the table once at start and emits
the tag as the last attribute, where the ESPN line had it; the hardcoded ESPN
key is gone. A table that cannot be read is a loud exit 1. No other line of
any playlist changed. `VERSION` stays 0.1.2.

**Verified on an image built from the working tree** (same container run
line, same `/data`, so the same channel cache):
- `/playlist` 208 of 375 tagged; `/playlist/youtube-tv` 127 of 141;
  `/playlist/philo` 81 of 234. Counted with `grep` and again by a script
  against the table; both agree.
- Against HEAD's output the only differences are the 207 added tags; ESPN's
  line is byte-identical.
- One WBAL 11 tune pulled for 30 s: exit 0, H.264 High 1920×1080 30 fps,
  AAC-LC 48 kHz stereo.

**Open, the owner's call:** the eight Philo channels named only in the
YouTube TV lineup; CNBC, MPT and Cheddar News; 153 Philo channels with no
station in `USA-PHILO-X`; the table is a snapshot and nothing warns when a
provider adds a channel; `VERSION` not bumped; Unraid and the QNAP do not run
this until the owner updates them.

**Not checked:** whether each hand pair is the feed the provider shows (the
pairs were made on names); whether Unraid's channel cache holds keys this
list does not (its playlist had 367 channels on 2026-09-28, this list has
375).

**Hand-off:** the table, the code change, DECISIONS.md, the report and this
entry are one commit on main, pushed; it touches `src/`, so GHCR gets `latest`
and `sha-<short>` for it (D025). A second, notebook-only commit corrects the
statements about GHCR `latest` in "Where things stand" and the brief. The
clean-up follows the pushes; its evidence is in the hand-off.

See notebook/reports/task-032.md.

---

## Task 033 — nine more station ids; 217 of 375 lines tagged (2026-09-29)

**Owner's calls carried out (note under D035):** the eight Philo channels
named only in `USA-YTBE512-X` take that lineup's station ids (All Reality WE
tv, AMC Thrillers, Overtime, Pickleball TV, Portlandia, Stories by AMC, The
Tennis Channel 2, The Walking Dead Universe); CNBC → 58780; MPT (both) and
Cheddar News stay untagged. **Also:** "Where things stand" and the brief now
say Unraid runs `sha-13071d7` since the 2026-09-28 force-update (D026 note);
the brief's D030 summary line is left as it is.

**Run in two parts.** The first stopped at the throwaway container's sign-in
check: on the first boot of a fresh copy of the 2026-09-13 two-provider
backup, YouTube TV read SIGNED OUT (it landed on the welcome page), though the
guide then enumerated 141 channels and the tab read signed in two minutes
later. Nothing had been changed and no Schedules Direct request had been made.
The owner ruled: start that container once more and continue only if both
providers read signed in. They did, on that boot and on the verify
container's. Why the first boot read signed out is not proven.

**Lineup:** one token request, one read of `USA-YTBE512-X`, nothing changed
on the account; 401 station entries (393 distinct ids), the same as
task-032's read. Each of the eight names has exactly one station of that
exact name; none was left out. The lineup data stayed in the scratchpad.

**The table, 217 entries** (208 + 9, appended; no existing entry changed):

| | channels | tagged | untagged | name | callsign | hand |
|---|---|---|---|---|---|---|
| YouTube TV | 141 | 128 | 13 | 28 | 5 | 95 |
| Philo | 234 | 89 | 145 | 19 | 0 | 70 |

All nine are basis `hand`. Seven of the eight stations were already in the
table under a YouTube TV channel; Overtime's and CNBC's are new to it. 181
distinct stations. No code change: `src/server.ts` is as task-032 left it.
`VERSION` stays 0.1.2.

**Verified on an image built from the working tree** (the D024 run line, the
same `/data`, so the same channel cache as `b2df851`'s output):
- `/playlist` 217 of 375 tagged; `/playlist/youtube-tv` 128 of 141;
  `/playlist/philo` 89 of 234. Counted with `grep` and again by a script
  against the table; both agree.
- Against `b2df851`'s output the only differences are the nine added tags;
  ESPN's line is byte-identical; no URL line differs.
- No channel was tuned; the steps did not ask for one.

**Open, the owner's call:** the backup's YouTube TV session read signed out
once, so a later pass may need a newer profile backup, and whether production
is affected is not known (Unraid was not contacted); 145 Philo channels with
no station; the table is a snapshot; `VERSION` not bumped; Unraid and the QNAP
do not run this until the owner updates them.

**Not checked:** whether each of the eight Philo channels shows the schedule
of the station Schedules Direct lists for YouTube TV (the pairs were made on
names); which of the two CNBC stations YouTube TV's CNBC follows (the owner's
pick).

**Hand-off:** the table, DECISIONS.md, the two statements, the report and
this entry are one commit on main, pushed; it touches `src/`, so GHCR gets
`latest` and `sha-<short>` for it (D025). A second, notebook-only commit
changes GHCR `latest` in "Where things stand" and the brief to that image.
The clean-up follows the pushes; its evidence is in the hand-off.

See notebook/reports/task-033.md.

## Recon idle / D038 — the parked guide plays previews; park on Library (2026-10-07)

**Owner's question.** Unraid's container used CPU, downloaded about 0.5
GB/hour and grew slowly while nothing was watched. Theory: the parked
YouTube TV guide keeps playing.

**Found (test container from `sha-0f042a9`, backup working copy; report
`notebook/reports/recon-idle.md`).** The guide's rows are live previews:
seven muted 426×240 streams play while that tab is visible — 1.6–2.4
Mbit/s, 37–40% of a core; they stop when another tab is in front. The home
page does the same with six. Philo's parked guide: no video, no download,
about a fifth of a core while visible, silent hidden. Nothing survives an
idle stop. The YouTube TV renderer's anonymous memory grew ≈1.2 MB/minute
with the previews playing and not at all without them; `docker stats` on
marlinpc also counts Chrome's cache churn on the tmpfs working copy and is
not comparable to Unraid. `about:blank` cannot be a park page (D018 selects
by host; tunes fail loud). `/library` and `/settings`: 0 kbit/s, <1% CPU.

**Done (D038, owner's choice).** `parkUrl` for YouTube TV →
`https://tv.youtube.com/library`; `Provider.parkHidden`; after a Philo park
the pipeline activates the YouTube TV tab. Files: `src/providers/types.ts`,
`youtubetv.ts`, `philo.ts`, `src/capture.ts`. Image built locally as
`marlin-cast-test:d038` for the acceptance only (not pushed anywhere).

**Acceptance so far.** Six Philo tunes from the hidden state all tuned;
times 3.2–5.2 s except three at 14.8–15.9 s, two of them with the task-021
overlay stuck (first stuck overlays of the day's 21 Philo tunes). A switch
between providers leaves the previous tab playing its channel at ≈4.2
Mbit/s (both directions; pre-existing) — raised to the owner. The test
container is idle overnight on `/library` for the owner's second condition.

**Then, the owner's rulings (same day):** D039 — a switch to the other
provider parks the tab being left (`e02bb79`); D040 — both tabs parked at
server start, only when confirmed signed in on the page they are on, never
navigating a sign-in page (`2b1c63c`). Each its own commit so either can be
backed out alone. Both verified on a second test container
(`marlin-cast-d040`): switches in both directions leave the old tab on its
park page hidden at 0 kbit/s; both boot paths start with YouTube TV parked
on `/library` in front and Philo's guide hidden.

**Side-by-side (owner's condition on the bring-forward half):** 20 Philo
tunes from a hidden start against 20 from a visible start, alternating, same
five channels. Hidden: 11 cleared the overlay on sweep 1, 2 on sweeps 2–3, 7
stuck; median 5.0 s. Visible: 14 / 1 / 5; median 3.5 s. The stuck rate rose
through the afternoon in both arms and came in runs across both, so the
difference is not clear with this sample. Awaiting the owner's call: keep
the bring-forward (hidden Philo starts already occur after any YouTube TV
tune) or drop it.

**Unraid readings (owner, 11:50 EDT):** the last park was on `/live`; pid
204 (786 MB RSS, 7.4% CPU over 17.5 h) is almost certainly the YouTube TV
tab's renderer — the one process that grew in the test with the previews
playing; `anon` 1.13 GB, `file` 676 MB (cache, reclaimable), `shmem` 55 MB.

**Owner's rulings, evening of 2026-10-07:** keep the bring-forward, no
larger test; `VERSION` 0.1.3 as its own commit (`d4dd858`); the Philo stuck
overlay recorded as its own open item (`notebook/OPEN-ITEMS.md`), not worked
on. At 02:55Z on 2026-10-08 the overnight container still read YouTube TV on
`/library` in front, Philo's guide hidden, nothing playing, 0.56% CPU, and
no tune or stop logged since 15:27Z.

**Overnight check, 2026-10-08 08:03 EDT: passed** — 20.5 h idle on `/library`
with Philo hidden, about 20 MB downloaded in total, Chrome 0.7% of a core, no
memory growth; first tunes after the night WBAL 11 2.27 s and AMC 3.83 s, no
sign-in page (recon-idle F).

**Was pending:** the overnight check on `marlin-cast-d038`, run by the PC's
own cron at 2026-10-08 08:03 EDT (`~/marlin-cast-overnight-check/run.sh`,
result in `RESULT.txt` there; the line removes itself), then the owner's
"push it". Nothing is pushed before both. At the push: `main`, then the tag
`v0.1.3` (owner's choice (a); the VERSION note after D040 in DECISIONS.md). After the result: delete
that folder, the test container `marlin-cast-d038`, its image and the
scratch profile copies.

**Pushed (2026-10-08, owner's "push it"):** main `b56155c..bd0f90f`, then tag
`v0.1.3` → bd0f90f; `git fetch` + SHA comparison match. Workflow runs: main
12:50:37–12:53:24Z success, v0.1.3 12:50:43–12:54:04Z success. GHCR: `latest`
and `sha-bd0f90f` share amd64 manifest `sha256:f5b4d41cb711…`; `0.1.3` is
`sha256:a9e18522d0ce…` (separate build of the same commit). Clean-up done:
test containers, images, profile copies, scratch scripts and
`~/marlin-cast-overnight-check` deleted. Next: the owner force-updates Unraid
when nothing is recording, then the five-step check in the 2026-10-07
report to the owner (Library in front in the viewer, low idle CPU and
network, one tune per provider).

## Wrap 2026-10-08 — where things stand

**Done this session (2026-10-07 to 2026-10-08).** The foreman role was
dropped; `CLAUDE.md` and `/wrap` (`.claude/commands/wrap.md`) hold the rules.
Idle recon (`notebook/reports/recon-idle.md`); D038 (YouTube TV parks on
`/library`, Philo tab put behind), D039 (cross-provider switch parks the tab
left), D040 (start-up park, only when signed in); `VERSION` 0.1.3; pushed
main `bd0f90f` and tag `v0.1.3`, both image builds green; notebook follow-up
`919f213` pushed (no image). Overnight acceptance passed. Unraid
force-updated to 0.1.3 by the owner.

**Owner's first Unraid readings on 0.1.3 (2026-10-08):** before any tune,
parked on YouTube TV Library, CPU 0.5%, network in flat. At 09:26 EDT the
owner clicked the Philo tab in the viewer and may not have clicked back;
then played channels in Marlin DVR (which, and when the last stopped, was
left blank in the owner's message). 09:37: CPU 7.5%, network in flat at
70.4 MB. 09:41: the viewer showed the Philo guide in front.

**Half-finished — why Philo stayed in front.** Not yet known. Three
read-only commands were given to the owner (the running code has the
bring-forward; the container's start time; every `[start]`, `[tune]`,
`[stop]` and error line since the update) and their output has not arrived.
Readings to expect:
- no tune between 13:26Z and 13:41Z → nothing reached Marlin Cast and the
  owner's click left Philo in front (most likely, inferred: 70.4 MB total
  network in is too little for minutes of live TV, and 7.5% CPU with flat
  network matches Philo's guide visible);
- a Philo idle stop ending "brought the youtubetv tab to the front" → the
  app did its part and the tab was moved afterwards;
- "could not bring the youtubetv tab to the front" → the bring-forward
  failed; the line says why;
- the last stop is a YouTube TV channel after the click → a design gap: only
  a Philo stop re-fronts YouTube TV, so a manual click to Philo during a
  YouTube TV capture survives that capture's stop (from reading
  `src/capture.ts`; not observed).

**Next.** The owner sends the three outputs; read them, say which case it
is, and propose a fix only if it is the app. Nothing changes on Unraid
without telling the owner first. Open items: this one and the Philo stuck
overlay (`notebook/OPEN-ITEMS.md`).

## Closed 2026-10-08 — Philo in front on Unraid was a viewer click

The owner ran the three read-only commands: 0.1.3 running (grep 2);
container started 13:24:20Z; start-up park of both tabs with YouTube TV
brought forward, then YouTube TV tunes FOX 45 13:32Z, SundanceTV 13:33Z,
SYFY 13:34Z, each ~2 s and parked on `/library`; no Philo tune, no
"could not", no error. Every tune activates its own tab, so the 13:32Z tune
undid the 09:26 EDT click; Philo was clicked again after 13:32Z. After the
owner put YouTube TV back in front: 0.5% CPU, 806 MB, network flat. Closed,
no code change. Kept for later, low priority: maybe every idle stop brings
YouTube TV forward (covers a click during a capture, not one after the last
stop). Owner also states Marlin DVR uses only `/playlist/youtube-tv` — Philo
is never tuned in normal use (updates D036). Corrected later the same day:
Marlin Cast is used by the owner's Marlin DVR (Unraid, YouTube TV only) and
by the father's Channels DVR (QNAP install); the owner's own Channels DVR
does not use it. Asked, not answered: whether the father's Channels DVR uses
Philo. The QNAP stays pinned to `sha-c876a3a`, which predates D033, D035 and
D038–D040 (owner's choice, D036).

**Waiting for the owner's next visit to their father's house (owner,
2026-10-08):** (1) whether the father's Channels DVR uses Philo channels from
Marlin Cast — check its custom channel sources for a Marlin Cast address
ending in `philo`; (2) whether to update the QNAP from `sha-c876a3a`, which
still parks YouTube TV on the preview-playing guide and lacks the D033 memory
fix and the D035 station ids. Nothing on the QNAP is changed until then; it
is never connected to from marlinpc. Open items now: the Philo stuck
overlay, and that low-priority note.


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

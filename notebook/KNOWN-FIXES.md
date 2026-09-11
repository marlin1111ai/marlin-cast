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
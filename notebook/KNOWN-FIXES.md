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

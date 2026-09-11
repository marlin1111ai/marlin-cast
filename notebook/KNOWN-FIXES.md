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

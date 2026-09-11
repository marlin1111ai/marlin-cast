# Task 005 — Convert to the basic cookie-encryption scheme

Date: 2026-09-11. Host: marlinpc. DISPLAY=:10.

**Status: stopped at step 5f, awaiting the owner's hand-login.**
Sections (i), (ii) and part of (vii) are complete. Sections (iii)–(vi)
— post-login cookie tags, playback, the two relaunch tests, and the new
backup — are **NOT OBSERVED** until the owner logs in.

No login was performed. `accounts.google.com` was never navigated to.
Chrome is deliberately left running — see step 10 at the end.

---

## (i) D010 recorded — step 4

Appended verbatim to `notebook/DECISIONS.md` after D009. It supersedes
`--password-store=gnome-libsecret` in `scripts/start-chrome.sh`.

---

## (ii) Script change and flag proof — step 5c, 5d

### Before the switch

The old v11 profile was **moved, not deleted** (step 5b), after a
graceful stop:

```
$ kill -TERM 72933
pid 72933 gone (SIGTERM only, no SIGKILL)
$ ss -tlnp | grep 9333
port 9333 released
```

Stale `SingletonCookie` / `SingletonLock` / `SingletonSocket` were
cleared, then:

```
data/chrome-profile  ->  data/chrome-profile-v11-20260911-104559
```

Verified intact after the move — **48 rows, `v11`, 47 persistent, 17
auth-shaped**, i.e. the full logged-in session. It is gitignored under
`/data/`. **There are now two fallbacks**: this moved profile and the
untouched `backups/chrome-profile-loggedin-20260911-101619/`.

### The change

One flag, plus the comment that names it:

```diff
-  --password-store=gnome-libsecret \
+  --password-store=basic \
```

**Flagged for the owner, as it is the one thing beyond the literal
flag:** the adjacent comment previously justified the *old* flag, and a
`sed` on the flag name alone would have left a rationale that no longer
matched. It now reads:

```
# --password-store=basic pins the cookie encryption scheme
# to v10 (hardcoded key) rather than v11 (machine-bound keyring), so this
# profile stays readable in a container that has no keyring. Do not change
# it back: D010, and notebook/KNOWN-FIXES.md.
```

Nothing else in the file changed — same port, same profile path, same
loopback behaviour, same two `--no-*` flags.

### Proof on the running process

```
$ ps -o args= -p 75253 | tr ' ' '\n' | grep '^--'
--user-data-dir=/Apps/marlin-cast/data/chrome-profile
--remote-debugging-port=9333
--password-store=basic
--no-first-run
--no-default-browser-check
```

`gnome-libsecret` does not appear anywhere in the command line.

Port binding, positively and negatively:

```
$ ss -tlnp | grep 9333
LISTEN 0 10  127.0.0.1:9333  0.0.0.0:*  users:(("chrome",pid=75253,fd=93))

$ bash -c '</dev/tcp/192.168.1.245/9333'
bash: connect: Connection refused
```

### Attach on the fresh profile — step 5e

```
attached: yes  (http://127.0.0.1:9333, Chrome 153.0.8010.36)
navigator.webdriver: false
tv.youtube.com: SIGNED OUT
url: https://tv.youtube.com/welcome/?utm_servlet=prod&rd_rsn=lo&zipcode=[REDACTED]
```

`SIGNED OUT` is correct — this profile was created seconds earlier and
nobody has logged in.

---

## (iii) Post-login cookie state — step 6b — NOT OBSERVED
## (iv) Playback result — step 6c — NOT OBSERVED
## (v) Relaunch results — step 6d — NOT OBSERVED
## (vi) New backup — step 6e — NOT OBSERVED

All four wait on the hand-login.

---

## (vii) What remains untested for Docker

Unchanged from Task 004 and not addressed here: **uid**. Every
portability arm so far has run as uid 1000. A volume mount commonly
presents a different uid, and if Chrome cannot write the profile it will
not behave like anything measured. Task 004 could not test it because
changing uid needs root and `sudo` is forbidden.

This task removes the *other* Docker blocker — the keyring dependency —
but only if the login in the new scheme holds. That is the open
question until step 6 runs.

---

## (viii) Files touched

| File | Step | Change |
|---|---|---|
| `notebook/DECISIONS.md` | 4 | D010 appended verbatim |
| `scripts/start-chrome.sh` | 5c | `--password-store=basic`; adjacent rationale comment updated to match and cite D010 |
| `data/chrome-profile-v11-20260911-104559/` | 5b | the old v11 profile, moved not deleted (gitignored) |
| `data/chrome-profile/` | 5d | fresh empty profile, created by the script (gitignored) |
| `notebook/reports/task-005-basic-scheme.md` | 9 | this report |

`src/login.ts` **not modified**, as step 7 requires. No capture code, no
ffmpeg, no encoder, no HLS server, no `/playlist`, no Dockerfile, no
workflow, no new dependencies, no Xvfb, no window sizing, no container.
Nothing binds 8804. The backup at
`backups/chrome-profile-loggedin-20260911-101619/` was not read from,
written to, or launched against in this task.

---

## (ix) Least certain

1. **That a login taken in the basic scheme survives at all.** Every
   surviving session so far has been `v11`. There is no measured reason
   the scheme should affect *durability* — `v10` and `v11` differ only
   in the key, not in what is stored — but it has not been observed, and
   the same was true of assumptions that later proved wrong.

2. **That Google treats the fresh profile the same.** This is a brand
   new profile on a machine that has now signed in and out several
   times. Task 002's login held on a fresh profile, so the precedent is
   good, but account-level suspicion is not something I can see.

3. **That `v10` is an acceptable cost.** It is the owner's call, already
   made in D010, and I am recording rather than questioning it — but it
   means the profile volume is the secret. Anyone who can read the
   Unraid share can take the session.

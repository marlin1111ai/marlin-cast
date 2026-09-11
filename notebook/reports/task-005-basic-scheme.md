# Task 005 — Convert to the basic cookie-encryption scheme

Date: 2026-09-11. Host: marlinpc. DISPLAY=:10.

**Status: complete, and it worked. The basic-scheme login holds, the
cookie store reads `v10`, playback is unchanged at 1920x1080 @ 60 fps,
and the session survived two clean relaunches.** The profile is now
portable to a container by construction.

No login was performed by me; the owner logged in by hand at step 5f.
`accounts.google.com` was never navigated to. Chrome is deliberately
left running — see step 10 at the end.

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

## (iii) Post-login cookie state — step 6b

**The tags read `v10`. Plainly: yes, they do.**

Confirmed signed in first (step 6a):

```
attached: yes  (http://127.0.0.1:9333, Chrome 153.0.8010.36)
navigator.webdriver: false
tv.youtube.com: signed in
```

Then a **100-second dwell** before reading, per KNOWN-FIXES:

| | Old v11 profile | **New basic profile** |
|---|---|---|
| Rows | 48 | **46** |
| Tags | `v11` | **`v10`** |
| Persistent | 47 | **45** |
| Auth-shaped | 17 | **17** |

**All 17 auth-shaped cookies are present** — the same set by name that
the v11 profile carried (`SID`, `HSID`, `SSID`, `APISID`, `SAPISID`,
`LOGIN_INFO`, `__Secure-1PSID`, `__Secure-3PSID`, `__Secure-1PSIDTS`,
`__Secure-3PSIDTS` across `.google.com` and `.youtube.com`). The
two-row difference is incidental — a fresh profile accumulates slightly
different ancillary cookies — and no auth cookie is missing.

The conversion did exactly what D010 intended: a full logged-in session,
encrypted with the hardcoded key, with no keyring involved.

---

## (iv) Playback result — step 6c

**Unchanged. The scheme change cost no capability.**

```
CHANNEL: TNT | guide channels: 153
PLAYBACK_START: {"found":true,"paused":false,"res":"1280x720","rs":4}
RESOLUTION: 1920x1080
FPS: 60.04 over 15.0s
DROPPED: 151 of 901 (16.8%)  media advanced 15.0s
WIDEVINE: {"SW_SECURE_CRYPTO":"granted","SW_SECURE_DECODE":"granted","HW_SECURE_ALL":"DENIED"}
```

Measured with `#movie_player video.html5-main-video` and
`setPlaybackQualityRange("hd1080","hd1080")`. Widevine is still **L3** —
software robustness granted, hardware denied — and still reaching 1080p.

Two details worth noting. Playback **started at 1280x720** and needed
the explicit quality pin to reach 1080p, because this is a fresh profile
whose window is not maximized — the Task 002 finding reproduced exactly,
and a good reminder that 1080p is never automatic. And the 16.8 % drop
is the same 50 Hz xrdp presentation artifact; the media clock advanced
15.0 s in 15.0 s, so decode is keeping up.

Screenshot: `notebook/reports/task-005-playback-basic-scheme.png` —
1211x1243, TNT playing, no account name or avatar; nothing to blur.
(The letterboxing is the un-maximized fresh-profile window.)

---

## (v) Relaunch results — step 6d

**Both cycles signed in.** Each was a graceful `SIGTERM`, a confirmed
port release, stale `Singleton*` cleared, and a restart through the
modified script.

| Cycle | Stop | Port | New pid | Attach | `webdriver` | State |
|---|---|---|---|---|---|---|
| 1 | clean (SIGTERM) | released | 76468 | yes | `false` | **signed in** |
| 2 | clean (SIGTERM) | released | 76888 | yes | `false` | **signed in** |

Cookie store across both, after a 100 s dwell:

| | Before relaunches | After two relaunches |
|---|---|---|
| rows / tags / persistent / auth | 46 / `v10` / 45 / 17 | **46 / `v10` / 45 / 17** |

Byte-for-byte the same counts. This reproduces Task 003's result in the
new scheme: nothing dropped, nothing re-encrypted, no auth cookie lost.

---

## (vi) New backup — step 6e

| | |
|---|---|
| Location | `backups/chrome-profile-basic-20260911-110129/` |
| Method | `cp -a`, source untouched |
| Source | 1842 files, 270,807,537 bytes |
| Copy | 1842 files, 270,807,537 bytes |
| Verification | **file count MATCH, byte size MATCH** |
| Cookie state in copy | **46 / `v10` / 45 / 17** |
| Gitignored | yes — `.gitignore:5:/backups/` |

**There are now three recoverable profiles on disk**, and it is worth
being clear about what each is for:

| Path | Scheme | Purpose |
|---|---|---|
| `data/chrome-profile` | `v10` | the live one, in use |
| `backups/chrome-profile-basic-20260911-110129/` | `v10` | backup of the live one — **the container-portable asset** |
| `data/chrome-profile-v11-20260911-104559/` | `v11` | the old session, moved aside (fallback) |
| `backups/chrome-profile-loggedin-20260911-101619/` | `v11` | Task 003's backup of that session (fallback) |

The two `v11` copies are **machine-bound** — Task 004 measured them
being destroyed by a single basic-scheme launch. They remain useful only
as a rollback on *this* host, and only if Chrome is put back on
`gnome-libsecret` first. They are not a Docker asset and should not be
treated as one.

---

## (vii) What remains untested for Docker

**The keyring blocker is gone.** The profile now in use carries no
`v11` rows at all, so there is nothing in it that a container without a
keyring would fail to decrypt. Combined with Task 004 — which showed
copying, relocating and re-permissioning a profile are all harmless —
this profile should mount into a container and work.

**What is still untested:**

1. **uid.** Unchanged from Task 004 and not addressed here. Every
   portability arm has run as uid 1000. A volume mount commonly presents
   a different uid, and if Chrome cannot write the profile it will not
   behave like anything measured. Testing it needs root, which `sudo`
   forbids, or a container, which is out of scope.
2. **No container has ever been run.** Every result in this project is
   from Chrome on marlinpc under xrdp. The image does not exist, so
   nothing about `/dev/dri` passthrough, the virtual display, or Chrome
   starting under a container's init has been observed.
3. **Durability beyond minutes.** The new login is roughly fifteen
   minutes old and has survived two relaunches. A reboot, a Chrome
   update, and `__Secure-*PSIDTS` rotation over days are all unobserved.

---

## (viii) Files touched

| File | Step | Change |
|---|---|---|
| `notebook/DECISIONS.md` | 4 | D010 appended verbatim |
| `scripts/start-chrome.sh` | 5c | `--password-store=basic`; adjacent rationale comment updated to match and cite D010 |
| `data/chrome-profile-v11-20260911-104559/` | 5b | the old v11 profile, moved not deleted (gitignored) |
| `data/chrome-profile/` | 5d | fresh empty profile, created by the script (gitignored) |
| `notebook/reports/task-005-basic-scheme.md` | 9 | this report |
| `notebook/reports/task-005-playback-basic-scheme.png` | 6c / 8 | 1080p playback evidence under the basic scheme |
| `backups/chrome-profile-basic-20260911-110129/` | 6e | backup of the new v10 profile (gitignored, **not committed**) |
| `notebook/SESSION-STATE.md` | house convention | Task 005 entry |
| `notebook/KNOWN-FIXES.md` | house convention | v10 login confirmed to hold and survive relaunch |

`src/login.ts` **not modified**, as step 7 requires. No capture code, no
ffmpeg, no encoder, no HLS server, no `/playlist`, no Dockerfile, no
workflow, no new dependencies, no Xvfb, no window sizing, no container.
Nothing binds 8804. The backup at
`backups/chrome-profile-loggedin-20260911-101619/` was not read from,
written to, or launched against in this task.

---

## (ix) Least certain

1. **That this holds beyond the short term.** The login is about
   fifteen minutes old. Two relaunches rule out luck; they do not prove
   durability across a reboot, a Chrome update, or days of
   `__Secure-*PSIDTS` rotation. Task 003 said the same of the `v11`
   session and that one did hold — but it was never asked to survive a
   week either.

2. **That the container will behave like this host.** Nothing here was
   run in a container. The keyring blocker is removed *by construction*
   — there are no `v11` rows left to fail on — but uid, `/dev/dri`,
   the virtual display and Chrome's behaviour under a container init are
   all unobserved. This task makes a container plausible; it does not
   make it proven.

3. **That `v10` is an acceptable cost.** D010 makes this the owner's
   call and I am recording rather than re-litigating it — but it is
   worth stating once more in evidence terms: the cookie store is now
   encrypted with a key anyone can derive, so the profile volume *is*
   the credential. Anyone who can read that path on Unraid can take the
   session. Filesystem permissions on the volume are now the only thing
   protecting it.

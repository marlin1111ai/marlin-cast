# Task 003 — Relaunch survival test

Date: 2026-09-11. Host: marlinpc. DISPLAY=:10.

**Result: the session survives a Chrome stop/start. Twice, cleanly.**
The fifth login was not spent — it is still live, and the backup taken
before the test was never needed.

No login was performed. `accounts.google.com` was never navigated to.
The restore path in step 5e was **not exercised**, because it is
conditional on a signed-out result and the result was signed in.

---

## (i) Backup — step 4

| | |
|---|---|
| Location | `backups/chrome-profile-loggedin-20260911-101619/` |
| Method | `cp -a` — full copy, source untouched |
| Source | 1408 files, 214,080,533 bytes |
| Copy | 1408 files, 214,080,533 bytes |
| Verification | **file count MATCH, byte size MATCH** |
| Gitignored | yes — `.gitignore:5:/backups/` |

**This backup is the rollback path.** If a future change loses the
session, restoring this directory over `data/chrome-profile` is the
recovery, and it is the only copy of a working logged-in profile that
exists. It is deliberately outside git and must stay that way — it
contains live authentication cookies.

`.gitignore` gained one line, `/backups/`, anchored to the repo root
in keeping with the trap already recorded in KNOWN-FIXES about
unanchored `data/`.

Before copying, the profile was quiesced as step 4a requires: playback
paused, the watch tab closed cleanly against a fresh `about:blank` tab,
then a **100-second dwell** before any read. That dwell is not optional
— KNOWN-FIXES records that a store read under ~60 s reports startup
state and silently measures nothing.

---

## (ii) Pre-stop cookie state — step 4c

Read from the live profile after the dwell, and independently from the
copy. Values were never read or printed; only names, counts and the
three-byte version tag.

| Measure | Source profile | Backup copy |
|---|---|---|
| Total rows | **48** | **48** |
| Encryption tags | **`v11`** (all) | **`v11`** (all) |
| Persistent rows | 47 of 48 | 47 of 48 |
| Auth-shaped cookies | 17 | 17 |

Hosts: `.youtube.com` x27, `.google.com` x13, `accounts.google.com` x6,
`.doubleclick.net` x2.

The auth-shaped set present by name — `SID`, `HSID`, `SSID`, `APISID`,
`SAPISID`, `LOGIN_INFO`, `__Secure-1PSID`, `__Secure-3PSID`,
`__Secure-1PSIDTS`, `__Secure-3PSIDTS`, across both `.google.com` and
`.youtube.com`. This is a genuine logged-in session on disk, not a
residual anonymous one, and every row is `v11` — the keyring-backed
scheme. That last detail matters more than it looks; see (vi).

---

## (iii) Relaunch result — step 5a–5c

**Signed in.**

Stop was graceful — `SIGTERM` to the browser process, **no `SIGKILL`
was sent at any point**:

```
$ kill -TERM 70364
pid 70364 gone (exited on SIGTERM, no SIGKILL sent)
$ ss -tlnp | grep 9333
port 9333 released
```

Restarted with `scripts/start-chrome.sh`, same profile, same flags, new
pid. Attach:

```
$ npm run login
attached: yes  (http://127.0.0.1:9333, Chrome 153.0.8010.36)
navigator.webdriver: false
tv.youtube.com: signed in
url: https://tv.youtube.com/
detached (Chrome left running)
```

One observation worth carrying: `SIGTERM` left the `Singleton*` lock
files behind (`SingletonLock -> pop-os-70364`), where a clean in-app
quit removes them. Chrome reclaimed the stale lock on restart without
complaint. It is not a problem here, but a supervisor that restarts
Chrome in a container will hit the same stale locks after any
non-graceful stop, and PrismCast's own entrypoint removes them
explicitly at startup for exactly this reason.

---

## (iv) Playback after relaunch, and the second cycle — step 5d

**Playback works in the relaunched session**, at full quality:

```
CHANNEL: TNT | guide channels: 153
PLAYBACK_START: {"found":true,"paused":false,"res":"1920x1080","rs":4}
RESOLUTION: 1920x1080
FPS: 60.03 over 15.0s
DROPPED: 150 of 901 (16.6%)  media advanced 15.0s
```

Measured with `#movie_player video.html5-main-video` and
`setPlaybackQualityRange("hd1080","hd1080")`, per KNOWN-FIXES. The
16.6 % drop is the same 50 Hz xrdp presentation artifact recorded in
Task 002 — the media clock advanced 15.0 s in 15.0 s, so decode is
keeping up.

Two things differed from Task 002 and are worth noting. The guide
enumerated **153** channels this time against 150 before — the lineup
reading is not a fixed number and a channel list must not assume one.
And the stream arrived at **1920x1080 before** the quality was pinned,
because the maximized window bounds from Task 002 persisted in the
profile; the setter was still issued, and the 720p default behaviour
from Task 002 should be assumed to be the norm on a fresh window.

**Second stop/start cycle — also signed in:**

```
pid 72399 gone (SIGTERM only)
port 9333 released
new browser pid: 72933
attached: yes  (http://127.0.0.1:9333, Chrome 153.0.8010.36)
navigator.webdriver: false
tv.youtube.com: signed in
```

**Cookie store after both relaunches, compared to the pre-stop reading:**

| Measure | Pre-stop | After two relaunches |
|---|---|---|
| Total rows | 48 | **48** |
| Tags | `v11` | **`v11`** |
| Persistent | 47 | **47** |
| Auth-shaped | 17 | **17** |

Unchanged. Nothing was dropped, re-encrypted, or re-issued. This is the
clean opposite of the 001b/001c signature, where a relaunch took the
store to 0 rows or flipped every tag to `v10`.

Screenshot: `notebook/reports/task-003-playback-after-relaunch.png` —
full-bleed 1080p, no account name, avatar or player chrome; nothing to
blur. It happens to capture an ad break, which is itself useful: ads
play inline at the same resolution, so a capture pipeline will record
them and cannot assume programme content only.

---

## (v) Signed-out branch — step 5e — NOT EXERCISED

Conditional on a signed-out result, which did not occur. The restore
from backup was therefore **not performed and not tested**.

That leaves a real gap, and it is the one that matters for Docker: this
task proves a profile survives a **restart in place**, not that a
**copied or moved** profile survives. Those are different operations,
and a container start is the second one. Flagged in (vi) and (viii)
rather than tested, because testing it was explicitly scoped to the
signed-out branch.

---

## (vi) What this means for Docker

The relaunch result removes the fear that drove Tasks 001b and 001c —
an owner-launched Chrome that the app only ever attaches to keeps its
session across a full stop/start, with the cookie store arriving
byte-identical on the far side, twice. A container that stops and
starts its Chrome against a persistent profile volume should therefore
keep the login, and the app's attach model needs no change to
accommodate restarts. **But the profile's cookies are all `v11`, which
is the gnome-libsecret keyring scheme, and a stock container has no
gnome-keyring at all.** With no keyring to resolve,
`--password-store=gnome-libsecret` cannot do what it does here; Chrome
falls back, and 001c measured exactly what a scheme mismatch costs — a
profile's persistent rows going 6 → 0 on the first launch that cannot
decrypt them. So the evidence supports "restart-safe on this host" and
warns specifically against assuming the *same profile directory* can be
carried into a container unchanged: either a keyring must be provided
inside the image, or the container must use `--password-store=basic`
consistently and take its own hand-login in that scheme. Which of those
is right is a decision, not a finding, and it is untested either way.

---

## (vii) Files touched — step mapping

| File | Step | Change |
|---|---|---|
| `.gitignore` | 4b | added `/backups/` so the profile backup cannot be committed |
| `backups/chrome-profile-loggedin-20260911-101619/` | 4b | full profile backup — gitignored, **not committed** |
| `notebook/reports/task-003-relaunch-survival.md` | 8 | this report |
| `notebook/reports/task-003-playback-after-relaunch.png` | 5d / 7 | 1080p playback evidence after relaunch |
| `notebook/SESSION-STATE.md` | house convention | Task 003 entry |

`src/login.ts`, `scripts/start-chrome.sh` and `package.json` were **not
modified** — this task was read-only except the report, as step 1
requires. No capture code, no ffmpeg, no encoder, no HLS server, no
`/playlist`, no Dockerfile, no workflow, no new dependencies, no Xvfb,
no window-sizing changes. Nothing binds 8804.

---

## (viii) Least certain

1. **That a copied profile behaves like a restarted one.** Everything
   here restarted Chrome against the profile *in place*. A container
   start mounts a volume — closer to a copy or a move, possibly with a
   different uid, path and mount semantics. Step 5e would have tested
   restore-from-backup, but only on the signed-out branch, so it never
   ran. This is the single largest untested assumption and the obvious
   next experiment; the backup exists precisely so it can be tried
   without risking the live profile.

2. **That two relaunches generalise.** Two is enough to rule out luck
   and not enough to call it durable. Both happened within about ten
   minutes, on one host, with a session hours old. Whether it holds
   across a reboot, a Chrome update, or a week of `__Secure-*PSIDTS`
   rotation is unobserved.

3. **The keyring conclusion in (vi) is reasoning, not measurement.** I
   did not run Chrome in a container and watch it fail. It chains a
   measured fact from this task (every row is `v11`) to a measured fact
   from 001c (a scheme mismatch wipes persistent rows) — but the
   container itself was never touched, per the do-not-touch list, and
   the chain could break somewhere I cannot see from here.

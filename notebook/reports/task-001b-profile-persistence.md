# Task 001b — Diagnose Chrome profile persistence

Date: 2026-09-11. Host: marlinpc. DISPLAY=:10.

**Root cause found, fix applied and mechanically verified. The owner's
original login is not recoverable and must be redone by hand — the
reason is in section (iii). Playback was therefore never reached, so
the 1080p/fps question in step 7 is NOT OBSERVED.**

---

## (i) Profile inventory — step 4a

`data/chrome-profile/` is a real, fully-initialised Chrome user-data
directory, not an empty shell. **A `Default/` subdirectory exists**, and
it is the only profile directory — no `Profile 1`, no `Guest Profile`.

Where the files that matter actually live:

| File | Path | Size | mtime (at inventory) |
|---|---|---|---|
| Cookies | `Default/Cookies` | 32768 | 2026-09-11 09:14:36.678 |
| Login Data | `Default/Login Data` | 40960 | 2026-09-11 08:37:49.541 |
| Local State | `Local State` (top level) | 12211 | 2026-09-11 09:14:36.687 |
| Preferences | `Default/Preferences` | 42676 | 2026-09-11 09:14:36.680 |
| Web Data | `Default/Web Data` | 196608 | 2026-09-11 09:14:18.536 |
| First Run | `First Run` (top level) | 0 | 2026-09-11 09:11:13.466 |
| EULA Accepted | `EULA Accepted` (top level) | 0 | 2026-09-11 09:11:13.435 |

`Last Version` contained `153.0.8010.36`, matching the installed
Chrome. `WidevineCdm/` is present at the top level.

### Timeline, reconstructed from mtimes

Three distinct Chrome runs are visible, and the owner's hand-login is
**not** the most recent one:

| Time | Evidence | What it was |
|---|---|---|
| 08:37:49 | `Login Data`, `Affiliation Database`, `Code Cache` | Task 001's Playwright probe |
| 09:11:13 | `First Run` + `EULA Accepted` created | owner's plain-Chrome start (first-run dialog) |
| 09:12:39–09:12:53 | `Default/Accounts/`, `AccountBookmarks`, `Account Web Data` | **the owner signing in** |
| 09:14:05.5237835330 | `Last Version` **and** `~/.config/google-chrome/Crash Reports/settings.dat` — identical to the nanosecond | a **second** Chrome startup |
| 09:14:36 | `Cookies`, `Local State`, `Preferences`, profile root | that second Chrome exiting cleanly |

The 09:14:05 startup is `npm run login`. It ran **after** the
hand-login and wrote the cookie store on the way out at 09:14:36. So
the last process to own this cookie DB was Playwright's Chrome, not the
owner's.

Cookie store contents at inventory: **13 cookies total** — `.youtube.com`
x9, `accounts.google.com` x2, `.google.com` x1. All 13 had a non-empty
`encrypted_value` and an empty plaintext `value`; every one carried the
prefix **`v10`**. A signed-in Google session carries far more than one
`.google.com` cookie. All values are [REDACTED] and were never read —
only host names, counts, and the three-byte version tag were inspected.

---

## (ii) Path comparison — step 4b

**They are the same directory. The profile path was never the problem.**

Owner's plain Chrome:

```
/usr/bin/google-chrome --user-data-dir=/Apps/marlin-cast/data/chrome-profile
```

Playwright's actual launch, captured live with `DEBUG=pw:browser`
(abridged only where marked; the two switches that matter are verbatim):

```
/opt/google/chrome/chrome --disable-field-trial-config
  --disable-background-networking ... [~40 further default switches] ...
  --no-first-run --password-store=basic --use-mock-keychain
  --no-service-autorun ... --disable-sync --enable-unsafe-swiftshader
  --no-sandbox --start-maximized
  --user-data-dir=/Apps/marlin-cast/data/chrome-profile
  --remote-debugging-pipe about:blank
```

Neither side passes `--profile-directory`, so both use `Default`.
`--user-data-dir` is byte-identical. The binary differs in path only
(`/opt/google/chrome/chrome` is what `/usr/bin/google-chrome`
symlinks into) and both report `153.0.8010.36`.

**The difference that matters is `--password-store=basic`, which
Playwright injects and the owner's launch does not.**

---

## (iii) Root cause — step 4d

**One sentence:** Playwright forces `--password-store=basic`, so its
Chrome derives the cookie-encryption key from a hardcoded string and
cannot decrypt the keyring-encrypted cookies the owner's plain Chrome
wrote — it silently discards them, shows a signed-out session, and then
rewrites the cookie store in its own scheme, destroying the login.

### The evidence chain

**1. Playwright does touch this profile — step 4c.** No Chrome was
running before the test; no `Singleton*` lock files were present
(clean prior exit). Snapshot around one Playwright launch:

| | `Default/Cookies` sha256 | mtime |
|---|---|---|
| before | `f471a4da…e530` | 09:14:36.678 |
| after | `126a3696…4f7b` | 09:18:54.609 |

`Local State` changed identically (`4a3b37de…` → `60e2116e…`). So
Playwright **re-initialises and overwrites** the store; it does not lock
it out or write elsewhere.

**2. The encryption schemes genuinely differ — controlled test.** Two
throwaway profiles, same Chrome binary, same target, same
`--no-first-run --no-default-browser-check`, the *only* variable being
the flag:

| Arm | Flags | Result |
|---|---|---|
| A | (none — Chrome autodetects, as the owner's launch did) | 10 cookies, prefixes **`['v11']`** |
| B | `--password-store=basic` (Playwright's flag) | 10 cookies, prefixes **`['v10']`** |

`v11` is the keyring-backed scheme (gnome-libsecret); `v10` is the
hardcoded-key scheme. `gnome-keyring-daemon` is running with its
`secrets` component and `DBUS_SESSION_BUS_ADDRESS` resolves for both
the xrdp session and this SSH shell, so the keyring is reachable from
either — the flag, not the environment, decides the scheme.

**3. The observed profile is consistent with the damage.** At inventory
the store held 13 cookies, **all `v10`** — Playwright's rewrite. The
owner's `v11` login cookies are not there. They were not corrupted or
orphaned; they were overwritten at 09:14:36.

### Ruled out, with evidence

- **Wrong directory / missing `Default`** — identical `--user-data-dir`
  on both sides; `Default/` exists and is the only profile.
- **A second stray profile** — no `Profile *` or `Guest *` dirs;
  `~/.config/google-chrome` holds only `Crash Reports`, no profile.
- **Stale lock files / a running Chrome blocking access** — no
  `Singleton*` files, `pgrep chrome` empty before launch.
- **Keyring unreachable from the SSH shell** — disproved by arm A,
  which wrote `v11` from this very shell.
- **`--disable-sync` signing the profile out** — Chrome *profile* sync
  is a separate mechanism from website cookies; the signed-out state is
  a `.google.com` / `.youtube.com` cookie question, and the cookie
  store visibly lost its rows.

---

## (iv) Fix applied — step 5

One change, inside the permitted envelope (a Playwright launch arg; the
profile path was correct and is untouched):

```ts
args: ["--start-maximized", "--password-store=gnome-libsecret"],
```

Playwright appends caller `args` after its own defaults, and **Chrome
honours the last occurrence of a repeated switch.** Verified before
relying on it: a third throwaway profile launched with
`--password-store=basic --password-store=gnome-libsecret` in that order
produced 11 cookies, prefixes **`['v11']`** — the appended flag wins.

The verification run's own logged command line shows both, ours last:

```
--password-store=basic ... --password-store=gnome-libsecret
```

A comment in `src/login.ts` records why, so the flag is not tidied away
later. No other change was made to the file.

---

## (v) Verification result — step 7

**tv.youtube.com shows SIGNED OUT.** Not a blind retry — a single run
through the app after the fix, then a stop.

```
FINAL_URL: https://tv.youtube.com/welcome/?utm_servlet=prod&rd_rsn=lo&zipcode=[REDACTED]
STATE: {"hasSignIn":true, ...}
```

Screenshot: `notebook/reports/task-001b-after-fix.png` (signed out —
no account name or email is present to blur). `rd_rsn=lo` is the
logged-out redirect reason.

**This is the expected result, and it does not mean the fix failed.**
The owner's `v11` login cookies were destroyed at 09:14:36, before this
task began, by the very `npm run login` that surfaced the symptom. A
launch flag cannot resurrect deleted rows.

**The fix is verified at the mechanism level instead.** After the fixed
run the profile's cookie store holds **43 cookies carrying both `v10`
and `v11`** prefixes — the `v11` rows are new ones this fixed launch
wrote through the keyring, in exactly the scheme plain Chrome uses. The
two launch paths now agree on the key. (Before the fix, every row was
`v10`.) Cookie count also rose 13 → 43 across `.youtube.com` x23,
`.google.com` x13, `accounts.google.com` x6, `.doubleclick.net` x1 —
anonymous/consent cookies, not a session.

**Playback resolution and frame rate: NOT OBSERVED.** Reaching the
player needs a signed-in session, which does not currently exist. The
Widevine-L3-to-1080p question from Task 001 remains open and is still
the project's most important unknown.

### What the owner does next

The profile now holds a mix of dead `v10` rows and live `v11` rows. The
clean path:

```
rm -rf /Apps/marlin-cast/data/chrome-profile
cd /Apps/marlin-cast && DISPLAY=:10 npm run login
```

Log in over Jump Desktop in the Chrome window that opens — **that window
is now itself keyring-backed, so logging in there is enough and no
separate plain-Chrome step is needed.** Press Enter to close. Re-run
`npm run login`: it should come up signed in. The wipe is recommended,
not required — it only removes undecryptable leftovers — and was
deliberately left to the owner rather than done here.

---

## (vi) Files touched — step 6 mapping

| File | Step | Change |
|---|---|---|
| `src/login.ts` | 5 | the one permitted code fix — appended `--password-store=gnome-libsecret` plus an explanatory comment |
| `notebook/reports/task-001b-profile-persistence.md` | 9 | this report |
| `notebook/reports/task-001b-after-fix.png` | 7 | verification screenshot |

**Also written — Task 001 leftovers the brief's arrival unblocked, not
new scope.** `MARLIN-CAST-BRIEF.md` was absent for both Task 001 runs
and is present now, so the two deliverables Task 001 step 5c could not
produce were completed:

| File | Step | Change |
|---|---|---|
| `notebook/BRIEF-v1.md` | Task 001 5c | copy of the brief, as 5c required |
| `notebook/DECISIONS.md` | Task 001 5c | D001–D006 recorded verbatim, replacing the "NOT RECORDED" placeholder; D004 marked superseded by D007; D007/D008 untouched |
| `notebook/KNOWN-FIXES.md` | house convention | the `v10`/`v11` trap and its fix recorded |

Flagged rather than assumed: if any of those three were meant to stay
out of 001b, say so and they come straight back out.

Nothing else was created. No capture code, no ffmpeg, no encoder, no
HLS server, no `/playlist`, no Dockerfile, no workflow, no new
dependency, no `@types/node`. Nothing bound a port.

---

## (vii) What I am least sure of

1. **Whether a keyring-backed hand-login will actually survive into
   Playwright.** The key scheme now matches on both sides, which is the
   thing that was broken — but that is an inference from the encryption
   tags, not an observation of a surviving session. Only the owner's
   next login proves it, and it is the first thing to check.

2. **Whether Google's bot detection will accept a sign-in performed in
   the Playwright-launched window.** Task 001 recorded
   `navigator.webdriver === true` there, and the owner already hit
   "This browser or app may not be secure" once. The instructions above
   assume logging in inside the app's own window now works because the
   keyring objection is gone — but if that wall reappears, the fallback
   is a plain-Chrome hand-login, which **now shares the key scheme and
   so should carry across.** Both routes are available; neither is
   observed.

3. **Whether `gnome-libsecret` is the right store if the desktop
   changes.** `XDG_CURRENT_DESKTOP` is unset in the xfce4-session
   environment, so Chrome's autodetect is not reading what it normally
   reads, yet arm A still produced `v11`. The flag now pins the
   behaviour explicitly, which is more predictable than autodetect —
   but in Docker on Unraid there will likely be no keyring at all, and
   this flag will need revisiting for that environment. It is correct
   for marlinpc today; it is not automatically correct for the
   container.

# Task 001c — Cookie destruction: reproduced without Google

Date: 2026-09-11. Host: marlinpc. DISPLAY=:10. No Google account was
used, no login was performed, `accounts.google.com` was never
navigated to. Every arm ran on a throwaway profile under the session
scratchpad; none touched `data/chrome-profile`.

**Headline: the 001b fix does hold. Playwright, with
`--password-store=gnome-libsecret`, preserves persistent cookies
byte-for-byte the same as plain Chrome — including Google's. The
premise this task was given, that the Playwright launch is still
destroying the session locally, is disproven by the arms below. The
session is dying for some other reason, and the leading candidate is
server-side.**

`src/login.ts` was therefore not modified. Step 6 permits a change only
if step 4e names a specific arg, and 4e names none beyond the flag
already present.

---

## (i) Reproduction result — step 4

Cookie source: `github.com` (non-Google, sets `_octo` and `logged_in`
with 2027 expiries — confirmed with `curl -I`, values [REDACTED]).
Only counts, tags, sizes, mtimes, hashes and cookie **names** are
reported; no cookie value was ever read or printed.

Two false starts are recorded for honesty: `en.wikipedia.org` set no
persistent cookie (0 rows), and a 25-second dwell produced 0 rows
because **Chrome batches cookie commits** — the store was last written
at startup. A 70-second dwell before shutdown fixed it. Any future test
of this kind needs that dwell or it silently measures nothing.

### The arms

All start from one plain-Chrome baseline profile, copied per arm.

| Arm | What ran | Rows | Tags |
|---|---|---|---|
| **baseline** | plain Chrome, visits github, clean quit | **6** | `v11` |
| **C** | Playwright, `login.ts`'s exact current config, revisits github | 6 | `v11` |
| **D** | Playwright, **no** `--password-store` override, revisits github | 6 | **`v10`** |
| **E** | Playwright + fix, `about:blank` only | **2** | `v11` |
| **F** | Playwright **without** fix, `about:blank` only | **0** | — |
| **CONTROL** | **plain Chrome**, `about:blank` only | **2** | `v11` |

Arms C and D revisit github, which re-sets cookies and masks any
deletion — that is why arms E, F and CONTROL navigate nowhere. They are
the ones that carry the finding.

### What the 6 baseline rows actually were

```
.github.com  _octo                 has_expires=1 persistent=1
.github.com  logged_in             has_expires=1 persistent=1
.github.com  cpu_bucket            has_expires=0 persistent=0
.github.com  preferred_color_mode  has_expires=0 persistent=0
.github.com  tz                    has_expires=0 persistent=0
github.com   _gh_sess              has_expires=0 persistent=0
```

**Two persistent, four session cookies.** After Arm E the survivors were
exactly `_octo` and `logged_in` — the two persistent ones. After the
plain-Chrome CONTROL the survivors were **exactly the same two**.

Dropping session cookies across a browser restart is what every browser
does. **Arm E is indistinguishable from plain Chrome.**

---

## (ii) What the Playwright launch actually does to the cookie store

**With `--password-store=gnome-libsecret` (current `login.ts`):**

- The file is **rewritten** — sha changes (`4e35370f…` → `6302f909…`)
  and mtime advances — but it is not truncated, not replaced, and the
  profile is not re-initialised. Size stayed 20480 throughout.
- **Every persistent row survives, with its `v11` tag intact.**
- Session-only rows (`has_expires=0`) are dropped, exactly as plain
  Chrome drops them.

**Without the override (Playwright's default `--password-store=basic`):**

- Arm F: 6 rows → **0 rows**. The persistent rows are destroyed, not
  merely unreadable.
- Arm D shows why this is easy to misread: revisiting the site
  repopulated the store to 6 rows again, but tagged `v10` — the same
  count, entirely different cookies. A count alone would have looked
  like nothing happened.

**This confirms 001b's mechanism and shows the fix is load-bearing:**
remove the flag and the store is wiped; keep it and nothing persistent
is lost.

### Google-domain cookies specifically

Because the owner's symptom is a Google session, the same test was run
on Google's own domain — anonymously, no account, no sign-in.

Plain Chrome visiting `tv.youtube.com` produced **10 rows, all `v11`**,
9 persistent + 1 session (`YSC`). After a Playwright + fix launch with
no site revisit:

```
survivors: NID, VISITOR_INFO1_LIVE, VISITOR_PRIVACY_METADATA,
           __Secure-ROLLOUT_TOKEN, __Secure-YNID,
           _ga, _ga_[REDACTED], _ga_[REDACTED], _gcl_au    (9 of 9 persistent)
dropped  : YSC   (the only has_expires=0 row)
```

**All nine persistent Google cookies survived, `__Secure-` prefixed ones
included.** Playwright does not treat Google's cookies specially, and it
does not destroy them.

---

## (iii) Which arg or behaviour is responsible

**For local destruction: `--password-store=basic`, and nothing else —
already fixed in 001b.** Arms E and F differ in that flag alone and
produce 2 rows versus 0. No further arg-stripping was needed, because
with the flag present the result already matches plain Chrome exactly;
there is no residual destruction left for another arg to explain.

**`launchPersistentContext` itself does not re-initialise the profile.**
Stated explicitly as step 4e asks: it opens the directory in place,
rewrites the cookie file on exit, and preserves persistent rows. The
`Default/` profile is reused, not recreated.

**For the owner's actual symptom: NOT DETERMINED.** The local-destruction
explanation is ruled out by the evidence above, so something outside
this machine's cookie store is ending the session.

### Ruled out, with evidence

- **Playwright wiping the cookie store** — Arm E preserves every
  persistent row; identical to plain Chrome.
- **Playwright singling out Google cookies** — 9 of 9 persistent
  `.youtube.com` rows survived.
- **The `v10`/`v11` mismatch still biting** — every row after a fixed
  run carries `v11`, the same tag plain Chrome writes.
- **A silent keyring fallback** — see (iv); the keyring resolves in
  both contexts.
- **Profile re-initialisation / truncation / replacement** — size
  constant at 20480, `Default/` reused, rows preserved.

### The leading hypothesis, labelled as inference, not observation

The owner reports that **plain Chrome reopened on that profile afterwards
is also signed out.** A purely local decryption fault cannot produce
that: plain Chrome writes and reads `v11` and would still read its own
rows. Combined with the arms above — persistent Google cookies demonstrably
survive the launch — the remaining explanation is that the session is
being invalidated **server-side**, by Google, once it is used from a
browser Google flags as automated. That is the same detection that
produced the "This browser or app may not be secure" wall the owner
already hit.

A second candidate that could not be tested: Google auth cookies may be
**device-bound** (Chrome's Device Bound Session Credentials). If the
binding check fails under a CDP-attached browser, Chrome itself can
invalidate them. Testing this needs a real logged-in session, which
step 3 forbids. **Not observed.**

Both are consistent with `navigator.webdriver === true`, which Task 001
recorded for `launchPersistentContext` — and which section (v) shows is
avoidable.

---

## (iv) Keyring reachability — step 4f

Reachable and **unlocked in both contexts**, resolving to the same
daemon. No silent fallback in either.

| Context | `DBUS_SESSION_BUS_ADDRESS` | `login` collection `Locked` |
|---|---|---|
| this SSH session | `unix:path=/run/user/1000/bus` | `false` |
| the `:10` desktop session (read from `xfce4-panel` pid 20481) | `unix:path=/run/user/1000/bus` | `false` |

Collections present: `/org/freedesktop/secrets/collection/session` and
`/…/login`. Daemon: `gnome-keyring-daemon` pids 21050 and 21051, the
latter carrying `--components=pkcs11,secrets`.

Empirical confirmation beyond the D-Bus query: plain Chrome launched
**from this SSH shell** wrote `v11` cookies in the baseline arm. `v11`
is by definition the keyring-backed scheme, so `gnome-libsecret`
genuinely resolved rather than falling back to `basic`.

---

## (v) CDP attach viability — step 5

**It works, and it sidesteps the Playwright-owns-the-profile problem
entirely.** Tested against a throwaway profile on github.com.

Chrome launched independently, outside Playwright:

```
/usr/bin/google-chrome --user-data-dir=<throwaway> \
  --no-first-run --no-default-browser-check --remote-debugging-port=9333
```

Then `chromium.connectOverCDP("http://127.0.0.1:9333")`:

```
CONNECTED. version: 153.0.8010.36
contexts: 1   pages in ctx0: 1
PROBE: {"webdriver":false,"ua":"Mozilla/5.0 (X11; Linux x86_64) ... Chrome/153.0.0.0 ...","title":"GitHub · ..."}
can screenshot: true
browser.close() returned
=> Chrome still alive after browser.close()
```

**`navigator.webdriver === false`.** Under `launchPersistentContext`
Task 001 recorded it as `true`. That single difference is the most
consequential thing in this report: it is the flag most likely to be
feeding the automation detection that is plausibly killing the session.

Full automation capability was confirmed, not assumed: navigation,
`evaluate`, and screenshot all worked through the attached connection.

### What it costs

- **Chrome's lifecycle becomes ours to manage.** Playwright no longer
  starts, supervises, or restarts it. Something must launch Chrome,
  notice when it dies, and bring it back.
- **`browser.close()` only detaches** — it leaves Chrome running. That
  is a feature here (the profile is never Playwright's to re-initialise)
  but it means shutdown is now an explicit job, and Task 001's "leave no
  process running" rule needs a deliberate answer.
- **The debugging port is an unauthenticated local control channel.**
  Anything that can reach it can drive the browser and read the logged-in
  session. It must stay bound to loopback, and in the Unraid container it
  must not be published.
- **Chrome flags are ours to choose**, which is the upside: no
  `--password-store=basic` is injected, so the 001b problem cannot recur
  by construction.
- **Not tested:** whether Google's detection also keys on the CDP
  attachment itself rather than just `navigator.webdriver`. `webdriver:false`
  is necessary, not proven sufficient. **Not observed.**

---

## (vi) Recommendation

**Move to CDP attach against an independently-launched Chrome.**

**The one reason:** it is the only configuration tested that reports
`navigator.webdriver === false`, and automation detection is now the
best-supported explanation for the session loss that local cookie
forensics has ruled out.

This is the owner's call, and `src/login.ts` was deliberately left
alone. Two things to weigh before committing to it: the session-loss
cause is inferred, not proven, so this may not fix it; and it will not
be proven either way without spending another login. If another login
is to be spent, spend it on this design rather than on the current one,
since the current one has now been tested as far as it can be without
an account.

---

## (vii) Files touched — step mapping

| File | Step | Change |
|---|---|---|
| `notebook/reports/task-001c-cookie-destruction.md` | 8 | this report |
| `notebook/KNOWN-FIXES.md` | 8 | corrected the 001b entry — it overstated the fix's failure mode and is now scoped to what the arms actually show |
| `notebook/SESSION-STATE.md` | house convention | Task 001c entry |

**`src/login.ts` was NOT modified** — step 6 allows a change only if 4e
identifies a specific arg, and it does not.

Every throwaway profile (`P1`–`P5`, `G1`, `G2`, `D1`) lived under the
session scratchpad, outside the repo, and was deleted. No capture code,
no ffmpeg, no encoder, no HLS server, no `/playlist`, no Dockerfile, no
workflow, no new dependency. One port was bound transiently: `9333`, by
the throwaway Chrome for the CDP test, since testing step 5 is
impossible otherwise; it is not on the forbidden list and that Chrome
was killed.

---

## (viii) Least certain

1. **That server-side revocation is the real cause.** It is an inference
   from elimination plus the owner's "plain Chrome is also signed out"
   observation — not a measurement. I could not test it without an
   account, and I did not. If it is wrong, the next candidate is
   device-bound session credentials, which is equally untested.

2. **That CDP attach actually survives Google's detection.**
   `navigator.webdriver === false` is real and measured, but it is one
   signal. Google fingerprints far more than that, and a CDP-attached
   browser may still be detectable. Treating `webdriver:false` as a fix
   would be over-reading my own evidence.

3. **Whether anything in the 001b incident is still confounding the
   owner's profile.** These arms all ran on clean throwaway profiles.
   `data/chrome-profile` has been through several `v10`/`v11` rewrites
   and may hold dead rows that muddy any further test on it. Any next
   attempt should start from a freshly deleted profile — as should have
   been true after 001b.

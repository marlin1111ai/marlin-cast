# Task 002 — CDP attach

Date: 2026-09-11. Host: marlinpc. DISPLAY=:10.

**Status: stopped at step 6c, as instructed, awaiting the owner's
hand-login.** Sections (i)–(iii) and (vii) are complete. Sections
(iv)–(vi) — playback, resolution, frame rate, Widevine level,
deep-link pattern, player selectors — are **NOT OBSERVED** and are
filled in only after the owner confirms he is logged in.

No login was performed. `accounts.google.com` was never navigated to.
Chrome is deliberately left running (pid 70364) — see (vii) and step 11.

---

## (i) D009 recorded — step 4

Appended verbatim to `notebook/DECISIONS.md`, after D008. It supersedes
Task 001's `launchPersistentContext` approach.

The old `data/chrome-profile` was deleted whole (step 5a) before
anything else ran, so nothing in this task inherits the dead `v10`/`v11`
rows from the 001b incident. The profile now in place was created fresh
by `scripts/start-chrome.sh`.

---

## (ii) Port binding proof — step 6a

`scripts/start-chrome.sh` prints its endpoint and stays in the
foreground:

```
Marlin Cast — Chrome
  profile      : /Apps/marlin-cast/data/chrome-profile
  display      : :10
  CDP endpoint : http://127.0.0.1:9333  (loopback only)
```

**Listening on loopback only:**

```
$ ss -tlnp | grep 9333
LISTEN 0 10  127.0.0.1:9333  0.0.0.0:*  users:(("chrome",pid=70364,fd=82))
```

Proven negatively as well as positively — this box's LAN address is
192.168.1.245:

```
$ ss -tln | grep 9333 | grep -v 127.0.0.1
(no output — no non-loopback listener)

$ bash -c '</dev/tcp/192.168.1.245/9333'
bash: connect: Connection refused
```

`--remote-debugging-address` is deliberately **not** passed. Chrome binds
the debugging port to loopback by default; naming another address is
exactly what would expose it, so the safest thing the script can do is
say nothing.

**Chrome's actual flags**, read back off the running process:

```
$ ps -o args= -p 70364 | tr ' ' '\n' | grep '^--'
--user-data-dir=/Apps/marlin-cast/data/chrome-profile
--remote-debugging-port=9333
--password-store=gnome-libsecret
--no-first-run
--no-default-browser-check
```

Only `--password-store=gnome-libsecret` is present — Playwright's
`--password-store=basic` is **not** being injected, because Playwright
is not launching this Chrome. There is no `--remote-debugging-pipe`,
which is the tell of a Playwright-launched browser. `--no-first-run` and
`--no-default-browser-check` are there solely to keep a first-run wizard
from sitting in front of the login window; they are noted rather than
assumed to be free.

The DevTools websocket URL that Chrome prints carries a per-session
token and is [REDACTED] throughout this report. The port number, 9333,
is not a secret and appears as-is.

---

## (iii) Attach result — step 6b

```
$ npm run login
attached: yes  (http://127.0.0.1:9333, Chrome 153.0.8010.36)
navigator.webdriver: false
tv.youtube.com: SIGNED OUT
url: https://tv.youtube.com/welcome/?utm_servlet=prod&rd_rsn=lo&zipcode=[REDACTED]
detached (Chrome left running)
```

**`navigator.webdriver` reads `false`.** Under Task 001's
`launchPersistentContext` it read `true`. That inversion is the entire
point of D009, and it is now confirmed in the real app path rather than
in a throwaway test.

`SIGNED OUT` is expected and correct — the profile was created minutes
earlier and nobody has logged in. `rd_rsn=lo` is the logged-out redirect
reason. Screenshot: `notebook/reports/task-002-attached-signed-out.png`
(signed out; no account name or email present to blur).

The not-running path was checked too, since it is the line the owner
will actually hit if he forgets:

```
$ npm run login          # with no Chrome up
No Chrome is listening on http://127.0.0.1:9333.

Start it first, in a terminal on the marlinpc desktop:
    cd /Apps/marlin-cast && ./scripts/start-chrome.sh

Leave that running, then run this again.
$ echo $?
1
```

---

## (iv) Playback result — step 7b — NOT OBSERVED

Requires a logged-in session. Nothing was navigated, clicked, or played.

## (v) Resolution, frame rate, Widevine level — step 7c — NOT OBSERVED

This is the priority finding and it remains open. Task 001 established
that Widevine **L3 is available and L1 is not** on this host; whether
YouTube TV grants 1080p at L3 is still unmeasured, and it is what
decides whether D006's quality target is reachable.

## (vi) Channel deep-link pattern and player selectors — step 7d — NOT OBSERVED

Task 001c recorded PrismCast's documented pattern
(`https://tv.youtube.com/watch/<id>`, guide at `/live`, thumbnails at
`ytu-endpoint.tenx-thumb[aria-label]`, CSS-based fullscreen rather than
the Fullscreen API). **That is another project's reading, not this
session's observation**, and it is not promoted to a finding here until
verified against a live logged-in player.

---

## (vii) Session survival across detach — step 7e

Confirmed, at least for the signed-out session:

```
$ npm run login        # ends with browser.close()
detached (Chrome left running)

$ pgrep -f 'user-data-dir=/Apps/marlin-cast/data/chrome-profile'
70364                       # still alive

$ ss -tln | grep 127.0.0.1:9333
LISTEN ...                  # port still listening
```

`browser.close()` on a CDP-attached browser detaches the client and
leaves Chrome running, matching what task-001c found. A second
screenshot run attached again afterwards and succeeded, so repeated
attach/detach cycles work.

**Whether a logged-in session survives detach is NOT OBSERVED** — that
is the same question as (iv) and waits on the owner.

---

## (viii) Files touched — step mapping

| File | Step | Change |
|---|---|---|
| `notebook/DECISIONS.md` | 4 | D009 appended verbatim |
| `data/chrome-profile/` | 5a | deleted whole; recreated fresh by the script (gitignored, not in the repo) |
| `scripts/start-chrome.sh` | 5b | new — the script the owner runs |
| `src/login.ts` | 5c | rewritten to `connectOverCDP`; launches nothing, creates no profile, passes no profile path |
| `package.json` | 5d | two scripts: `chrome` and `login`. Dependencies untouched |
| `notebook/reports/task-002-cdp-attach.md` | 10 | this report |
| `notebook/reports/task-002-attached-signed-out.png` | 9 | attach evidence |

No capture code, no ffmpeg, no encoder, no HLS server, no `/playlist`,
no channel list, no Dockerfile, no workflow, no Xvfb, no `@types/node`,
no new dependencies. Nothing binds 8804. The only port bound is 9333,
by the owner's Chrome, on loopback.

---

## (ix) OPEN QUESTIONS

1. **Does the hand-login survive at all under this design?** This is the
   fourth login being spent. D009 rests on an inference from task-001c —
   that automation detection drove server-side invalidation — and
   `navigator.webdriver === false` is the one measured thing supporting
   it. If the session dies again, the inference was wrong and the next
   suspect is device-bound session credentials, which cannot be tested
   without yet another login.

2. **Does Google's sign-in page accept a login in this window at all?**
   The window is an ordinary Chrome the owner launched, with a debug port
   open. Task 001b's wall appeared in a Playwright-*launched* Chrome. A
   CDP-attached one is a different proposition, but it is untested until
   the owner tries.

3. **`--no-first-run` / `--no-default-browser-check`** are conveniences,
   not requirements. If there is any suspicion they contribute to
   fingerprinting, they can be dropped at the cost of the owner clicking
   through a wizard once. Not investigated.

4. **Chrome's lifecycle is now the owner's**, by design. Nothing
   restarts it if it dies, and nothing stops it. That is fine for
   development and is an open question for the container.

---

## (x) Least certain

1. **That this fixes anything.** Everything verified here is mechanism —
   the port is loopback, the attach works, `webdriver` is `false`. None
   of it is evidence that the YouTube TV session will now persist. That
   is one hand-login away from being known, and I would not bet the
   project on it before then.

2. **That `webdriver:false` is the signal that mattered.** It is the one
   difference I could measure between the two designs. Google
   fingerprints far more than that, and a CDP-attached browser may still
   be identifiable. Reading this as "detection solved" would be
   over-reading my own evidence.

3. **That a fresh profile plus a fresh login is a clean test.** The
   profile is new, but the account has now been signed in and signed out
   several times from a machine Google may already have flagged. If
   there is account-level suspicion, a clean profile does not clear it,
   and a failure here would not cleanly indict the design.

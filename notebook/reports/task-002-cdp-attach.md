# Task 002 — CDP attach

Date: 2026-09-11. Host: marlinpc. DISPLAY=:10.

**Status: complete. YouTube TV plays under CDP attach, at 1920x1080
@ 59.96 fps, on Widevine L3.** The owner logged in by hand at step 6c;
step 7 then ran in that same attached session without restarting
Chrome.

No login was performed by me. `accounts.google.com` was never navigated
to. Chrome is deliberately left running (pid 70364) — see (vii) and
step 11.

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

`SIGNED OUT` is expected and correct at this point — the profile was
created minutes earlier and nobody had logged in yet. After the owner's
hand-login the same command reported `signed in`; see (iv). `rd_rsn=lo` is the logged-out redirect
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

## (iv) Playback result — step 7b

**It plays. No wall of any kind.**

Step 7a first confirmed the hand-login carried into the attached
session — the thing three previous attempts failed to do:

```
$ npm run login
attached: yes  (http://127.0.0.1:9333, Chrome 153.0.8010.36)
navigator.webdriver: false
tv.youtube.com: signed in
url: https://tv.youtube.com/
```

The live guide at `https://tv.youtube.com/live` loaded signed-in and
enumerated **150 channels**. A national channel (TNT) was chosen
deliberately so no local-market detail enters this report.

Navigating the deep link started playback on its own — no play click
was needed, and no consent, ad, or "unsupported browser" interstitial
appeared. The player UI reported `Pause (k)`, `LIVE`, and a running
clock, and the media clock advanced 15.0 s over 15.0 s of wall time.

**One diagnostic trap, recorded because it nearly produced a false
negative:** the page carries **40 `<video>` elements**, and
`document.querySelector("video")` returns an empty one —
`readyState: 0`, `networkState: 0`, `0x0`. My first probe read that
element and concluded playback had not started. It had. The active
element is index 6 and must be selected on content, not position:

```js
document.querySelector("#movie_player video.html5-main-video")   // verified
// or: pick the <video> with videoWidth > 0 && !paused
```

---

## (v) Resolution, frame rate, Widevine level — step 7c

**Measured at 1920x1080 @ 59.96 fps.** This is the finding that decides
D006, and the answer is that the 1080p target is reachable.

| | Value |
|---|---|
| Delivered resolution | **1920x1080** |
| Measured frame rate | **59.96 fps** (900 frames / 15.0 s) |
| Player's own readout | `1920x1080@60 / 1920x1080@60` |
| Video codec | `vp09.00.51.08.01.01.01.01.00` — **VP9**, not H.264 |
| Audio codec | `mp4a.40.2` — AAC-LC |
| Bandwidth | ~43,133 Kbps |
| DRM string | `IT/WVA/hd2160/UHD1,HD,SD,AUDIO/UKS./20708/KR` |

**Widevine level: L3 (software).** Probed live against the running
player:

```
SW_SECURE_CRYPTO : granted
SW_SECURE_DECODE : granted
HW_SECURE_CRYPTO : DENIED
HW_SECURE_DECODE : DENIED
HW_SECURE_ALL    : DENIED
```

**So L3 does reach 1080p on YouTube TV.** Task 001 flagged the opposite
as a live risk — that an L3-only client might be capped below 1080p.
Measured, it is not. That risk is closed.

### 1080p is not automatic — it must be asked for

This is the operationally important part. Left alone, the player served
**720p**, and it kept serving 720p through two escalations:

| State | Player box | Delivered |
|---|---|---|
| as landed | 1211x681 | 1280x720 (`hd720`) |
| after page fullscreen (`f`) | 1211x681 | 1280x720 (`hd720`) |
| after maximizing the **window**, then fullscreen | 2252x1267 | 1280x720 (`hd720`) |
| after `setPlaybackQualityRange("hd1080","hd1080")` | 2252x1267 | **1920x1080 (`hd1080`)** |

`getAvailableQualityLevels()` listed `hd1080` the whole time. Page
fullscreen alone did nothing, because the Chrome *window* was only
1219 px wide on a 2468 px screen — fullscreen inside a small window is
still small. Even once the window was maximized and the player box was
2252x1267, ABR stayed at 720p; only the explicit setter moved it.

**Capture will therefore need to pin quality explicitly.** Relying on
window size or fullscreen to coax 1080p out of ABR does not work here.

### Dropped frames — a display artifact, not a decode problem

Steady **16.7 % dropped** (150 of 900 in the measurement window). That
is almost exactly 1/6, which is what dropping 60 fps content onto a
**50 Hz** display produces — and `xrandr` reports this xrdp screen as
`2468x1381 50.00*`, recorded back in Task 001.

The decode path is keeping up: the media clock advanced 15.0 s in
15.0 s. The drops are at presentation. This matters for Task 003,
because any capture method that reads the composited screen inherits
the 50 Hz ceiling, while one that taps the decoder or the compositor's
video layer need not. It is a reason to be careful about benchmarking
capture on this xrdp session.

---

## (vi) Channel deep-link pattern and player selectors — step 7d

**Deep link — confirmed live, against the owner's own lineup:**

```
guide     : https://tv.youtube.com/live
channel   : https://tv.youtube.com/watch/<VIDEO_ID>?vp=<opaque>
```

Navigating that URL directly starts the channel. The `?vp=` parameter
was present on every guide href; whether it is required was **not
tested** — the link was used as the guide supplied it.

**Channel enumeration — PrismCast's selector verified on the live
DOM**, 150 matches:

```js
document.querySelectorAll("ytu-endpoint.tenx-thumb[aria-label]")
// aria-label = "watch <CHANNEL NAME>"  -> strip the leading "watch "
// child <a> href = "watch/<ID>?vp=..." -> prefix with https://tv.youtube.com/
```

Task 001c carried this as PrismCast's documented reading, explicitly
not promoted to a finding. It is now **observed directly** and holds.

**Player and fullscreen:**

| Purpose | Selector / action |
|---|---|
| player root | `#movie_player` |
| active video | `#movie_player video.html5-main-video` |
| fullscreen button | `button[aria-label="Full screen (f)"]` (classes `yib-button style-scope ytu-icon-button`) |
| fullscreen via keyboard | press `f` |
| quality control | `#movie_player.setPlaybackQualityRange("hd1080","hd1080")` |
| available qualities | `#movie_player.getAvailableQualityLevels()` |
| live stats | `#movie_player.getStatsForNerds()` |

**UI hiding:** while playing, `#movie_player` carries the class
`ytp-hide-controls` on its own — the chrome auto-hides without
intervention. PrismCast's CSS-overlay approach (`position:fixed`,
`100%`, `cursor:none`) was **not needed and not tested** here; the
native fullscreen path produced a clean full-bleed frame, as the
screenshot shows.

Screenshot: `notebook/reports/task-002-playback-1080p.png` — 2468x1267,
fullscreen 1080p playback, no account name, avatar, or player chrome
visible; nothing to blur.

**A note on window management.** Maximizing had to be done at the
browser level, over CDP, because the app no longer launches Chrome and
so cannot pass `--start-maximized`:

```js
const s = await ctx.newCDPSession(page);
const { windowId } = await s.send("Browser.getWindowForTarget");
await s.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "maximized" } });
```

This is reported, not built — no window management was added to
`src/login.ts`.

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

**The logged-in, actively-playing session also survives detach**, now
measured. After `browser.close()`, a fresh attach reported:

```
REATTACH: {"signedOut":false,"playing":true,"res":"1920x1080"}
```

Chrome pid 70364 was still alive, the port still listening, the session
still signed in, and playback still running at 1080p. Attach/detach
cycles ran repeatedly across step 7 with no loss of session — six
separate attachments in total.

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
| `notebook/reports/task-002-attached-signed-out.png` | 9 | attach evidence, pre-login |
| `notebook/reports/task-002-playback-1080p.png` | 7c / 9 | 1080p playback evidence |

No capture code, no ffmpeg, no encoder, no HLS server, no `/playlist`,
no channel list, no Dockerfile, no workflow, no Xvfb, no `@types/node`,
no new dependencies. Nothing binds 8804. The only port bound is 9333,
by the owner's Chrome, on loopback.

---

## (ix) OPEN QUESTIONS

1. **How durable is the session?** It survived six attach/detach cycles
   and roughly twelve minutes of continuous playback. It has **not**
   survived a Chrome restart, a reboot, or a day — none of which were
   tested. The three previous losses all happened across a *relaunch*,
   which this design avoids by never relaunching. That is encouraging,
   not proven.

2. **Is `?vp=` required on the deep link?** Every guide href carried it
   and the link was used verbatim. A bare
   `https://tv.youtube.com/watch/<ID>` was **not tested**. Worth knowing
   before a channel list is built, since it decides whether IDs alone
   are enough to store.

3. **VP9, not H.264.** The stream arrives as VP9 at ~43 Mbps. Any
   capture design that assumed an H.264 decode path needs to account for
   this — including whether the Unraid box's UHD 770 has VP9 *decode*
   (it does) and what that means for a VAAPI encode chain.

4. **The 50 Hz display ceiling.** 16.7 % of frames are dropped at
   presentation on this xrdp screen. Benchmarking any capture method
   here will under-report frame rate unless the method bypasses the
   composited screen. A 60 Hz virtual display would be a fairer test
   bench.

5. **Quality must be pinned explicitly.** ABR would not leave 720p on
   its own even at a 2252x1267 player size. Whether
   `setPlaybackQualityRange` holds across ad breaks, channel changes, or
   stream restarts is **not observed**, and it is the kind of thing that
   silently regresses to 720p mid-recording.

6. **Window sizing now lives outside the app.** Since Chrome is
   owner-launched, nothing passes `--start-maximized`. Either
   `scripts/start-chrome.sh` grows a window-size flag, or the app sets
   bounds over CDP as shown in (vi). Raising it rather than deciding it,
   per the scope lock.

---

## (x) Least certain

1. **That the session keeps holding.** Everything here was measured
   inside one continuous Chrome process. The failures in 001b/001c all
   occurred across a relaunch. I believe D009 addresses the cause, but
   the discriminating test — log in, stop Chrome, start it again, attach
   — has deliberately **not** been run, because it risks the login and
   nobody asked me to spend it. It is the single most valuable next
   experiment.

2. **That `navigator.webdriver === false` is why it worked.** It is the
   one measured difference between this design and the one that kept
   failing, and the session did survive this time. That is correlation
   across a single trial, with a fresh profile and a fresh login as
   confounds. I would not yet state it as the mechanism.

3. **That 1080p is stable rather than momentary.** I measured 15 s at
   1920x1080 after forcing the quality, and a further re-attach
   confirmed 1080p was still current. Whether it survives an ad break,
   a bandwidth dip, or an hour of running is unmeasured — and 720p is
   what the player reverts to by default.

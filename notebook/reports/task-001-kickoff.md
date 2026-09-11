# Task 001 — Kickoff: scaffold, manual login, read-only investigation

Date: 2026-09-11. Host: marlinpc (Pop!_OS 24.04 LTS, Linux x86_64,
kernel 7.0.11). No capture code was written. No process was left
running.

**Two steps did not complete, and neither is a soft failure:**
`MARLIN-CAST-BRIEF.md` was never supplied, and the manual login (5e)
requires the owner at a desktop session. Both are detailed below in
their own sections rather than buried in OPEN QUESTIONS.

---

## (i) Prerequisite results — step 5a

All command output, run on marlinpc 2026-09-11. Not from memory.

| Check | Result | Verdict |
|---|---|---|
| `node --version` | `v22.23.2` | PASS (22+) |
| `ffmpeg -version` | `ffmpeg version 6.1.1-3ubuntu5` | PASS |
| `git --version` | `git version 2.43.0` | PASS |
| `google-chrome --version` | `Google Chrome 153.0.8010.36` | PASS |
| `ls -l /dev/dri` | `card0` (226,0 root:video), `renderD128` (226,128 root:render), `by-path/` | PASS |

`ffmpeg -version` reports `--enable-vaapi` prerequisites present in its
configuration line, including `--enable-libdrm`, `--enable-opencl` and
`--enable-libvpl`. The presence of `renderD128` plus this ffmpeg build
is what D007 relies on for testing VAAPI during development.

Per the task, `gh` was not checked and is not required.

---

## (ii) Login persistence proof — step 5e — NOT OBSERVED

**Status: blocked, awaiting the owner. This step was not completed.**

### The display, which the task asked to be named

The task proposed `DISPLAY=:0` and said to find the live display if
`:0` was wrong. **`:0` is wrong. The live display is `:10`.**

Evidence:

```
$ ps -eo pid,user,args | grep '[X]org'
20222 marlinai /usr/lib/xorg/Xorg :10 -auth .Xauthority \
  -config xrdp/xorg.conf -noreset -nolisten tcp -logfile .xorgxrdp.%s.log

$ ls -la /tmp/.X11-unix/
srwxrwxr-x 1 cosmic-greeter cosmic-greeter 0 Sep 10 23:00 X0
srwxrwxrwx 1 marlinai       marlinai       0 Sep 11 00:10 X10
```

`X0` belongs to `cosmic-greeter` — that is the display manager's login
greeter, not a user session, and Chrome launched there would not be
visible to the owner. `:10` is the xrdp Xorg session owned by
`marlinai`, which is what Jump Desktop connects to.

`:10` was confirmed reachable and sized:

```
$ DISPLAY=:10 xdpyinfo | head -3
name of display:    :10
version number:     11.0
vendor string:      The X.Org Foundation

$ DISPLAY=:10 xrandr
Screen 0: minimum 256 x 256, current 2468 x 1381, maximum 16384 x 16384
rdp0 connected 2468x1381+0+0 0mm x 0mm
   2468x1381     50.00*
```

**Note the refresh rate: 50.00 Hz.** The xrdp virtual screen is 50 Hz,
not 60. Any capture method that reads this X display inherits a 50 fps
ceiling. This matters to step 5g and is revisited there.

### Why the step could not complete

`src/login.ts` is written, runs, and launches Chrome on `:10`
correctly (proven in section iii). Completing 5e requires a human to
type Google credentials into the Chrome window on marlinpc's desktop.
Per the task's own rule — *"Google's login page — you never type into
it. The owner logs in by hand"* — that human is the owner, over Jump
Desktop, and the owner was not present during this run.

A waiting Chrome process was not left running, because constraint 7
forbids it.

### What the owner does to finish this step

```
ssh into marlinpc, then:
cd /Apps/marlin-cast && DISPLAY=:10 npm run login
```

Connect Jump Desktop to marlinpc, log in to YouTube TV in the Chrome
window that appeared, return to the terminal and press Enter.
`src/login.ts` then writes a screenshot to
`notebook/reports/login-state-<timestamp>.png`, prints the final URL,
and closes Chrome cleanly. Running the same command a second time
without logging in is the persistence proof: if the profile persisted,
the second run lands on the guide rather than the welcome page.

**Neither run has happened. No persistence claim is made here.**

---

## (iii) tv.youtube.com findings — step 5f — PARTIAL

5f asks for observation "in the logged-in Chrome." There is no
logged-in Chrome, so **the logged-in half of 5f is NOT OBSERVED.** What
follows separates strictly into two categories: what this session
directly observed logged out, and what PrismCast's source documents.
The second category is cited reference, not observation, and is
labelled so on every line.

### A. Directly observed — logged-out, Playwright-driven real Chrome

Method: `chromium.launchPersistentContext` with `channel: "chrome"`,
headed, `DISPLAY=:10`, profile at `data/chrome-profile`, navigate to
`https://tv.youtube.com`, wait 6 s, inspect the DOM, screenshot, close.
This is navigation and DOM inspection only — no playback was started,
no channel was tuned.

**The `channel: "chrome"` path resolved on the first attempt. The
`executablePath: /usr/bin/google-chrome` fallback in `src/login.ts` was
never exercised and is therefore NOT OBSERVED as working.**

**Finding 1 — Playwright launches the installed Chrome and the site
loads.** Landing URL after redirect:

```
https://tv.youtube.com/welcome/?utm_servlet=prod&rd_rsn=lo&zipcode=[REDACTED]
```

Page title: `YouTube TV - Watch & DVR Live Sports, Shows & News`.
`rd_rsn=lo` is the logged-out redirect reason. The site geolocated the
request and echoed a ZIP into the URL — [REDACTED] here.

**Finding 2 — no wall of any kind.** Screenshot:
`notebook/reports/task-001-prelogin-no-wall.png` (logged out; no
account name, no email, nothing to blur). It shows the ordinary
YouTube TV marketing page rendered normally at 2468x1211 — the full
nav bar, a playing background video, the network logo grid, and the
sign-in button. There is **no "unsupported browser" interstitial, no
CAPTCHA, and no automation-detection block.** The 600-character body
text sample was ordinary marketing copy (plans, pricing, NFL Sunday
Ticket) with no error language.

**Finding 3 — Widevine is present and functional under automation.**
This is the load-bearing finding of the task. Probed in-page with
`navigator.requestMediaKeySystemAccess`:

| Key system + robustness | Result |
|---|---|
| `com.widevine.alpha`, `SW_SECURE_CRYPTO`, `avc1.42E01E` | **`AVAILABLE: com.widevine.alpha`** |
| `com.widevine.alpha`, `HW_SECURE_ALL`, `avc1.640028` | `FAILED: NotSupportedError` |

Widevine **L3 is available**; **L1 is not**. L1 absence is expected for
desktop Chrome on Linux. The consequence is flagged in OPEN QUESTIONS —
L3 is what governs the resolution ceiling a service will grant, and
whether YouTube TV grants 1080p at L3 was **not observed.**

**Finding 4 — automation is detectable.**

```
navigator.webdriver === true
```

User agent carried no `HeadlessChrome` token:
`Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36`

YouTube TV did not act on `navigator.webdriver` at the marketing page.
**Whether it acts on it at the playback gate was not observed** — that
is the single most important unknown left in this task.

**Finding 5 — two `<video>` elements** were present on the logged-out
welcome page (`document.querySelectorAll("video").length === 2`). These
are marketing background videos, not the player. The real player was
NOT OBSERVED.

### B. NOT observed by this session — PrismCast's documented approach

Cited from a read-only clone of `github.com/hjdhjd/prismcast`. No code
was copied into this project. These answer 5f's questions *on paper*
and give the owner a head start, but they are **another project's
findings against its own Chrome, not this session's observation**, and
they must be verified after login before anything is built on them.

**Channel selection — deep link, not DOM interaction.** The guide is
`https://tv.youtube.com/live` (`src/browser/tuning/youtubeTv.ts:337`,
`:416`). Channels are enumerated in one pass because the EPG grid is
**not virtualized** — all ~256 channel rows are in the DOM at once
(`youtubeTv.ts:419-420`). The selector:

```
document.querySelectorAll("ytu-endpoint.tenx-thumb[aria-label]")
```

(`youtubeTv.ts:161`). Channel name comes from the `aria-label` with the
leading `"watch "` stripped (`youtubeTv.ts:163-165`, `:176`); the watch
path comes from the child `<a>`'s `href` (`youtubeTv.ts:170-171`), kept
only when it starts with `watch/` — hrefs containing `live` or
`browse/` are premium add-ons or info pages and are excluded
(`youtubeTv.ts:173-174`). The final deep link is composed as
`YOUTUBE_TV_BASE_URL + "/" + watchPath` (`youtubeTv.ts:242`, with the
base at `:14`), i.e.:

```
https://tv.youtube.com/watch/<id>
```

So a channel **is** directly deep-linkable once its id is known, and
the guide is scraped once to build that map.

**Fullscreen — CSS, not the Fullscreen API.** PrismCast does not call
`requestFullscreen()` on YouTube TV. It applies CSS directly to the
`<video>` element (`src/browser/video.ts:763-787`): `position: fixed`,
`top/left: 0`, `width/height: 100%`, `object-fit: contain`,
`max-height/max-width: none`, `background: black`, `cursor: none`, a
forced `z-index`, and `transform/scale/rotate/translate/transition`
all neutralized — optionally with `!important`
(`video.ts:749`). The stated reason (`video.ts:763-765`) is that CSS
"doesn't require user gesture and can't be" fought by site JavaScript
the way the native API can. `cursor: none` (`video.ts:746`) is
specifically to keep the pointer out of the captured frame.

**Playback under automation.** PrismCast drives Chrome with
`--autoplay-policy=no-user-gesture-required`
(`src/browser/index.ts:1122`, rationale at `:1091`: "Essential for
automated streaming"). It uses **Puppeteer**, not Playwright
(`package.json:36`, `puppeteer-core` at `:80`). That PrismCast ships a
working YouTube TV profile at all is strong circumstantial evidence
that DRM playback survives automation — but it is circumstantial, and
it was **not reproduced here.**

**Resolution and frame rate at 1080p: NOT OBSERVED.** Nothing in this
session measured the player's delivered resolution or frame rate,
because the player was never reached. PrismCast's default target frame
rate is 60 (`src/types/config.ts`, `frameRate` field), and its capture
is held to explicit dimension and frame-rate bounds as tabCapture
mandatory media constraints (`src/browser/tabCapture.ts:81`) — but that
is PrismCast's *request*, not a measurement of what YouTube TV
*delivers*, and the two are not the same number.

---

## (iv) Capture-method comparison and recommendation — step 5g

### What PrismCast actually does

The README's phrasing is misleading and worth correcting up front.
README line 54 says *"FFmpeg capture - FFmpeg-based screen capture
provides stable, reliable streaming for long recordings."* **This is
not screen capture, and ffmpeg does not encode the video.**

The repository contains **no `x11grab` anywhere** — verified by
`grep -rn 'x11grab' .` over the full clone, which returns nothing.

What actually happens: a Chrome **extension** captures the tab via
`chrome.tabCapture`, feeds a `MediaRecorder`, and ships chunks over a
WebSocket (`src/browser/tabCapture.ts:6`, importing `getExtensionPage`
and `wss` from `puppeteer-stream` at `:26`; extension loaded via
`--disable-extensions-except` / `--load-extension` at
`src/browser/index.ts:1497`). `CaptureMode` is
`"ffmpeg" | "native"` (`src/types/config.ts:305`) and the two modes
differ only in **container and audio handling**
(`src/types/config.ts:297-303`):

- `"ffmpeg"`: MediaRecorder emits Matroska (H264+Opus); ffmpeg
  transcodes **audio only** to AAC. Video is codec-copy.
- `"native"`: MediaRecorder emits fMP4 (H264+AAC) directly, no ffmpeg.

`"native"` is **force-coerced to `"ffmpeg"` at startup and rejected on
live reload** (`src/config/index.ts:404`, `:433`, `:464`) because
"Chrome's native fMP4 MediaRecorder produces corrupt output after 20-30
minutes of recording" (`src/types/config.ts:301-302`). That is a real,
dated trap worth carrying forward.

**Video encoding therefore always happens inside Chrome**, hardware-
accelerated when the GPU allows. PrismCast caches Chrome's encoder
capabilities (`src/browser/display.ts:21-34`: `av1HardwareEncoding`,
`h264HardwareEncoding`, `hevcHardwareEncoding`, `renderer`) and gates
codec choice on them (`src/streaming/codec.ts:77`). ffmpeg's whole job
is audio transcode plus a codec-copy fMP4→MPEG-TS remux for Plex
(`src/streaming/mpegts.ts:21`).

**CDP screencast is not used for capture.** `grep -rn 'startScreencast'
src/` returns nothing. `src/browser/cdp.ts:10-20` uses CDP only for
window presentation and device-metrics re-affirmation. That file also
records a constraint that bites any tab-capture design: *"Chrome's tab
capture consumes the compositor's output for the shared window, and a
minimized window's output is not composed for capture to read"*
(`cdp.ts:13-15`). The window must stay composited.

**Docker uses Xvfb with GPU backing.** `docker-entrypoint.sh:63-76`
builds `-vfbdevice /dev/dri/renderD128` for the LinuxServer Xvfb
binary, "which connects the virtual framebuffer to the GPU's DRM device
and enables DRI3 hardware-accelerated rendering. Without this, Chrome
sees software GL only and **disables VAAPI**." It is skipped on NVIDIA
hosts (`:69-71`). x11vnc + noVNC are started alongside so an operator
can complete provider logins in the container (README:253) — the same
problem as this task's 5e.

### The comparison

"Docker + /dev/dri" below assumes the Unraid deploy in D007.

| | 1. Extension tabCapture → MediaRecorder | 2. CDP `Page.startScreencast` | 3. `getDisplayMedia` → MediaRecorder | 4. Xvfb/X11 + ffmpeg `x11grab` |
|---|---|---|---|---|
| **fps ceiling** | 60 (constraint-bound, `tabCapture.ts:81`) | ~10–15 realistic; ack-per-frame protocol | 60 | Display refresh — **50 on this xrdp session**; 60 under a fresh Xvfb |
| **Quality ceiling** | High. Encodes from the compositor at the emulated surface size, independent of real screen | **Low.** Lossy JPEG stills, base64 over the DevTools socket | High | **Highest** — raw framebuffer, lossless into the encoder |
| **CPU cost** | Low when Chrome's HW encoder is live; moderate otherwise | **High** — per-frame JPEG encode + base64 + JSON | Low–moderate | **Highest** — raw RGB scrape, then a full encode pass |
| **Headless vs virtual display** | Needs a composited window; PrismCast ships Xvfb. Window must not be minimized (`cdp.ts:13-15`) | Works truly headless | Needs a display | Needs X — Xvfb is exactly the point |
| **Docker + /dev/dri** | Yes, and it is the reason for `-vfbdevice` DRI3 (`docker-entrypoint.sh:63-76`) | Yes, but gains nothing from the GPU | Yes | Yes |
| **Feeds a VAAPI encode path** | **Indirectly but really** — Chrome's own encoder uses VAAPI via DRI3; ffmpeg never encodes video | Only by re-encoding JPEGs — the lossy cost is already paid | Same as 1 | **Directly** — `-vaapi_device /dev/dri/renderD128 -c:v h264_vaapi` |
| **Audio** | **Tab audio in the same MediaStream**, muxed by MediaRecorder — A/V sync free | **None.** Entirely separate path required | Tab audio yes; system audio on Linux unreliable | **Separate** — PulseAudio null sink + `-f pulse`, sync is your problem |
| **In use by PrismCast** | **Yes — this is the shipping path** | No (`startScreencast` absent) | No | No (`x11grab` absent from the repo) |

A fifth method, ffmpeg `kmsgrab`, was considered and is **not viable
here**: it needs DRM master on a real KMS plane, which an Xvfb virtual
framebuffer inside a container does not provide.

### Recommendation — for the owner to rule on

**Recommend method 1, the extension tab-capture path.**

**The single reason:** it is the only method that yields video and tab
audio as one already-synchronized, already-hardware-encoded stream —
every other method leaves you to capture audio separately and solve A/V
drift yourself, which is the failure mode that makes long DVR
recordings unwatchable.

**The honest caveat, which the owner must weigh:** PrismCast gets this
path from `puppeteer-stream`, which is **Puppeteer-only**. This project
is on Playwright per the dependency budget. There is no drop-in
Playwright equivalent, so taking this recommendation means either
writing and bundling a small capture extension ourselves, or revisiting
the driver choice. Method 4 (`x11grab`) needs none of that and works
with Playwright as it stands today — it trades the A/V sync problem for
zero browser-cooperation cost. That trade is the actual decision, and
it is not mine to make.

---

## (v) OPEN QUESTIONS

1. **Where is `MARLIN-CAST-BRIEF.md`?** It was absent on both the
   original and reissued runs. D001–D006 are unrecorded — see the
   explicit gap marker in `notebook/DECISIONS.md`, which guesses
   nothing. `notebook/BRIEF-v1.md` **was deliberately not created**: a
   placeholder file under that name could later be mistaken for the
   brief itself, and an absent file is safer than a misleading one.

2. **Does YouTube TV actually play under Playwright-driven Chrome?**
   Widevine L3 is available and no wall appeared logged out, but the
   playback gate was never reached. `navigator.webdriver === true` is
   visible to the site. This is the project's central risk and it
   remains **unresolved**.

3. **Does Widevine L3 get 1080p from YouTube TV?** L1 is unavailable
   on this host. Many services cap L3 clients below 1080p. If YouTube
   TV does, the 1080p target in the task may be unreachable on Linux
   desktop Chrome at any quality setting — a constraint that would
   outrank every capture-method consideration in section iv.

4. **The 50 Hz xrdp display.** `rdp0` runs at 50.00 Hz. Method 4 would
   inherit that ceiling during development on this session, producing
   50 fps and misleading test results versus a 60 Hz Xvfb in Docker.
   Method 1 is immune, since it captures the compositor at an emulated
   surface rather than the screen.

5. **Playwright vs `puppeteer-stream`** — see the caveat in section
   iv. This may be a D-level decision rather than an implementation
   detail, since it touches the dependency budget.

6. **`@types/node` is outside the four-dependency budget**, so
   `src/login.ts` cannot be type-checked — `tsc` fails with
   `TS2688: Cannot find type definition file for 'node'`. `tsx` runs
   the file regardless (esbuild strips types without checking), so
   nothing is broken at runtime. Flagging rather than fixing, per the
   scope lock: adding `@types/node` would be a fifth dependency.
   **What breaks without it:** no type safety on any Node API in this
   project, now or later.

7. **`typescript` was pinned to `^5.9.3`, not the `7.0.2` that
   `npm view` reports as latest.** TypeScript 7 is the native port and
   a large behavioural change; the sibling project pins the 5.9 line
   (`/Apps/marlin-iptv-editor/package.json`). Nothing compiles TS in
   this project yet, so this is cheap to revisit — but it was a
   judgment call, not an instruction, and the owner may overrule it.

8. **`.gitignore` uses `/data/`, anchored, rather than bare `data/`.**
   The task said "data/". The sibling project's KNOWN-FIXES records
   that an unanchored `data/` silently swallows any directory named
   `data` at any depth, and that the resolved fix was to anchor it.
   Anchoring still ignores `data/chrome-profile/` as required. Noted
   because it is a deliberate deviation from the literal wording.

---

## (vi) SCOPE CHECK

Every file created by this task, mapped to the step that required it.

| File | Required by | Note |
|---|---|---|
| `.git/` (init, branch `main`) | 5b | remote `origin` added; remote pre-existed, not created |
| `package.json` | 5d | exactly playwright, express, typescript, tsx |
| `package-lock.json` | 5d | npm byproduct of installing the four |
| `.gitignore` | 5d | `node_modules/`, `dist/`, `/data/`, `*.log` |
| `data/chrome-profile/` | 5d | gitignored; created, empty until 5e runs |
| `src/login.ts` | 5d | the only file in `src/` |
| `notebook/SESSION-STATE.md` | 5c | Task 001 entry, newest at bottom |
| `notebook/DECISIONS.md` | 5c | D007, D008 verbatim; D001–D006 marked absent |
| `notebook/KNOWN-FIXES.md` | 5c | empty template |
| `notebook/OPEN-ITEMS.md` | 5c | live items only |
| `notebook/reports/` | 5c | directory |
| `notebook/reports/task-001-kickoff.md` | 9 | this file |
| `notebook/reports/task-001-prelogin-no-wall.png` | 5f / 8 | evidence for Finding 2; logged out, nothing to redact |

Commit `Task 001: kickoff — scaffold, login, investigation` contains
all ten tracked paths above. It is local only — see section (vii).

**Required but NOT created:**

| File | Required by | Why not |
|---|---|---|
| `notebook/BRIEF-v1.md` | 5c | source brief never supplied; a placeholder under this name would be mistakable for the brief |
| `notebook/reports/login-state-*.png` | 5e | manual login not performed; owner must run `npm run login` |

**Not created, and correctly so** (scope lock, step 6): no capture
code, no ffmpeg invocation, no encoder, no HLS server, no `/playlist`
endpoint, no channel list, no Dockerfile, no GitHub Actions workflow,
no test framework, no linter, no config system, no logging library, no
fifth dependency. Nothing bound a port. `express` is installed per the
budget but is **not imported anywhere** — correct for this task.

The PrismCast clone used for section iv lives in the session
scratchpad, outside this tree, and nothing was copied from it.

---

## (vii) Push status — step 5b / step 9 — BLOCKED ON AUTH

**The commit exists locally. It was NOT pushed. `origin/main` does not
exist yet.**

The push failed on authentication, which is step 5b's named stop
condition. Exact error:

```
$ git push -u origin main
fatal: could not read Username for 'https://github.com': terminal prompts disabled
```

(`GIT_TERMINAL_PROMPT=0` was set deliberately so the command failed
fast with a readable error instead of hanging on an interactive
prompt. Without it the failure is the same, just blocking.)

Diagnosis — no HTTPS credential exists on this host:

| Probe | Result |
|---|---|
| `git config --get-all credential.helper` | none configured |
| `~/.git-credentials` | does not exist |
| `GH_TOKEN` / `GITHUB_TOKEN` in env | not set |

**SSH, however, authenticates right now:**

```
$ ssh -T git@github.com
Hi marlin1111ai! You've successfully authenticated, but GitHub does not provide shell access.
```

The key at `~/.ssh/id_ed25519` is already registered to the correct
account. This mirrors the sibling project exactly — Marlin IPTV
Editor's `notebook/SESSION-STATE.md` records that its own initial
HTTPS push failed on missing credentials and the remote was switched
to SSH.

**The one-line fix, not applied:**

```
cd /Apps/marlin-cast
git remote set-url origin git@github.com:marlin1111ai/marlin-cast.git
git push -u origin main
```

This was **deliberately not run.** Step 5b names an HTTPS remote and
says to stop and report on an auth failure rather than work around it,
and the owner may intend to configure a PAT instead. Switching
transport is the owner's call. Verification per step 9 —
`git fetch` then comparing `git rev-parse HEAD` to
`git rev-parse origin/main` — is therefore **not yet possible**, and no
push-success claim is made.

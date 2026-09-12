# fios-splash — tv.verizon.com stays on the "V" splash (read-only diagnosis)

2026-09-12, ~18:22–18:35 local, marlinpc. Chrome 153.0.8010.36, the live
owner-launched instance on 127.0.0.1:9333. No code, no fix, no retries.

**Result: STOPPED on failure.** The diagnostic tab's renderer stopped
answering CDP within the first 10 s, so most of step 2's evidence could not
be captured. What *was* measured is below, with what is missing marked.

## Step 1 — what was run

One new tab via `Target.createTarget({url:"about:blank", newWindow:true})`
→ target `CF31263332C82EB5867ABA793BC08574`, own window, `windowState:
normal`, 1508×1198 at (173,31). Attached with a flattened session;
Runtime, Log, Network enabled, then Page (+ lifecycle events). Page-level
auto-attach for iframes/workers. A call-through probe script
(`Page.addScriptToEvaluateOnNewDocument` + `Runtime.addBinding`) logged calls
to `getContext`, `serviceWorker.register`, geolocation, `permissions.query`,
`Notification.requestPermission`, `getUserMedia`,
`requestMediaKeySystemAccess` and `storage.persist`. `Page.navigate` to
`https://tv.verizon.com/` at t=0.1 s. The script was in
`/tmp/.../scratchpad/`, not in the repo.

Owner memory headroom at start: 5.4 GB available of 64 GB.

## Step 2 — evidence

### Failure point

| call | when | result |
|---|---|---|
| `Page.captureScreenshot` (planned t=10 s) | t≈10 s | **never returned**; the script was still waiting after 3 min and was stopped |
| `Runtime.evaluate("1+1")`, new session | ~t+4 min | **timeout 5 s** |
| `Runtime.enable`, `Log.enable` (would replay buffered console/log) | ~t+4 min | **timeout 5 s each** |
| `Page.getLayoutMetrics` | ~t+4 min | **timeout 5 s** |
| `Page.captureScreenshot` | ~t+4 min | **timeout 15 s** |
| `Page.enable`, second session, 3 s listen | ~t+6 min | **timeout 6 s**; no `Page.javascriptDialogOpening` received |
| `Target.attachToTarget`, `Target.getTargetInfo`, `Browser.getWindowForTarget`, `Target.closeTarget` (browser-side) | — | all answered normally |

So the browser process was fine and the **tab's renderer main thread was
not responding** to any CDP command.

### Renderer process state

- Every Chrome renderer was in `S` state, main thread in `futex_do_wait`,
  CPU ≤ 8 %. No renderer was spinning.
- When the tab was closed, renderer pid **194370** exited and every other
  renderer survived, so 194370 was most likely the tab's process. At the
  probe it had 19 threads and 5.42 s cumulative CPU, and was running at
  0.7–0.9 % CPU. It had run code and then went quiet: **blocked, not
  busy**.
- GPU process: `--type=gpu-process --ozone-platform=x11`, 32 s cumulative
  CPU, alive. (Per KNOWN-FIXES task 007, GL on this box is ANGLE/llvmpipe
  software rendering.)

### Final location / title

- `location.href` / `document.title` from the page: **not captured** (the
  renderer would not evaluate).
- Browser-side target info: host `tv.verizon.com`, title
  **`tv.verizon.com/watch`**. That is a URL-derived title: the main frame was
  at path `/watch`, and no `<title>` had been set.
- No login/accounts page was reached.

### Not captured — and why

Every console error/warning, failed/blocked request, never-completed
request, `Runtime.exceptionThrown`, and the WebGL / service worker /
geolocation / permission-prompt / third-party-host checks were meant to be
**written out after the 60 s wait**. The collecting script hung on the t=10 s
screenshot before writing anything, so those events existed only in its
memory. Reading them through the Node inspector was **denied by the
session's permission classifier**, and no workaround was attempted.
Replaying them from Chrome (`Runtime.enable` / `Log.enable`) timed out on the
blocked renderer. None of those results exist, so none are reported.

The screenshot directory `notebook/reports/fios-splash/` is **empty**. Every
screenshot attempt timed out, and an X11 grab of display `:10` was not
taken because it would capture the owner's windows.

### Plain HTTP GET (the comparison load)

`curl` with Chrome 153's UA → `HTTP/1.1 200`, `text/html`, 13 150 bytes,
no redirect, `X-Frame-Options: SAMEORIGIN`, `Cache-Control: no-cache,
no-store`. The document:

- `<div id="loadingScreen"><img src="/V-symbol.png"/></div>` is the "V"
  splash.
- The **only** code that removes it is an inline
  `window.onload = function () { loadingScreen.style.opacity = 0; … display = 'none' }`.
  The splash stays until `load` fires, meaning every subresource and iframe
  has finished and the main thread is free to run the handler.
- One same-origin script `/bundle-<hash>.js`, one same-origin `/main.css`,
  and no absolute third-party URL anywhere in the HTML.
- An inline `window.__PRELOADED_STATE__` shows the app's startup work:
  ATS/master/BI config loads, a WAN-IP / geo lookup (`dmaID`, `zipCode`,
  `coords`, `locationCheckEnabled`), a device token, and a "bootup" call
  (all empty in the served HTML).

## Step 3 — launch flags in scripts/start-chrome.sh (read, not changed)

Running command line matched the script exactly:

| flag | can it affect page loading? |
|---|---|
| `--user-data-dir=data/chrome-profile` | **Yes, possibly.** Site data for tv.verizon.com in this profile (stored permission decisions, a registered service worker, cached storage) would apply here and not on the Mac. Not checked: the renderer was unreadable. |
| `--remote-debugging-port=9333` | **Possibly.** It exposes CDP; it does not set `navigator.webdriver`. The diagnosis itself is a CDP client attached to the tab (with a probe script), so an attached debugger is a confound for this run specifically. |
| `--password-store=basic` | No. It only chooses cookie encryption (v10). Irrelevant, as the prompt says. |
| `--no-first-run`, `--no-default-browser-check` | No. They only suppress first-run UI. |
| start URLs (tv.youtube.com, philo) | No. |

These differ from the Mac but are not flags: display `:10` under xrdp, X11
ozone, and software GL (llvmpipe, no hardware GPU path in Chrome here).

**Which flag the evidence points at: none.** A renderer blocked with low
CPU could follow from a JS dialog or permission prompt, a synchronous
GPU/WebGL wait, or a stuck synchronous request. Nothing measured tells
those apart, and nothing ties the block to a specific flag.

## Step 4 — close and owner tabs

`Target.closeTarget(CF31…)` → `success: true`. Target ids with
`filter:[{}]`, before vs after: **identical**, six ids.

| id | type | host |
|---|---|---|
| `D69065AF7DA903999FF8438B5A408CA8` | page | tv.youtube.com |
| `B616E164D9BD487870AAD47CC19BD846` | page | www.philo.com |
| `3C170CAA8E2818988717A70C62DE6F04` | tab | tv.youtube.com |
| `CE91E65A1FEEEE11595C181970083162` | tab | www.philo.com |
| `3C80F70D8F5BFF4B710260EC378BA250` | browser_ui | omnibox popup |
| `95B20A316A074CD0FB72BA3A395C89B2` | browser_ui | omnibox popup |

The owner's tabs were never attached to, navigated or closed. The stuck
collection script (a local node process) was stopped.

## Most likely cause

**Cause not determined.**

Ruled out:
- the document failing over HTTP (plain GET 200, same-origin assets only)
- a login redirect (main frame stayed on tv.verizon.com `/watch`)
- a JS busy-loop (renderer at ≤1 % CPU, futex wait)
- a minimized window (`normal`, 1508×1198)
- `--password-store=basic`

Established:
- the splash is removed only by `window.onload`
- in this Chrome, the tab's renderer main thread became unresponsive
  within ~10 s of navigation

Open:
- a JS dialog or permission prompt
- a synchronous GPU/WebGL wait
- service worker or site data in the profile
- a blocked third-party host
- the attached-CDP/probe confound

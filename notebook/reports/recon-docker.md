# Recon — Marlin Cast in Docker on Unraid (D012)

Date: 2026-09-13. Host: marlinpc. **Read-only.** No code, script, extension,
Dockerfile or workflow was written; nothing was installed; no `docker` command
beyond `docker --version` was run; nothing on 192.168.1.250 was contacted; the
live Chrome (pid 243382, port 9333, both owner tabs) was never attached to,
navigated or restarted. `backups/` and `data/chrome-profile-v11-*` were only
listed (`ls`, `du`, `cat "Last Version"`). One network request left this
machine: an HTTP `HEAD` to `dl.google.com` to check whether the pinned Chrome
deb is still hosted (item A). No credentials, cookies, tokens, session ids or
account identifiers were read or appear here.

**Result:** every item A–J is sorted below with the notebook quote or the
`file:line` it rests on. The notebook settles more of this than expected —
the Chrome flags, the extension mechanics, the profile scheme, the capture
constraints, the reference Dockerfile/workflow shape — and leaves four things
undefined that block a build: **which port the app binds inside the container
(D008 vs three hardcoded `8804`s), the viewer's port and auth, the container
uid, and where the channel cache comes from on first boot.** Those are
QUESTIONS, not proposals. Two hard-won facts pull against a stock Debian image
(stock `Xvfb` cannot give Chrome a GPU-backed framebuffer; the pipeline was
measured only on ffmpeg 6.1.1) and are QUESTIONS too.

One thing the brief asked me to note **could not be found**: see "The
Fontconfig error" under item A.

---

## Settled inputs (from the task; not re-derived)

- The container's own startup launches Chrome and the app attaches over CDP
  (D009 reading).
- `--password-store=basic` (D010).
- The marlinpc profile with both providers is copied into the container
  volume for first deploy.
- A VNC/noVNC viewer of the container's Chrome, reachable from the owner's
  Mac browser, is the re-login path.
- Image built by GitHub Actions to GHCR as `ghcr.io/marlin1111ai/marlin-cast`.
- Unraid container port 8091 (D008). `--device /dev/dri` passed (D007).
- Hardware encoding is NOT part of this move.

---

## Host facts measured today (marlinpc, for reference)

| | |
|---|---|
| `docker --version` | `Docker version 29.1.3, build 29.1.3-0ubuntu3~24.04.2`; `/usr/bin/docker`; user `marlinai` is in group `docker` (gid 126) |
| Chrome installed | `google-chrome-stable 153.0.8010.36-1`; Google's apt repo currently lists `153.0.8010.36-1` and `151.0.7922.137-1` |
| Chrome deb hosted | `HEAD https://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/google-chrome-stable_153.0.8010.36-1_amd64.deb` → `HTTP/2 200` (today) |
| Chrome deb bundles Widevine | `/opt/google/chrome/WidevineCdm/manifest.json` → `"version": "4.10.3112.0"` — the CDM ships in the deb, no component download needed |
| Chrome deb `Depends:` | `ca-certificates, fonts-liberation, libasound2, libatk-bridge2.0-0, libatk1.0-0, libatspi2.0-0, libc6, libcairo2, libcups2, libcurl*, libdbus-1-3, libexpat1, libgbm1, libglib2.0-0, libgtk-3-0 \| libgtk-4-1, libnspr4, libnss3, libpango-1.0-0, libudev1, libvulkan1, libx11-6, libxcb1, libxcomposite1, libxdamage1, libxext6, libxfixes3, libxkbcommon0, libxrandr2, wget, xdg-utils` |
| Profile `Last Version` | `153.0.8010.36` in both `data/chrome-profile` and `backups/chrome-profile-basic-20260911-110129` |
| ffmpeg here | `6.1.1-3ubuntu5`; hwaccels `vdpau cuda vaapi qsv drm opencl vulkan` |
| Node here | `v22.23.2` |
| Not installed here | `Xvfb`, `x11vnc`, `novnc`, `websockify`, `tigervnc*`, `vainfo` (all absent from `PATH`) |
| apt candidates here (Ubuntu 24.04 names; Debian names for the image are unverified) | `xvfb 2:21.1.12`, `x11vnc 0.9.16`, `novnc 1:1.3.0`, `websockify 0.10.0`, `tigervnc-standalone-server 1.13.1`, `intel-media-va-driver 24.1.0` (+`-non-free`), `libva2 2.20`, `libva-drm2`, `vainfo 2.12`, `fonts-liberation`, `fonts-noto-core`, `fonts-noto-color-emoji`, `fonts-dejavu-core`, `fontconfig`, `tini`, `dumb-init` |
| Fonts on this working host | 746 faces (`fc-list`), incl. `fonts-liberation`, `fonts-dejavu-core`, `fonts-noto-core`, `fonts-noto-cjk`, `fonts-noto-color-emoji`, `fonts-ubuntu` |
| `data/chrome-profile` | 1.7 GB total: `Default/Cache` 1.3 GB, `Default/Code Cache` 246 MB, `component_crx_cache` 38 MB, `Safe Browsing` 19 MB; `SingletonCookie`, `SingletonLock -> pop-os-243382`, `SingletonSocket -> /tmp/com.google.Chrome.*/SingletonSocket` present (Chrome is running) |
| Backups | `chrome-profile-basic-20260911-110129` 263 MB (v10, **dated 2026-09-11 11:01 — before the Philo login of 2026-09-12**); `chrome-profile-loggedin-20260911-101619` 208 MB (v11, machine-bound) |
| Other `data/` | `captures/` 69 MB of task-006/007 WebMs; `hls/` empty; `chrome-profile-v11-20260911-104559` 575 MB; `channels.json` 201 KB (368 channels, 2026-09-13T01:19Z) |
| `node_modules` | 58 MB; `playwright` 5.1 MB + `playwright-core` 14 MB (unused since task-021, report open question 6) |
| Absent from the repo | `Dockerfile`, `.dockerignore`, `.github/`, `tsconfig.json`, `VERSION`, any build script |
| `gh` CLI | absent — repo visibility (private/public) could not be checked |
| Memory now | 62 GB total, **5 GB available** (an owner process is running; task-021/023 recorded the builder's memory guard killing background tasks) |

---

## Findings per item

### A. Dockerfile — Node 22, Chrome (pinned), ffmpeg, Xvfb, fonts, viewer

**Settled.**
- Node 22: D003 "Stack: Node.js 22 + TypeScript, Playwright driving installed
  Google Chrome, ffmpeg." Reference base: `/Apps/marlin-iptv-editor/Dockerfile:7`
  `FROM node:22-slim AS build` and `:21` for runtime; the reference notebook
  records "`node:22-slim` is Debian bookworm with glibc"
  (`notebook/reports/task-029-packaging-p2.md:106`).
- Chrome must be *Google Chrome*, not Chromium: D003 "installed Google Chrome";
  every measured fact (Widevine L3 at 1080p, `--load-extension` inert,
  `Extensions.loadUnpacked`) is on `153.0.8010.36` (KNOWN-FIXES 121-137;
  SESSION-STATE task-001 "Google Chrome 153.0.8010.36").
- The extension is NOT baked in via flag: brief line 32 "`--load-extension` is
  inert on Chrome 153; the extension loads over CDP via
  `Extensions.loadUnpacked`."
- No installers on marlinpc (brief line 66) — everything the image needs is
  installed *in the image* by the Dockerfile, which is the owner's build, not
  a host install.
- Standing prohibition (brief line 67): "No credentials, cookies, tokens,
  session IDs or account identifiers in the repo" — combined with the
  reference's public GHCR package (iptv-editor D022 addendum: "package
  visibility set PUBLIC on GHCR"), **`data/` and `backups/` must never enter
  the build context.** The reference `.dockerignore` excludes `.git`,
  `node_modules`, data, dist, `design`, `notebook`, `*.md`, `.env*`
  (`/Apps/marlin-iptv-editor/.dockerignore:1-12`).

**Code provides.**
- The app runs from TypeScript source through `tsx` — `package.json:8-10`
  (`"login": "tsx src/login.ts"`, `"channels": "tsx src/channels.ts"`,
  `"serve": "tsx src/server.ts"`); `tsx` is a devDependency (`package.json:16-19`).
  There is no build script and no `tsconfig.json`, and `tsc` cannot run
  without `@types/node` (task-001 kickoff report open question 6). So the
  image needs `npm ci` *with* dev dependencies and runs `tsx`; the reference's
  `npm ci --omit=dev` + `node dist/index.js` shape (`Dockerfile:42,57`) does
  not transfer.
- `ffmpeg` is spawned by name from `PATH` (`src/capture.ts:335`
  `spawn("ffmpeg", args, …)`) — an apt `ffmpeg` on `PATH` is all the code asks.
- Paths are relative to the repo root: `src/channels.ts:13-14` (`ROOT` =
  parent of `src/`, `CACHE = data/channels.json`), `src/capture.ts:19-21`
  (`EXT_DIR = ROOT/extension`, `HLS_ROOT = ROOT/data/hls`). With the repo
  copied to `/app`, `data/` and `extension/` land at `/app/data`, `/app/extension`.
- `playwright` is in `dependencies` (`package.json:13-14`) but no source file
  imports it (task-021 report, open question 6: "Playwright is now an unused
  dependency"); `npm ci` installs it anyway (19 MB; the npm package does not
  download browsers on install).

**Unbuilt.** Everything — brief line 72: "Dockerfile · Xvfb · GitHub
Actions/GHCR pipeline … NOT YET BUILT."

**Chrome version pin — which and why.**
- Pin **`153.0.8010.36-1`**, the exact deb installed on marlinpc:
  - it is the version every hard-won fact was measured on (KNOWN-FIXES
    121-137, 139-160, 162-186; task-002/005 1080p on L3);
  - the profile being copied was last opened by it (`Last Version` =
    `153.0.8010.36` in both the live profile and the basic backup). Chrome
    refuses a profile written by a *newer* Chrome (general Chrome behaviour,
    not in the notebook), so the container's Chrome can never be older than
    the profile's — a floating "current stable" satisfies that today but
    forces the profile forward on every image rebuild;
  - the exact deb is fetchable today by full URL (`HEAD … 200`, table above).
    Google's repo also lists the previous stable (`151.0.7922.137-1`), so it
    keeps at least one prior version, but nothing guarantees `153` stays
    hosted after the next two stables — **the pinned build will break on
    that day** (see QUESTIONS 3).
- The alternative, `google-chrome-stable_current_amd64.deb` (`HEAD … 200`),
  never breaks the build but silently drifts past the version the extension
  mechanics were measured on.

**Fonts.** The Chrome deb itself depends on `fonts-liberation` (Depends list
above), so a bare `apt install ./google-chrome-*.deb` brings one font family
in; the fontconfig *library* arrives through `libcairo2`/`libpango-1.0-0`
(general packaging knowledge, not checked in the image). The working host has
746 faces including Noto core/CJK/
colour emoji. Nothing in the notebook measures font dependence; the captured
picture is the provider's video plus, on Philo, the control overlay when it
fails to clear (task-021 "The control overlay") — text rendering only matters
there and on the guide pages the owner sees in the viewer.

**The Fontconfig error the brief points at — NOT FOUND.** `grep -rni
fontconfig` over `notebook/` (all files), `MARLIN-CAST-BRIEF.md`, `src/`,
`scripts/`, `extension/`, `git log -S` on both repos, the iptv-editor notebook,
this session's memory directory and the user journal returns **no error
line**. The only matches are ffmpeg's build banner (`--enable-libfontconfig`)
in old scratchpad pull logs, which are not errors. There is no KNOWN-FIXES
entry and no task-log line about Fontconfig to quote, so I cannot state which
error was meant or what fixed it. If the owner has it (it would typically read
`Fontconfig error: Cannot load default config file` on a slim image — general
experience, not the notebook), it belongs in KNOWN-FIXES before the sweep.

**Hard-won facts A must respect.**
- ffmpeg flags in use (`src/capture.ts:283-334`): `-fps_mode cfr`,
  `-hls_segment_type fmp4`, `-hls_fmp4_init_filename`, `-x264-params
  repeat-headers=1`, `-hls_flags delete_segments+independent_segments+temp_file`.
  All results (fMP4 `EXT-X-VERSION:7`, the mp4 muxer audio warning, 16–17
  segment cuts) were measured on **ffmpeg 6.1.1** (KNOWN-FIXES 503-522,
  557-583). Debian bookworm's apt ffmpeg is a different major version (5.1.x
  — general knowledge, unverified here). See QUESTIONS 6.
- `ffmpeg guesses 50 fps from MediaRecorder WebM — pin the output rate`
  (KNOWN-FIXES 262-280): the guess came from the display's refresh rate; the
  `-r 30` pin is what makes the container's Xvfb refresh rate irrelevant to
  the output.

### B. Entrypoint — Xvfb, Chrome, tabs, extension, app, ordering, shutdown

**Settled.**
- Display size drives capture: brief line 35 "Capture resolution follows the
  display — constrain via maxWidth/maxHeight." KNOWN-FIXES 162-176: "With no
  `getUserMedia` size constraint, `chrome.tabCapture` output is the size of
  the **display**, regardless of window size, viewport size, or the video
  element's own resolution … Control it with the constraint, not the window."
  Task-006 report (vi.2): "Window size is not a tuning knob; the capture
  constraint is. Nothing in the container needs `--start-maximized`, window
  bounds management, or fullscreen … Left unconstrained, the capture would
  silently take the size of whatever virtual display is configured — which
  on a 4K virtual display would mean encoding 4K."
- The window must be mapped, never minimized: KNOWN-FIXES 189-199 "Never
  minimize a capturing window; covering it is fine." Task-006 (vi.1): "the
  Chrome window must be mapped and rendering."
- Chrome launch flags are `scripts/start-chrome.sh:70-77` verbatim:
  `--user-data-dir=$PROFILE --remote-debugging-port=$PORT
  --password-store=basic --no-first-run --no-default-browser-check
  https://tv.youtube.com/ https://www.philo.com/player/guide`, with the
  script's own rule at `:60-62`: "`--remote-debugging-address` is deliberately
  not passed: Chrome binds the debugging port to loopback by default." D009:
  "The debug port binds loopback only and is never published from the
  container."
- Both provider tabs are opened by the launch URLs (D018: "One tab per
  provider, both opened by the owner via `scripts/start-chrome.sh`"); the app
  selects by URL host and fails loud otherwise (`src/cdp.ts:109-123`,
  `fatal: no <provider> tab open`).
- Extension load is the app's job, at startup, over CDP: `src/capture.ts:110-115`
  (`connect()` → `loadExtension()`), `:134-141` (`Extensions.uninstall` any
  prior copy by name, then `Extensions.loadUnpacked({ path: EXT_DIR })`).
  KNOWN-FIXES 132-137: "needs no Developer Mode, and needs **no Chrome
  restart**." Nothing to pre-install; task-006 (viii.2)'s "pre-install into
  the profile volume" alternative is untested and not needed.
- Stale locks after an unclean stop: task-003 report lines 95-101 "`SIGTERM`
  left the `Singleton*` lock files behind … a supervisor that restarts Chrome
  in a container will hit the same stale locks after any non-graceful stop,
  and PrismCast's own entrypoint removes them explicitly at startup for
  exactly this reason." SESSION-STATE 189-191 says the same.
- Graceful stop preserves the session: task-003 "Graceful `SIGTERM` stop,
  restart … `signed in` both times … cookie store came through
  byte-identical."
- Cookie commit batching: KNOWN-FIXES 72-75 "A profile inspected less than
  ~60 s after launch shows a store last written at startup … Dwell ~70 s
  before shutting down." This bounds how soon after a viewer re-login the
  container may be stopped.
- Chrome must not be a child of anything the builder harness can kill
  (task-021 correction, report lines 686-693: "`scripts/start-chrome.sh` is
  meant to be run by the owner in a terminal … launched that way it is
  outside the builder's reach"). In the container the entrypoint is that
  parent; the same lesson applies to any local test (item J).

**Code provides.**
- Attach fails fast, no retry: `src/cdp.ts:35-44` (`fetch
  http://127.0.0.1:<port>/json/version`, rejects "cannot open"). `src/server.ts:43-45`
  calls `pipeline.connect()` at module top level, so the server process
  **exits if Chrome is not yet listening** — the entrypoint must gate on
  `/json/version` before `npm run serve`.
- The server refuses to start without a channel cache: `src/server.ts:30-39`
  (`No channel cache. Run: npm run channels` → `process.exit(1)`; also exits
  on a pre-D020 cache with no keys). `npm run channels` needs **both** tabs
  signed in (`src/channels.ts:48-59` iterates every provider through
  `findPageTarget`), navigates the YouTube TV tab to the guide and sleeps 10 s
  (`src/providers/youtubetv.ts:135-136`), and the Philo tab through its own
  guide query (`src/providers/philo.ts:276-317`). See QUESTIONS 8.
- `npm run login` reports each provider's sign-in state and exits 1 if any is
  signed out (`src/login.ts:28-62`); its failure message names
  `scripts/start-chrome.sh` (`:18-24`) — not the container's path.
- Env knobs already exist: `CDP_PORT` (`src/server.ts:26`, default `9333`),
  `MC_WIDTH/MC_HEIGHT/MC_FPS/MC_TIMESLICE/MC_IDLE_MS` (`src/capture.ts:23-29`),
  `MC_FIRST_SEGMENT_MS` (`src/server.ts:28`). `DISPLAY` is read only by the
  shell script (`scripts/start-chrome.sh:13`, default `:10`), never by the app.
- Readiness: `GET /health` (`src/server.ts:77-97`) returns `status: ok` plus
  `state:`; the status page at `/` (`:251-314`).
- Clean shutdown of what the app owns: `src/server.ts:325-332` handles
  `SIGINT`/`SIGTERM` → `server.close()` → `pipeline.shutdown()` →
  `process.exit(0)`; `src/capture.ts:418-422` clears the watchdog, calls
  `stop("server shutting down")`, closes CDP; `stop()` (`:382-416`) tells the
  extension to stop recording, ends ffmpeg's stdin, sends `SIGTERM` and
  `SIGKILL`s after 4 s (`:394-398`), removes the HLS directory. An ffmpeg whose
  parent dies uncleanly still exits on stdin EOF (`stdio: ["pipe", …]`,
  `:335`). **Chrome is not the app's to stop** (D009 "never own the profile");
  in the container that is the entrypoint's job.
- Every tune activates the tab (`src/capture.ts:225`, `:354`
  `Target.activateTarget`) and the extension picks the tab via
  `chrome.tabs.query({ active: true, lastFocusedWindow: true })`
  (`extension/background.js:29-35`) — behaviour under a bare Xvfb with no
  window manager is unmeasured (item G).
- The ingest URL is `http://127.0.0.1:8804/…` (`src/capture.ts:357`) and the
  extension's `host_permissions` is `http://127.0.0.1:8804/*`
  (`extension/manifest.json:18-20`): Chrome and the app must share one
  network namespace and the app must listen on 8804 *inside* it (item E).

**Unbuilt.** The entrypoint itself: Xvfb start and its display/size,
`DISPLAY` export, lock clearing, Chrome launch, the `/json/version` and
two-tab gates, cache handling, `npm run serve`, signal forwarding, and
stopping Chrome and Xvfb after the app. Whether the container runs under an
init (`tini`/`--init`) so Chrome's many children are reaped is a general
Docker+Chrome practice, not in the notebook.

**Hard-won facts B must respect.** The Xvfb screen must be **at least
1920×1080** so the constrained capture (`src/capture.ts:356` `maxWidth: 1920,
maxHeight: 1080, maxFrameRate: 30`) and the layout override
(`src/capture.ts:258-267`, `Emulation.setDeviceMetricsOverride 1920×1080`
then poll `innerWidth === 1920 && innerHeight === 1080`) describe a frame the
display can hold; task-006 measured the *display*, not the window, as the
unconstrained size. Whether a display smaller than 1920×1080 clips the
constrained capture was never measured; exactly 1920×1080×24 is the size the
notebook's facts cover without extrapolation. Frame rate: the `-r 30` pin
(KNOWN-FIXES 269-274) removes the display refresh from the output; task-001's
capture table claims "60 under a fresh Xvfb" for `x11grab`
(`task-001-kickoff.md:313`), a table claim never measured.

### C. Profile volume — path, uid/gid, SingletonLock, first-deploy copy

**Settled.**
- Scheme: D010 "`--password-store=basic` everywhere, development and
  container alike … Accepted cost: v10 uses a hardcoded key, so the cookie
  store is readable by anyone with filesystem access to the profile volume."
  KNOWN-FIXES 42-48: "pick the scheme *before* the login, never after."
- Copy, path and group/mode are harmless: KNOWN-FIXES 50-54 "copying it,
  moving it to a completely different path, and changing its group ownership
  and permissions all preserved the session exactly … Path and ownership are
  not the hazard. The scheme is." Task-004 (ii): "A container that mounts
  this profile as a volume would not lose the session by the act of
  mounting it."
- uid is the open gap: brief line 79 "Whether a volume-mounted profile with a
  different uid behaves like a copied one." Task-004 report lines 233-238:
  "uid was never changed … A Docker volume commonly presents files owned by
  a *different uid*, and if Chrome cannot write the profile it will behave
  differently from anything measured here. This is the remaining portability
  unknown, and it is testable inside a container without risking the live
  profile." Task-005 (vii.1) "Every portability arm has run as uid 1000."
- Which profile: the settled input is "the marlinpc profile with both
  providers", i.e. **`data/chrome-profile`** (live, v10, both providers'
  cookies per the task-021 correction's read-only count). The basic backup is
  **not** that asset: it is dated 2026-09-11 11:01 and the Philo login was
  taken on 2026-09-12 (D017/task-021), so it holds YouTube TV only. The v11
  copies are "machine-bound, NOT Docker fallbacks" (brief line 57).
- Locks: task-003 lines 95-101 (quoted in B); today the live profile carries
  `SingletonLock -> pop-os-243382` and a `SingletonSocket` symlink into
  `/tmp/` — both are host-specific and meaningless inside a container.
- The copy must be taken with Chrome **stopped**: every copy the notebook
  trusts was taken after a graceful `SIGTERM` (task-003 backup, task-004 arms
  "stopped with `SIGTERM`", task-005 "after a graceful stop"), and the cookie
  DB is SQLite with a live `Cookies-journal` and ~60 s commit batching
  (KNOWN-FIXES 72-75). Stopping Chrome is touching the live Chrome — the
  owner's step, STANDALONE by rule.

**Code provides.** Nothing fixes the profile path: `scripts/start-chrome.sh:12`
derives `<repo>/data/chrome-profile`; the app never sees a profile path
(`src/login.ts:3-5` "never passes a profile path"). `data/` is gitignored
(`.gitignore:3`), so the container's `data/` is empty unless mounted. With the
repo at `/app`, a single volume at `/app/data` would carry the profile,
`channels.json` (`src/channels.ts:14`) and `hls/` (`src/capture.ts:21`)
together — or the profile can live anywhere the entrypoint names.

**Unbuilt.** The volume layout, the uid decision, lock clearing in the
entrypoint, and the copy procedure with its include/exclude list.

**What the first-deploy copy must include / exclude (from today's listing).**
- Include: `Default/` (with `Cookies`, `Local Storage`, `IndexedDB`, `Service
  Worker`, `Preferences`, `Secure Preferences`, `Login Data`, `Web Data`,
  `Extensions`, `Extension State/Rules/Scripts`, `Local Extension Settings`,
  `Network Persistent State`, `TransportSecurity`), `Local State`, `Last
  Version`, `First Run` state (absent here because `--no-first-run` is used).
- Exclude: `SingletonLock`, `SingletonCookie`, `SingletonSocket` (symlinks;
  the socket points into this host's `/tmp`); `Default/Cache` (1.3 GB),
  `Default/Code Cache` (246 MB), `Default/GPUCache`, `Default/DawnGraphiteCache`,
  `Default/DawnWebGPUCache`, `GPUPersistentCache`, `component_crx_cache`
  (38 MB), `Safe Browsing` (19 MB), `BrowserMetrics-spare.pma`,
  `Default/LOCK`, `Default/LOG*` — all rebuilt by Chrome. That takes the copy
  from 1.7 GB to roughly the size of the basic backup (263 MB).
- Never: `data/captures/` (69 MB of WebMs), `data/hls/`,
  `data/chrome-profile-v11-*`, anything under `backups/`.

**Hard-won facts C must respect.** D010's accepted cost means the volume on
Unraid is as sensitive as a password file; the `.dockerignore` point in A.
`SingletonLock` encodes `<hostname>-<pid>`; a container's hostname changes
per run, so Chrome's stale-lock reclaim (task-003: "reclaimed the stale lock
on restart without complaint" — on the *same* host) is not something to rely
on there. Clear all three at every start, before Chrome.

### D. Viewer — package, port, auth, how Chrome's window is shown

**Settled.**
- The reference implementation ships exactly this: task-001 kickoff report
  lines 302-305 "x11vnc + noVNC are started alongside so an operator can
  complete provider logins in the container (README:253) — the same problem
  as this task's 5e."
- Occluded is fine, minimized is black (KNOWN-FIXES 189-199) — a viewer
  showing the window is harmless to capture; a viewer that could minimize it
  is not. Under bare Xvfb with no window manager there is no minimize.
- The app never types credentials or navigates to accounts pages (brief line
  53; `src/login.ts:5-7`) — the owner logs in by hand in the viewer, which
  keeps that rule.
- The debug port stays loopback and unpublished (D009) — the viewer is a
  *second* control surface onto the same logged-in browser and gets no cover
  from D009's reasoning.

**Code provides.** Nothing. `DISPLAY` is only in `scripts/start-chrome.sh:13`.

**Unbuilt.** All of it. Package options installable by apt inside the image
(Ubuntu candidate names verified today; Debian bookworm names are the same
by convention but unverified): `x11vnc` + `novnc` + `websockify`
(the reference's pair), or `tigervnc-scraping-server` (`x0vncserver`) +
`novnc`. Either shares the Xvfb display (`x11vnc -display :<n>` /
`x0vncserver -display :<n>`) and noVNC serves a browser page that proxies to
the VNC socket — the Mac needs only a browser. The notebook records **no
viewer port and no auth decision** (QUESTIONS 2). CPU cost of a framebuffer
scraper while 1080p video plays, and whether it should run only on demand
(env flag) rather than always, are unmeasured.

**Hard-won facts D must respect.** KNOWN-FIXES 72-75 cookie batching: a login
taken through the viewer must be followed by ≥ 70 s before any container
stop, or the login is not on disk. Task-001c/D009: automation detection is
the best remaining explanation for server-side invalidation — the viewer
adds no automation, but nothing has ever been logged in *inside a
container*, so a re-login there is a first.

### E. Ports — 8091, viewer, 9333, what is taken

**Settled.**
- D008: "the dev server binds 0.0.0.0:8804 … **Unraid container port remains
  8091.** Never bind 3000, 5173, 5188, 5189, 8420, 8800, 8801, 8802, 8803."
- D009: "The debug port binds loopback only and is never published from the
  container." `scripts/start-chrome.sh:60-62` explains why
  `--remote-debugging-address` is never passed.
- Host ports on Unraid the notebooks name as taken: **8089** (brief line 61,
  "nothing on port 8089" — the Channels DVR / Unraid web port the standing
  prohibition guards), **5589** (PrismCast, brief line 61), **8590** (Marlin
  IPTV Editor, its D021), **8090** (MarlinDVR, iptv-editor D021 and
  `task-027-packaging-recon.md:182`). The other containers on the box
  (`channelsdvr_intel`, `fastchannels`, `marlin-cad`) have no port recorded in
  either notebook — the iptv-editor's recon says "the owner's Channels DVR
  port (known, redacted)".
- Dev-side (marlinpc) ports the notebooks name: 8804 (dev server), 9333
  (CDP), 8800 (`marlin-launcher/agent`, iptv-editor task-064), 18091
  (`marlindvr`, iptv-editor task-064 line 46), 5188 (iptv-editor Vite), 8188
  (owner's ComfyUI, task-021 correction) — plus D008's forbidden list.

**Code provides.** `src/server.ts:24-25` `PORT = 8804`, `HOST = "0.0.0.0"`,
with the comment at `:15` "Binds 0.0.0.0:8804 and nothing else (D008)".
`8804` is hardcoded in **three** places: `src/server.ts:24`,
`src/capture.ts:357` (ingest URL), `extension/manifest.json:19`
(`host_permissions`). None is env-driven.

**Unbuilt.** `EXPOSE`, the port mapping, the viewer port. **Undefined:**
whether D008's "container port 8091" means the *host* side of a
`8091 → 8804` mapping (no code change) or that the process inside the
container binds 8091 (three edits) — QUESTIONS 1.

**Hard-won facts E must respect.** The playlist's stream URLs are built from
the request's `Host` header (`src/server.ts:100-102`, `:126`), so whatever
host:port the consumer uses to fetch `/playlist` is what it gets back — the
mapping choice does not leak into the M3U. Marlin IPTV Editor identifies a
channel by stream URL (D020 reason), so the Unraid host:port, once consumed,
is frozen the way the iptv-editor's D021 describes for its own port.

### F. GPU — what `/dev/dri` needs in the image (decode only)

**Settled.**
- D007: "Deploy target is unchanged: Unraid Docker with --device /dev/dri."
  D014: "the GPU decode question is deferred to first run on Unraid.
  marlinpc's /dev/dri has no usable VAAPI driver."
- The driver: KNOWN-FIXES 240-258 "Chrome on Linux hardware-decodes video
  **only** through VAAPI … The Unraid target's UHD 770 uses
  `iHD_drv_video.so`, which *is* present in a normal image — so hardware
  decode, and possibly Widevine L1 with it, is a live first-run risk there."
- The flags that were tried: task-007 report lines 84-95
  (`--ignore-gpu-blocklist`,
  `--enable-features=VaapiVideoDecoder,VaapiVideoDecodeLinuxGL,AcceleratedVideoDecodeLinuxGL,AcceleratedVideoDecodeLinuxZeroCopyGL,VaapiIgnoreDriverChecks`,
  `--enable-gpu-rasterization --enable-zero-copy --use-gl=angle --use-angle=gl`).
- How to tell: KNOWN-FIXES 212-238 "`chrome://gpu` reports policy, not
  silicon … read `chrome://media-internals` → `kIsPlatformVideoDecoder`."
  Task-007 (vi.4): "Any container acceptance test should read that field."
- The safe first move: task-007 (vi.3) "run with `/dev/dri` passed through
  but Chrome launched with `--disable-accelerated-video-decode`, keeping
  decode in software where capture is known to work … Then enable decode
  deliberately, as one change, and re-measure."
- The black-frame risk: task-006 (ix.1) "A container with `/dev/dri` passed
  through … is the configuration most likely to turn these frames black."
- Encoding is out of scope (settled input); `src/capture.ts:282-283` records
  the encoder as "Software only (D014 / task-007): no VAAPI, no hwaccel."

**Code provides.** No GPU flag anywhere (`grep` for `disable-gpu`,
`use-gl`, `vaapi` in `src/ scripts/ extension/` is empty). Nothing to change
for the "safe first move" beyond the entrypoint's Chrome flags.

**Unbuilt.** Image packages for the device to be usable at all: `libva2`,
`libva-drm2`, `intel-media-va-driver` (the `iHD` driver; Debian ships a free
and a `-non-free` build — which one the UHD 770 decode path needs is
general knowledge, unverified), and `vainfo` for a read-only in-container
check. Device permissions: `/dev/dri/renderD128` is group-owned by the
host's `render`/`video` gid, so the container user needs that gid
(`--group-add`) — general Docker practice, not in the notebook.

**Hard-won fact F must respect — and a conflict.** The reference's Xvfb is
GPU-backed: task-001 kickoff lines 298-302 "`docker-entrypoint.sh:63-76`
builds `-vfbdevice /dev/dri/renderD128` for the LinuxServer Xvfb binary,
'which connects the virtual framebuffer to the GPU's DRM device and enables
DRI3 hardware-accelerated rendering. Without this, Chrome sees software GL
only and **disables VAAPI**.'" Stock Debian `xvfb` has no `-vfbdevice`
(general knowledge of the package; the LinuxServer build is a patched
binary). So with a stock image, D014's first-run decode test may be
structurally unable to engage VAAPI even with `/dev/dri` passed. QUESTIONS 5.

### G. Tab capture under Xvfb — what is shown, what is not

**What the notebook shows.**
- Occlusion is harmless; minimization is fatal: KNOWN-FIXES 189-199; task-006
  "what matters is whether the window is *mapped and rendering*, not whether
  a human can see it — occluded pixels nobody can see captured perfectly."
- Capture works at Widevine L3 on a software GL path: task-006 "The
  make-or-break result is positive: Widevine-protected YouTube TV video
  passes through `chrome.tabCapture` intact" and the caveat "measured at
  Widevine **L3**, with Chrome on Mesa `llvmpipe` and no GPU video path at
  all." Task-007 arm 2: accelerated compositing on software GL did not black
  the capture.
- The reference does it in production: task-001 kickoff table row "Needs a
  composited window; PrismCast ships Xvfb" and "1. Extension tabCapture →
  MediaRecorder … **Yes — this is the shipping path**."
- Both 1080p pins are display-independent: `setPlaybackQualityRange` decides
  what is decoded, the `maxWidth/maxHeight` constraint what is encoded
  (KNOWN-FIXES 182-186); the 1920×1080 layout override removes pillarboxing
  (KNOWN-FIXES 296-311).

**What is unverified (explicitly, in the notebook).**
- Xvfb itself: task-006 lines 191-197 "**'A display nobody is connected to'
  was NOT tested.** `Xvfb`, `xvfb-run` and `Xephyr` are all absent from this
  machine … That makes a virtual display the likely answer, but it is an
  inference, not a measurement." Task-006 (viii.1) and (ix.2) repeat it;
  SESSION-STATE task-005 "No container has ever been run."
- With `/dev/dri` and hardware decode: brief line 78; task-006 (ix.1).
- Long runs: brief line 80 "nothing has run longer than ~2 minutes under
  measurement" (task-021's 330 s Philo pull is the longest since).

**Unverified and NOT in the notebook at all (new gaps this recon found in the
code).**
- Audio with no audio device: `extension/offscreen.js:49-51` opens an
  `AudioContext` and routes the captured audio "back to the default output".
  A container has no PulseAudio/ALSA sink. Whether `tabCapture` still yields
  tab audio, and whether that `AudioContext` construction fails, is
  unobserved anywhere.
- Focus semantics with no window manager: `Target.activateTarget`
  (`src/capture.ts:225,354`) and `chrome.tabs.query({ active: true,
  lastFocusedWindow: true })` (`extension/background.js:30`) have only run on
  an xrdp desktop with a window manager.
- Chrome's window size under Xvfb with no WM (it is not a capture knob per
  task-006, but the viewer shows whatever it is).
- `/dev/shm`: Chrome's renderers use shared memory; Docker's default 64 MB
  `/dev/shm` is a well-known Chrome crash cause (general knowledge; marlinpc's
  is 32 GB). Not in the notebook.

### H. GitHub Actions → GHCR — workflow shape, image name, tags

**Settled (reference conventions, `/Apps/marlin-iptv-editor/.github/workflows/publish-image.yml`).**
- Trigger `:3-16`: `push` to `main` with `paths-ignore` for `notebook/**`,
  `design/**`, `**/*.md`, `*.md`, `.gitignore`, plus `workflow_dispatch`
  (iptv-editor D030 and its Task-100 amendment).
- Permissions `:18-20`: `contents: read`, `packages: write`.
- Login `:29-34`: `docker/login-action@v3` to `ghcr.io` with
  `${{ github.actor }}` / `${{ secrets.GITHUB_TOKEN }}` — no PAT.
- Version `:36-38` reads a repo-root `VERSION` file; `:49-65` refuses to
  overwrite an existing `<VERSION>` tag (D030 immutability) **before** any
  push.
- Tags `:67-76` via `docker/metadata-action@v5`: `latest`, `sha-<short>`,
  `v<run_number>`, `<VERSION>` (iptv-editor D022, D027, D028).
- Build `:82-94`: `docker/build-push-action@v6`, `platforms: linux/amd64`,
  build-args `GIT_SHA`, `BUILD_NUMBER`, `APP_VERSION` consumed by the
  Dockerfile's `ARG`/`ENV` (`Dockerfile:26-37`) and surfaced on `/health`.
- Pull without login: iptv-editor D022 addendum "package visibility set
  PUBLIC on GHCR (repo stays private) so Unraid pulls without a token" — a
  GitHub-side setting the owner makes once, outside the repo.
- Image name for this project: settled input `ghcr.io/marlin1111ai/marlin-cast`
  (D001 "container `marlin-cast`").

**Code provides.** Nothing: no `.github/`, no `VERSION`, `package.json`
`"version": "0.0.0"`, and `/health` (`src/server.ts:77-97`) carries no
version field to receive a build-arg.

**Unbuilt.** The workflow file, `.dockerignore`, and — if the four-tag scheme
is adopted — a `VERSION` file and the `ARG`/`ENV` plumbing. **Undefined:** the
tag scheme (QUESTIONS 7).

**Hard-won facts H must respect.** The build runs on GitHub's runner and
fetches the Chrome deb from `dl.google.com` at build time (item A's pin
question decides whether that URL is stable). A public package plus the
standing prohibition on credentials in the repo makes `.dockerignore`
exclusion of `data/` and `backups/` load-bearing (item A). The reference
skips publishing on notebook-only pushes; this recon's own commit would be
skipped by the same rule.

### I. Unraid run — the fields the owner will need

Settled or inherited, as a list of fields (values in brackets are
**undefined** and belong to QUESTIONS):

- **Name:** `marlin-cast` (D001).
- **Repository:** `ghcr.io/marlin1111ai/marlin-cast:<tag>` — `latest` is the
  reference's pull-and-update tag (iptv-editor D022); a pinned tag is the
  reference's "fixed version" path (D028). [tag scheme: QUESTIONS 7]
- **Network type:** `bridge` (reference runbook `unraid-deploy.md:82`).
  Never `host` — `host` would publish 9333 (D009) and collide with anything
  on 8804.
- **Port mapping (app):** host `8091` (D008) → container [`8804` or `8091`:
  QUESTIONS 1].
- **Port mapping (viewer):** host [port] → container [port] [QUESTIONS 2].
- **No mapping for 9333** (D009).
- **Path mapping:** host `/mnt/user/appdata/marlin-cast` (reference
  convention `unraid-deploy.md:84`) → container [`/app/data`, or a separate
  profile path: item C]. The profile, `channels.json` and `hls/` are the
  three things that must persist or be regenerable.
- **Device:** `/dev/dri` (D007), plus the render gid for the container user
  (item F).
- **Env:** `CDP_PORT` only if not 9333 (`src/server.ts:26`); `MC_IDLE_MS`
  optional (`src/capture.ts:29`; brief line 76 says the 20 s default has no
  evidence behind it); [`PUID`/`PGID` or a fixed uid: QUESTIONS 4].
- **Restart policy:** `Unless Stopped` (reference `unraid-deploy.md:87`).
  With the Singleton clearing in the entrypoint (item C) a restart after an
  unclean stop is safe; without it a restart loop on "profile in use" is the
  failure mode task-003 warned about.
- **Extra parameters** (general Docker+Chrome practice, not in the notebook):
  `--shm-size` larger than the 64 MB default; `--init` or `tini` in the image;
  a `--stop-timeout` long enough for the app's 4 s ffmpeg grace
  (`src/capture.ts:394-398`) plus Chrome's graceful exit.
- **First boot check:** `GET http://<UNRAID-IP>:8091/health` → `status: ok`,
  `state: idle`, `channels: <n>` (`src/server.ts:77-97`); then the viewer
  shows two tabs signed in.

### J. Dev-side test on marlinpc — what can be tested here

**Docker is present:** `Docker version 29.1.3` at `/usr/bin/docker`, and
`marlinai` is in the `docker` group, so no `sudo` is needed. That is the whole
of what this pass checked (`docker --version` only, per the task).

**What a build here needs that this pass may not do:** `docker build` pulls
the base image (`node:22-slim`, ~75 MB) — a `docker pull` by another name,
which the task forbids; the local image cache was not inspected. So the
first build is its own step with the owner's say-so (QUESTIONS 9).

**Testable here (software path, marlinpc has no Intel GPU):**
- the image builds; Chrome 153 starts under Xvfb in a container and answers
  `/json/version`; both tabs open;
- **item G's core unknown** — tab capture on a display nobody is connected
  to — using a **copy** of a profile, never the live one and never `--network
  host` (a host-networked container's app would attach to the owner's live
  Chrome on 127.0.0.1:9333 — exactly the prohibited action);
- the uid gap (task-004 viii.1: "testable inside a container without risking
  the live profile") by running the container as a uid other than 1000;
- Singleton clearing after a `docker kill`; clean stop leaving 0 ffmpeg;
- the viewer from the Mac (marlinpc's LAN address, a free host port);
- `/health`, `/playlist`, a tune and a 30 s pull with the task-011 method.

**Only on Unraid:** anything touching `/dev/dri` VAAPI (D014; marlinpc's
render node is NVIDIA with no VAAPI driver — KNOWN-FIXES 240-258), Widevine L1
behaviour, the 8091 host port, GHCR pull, `appdata` ownership.

**Constraints on a local test the notebook already records.**
- Which profile copy: the basic backup lacks Philo (item C), so a
  two-provider test needs a fresh copy of `data/chrome-profile` taken with
  Chrome stopped — the owner's step. A YouTube-TV-only test can use a copy of
  the basic backup (read-only source; copy elsewhere first).
- Host port for the container's app port: 8804 is the dev server; D008's
  forbidden list and the taken ports in E apply; nothing in the notebook
  picks one.
- Memory: 5 GB available at the time of this recon; the harness killed
  background tasks under memory pressure in task-021 and task-023. A
  container is a child of `dockerd`, not of the builder, so it survives that
  guard — and therefore must be stopped explicitly at the end of a test.

---

## Sort

| Item | Sort | Reason |
|---|---|---|
| A Dockerfile | **SWEEP** | It is the container for B, D's packages and F's packages; it cannot be verified without an entrypoint to run. |
| B Entrypoint | **SWEEP** | Inseparable from A; the ordering and shutdown are the image's behaviour. |
| C Profile volume — path, uid handling, Singleton clearing | **SWEEP** | These are entrypoint lines and a volume path; nothing here touches the live profile. |
| C Profile volume — first-deploy copy | **STANDALONE** (by rule) | Needs the live Chrome stopped and a backup taken; backups are their own step. |
| D Viewer | **SWEEP** | Two packages and one more process in the entrypoint — but only after QUESTIONS 2 is answered, since port and auth change the Dockerfile and the Unraid fields. |
| E Ports | **SWEEP** | `EXPOSE` and documentation once QUESTIONS 1 settles which port the container binds; if the answer is "bind 8091 inside", the three-file code change is its own pass because this sweep writes no `src/`. |
| F GPU — packages and group | **SWEEP** | `libva`, the `iHD` driver and `vainfo` are apt lines; the safe-first-move flag is an entrypoint line. |
| F GPU — the D014 decode test | **STANDALONE** | D014 says "first run on Unraid"; it is a measurement, not a build. |
| G Tab capture under Xvfb | **STANDALONE** | The make-or-break measurement (task-006 ix.2); it needs a base-image pull and a profile copy (owner's steps) and its outcome can change the design. Runs on marlinpc before any Unraid deploy. |
| H GHCR workflow | **STANDALONE** | Publishes to a public registry; needs A to build cleanly first, the tag decision (QUESTIONS 7), and the owner's GHCR visibility step. The reference did packaging and publishing as separate tasks. |
| I Unraid run | **STANDALONE** (by rule) | Deploy. |
| J Dev-side test | **STANDALONE** | Needs the base pull and a profile copy; it is G's vehicle. |

---

## QUESTIONS

1. **App port inside the container (D008 vs the code).** D008: "Unraid
   container port remains 8091." The code binds `8804` (`src/server.ts:24`,
   comment `:15` "Binds 0.0.0.0:8804 and nothing else (D008)"), the ingest URL
   is `http://127.0.0.1:8804/…` (`src/capture.ts:357`) and the extension's
   `host_permissions` is `http://127.0.0.1:8804/*` (`extension/manifest.json:19`).
   Is 8091 the **host** side of an `8091 → 8804` mapping (no code change), or
   must the process bind 8091 (three edits, none of them in this pass)?

2. **Viewer port and auth — undefined.** No decision names a port, and no
   decision covers exposing a logged-in Chrome to the LAN. D009 keeps the CDP
   port loopback because it is "an unauthenticated local control channel"
   (task-001c); D010's accepted cost covers "anyone with filesystem access to
   the profile volume", not anyone on the LAN. Which host port for the
   viewer, and: no password / VNC password / only started on demand?

3. **Chrome pin: exact `153.0.8010.36-1` or floating current stable?** Exact
   matches every measured fact and the profile's `Last Version`, and the deb
   is hosted today (`HEAD … 200`) — but Google's pool keeps only recent
   versions, so the build will one day fail on a vanished URL. Floating never
   fails but silently moves off the version the `--load-extension` /
   `Extensions.loadUnpacked` / `triggerAction` facts were measured on
   (KNOWN-FIXES 121-160). Either way the container's Chrome must not be
   older than the profile's `153.0.8010.36`.

4. **Container uid.** The copied profile is uid 1000 (task-004/005: "every
   portability arm has run as uid 1000"); the uid case is the one recorded
   unknown (brief line 79). Unraid's `appdata` convention is `nobody:users`
   (99:100) — general Unraid knowledge, not in the notebook — and Chrome
   refuses to run as root without `--no-sandbox` (general Chrome behaviour,
   not in the notebook). Run as a fixed uid 1000, take `PUID`/`PGID` and
   `chown` the volume at start (which rewrites the profile's ownership —
   task-004 showed group/mode changes harmless, uid untested), or something
   else?

5. **Stock Xvfb vs D014.** Task-001 kickoff lines 298-302: PrismCast's Xvfb
   is the LinuxServer build with `-vfbdevice /dev/dri/renderD128`; "Without
   this, Chrome sees software GL only and disables VAAPI." Debian's `xvfb`
   has no such option (general knowledge of the stock package). With a stock
   image, D014's first-run decode test may be unable to engage VAAPI at all
   even with `/dev/dri` passed. Is that acceptable for this move (decode stays
   software, `/dev/dri` passed but idle, per task-007's "safe first move"), or
   does the image need a GPU-capable X server, which is a different base or a
   build from source?

6. **ffmpeg version in the image.** Every HLS fact was measured on ffmpeg
   6.1.1 (KNOWN-FIXES 503-522, 557-583; host table above). The Debian release
   behind `node:22-slim` decides the apt ffmpeg (bookworm 5.1.x, trixie 7.x —
   general knowledge, unverified which `node:22-slim` resolves to today). The
   flags in `src/capture.ts:283-334` exist in both (`-fps_mode` since 5.1 —
   unverified here), but the measured behaviours (fMP4 `EXT-X-VERSION:7`, the
   mp4 muxer audio warning, segment cutting) would be re-measured on a
   different major version. Accept the base's apt ffmpeg, or pin the base to
   a Debian release deliberately?

7. **Tag scheme.** The reference's four tags (`latest`, `sha-<short>`,
   `v<run_number>`, immutable `<VERSION>`; iptv-editor D022/D027/D028/D030)
   need a `VERSION` file and `/health` version fields that marlin-cast does
   not have (`src/server.ts:77-97`; `package.json` `0.0.0`). Adopt all four
   (with the D030 immutability check), or `latest` + `sha-<short>` only for
   now? And is the GHCR package to be set PUBLIC as the reference's is
   (D022 addendum), given the image must then provably contain no `data/`?

8. **Channel cache on first boot.** `src/server.ts:30-39` exits without
   `data/channels.json`; producing it needs both tabs signed in and ~30 s
   (`src/channels.ts:42-79`, `src/providers/youtubetv.ts:134-137`). Is
   `data/channels.json` part of the first-deploy copy (alongside the profile,
   368 channels as of 2026-09-13T01:19Z), or does the entrypoint run `npm run
   channels` when the cache is absent (which makes first boot depend on the
   copied login being alive)? Blocks B's ordering.

9. **Permission for the first local build and its ports.** `docker build`
   on marlinpc pulls `node:22-slim` (a pull, which this pass may not do). May
   the STANDALONE J/G pass pull it? Which host port may the local container's
   app port use (8804 is the dev server; D008 forbids 3000, 5173, 5188, 5189,
   8420, 8800–8803; 8800 and 18091 are taken per iptv-editor task-064)?

10. **The profile copy needs Chrome stopped.** The settled input names "the
    marlinpc profile with both providers" — that is the live
    `data/chrome-profile`, not the basic backup (which predates the Philo
    login). Every trusted copy in the notebook was taken after a graceful
    `SIGTERM`, and the cookie DB batches commits (KNOWN-FIXES 72-75). Stopping
    Chrome is touching the live Chrome (brief line 64). When, and by whom?

---

## What I am least sure of

1. **The Fontconfig error.** I could not find it in KNOWN-FIXES, any report,
   SESSION-STATE, either repo's git history or the session memory; the only
   `fontconfig` matches are ffmpeg's build banner. Either it lives in a log
   the owner has and the notebook never got, or the reference is to a
   different project. I have not guessed at its content.
2. **Debian package names and versions.** Every package fact above was
   checked against Ubuntu 24.04's apt on marlinpc, not against the Debian
   release behind `node:22-slim`. Names (`xvfb`, `x11vnc`, `novnc`,
   `websockify`, `intel-media-va-driver`, `vainfo`) match by convention;
   versions (ffmpeg especially) do not.
3. **Four general-knowledge claims not in the notebook**, each labelled
   where used: Chrome refuses a profile from a newer version; Chrome as root
   needs `--no-sandbox`; Docker's default 64 MB `/dev/shm` crashes Chrome
   renderers; `SingletonLock`'s hostname check does not reclaim across
   container hostnames. All plausible, none measured here.
4. **That stock Xvfb + Chrome + tab capture works at all** (item G). The
   notebook is explicit that it is an inference; PrismCast's production use is
   the only external evidence, and PrismCast's Xvfb is GPU-backed.
5. **Audio capture with no audio device** — found by reading
   `extension/offscreen.js:49-51`, never considered in any report.

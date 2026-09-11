# MARLIN CAST — COLD-START BRIEF (v1, 2026-09-11)

This is the founding brief for a NEW project. There is no code, no repo, and no notebook yet. Task 001 creates them.

## FOREMAN: READ EVERYTHING BEFORE WRITING ANY PROMPT

Before writing a single builder prompt in this project, the foreman reads, in full: the FOREMAN INSTRUCTIONS (v4.1) the owner pastes at the top of the chat, this entire brief, and — once they exist — `notebook/SESSION-STATE.md`, `notebook/DECISIONS.md`, `notebook/KNOWN-FIXES.md`, `notebook/OPEN-ITEMS.md`, and the most recent report in `notebook/reports/`. The first reply in every chat is a CONTEXT CHECK per the template. Nothing settled below gets re-asked, re-derived, or re-litigated.

## WHAT IT IS

Marlin Cast is the owner's own self-hosted browser-capture live-TV tool — a replacement for PrismCast that the owner controls and can fix himself. It logs into a streaming provider in a real Chrome browser, captures the playing video, encodes it, and serves an M3U playlist plus per-channel HLS streams that Channels DVR consumes as a Custom Channels source — exactly the way PrismCast is wired into Channels DVR today.

Why: the owner does not want to depend on a third-party maintainer when the tool breaks.

## DECISIONS ALREADY MADE (owner, 2026-09-11) — these go into notebook/DECISIONS.md verbatim in Task 001

- **D001 — Name:** Marlin Cast. Repo `marlin1111ai/marlin-cast`, container `marlin-cast`.
- **D002 — First provider:** YouTube TV (tv.youtube.com). One provider to start.
- **D003 — Stack:** Node.js 22 + TypeScript, Playwright driving installed Google Chrome, ffmpeg. Not Go, not Python.
- **D004 — Where development happens:** on the Mac, with software (CPU) encoding. Hardware encoding (Intel Quick Sync / VAAPI on the Unraid box's UHD 770) is wired and tested only at deploy time, by the owner, on Unraid.
- **D005 — Sessions:** one login session, one channel playing at a time. No multi-session, no concurrent tunes. Not to be revisited.
- **D006 — Output contract:** an M3U playlist at `/playlist` listing channels, each pointing at an HLS stream served by Marlin Cast; consumed by Channels DVR as a Custom Channels source (Stream Format HLS, stream limit 1). Guide data comes from Channels DVR's own Gracenote matching — Marlin Cast produces no XMLTV.

## FACTS THE FOREMAN MUST KNOW (established elsewhere; quoted, not inferred)

- YouTube TV playback is Widevine DRM. Stream interception does not work; the video must be captured from the rendered browser. Playwright's bundled Chromium has no Widevine — the app must drive the installed Google Chrome (`channel: "chrome"`).
- Google refuses logins from browsers it detects as automated. The app NEVER types credentials. The owner logs in manually, once, in a persistent Chrome profile the app reuses. The app has no knowledge of the password.
- From the owner's Unraid notes on PrismCast (2026-09-10): quality preset 1080p High was chosen over 720p and 4K ("4K raised bitrate but cost ~a third of the frame rate"); Channels transcoder stays "none"; PrismCast's HDHomeRun emulation on :5004 does not work with Channels DVR ("its auto-discovery assumes port 80") — Marlin Cast does not emulate HDHomeRun.
- Design references, read-only, no code copied: PrismCast (github.com/hjdhjd/prismcast) and Chrome Capture for Channels. They prove the approach works for YouTube TV; they are not a license to lift code.

## ENVIRONMENT

- Builder: Claude Code on the Mac Studio. Repo at `/Apps/marlin-cast`. Read-only reference tree: `/Apps/marlin-iptv-editor` (for its GitHub Actions → GHCR image pipeline and notebook conventions only).
- Deploy target: Unraid at 192.168.1.250, Docker, bridge network, `--device /dev/dri`, image pulled from GHCR by a pinned version tag, container added by the owner through the Unraid GUI. A pinned tag shows "not available" in Unraid's VERSION column — that is expected.
- Ports (foreman's contained call, 2026-09-11): Mac dev port **8804**. Unraid container port **8091** (8091–8099 are unoccupied per the owner's Unraid notes). Never bind on the Mac: 3000, 5173, 5188, 5189, 8420, 8800, 8801, 8802, 8803.
- Chrome and ffmpeg on the Mac are prerequisites. The builder checks for them; it never installs them. Installs are the owner's step.

## STANDING PROHIBITIONS — every prompt carries these

- The builder never connects to the Unraid host (no ssh, no curl, no docker commands against it) and never touches any container on it: `prismcast`, `channelsdvr_intel`, `fastchannels`, `marlin-iptv-editor`, `marlin-cad`.
- `/Apps/marlin-iptv-editor` is never written to.
- No credentials, cookies, tokens, session IDs, or account identifiers in the repo, logs, reports, or commits. The Chrome profile directory is gitignored. Everything sensitive is `[REDACTED]` in reports.
- Nothing is ever force-pushed or history-rewritten.
- Scope lock and the do-not-touch list bind every prompt, every time.

## NOTEBOOK LAYOUT (created in Task 001, same shape as the IPTV Editor)

`notebook/SESSION-STATE.md` (running log, newest at bottom), `notebook/DECISIONS.md` (D-numbers, wording verbatim), `notebook/KNOWN-FIXES.md`, `notebook/OPEN-ITEMS.md`, `notebook/reports/task-NNN-*.md`. This brief is copied in as `notebook/BRIEF-v1.md`.

## CONTEXT PANEL FOR THIS PROJECT

Start: add this file (`MARLIN-CAST-BRIEF.md`). After Task 001 lands: add `notebook/SESSION-STATE.md`, `notebook/DECISIONS.md`, `notebook/KNOWN-FIXES.md`, `notebook/OPEN-ITEMS.md`. Delete before re-adding, never drag-and-replace.

## TASK 001 — KICKOFF (the first builder prompt; the foreman pastes it as written)

Task 001 scaffolds the repo and notebook, gets the owner logged in through a persistent Chrome profile, and does a read-only investigation of tv.youtube.com plus a comparison of capture methods — and then STOPS. It writes no capture code, no encoder, no HLS server, no Dockerfile. The capture method is a genuine implementation choice and is raised to the owner as a decision before any of it is built (Task 002). The full prompt text is in the foreman's handoff message and is reproduced below.

---

TASK 001 — MARLIN CAST KICKOFF: scaffold, manual login, read-only investigation. NO CAPTURE CODE.

1. READ FIRST — do not re-derive what these settle: MARLIN-CAST-BRIEF.md (the owner will place it at /Apps/marlin-cast/MARLIN-CAST-BRIEF.md before you start, or paste it; if it is not present, STOP and ask for it). Decisions D001–D006 are final.

2. WORKING DIRECTORY: /Apps/marlin-cast — create it. This is the only writable tree.

3. READ-ONLY REFERENCE: /Apps/marlin-iptv-editor — read its .github/workflows/*.yml, Dockerfile, and notebook/ for the GHCR pipeline pattern and notebook conventions ONLY. Do not copy files from it; do not run anything in it.

4. ABSOLUTE DO-NOT-TOUCH — if anything pulls you toward these, STOP and report:
   - The Unraid host at 192.168.1.250 and every container on it (prismcast, channelsdvr_intel, fastchannels, marlin-iptv-editor, marlin-cad). No ssh, no curl, no docker against it.
   - /Apps/marlin-iptv-editor — no writes.
   - Any streaming site other than tv.youtube.com, and tv.youtube.com only via the steps in 5d–5e.
   - Google's login page — you never type into it. The owner logs in by hand.
   - brew, apt, or any system installer. You check for prerequisites; you never install them.

5. THE TASK — numbered, do only these:
   a. Prerequisite check, read-only: confirm Node 22+, Google Chrome (the real one, at /Applications/Google Chrome.app), and ffmpeg are present on this Mac, with versions. If any is missing, finish the rest of this task where possible and report the missing item as a blocker — do not install.
   b. Repo: `git init` at /Apps/marlin-cast on branch main. Create the GitHub repo marlin1111ai/marlin-cast (private) with `gh repo create` if gh is installed and authenticated; if not, STOP after committing locally and report that the owner must create the remote. Add origin, push main.
   c. Notebook: create notebook/SESSION-STATE.md (a Task 001 entry, newest at bottom), notebook/DECISIONS.md (D001–D006 copied verbatim from the brief), notebook/KNOWN-FIXES.md (empty template), notebook/OPEN-ITEMS.md (empty template), notebook/reports/, and notebook/BRIEF-v1.md (a copy of the brief).
   d. Scaffold: package.json with exactly these dependencies and no others — playwright, express, typescript, tsx. `.gitignore` covering node_modules, dist, data/, and any *.log. A `data/chrome-profile/` directory (gitignored) for the persistent Chrome profile. A single `src/login.ts` that launches the INSTALLED Google Chrome (Playwright `chromium.launchPersistentContext` with `channel: "chrome"`, headed, profile at data/chrome-profile) and opens https://tv.youtube.com, then waits. Nothing else in src/.
   e. Manual login: run src/login.ts, print "OWNER: log in to YouTube TV in the Chrome window that just opened, then press Enter here" and wait. After the owner confirms, close Chrome, relaunch with the same profile, and prove with a screenshot (saved under notebook/reports/, account name blurred or cropped) that the session persisted and the live guide loads without a login prompt.
   f. Read-only investigation of tv.youtube.com, in the logged-in Chrome, by observation only (DevTools/DOM inspection, URL bar, network tab — no scripted playback beyond navigating and clicking play once): how a specific channel is selected (deep-link URL scheme, or DOM interaction — record the exact URL pattern and/or selectors); the video element and how the player is made fullscreen / UI hidden; whether playback runs at all in Playwright-driven Chrome (Widevine present, no "unsupported browser" wall, no automation-detection wall — record exactly what you see); resolution and frame rate the player delivers at the chosen 1080p setting.
   g. Capture-method comparison, by reading only: read how PrismCast (github.com/hjdhjd/prismcast, read-only, no code copied) captures the browser video, and list the realistic methods available to this stack on the Mac now and in Docker on Unraid later — at minimum: CDP screencast, Chrome tab capture via an extension/getDisplayMedia, X11/Xvfb screen grab by ffmpeg, and any other method you find in use. For each: fps and quality ceiling, CPU cost, whether it works headless vs needs a virtual display, whether it works in a Docker container with /dev/dri, and how audio is captured. Recommend one, with the single reason. This is a decision for the owner, not a choice you make.

6. EXPLICITLY OUT OF SCOPE — the scope lock: no capture code, no ffmpeg invocation, no encoder, no HLS server, no /playlist endpoint, no channel list, no Dockerfile, no GitHub Actions workflow, no tests framework, no linter, no config system, no logging library, no dependencies beyond the four named. If you believe something extra is needed, finish what you can, STOP, and report it as a question: what, why, what breaks without it. Nothing unrequested gets built.

7. CONSTRAINTS: dependency budget is exactly playwright, express, typescript, tsx. Port 8804 is reserved for this project but nothing binds it in this task. Never bind 3000, 5173, 5188, 5189, 8420, 8800, 8801, 8802, 8803. No process is left running at the end — prove it with `ps`.

8. EVIDENCE RULES: every finding in 5f carries a screenshot or a copied DOM/URL snippet. Every claim about PrismCast in 5g carries the file path and line range in its repo. Versions in 5a are command output, not memory. Anything you could not observe is written as "not observed" — never guessed. Every URL, cookie, token, account name, and email is [REDACTED].

9. DELIVERABLE: notebook/reports/task-001-kickoff.md with, in order: (i) prerequisite results; (ii) login persistence proof; (iii) tv.youtube.com findings (5f); (iv) capture-method comparison and one recommendation (5g); (v) OPEN QUESTIONS; (vi) SCOPE CHECK — every file created, mapped to the step that required it. Print the SCOPE CHECK table in the terminal too. Commit everything with "Task 001: kickoff — scaffold, login, investigation" and push to origin/main. Verify the push with `git fetch` and comparing `git rev-parse HEAD` to `git rev-parse origin/main` — not by trusting the push output. State what was pushed.

10. STOP AND REPORT: stop at 5b if the remote cannot be created; stop at 5e if login cannot be completed; stop at 5f if playback is blocked by a wall of any kind (report the exact wall — that finding alone is a valid outcome). On any failure: snapshot state, diagnose with evidence, do not retry blind.

11. CLOSING SUMMARY for the owner, plain English: does YouTube TV play inside automated Chrome, yes or no; which capture method you recommend and why in one sentence; the three things you are least certain about.

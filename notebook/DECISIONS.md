# DECISIONS.md

This file starts fresh on 2026-09-11 with the creation of the Marlin
Cast project. It covers this project only. See the Marlin IPTV Editor
project's own notebook for anything belonging to that project —
nothing is carried over here.

Numbering starts at D001. Each entry is a decision, correction, or
standing rule, owner-ruled or owner-confirmed unless marked otherwise.

---

## D001 — Name

Name: Marlin Cast. Repo `marlin1111ai/marlin-cast`, container
`marlin-cast`.

**Dated 2026-09-11.**

---

## D002 — First provider

First provider: YouTube TV (tv.youtube.com). One provider to start.

**Dated 2026-09-11.**

---

## D003 — Stack

Stack: Node.js 22 + TypeScript, Playwright driving installed Google
Chrome, ffmpeg. Not Go, not Python.

**Dated 2026-09-11.**

---

## D004 — Where development happens

Where development happens: on the Mac, with software (CPU) encoding.
Hardware encoding (Intel Quick Sync / VAAPI on the Unraid box's UHD
770) is wired and tested only at deploy time, by the owner, on Unraid.

**Dated 2026-09-11. SUPERSEDED by D007** — development moved to
marlinpc (Linux), and VAAPI is tested during development.

---

## D005 — Sessions

Sessions: one login session, one channel playing at a time. No
multi-session, no concurrent tunes. Not to be revisited.

**Dated 2026-09-11.**

---

## D006 — Output contract

Output contract: an M3U playlist at `/playlist` listing channels, each
pointing at an HLS stream served by Marlin Cast; consumed by Channels
DVR as a Custom Channels source (Stream Format HLS, stream limit 1).
Guide data comes from Channels DVR's own Gracenote matching — Marlin
Cast produces no XMLTV.

**Dated 2026-09-11.**

---

## D007 — Development host

Development host (owner, 2026-09-11): development happens on marlinpc
(Pop!_OS 24.04, Linux x86_64), not the Mac. This supersedes D004's "on
the Mac, with software (CPU) encoding." Hardware encoding via VAAPI on
marlinpc's /dev/dri is tested during development, not deferred to
deploy. D004's deferral existed only because the Mac had no /dev/dri.
Deploy target is unchanged: Unraid Docker with --device /dev/dri.

**Dated 2026-09-11.**

---

## D008 — Dev server binding

Dev server binding (foreman's contained call, 2026-09-11): the dev
server binds 0.0.0.0:8804 so the owner can reach it from the Mac at
http://<marlinpc-LAN-IP>:8804. Unraid container port remains 8091.
Never bind 3000, 5173, 5188, 5189, 8420, 8800, 8801, 8802, 8803.

**Dated 2026-09-11.**

---

## D009 — Browser control method

Browser control method (owner, 2026-09-11): the app attaches to an
owner-launched Chrome over CDP (chromium.connectOverCDP), rather than
Playwright launching and owning the profile via
launchPersistentContext. Reason: CDP attach is the only tested
configuration reporting navigator.webdriver === false, and automation
detection is the best-supported remaining explanation for server-side
session invalidation (task-001c). The debug port binds loopback only
and is never published from the container. Supersedes the
launchPersistentContext approach in Task 001's src/login.ts.

**Dated 2026-09-11.**

---

## D010 — Cookie encryption scheme

Cookie encryption scheme (owner, 2026-09-11): Chrome runs with
--password-store=basic everywhere, development and container alike, and
the YouTube TV login is taken in that scheme. Reason: v11 keyring
encryption is machine-bound and a stock container has no keyring;
task-004 measured one basic-scheme launch destroying 17 of 17 auth
cookies, and no supported v11-to-v10 migration exists. Accepted cost:
v10 uses a hardcoded key, so the cookie store is readable by anyone with
filesystem access to the profile volume. Supersedes
--password-store=gnome-libsecret in scripts/start-chrome.sh.

**Dated 2026-09-11.**

---

## D011 — Capture method

Capture method (owner, 2026-09-11): video and audio are captured with a
purpose-built Chrome extension using chrome.tabCapture, not CDP
screencast and not X11/ffmpeg screen grab. Reason: tab capture is the
only method that yields video and tab audio as one already-synchronised
stream, and A/V drift is what ruins long recordings. PrismCast achieves
this via puppeteer-stream, which is Puppeteer-only and therefore
unavailable to this stack.

**Dated 2026-09-11.**

---

## D012 — Deployment target

Deployment target (owner, 2026-09-11): Marlin Cast runs in Docker on
Unraid. marlinpc is the development machine only, not the permanent
home. Reason: Unraid runs 24/7 alongside Channels DVR; marlinpc is a
desktop in active use for other GPU work.

**Dated 2026-09-11.**

---

## D013 — Channel list

Channel list (owner, 2026-09-11): the playlist carries the full YouTube
TV lineup as enumerated from the guide, unfiltered. Channels DVR hides
unwanted channels on its side. No curation, whitelist, or config-file
channel list in Marlin Cast.

**Dated 2026-09-11.**

**Note (2026-09-12, owner-ruled):** guide rows that link to a browse page and
carry no stream are not channels and stay out of the playlist. Six were
observed on 2026-09-12: ESPN row 26, NBCSN Extra rows 30–32, Cartoon Network
46, WNBA on ION 133 (notebook/reports/recon-stable-ids.md, step 2).

---

## D014 — Hardware decode testing

Hardware decode testing (owner, 2026-09-11): the GPU decode question is
deferred to first run on Unraid. marlinpc's /dev/dri has no usable VAAPI
driver (NVIDIA card, no nvidia_drv_video.so), so testing it here would
measure the wrong GPU. Amends D007's premise that VAAPI is tested during
development. No VAAPI driver is installed on marlinpc.

**Dated 2026-09-11.**

**Note (2026-09-13, owner-ruled):** the GPU decode test on Unraid is still
open. The deployed container (D026) passes `/dev/dri` but runs on CPU
decode/encode today.

**Note (2026-09-26):** closed by D029.

---

## D015 — Station-ID guide matching

Station-ID guide matching (owner, 2026-09-11 evening): channels carry a
`tvc-guide-stationid` so Channels DVR can match guide data by station id
rather than relying only on Gracenote name matching. The source of
name→ID pairs is **PrismCast's own /playlist**, which already ships a
`tvc-guide-stationid` per channel; a hand-built mapping is the fallback
where PrismCast has no matching entry. This refines D006 (guide data
comes from Channels' own Gracenote matching, no XMLTV from Marlin Cast):
Marlin Cast still produces no XMLTV, but it may supply the station id
that steers the match.

**Only a test sliver is built:** task-017 hardcoded
`tvc-guide-stationid="32645"` on the single ESPN entry the owner tunes
(`MrXg0chrojg`), read live from PrismCast's ESPN line. No mapping table,
file, or config exists yet; the full name→ID mapping for 144 channels
(and resolving duplicate-name feeds) is unbuilt.

**Dated 2026-09-11.**

**Note (2026-09-12, owner-ruled):** the ESPN sliver is re-keyed from the
rotating watch id `MrXg0chrojg` to guide row 17's stationId
`UCW7W_WAogi3qWDbO9PqOmZQ` (D020).

---

## D016 — Deployment: Marlin DVR via Marlin IPTV Editor; Channels defect parked

Marlin Cast is consumed by Marlin DVR via Marlin IPTV Editor (playlist +
guide from the editor), confirmed playing on Apple TV. PrismCast stays as
the Channels DVR source. The Channels DVR playback defect (Channels'
remuxer emits one output segment and stalls; tasks 009–019 ruled out
CORS, tune latency, container, PROGRAM-DATE-TIME format and presence,
in-band SPS/PPS, guide data) is parked, not fixed. Untested remaining
differences: 1 s segments / TARGETDURATION 1; MEDIA-SEQUENCE restarting
at 0 with no DISCONTINUITY.

**Dated 2026-09-11 (evening).**

---

## D017 — Second provider: Philo

Second provider: Philo (www.philo.com), alongside YouTube TV. This
supersedes D002's "one provider to start" — D002's choice of YouTube TV
as the first provider stands; only its "one provider" clause is spent.

Philo tops out at **1280×720 @ 30 fps** under Widevine L3 (its AMC
manifest's top rung is the 4300000 representation at 1280×720; there is
no 1080p rung, and the player exposes no JS API to pin one). That is
accepted: the Philo picture is upscaled into the 1920×1080 capture frame
exactly as ESPN is today.

D005 is read as **one tune at a time**. Two logged-in provider sessions
in the one Chrome profile is the normal state and is not the
"multi-session" D005 rules out; what D005 forbids is two channels
playing or two tunes at once, and that is unchanged.

**Dated 2026-09-12. Owner-ruled.**

---

## D018 — One tab per provider, selected by URL host

One tab per provider, both opened by the owner via
`scripts/start-chrome.sh`. The app selects the tab by **URL host** —
`tv.youtube.com` for YouTube TV, `www.philo.com` for Philo — and never
falls back to "any page". If the provider's tab is not open the tune
fails loud with `fatal: no <provider> tab open`.

Reason: with two providers logged in to one Chrome, the old
`findPageTarget` rule ("the page whose URL includes tv.youtube.com, else
any page") would silently drive the wrong tab — a Philo tune would have
landed in the YouTube TV tab.

**Dated 2026-09-12. Owner-ruled.**

---

## D019 — Philo lineup: every row, all three tiers

Philo lineup: **every row the guide's channel list returns, unfiltered**,
across all three tiers (Favorite channels / All channels / Free
channels). This extends D013 — which is worded for YouTube TV and says
nothing about a tiered lineup — to Philo without changing its rule.
Philo entries carry `group-title="Philo"`.

Curation stays in Marlin IPTV Editor. No whitelist, tier filter, or
config-file channel list in Marlin Cast.

**Dated 2026-09-12. Owner-ruled.**

---

## D020 — Stream URL identity

Stream URLs are `/stream/<key>/index.m3u8`, where **key** is YouTube TV's
guide `stationId` (`epgRowRenderer.stationId`) or Philo's `channelId`. The
provider's watch/broadcast id is resolved at tune time and never appears in a
URL.

Reason: the consumer (Marlin IPTV Editor) identifies a channel by stream URL,
and YouTube TV watch ids rotate (notebook/reports/recon-stable-ids.md: three
ESPN watch ids rotated 2026-09-11 → 12 and again within hours on 2026-09-12).

**Dated 2026-09-12. Owner-ruled.**

**Note (2026-09-12, owner-ruled):** stale-watch-id detection is PARKED. The
only stale case observed (task-022 V5) was an event feed, and no regular
channel's watch id has been seen to rotate. Reopen only when a regular
channel's watch id is observed to change. The task-022 single re-read + retry
on a poll-1 miss stays as built.

---

## D021 — Per-provider playlists

`/playlist/youtube-tv` and `/playlist/philo`, each the same format as
`/playlist` filtered to one provider. `/playlist` is unchanged: both
providers, full.

**Dated 2026-09-12. Owner-ruled.**

---

## D022 — Duplicate-name event feeds

**SUPERSEDED by D023 (2026-09-12):** event feeds are excluded from the lineup,
so event-feed naming no longer applies.

Guide rows marked `isDiscreteStation: true` whose name equals a non-discrete
row's name carry `tvg-name "<name> (event N)"`, N by guide position ascending.

Reason: the editor matches by name, and these feeds have no guide entry
anywhere. Observed on 2026-09-12 on ESPN rows 23–25
(notebook/reports/recon-stable-ids.md, step 2).

**Dated 2026-09-12. Owner-ruled.**

---

## D023 — YouTube TV event feeds are not channels

YouTube TV guide rows marked `isDiscreteStation: true` (event feeds) are
excluded from the lineup and the playlist. This amends D013 in the same spirit
as its note on rows with no stream.

Reason (task-022 V6): their keys and watch ids rotated within 20 minutes.
They are not channels the consumer can hold, and no guide lists them.
Supersedes D022.

**Dated 2026-09-12. Owner-ruled.**

---

## D024 — The container: ports, base image, Chrome pin, viewer, user, first boot

Owner-ruled 2026-09-13, answering notebook/reports/recon-docker.md's
questions 1–4, 6, 8–10. Built in task-024 (`Dockerfile`, `docker/entrypoint.sh`,
`.dockerignore`).

1. **Ports.** The app listens on **8804 inside the container**; Unraid
   publishes **host 8091 → 8804** (D008's "container port 8091" is the host
   side). The three hardcoded 8804s (`src/server.ts`, the ingest URL in
   `src/capture.ts`, `extension/manifest.json`) stay. `/playlist`,
   `/playlist/*` and every stream URL are built from the request's `Host`
   header, so consumers see the published host:port. Chrome's debug port 9333
   stays loopback and unpublished (D009).
2. **Image.** `ubuntu:24.04`; Node 22 from NodeSource; **ffmpeg from Ubuntu
   apt, and the build fails unless it is 6.1.x** (every HLS fact was measured
   on 6.1.1); **Google Chrome pinned to `153.0.8010.36-1`** from the
   dl.google.com pool deb (the build every hard-won fact was measured on and
   the copied profile's `Last Version`); Xvfb; `fontconfig` + `fonts-liberation`
   + `fonts-dejavu-core` (clears Chrome's "Fontconfig error: Cannot load
   default config file: File not found"). Image name
   `ghcr.io/marlin1111ai/marlin-cast` (publishing is a later pass).
3. **Viewer.** noVNC (x11vnc on loopback 5900 + websockify) on **container
   port 6080, published as host 8092**. Password from env **`VNC_PASSWORD`**;
   unset = the entrypoint exits with a loud error before starting anything.
   VNC auth keeps the first 8 characters.
4. **Process user.** `PUID`/`PGID` env, **default 99/100**. Everything after
   the entrypoint's setup runs as that user, never root. The profile volume is
   **`/data/chrome-profile`**; the channel cache is `/data/channels.json`
   (`MC_DATA_DIR=/data`); HLS scratch stays **inside the container**
   (`MC_HLS_DIR=/tmp/marlin-cast/hls`). The entrypoint re-owns `/data` to
   PUID:PGID when the top level is owned by someone else.
5. **First boot.** If `/data/channels.json` is missing the entrypoint runs
   enumeration after Chrome and both tabs are up. **Signed-out = loud FATAL;
   the container stays up** (Chrome + viewer) so the owner can log in through
   noVNC, wait ~70 s for Chrome to commit cookies (KNOWN-FIXES), and restart
   the container.
6. **Required mechanics.** Chrome version pin; `SingletonLock` /
   `SingletonCookie` / `SingletonSocket` removed at every start; clean
   shutdown on SIGTERM — app, then Chrome (graceful, task-003), then the
   viewer, then Xvfb, then a sweep so no Chrome/Xvfb/ffmpeg survives — under
   `tini` as PID 1.
7. **Xvfb is 1920×1080×24** because capture follows the display (brief,
   KNOWN-FIXES); the display is `:99`. Chrome is launched through
   `scripts/start-chrome.sh` with its flags unchanged (`MC_PROFILE` selects
   the volume path).
8. **Required run parameters: `--cap-add SYS_ADMIN` and `--shm-size=1g`.**
   Owner-ruled 2026-09-13 after the task-024 smoke run. Under Docker's
   default capability set Chrome's sandbox cannot create its namespaces
   (`Failed to move to new namespace … errno = Operation not permitted`,
   then `Zygote process exited prematurely`) and Chrome never starts;
   `SYS_ADMIN` lets the sandbox come up with the `start-chrome.sh` flags
   unchanged — `--no-sandbox` was rejected as a change to the ruled flag
   set. `--shm-size=1g` replaces Docker's default 64 MB `/dev/shm`, a known
   Chrome crash cause. On Unraid both go in the template's Extra Parameters.

**Not in task-024:** the GitHub Actions/GHCR workflow and tag scheme
(recon Q7), the Unraid deploy, the live-profile copy, the VAAPI/decode test
(D014; no VAAPI packages are in the image yet — recon Q5's stock-Xvfb point
stands), hardware encoding.

**Note (2026-09-26):** the VAAPI/decode test is closed by D029; hardware
encoding is closed by D030.

**Dated 2026-09-13.**

---

## D025 — Image publishing: GHCR, tag scheme, build trigger

Owner-ruled 2026-09-13 (task-025), following marlin-iptv-editor's
`publish-image.yml` convention (recon-docker item H).

1. **Image name:** `ghcr.io/marlin1111ai/marlin-cast`, `linux/amd64` only.
2. **Trigger:** `.github/workflows/docker.yml` runs on a push to `main`
   (skipped when every changed file is under `notebook/**`, is `*.md`, or is
   `.gitignore`), on a push of a git tag `v*`, and on `workflow_dispatch`.
   Authentication is the run's own `GITHUB_TOKEN` with `packages: write`;
   no PAT, no secret in the repo. buildx with a GitHub Actions layer cache.
3. **Tags:** a push to `main` publishes **`latest`** and **`sha-<short>`**.
   A tag `vX.Y.Z` publishes **`X.Y.Z`** only, and only if `X.Y.Z` equals the
   repo-root **`VERSION`** file (starts at `0.1.0`) and does not already exist
   in GHCR — version tags are immutable; a mismatch or an existing tag fails
   the run before anything is pushed. The reference's `v<run_number>` tag is
   not used, so `v*` means one thing here.
4. **Release procedure:** bump `VERSION`, commit, push `main` (publishes
   `latest`), then `git tag vX.Y.Z && git push origin vX.Y.Z` (publishes
   `X.Y.Z`). Unraid runs `latest` or a pinned `X.Y.Z`.
5. **Package visibility** is a GitHub-side setting the owner makes once
   (reference D022 addendum: package PUBLIC, repo private) so Unraid pulls
   without a token. Until then the package is private and pulls need a login.
6. The Dockerfile takes no build-args (D024); nothing is passed. The image
   carries no version string of its own — the tag is the version.

**Dated 2026-09-13.**

---

## D026 — Deployed

Marlin Cast runs as the Unraid container **`marlin-cast`** from
**`ghcr.io/marlin1111ai/marlin-cast:latest`** (0.1.1):

- **Ports:** host **8091 → 8804** (app), host **8092 → 6080** (viewer) — D024
  item 1 and 3.
- **Volume:** `/mnt/user/appdata/marlin-cast/data` → `/data`.
- **Device:** `/dev/dri`.
- **Env:** `VNC_PASSWORD`, `PUID=99`, `PGID=100`.
- **Extra Parameters:** `--cap-add SYS_ADMIN --shm-size=1g` (D024 item 8).
- **WebUI:** `http://[IP]:[PORT:8804]/`.
- **Icon:** `https://raw.githubusercontent.com/marlin1111ai/marlin-cast/main/assets/icon.png`
  (D027; KNOWN-FIXES on why not the container's own `/icon.png`).

The first-boot profile was copied from
`backups/chrome-profile-2providers-20260913-0746.tgz`. Owner-confirmed
playing on Apple TV through Marlin IPTV Editor, with sources
`/playlist/youtube-tv` and `/playlist/philo` (D021).

**D012 is fulfilled; marlinpc is dev-only from here.**

**Dated 2026-09-13. Owner-ruled.**

**Note (2026-09-13, owner-ruled):** Later the same day the owner replaced the
two editor sources with the single /playlist source; the editor separates
providers by group-title. /playlist/youtube-tv and /playlist/philo remain
available (D021).

**Note (2026-09-28, owner):** the Unraid container was force-updated to
latest = sha-13071d7 (task-031).

---

## D027 — The repo is public

Repo `marlin1111ai/marlin-cast` is public (owner, 2026-09-13), so raw
GitHub URLs serve the icon to Unraid without a token. The no-credentials rule
is unchanged: no credential, cookie, token, session id or account identifier
goes into the repo, the image, or the notebook.

**Dated 2026-09-13. Owner-ruled.**

---

## D028 — Per-container capture size

Per-container capture size. Owner-ruled (option a): use the existing env
knobs, add only the YouTube TV quality follow. `MC_WIDTH`/`MC_HEIGHT`
(`src/capture.ts`, task 008) set capture and output size, default 1920×1080;
`MC_XVFB_SCREEN` (`docker/entrypoint.sh`, task 024) sets the display, default
`1920x1080x24`; YouTube TV's quality target now follows the capture height
(1080 → hd1080, 720 → hd720). A container that sets none of them is
unchanged; the Unraid container sets none. Amends D024 item 7 and the hd1080
pin.

Reason: on the owner's father's QNAP TVS-EC1080 (Intel Xeon E3-1245 v3, 4
cores/8 threads, 32 GB, QTS 5.2.10) CPU read 97% during 1080p playback and
the picture played in slow motion on Apple TV through Channels DVR. QNAP
Resource Monitor during 1080p YouTube TV playback (WBAL 11): chrome processes
76.1% combined (largest single 58.67%), Marlin Cast's ffmpeg 17.72%,
channels-dvr 0.7%, total 97.4% (owner-observed 2026-09-26).

**Mechanics as built.** `src/providers/youtubetv.ts` poll 4: the ladder
`hd1080, hd720, large, medium, small, tiny` now starts at the highest level
whose height is ≤ `MC_HEIGHT` (1080 or more → hd1080, the ladder unchanged;
720–1079 → hd720; below 144 → tiny). The target is still the best level the
channel advertises from that start, so ESPN-style channels still settle
lower and warn. `is1080` and the warning compare against the start of the
ladder: the warning reads `channel offers no <start>`, word-for-word the old
text at 1080. `MC_WIDTH`, `MC_HEIGHT`, `MC_FPS`, `MC_XVFB_SCREEN`, the 6000k
bitrate, Philo and the entrypoint are unchanged.

**Verified 2026-09-26 on marlinpc** (image built locally from this change; the
2026-09-13 two-provider backup as `/data`, both providers signed in; first
boot enumerated 375 = YouTube TV 141 + Philo 234). One tune at a time, 60 s
of playback each. CPU is % of one core on marlinpc's i9-14900KF (32 threads),
so it measures the ratio between runs, not the QNAP's load. "HLS/wall" is
media added to the playlist over the 60 s window divided by wall clock.

| run | channel | output | quality | warning | container CPU (docker stats) | chrome | ffmpeg | HLS/wall |
|---|---|---|---|---|---|---|---|---|
| A (no env) | WBAL 11 | 1920×1080 | hd1080 | none | 373% | 235% | 136% | 0.992 |
| B `MC_WIDTH=1280 MC_HEIGHT=720` | WBAL 11 | 1280×720 | hd720 | none | 280% | 190% | 78% | 1.005 |
| B2 = B + `MC_XVFB_SCREEN=1280x720x24` | WBAL 11 | 1280×720 | hd720 | none | 270% | 183% | 76% | 1.006 |
| A | Philo AMC | 1920×1080 | 720p | D017 upscale | 253% | 132% | 116% | 1.010 |
| B | Philo AMC | 1280×720 | 720p | D017 upscale¹ | 189% | 122% | 65% | 0.991 |
| B2 | Philo AMC (2nd tune)² | 1280×720 | 720p | D017 upscale¹ | 185% | 123% | 65% | 1.007 |

WBAL 11 advertised hd1080 in every run; in B and B2 the tune targeted hd720
anyway (`target: hd720`, `is1080: true`, `box == viewport == 1280x720`).
Status page "last quality" matched `/health` in every run. YouTube TV at 720p:
container −25%, chrome −19%, ffmpeg −43% against A. B2 over B: ~4% less
container CPU on WBAL, within the run-to-run spread; B2 saves little.

¹ Philo's warning text is unchanged (Philo out of scope) and in 720p mode
reads "capturing 1280x720 upscaled into the 1280x720 frame" — nothing is
upscaled. ² Both B2 Philo tunes landed in an ad break; each logged "the
control overlay did NOT clear after 3 pointer sweeps" and took 14–15 s to
stream (A and B: 4–6 s). The frames show Philo's "Advertisements · LIVE /
Fast Forward Restricted" label for the ad's length and a clean picture once
the programme resumed. The first B2 tune's window was entirely ad (178%
container CPU); the table uses the second, mostly-programme window. The
smaller display is not ruled out as a factor.

**Dated 2026-09-26. Owner-ruled.**

**Note (2026-09-26, owner-observed):** the QNAP now runs image sha-c876a3a
with MC_WIDTH=1280 MC_HEIGHT=720 (MC_XVFB_SCREEN not set). QNAP Resource
Monitor at 720p:
- WBAL 11 (YouTube TV): total 33.04%; chrome processes 18.1% combined;
  ffmpeg 12.39%; channels-dvr 0.38%. Owner: plays at normal speed.
- Philo History: total 32.08%; chrome processes 16.4% combined; ffmpeg
  9.47%; channels-dvr 0.52%. Playback speed not stated by the owner.

Against 97.4% at 1080p (D028 reason).

**Note (2026-09-26):** Owner: Philo History played at normal speed at 720p (2026-09-26).

---

## D029 — Open items closed

Open items closed. Not pursued; reopen if seen:
- whether the 20 s idle timeout is the right number
- whether isDiscreteStation:true ever appears on a regular channel
- whether a YouTube TV stationId survives a rotation of a regular channel
- what happens to a running Philo capture at a programme boundary
- whether the Philo overlay sweep holds up over many tunes
- A/V drift on long captures
- the D014 GPU decode test on Unraid

Left as is, known and not fixed: Philo's tune warning in 720p mode reads
'upscaled into the 1280x720 frame' though nothing is upscaled.

**Dated 2026-09-26. Owner-ruled.**

---

## D030 — Remaining open items closed

Remaining open items closed. Every item left for the owner's call in
task-029, as listed under the brief's KNOWN OPEN QUESTIONS at e929699, is not
pursued; reopen if seen. notebook/OPEN-ITEMS.md is settled. Recorded answers:
the Unraid container shows tag latest and no version, so which build it runs
is not known; Philo History played at normal speed on the QNAP at 720p (owner,
2026-09-26).

Items closed (reports are in `notebook/reports/`; "also" marks the same item
recorded in a second place):
- Unraid's running image — task-027.md:138 (answered above: not known).
- Release tags: the `v*` path never run, no `X.Y.Z` tag in GHCR —
  task-025.md:201, 207; task-027.md:150.
- notebook/OPEN-ITEMS.md's four 2026-09-11 items — OPEN-ITEMS.md:10–21.
- YouTube TV quality pin across ad breaks and long runs; a progressively
  filled quality list latching hd720 — task-002-cdp-attach.md:375, 405;
  task-006-capture-spike.md:367; task-008-pipeline.md:402;
  task-011-tune-latency.md:248.
- Sub-1080p channels proceed with a warning rather than fail —
  task-011-tune-latency.md:85, 235, 255; also SESSION-STATE.md:654.
- 60 fps not pursued (`MC_FPS` 30) — task-006-capture-spike.md:156, 450.
- MediaRecorder output after 20–30 min — task-001-kickoff.md:276.
- Switch-storm and park/tune races — task-008-pipeline.md:417; task-018.md:150.
- Lip-sync against the broadcast — task-006-capture-spike.md:302.
- Long runs in general — also SESSION-STATE.md:474.
- Session durability across days, reboots and Chrome updates —
  task-002-cdp-attach.md:351; task-003-relaunch-survival.md:229;
  task-005-basic-scheme.md:244, 275.
- Philo tune path: live-edge seek off AMC or in ads — task-021.md:592;
  persisted-query hash — task-021.md:551; `tileGroupId` staleness —
  task-021.md:557; the no-live-broadcast path — task-021.md:568; `channelId`
  across days and tiers — recon-stable-ids.md:206, 332; CSS-module class
  names — recon-philo.md:166; logos in clients — task-021.md:562.
- Philo playback speed at 720p on the QNAP — DECISIONS.md:545 (D028 note);
  also task-028.md:68 (answered above: normal speed).
- Hardware (VAAPI) encoding and its CPU saving — task-006-capture-spike.md:385;
  task-007-gpu-drm-capture.md:289, 345; also MARLIN-CAST-BRIEF.md NOT YET BUILT,
  DECISIONS.md:396 (D024, "Not in task-024"), SESSION-STATE.md:1179.
- Chrome 153 deb pin may vanish from Google's pool — recon-docker.md:131.
- Nothing restarts Chrome if it dies — task-001c-cookie-destruction.md:226.
- `triggerAction` has no fallback — task-006-capture-spike.md:380, 483.
- Unused Playwright dependency — task-021.md:565; also task-021.md:64,
  recon-docker.md:62, 112.
- No type-check gate — task-008-pipeline.md:309; task-022.md:58; also
  task-001-kickoff.md:379, recon-docker.md:101.
- Dead PDT rewrite — task-019.md:45.
- `last_error` on a normal stop — task-008-pipeline.md:396; also
  task-008-pipeline.md:277, task-024.md:248.
- ffmpeg exit 255 at idle stop — task-022.md:211.
- The `is1080` name — task-028.md:75.
- `/health` shows the key — task-022.md:384.
- `access-control-allow-origin: *` with no auth — task-009-hls-compliance.md:391.
- The parked guide keeps `#movie_player` mounted; a longer-dwell check —
  task-018.md:135, 144.
- Duplicate names in the consumer — task-008-pipeline.md:385.
- noVNC `/` forward and copy buttons in a real browser — task-026.md:95;
  task-027.md:120.
- GHCR attestation entry in Unraid's UI — task-025.md:211.
- A larger guide body — task-022.md:410.
- task-024 V5 silent/black runs — task-024.md:336.
- CPU figures are single windows — task-028.md:74.
- Chrome exits on marlinpc — recon-stable-ids.md:336; also
  recon-stable-ids.md:52, MARLIN-CAST-BRIEF.md (HARD-WON FACTS, "died twice").

**Dated 2026-09-26. Owner-ruled.**

**Note (2026-09-28, owner-ruled):** ffmpeg exit 255 at idle stop ("File ended
prematurely", then `exited code=255`) was re-seen on Unraid on 2026-09-28, on
three consecutive WBAL 11 tunes. It stays closed: Marlin Cast serves live only
(D006).

---

## D031 — Remaining report items closed

Remaining report items closed. Not pursued; reopen if seen.

Items closed (reports are in `notebook/reports/`):
- task-005-basic-scheme.md:11 — the report points at a "step 10" section it
  does not contain.
- task-005-basic-scheme.md:58 — the `scripts/start-chrome.sh` comment rewrite,
  flagged for the owner's acknowledgement.
- recon-stable-ids.md:210 — the 18-digit correction to Philo's `channelId`,
  not applied to task-021 or recon-philo.
- task-001-kickoff.md:388 — `typescript` pinned to `^5.9.3`, a judgment call
  for the owner.
- task-001-kickoff.md:395 — `.gitignore` anchored as `/data/`, a deliberate
  deviation for the owner.
- task-001b-profile-persistence.md:251 — BRIEF-v1, DECISIONS and KNOWN-FIXES
  added outside 001b's scope, awaiting the owner's OK.
- task-021.md:607 — enumeration uses `numSparseGroups: 0`; not checked that
  it always agrees with the guide's own query.
- recon-philo.md:279 — whether other Philo channels carry 1080p.
- recon-philo.md:282 — the quality menu's mapping to rungs.
- recon-philo.md:295 — the requested Widevine robustness string.
- recon-philo.md:303 — `chrome://media-internals` not read for Philo.
- recon-philo.md:321 — occlusion by another window not staged on Philo.
- recon-philo.md:337 — teardown via the in-player SPA route not exercised.
- recon-philo.md:359 — guide hover previews not tested.
- recon-philo.md:446 — the robustness level, evidence by absence.
- recon-philo.md:453 — the autoplay finding's generality beyond a created tab.
- recon-philo.md:457 — occlusion (least sure of).
- task-025.md:56 — `workflow_dispatch` from a ref other than `main` enables
  no tag and fails at the build step.

**Dated 2026-09-26. Owner-ruled.**

---

## D032 — Chrome memory recon closed

Chrome memory recon (notebook/reports/recon-chrome-memory.md) stopped at 12 of
20 cycles and recorded as it stands. The cycle-13 WBAL 11 tune stall (player
ready not satisfied within 30000ms, readyState 1) is not pursued; reopen if
seen on Unraid.

**Dated 2026-09-28. Owner-ruled.**

---

## D033 — Chrome memory: forced collection on the offscreen document

Marlin Cast forces a garbage collection on the capture extension's offscreen
document over CDP (HeapProfiler.collectGarbage) every 60 s during a capture
and once at stop. Reason: the browser process kept each tune's recorded chunks
until the offscreen document's collector ran, about 27–30 MB per tune
(recon-chrome-memory.md); one forced collection released 88% of the growth
(task-031). Built in task-031, 13071d7.

**Dated 2026-09-28. Owner-ruled.**

---

## D034 — QNAP: WBAL 11 started hours behind live, not pursued

Owner-observed on the QNAP, reported 2026-09-28: WBAL 11 tuned from Channels
DVR's live guide on Apple TV showed the local news at about 6:03 am when it
was about noon, roughly 6 hours behind live. WBAL 11 had been watched that
morning; what was watched in between is not known. Not pursued; reopen if seen
again.

**Dated 2026-09-28. Owner-ruled.**

---

## D035 — Station ids on every playlist line, from a table in the repo

Every playlist line carries tvc-guide-stationid from a table in the repo
(`src/stations.json`), built on 2026-09-29 from the owner's Schedules Direct
lineups USA-YTBE512-X and USA-PHILO-X and keyed on the D020 key. Channels with
no credible station carry no tag. Amends D015: the source is Schedules Direct,
not PrismCast's /playlist. Reason: Marlin DVR 1.12.0 joins its Schedules
Direct guide by this tag (Marlin DVR decision 4a); by name only 69 of 367
joined.

**Dated 2026-09-29. Owner-ruled.**

**Note (2026-09-29, owner-ruled):** eight Philo channels named only in
USA-YTBE512-X take that lineup's ids; CNBC → 58780; MPT (both) and Cheddar
News stay untagged (task-033).

---

## D036 — Session items closed; acceptance

Owner-confirmed 2026-09-29: the Unraid container was force-updated to latest =
sha-0f042a9 (task-033); in Marlin DVR the guide is present and channels play;
docker stats read 869.8 MiB after one tune.

Owner's calls, closed, not pursued, reopen if seen:
- the D033 memory fix on hours-long tunes and on Philo;
- the name-only station pairs (task-032, task-033);
- the untagged channels;
- the backup's one-off YouTube TV sign-out (task-033);
- VERSION staying 0.1.2;
- recon-chrome-memory.md's not-determined items;
- the 'least sure of' items in recon-chrome-memory.md and task-030 to task-033;
- successful-collection logging;
- the station table not warning on channels a provider adds later;
- no backpressure on ffmpeg writes;
- Marlin DVR's 346 against 401 stations for USA-YTBE512-X;
- the post-collection point taken at 24 s, not 10 s.

The QNAP stays pinned to sha-c876a3a (owner's choice). The Unraid memory
recheck is closed on the 869.8 MiB reading; reopen if it climbs past 2 GiB.

The Schedules Direct username occurring in the repo is left as it is (owner's
call; history is not rewritten).

Marlin DVR reads Marlin Cast directly through two sources, /playlist/youtube-tv
and /playlist/philo, and takes its guide from Schedules Direct joined by
tvc-guide-stationid (D035). This updates D026's 2026-09-13 note that the editor
used the single /playlist source. Owner, 2026-09-29.

Items closed (reports are in `notebook/reports/`; line numbers are at commit
8511fb4; "also" marks the same item recorded in a second place):
- The D033 memory fix on hours-long tunes — recon-chrome-memory.md:676;
  task-031.md:695; also SESSION-STATE.md:1455.
- The D033 memory fix on Philo — task-031.md:699; also SESSION-STATE.md:1456.
- The name-only station pairs — task-032.md:658, 661, 666, 669;
  task-033.md:372, 378, 381; also SESSION-STATE.md:1530, 1596.
- The untagged channels — the lists at task-032.md:424–447 and
  task-033.md:331–345; MPT — task-032.md:638; Cheddar News — task-032.md:642;
  the Philo channels with no station — task-032.md:644, task-033.md:357; also
  DECISIONS.md:735 (D035 note), SESSION-STATE.md:1525, 1592.
- The backup's one-off YouTube TV sign-out — task-033.md:124, 351, 383; also
  SESSION-STATE.md:1555, 1590.
- `VERSION` staying 0.1.2 — task-031.md:667; task-032.md:651;
  task-033.md:360; also SESSION-STATE.md:1449, 1527, 1593.
- recon-chrome-memory.md's not-determined items —
  recon-chrome-memory.md:673 (what the browser process holds per tune and
  what decides its release; the cause was proven afterwards by task-031,
  D033), 676 (whether the growth has a ceiling), 680 (the unmapped renderer;
  also :322), 681 (the omnibox renderer's `documents` counter; also :478).
- The 'least sure of' items — recon-chrome-memory.md:685, 688, 691, 694,
  696; task-030.md:250, 254, 258, 261; task-031.md:684, 687, 689, 692, 695,
  697, 699, 701; task-032.md:658, 661, 666, 669, 672, 677, 680;
  task-033.md:372, 378, 381, 383, 386, 389.
- Unraid and the QNAP not running the latest change until updated —
  task-031.md:676; task-032.md:652; task-033.md:361; also
  SESSION-STATE.md:1451, 1527, 1593 (answered above: Unraid runs sha-0f042a9;
  the QNAP stays pinned).
- The Unraid memory recheck — no file records it as owed under that name; the
  nearest items are "that marlinpc predicts Unraid",
  recon-chrome-memory.md:696 and task-031.md:701 (answered above: 869.8 MiB
  after one tune).
- Successful-collection logging — task-031.md:679; also SESSION-STATE.md:1452.
- The station table not warning on channels a provider adds later —
  task-032.md:648; task-033.md:359; also SESSION-STATE.md:1526, 1593.
- No backpressure on ffmpeg writes — task-030.md:61, 243.
- Marlin DVR's 346 against 401 stations for USA-YTBE512-X — task-032.md:151.
- The post-collection point taken at 24 s, not 10 s — task-031.md:172.

**Dated 2026-09-29. Owner-ruled.**

---

## D037 — Cold-start brief location

The cold-start brief is notebook/COLD-START.md, moved from the repo root's
MARLIN-CAST-BRIEF.md with its history kept (git mv). Earlier notebook entries
that name MARLIN-CAST-BRIEF.md refer to this file.

**Dated 2026-09-29. Owner-ruled.**

## D038 — Idle park: YouTube TV on Library; the Philo tab goes behind

The YouTube TV guide (`tv.youtube.com/live`, the task-018 park) plays the
live thumbnails of every channel row on screen — seven muted 426×240 streams
— for as long as that tab is the visible one: 1.6–2.4 Mbit/s (≈0.75 GB/hour)
and 37–40% of one core, measured idle on 2026-10-07
(notebook/reports/recon-idle.md). The home page `tv.youtube.com/` does the
same with six. Philo's parked guide downloads nothing but keeps its renderer
at about a fifth of a core while visible; both pages are silent when another
tab is in front.

Ruled, owner's choice 1(a) of the options offered:

1. An idle stop parks the YouTube TV tab on `https://tv.youtube.com/library`
   (a signed-in page with no video: 0 kbit/s, under 1% CPU; the next tune
   from it measured 1.82 s to playing against 1.74 s from the guide). The
   guide stays the enumeration page.
2. After parking the Philo tab on its guide, the pipeline brings the YouTube
   TV tab to the front (`Provider.parkHidden`), so the Philo page idles
   hidden. Nothing is navigated for that; a failure is logged, never thrown.
3. `about:blank` is not a park page: D018 selects the tab by URL host and a
   blank tab has none (measured: every tune failed loud).

The owner's acceptance conditions: several Philo tunes in a row from the
hidden state with their times and failures reported, and the first tune after
an overnight idle on Library confirmed not to land on a sign-in page. The
recon is recorded as `notebook/reports/recon-idle.md` (owner's choice 2(a)).
Nothing is restarted or redeployed on Unraid without telling the owner first.

**Dated 2026-10-07. Owner-ruled.**

## D039 — A switch to the other provider parks the tab being left

Stopping a live channel to tune the other provider left the old tab on its
watch or broadcast page, playing hidden at about 4.2 Mbit/s until that
provider was tuned again (recon-idle B and C, 2026-10-07, both directions;
pre-existing since task-018 gated the park on the idle path). The switch
now parks the previous provider's tab exactly as an idle stop would (for
Philo, it also goes behind, D038). A switch within one provider still
navigates the same tab straight on. Own commit, so it can be backed out
alone. Verified on a test container in both directions: the left tab read
its park page, hidden, 0 kbit/s.

**Dated 2026-10-07. Owner-ruled (owner's choice 1(a)).**

## D040 — Both tabs are parked at server start, only when confirmed signed in

The login check leaves the YouTube TV tab on its home page and a fresh
enumeration leaves it on the guide; both play live previews while visible,
so a restarted container idled loud until the first YouTube TV tune. At
server start the pipeline reads each tab's sign-in state off the page it is
on now, with no navigation (`Provider.signedInHere`): YouTube TV = a
tv.youtube.com page that is not `/welcome` and shows no "SIGN IN"; Philo = a
`/player/` path. A tab confirmed signed in is parked on its park page, and
the YouTube TV tab is brought to the front. **A tab that is not signed in is
never navigated** — the owner may be signing in through the viewer — and a
missing tab is logged, not fatal (the entrypoint already checked). Own
commit. Verified on a test container on both boot paths (fresh enumeration;
restart with the channel cache present): both tabs parked, YouTube TV in
front on `/library`, nothing playing.

**Dated 2026-10-07. Owner-ruled (owner's choice 2(a)).**

**Note (2026-10-07, owner-ruled):** the bring-forward half of D038 stays.
The owner's condition was a side-by-side of Philo tunes from a hidden start
against a visible start (recon-idle E: 20 each, alternating, same five
channels). Hidden: 11 cleared the overlay on the first sweep, 2 on sweeps
2–3, 7 stuck, median 5.0 s to playing. Visible: 14 / 1 / 5, median 3.5 s.
The owner keeps the bring-forward and asked for no larger test. The stuck
overlay is recorded as its own open item in `notebook/OPEN-ITEMS.md`.

**Note (2026-10-07, owner-ruled):** `VERSION` is 0.1.3 for the D038–D040
release, its own commit. This amends D036's "`VERSION` stays 0.1.2". Not
pushed; the push waits for the overnight check and the owner's "push it".
At the push, the D025 release procedure is followed in full (owner's choice
(a), 2026-10-07): push `main` (publishes `latest` and `sha-<short>`), then
tag `v0.1.3` on that commit and push the tag (publishes the immutable image
tag `0.1.3`).

**Note (2026-10-08):** pushed on the owner's "push it" after the overnight
check passed — main `bd0f90f`, tag `v0.1.3`; GHCR `latest` = `sha-bd0f90f`
and `0.1.3`. The owner force-updated Unraid to it the same morning and
reports, before any tune: parked on YouTube TV Library, CPU 0.5%, network
flat (D038's aim met on Unraid). Open, owner-observed: at 09:41 EDT the
viewer showed Philo's guide in front after the owner clicked the Philo tab
at 09:26; cause not known, logs requested (`notebook/OPEN-ITEMS.md`). No
answers were pending from the owner at this session's wrap other than those
logs.

**Note (2026-10-08, owner):** the Philo-in-front observation is closed with
no code change: a click on the Philo tab in the viewer, not the app (readings
in `notebook/OPEN-ITEMS.md`, Closed). Settled afterwards at 0.5% CPU, 806 MB,
network flat. A low-priority idea is kept in the open items: every idle stop
could bring YouTube TV forward.

**Note (2026-10-08, owner):** Marlin DVR uses only `/playlist/youtube-tv`;
Philo is never tuned in normal use. This updates D036's consumer statement
(two sources, `/playlist/youtube-tv` and `/playlist/philo`). Both playlists
are still served.


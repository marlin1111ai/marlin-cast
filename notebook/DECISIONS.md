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

**Dated 2026-09-13.**

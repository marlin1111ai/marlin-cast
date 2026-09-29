# MARLIN CAST — COLD-START BRIEF (v5, 2026-09-26)

Supersedes v4 (2026-09-13). This file lives at the repo root as `MARLIN-CAST-BRIEF.md`.

## FOREMAN: READ BEFORE WRITING ANY PROMPT

Read in full: the FOREMAN INSTRUCTIONS (v6.2) the owner pastes at the top of the chat, this brief, `notebook/DECISIONS.md`, `notebook/KNOWN-FIXES.md`, `notebook/SESSION-STATE.md`, and the most recent reports in `notebook/reports/` (task-024 through task-028, recon-docker, recon-stable-ids, recon-philo at minimum). First reply in every chat is a CONTEXT CHECK. Nothing settled below gets re-asked or re-derived.

## WHERE THE PROJECT STANDS

**Deployed and in use (D026).** Marlin Cast runs as Unraid container `marlin-cast` from `ghcr.io/marlin1111ai/marlin-cast:latest` with no size env (1080p, D028); deployed 2026-09-13 at `VERSION` 0.1.1. Unraid runs `sha-13071d7` since the 2026-09-28 force-update (D026 note). GHCR now: `latest` = `sha-0f042a9` (task-033, D035 note; same digest; `VERSION` 0.1.2); `sha-1d307b1` (task-032, D035) remains in GHCR; `sha-13071d7` carries the D033 memory fix and is what Unraid runs since the owner's force-update on 2026-09-28 (D026 note); `sha-c876a3a` remains in GHCR, and the QNAP is still pinned to it; rollback `sha-e28689d`; no `X.Y.Z` tag exists (no git tag has been pushed, D025). It serves two providers — YouTube TV (141 channels at last enumeration) and Philo (226) — as one M3U at `http://192.168.1.250:8091/playlist`, tunes one channel at a time in a Chrome that runs inside the container, tab-captures it, and serves fMP4 HLS. Owner-confirmed playing on Apple TV through Marlin DVR via Marlin IPTV Editor. marlinpc is dev-only from here (D012 fulfilled).

**Consumer:** Marlin IPTV Editor, one source at `/playlist` (the owner chose one URL; the editor separates by `group-title`). `/playlist/youtube-tv` and `/playlist/philo` exist (D021) but are not in use. Guide data: the editor's Schedules Direct source, matched by name. PrismCast stays as the Channels DVR source; the Channels DVR playback defect remains parked (D016).

**Parked, do not reopen unless the owner asks:**
- Channels DVR remuxer stall (D016; tasks 009–019).
- Verizon Fios TV as a provider: tv.verizon.com freezes on its splash in this Chrome on marlinpc, in a fresh profile too, with and without `--ignore-gpu-blocklist`. Server, network, login redirect ruled out. Report: `notebook/reports/fios-splash.md`. No recon-fios report exists (the recon stopped before step 2).
- Stale-watch-id detection (note under D020): an expired YouTube TV watch id can still play; the only observed case was an event feed, now excluded (D023).

## DECISIONS (full wording in notebook/DECISIONS.md — quote from there, never from memory)

D001 name/repo · D002 YouTube TV first (its one-provider clause spent by D017) · D003 Node 22 + TypeScript + Playwright + ffmpeg · D005 one tune at a time (two logins in one profile is the normal state, per D017) · D006 M3U + HLS out, no XMLTV from Marlin Cast · D007 dev on marlinpc · D008 dev server 0.0.0.0:8804, Unraid host port 8091 · D009 attach to a launched Chrome over CDP, never own the profile (in the container the entrypoint launches it) · D010 `--password-store=basic` everywhere · D011 capture via purpose-built extension + `chrome.tabCapture` · D012 deployment target Docker on Unraid — fulfilled · D013 full unfiltered lineup, with notes: no-stream guide rows (browse links) and event feeds are not channels · D014 GPU decode test deferred to Unraid — closed by D029 (not pursued); the container runs CPU decode/encode · D015 station-id sliver — moot for the editor (it never reads `tvc-guide-stationid`); one line remains, keyed to ESPN row 17's stationId · D016 Marlin DVR via the editor is the consumer; Channels defect parked.

**D017** Philo is the second provider; 1280×720 @ 30 fps under Widevine L3 accepted, upscaled into the 1920×1080 capture.
**D018** One tab per provider, selected by URL host; no fallback; missing tab = loud fatal.
**D019** Philo lineup: all tiers, unfiltered, `group-title="Philo"`.
**D020** Stream URL identity = YouTube TV `stationId` / Philo `channelId`; the provider's watch/broadcast id is resolved at tune time and never appears in a URL.
**D021** `/playlist/youtube-tv` and `/playlist/philo` alongside `/playlist`.
**D022** Superseded by D023.
**D023** YouTube TV rows marked `isDiscreteStation:true` (event feeds) are excluded — their keys and watch ids rotated within 20 minutes.
**D024** Container: listens on 8804, host publishes 8091→8804; base ubuntu:24.04, Node 22 (NodeSource), ffmpeg 6.1.1 from apt, Chrome pinned 153.0.8010.36-1, Xvfb 1920×1080, noVNC viewer on 6080 (host 8092) with `VNC_PASSWORD` required, PUID/PGID default 99/100, profile volume `/data/chrome-profile`, first boot enumerates if the cache is missing, `--cap-add SYS_ADMIN --shm-size=1g` required (`--no-sandbox` rejected).
**D025** Image `ghcr.io/marlin1111ai/marlin-cast`, built by GitHub Actions on push to main (`latest`, `sha-<short>`) and on tag `vX.Y.Z` (must equal VERSION).
**D026** Deployed — the Unraid container fields, the profile source, and the acceptance result are recorded there.
**D027** The repo is public; the no-credentials rule is unchanged.
**D028** Per-container capture size via the existing env knobs; YouTube TV's quality target follows `MC_HEIGHT` (1080 → hd1080, 720 → hd720). Unset = unchanged; the Unraid container sets none. Amends D024 item 7 and the hd1080 pin.
**D029** Open items closed, not pursued, reopen if seen: the 20 s idle timeout number, `isDiscreteStation:true` on a regular channel, a stationId across a regular channel's rotation, a Philo capture at a programme boundary, the Philo overlay sweep over many tunes, A/V drift on long captures, the D014 GPU decode test. Philo's 720p warning text is left as is.
**D030** Every item left for the owner's call in task-029 (the brief's KNOWN OPEN QUESTIONS at e929699) is closed, not pursued, reopen if seen, each listed with file:line in D030; `notebook/OPEN-ITEMS.md` is settled. Recorded answers: Unraid's build is not known; Philo History played at normal speed on the QNAP at 720p.
**D031** The remaining report items (the D030 pass's "doesn't reach" list) are closed, not pursued, reopen if seen, each listed with file:line in D031.

## HARD-WON FACTS (all measured)

YouTube TV:
- Plays under CDP attach at 1920×1080, Widevine L3. `setPlaybackQualityRange("hd1080","hd1080")` is required (hd720 when `MC_HEIGHT=720`, D028); window size is not a knob; some channels (ESPN) top out at hd720.
- YouTube TV only: use `#movie_player video.html5-main-video` — the page has ~40 video elements. Parking on the guide leaves a paused 0×0 `#movie_player`.
- The guide is one `/youtubei/v1/browse` response (151 rows on 2026-09-12); per row `epgRowRenderer.stationId` (a `UC…` id) is the durable channel key, distinct on every streaming row. The tile image is the current programme's thumbnail, not a logo. Names repeat (several "ESPN"). Six rows link to a brand/browse page and carry no stream.
- Watch ids: 142 regular channels held their key and watch id across a 20-minute re-enumeration and overnight; only event feeds rotated. Nothing has been observed rotating on a regular channel.
- An expired watch id still plays (a static logo card), so tune poll 1 cannot detect it.
- Before/after playlist checks must ignore `tvg-logo` (programme thumbnails drift between enumerations).

Philo:
- Signed-in landing is any `/player/` path; guide is a virtualized tile grid fed by a paginated GraphQL `page` query (`groups.summary.totalCount` = 226). `channelId` (base64 `Channel:<18 digits>`) is a durable channel key; broadcasts carry their own id.
- Player: one `video#video`, 1280×720 @ 30 fps max, Widevine L3 software decode, Shaka player, proprietary JSON manifest. No quality API; UI menu only.
- Direct navigation to `/player/player/broadcast/<id>` starts at the beginning of the DVR window (~2 h behind); the app seeks past the end to reach live.
- Unmuted play in a CDP-created tab is blocked until one real `Input.dispatchMouseEvent`; that click shows a control overlay that only hides on mousemove, so the app sweeps the pointer until it clears (1–3 sweeps observed; fails loud, not silent).
- Idle guide: no autoplay after 60 s. Occluded keeps playing; minimized stops presenting after ~10 s.
- A capture still running when a programme ends is untested — closed by D029 (2026-09-26), not pursued.
- Known, not fixed (D029): in 720p mode (D028) Philo's tune warning reads "upscaled into the 1280x720 frame" though nothing is upscaled.

Container / Docker:
- Chrome's sandbox needs `--cap-add SYS_ADMIN`; default 64 MB `/dev/shm` is a known crash cause, so `--shm-size=1g`.
- Tab capture works under stock (non-GPU) Xvfb: 1920×1080 H.264 High + AAC 48 kHz stereo, audio present with no output device.
- A profile owned by uid 1000 works after the entrypoint's re-own to PUID/PGID; Singleton* leftovers are removed on start.
- sed block-buffers when stdout is a pipe, which hid app lines until stop; the entrypoint uses `sed -u`.
- Unraid downloads the container icon at Apply time; an icon served by the container itself fails while it restarts — the icon is served from the public repo.
- `docker stop` completes in ~1.2 s with nothing left behind.
- Size/rate env knobs and defaults: `MC_WIDTH` 1920, `MC_HEIGHT` 1080, `MC_FPS` 30 (`src/capture.ts`), `MC_XVFB_SCREEN` `1920x1080x24` (`docker/entrypoint.sh`).

Carried from earlier sessions:
- `--load-extension` is inert on Chrome 153; the extension loads over CDP via `Extensions.loadUnpacked`.
- Profiles copy safely; a cookie-encryption scheme mismatch (v11 keyring vs v10 basic) destroys a session; no v11→v10 migration exists. Sessions survive graceful Chrome restarts and closing the window with the X.
- `chrome://gpu` reports policy, not silicon — verify decode with media-internals.
- On marlinpc the xrdp display exists only while Jump Desktop is connected; closing the Terminus window that launched Chrome kills Chrome.
- Marlin Cast's own HLS output (fMP4, 1 s segments, `repeat-headers=1`, no PROGRAM-DATE-TIME) and the PrismCast comparison facts from tasks 012–019 are unchanged; PrismCast itself serves variable-length fMP4, Constrained Baseline L4.2, with PROGRAM-DATE-TIME.
- Restarting the dev server from the builder: use the tool's background mode, never `&`; `pkill -f 'src/server.ts'` can match an unrelated shell.
- Chrome on marlinpc died twice on 2026-09-12 while a ~51 GB Python process was running; cause not proven — closed by D030 (2026-09-26), not pursued.

## ENVIRONMENT

- **Production:** Unraid 192.168.1.250, container `marlin-cast` (fields in D026). Status page `http://192.168.1.250:8091/` lists all four URLs. Viewer `http://192.168.1.250:8092/` (password). Profile volume `/mnt/user/appdata/marlin-cast/data`. Re-login path: the viewer.
- **Second install — the owner's father's QNAP TVS-EC1080** (Xeon E3-1245 v3, 4C/8T, 32 GB, QTS 5.2.10), at 192.168.1.30 on *that house's* network (on this network that address is a different device — never connect). Container Station compose application: `ghcr.io/marlin1111ai/marlin-cast:sha-c876a3a` (pinned); ports 8091→8804, 8092→6080; volume `/share/Container/marlin-cast/data` → `/data`; env `VNC_PASSWORD`, `PUID` 99, `PGID` 100, `MC_WIDTH` 1280, `MC_HEIGHT` 720 (no `MC_XVFB_SCREEN`); `cap_add: SYS_ADMIN`; `shm_size: 1gb` — honoured, `/dev/shm` in the container reads 1.0G (owner-run `df -h`, 2026-09-26); no `/dev/dri`. Container Station would not let the owner edit the application's YAML, so the owner deleted the application and created it again with the new text; `/share/Container/marlin-cast/data` survived — channel list and sign-ins carried over, no re-login. The owner signed in to both providers through the viewer. First enumeration 2026-09-26 19:04 UTC: 377 channels (YouTube TV 143, Philo 234). At 1080p Channels DVR there played a Marlin Cast stream on Apple TV in slow motion at 97% CPU (1080p YouTube TV, WBAL 11: chrome 76.1% combined, largest single 58.67%; ffmpeg 17.72%; channels-dvr 0.7%) — D028.
  - 720p (D028 note, 2026-09-26): total CPU 33.04% on WBAL 11 (owner: normal speed), 32.08% on Philo History (owner: normal speed), against 97.4% at 1080p.
- **Dev:** marlinpc (Pop!_OS 24.04), repo `/Apps/marlin-cast`, remote `git@github.com:marlin1111ai/marlin-cast.git` over SSH (never HTTPS). main fully pushed (verify with git fetch). Docker 29.1.3 present; the owner's user is in the docker group.
- Dev Chrome: owner-launched via `scripts/start-chrome.sh` (opens both provider tabs), loopback debug port 9333. Dev server `npm run serve` on 0.0.0.0:8804; it exits with ECONNREFUSED if Chrome is not up. `npm run channels` re-enumerates both providers.
- Read-only reference tree: `/Apps/marlin-iptv-editor`.
- Profiles on marlinpc: `data/chrome-profile` (live, both providers) · `backups/chrome-profile-2providers-20260913-0746.tgz` (deployed copy) · `backups/chrome-profile-basic-20260911-110129/` (YouTube TV only) · v11 profiles (machine-bound, not usable in Docker).
- Owner logs in by hand: on marlinpc over Jump Desktop (display `:10`), or in production through the viewer. The app never types credentials and never navigates to a login page.

## STANDING PROHIBITIONS — every prompt carries these

- The builder never connects to the Unraid host at 192.168.1.250 — no ssh, docker, container inspection, logs, nothing on any port. The owner operates the production container.
- Never touch any container on it: `marlin-cast`, `prismcast`, `channelsdvr_intel`, `fastchannels`, `marlin-iptv-editor`, `marlin-cad`.
- `/Apps/marlin-iptv-editor` is never written to.
- Never restart, attach to, navigate, or close the owner's live Chrome tabs except through the app's own tune/enumerate paths, and never without saying so first. Never open any login/accounts page.
- `backups/` and `data/chrome-profile-v11-*` are read-only.
- No host installers: apt, snap, flatpak, brew. Docker image pulls and builds are permitted on marlinpc.
- No credentials, cookies, tokens, session IDs, emails, avatars, or account identifiers in the repo, image, logs, reports, screenshots, or commits. `VNC_PASSWORD` only via env at run time.
- Never force-push or rewrite history. Pushes verified by `git fetch` + SHA comparison.

## NOT YET BUILT

Hardware (VAAPI) encoding (closed by D030, not pursued) · D014 GPU decode test on Unraid (closed by D029, not pursued) · concurrency beyond one stream · Fios (parked) · any UI beyond the status page, `/playlist*`, the stream endpoint, `/health` and `/icon.png`. The owner wants no settings pages.

## KNOWN OPEN QUESTIONS

None. Closed 2026-09-26 by D029, D030 and D031 (not pursued; reopen if seen) — each item with its file:line is listed there.

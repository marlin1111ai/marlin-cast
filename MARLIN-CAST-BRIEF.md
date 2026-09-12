# MARLIN CAST — COLD-START BRIEF (v3, 2026-09-11 late evening)

Supersedes v2 (which was never committed; its founding content is restated here) and v1 (`notebook/BRIEF-v1.md`). This file lives at the repo root as `MARLIN-CAST-BRIEF.md`.

## FOREMAN: READ BEFORE WRITING ANY PROMPT

Read in full: the FOREMAN INSTRUCTIONS (v5) the owner pastes at the top of the chat, this brief, `notebook/DECISIONS.md`, `notebook/KNOWN-FIXES.md`, `notebook/SESSION-STATE.md`, and the most recent reports in `notebook/reports/` (task-013, task-015, task-019 at minimum; task-020 has no report — its record is the Task 020 section of SESSION-STATE.md). First reply in every chat is a CONTEXT CHECK. Nothing settled below gets re-asked or re-derived.

## WHERE THE PROJECT STANDS

Marlin Cast works end to end on marlinpc and is in use. It enumerates the YouTube TV lineup, serves an M3U at `/playlist`, tunes a channel in a logged-in Chrome, tab-captures it, and serves fMP4 HLS. Cold tune ≈ 4.2 s.

**Consumer (D016):** Marlin DVR, via Marlin IPTV Editor (the editor supplies playlist + guide), confirmed playing on Apple TV. PrismCast stays as the Channels DVR source.

**Parked defect (D016):** Channels DVR cannot play it. Its remuxer probes the stream fine, starts a session in ~1.1 s, emits exactly one output segment (`first_seq=1 last_seq=1`) and never a second, however long it runs; the player then shows "The media could not be loaded…". Tasks 009–019 changed and ruled out, one at a time: CORS headers, tune latency, container (TS→fMP4), PROGRAM-DATE-TIME format, PROGRAM-DATE-TIME presence, in-band SPS/PPS, guide data. Untested remaining differences from PrismCast: 1 s segments / `TARGETDURATION:1`; `MEDIA-SEQUENCE` restarting at 0 with no `EXT-X-DISCONTINUITY`. Do not reopen this unless the owner asks.

**Current build (task-019):** fMP4/CMAF segments, H.264 High L4.0 + AAC-LC, 1 s segments, 1 s GOP (`-g 30 -keyint_min 30 -sc_threshold 0`), zerolatency, `repeat-headers=1` (SPS/PPS before every IDR), no PROGRAM-DATE-TIME, 10-segment window, 20 s idle stop that kills the encoder and parks the capture tab on `https://tv.youtube.com/live`. The task-014 serve-time date-time rewrite in `src/server.ts` is still present and is now a no-op. `tvc-guide-stationid="32645"` is hardcoded on the one ESPN entry (`MrXg0chrojg`) only.

## DECISIONS (full wording in notebook/DECISIONS.md — quote from there, never from memory)

D001 name/repo · D002 YouTube TV first · D003 Node 22 + TypeScript + Playwright + ffmpeg · D005 one session, one channel at a time · D006 M3U + HLS out, no XMLTV from Marlin Cast · D007 dev on marlinpc, not the Mac (supersedes D004) · D008 dev server 0.0.0.0:8804, Unraid container port 8091 · D009 attach to owner-launched Chrome over CDP, never own the profile · D010 `--password-store=basic` everywhere · D011 capture via purpose-built extension + `chrome.tabCapture` · D012 deployment target Docker on Unraid, marlinpc is dev only · D013 playlist carries the full unfiltered lineup · D014 GPU decode deferred to first run on Unraid.

**D015** — station-ID guide matching: name→ID pairs from PrismCast's `/playlist` (read-only GET), hand mapping as fallback. Only the ESPN test sliver is built (task-017). Full mapping for 144 channels and the four duplicate "ESPN"-named feeds is unbuilt.

**D016** — Marlin DVR via Marlin IPTV Editor is the consumer; PrismCast stays on Channels; Channels defect parked (see above).

## HARD-WON FACTS (all measured)

Carried from earlier sessions:
- YouTube TV plays under CDP attach at 1920×1080, Widevine L3. `setPlaybackQualityRange("hd1080","hd1080")` is required; window size is not a knob; some channels (ESPN) have no 1080p rendition.
- Use `#movie_player video.html5-main-video` — the page has ~40 video elements.
- `--load-extension` is inert on Chrome 153; the extension loads over CDP via `Extensions.loadUnpacked`.
- Profiles copy safely; what destroys a session is a cookie-encryption scheme mismatch (v11 keyring vs v10 basic). No v11→v10 migration exists. Sessions survive graceful Chrome restarts.
- `chrome://gpu` reports policy, not silicon — verify decode with media-internals.
- The xrdp display (~2468×1380 @ 50 Hz) exists only while Jump Desktop is connected; don't benchmark on it. Tab capture works occluded; minimized goes black. Capture resolution follows the display — constrain via maxWidth/maxHeight.

New this session (tasks 012–019):
- PrismCast serves fMP4 (bare `moof` segments, no styp/sidx), H.264 Constrained Baseline L4.2, SPS/PPS in-band per keyframe, variable 0.9–4.9 s segments, `TARGETDURATION` 2–5, cold playlist starts at `MEDIA-SEQUENCE:15` with `EXT-X-DISCONTINUITY`, PROGRAM-DATE-TIME in UTC `Z` form before `EXTINF`. It sends no CORS headers.
- ffmpeg's hls muxer writes PROGRAM-DATE-TIME as local time with `%z` (`-0400`) after `EXTINF`; Go's RFC 3339 parser rejects that form. There is no muxer option for UTC or position — only a serve-time rewrite.
- Channels' `[M3U] stream timestamps start_at=end_at live_delay=3s` line came from a pre-fetch of our media playlist reading equal first/last PROGRAM-DATE-TIME values on a one-segment cold playlist; it vanished when the tag was removed. It was not the cause of the stall.
- A local stock ffmpeg stream-copy segmenter (`-c copy -f hls -hls_time 2`) cuts our stream into 16–17 segments per 30 s, same as PrismCast's. The Channels stall is not reproducible outside Channels.
- ffmpeg cuts on the IDR NAL, not the trun sync flag. ffmpeg's mpegts muxer auto-injects SPS/PPS at keyframes; the mp4 path does not.
- libx264 keeps SPS/PPS in avcC only unless `-x264-params repeat-headers=1`.
- Live pulls of our HLS log "Found duplicated MOOV Atom. Skipped it" once per playlist reload (EXT-X-MAP re-read); harmless to ffmpeg and hls.js.
- The mp4 muxer logs "Packet duration: -192 … out of range" on audio at ~1 in 15 segment boundaries; no measured effect.
- Parking the tab on the YouTube TV guide leaves a paused 0×0 `#movie_player`; re-tune from the guide is same-origin and costs nothing (nav 644 ms). Long-dwell auto-preview behaviour is unverified.
- Restarting the dev server from the builder: background launches via `&` die when the shell call returns; use the tool's background mode.

## ENVIRONMENT

- Builder: Claude Code on marlinpc (Pop!_OS 24.04). Repo `/Apps/marlin-cast`, remote `git@github.com:marlin1111ai/marlin-cast.git` over SSH (never switch to HTTPS). main is fully pushed as of task-020 (a7edccb).
- Read-only reference tree: `/Apps/marlin-iptv-editor`.
- Owner logs in by hand over Jump Desktop on display `:10`. The app never types credentials and never navigates to accounts.google.com.
- Chrome: owner-launched via `scripts/start-chrome.sh`, `--password-store=basic`, loopback debug port 9333. The app attaches; it launches nothing.
- Server: `npm run serve` on 0.0.0.0:8804; `npm run channels` refreshes the lineup; `pkill -f 'src/server.ts'` stops it. Playlist at `http://192.168.1.245:8804/playlist`.
- Channels DVR still has a MarlinCast custom source configured (HLS, stream limit 1, XMLTV empty); it is not the consumer.
- Profiles on disk: `data/chrome-profile` (v10, live) · `backups/chrome-profile-basic-20260911-110129/` (v10, container-portable) · `data/chrome-profile-v11-20260911-104559/` and `backups/chrome-profile-loggedin-20260911-101619/` (v11, machine-bound, NOT Docker fallbacks).

## STANDING PROHIBITIONS — every prompt carries these

- Never connect to the Unraid host at 192.168.1.250 — no ssh, docker, container inspection, logs, nothing on port 8089. Plain HTTP GETs to PrismCast on port 5589 are permitted for comparison only.
- Never touch any container on it: `prismcast`, `channelsdvr_intel`, `fastchannels`, `marlin-iptv-editor`, `marlin-cad`.
- `/Apps/marlin-iptv-editor` is never written to.
- Never restart or interfere with the live logged-in Chrome without saying so first.
- `backups/` and `data/chrome-profile-v11-*` are read-only.
- No installers: apt, snap, flatpak, brew. Installs are the owner's step.
- No credentials, cookies, tokens, session IDs or account identifiers in the repo, logs, reports or commits.
- Never force-push or rewrite history. Pushes verified by `git fetch` + SHA comparison.

## NOT YET BUILT

Dockerfile · Xvfb · GitHub Actions/GHCR pipeline · full D015 station-ID mapping · any UI beyond `/playlist`, the stream endpoint and `/health` · hardware encoding · concurrency beyond one stream. The owner wants no settings pages.

## KNOWN OPEN QUESTIONS

- Whether the 20 s idle timeout is the right number (no evidence behind it).
- Whether YouTube TV's guide page auto-starts a preview after a long idle.
- Whether tab capture survives a container with `/dev/dri` passed through (D014).
- Whether a volume-mounted profile with a different uid behaves like a copied one.
- A/V drift measured between −11.7 ms and −139.7 ms; nothing has run longer than ~2 minutes under measurement.

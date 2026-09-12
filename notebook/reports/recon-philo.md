# Recon — Philo as a second provider (read-only)

Date: 2026-09-12. Host: marlinpc. Read-only: no code, no dependency, no
install, dev server not running throughout (`ps` showed no `src/server.ts`
process), no capture, no extension load. Chrome pid 174888 (launched by the
owner via `scripts/start-chrome.sh` at the start of this session, port
9333 loopback) was never restarted. The owner's own tabs — `Home - YouTube
TV` (`https://tv.youtube.com/`) and a `Philo | Guide` tab the owner had
opened by hand before this recon began — were never attached to, navigated,
or closed. Everything below happened in ONE tab this recon created in its
own window and closed at the end (2g). Nothing on 192.168.1.250 was
contacted. All in-page reads are `Runtime.evaluate` over CDP; all clicks
in 2d are recorded as either script `el.click()` or real
`Input.dispatchMouseEvent`, because the difference turned out to matter.

Result of each step:

| Step | Result |
|---|---|
| 1 codebase inventory | done — every tracked file read (51 files); inventory below |
| 2a philo.com | **signed in** (landed on `/player/mytv`, no login/code page) — no stop |
| 2b `navigator.webdriver` | `false` |
| 2c guide / enumeration | observed: virtualized tile grid, channel list from a paginated GraphQL `page` query, 226 rows |
| 2d play one live channel | observed on AMC: 1 `<video>`, 1280×720, Widevine L3 via DRMtoday, Shaka player, quality menu Auto/Low/Medium/High; **autoplay blocked until a real input event** |
| 2e idle 60 s on guide | no autoplay, 0 `<video>`, no media traffic |
| 2f screenshots | `notebook/reports/recon-philo/` — 4 PNGs, avatar blacked out on the guide shot |
| 2g close | recon tab closed; owner's tabs unchanged (target ids identical before/after) |
| 3 sort + QUESTIONS | below |

---

## Step 1 — codebase inventory: everything that hardcodes or assumes YouTube TV

Every tracked file was read: `src/*.ts` (5), `extension/*` (4),
`scripts/*` (2), `package.json`, `.gitignore`, `MARLIN-CAST-BRIEF.md`, the
five notebook files and all 21 task reports. The notebook/report files are
documentation and are not listed as code hardcodes. `grep -n` over the
code for `tv.youtube.com|movie_player|setPlaybackQualityRange|MrXg0chrojg|/live|32645|ytu-|tenx-thumb|SIGN IN|html5-main-video|getAvailableQualityLevels|getPlaybackQuality`
returns exactly the lines cited below and nothing else.

### a. Signed-in detection / session state

| file:line | what it does now | as written |
|---|---|---|
| `src/login.ts:5` | `TARGET = "https://tv.youtube.com"` — the URL `npm run login` opens | provider-specific |
| `src/login.ts:46-47` | signed-out = `/SIGN IN/i.test(document.body.innerText)`; prints `tv.youtube.com: signed in / SIGNED OUT` | provider-specific string |
| `src/channels.ts:81-82` | after 0 channels, same `/SIGN IN/i` test decides the error message | provider-specific string |
| `src/capture.ts:211-212` | tune poll 1 aborts with `fatal: "SIGNED OUT"` on the same `/SIGN IN/i` test | provider-specific string, inside the tune path |

Nothing else tracks session state; there is no cookie/profile check in code.

### b. Lineup enumeration (`npm run channels`) and playlist generation

| file:line | what it does now | as written |
|---|---|---|
| `src/channels.ts:15-20` | `Channel = { id (YouTube video id from the guide href), name (aria-label), logo, href }` | shape is neutral; the `id`/`href` comments assume YT |
| `src/channels.ts:31` | `Page.navigate` to `https://tv.youtube.com/live` then a fixed 10 s sleep | provider-specific URL |
| `src/channels.ts:36-42` | waits for `ytu-endpoint.tenx-thumb[aria-label]` count to stop growing (assumes a non-virtualized grid) | provider-specific selector **and** assumption |
| `src/channels.ts:47-55` | name = aria-label minus `^watch `; id = `href.match(/watch\/([^?&#]+)/)`; dedupe by id | provider-specific |
| `src/channels.ts:57-74` | logo from first non-`data:` `<img src>` else `ytu-thumbnail[src]` JSON | provider-specific |
| `src/server.ts:92-113` | `/playlist` M3U writer: `tvg-id`, `tvg-name`, `tvg-logo`, `group-title="YouTube TV"` (line 100), URL `/stream/<id>/index.m3u8` | neutral except the literal group-title |
| `src/server.ts:107` | `tvc-guide-stationid="32645"` on `MrXg0chrojg` only | provider-specific (see f) |
| `scripts/capture-spike.mjs:177-189` | task-006 spike: same `/live` + `ytu-endpoint.tenx-thumb` lookup for one channel | provider-specific, legacy tool |

Cache (`data/channels.json`) and `loadChannels()` (`channels.ts:24-27`) are neutral.

### c. Tune: navigation to a channel and play start

| file:line | what it does now | as written |
|---|---|---|
| `src/capture.ts:204-205` | URL = `https://tv.youtube.com/` + `channel.href`; `Page.navigate` | provider-specific base URL |
| `src/capture.ts:211-217` | poll 1: `location.href` contains channel id **and** `#movie_player` exists | provider-specific selector |
| `src/capture.ts:222-231` | `Emulation.setDeviceMetricsOverride` 1920×1080 + poll 2 on `innerWidth/innerHeight` | neutral |
| `src/capture.ts:236-242` | poll 3: `#movie_player video.html5-main-video` with `videoWidth>0 && !paused && readyState>=2` | provider-specific selector; condition neutral |
| `src/capture.ts:364-380` | extension arming (`Target.activateTarget`, `Extensions.triggerAction`, `mcStart`) | neutral |
| — | **no user-input event is ever sent**; play is assumed to start on navigation | YT-specific assumption (see 2d: Philo blocks unmuted autoplay in a CDP-created tab) |
| `scripts/capture-spike.mjs:193-229` | legacy: navigate deep link, fixed sleeps, `button[aria-label^="Full screen"]` | provider-specific, legacy tool |

### d. Player video element selector and quality control

| file:line | what it does now | as written |
|---|---|---|
| `src/capture.ts:237, 259` | `#movie_player video.html5-main-video` (KNOWN-FIXES: YT page has ~40 `<video>`) | provider-specific |
| `src/capture.ts:258-281` | poll 4: `p.getAvailableQualityLevels()`, ladder `hd1080…tiny`, `p.setPlaybackQualityRange(t,t)`, `p.getPlaybackQuality()`, `videoHeight >= minH` | provider-specific JS API (YouTube player) |
| `src/capture.ts:282-285` | warns when not hd1080; `lastQuality` → `/health` | neutral reporting of a YT-specific value |
| `src/capture.ts:18-20, 366` | capture constraint 1920×1080@30 | neutral |
| `scripts/capture-spike.mjs:197-216` | legacy: same `#movie_player` + `setPlaybackQualityRange("hd1080","hd1080")` | provider-specific, legacy |

### e. Idle park URL and idle behaviour

| file:line | what it does now | as written |
|---|---|---|
| `src/capture.ts:24` | `IDLE_MS` 20 s watchdog | neutral |
| `src/capture.ts:25-27` | `GUIDE_URL = "https://tv.youtube.com/live"` | provider-specific |
| `src/capture.ts:171-176, 419-425` | on idle stop, `Page.navigate` to `GUIDE_URL` | neutral mechanism, YT URL |

### f. Station-ID sliver (D015)

| file:line | what it does now | as written |
|---|---|---|
| `src/server.ts:101-107` | `c.id === "MrXg0chrojg" ? tvc-guide-stationid="32645"` — one YT video id → one Gracenote id | provider-specific by construction (keyed on a YT id) |

### g. Anything else provider-specific

| file:line | what it does now | as written |
|---|---|---|
| `src/cdp.ts:75-82` | `findPageTarget`: prefers the page whose URL includes `tv.youtube.com`, else **any** page target | provider-specific preference; with two providers in one Chrome the fallback is ambiguous |
| `src/cdp.ts:86-93` | `tabTargetId`: picks the `tab` target whose URL equals the driven page's `location.href` | neutral |
| `scripts/start-chrome.sh:28, 72` | prints "Log in to YouTube TV…" and opens `https://tv.youtube.com/` | provider-specific (cosmetic + start URL) |
| `scripts/capture-spike.mjs:158` | same `tv.youtube.com` page-target preference | provider-specific, legacy |
| `extension/*` | tabCapture / offscreen recorder; `host_permissions` only for `127.0.0.1:8804` | neutral — nothing provider-specific |
| `src/server.ts` (rest) | CORS, HLS routes, PDT rewrite, ingest | neutral |
| `package.json` scripts | `chrome`, `login`, `channels`, `serve` | neutral |

Not provider-specific but worth naming: the capture frame is fixed at
1920×1080 (`capture.ts:18-19`), so a 720p-max provider is upscaled exactly
as ESPN is today.

---

## Step 2 — Philo live look (evidence)

Tab created with `Target.createTarget({url:"about:blank", newWindow:true})`
→ target `4FE6B963…`, its own window id 291691931, viewport 1500×1107.
Attached only to that target throughout.

### 2a — `https://www.philo.com/`

```
{"href":"https://www.philo.com/player/mytv","title":"Philo | Home","ready":"complete","responses":64,"elapsedMs":10211}
{"webdriver":false,"videos":0,"hasLoginWord":false,
 "bodyStart":"Skip Philo Navigation Philo Home Guide Shows Movies Saved Select... S1 | E8 Change Agents …"}
```

Redirected straight to the signed-in home. No login page, no code-entry
page (`/sign in|log in|enter code|phone number|email/i` on the first 4 KB of
body text: false). **Not stopped.**

### 2b — `navigator.webdriver`

`false` (same eval as above), in a tab created over CDP.

### 2c — Guide / channel list

**URL:** `https://www.philo.com/player/guide` (title `Philo | Guide`).
Home is `/player/mytv`. The app's router template, from the public bundle
`main-1894ecc4bf13943c8046.js` (plain GET of a CDN asset):
`"/player/:pageType/:itemId"` and `"/player/:pageType*"`.

**DOM (what is rendered):** a tile grid, one row per channel, virtualized.

```
rows rendered: 5   (class guideTileRow___X_Ewy)      tiles rendered: 40 (guideTileButton___EH1ud, <button>)
anchors with href: 44 — ALL site navigation (/player/mytv, /player/guide, /about, …); zero per-channel links
grid height 43726 px, rendered row height 176 px, spacer div above/below (tileRowsPageSpacersContainer 41820 px)
row header: <div class=anchorTileChannel…><img alt="AMC" src=…/channel_logos/AMC-White.svg…>  text "More on AMC"
tile: <button class=guideTileButton…> aria-label="Terminator 3: Rise of the Machines. On AMC. Airing live. Button 1 of many. Select to browse details. …"
```

Scrolling the window to y=6000 swapped the rendered rows to
`Great, Great American Faith & Living, Great American Family, Hallmark
Channel, Hallmark Family, Hallmark Mystery, Heroes & Icons, HGTV` and
scrolling back restored `AMC, HISTORY, A&E, AccuWeather Network, American
Heroes Channel` — so the DOM never holds more than the visible window and
the YT "wait until the count stops growing" model does not apply. Class
names are CSS-module hashes (`…___EH1ud`) and should be treated as unstable.

**Network (where the list actually comes from):** during the guide
navigation the page issued 7 POSTs to `https://www.philo.com/graphql`. One
response, 892,185 bytes, is the guide (`query page` in the bundle's
operation list). Read-only via `Network.getResponseBody`; nothing replayed.
Shape:

```
data.page.title = "Guide"
data.page.groups        : status VALID, pageInfo {hasNextPage:true, endCursor …offset 9},  summary {totalCount: 226}, edges[10]
data.page.sparseGroups  : status VALID, pageInfo {hasPreviousPage:true, hasNextPage:true, …offset 10..209}, edges[200]
edge.node (__typename TileGroup): { id, title:null, layout:"ROW", type:"GUIDE", header:{title:"Favorite channels"|"All channels"|"Free channels"}, link:{__typename PageLink, type TILE_GROUP}, channel:{…}, tiles:{summary:{totalCount:260}, edges[12]} }
edge.node.channel (__typename ChannelTile): { channelId:"Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk1MDg", displayName:"AMC", whiteSquare/whiteTrimmed/darkSquare/colorSquare/colorTrimmed: ".../channel_logos/AMC-White.svg?...&width=${width}", isFavorite:true, isStartOverDisabled:false }
```

`channelId` is base64 of `Channel:<19 digits>` (e.g.
`Channel:608548899648439508`). Each tile carries a program URL
`https://www.philo.com/player/presentation/<base64 "Broadcast:<19 digits>">`
(120 such URLs in the response, one pattern) and a channel preview clip URL
`https://prod.cdn-cf.philo.com/live/EDM-AMC-AMC-EAST-V1-R3/previews/1/preview.mp4`.

**Channel count:** `groups.summary.totalCount = 226` rows. 210 rows were
delivered in this one response (2 "Favorite channels" + 74 "All channels" +
134 "Free channels"); the remaining 16 need the cursor (`hasNextPage:true`)
and were not fetched (no replay). All 210 loaded rows have distinct
`channelId`s and distinct `displayName`s; the two favourites (AMC, HISTORY)
do **not** reappear in the alphabetical "All channels" run (…AccuWeather
Network, American Heroes Channel, Animal Planet…), so rows = channels. The
exact distinct count is therefore 226 if the 16 unloaded rows are also
distinct — not observed.

**Live-channel URL pattern (observed by clicking, 2d):**

```
guide tile click        → https://www.philo.com/player/presentation/QnJvYWRjYXN0OjYwODU0ODg5OTY4Mjc1NzI2Mg   (details page, 0 <video>)
"Watch live" click      → https://www.philo.com/player/player/broadcast/QnJvYWRjYXN0OjYwODU0ODg5OTY4Mjc1NzI2Mg  (player page, 1 <video>)
```

i.e. `/player/player/broadcast/<Broadcast id>` — keyed on the **broadcast
(programme airing)**, not the channel. A channel-keyed player URL (e.g.
something under `/player/player/channel/…`) was **not observed** and not
guessed at; the manifest is keyed per channel (`…/live/AMCSTR/manifest.json`)
so one exists server-side, but the web route to it is unknown.

### 2d — Play one live channel (AMC, first "Airing live" tile)

Timeline from the script click on the tile (t=0):

```
t=   8 ms  el.click() on tile "Terminator 3: Rise of the Machines. On AMC. Airing live…"
t=2523 ms  href=/player/presentation/…  videos=0  controls: "Watch live" (aria "Play live with 46 minutes remaining…"), "Start over" (aria "Play live from beginning…")
t=2546 ms  el.click() on "Watch live"
t=3570 ms  href=/player/player/broadcast/…  videos=1  video 0x0 paused readyState 0
t=5585 ms  video 1280x720 paused=true readyState=4 currentTime=6153.37 totalVideoFrames=59
… unchanged through t=67826 ms (paused, 59 frames)
```

Chrome's own media log (`Media.enable` on the tab) for that player:

```
kLoad blob:… → kPipelineStateChange kStarting → kDurationChanged 4294967296 → kSetCdm {"allow_distinctive_identifier":false,"allow_persistent_state":false,"key_system":"com.widevine.alpha","use_hw_secure_codecs":false}
→ kSeek 6153.367 → kPlaying → kSeeking → kPlaying → kVideoSizeChanged 1280x720 → BUFFERING_HAVE_ENOUGH (video, audio, pipeline) → kPause
… 15 s later: kSuspending → kSuspended
navigator.userActivation = {isActive:false, hasBeenActive:false}
```

The page called play, the pipeline reached `kPlaying`, and it was paused
immediately: a tab created over CDP has never received real input, and the
video is unmuted (`muted:false, volume 0.75`), so Chrome's autoplay policy
refused it. One real click (`Input.dispatchMouseEvent` mousePressed/Released
at the video centre, 750,554) gave `userActivation.hasBeenActive:true` and:

```
click → {"paused":false,"ct":6153.52,"rs":4,"w":1280,"h":720}
t=0   ct=6155.52 frames=184  dropped=0
t=30s ct=6185.65 frames=1087 dropped=1      → 903 frames / 30.09 s = 30.0 fps, currentTime advanced 30.13 s
```

**Count of `<video>` elements:** 1, on the player page (0 on home, guide,
and the details page).

**Selector that uniquely identifies the playing one:** `video#video`
(`<video id="video" autoplay playsinline src="blob:https://www.philo.com/…">`,
ancestry `div.videoElementContainer___IqIs0 < div.videoPlayerComponent___ju0MI < div.playerPage___g5kJH`).
`document.querySelector("video")` is sufficient; the id is the stable part.

**Width/height after 30 s:** `videoWidth×videoHeight = 1280×720`, element
box 1500×844 (viewport-wide). Chrome: `kResolution 1280x720`, video track
`h264, profile "h264 high", coded 1280x720, BT709 limited, encryption
scheme CENC`; audio `aac, stereo, 48000 Hz, CENC`. Decoders:
`kVideoDecoderName DecryptingVideoDecoder`, `kAudioDecoderName
FFmpegAudioDecoder`, `kIsPlatformVideoDecoder false`,
`kIsAudioDecryptingDemuxerStream true`.

**Did the page auto-select quality / is there a quality control?**

- ABR is on: bundle has `abr:{enabled:!0` (main.js). The manifest the page
  itself polled every 6 s (`…/manifestv2-kenny/live/AMCSTR/manifest.json`,
  read via `Network.getResponseBody`) lists, for AMC:

  | adaptationSet | representation id | bandwidth | size | codecs | fps |
  |---|---|---|---|---|---|
  | 1 (audio) | 128000 / 192000 | 166,400 / 192,000 | — | mp4a.40.2 | — |
  | 2 (video) | 350000 | 455,000 | 512×288 | avc1.640015 | 29.97 |
  | 2 | 500000 | 650,000 | 640×360 | avc1.64001e | 29.97 |
  | 2 | 900000 | 1,170,000 | 854×480 | avc1.64001f | 29.97 |
  | 2 | 1500000 | 1,950,000 | 960×540 | avc1.64001f | 29.97 |
  | 2 | 2400000 | 3,120,000 | 1280×720 | avc1.64001f | 29.97 |
  | 3 (video, separate key id) | 4300000 | 5,590,000 | 1280×720 | avc1.64001f | 29.97 |

  The fragments actually fetched were `…/p0/video/main/avc1/4300000/<ts>.ismv`
  and `…/p0/audio-en/main/mp4a/192000/<ts>.isma` — the top rung of the
  ladder was chosen on its own. **There is no 1080p rendition for AMC in
  this manifest.** Whether other channels carry 1080p was not observed
  (one channel by scope).
- UI control exists: gear button `aria-label="Click to select video
  quality"` opens a menu **Auto (selected) / Low / Medium / High**
  (`player-quality-menu.png`). Its mapping to rungs was not exercised.
- JS API: none found. No `videojs/shaka/Hls/dashjs/…` global; the player is
  Shaka (`vendor.js`: `shaka.Player`, `.version="v4.4.0"`, `shaka-player`)
  bundled without a global.

**EME / DRM:** yes. Key system `com.widevine.alpha`
(`kSetCdm` above, and the manifest's `drmInfos: [{encryptionScheme:"cenc",
keySystem:"com.widevine.alpha", widevinePSSH:…}]` per adaptation set).
License requests: `https://lic.drmtoday.com/license-proxy-widevine/cenc/?…`
(castLabs DRMtoday), 4 responses (2 empty + 2 JSON) at play start.
**Robustness level:** Chrome reports `use_hw_secure_codecs:false` and a
software `DecryptingVideoDecoder`, i.e. the L3 path. The exact robustness
string the page requested was not captured — Philo's Shaka build goes
through `navigator.mediaCapabilities.decodingInfo` (6 references in
vendor.js) rather than the `requestMediaKeySystemAccess` hook this recon
installed. Static evidence instead: `main.js` and `vendor.js` contain the
config keys `videoRobustness`/`audioRobustness` but **zero** occurrences of
any `SW_SECURE_*` or `HW_SECURE_*` literal, so no explicit robustness is
requested (inference from absence, labelled as such).
`chrome://media-internals` was not opened (it would have been a second tab).

**Playback with the tab occluded:** tested by minimising the recon window
(`Browser.setWindowBounds windowState:"minimized"`; the harsher case —
Chrome gives the page the same `visibilityState:"hidden"` for a fully
occluded window):

```
minimized: vis=hidden  t=0  paused=false ct=6294.17 frames=4328
                       t=5  paused=false ct=6299.17 frames=4477
                       t=10 paused=false ct=6304.20 frames=4623
                       t=15 paused=false ct=6309.22 frames=4623   ← frame counter stops, clock continues
restored:  vis=visible t=0  paused=false ct=6309.34 frames=4670
                       t=6  paused=false ct=6315.36 frames=4922
```

The page does not pause; `currentTime` advances 1:1 while hidden; Chrome
stops presenting video frames after ~10 s hidden and resumes on restore.
Consistent with the recorded fact "occluded capture is fine, minimised goes
black"; a true occlusion (another window on top) was not staged because it
would need a second window.

**On pause:** real click on the surface → `Pause video` control fires,
`paused:true`, `currentTime` frozen at 6352.32 for the 15 s watched, frame
counter frozen (6029), overlay shows START OVER / ▶ / JUMP TO LIVE and the
top bar (`player-paused-controls.png`). Chrome log: `kPause`, then
`kSuspending`/`kSuspended` 15 s later (pipeline suspended while paused).
Second real click → `kResuming → kPlaying → kPlay`; playback **resumed from
6352.44**, i.e. time-shifted from where it paused, not at the live edge
(the "JUMP TO LIVE" control exists for that). The manifest kept polling
every 6 s while paused (`maxBackBuffer 17915`, `presentationDelay 12`).

**On leaving the channel:** `Page.navigate` to `/player/guide` (full
navigation): `videos: 0`, no `.ismv/.isma/manifest.json/license` response in
the following 12 s; the guide re-issued its GraphQL queries only. The CDP
media session did not deliver a `kWebMediaPlayerDestroyed` for that player
before the document was replaced, so the teardown is evidenced by the DOM
and network, not the media log. Leaving via the in-player "Go Back" /
close control (SPA route) was not exercised.

**Visible player controls** (after a real `mouseMoved` over the video):
Go Back, Save, captions, video quality, Connect to a device, START OVER,
Pause video, JUMP TO LIVE, mute, Picture-in-picture, Enable fullscreen. A
hidden "Connect to / Chromecast / Chrome on Linux / This Device" cast
dialog is present in the DOM at all times.

### 2e — Idle on the guide, 60 s

Mouse parked on the header (750,60), sampled every 15 s:

```
t=0/15/30/45/60 s: href=/player/guide  vis=visible  videos=0
sniff (ismv|isma|manifest.json|preview.mp4|license|m3u8|mpd) for 62 s: []
```

No playback starts, no `<video>` is created, no preview clip is fetched.
(The guide data does carry per-channel `previews/1/preview.mp4` URLs; with
the mouse off the tiles none was requested. Hover behaviour not tested.)

### 2f — Screenshots (`notebook/reports/recon-philo/`)

| file | what | redaction |
|---|---|---|
| `guide.png` | `/player/guide` as rendered (Favorite channels, All channels rows) | profile avatar icon top-right blacked out (`ffmpeg drawbox`); no name/email was on screen |
| `player.png` | `/player/player/broadcast/…` playing, 1280×720 in a 1500×844 box, AMC bug | nothing to redact |
| `player-paused-controls.png` | paused state with the control overlay and title bar | nothing to redact (programme content is an advert) |
| `player-quality-menu.png` | the gear menu open: Auto / Low / Medium / High | nothing to redact |

### 2g — Close and verify

```
before: 4FE6B963… Philo | Guide (recon)   AE53AFFC… Philo | Guide (owner)   414A7B55… Home - YouTube TV (owner)
Target.closeTarget → {"success":true}
after:  AE53AFFC… Philo | Guide (owner)   414A7B55… Home - YouTube TV (owner)   https://tv.youtube.com/
chrome pid 174888 etime 20:10, 127.0.0.1:9333 still listening
```

The YouTube TV tab's target id, title and URL are identical before and
after; it was never attached to.

---

## Step 3 — sort

| component | sort | the one reason |
|---|---|---|
| a. signed-in detection | **SWEEP** | it is one provider-specific predicate string in three places; a Philo one is additive — but Philo's signed-out page was never seen, so its marker is unobserved |
| b. lineup enumeration | **STANDALONE** | Philo's guide is virtualized and cursor-paginated (226 rows, 5–8 in the DOM, list in a GraphQL response) — the YT "scrape the whole grid once" model does not transfer; a build must either drive the virtual scroll or read the page's own GraphQL responses |
| b′. playlist writer (`server.ts:92-113`) | **SWEEP** | neutral M3U writer; only `group-title="YouTube TV"` is literal |
| c. tune / play start | **STANDALONE** | it is the 4-poll fragile path, and Philo needs two clicks (tile → details → "Watch live") or a per-*broadcast* URL, plus a real input event to get past autoplay — none of which the current path does |
| d. video selector | **SWEEP** | one `<video id="video">`; simpler than YT's 40 |
| d′. quality control | **STANDALONE** | the poll is written against YouTube's player JS API; Philo has no API, only a UI menu, and (on AMC) no 1080p rung at all — the "pin 1080p" contract has no equivalent |
| e. idle park | **SWEEP** | `/player/guide` idles clean (0 `<video>`, no media traffic in 60 s); only the `GUIDE_URL` constant is YT |
| f. station-ID sliver | **SWEEP** | keyed on one YT id; a Philo entry is additive — but the D015 source (PrismCast's playlist) was not checked for Philo names |
| g. `findPageTarget` / `start-chrome.sh` | **SWEEP** for the script; **STANDALONE** for target selection | with two providers in one Chrome the "page whose URL includes tv.youtube.com, else any page" rule is ambiguous, and it sits under both the tune path and `npm run channels` |

### QUESTIONS (conflicts with recorded decisions or hard-won facts)

1. **D002** — "First provider: YouTube TV (tv.youtube.com). One provider to
   start." A Philo build is a second provider; D002 has no successor.
2. **D005** — "one login session, one channel playing at a time. No
   multi-session … Not to be revisited." Two providers in one Chrome are two
   logged-in sessions (both were live in this Chrome today); is that
   "multi-session" under D005, or does D005 mean one *tune* at a time?
3. **D009** (attach to owner-launched Chrome) with `src/cdp.ts:78`
   (prefer the `tv.youtube.com` page): which page target is "the" capture
   tab when the same profile holds a YouTube TV tab and a Philo tab? Today
   `findPageTarget` would drive the YT tab for a Philo tune.
4. **Hard-won fact** "YouTube TV plays under CDP attach at 1920×1080 …
   `setPlaybackQualityRange("hd1080","hd1080")` is required": Philo's AMC
   manifest tops out at 1280×720 and offers no player API — the 1080p
   contract (and `capture.ts:258-285`) does not apply; is a 720p provider
   acceptable, upscaled into the 1920×1080 capture as ESPN is today?
5. **Hard-won fact** (tune path, task-011/018) "re-tune from the guide is
   same-origin and costs nothing (nav 644 ms)" and the tune path issues no
   input events: on Philo an unmuted `play()` was blocked in a CDP-created
   tab until a real `Input.dispatchMouseEvent`. Does a build add real input
   to the tune path (fragile), and does user activation survive the next
   `Page.navigate`? Not observed.
6. **D013** — "the playlist carries the full YouTube TV lineup as
   enumerated from the guide, unfiltered." Philo's guide has three tiers
   (Favorite / All channels / Free channels, 134+ of the 210 loaded rows
   are "Free channels"); D013 is worded for YouTube TV and says nothing
   about a tiered lineup.
7. **D015** — name→ID pairs come from PrismCast's `/playlist`. Whether that
   playlist carries Philo channel names was not checked (would be a read-only
   GET to :5589, outside this recon's Philo-only scope).
8. **Hard-won fact** "Use `#movie_player video.html5-main-video` — the page
   has ~40 video elements" is recorded as a general capture rule; on Philo
   the rule is the opposite (exactly one `<video>`), so the fact is
   YT-scoped, not a project rule.
9. **Recorded fact** "Parking the tab on the YouTube TV guide leaves a
   paused 0×0 `#movie_player`": Philo's guide leaves **no** `<video>` at all
   (2e) — parking is cleaner there, but the tab is then on a different
   origin than the YT capture tab (see 3).

---

## Least sure of

1. **The channel count.** 226 is `groups.summary.totalCount`; only 210 rows
   were in the response and the last 16 were not fetched. That they are
   distinct channels (not more favourites or a trailing group) is assumed.
2. **The robustness level.** `use_hw_secure_codecs:false` and a software
   decrypting decoder say L3; the requested robustness string was not
   captured, and "no `SW_SECURE_*` literal in the bundle" is evidence by
   absence.
3. **That a channel-keyed player URL exists.** Only the broadcast-keyed
   `/player/player/broadcast/<id>` was observed; a build that tunes by
   broadcast id must re-resolve it every programme boundary.
4. **The autoplay finding's generality.** It was measured in a tab this
   recon created; the owner's hand-opened Philo tab (never touched) has
   real activation history and may behave differently, as may a tab
   Chrome considers to have high media engagement for philo.com.
5. **Occlusion.** Minimised was tested, occluded-by-another-window was not;
   the page sees the same `visibilityState`, but Chrome's frame-presentation
   behaviour is what capture depends on and was recorded in task-006 for
   the YT tab, not here.

---

## What pushed

Committed on `main` and pushed to `origin/main`: this file and the four
PNGs under `notebook/reports/recon-philo/`. Nothing else (`git status` was
clean apart from that directory before the commit).

```
d607214 Recon: Philo as a second provider (read-only)
 notebook/reports/recon-philo.md                    | 469 +++++
 notebook/reports/recon-philo/guide.png             | Bin 0 -> 123279 bytes
 notebook/reports/recon-philo/player-paused-controls.png | Bin 0 -> 1512055 bytes
 notebook/reports/recon-philo/player-quality-menu.png    | Bin 0 -> 518732 bytes
 notebook/reports/recon-philo/player.png            | Bin 0 -> 709770 bytes
To github.com:marlin1111ai/marlin-cast.git
   ad41c42..d607214  main -> main
git fetch origin; HEAD d60721433884f6577611fd52b921f14df388ee34 == origin/main d60721433884f6577611fd52b921f14df388ee34
```

A second commit, touching only this file, adds the block above and is
verified the same way (SHA recorded in the closing summary given to the
owner). `src/`, `scripts/`, `extension/`, the notebook files and
`package.json` are untouched; the scratchpad tooling (`cdp.mjs`, captured
bodies, raw screenshots) stayed outside the repo.

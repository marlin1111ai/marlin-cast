# Task 021 — Philo as a second provider

Date: 2026-09-12. Host: marlinpc. The owner's Chrome (pid 174888, launched
by `scripts/start-chrome.sh` at 09:34, port 9333 loopback) was never
restarted and no tab was ever closed. Its two tabs — `Home - YouTube TV`
(`414A7B5547D6…`) and `Philo | Guide` (`AE53AFFCE455…`) — are the two tabs
the app drives, and they are the only tabs it touched; every throwaway tab
this task created it also closed. Nothing on 192.168.1.250 was contacted
except the single permitted GET to PrismCast on :5589 (step 10). No
credentials, cookies, tokens, session ids, emails, avatars or account
identifiers appear in the code, the logs, this report or the commits.

**Result: shipped and verified live, with one defect found, fixed, and
one residual risk named.** Philo is a second provider: 226 channels
enumerated, `/playlist` carries 145 YouTube TV + 226 Philo entries, a Philo
tune plays at the live edge and captures for 5.5 minutes continuously,
provider switching drives the right tab each way, and the YouTube TV path
is byte-for-byte unchanged.

The defect, found during V3 and not visible from the recon: **Philo's
player control overlay was being burnt into every captured frame** — title,
scrubber, START OVER, LIVE, the whole button row. See "The control overlay"
below; it is fixed, and the fix is the part of this task I am least sure of.

---

## Result per step

| Step | Result |
|---|---|
| 1 notebook: D017–D019 | done — appended to `notebook/DECISIONS.md`, dated 2026-09-12, owner-ruled |
| 2 provider split | done — every line named in recon-philo step 1 (a–g) is behind `src/providers/`; YouTube TV moved verbatim (proved below); `scripts/capture-spike.mjs` untouched |
| 3 tab selection (D018) | done — `findPageTarget(port, provider)` matches the page target's URL **host**, no fallback; `tabTargetId` no longer falls back to `tabs[0]`; the tune activates the selected tab |
| 4 Philo signed-in detection | done — `philo.com` must settle on a `/player/` path, applied in `npm run login`, `npm run channels` and tune poll 1; no login page is looked for or navigated to |
| 5 Philo enumeration | done — **226** channels, equal to `groups.summary.totalCount`, all ids and names distinct, re-counted by hand |
| 6 Philo tune | done — direct navigation to `/player/player/broadcast/<id>` **passes** the named STOP check; two things the recon had not seen were needed and are described below |
| 7 playlist | done — 145 YouTube TV then 226 Philo, `group-title="Philo"`, `/stream/<id>/index.m3u8`, no id collision |
| 8 start-chrome.sh | done — two tabs, message updated; **not executed** (Chrome is live), the owner runs it at the next launch |
| 9 status page | done — `GET /` renders the two URLs with working copy buttons plus server status, state and last quality |
| 10 D015 check | done — one GET; **28** Philo displayNames match a PrismCast channel name exactly (2 more case-insensitively); no mapping built, no playlist line changed |
| 11 SESSION-STATE | done |

---

## Files touched, mapped to steps

| File | Step | Change |
|---|---|---|
| `notebook/DECISIONS.md` | 1 | D017, D018, D019 appended |
| `src/providers/types.ts` | 2 | **new** — the `Provider` interface, the `Channel` shape (now carrying `provider`), and the `TuneCtx` a provider is handed |
| `src/providers/youtubetv.ts` | 2 | **new** — recon rows a–g for YouTube TV, moved verbatim out of `channels.ts` and `capture.ts` |
| `src/providers/philo.ts` | 2, 4, 5, 6 | **new** — Philo: signed-in test, enumeration, broadcast resolution, tune, park URL |
| `src/providers/index.ts` | 2, 7 | **new** — the registry; playlist order and `providerFor(channel)` come from it |
| `src/cdp.ts` | 3, 4 | `findPageTarget(port, provider)` matches by URL host with no fallback and a loud fatal; `tabTargetId` no longer falls back to `tabs[0]`; new `navigateAndSettle` so a signed-in probe cannot read the outgoing document |
| `src/capture.ts` | 2, 3, 6 | provider-agnostic: per-tab sessions, tab selection and activation per tune, provider-defined navigate/play/quality around the one shared layout override, per-provider park URL, `ctx.click` / `ctx.move` real input. Encoder, muxer and playlist settings byte-identical |
| `src/channels.ts` | 5 | enumerates every provider into one cache with a `provider` field and per-provider counts; rejects a duplicate id across providers |
| `src/server.ts` | 7, 9 | playlist grouped per provider with that provider's `group-title`; `provider` on `/health`; new `GET /` status page |
| `src/login.ts` | 4 | reports every provider's session state, selecting each tab by host; rewritten on the project's own CDP client |
| `scripts/start-chrome.sh` | 8 | opens both tabs; message names both providers |
| `notebook/SESSION-STATE.md` | 11 | this pass's record |
| `notebook/reports/task-021.md` | — | this report |

`scripts/capture-spike.mjs` is untouched (legacy, task-006). `extension/`
is untouched. `package.json` is untouched — note that `login.ts` was the
last user of Playwright, so the dependency is now unused; removing it is a
separate call and was not made here.

---

## Step 2 — the provider split, and the proof YouTube TV did not change

Every line the recon inventory named (rows a–g) now sits behind
`src/providers/`. Nothing outside that directory names a provider: a
`grep` for `tv.youtube.com|philo.com|movie_player|setPlaybackQualityRange|html5-main-video|tenx-thumb|SIGN IN`
over `src/` outside `src/providers/` returns nothing.

The YouTube TV code was **moved, not rewritten**. Compared against
`git show HEAD:src/channels.ts` and `HEAD:src/capture.ts`, ignoring
indentation (the code gained two spaces moving into an object method) and
the one added `provider: "youtubetv"` field:

```
YT enumerate body      : IDENTICAL
poll 1 (navigation)    : IDENTICAL
poll 3 (player ready)  : IDENTICAL
poll 4 (quality pin)   : IDENTICAL
ffmpeg args            : IDENTICAL   (byte-for-byte diff, not normalised)
```

The shared parts of the tune that are not provider-specific — the
1920×1080 `Emulation.setDeviceMetricsOverride`, poll 2 on the viewport, the
`pollPage` helper, extension arming, the idle watchdog — stayed in
`src/capture.ts` and are unchanged.

---

## Step 5 — how the Philo lineup is read

**Choice, as the task asked me to state it: I issue the guide's own `page`
query in the page, with the page's own session.** I do not drive the
virtual scroll. The guide's request was captured read-only from its own
POST to `/graphql`; it is an automatic persisted query:

```
operationName: "page"
extensions.persistedQuery.sha256Hash: 03de2c8dc0e1331c511a2796c3e723a71d4bc6cca173a82e3903b891921b3cb4
variables: { pageType: "GUIDE", firstGroups, initialTiles, numSparseGroups,
             endCursor, includeTileChannel: true, channelLogoFormat: "AUTO",
             capabilities: [...11 flags, sent verbatim...], ... }
```

Enumeration pages on `data.page.groups` — `firstGroups: 50`,
`initialTiles: 0`, `numSparseGroups: 0` — following
`groups.pageInfo.endCursor` until `hasNextPage` is false. Five requests,
about 1.4 s, ~113 KB each, and the response is reduced to the five fields
we keep *inside the page* so nothing large crosses CDP.

Per channel:

| field | source |
|---|---|
| `id` | `edge.node.channel.channelId` (base64 `Channel:<19 digits>`) |
| `name` | `edge.node.channel.displayName` |
| `logo` | **`colorSquare`**, with Philo's own `${width}` placeholder filled with `400` |
| `tileGroupId` | `edge.node.link.typeId` — kept for the tune (see step 6) |

`colorSquare` is the brand-colour square mark. `whiteSquare` would be
invisible on a light client and `darkSquare` on a dark one; `colorSquare`
is the only one that reads on both. All 226 rows have one (0 nulls).

**Why `tileGroupId` is stored rather than derived:** it is an opaque,
server-validated blob. Decoding one gives
`TileGroup:base64({"header":{...tier...},"name":"Channel","id":"<19 digits>",...})`,
so it looks derivable — but rebuilding it with the wrong tier header is
rejected outright:

```
philoCode: "TILE_GROUP_ID_INVALID"  ("The Philo application made an unexpected request.")
```

So it is carried from enumeration, and a stale one (a channel moving
between Favorite / All / Free) falls back to re-reading the guide, which
also refreshes it in memory.

---

## Step 6 — the Philo tune, and the two things the recon had not seen

**The named STOP check passes.** Direct `Page.navigate` to
`https://www.philo.com/player/player/broadcast/<Broadcast id>` produces a
playing-capable `video#video`; the tile → details → "Watch live" click path
was not built. Measured on AMC from a cold navigation:

```
 184 ms  videos=0
1192 ms  videos=1  video 0x0  paused  readyState 0
3208 ms  videos=1  video 1280x720  paused  readyState 4      <- playing-capable
4228 ms  after one real click: paused=false, userActivation.hasBeenActive=true
```

Broadcast resolution: one `page` query with `pageType: "TILE_GROUP"` and the
channel's stored `tileGroupId`, picking the tile whose
`availabilityStartsAt <= now < availabilityEndsAt` with
`playableAssetType === "BROADCAST"` and `hasPlayable`. ~150 ms. On failure
it re-walks the guide with `initialTiles: 1` (≤5 requests) and refreshes the
id.

Then, as the task specified: if paused, one real
`Input.dispatchMouseEvent` mousePressed+mouseReleased at the video centre,
then poll `video#video` for `videoWidth>0 && !paused && readyState>=2` —
the same condition as YouTube TV's poll 3. No quality pin; `/health` gets
the element's `videoHeight` as `720p`.

**Two things the recon had not seen, both needed, both added:**

**1. Direct navigation does not land at the live edge.** It starts at the
*beginning of the DVR availability window*. Measured on AMC: the manifest
gave `availabilityStartTime 15:18:53.933Z` and `utcTime 17:26:04.295Z`
(so the live edge sat at presentation time ≈ 7630 s) while the element
reported `currentTime` **125.98** — **2 h 05 m behind wall clock**. The
recon never saw this because it reached the player by clicking "Watch
live", which makes the page seek (`kSeek 6153.367` in its Chrome media log);
a cold navigation carries no such state.

Fix: assign a `currentTime` past the end of the seek range and let the
page's own player clamp to the live edge. Measured: `226 s -> 7777 s`,
≈5 s behind wall clock. Verified again during V3: no "JUMP TO LIVE"
control present (the player's own "you are behind" affordance), and
`buffered` ending 12 s ahead of `currentTime`, matching the manifest's
`presentationDelay: 12`.

**2. The control overlay.** See below — this is the important one.

---

## The control overlay — the defect this task found

**Symptom.** The first Philo capture ran cleanly by every metric — 720p in
a 1920×1080 frame, continuous, A/V fine — and the *picture* was wrong. Every
frame carried Philo's player chrome: the programme title, the close button,
Save / captions / quality / cast buttons, START OVER, the play-pause button,
the scrubber, the clock and LIVE. Burnt in, not an overlay a client can turn
off.

**Why.** The click that satisfies Chrome's autoplay policy (needed because
the video is unmuted and a driven tab has no user activation) *also shows
the control overlay*. Philo arms the overlay's auto-hide timer from a
`mousemove` handler. A tune that clicks and never moves the pointer leaves
the controls up indefinitely.

**What was ruled out, with evidence, before that was believed:**

| suspect | test | result |
|---|---|---|
| tab capture | stopped the extension recorder mid-stream (`self.mcStop`), left the tuned page untouched, watched 22 s | overlay stayed up → **not capture** |
| tab activation | A/B: identical tune with and without `Target.activateTarget` | pinned in both arms → **not activation** |
| an ad break | sampled `adsOverlayBackground` opacity every 5 s across the run | `0` throughout while the overlay was up → **not ads** |
| one pointer nudge | a single `mouseMoved`, during capture and idle | no effect |
| letting it be | sampled every 5 s for the whole 5.7-minute capture | **49 of 49 samples with the overlay up** |

A short *sweep* of `mouseMoved` events, on the other hand, cleared it in
~2 s and it stayed clear.

**Fix.** After the live-edge seek, the tune checks whether the overlay is
already gone (it often is — the auto-hide is non-deterministic, and then
this step costs ~0), and if not sweeps the pointer across the control bar
and parks it off the page, up to three times, re-checking each round. The
check reads the overlay container's own state classes
(`overlayActive` / `controlsActive`), so it is a real assertion about the
picture, not a guess.

If it never clears, the tune **warns loudly and continues** — a stream with
chrome on it is still a stream, and failing the tune outright would be
worse. That warning is how a regression here would be noticed.

**This is the part of the task I am least sure of.** The trigger is real
and reproducible; the *fix* is a sweep of synthetic input against a
behaviour I could not make deterministic. It worked first time in V3 (log:
`control overlay clear after 1 sweep(s)`) and held for the whole run, but
an earlier single-sweep version failed on one tune and warned. If this
proves flaky in use, the deterministic alternative is to hide the overlay
page-side with an injected CSS rule on `[class*="playerOverlay"]` — I did
not build that, because it mutates the page's rendering in a way the app
has never done and its selector rides on Philo's CSS-module names, and that
is the owner's call rather than mine.

---

## V1 — the YouTube TV section of `/playlist` is unchanged

`/playlist` was saved to `/tmp/playlist-before.m3u` **before any code
change** (144 channels, 289 lines, `md5 302699a39029e56e5baaa2745f4213a6`).

The live YouTube TV lineup then drifted overnight, so a plain after-diff
would have measured YouTube TV, not this task. Between the 2026-09-11 18:25
enumeration and today's:

```
ADDED   : I1jTpQKv5A0 ESPN, X0hj-8OlGFM ESPN, D-Trg1a_m8k ESPN, YaSBNQ7a4Xk NBCSN Extra
REMOVED : gaT2Q_KZxns ESPN, arlkwb9_uTw ESPN, n33BiPboLfo ESPN
CHANGED : 138 logo URLs (YouTube rotates its yt3.ggpht.com thumbnail URLs)
order of the shared ids: identical
```

`MrXg0chrojg` — the ESPN the owner tunes, and the one carrying the D015
station-id sliver — is still present and unchanged.

So V1 was run as the **code-isolation** test it is meant to be: the new
playlist writer over the *old* lineup, with the Philo section empty.

```
$ diff /tmp/playlist-before.m3u <new /playlist over the baseline lineup>
$ md5sum both
302699a39029e56e5baaa2745f4213a6  /tmp/playlist-before.m3u
302699a39029e56e5baaa2745f4213a6  playlist-v1.m3u
```

**Diff empty; byte for byte identical.** The real cache was restored
immediately afterwards.

## V2 — `npm run channels`

```
[channels] youtubetv: 145
[philo] 226 channels, totalCount 226, tiers {"Favorite channels":2,"All channels":74,"Free channels":150}
[channels] philo: 226
enumerated 371 channels at 2026-09-12T17:39:07.507Z
by provider: {"youtubetv":145,"philo":226}
```

**Philo 226 = `groups.summary.totalCount` 226** — expected 226, met. The
count is asserted in code, not just logged: a mismatch throws. Re-counted by
hand from `data/channels.json`, not inherited from the response:

```
philo rows 226   distinct ids 226   distinct names 226
null logos 0     id collisions with YouTube TV: none
tiers: Favorite 2 + All 74 + Free 150 = 226   (all three tiers, D019)
```

**YouTube TV is 145, not the 144 in the previous cache.** That is the live
lineup drift above (+4 ESPN/NBCSN feeds, −3 ESPN feeds), not a code effect:
the enumeration body is byte-identical to `HEAD` apart from indentation and
the added `provider` field, and V1 proves the writer is unchanged. Flagging
it rather than calling V2 clean, because the task's expectation was
"unchanged".

## V3 — a Philo tune, captured for 5.5 minutes

AMC (`Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk1MDg`), pulled with a local ffmpeg
`-c copy` for 330 s.

Tune (server log):

```
[tune] AMC: provider philo, tab AE53AFFCE455… (https://www.philo.com/player/player/broadcast/…)
[philo] AMC: broadcast QnJvYWRjYXN0OjYwODU0ODg5OTY4Mjc1NzI2NA "The Perfect Storm" (18:00:00Z -> 21:00:00Z) via tileGroupId
[philo] AMC: dispatched one real click at 960,540 to satisfy the autoplay policy
[philo] AMC: seek to live 109s -> 118s
[philo] AMC: control overlay clear after 1 sweep(s)
[tune] AMC WARNING: Philo has no hd1080 rendition — capturing 1280x720 upscaled into the 1920x1080 frame (D017)
[tune] AMC {"ok":true,"quality":"720p","is1080":false,"video":"1280x720","box":"1919x1080","viewport":"1920x1080"}
[tune-ms] AMC nav=432 layout=433 playing=2953 pinned=2956
[capture] AMC recording {"frameRate":30,"height":1080,"resizeMode":"crop-and-scale","width":1920}
```

Cold tune **2.956 s** (YouTube TV's is ~4.2 s; Philo has no quality poll to
wait on).

Pull result:

| | |
|---|---|
| exit | 0, `330.00 s` of media in **165 segments**, none missing |
| errors in the pull log | **0** (`error\|invalid\|non-monotonic\|failed`) |
| warnings | only the known ones: 326 × "Found duplicated MOOV Atom. Skipped it" (task-015 `EXT-X-MAP` reload artifact) |
| `/health` during | `state: streaming`, `quality: 720p`, `provider: Philo`, `channel: AMC`, `segments: 11`, `chunks_in` rising 44 → 276, `bytes_in` → 94 MB |

`ffprobe` of a mid-run segment (`seg00100.ts`):

```
VIDEO h264 High level 40  1920x1080  yuv420p  r_frame_rate 30/1  has_b_frames 0
AUDIO aac LC  2 ch  48000 Hz  stereo
```

**1280×720 source in a 1920×1080 frame, AAC** — as D017 accepts. A frame
lifted from the middle of the run is at
`notebook/reports/task-021/philo-capture-clean.png`: the picture fills the
frame (no pillarbox, no letterbox), the AMC bug is bottom-right, and there
is no player chrome anywhere.

**Live edge**, checked during the run rather than assumed: no "JUMP TO
LIVE" control present (the player's own "you are behind" affordance), and
`buffered` ending 12.0 s ahead of `currentTime`, matching the manifest's
`presentationDelay: 12`.

**Control overlay**, sampled every 5 s for the whole run: **69 of 69
samples clear**. (Before the fix, the same sampling gave 49 of 49 samples
with the overlay up.)

**Programme boundary: not exercised inside this run** — the run was
18:02:44Z–18:08:15Z and AMC's next boundary was 21:00Z. It *was* exercised
between runs: the 18:00Z boundary fell between two tunes and the tune
resolved the new broadcast correctly without intervention —
`"2012"` (14:30→18:00Z) before it, `"The Perfect Storm"` (18:00→21:00Z)
after. Re-resolution mid-capture is therefore **untested**: a tune that is
still running when its broadcast ends keeps playing the same Broadcast id,
and whether Philo rolls that into the next programme or stops is unknown.

## V4 — switching providers drives the right tab each way

Both tabs, before anything:

```
AE53AFFCE455  www.philo.com    https://www.philo.com/player/guide
414A7B5547D6  tv.youtube.com   https://tv.youtube.com/live
```

Tune YouTube TV (`MrXg0chrojg`), HTTP 200 in 4.32 s:

```
/health  state: streaming  provider: YouTube TV  channel: ESPN (MrXg0chrojg)  quality: hd720
414A7B5547D6  tv.youtube.com   https://tv.youtube.com/watch/MrXg0chrojg?vp=…   <- driven
AE53AFFCE455  www.philo.com    https://www.philo.com/player/guide              <- untouched
```

Then Philo (AMC), HTTP 200 in 5.98 s:

```
/health  state: streaming  provider: Philo  channel: AMC  quality: 720p
AE53AFFCE455  www.philo.com    https://www.philo.com/player/player/broadcast/…  <- driven
414A7B5547D6  tv.youtube.com   https://tv.youtube.com/watch/MrXg0chrojg?vp=…    <- untouched
```

Each tune drove the tab whose URL host matches its provider, and left the
other alone.

**hd1080 via the existing quality poll.** `MrXg0chrojg` cannot show it:
ESPN advertises `["hd720","large","medium","small","auto"]` and has no
`hd1080` at all — the recorded task-011 fact, not a regression, and the
poll did exactly what task-011 specified (pin the best level at or below
hd1080, warn, report it). So hd1080 was demonstrated on channels that do
offer it:

```
[tune] TNT               {"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","available":["hd1080","hd720",…]}
[tune] USA               {"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080",…}
[tune] Discovery Channel {"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080",…}
[tune] ESPN              {"target":"hd720","quality":"hd720","is1080":false,"video":"1280x720","available":["hd720","large","medium","small","auto"]}
[tune] ABC 2             {"target":"hd720","quality":"hd720","is1080":false,"video":"1280x720","available":["hd720","large","medium","small","auto"]}
```

## V5 — idle

Philo tuned, then all requests stopped; watchdog is 20 000 ms.

```
streaming:  AE53AFFCE455 www.philo.com  /player/player/broadcast/QnJvYWRjYXN0OjYwODU0ODg5OTY4Mjc1NzI2NA
            414A7B5547D6 tv.youtube.com /watch/lZ0OABAKMmA?vp=…

after 25 s: state: idle   provider: -   channel: - (-)   segments: 0
            AE53AFFCE455 www.philo.com  https://www.philo.com/player/guide      <- parked
            414A7B5547D6 tv.youtube.com /watch/lZ0OABAKMmA?vp=…                 <- unchanged

encoder processes: 0        HLS directories: 0
```

The Philo tab parked on `/player/guide`; the YouTube TV tab was not
touched — only the tab that was driven is parked.

## V6 — a provider whose tab is not open fails loud

Done without closing any real tab: the Philo provider's host was pointed at
the throwaway name `no-such-tab.invalid` (never resolved, never contacted),
the server restarted, and a Philo stream requested.

```
HTTP/1.1 503 Service Unavailable

tune failed: Error: fatal: no philo tab open — no page target with host
no-such-tab.invalid; open pages: https://www.philo.com/player/guide,
https://tv.youtube.com/watch/lZ0OABAKMmA?vp=…
```

Server log: `[serve] Error: fatal: no philo tab open — …`. No silent
fallback to "any page"; the real Philo tab was open the whole time and was
*not* driven, which is the point of D018. YouTube TV kept tuning normally
in the same server (`TNT`, HTTP 200 in 4.41 s, `quality: hd1080`).

The host was reverted immediately and Philo re-verified working
(HTTP 200, `provider: Philo`, `quality: 720p`).

## V7 — the status page

`GET /` rendered in a throwaway tab in the live Chrome, which was closed
afterwards (`Target.closeTarget → {"success":true}`); the owner's two tabs
were not touched.

Idle — `notebook/reports/task-021/status-idle.png`:

```
server        listening on 0.0.0.0:8804
channels      371 (youtubetv 145, philo 226)
enumerated    2026-09-12T17:39:07.507Z
state         idle
tuned         idle — nothing tuned
last quality  720p
idle stop     20000 ms with no client request
```

Tuned — `notebook/reports/task-021/status-tuned.png`:

```
state         streaming
tuned         Philo — AMC
last quality  720p
```

Both copy buttons were clicked with real input events and the clipboard read
back, in both states:

```
copy button 0: label "Copied", clipboard "http://127.0.0.1:8804/playlist"  MATCH=true
copy button 1: label "Copied", clipboard "http://127.0.0.1:8804/health"    MATCH=true
```

The URLs are built from the request's `Host` header, so a browser reaching
the server at `192.168.1.245:8804` copies that address, not `127.0.0.1`.

## V8 — step 10, the D015 check

One `GET http://192.168.1.250:5589/playlist` (27 230 bytes, 159 entries, 159
distinct names). Nothing else on that host was contacted, no mapping was
built, and no playlist line changed.

**28 of the 226 Philo `displayName`s match a PrismCast channel name
exactly**, with these `tvc-guide-stationid`s:

| Philo displayName | station id | | Philo displayName | station id |
|---|---|---|---|---|
| AMC | 59337 | | Hallmark Mystery | 46710 |
| A&E | 51529 | | HGTV | 49788 |
| AMC Thrillers | 115678 | | IFC | 59444 |
| Animal Planet | 57394 | | Investigation Discovery | 65342 |
| BBC America | 64492 | | Lifetime | 60150 |
| BET | 63236 | | Magnolia Network | 67375 |
| BET Her | 63220 | | MTV | 60964 |
| CMT | 59440 | | Paramount Network | 59186 |
| Comedy Central | 62420 | | Smithsonian Channel | 58532 |
| Destination America | 60468 | | TLC | 57391 |
| Discovery Life | 92204 | | TV Land | 73541 |
| Discovery Turbo | 31046 | | VH1 | 60046 |
| Food Network | 50747 | | Game Show Network | 68827 |
| FYI | 58988 | | Hallmark Family | 105723 |

Two more match only if case is ignored — recorded because a real mapping
would have to decide about them:

```
philo "HISTORY" == prismcast "History"  -> 57708
philo "We TV"   == prismcast "WE tv"    -> 59296
```

The other 198 Philo names have no exact PrismCast counterpart (Philo's Free
tier is mostly FAST channels PrismCast does not carry).

---

## What is pushed vs local

Everything in this task — code, notebook, report, screenshots — is in one
commit on `main` and pushed to `origin/main`. Verification (`git fetch` +
SHA comparison) is recorded at the end of this file.

Not committed and deliberately outside the repo: the scratchpad probe
scripts and captured GraphQL/manifest bodies used to work all this out.
They contain session-scoped identifiers from the owner's Philo session and
must not enter the repo.

## Open questions

1. **Mid-capture programme boundaries.** A Philo tune is keyed on a
   *Broadcast* id, not a channel. V3 showed the boundary handled correctly
   *between* tunes, but a capture that is still running when its broadcast
   ends is untested: Philo may roll into the next programme on the same
   presentation, or it may stop. If it stops, the tune needs to re-resolve
   and re-navigate at the boundary — which would put a visible glitch in
   the stream every programme. **This is the biggest unknown in the Philo
   path and the first thing to test on a long recording.**
2. **How reliable the overlay dismissal is.** See "least sure of" below.
3. **The persisted-query hash.** Enumeration rides on Philo's own APQ hash
   `03de2c8d…`. When Philo ships a new web bundle that hash changes and the
   server answers `PersistedQueryNotFound`; `npm run channels` then fails
   loud (it does not return a short lineup), but it fails, and the fix is a
   manual re-capture from the guide's own request. Self-healing — reading
   the hash out of the page's own bundle at run time — was not built.
4. **`tileGroupId` staleness.** Stored at enumeration, validated
   server-side, and it encodes the row's tier. A channel moving between
   Favorite / All / Free invalidates it. There is a fallback (re-walk the
   guide, refresh the id in memory) but it has only been exercised
   artificially, never by a real tier change.
5. **Philo logo choice.** `colorSquare` at `width=400`. Whether those SVGs
   render in Marlin IPTV Editor / Marlin DVR is unverified — no client has
   been pointed at the new playlist yet.
6. **Playwright is now an unused dependency** (`login.ts` was its last
   user). D003 names it in the stack, so removing it is an owner call, not
   one I made.
7. **226 channels is a lot of tuning surface.** Exactly one Philo channel
   (AMC) has ever been tuned. The other 225 are enumerated, not exercised;
   channels out of plan, blacked out, or with no live broadcast will take
   the `fatal: philo channel … has no live broadcast airing now` path,
   which has never fired for real.
8. **D015 for Philo.** 28 exact name matches exist and are recorded. No
   mapping was built (step 10 said not to), so every Philo entry still
   ships with no `tvc-guide-stationid`.

## What I am least sure of

1. **The control-overlay fix.** The *cause* is solid and reproducible: the
   autoplay click shows the overlay, and Philo arms its auto-hide from a
   `mousemove` handler, so a click-and-never-move tune leaves the chrome up
   for ever. The *fix* — sweeping synthetic pointer events until the
   overlay's own state classes clear — is a workaround against behaviour I
   could not make deterministic. Evidence both ways, from this session: one
   tune cleared it after **1** sweep, another needed **3**, and an earlier
   single-sweep version failed outright and warned. The retry loop is
   bounded (≈8 s worst case) and the failure is loud rather than silent,
   but I cannot claim it always works. The deterministic alternative is a
   page-side CSS rule hiding `[class*="playerOverlay"]`; I did not build it
   because it mutates the page's rendering in a way this app has never done
   and rides on Philo's CSS-module class names.
2. **That the live-edge seek is right in every case.** `currentTime = 1e9`
   relies on the page's own player clamping to the end of its seek range.
   It did, twice measured against wall clock and once against the absence
   of the "JUMP TO LIVE" control. On a channel with a different DVR window,
   or during an ad break, it is unverified.
3. **The YouTube TV count going 144 → 145.** I am confident it is lineup
   drift, not code — the enumeration body is byte-identical, the shared ids
   keep their order, and V1 proves the writer. But the old `data/channels.json`
   was lost mid-task (my own `pkill -f 'src/server.ts'` matched the shell
   running the backup copy and killed it), so the comparison is against the
   saved *playlist*, which carries id, name and logo but not `href`.
4. **Whether tab capture on a background tab works.** Never tested. The app
   activates the tab for every tune, so with two providers a tune always
   pulls the tuned tab to the front. If the owner is using that Chrome
   window, tunes will steal focus between tabs.
5. **`numSparseGroups: 0`.** Enumeration asks only for dense `groups` rows
   and pages them. The guide itself asks for 10 dense + 200 sparse. Both
   give the same 226 rows and the same ids today; I have not checked that
   they always agree.

---

## Push verification

```
$ git push origin main
To github.com:marlin1111ai/marlin-cast.git
   1b5dabb..0218f24  main -> main

$ git fetch origin
HEAD        0218f24ca951b1391e055835299210e2c59f2741
origin/main 0218f24ca951b1391e055835299210e2c59f2741
MATCH
```

One commit, `0218f24`, carrying all of it: `src/providers/` (4 new files),
`src/capture.ts`, `src/cdp.ts`, `src/channels.ts`, `src/server.ts`,
`src/login.ts`, `scripts/start-chrome.sh`, `notebook/DECISIONS.md`,
`notebook/SESSION-STATE.md`, this report and its four screenshots. Nothing
is left local. `git status` is clean apart from this closing section, which
is committed on top.

Working tree state at hand-off: the dev server is running on
`0.0.0.0:8804`; the owner's Chrome (pid 174888) is untouched, with the
YouTube TV tab on a `/watch/` URL from the last YouTube TV tune and the
Philo tab parked on `/player/guide`. `scripts/start-chrome.sh` now opens
both tabs but has **not** been executed — it takes effect at the owner's
next Chrome launch.

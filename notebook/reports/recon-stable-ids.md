# Recon — stable per-channel ids and per-provider playlists (read-only)

Date: 2026-09-12, ~19:45–20:05 EDT, marlinpc. No code written; `src/`, `scripts/` and
`extension/` untouched. Nothing on 192.168.1.250 contacted. No login/accounts page
opened. No credentials, cookies, tokens, session ids or account identifiers below.

**Result: STOPPED on failure at step 2.** The owner's Chrome exited while this
recon was running, before the step-2 tab was created. Steps 2 and 3 could not
look at a live page. Steps 1 and 4 are complete. Step 3 is answered from recorded
and on-disk evidence only. **Chrome was not relaunched** (D009: the owner's step).

**Update:** step 2 was completed in a follow-up pass after the owner relaunched
Chrome. See "Step 2 (completed 2026-09-12 20:22 EDT)" at the end. The sort,
QUESTIONS and least-sure sections are updated where it changes them.

---

## The failure (snapshot)

At the start of this pass `http://127.0.0.1:9333/json/list` answered with the
owner's tabs:

```
D69065AF7DA903999FF8438B5A408CA8 page tv.youtube.com
B616E164D9BD487870AAD47CC19BD846 page www.philo.com
```

The step-2 script's first call then failed. It never reached `Target.createTarget`,
so **no tab was created**:

```
TypeError: fetch failed … [cause]: Error: connect ECONNREFUSED 127.0.0.1:9333
```

Snapshot at 2026-09-12 20:00:25 EDT:

| check | result |
|---|---|
| Chrome browser process | none (`/opt/google/chrome/chrome` not running; no child processes left) |
| ports | nothing listening on 9333 or 8804 |
| user journal | `19:57:09 pop-os systemd[2433]: app-com.google.Chrome-193182.scope: Consumed 44.108s CPU time.` |
| kernel journal, last 90 min | readable; no `out of memory` / `oom-kill` / `killed process` lines |
| `systemd-oomd` | `inactive` |
| `/proc/pressure/memory` | `some avg10=0.00 avg60=0.00 avg300=0.00` |
| memory | 64118 MB total, 5966 MB available, 2072 MB swap used |
| largest process | `python` pid 190315, RSS 50,898,192 kB, up 1 h 54 m |
| profile | `SingletonLock -> pop-os-193182` still present (dated 18:12) |
| cookie store (counts only) | last written 19:55:45; 262 rows, 223 persistent, tags `{v10: 262}`; youtube.com 32 rows, philo.com 25 rows |

Chrome pid 193182 ran in a systemd user *app scope*
(`app-com.google.Chrome-193182.scope`), not under this session. The scope
ended at 19:57:09. The leftover `SingletonLock` suggests an unclean exit
(inference). **Cause of exit not determined:** there is no kernel OOM entry and
oomd is inactive. The 50.9 GB `python` process matches the task-021 correction's
description of the owner's GPU job, but nothing links it to this exit. The cookie
store is all `v10` (D010) with both providers' rows, so the login is very likely
intact. That is unverified until the owner relaunches.

Also in the user journal, not caused by this recon: three short-lived Chrome
scopes at 18:38:38, 18:40:14 and 18:41:22 (pids 203106, 203899, 204232), each
ending about 2 minutes later.

---

## Step 1 — evidence of rotation

`/tmp/playlist-before.m3u` **is present** (36,952 bytes, 289 lines, 144 entries).
Per task-021 V1 it was saved before task-021's code change, from the
2026-09-11 lineup. It is compared here against the `youtubetv` rows of
`data/channels.json` (`enumeratedAt 2026-09-12T17:39:07.507Z`, 145 rows).

**Ids that disappeared (all named `ESPN`), with their logos from the old file:**

| guide index | id | name | logo before |
|---|---|---|---|
| 23 | `gaT2Q_KZxns` | `ESPN` | `https://yt3.ggpht.com/RUe7XOVn2vUaHqWbRT_w_o_TDp1d8-XU0B_i1vy0n7aDymp39M93I4S_-rT61vowI1tuUmyU7Xxd=ns-nd` |
| 24 | `arlkwb9_uTw` | `ESPN` | `https://yt3.ggpht.com/On3CeDl6PLuQy1Y0ZvuMKQUUUQ3VHy1x2iGcFYLcE3Y0Ez6xrBT3O5tUs_FIhLJWSE_6hoIrfO-z=ns-nd` |
| 25 | `n33BiPboLfo` | `ESPN` | `https://yt3.ggpht.com/z1NA6ggKC8-_zyLvzxTYaqsG3-c76VxevHqIJtlLyMF5Mbh2MjJpG1jg_WcucDVbdxN9aBNzSXV8TQ=ns-nd` |

**Ids that appeared, with their logos and hrefs now:**

| guide index | id | name | logo after | href |
|---|---|---|---|---|
| 23 | `I1jTpQKv5A0` | `ESPN` | `https://yt3.ggpht.com/Fn14pu0fxvs1WMm1zxaeNV-35h-9MtiOmJ0mAnp3PM0NzA3VAg8IdDxC00Z8IzDnKLrqJaF9tfIx=ns-nd` | `watch/I1jTpQKv5A0?vp=0gEEEgIwAQ%3D%3D` |
| 24 | `X0hj-8OlGFM` | `ESPN` | `https://yt3.ggpht.com/xXawzJt8aMmk6__YpkpsfOxnTXAy4yB-_JA2LRxYS3lW3aJo66iA5NzXlZRWsnmXeBFJ6aNKt47F=ns-nd` | `watch/X0hj-8OlGFM?vp=0gEEEgIwAQ%3D%3D` |
| 25 | `D-Trg1a_m8k` | `ESPN` | `https://yt3.ggpht.com/5UKMIA4nUlOKlee5OzO19Zt88De1tkHMQGkw_a9Bu2gmnHNdBwXh3xedidu2Zeo5L93bEHk7k0I=ns-nd` | `watch/D-Trg1a_m8k?vp=0gEEEgIwAQ%3D%3D` |
| 29 | `YaSBNQ7a4Xk` | `NBCSN Extra` | `https://yt3.ggpht.com/0Ij6xaiz1AgVJ0wp3trrqsSxSVYnn1LQIrQnxSQHcFTpFKxEb1ZVf6Jx2W71WO-k34X3LXNnzTlP=ns-nd` | `watch/YaSBNQ7a4Xk?vp=0gEEEgIwAQ%3D%3D` |

In the old file the rotated ids' neighbours are `EJNPilLA3oY` (ESPNews) before
index 23 and `TYWJsmNl7WE` after index 25. The new ids have the same neighbours.
**The three rotated ids sit in exactly the same three guide slots**, and
`NBCSN Extra` is a genuine addition at 29.

**What stayed constant, and what did not:**

| attribute | across the 3 rotated slots | across the 141 ids present both days |
|---|---|---|
| name | constant (`ESPN` → `ESPN`) | constant, 141 of 141 |
| logo URL | **changed**, none of the old logo URLs appear anywhere in the new lineup | **changed on 138 of 141**; only 3 unchanged |
| guide index | constant (23, 24, 25) | order of shared ids identical (task-021 V1) |
| href query | `vp=0gEEEgIwAQ%3D%3D` on both sides | `vp` is the same value on every row; 12 rows also carry a `vpp` param |

Two more facts that bear on logo URL as an identity:

- **Logo URLs are not unique.** Right now `MrXg0chrojg` (ESPN) and `I1jTpQKv5A0`
  (ESPN) carry the byte-identical logo `…/Fn14pu0fxvs1WMm1zxaeNV-35h-9MtiOmJ0mAnp3PM0NzA3VAg8IdDxC00Z8IzDnKLrqJaF9tfIx=ns-nd`.
  So do `ye5JPFbQ7XE` (Golf Channel) and `LXfrE81qMGA` (CNBC). The old file also
  had 2 shared logo URLs.
- The logo suffix changed form for some rows: the old file mixes `=w235-h132-p-ns-nd-rw`
  and `=ns-nd`; the cache is all `=ns-nd`.

The `vp` value decodes (base64) to bytes `d2010412023001` on every row, so it
does not tell channels apart. `vpp` (for example `0gcJCRUA3bTjb5HI` on
`LwYqqxn4jOM` ESPNU) appears on 12 rows. Whether `vpp` is stable was not
observed (one snapshot only).

`MrXg0chrojg`, the ESPN carrying the D015 sliver, kept its id; its logo changed
from `…6D1rBSDA-wflW4acQi-2eH7_pu_hs54frBgYTe3gatDUC5QLNs562KK3MqqgWMEigImA7vAC6GQ=ns-nd`
to the `Fn14pu0…` URL above.

---

## Step 2 — YouTube TV identifiers: NOT PERFORMED

*(Superseded: completed in a follow-up pass. See "Step 2 (completed 2026-09-12
20:22 EDT)" at the end. This section is kept as the record of the first pass.)*

Chrome was gone before the tab could be created (see failure). **No DOM
attribute, aria label, tooltip or guide API response was observed in this
recon.** The only per-channel fields on disk are the four the current
enumerator keeps (`src/providers/youtubetv.ts:53-81`: `aria-label` on
`ytu-endpoint.tenx-thumb`, the inner `a[href]`, and the first non-`data:`
`img[src]` or `ytu-thumbnail[src]`):

| field (origin) | ESPN `MrXg0chrojg`, byte-exact from `data/channels.json` |
|---|---|
| `name` (`aria-label` minus `^watch `) | `ESPN` |
| `href` (`a[href]`) | `watch/MrXg0chrojg?vp=0gEEEgIwAQ%3D%3D` |
| `id` (`href` `/watch\/([^?&#]+)/`) | `MrXg0chrojg` |
| `logo` (`img[src]`) | `https://yt3.ggpht.com/Fn14pu0fxvs1WMm1zxaeNV-35h-9MtiOmJ0mAnp3PM0NzA3VAg8IdDxC00Z8IzDnKLrqJaF9tfIx=ns-nd` |

**What tells the four "ESPN" tiles apart, from the cache: nothing except the id
and guide position.**

```
idx 17 MrXg0chrojg  watch/MrXg0chrojg?vp=0gEEEgIwAQ%3D%3D  logo …Fn14pu0…
idx 23 I1jTpQKv5A0  watch/I1jTpQKv5A0?vp=0gEEEgIwAQ%3D%3D  logo …Fn14pu0…   <- same logo as idx 17
idx 24 X0hj-8OlGFM  watch/X0hj-8OlGFM?vp=0gEEEgIwAQ%3D%3D  logo …xXawzJt…
idx 25 D-Trg1a_m8k  watch/D-Trg1a_m8k?vp=0gEEEgIwAQ%3D%3D  logo …5UKMIA4…
```

The aria labels, tooltips, data-* attributes, channel/network ids in the guide
API, and whether any of them is a durable key: **all unobserved.**

---

## Step 3 — Philo identifiers (recorded and on-disk evidence; no live look)

The second tab was not created (Chrome gone), so no GraphQL response was read in
this recon. Evidence:

**Where the field sits.** Quoted from `notebook/reports/recon-philo.md:178-185`
(guide `page` response read via `Network.getResponseBody`, 2026-09-12). Channel
identity and programming sit on **separate** fields: the row's `channel` object
carries `channelId`, and each tile carries a Broadcast URL.

```
edge.node (__typename TileGroup): { id, title:null, layout:"ROW", type:"GUIDE", header:{title:"Favorite channels"|"All channels"|"Free channels"}, link:{__typename PageLink, type TILE_GROUP}, channel:{…}, tiles:{summary:{totalCount:260}, edges[12]} }
edge.node.channel (__typename ChannelTile): { channelId:"Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk1MDg", displayName:"AMC", whiteSquare/whiteTrimmed/darkSquare/colorSquare/colorTrimmed: ".../channel_logos/AMC-White.svg?...&width=${width}", isFavorite:true, isStartOverDisabled:false }
```

```
Each tile carries a program URL
`https://www.philo.com/player/presentation/<base64 "Broadcast:<19 digits>">`
```

Note: that block is recon-philo's own summary of the response, not a raw paste.
The paths the app reads are in code: `src/providers/philo.ts:94-100`
(`e.node.channel.channelId`, `e.node.link.typeId`) and `:112-115`
(`t.node.playableAssetId`, `t.node.playableAssetType`,
`t.node.availabilityStartsAt`, `t.node.availabilityEndsAt`).

**Same `channelId`, different programmes (all 2026-09-12):**

| observation | AMC `channelId` | programme / Broadcast id |
|---|---|---|
| recon-philo 2c/2d (morning) | `Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk1MDg` | "Terminator 3" → `QnJvYWRjYXN0OjYwODU0ODg5OTY4Mjc1NzI2Mg` |
| `data/channels.json` (`17:39:07Z`) | `Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk1MDg` | — |
| task-021 V3 tune, same stored channel record | same | `"2012"` (14:30→18:00Z) before the boundary; `"The Perfect Storm"` `QnJvYWRjYXN0OjYwODU0ODg5OTY4Mjc1NzI2NA` (18:00→21:00Z) after |

**Decoded (on-disk, all 226 Philo rows):**

```
Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk1MDg  -> Channel:608548899648439508
tileGroupId -> TileGroup:<base64 JSON> keys ['header','name','id','includeExternalAssets','hasPromotionTile']
               name "Channel", id "608548899648439508", header keys ['id','title','iconName']  (AMC header id: favorite_channels)
226 of 226 rows: channelId decodes to Channel:<digits> AND the tileGroupId's inner id equals those digits
digit length: 18 on every row
```

**Reading of the evidence:** `channelId` lives on the `ChannelTile` and did not
change across two programme boundaries in one day. The programme is carried
separately, by the Broadcast id on tiles. `tileGroupId` embeds the **tier**
(`header.id`), which task-021 measured as server-validated
(`philoCode: "TILE_GROUP_ID_INVALID"` on a wrong header), so it is tied to the
row's tier, not the channel alone. **Not observed:** `channelId` across days,
across a lineup refresh, or across a tier change. Durable beyond 2026-09-12 is
not shown.

Correction to the record: task-021 and recon-philo describe the id as
`Channel:<19 digits>`; the decoded values are **18** digits on all 226 rows.

---

## Step 4 — code that treats the provider id as the channel's identity

| file:line | what it does |
|---|---|
| `src/providers/types.ts:12-24` | `Channel = { id, name, logo, provider, href?, tileGroupId? }`: one `id`, which is the provider's own id |
| `src/providers/youtubetv.ts:57-62` | YouTube TV `id` = `href.match(/watch\/([^?&#]+)/)[1]` (the watch video id); dedupe `seen` on that id |
| `src/providers/youtubetv.ts:81` | cached row `{ id, name, logo, href, provider: "youtubetv" }` |
| `src/providers/youtubetv.ts:94` | tune URL built from the **cached** `channel.href` (contains the id) |
| `src/providers/youtubetv.ts:103` | tune poll 1 waits for `location.href` to contain `channel.id` |
| `src/providers/philo.ts:291-301` | Philo `id` = `row.channelId`; dedupe on it; `tileGroupId` stored alongside |
| `src/providers/philo.ts:171, 180` | fallback broadcast lookup matches `row.channelId !== channel.id`; error text carries the id |
| `src/channels.ts:51-56` | duplicate-id check across providers ("The stream router keys on the channel id alone") |
| `src/channels.ts:59-63` | writes `data/channels.json` in the `Channel` shape |
| `src/server.ts:31` | `byId` map, keyed on `c.id` |
| `src/server.ts:104` | playlist `tvg-id="${c.id}"` |
| `src/server.ts:114` | D015 sliver `c.id === "MrXg0chrojg"` |
| `src/server.ts:117` | stream URL `${base}/stream/${c.id}/index.m3u8` |
| `src/server.ts:170-172` | stream route: `byId.get(req.params.id)`; unknown id → `404 unknown channel` |
| `src/server.ts:181, 185, 190` | `dirFor(channel.id)`, `touch(channel.id)`, `currentChannelId() !== channel.id` |
| `src/server.ts:198-204` | segment route: `byId.has(id)`, `dirFor(id)`, `touch(id)` |
| `src/server.ts:62-63` | ingest route `/ingest/:id/:token` → `pipeline.ingest(req.params.id, …)` |
| `src/server.ts:78` | `/health` prints `channel: <name> (<id>)` |
| `src/capture.ts:164, 176` | `status().channelId`, `currentChannelId()` |
| `src/capture.ts:179-183` | `touch(channelId)`; `dirFor` → `data/hls/<id>` |
| `src/capture.ts:196, 201, 212` | `ensure` compares `channel.id`; tune dir from it |
| `src/capture.ts:347` | extension ingest URL `…/ingest/${channel.id}/${token}` |
| `src/capture.ts:363-365` | `ingest` accepts only the live `channel.id` |
| `src/server.ts:231-245` (status page `GET /`) | shows provider and channel **name** only; no id |

Not keyed on the channel id: `src/cdp.ts` (tab selection by host, D018),
`src/login.ts`, and `extension/*` (a grep for the id and the ingest route over
`extension/*.js`/`.json` returns nothing; it receives the ingest URL as an
opaque option).

**Observed consequence today:** an M3U consumer holding
`/stream/gaT2Q_KZxns/index.m3u8` from the 2026-09-11 lineup now gets
`404 unknown channel` (`server.ts:172`), because `byId` holds only current ids.

**What ITEM B changes:**
- the stream URL key and route lookup (`server.ts:31, 117, 170-172, 198-201`)
- the `Channel` shape, which today has one id (`types.ts:12-24`)
- the cross-provider duplicate check (`channels.ts:51-56`)
- the D015 sliver's key (`server.ts:114`)
- YouTube TV tune-time resolution: `youtubetv.ts:94, 103` use the cached `href`/`id`, and those are what rotate
- possibly `tvg-id` (`server.ts:104`), which the consumer sees; whether it moves is open

**What stays:**
- provider selection (`providers/index.ts:21-23`, `channel.provider`) and D018 tab selection (`cdp.ts`)
- the tune stages and the encoder
- everything in `capture.ts` downstream of `ensure()`, which only compares the id it is handed (`dirFor`, `touch`, ingest); whether that id is the stable key or the resolved provider id is a build choice
- Philo's broadcast resolution at tune time (`philo.ts:142-181`), which already does "channel → current programme id" per tune

---

## Step 5 — close tabs; owner tab ids

- **No tabs were created by this recon**, so there was nothing to close.
- **The owner's tab ids cannot be confirmed**: Chrome is not running. Last observed
  at the start of this pass: `D69065AF7DA903999FF8438B5A408CA8` (tv.youtube.com)
  and `B616E164D9BD487870AAD47CC19BD846` (www.philo.com).
- No tab was ever attached to, navigated or closed by this recon.

*(For the follow-up pass's tab and the owner's relaunched tabs, see "Step 2
(completed …)", item 4.)*

---

## Step 6 — sort

| item | sort | one reason |
|---|---|---|
| **A** — `/playlist/youtube-tv`, `/playlist/philo`, `/playlist` unchanged | **SWEEP** | the writer already loops `for (const provider of PROVIDERS)` and filters by `provider.id` (`server.ts:101-119`); a per-provider route runs that same loop over one provider |
| **B** — stream URLs on a stable per-channel identity, provider id resolved at tune time | **STANDALONE** | *(updated by step 2)* a YouTube TV candidate now exists: `epgRowRenderer.stationId`, unique on 150 of 151 guide rows in one snapshot. But it lives only in the guide API response (and the row element's JS `data`), not in anything the current enumerator reads (`youtubetv.ts:50-84`); it is absent on one ESPN row; and whether it survives a watch-id rotation is unobserved. The change also still runs through the router, cache shape, duplicate check, D015 sliver and YouTube TV tune resolution (step 4) |

### QUESTIONS

1. **D015** — "task-017 hardcoded `tvc-guide-stationid="32645"` on the single ESPN
   entry the owner tunes (`MrXg0chrojg`), read live from PrismCast's ESPN line."
   The sliver is keyed on a provider id, and ITEM B exists because such ids
   rotate. *(Updated by step 2:)* the guide now identifies which row that is.
   `MrXg0chrojg` is guide row 17, `stationId` `UCW7W_WAogi3qWDbO9PqOmZQ`,
   `isDiscreteStation` `false`: the one ESPN row whose watch id did not rotate at
   either observed point. The rows that did rotate (23–25) are the three
   `isDiscreteStation: true` rows. No Gracenote-style numeric station id was
   found in the guide response; the only `stationId` field carries `UC…`
   values. Does the sliver follow a stable key once ids are not the key, and does
   D015's PrismCast match apply to the discrete ESPN rows at all?
2. **D013** — "the playlist carries the full YouTube TV lineup as enumerated from
   the guide, unfiltered." The three rotated tiles are indistinguishable in the
   cache apart from id and position. If ITEM B cannot tell such tiles apart, any
   merge or dedupe of them would filter the lineup D013 says is unfiltered. Is
   that allowed, and what is "a channel" for duplicate-name feeds?
   *(Added by step 2:)* the guide today has **151 rows**, but 6 of them link to
   `browse/UC…` instead of `watch/…`, and the enumerator skips any tile without
   a `watch/` href (`youtubetv.ts:58-59`), so the playlist carries **145**.
   The skipped rows: ESPN (26), NBCSN Extra (30, 31, 32), Cartoon Network (46),
   WNBA on ION (133). Five of the six carry a `stationId`. Is omitting
   guide rows with no watch endpoint consistent with "unfiltered"?
3. **D006** — "an M3U playlist at `/playlist` listing channels, each pointing at an
   HLS stream served by Marlin Cast." ITEM A leaves `/playlist` unchanged and adds
   routes, so no conflict was found. ITEM B changes what "pointing at" is keyed
   on, and the per-channel stream URLs have been fixed since task-008 (task-012:
   "the per-channel stream URLs are all unchanged"). Recorded as a check, not a
   conflict.

---

## What I am least sure of

1. ~~Everything about YouTube TV identity beyond id/name/logo/href.~~ *(Updated
   by step 2:)* **Whether `stationId` is durable.** It is observed in one
   snapshot (2026-09-13 00:18–00:22Z): unique per row, stable between the two
   guide pages loaded seconds apart, and used by the preview-stream API. No
   stored `stationId` exists from 2026-09-11 or from the 17:39Z enumeration, so
   nothing shows it surviving a watch-id rotation. What `isDiscreteStation`
   means, and whether a discrete row keeps its `stationId` when its event
   changes, is unknown.
2. **Philo `channelId` durability beyond one day.** It is stable across
   programme boundaries within 2026-09-12. Across days, lineup changes and tier
   moves is not observed. The field-level quote is recon-philo's summary, not a
   fresh raw response.
3. **Why Chrome exited.** Kernel OOM and oomd are ruled out for the last 90
   minutes; the owner's ~51 GB process and an unclean exit are observed, not
   linked.
4. **The age of `/tmp/playlist-before.m3u`.** Its mtime is 2026-09-12 13:19. That
   it holds the 2026-09-11 18:25 enumeration comes from task-021's V1 record,
   not from this recon.
5. **Guide position as evidence.** The rotated ESPN ids kept slots 23–25, but an
   insertion at 29 shows positions shift. That is an observation, not a proposed
   key.

---

## Step 2 (completed 2026-09-12 20:22 EDT)

Follow-up pass, 20:17–20:22 EDT (2026-09-13 00:17–00:22Z). Read-only. No code.
No login/accounts page opened. The owner's tabs were never attached to,
navigated or closed.

### Preconditions

- `127.0.0.1:9333` answered at 20:17:17 EDT: `"Browser": "Chrome/153.0.8010.36"`,
  browser pid 211475 (up 1:09, relaunched by the owner).
- **`npm run login` was NOT run.** It selects each provider's tab by host
  (`src/login.ts:37`), attaches to it (`:43`), and `checkSignedIn` navigates
  that tab to the provider home URL (`:49`; `youtubetv.ts:29`, `philo.ts:265`).
  That would attach to and navigate the owner's tabs, which this pass forbids.
  The owner chose **option 3**: do the sign-in check inside the recon's own new
  tab on `https://tv.youtube.com/live` and skip the Philo check.
- Sign-in check result, same test as `youtubetv.ts:16` over the whole body text:

  ```
  {"href":"https://tv.youtube.com/live","title":"Live - YouTube TV","signInText":false}
  ```

  **Philo sign-in state: not checked** (owner's instruction).

### What was run

One tab via `Target.createTarget({url:"about:blank", newWindow:true})` →
`9024E39C67A59C1FC902BD1DA0D12446`. One main-frame navigation
(`tv.youtube.com /live`). The script waited until the
`ytu-endpoint.tenx-thumb[aria-label]` count was stable (151), then read DOM
attributes and one later in-page read of the row elements. Response bodies
were read with `Network.getResponseBody` as they finished. Nothing was
replayed, clicked or scrolled.

| body | type | path | bytes | station fields |
|---|---|---|---|---|
| r000 | Document | `/live` | 89,535 | none |
| r001 | Manifest | `/site/manifest/manifest.json` | 1,858 | none |
| r002 | Fetch | `/youtubei/v1/att/get` | 44,004 | none |
| r003 | XHR | `/youtubei/v1/browse` | 786 | none (tab list only) |
| **r004** | XHR | `/youtubei/v1/browse` | 2,454,260 | **151 guide rows**, window `beginTimeMs 1789257600000` → `endTimeMs 1789272378000` |
| r005 | XHR | `/youtubei/v1/browse` | 1,233,486 | continuation `1789272378000` → `1789280472000`; per-row `stationId` only |
| r006 | XHR | `/youtubei/v1/tenx_player` | 3,524 | `tenxStreams[N].channelId` ×4 |
| r007 | XHR | `/youtubei/v1/tenx_player` | 6,570 | `tenxStreams[N].channelId` ×8 |

Bodies stayed in the scratchpad; tracking params and response contexts are
not reproduced here.

**DOM ↔ response alignment.** The guide DOM has 151 `ytu-epg-row` elements and
r004 has 151 `…epgPaginationRenderer.contents[N].epgRowRenderer` entries. Tile
`aria-label` minus `watch ` equals
`contents[N].epgRowRenderer.station.epgStationRenderer.icon.accessibility.accessibilityData.label`
**on 151 of 151 rows by index**. The row element's JS `data` property carries
the same object (`Object.keys` =
`airings,navigationEndpoint,station,stationId,trackingParams` on 145 rows,
`airings,station,stationId,trackingParams` on 5, `airings,station,trackingParams`
on 1).

Below, `R` = `contents.epgRenderer.paginationRenderer.epgPaginationRenderer.contents[N].epgRowRenderer`
in r004.

### 2.1 — Every identifier per channel, with the ESPN (`MrXg0chrojg`, row 17) example

| # | identifier | byte-exact for ESPN row 17 | origin | observed across rows | looks like |
|---|---|---|---|---|---|
| 1 | watch video id | `MrXg0chrojg` | DOM `ytu-endpoint.tenx-thumb > a[href]` = `watch/MrXg0chrojg?vp=0gEEEgIwAQ%3D%3D`; response `R.navigationEndpoint.watchEndpoint.videoId` and `R.airings[0].epgAiringRenderer.navigationEndpoint.watchEndpoint.videoId` | 145 rows have one, all distinct; 6 rows have none | **per-feed, rotating** (see 2.3) |
| 2 | href `vp` | `0gEEEgIwAQ%3D%3D` | DOM `a[href]` query; response `R.airings[0].epgAiringRenderer.navigationEndpoint.watchEndpoint.params` = `0gEEEgIwAQ%3D%3D` | same value on every `watch/` tile (132 `vp` only + 13 `vpp&vp`) | not an identifier |
| 3 | href `vpp` | *(absent on row 17)*; row 25: `0gcJCRUA3bTjb5HI`; row 22 (ESPNews): `0gcJCRUA3bTjb5HI` | DOM `a[href]` query | 13 tiles today. The 17:39Z cache had one `vpp` value on 12 rows; `LwYqqxn4jOM` (ESPNU) carried it then and does not now | not a channel key (same value on different channels, comes and goes) |
| 4 | tile aria label | `watch ESPN` | DOM `ytu-endpoint.tenx-thumb[aria-label]` | 151 present; label `ESPN` on 5 rows, `NBCSN Extra` on 3, `MPT` on 2 | name, **not unique** |
| 5 | station icon label | `ESPN` | DOM row `a[href^="browse/"] > ytu-img[aria-label="ESPN"] > img[alt="ESPN"]`; response `R.station.epgStationRenderer.icon.accessibility.accessibilityData.label` = `ESPN` and `…secondaryIcon.accessibility.accessibilityData.label` = `ESPN` | same as #4 | name, **not unique** |
| 6 | tooltip | `Tennessee at Georgia Tech` | DOM row `ytu-epg-airing … div[title]`; tile itself has no `title` attribute | per programme (row 23: `Ohio State at Texas · Big Ten`) | **per-broadcast** |
| 7 | tile thumbnail (what the cache calls `logo`) | `{"thumbnails":[{"url":"//yt3.ggpht.com/W5JVNAAqtM--yYEg2j8JO4DkqyPtVkY-dvYigZD_xBQF3MjSWqez4VUfOBH7cdXOUoCDqNr2C4Y=ns-nd","width":3840,"height":2160}]}` | DOM `ytu-thumbnail[src]`; equals response `R.airings[0].epgAiringRenderer.thumbnail.thumbnails[0].url` | **equal to the current airing's thumbnail on 151 of 151 rows** | **per-broadcast** |
| 8 | station icon URL | `//yt3.ggpht.com/zQEsGs-Pl8rGEMxEAKrzuvnKYqIK_eG2Fw8As28gNgK7xOBlbtgFdwAHe9uGTimyCJd9_Q1nNfP35w=ns-nd` (400×400) | response `R.station.epgStationRenderer.icon.thumbnails[0].url` (DOM `img[src]` was still the 1×1 `data:` placeholder) | 151 present, 151 distinct | station artwork; durability unobserved |
| 9 | station secondary icon URL | `//yt3.ggpht.com/Gg_6PwoIVY_ztCtxj__EqLxQyZG2uYKPwcvDbiDwQmnaCEGkvFs1X5_ToZFDstxRDn6-JzAbVxSd=ns-nd` (400×400) | response `R.station.epgStationRenderer.secondaryIcon.thumbnails[0].url` | 151 present, 151 distinct | station artwork; durability unobserved |
| 10 | **stationId** | `UCW7W_WAogi3qWDbO9PqOmZQ` | response `R.stationId` and `R.station.epgStationRenderer.stationId` (equal on every row); r005 `continuationContents.epgPaginationRenderer.contents[N].epgRowRenderer.stationId`; DOM JS property `ytu-epg-row.data.stationId` (not an attribute) | **150 present, 150 distinct**; absent on row 26 only; r005 carries the identical 150 values in the identical order | **the only per-row, per-feed, non-programme identifier observed** |
| 11 | tenxId | `UCW7W_WAogi3qWDbO9PqOmZQ` | response `R.station.epgStationRenderer.tenxId` | 140 present, 140 distinct, **equal to `stationId` on 140 of 140** | same key as #10 where present |
| 12 | tenx_player `channelId` | *(ESPN not in these two responses)*; e.g. `UC6GmRNuKNw063eFfPKSjwrg` | response r006/r007 `tenxStreams[N].channelId` | all 12 values equal the `stationId`/`tenxId` of guide rows 0–7 (ABC 2, WBAL 11, WJZ 13, FOX 45, The CW Baltimore, MPT ×2, Telemundo) | the preview-stream API addresses rows by `stationId` |
| 13 | station browseId | `UCakwQ1jKQnYJcUMghvnp-Yw` | response `R.station.epgStationRenderer.navigationEndpoint.browseEndpoint.browseId`; DOM row `a[href="browse/UCakwQ1jKQnYJcUMghvnp-Yw"]` | 151 present, **130 distinct**; `UCakwQ1jKQnYJcUMghvnp-Yw` on **10 rows** (every ESPN-family row) | network/brand page, **not per-feed** |
| 14 | isDiscreteStation | `false` | response `R.station.epgStationRenderer.isDiscreteStation` | `true` on exactly 3 rows: 23, 24, 25 | a flag, not a key |
| 15 | station name / callSign | *(absent on ESPN)*; row 0: `ABC 2` / `ABC 2` | response `R.station.epgStationRenderer.name.runs[0].text`, `…callSign.runs[0].text` | present on 6 rows only (0, 1, 2, 3, 5, 6: local stations) | name, local rows only |
| 16 | airing videoId | `61rsb6SCBrs` | response `R.airings[0].epgAiringRenderer.videoId` | 150 present, 150 distinct in r004; r005 468 distinct | **per-broadcast** |
| 17 | airing times | `1789254302000` / `1789264800000` | response `R.airings[0].epgAiringRenderer.beginTimeMs` / `endTimeMs` | — | per-broadcast |

**Not present:** no `data-*` attribute anywhere. The census over all 151 tiles,
their descendants and 8 ancestor levels found only `class`/`aria-label` on the
tile, and structural attributes on the rest. No tile `title` tooltip. Under key
names matching `station|channel|network|browseId`, r004 has only the paths
above: no Gracenote-style numeric station id, no network id field.

### 2.2 — The tiles named "ESPN"

Five guide rows are labelled `ESPN` today (one more than the cache's four,
because row 26 has no watch endpoint and the enumerator skips it). All five share
tile aria label `watch ESPN`, station icon labels `ESPN`/`ESPN`, and browseId
`UCakwQ1jKQnYJcUMghvnp-Yw` (also shared with ESPN2 row 18, ESPNU 21, ESPNews 22).
What differs, byte-exact:

| guide row | watch id (tile `a[href]`) | `R.stationId` | `tenxId` | `isDiscreteStation` | station icon URL (`…icon.thumbnails[0].url`) | tooltip (`div[title]`) | airing videoId |
|---|---|---|---|---|---|---|---|
| 17 | `watch/MrXg0chrojg?vp=0gEEEgIwAQ%3D%3D` | `UCW7W_WAogi3qWDbO9PqOmZQ` | `UCW7W_WAogi3qWDbO9PqOmZQ` | `false` | `//yt3.ggpht.com/zQEsGs-Pl8rGEMxEAKrzuvnKYqIK_eG2Fw8As28gNgK7xOBlbtgFdwAHe9uGTimyCJd9_Q1nNfP35w=ns-nd` | `Tennessee at Georgia Tech` | `61rsb6SCBrs` |
| 23 | `watch/1oayVaJRVjQ?vp=0gEEEgIwAQ%3D%3D` | `UCeQPSwZWpyy-hv5ilkHLQDA` | `UCeQPSwZWpyy-hv5ilkHLQDA` | `true` | `//yt3.ggpht.com/DTVfz2ZNFL9Rrv52V2k223rxlsyL2gikAkYJrnDTS5zZZtfxjGkYv7Wz9r-18LRqJOMLs8Wt7zYXGg=ns-nd` | `Ohio State at Texas · Big Ten` | `_rfNHpN2ai4` |
| 24 | `watch/zYW9jZ58KJg?vp=0gEEEgIwAQ%3D%3D` | `UCuVFZEpGlcrfG3BiZ6XJo8g` | `UCuVFZEpGlcrfG3BiZ6XJo8g` | `true` | `//yt3.ggpht.com/k3iTShQsnlMQYJ-yg3xSUfvz_nxohhO1ipsXJ_PRIbFeS-AoSjLkvyJIwo6IR8l_v0xfcwIccJc9=ns-nd` | `(1) Sun vs. (5) Pushkareva (Girls' Final) · U.S. Open (Tennis)` | `hQh2r4Y3uTU` |
| 25 | `watch/FMOpHKcYYos?vpp=0gcJCRUA3bTjb5HI&vp=0gEEEgIwAQ%3D%3D` | `UCaGNTzawhkMIUtu5_OKM-ng` | `UCaGNTzawhkMIUtu5_OKM-ng` | `true` | `//yt3.ggpht.com/oIvO4UReRRYup3INobjJtOQX77XsC5Zj9Z2sm3e0oUI_LAWz1ycWUJQNkeEcC6olw0_SrBobgMNB=ns-nd` | `(1) Vink vs. (2) Schroder (WC Quad Final) · ATP World Tour` | `Ha92ADJP70Q` |
| 26 | **none**: `browse/UCakwQ1jKQnYJcUMghvnp-Yw` | **absent** | **absent** | `false` | `//yt3.ggpht.com/IObmHDe9dIQNubotknXlDp-QteXRuMVJCOGy2sgx9TvlVv_A5I9FUE99egq6hkLPwjqMj2zUAu3y=ns-nd` | `Watch live sports, studio shows and originals on ESPN` | absent |

Secondary icon URLs (`…secondaryIcon.thumbnails[0].url`), also all distinct:
row 17 `//yt3.ggpht.com/Gg_6PwoIVY_ztCtxj__EqLxQyZG2uYKPwcvDbiDwQmnaCEGkvFs1X5_ToZFDstxRDn6-JzAbVxSd=ns-nd`,
23 `//yt3.ggpht.com/GyrBLyZnYxv3Btj3N0nd6goB3tsPMJPFY8EAhpwj0fnMzQn356Nj7CXyQuocv_D9lNw8vV3Rgdlg=ns-nd`,
24 `//yt3.ggpht.com/yCksgT9ySpXWb77ru5KJJAjJeAt00xtDhGwJFRq2LvIgkY9VURyai3o0LoSd9f_ZoHNYr0-SQDplSA=ns-nd`,
25 `//yt3.ggpht.com/1qbCl9Mp4I_edBuqA7ZxeErJs3XjVx5QJR6cvJGMdbhsgXlOeUMXg4x0uErV6ofRt79rCaM2RJKQYQ=ns-nd`,
26 `//yt3.ggpht.com/2i2FryIuZdcxdxGR-AUlJPmEmhJa-A7Ea2JY5tGKP72CINzvCJoVDkWrCQHwMCwZFyw18TaLru5i=ns-nd`.

**Distinguishes the ESPN rows:** watch id, `stationId`/`tenxId`, both station
icon URLs, `isDiscreteStation` (17 vs 23–25), guide position, and the
per-programme tooltip and airing id. **Does not:** tile aria label, station icon
label, browseId, `vp`.

### 2.3 — Candidates against the rotation evidence

**Watch ids rotated a second time within hours.** Guide rows 23–25 carried
`gaT2Q_KZxns`/`arlkwb9_uTw`/`n33BiPboLfo` on 2026-09-11 (step 1),
`I1jTpQKv5A0`/`X0hj-8OlGFM`/`D-Trg1a_m8k` at the 17:39:07Z enumeration, and
`1oayVaJRVjQ`/`zYW9jZ58KJg`/`FMOpHKcYYos` at 00:18Z. `MrXg0chrojg` (row 17) was
unchanged at all three points. Other changes since 17:39Z:
- **removed:** `YaSBNQ7a4Xk` NBCSN Extra (rows 30–32 are now browse-only, each with a `stationId` and no watch endpoint), `YI2hv-GLxLM` Cartoon Network (row 46 is now browse-only, `stationId` `UCCYrcqAHdnJzkes2xe_X4Yw`)
- **added:** `gIrMz5aZxrA` BTN Overflow 1 (row 35, `stationId` `UCaPEm-6YWqZTubSGqZaL8lg`), `AJzVH1-soM0` Adult Swim (row 47, `stationId` `UC1dcLpSDzqDZwj2zldGBO1A`)

| candidate | could it have stayed constant across the 2026-09-11→12 ESPN rotation? |
|---|---|
| watch video id | **No**: it is the thing that rotated, twice |
| tile thumbnail / cached `logo` | **No**: it equals the current airing's thumbnail (151/151), so it changes with the programme. This matches step 1's 138-of-141 logo changes and the shared logos between two ESPN feeds showing the same event (inference) |
| tooltip, airing videoId, airing times | **No**: per programme by construction |
| aria label / station icon label | **Yes, it stayed `ESPN`**, but five rows share it, so it cannot tell the rotated rows apart |
| browseId | Possibly constant, but shared by 10 rows, so it cannot tell them apart either |
| `vp` / `vpp` | `vp` is identical on every row; `vpp` is not per-channel |
| **`stationId` / `tenxId`** | **Cannot be determined.** Neither `/tmp/playlist-before.m3u` nor `data/channels.json` stored it, so there is no earlier value to compare |
| station icon URLs | **Cannot be determined**, for the same reason (the cached `logo` was the airing thumbnail, not these) |

**What one snapshot does show:** `stationId` is present on 150 of 151 rows, is
distinct per row (including the five ESPN rows), is a separate field from both
the watch id and the airing id, repeats identically in the continuation page
(r005), and is the id the page's own preview-stream API uses
(`tenxStreams[N].channelId`). The three rows whose watch ids rotated at both
observed points are exactly the three `isDiscreteStation: true` rows.

**What it cannot show:**
- whether a given `stationId` stays with the same feed across days or across a watch-id rotation (no second observation exists)
- whether a discrete row gets a new `stationId` when its event changes
- what `isDiscreteStation` means
- whether the browse-only rows (26, 30–32, 46, 133) are ever tunable
- whether the station icon URLs are durable

A second guide read that spans a watch-id rotation is what would settle
durability. It was not taken; this pass was one snapshot.

### 4 — Close; owner tab ids

`Target.closeTarget(9024E39C67A59C1FC902BD1DA0D12446)` → `{"success":true}` at
~20:22 EDT. Target list with `filter:[{}]`:

| target id | type | host | before the recon tab | after close |
|---|---|---|---|---|
| `2ECEBF96E5AFE582C2D58E386A6D3DBA` | page | tv.youtube.com | present | **present** |
| `76E9F816D85770921EF954D0ED6767D3` | page | www.philo.com | present | **present** |
| `F5028ABB25EB0F50911BBA98361F0BF3` | tab | tv.youtube.com | present | **present** |
| `3EA51E9C5BDA6E0CF3139A041DBF3BE1` | tab | www.philo.com | present | **present** |
| `FE349EBEBC17022D8B2D4D02A4B0563F` | service_worker | tv.youtube.com | present | **present** |
| `8638BE4E9C1CAD11EFAFE34F4C6D2499`, `4B608EF4F6D91894628BCF5235B4DADC` | browser_ui | omnibox popup | present | **present** |
| `9024E39C67A59C1FC902BD1DA0D12446` / `BE37A7133CF34A66F61E05503C625603` | page / tab | tv.youtube.com (recon) | — | gone |
| `9EAB7F254BE160AC9ED45632B2491D71`, `A265E085062D454A8D75DCE2D67992F1` | browser_ui | omnibox popup (recon window) | — | gone |

**The owner's tab target ids are unchanged.**

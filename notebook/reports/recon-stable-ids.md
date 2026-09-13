# Recon — stable per-channel ids and per-provider playlists (read-only)

Date: 2026-09-12, ~19:45–20:05 EDT, marlinpc. No code written; `src/`, `scripts/` and
`extension/` untouched. Nothing on 192.168.1.250 contacted. No login/accounts page
opened. No credentials, cookies, tokens, session ids or account identifiers below.

**Result: STOPPED on failure at step 2.** The owner's Chrome exited while this
recon was running, before the step-2 tab was created. Steps 2 and 3 could not
look at a live page. Steps 1 and 4 are complete. Step 3 is answered from recorded
and on-disk evidence only. **Chrome was not relaunched** (D009: the owner's step).

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

---

## Step 6 — sort

| item | sort | one reason |
|---|---|---|
| **A** — `/playlist/youtube-tv`, `/playlist/philo`, `/playlist` unchanged | **SWEEP** | the writer already loops `for (const provider of PROVIDERS)` and filters by `provider.id` (`server.ts:101-119`); a per-provider route runs that same loop over one provider |
| **B** — stream URLs on a stable per-channel identity, provider id resolved at tune time | **STANDALONE** | for YouTube TV no stable per-channel identifier has been observed (step 2 not run): the name is not unique (four `ESPN`), the logo URL rotates (138 of 141) and is not unique; and the change runs through the router, cache shape, duplicate check, D015 sliver and YouTube TV tune resolution (step 4) |

### QUESTIONS

1. **D015** — "task-017 hardcoded `tvc-guide-stationid="32645"` on the single ESPN
   entry the owner tunes (`MrXg0chrojg`), read live from PrismCast's ESPN line."
   The sliver is keyed on a provider id, and ITEM B exists because such ids
   rotate. Three of the four "ESPN" ids have already rotated once, and today
   `MrXg0chrojg` shares a byte-identical logo with `I1jTpQKv5A0`. Which ESPN the
   sliver means once ids are not the key is unanswered by anything observed.
2. **D013** — "the playlist carries the full YouTube TV lineup as enumerated from
   the guide, unfiltered." The three rotated tiles are indistinguishable in the
   cache apart from id and position. If ITEM B cannot tell such tiles apart, any
   merge or dedupe of them would filter the lineup D013 says is unfiltered. Is
   that allowed, and what is "a channel" for duplicate-name feeds?
3. **D006** — "an M3U playlist at `/playlist` listing channels, each pointing at an
   HLS stream served by Marlin Cast." ITEM A leaves `/playlist` unchanged and adds
   routes, so no conflict was found. ITEM B changes what "pointing at" is keyed
   on, and the per-channel stream URLs have been fixed since task-008 (task-012:
   "the per-channel stream URLs are all unchanged"). Recorded as a check, not a
   conflict.

---

## What I am least sure of

1. **Everything about YouTube TV identity beyond id/name/logo/href.** Step 2 did
   not run. A durable channel key may well exist in the DOM or guide API. This
   report neither shows nor rules that out.
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

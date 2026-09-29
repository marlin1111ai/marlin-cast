# Task 032 — tvc-guide-stationid on every line with a credible station (D035)

Date: 2026-09-29, 09:11–09:20 and 09:38–10:15 EDT (13:11–14:15Z). Host: marlinpc. Code read at
`13071d7`; the change is on top of it. Nothing on 192.168.1.250 or
192.168.1.30 was contacted. No owner Chrome was running on marlinpc (0 chrome
processes, nothing on 8091/8092/8804/9333 before the run). `data/chrome-profile`
was not read. `backups/` was read once with `tar -xzf` and hashed. Nothing
under `extension/`, `docker/`, `scripts/`, `Dockerfile`, `src/capture.ts` or
`src/providers/` was changed. A container named `elated_ganguly` that is not
part of this work was running on marlinpc and was left alone.

No credential appears in this report. The Schedules Direct username and
password were read from the owner's env file by a script that prints neither;
the token was held in memory only and written nowhere. `VNC_PASSWORD` was a
throwaway passed by `--env-file` from a 0600 scratch file.

**Owner's calls carried out:** every Marlin Cast playlist line carries
`tvc-guide-stationid="<Schedules Direct station id>"` where a credible station
exists (Marlin DVR decision 4a); the ids come from a table in this repo built
from the owner's Schedules Direct lineups (1a). Recorded as D035.

**Result: done and verified.** 208 of 375 lines carry the tag.

| | channels | tagged | untagged | by exact name | by callsign | hand-paired |
|---|---|---|---|---|---|---|
| YouTube TV, against `USA-YTBE512-X` | 141 | **127** | 14 | 28 | 5 | 94 |
| Philo, against `USA-PHILO-X` | 234 | **81** | 153 | 19 | 0 | 62 |
| **Total** | 375 | **208** | 167 | 47 | 5 | 156 |

The 208 lines name 179 distinct stations: 29 stations are carried by one
channel of each provider. No station is used twice inside one provider.

This pass ran in two parts. The first stopped at step 3 because the env file
did not exist; steps 0–2 were done then. The owner then supplied the file and
four rulings (below), and the pass resumed at step 3.

---

## Result per step

| Step | Result |
|---|---|
| 0 fetch, clean tree | passed — `HEAD` = `origin/main` = `13071d7`; on the resume the only change in the tree was step 1's edit |
| 1 D033, D034, D026 note | done — appended to `notebook/DECISIONS.md` |
| 2 recon | done, read-only — below |
| 3 lineups | done — one token request, two lineup reads, nothing written to the account |
| 4 channel list | done — both providers signed in; first boot enumerated 375 (YouTube TV 141, Philo 234) |
| 5 table | done — `src/stations.json`, 208 entries |
| 6 playlist writer | done — `src/server.ts` |
| 7 D035 | done |
| verify | passed on every point — below |
| 8 this report, SESSION-STATE | written |
| 9 commit, push, GHCR | after this report is written; SHAs and the GHCR tag are in the hand-off and `git log` |
| 10 second commit | after step 9 |
| 11 clean-up | after step 10; its evidence is in the hand-off |

## Files touched, mapped to steps

| File | Step | Change |
|---|---|---|
| `notebook/DECISIONS.md` | 1, 7 | D033, D034, the note under D026; D035 |
| `src/stations.json` | 5 | new — the table: key → `stationId`, `basis` |
| `src/server.ts` | 6 | the ESPN constant replaced by the table's loader; one attribute line (+15 −6) |
| `notebook/reports/task-032.md` | 8 | this report |
| `notebook/SESSION-STATE.md` | 8, 10 | entry appended; "Where things stand" corrected in the second commit |
| `MARLIN-CAST-BRIEF.md` | 10 | the statements about GHCR `latest`, in the second commit |

Nothing else in the repo. The `Dockerfile` was not changed.

## The owner's rulings on the resume (2026-09-29)

1. A Marlin Cast name matched against a Schedules Direct callsign counts as a
   callsign pair (the owner's example: "WBAL 11" and WBAL-DT).
2. If `USA-YTBE512-X`'s WBAL station id differs from 21231, pair with the
   `USA-YTBE512-X` id and report both.
3. The table holds only the D020 key, the station id and the basis type.
   Schedules Direct names and callsigns appear only in this report: the ten
   verify pairs and each hand pair's reason.
4. The env file holds `SD_USERNAME` and `SD_PASSWORD`.

**WBAL (ruling 2):** `USA-YTBE512-X` holds WBAL's station as **21231**, the
same id as the pick the owner made in Marlin DVR from the antenna lineup
(21231, marlin-dvr pass 155 §4 iv). The two do not differ.

---

## Step 2 — recon

### (a) The playlist writer and the D015 ESPN line

Line numbers at `13071d7`, before the change.

| file:line | what it does |
|---|---|
| `src/server.ts:110-130` | `playlist(req, providers)`, the only writer. Providers in registry order, each channel in enumeration order; attributes `tvg-id`, `tvg-name`, `tvg-logo`, `group-title`, then the station id |
| `src/server.ts:132-134` | `/playlist` — every provider |
| `src/server.ts:137-141` | `/playlist/:slug` — the same writer over one provider (D021) |
| `src/server.ts:104-108` | `ESPN_SLIVER_KEY`, the one hardcoded key |
| `src/server.ts:123` | the one place the tag is produced: the last attribute, after `group-title` |

No other file names `32645`, `tvc-guide-stationid` or the ESPN key.

### (b) What each provider's enumeration has per channel

| | kept in the channel cache | in the provider's answer, not kept |
|---|---|---|
| YouTube TV (`src/providers/youtubetv.ts:161-184`) | `key` (stationId), `id` (watch id), `name` (the tile's label), `logo` (the current programme's thumbnail), `href`, `discrete`, `position` | station name and `callSign` on the local rows only (6 rows on 2026-09-12); station icon URLs; the brand `browseId` (shared by a network's rows); `tenxId` (equal to stationId) — `recon-stable-ids.md` §2.1 |
| Philo (`src/providers/philo.ts:276-317`) | `key` = `id` (channelId), `name` (displayName), `logo`, `tileGroupId` | the tier (counted, not stored); `isFavorite`; a preview clip URL that carries a feed slug — `recon-philo.md` |

Neither provider carries a Gracenote-style numeric id, an affiliate or, for
any channel in the cache, a callsign. **The name is the only field in the
cache a join can use.**

### (c) Where a file must live to be in the image

The `Dockerfile` copies `src`, `extension` and `assets` whole
(`COPY src ./src` and the two beside it). `.dockerignore` leaves all three in.
A file under `src/` is in the image with no change to the `Dockerfile`, so the
table is `src/stations.json`. Checked in the built image:
`/app/src/stations.json`, 18,234 bytes, 208 entries.

### (d) Marlin DVR pass 155

Read from a shallow clone in the scratchpad, at `c85fd14`.

- 69 of 367 joined with no hand work: 1 by station id (the ESPN line), 57 by
  exact name, 11 by normalised name. 298 had no listing (YouTube TV 107,
  Philo 191).
- "AMC" joined "AMC+" on both providers, which the report calls wrong.
  "Cheddar" was ambiguous between two stations.
- That join matched every channel against every lineup on the account,
  the antenna lineup included. This pass pairs each provider against its own
  lineup only, as the brief says.
- That playlist had 367 channels (Philo 226). This pass's channel list has
  375 (Philo 234).

---

## Step 3 — the lineups

One `POST /token` (HTTP 200, code 0), then one `GET /lineups/<id>` for each
lineup. No other request was made. The account's lineups and settings were
not changed: no `PUT`, no `DELETE`.

| lineup | modified | station entries | distinct station ids |
|---|---|---|---|
| `USA-YTBE512-X` | 2026-09-24T07:16:11Z | 401 | 393 |
| `USA-PHILO-X` | 2026-09-23T21:00:41Z | 109 | 109 |

Eight stations are listed twice in `USA-YTBE512-X`; none of them is paired.
Marlin DVR's pass 155 reported 346 stations for that lineup; the difference
was not looked into. For every station only `stationID`, `name` and
`callsign` were kept, in the scratchpad.

## Step 4 — the channel list

```
docker pull <registry>/marlin-cast:sha-13071d7
  Digest: sha256:47c96f4467b955c6bac49defa5cf8f93b9364054b21d3aca9576e1e0b62e01eb

backups/chrome-profile-2providers-20260913-0746.tgz
  sha256 before: 6ebd9ea976118bcb8c24e10b590680e5d44e405d1b3a9f7f09a0a3982258dbe3
tar -xzf … -C <scratchpad>/data      -> data/chrome-profile, 54,857 entries, 1.7G

docker run -d --name marlin-cast-t032a --cap-add SYS_ADMIN --shm-size=1g \
  -p 8091:8804 -p 8092:6080 -v <scratchpad>/data:/data \
  --env-file <scratchpad>/run.env -e PUID=99 -e PGID=100 \
  <registry>/marlin-cast:sha-13071d7
```

Started 13:40:15Z. **Both providers signed in:**

```
[login] youtubetv: tv.youtube.com: signed in
[login] philo: www.philo.com: signed in (https://www.philo.com/player/mytv)
[entrypoint] stage 5: every provider signed in
[entrypoint] stage 6: no /data/channels.json — first boot, enumerating the lineup
[channels] [youtubetv] guide rows 144, tiles 142, channels 141, skipped 3
[channels] [philo] 234 channels, totalCount 234, tiers {"Favorite channels":2,"All channels":74,"Free channels":158}
[channels] enumerated 375 channels at 2026-09-29T13:40:36.619Z
[channels]   skipped guide rows (3):
[channels]       row 23  ESPN  — isDiscreteStation (event feed)
[channels]       row 24  ESPN  — no stationId, no watch link
[channels]       row 42  Adult Swim  — no watch link
[entrypoint] stage 7 ready: app on 0.0.0.0:8804 (pid 502); channels: 375 state: idle
```

375 keys, all distinct. One name is on two channels: MPT, twice in YouTube TV.
HEAD's three playlists and the channel cache were saved to the scratchpad from
this container: `/playlist` 751 lines, 375 entries, 1 tagged;
`/playlist/youtube-tv` 283, 141, 1; `/playlist/philo` 469, 234, 0.

---

## Step 5 — the pairing

### Method

Each channel is tried against its own provider's lineup, in this order, and
takes the first that applies:

1. **`name`** — a station whose name is the channel's name, character for
   character. A difference in case, spacing or punctuation is not an exact
   name; those are hand pairs.
2. **`callsign`** — the channel's name matched against a station's callsign
   (ruling 1): the name is the callsign, compared without case; or the name
   is call letters and a channel number, and the station's callsign is those
   letters followed by `DT`.
3. **`hand`** — paired by reading both lists, each with a one-line reason.
4. **No entry** — no station of that name or network in the lineup, or more
   than one station fits and nothing tells them apart.

Rules applied to the hand pairs:

- **East, not Pacific.** Where the lineup lists a network's East and Pacific
  feeds, the East one is taken: the owner's YouTube TV lineup is Baltimore's.
- **The main feed.** Not the 4K, overflow, alternate or Spanish-language
  station of the same network.
- **Never across lineups.** Eight Philo channels have their exact name in
  `USA-YTBE512-X` and no station in `USA-PHILO-X`. They carry no tag (open
  question 1).
- **A name on two channels is not paired by name.** MPT is on two channels;
  both are left out.
- **The pairs were made on names.** No picture and no schedule was compared.

Six names are on both providers and take a different station on each, because
each lineup lists that network under its own station id: AMC, BBC America,
BBC News, Hallmark Channel, Hallmark Mystery, IFC. 25 names are on both
providers and take the same station.

### ESPN

`UCW7W_WAogi3qWDbO9PqOmZQ` → `32645`, kept. `32645` is in `USA-YTBE512-X`.
Basis `hand`.

### Pairs by exact name (47)

The station's name is the channel's name; the number is the station id.

**YouTube TV (28):** YouTube TV Zen 171005; ACC Network 111871; NBC Sports Network 194412; NFL Network 34710; CHARGE! 102148; Pickleball TV 146769; The Nest 147367; Stories by AMC 115539; AMC Thrillers 115678; Portlandia 122435; FOX SOUL 119212; Hallmark Channel 11221; Hallmark Family 105723; Hallmark Mystery 61522; MTV Classic 22561; NewsNation 91096; Court TV 111043; Tastemade 107076; ABC News Live 113380; Cheddar 101103; FOX Weather 121307; LiveNOW from FOX 119219; Local Now 99988; Scripps News 96827; NBC News NOW 114174; World at War 165997; TUDN 77033; The Walking Dead Universe 115540

**Philo (19):** AXS TV 28506; Great 82563; Hallmark Family 105723; MTV Classic 22561; Tastemade 107076; WEST 193653; 48 Hours 160400; 50 Cent Action 178243; CBS News 24/7 104846; Confess by Nosey 151953; Designated Survivor 191641; Lawless 170347; Love Thy Neighbor 177498; People Are Awesome 122524; The Pet Collective 121165; Revry 113603; Ryan and Friends 118462; The Shade Room 211754; Weeds/Nurse Jackie 177501

### Pairs by callsign (5)

All YouTube TV.

| Marlin Cast name | station id | how |
|---|---|---|
| WBAL 11 | 21231 | call letters, then `DT` |
| WJZ 13 | 21232 | call letters, then `DT` |
| T2 | 137752 | the name is the callsign |
| Dabl | 112157 | the name is the callsign, without case |
| ION | 18633 | the name is the callsign |

### Hand pairs — YouTube TV against USA-YTBE512-X (94)

| Marlin Cast name | station id | Schedules Direct station | reason |
|---|---|---|---|
| ABC 2 | 21230 | WMAR-DT (`WMARDT`) | WMAR is Baltimore's ABC affiliate on channel 2 |
| FOX 45 | 21233 | WBFF-DT (`WBFFDT`) | WBFF is Baltimore's FOX affiliate on channel 45 |
| The CW Baltimore | 34522 | WNUV-DT (`WNUVDT`) | WNUV is Baltimore's CW affiliate; the lineup's national CW stations (CW TV, CW Plus East) are not Baltimore's |
| Telemundo | 77606 | Telemundo Satellite Feed (`TELESAT`) | the only Telemundo station in the lineup |
| Univision | 68049 | Univision Network HD (`UNIHD`) | same network; East feed; the lineup also lists a Pacific feed |
| UniMas | 73882 | UniMas East HD (`UNIMHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Comet TV | 97051 | Comet (`COMET`) | same network; East feed; the lineup also lists a Pacific feed |
| QVC | 60222 | QVC HD (`QVCHD`) | same network, HD feed |
| HSN | 62077 | HSN HD (`HSNHD`) | same network, HD feed |
| MyTV Baltimore | 50339 | WBFF-DT2 (`WBFFDT2`) | MyTV Baltimore is WBFF's second subchannel, 45.2 |
| TBS | 58515 | TBS HD (`TBSHD`) | same network; East feed; the lineup also lists a Pacific feed |
| TNT | 42642 | TNT HD (`TNTHD`) | same network; East feed; the lineup also lists a Pacific feed |
| ESPN | 32645 | ESPN HD (`ESPNHD`) | kept from D015; Marlin DVR 1.12.0 joined this line to this station (pass 155) |
| ESPN2 | 45507 | ESPN2 HD (`ESPN2HD`) | same network, HD feed |
| SEC Network | 89714 | SEC Network HD (`SECH`) | same network, HD feed |
| ESPNU | 60696 | ESPNU HD (`ESPNUHD`) | same network, HD feed |
| ESPNews | 59976 | ESPNEWS HD (`ESPNWHD`) | same network, HD feed; name differs in case |
| FS1 | 82547 | FS1 HD (`FS1HD`) | same network, HD feed |
| FS2 | 59305 | FS2 HD (`FS2HD`) | same network, HD feed |
| NBA TV | 45526 | NBA TV HD (`NBATVHD`) | same network, HD feed; the lineup's other NBA TV station is the 4K one |
| BTN | 58321 | Big Ten Network HD (`BIG10HD`) | BTN is the Big Ten Network; the main feed, not the overflow feeds |
| CBS Sports Network | 59250 | CBS Sports Network HD (`CBSSNHD`) | same network, HD feed |
| ROAR | 102116 | ROAR TV (`ROARTV`) | same network |
| Golf Channel | 99380 | The Golf Channel Stream (`GOLFSTR`) | same network; the only Golf Channel station in the lineup |
| Disney Channel | 59684 | Disney Channel HD (`DISNHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Disney Junior | 74885 | Disney Junior HD (`DJCHHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Disney XD | 60006 | Disney XD HD (`DXDHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Cartoon Network | 60048 | Cartoon Network HD (`TOONHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Nickelodeon | 59432 | Nickelodeon HD (`NIKHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Nick Jr. | 82649 | Nick Jr HD (`NICJRHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Nicktoons | 82654 | Nicktoons HD (`NIKTNHD`) | same network; East feed; the lineup also lists a Pacific feed |
| TeenNick | 97047 | Teen Nick HD (`TNCKHD`) | same network; East feed; the lineup also lists a Pacific feed |
| AMC | 59337 | AMC HD (`AMCHD`) | same network, HD feed; not AMC+, which Marlin DVR's name join took (pass 155) |
| BBC America | 64492 | BBC America HD (`BBCAHD`) | same network, HD feed |
| BET | 63236 | BET HD (`BETHD`) | same network; East feed; the lineup also lists a Pacific feed |
| BET Her | 63220 | BET Her HD (`BHERHD`) | same network; East feed; the lineup also lists a Pacific feed |
| CMT | 59440 | CMT HD (`CMTVHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Comedy Central | 62420 | Comedy Central HD (`CCHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Comedy.TV | 82470 | Comedy.TV HD (`CMDTVHD`) | same network, HD feed |
| Freeform | 59615 | Freeform HD (`FREFMHD`) | same network; East feed; the lineup also lists a Pacific feed |
| FX | 58574 | FX HD (`FXHD`) | same network; East feed; the lineup also lists a Pacific feed |
| FXX | 66379 | FXX HD (`FXXHD`) | same network; East feed; the lineup also lists a Pacific feed |
| FXM | 70253 | FX Movie Channel HD (`FXMHD`) | FXM is the FX Movie Channel |
| IFC | 59444 | IFC HD (`IFCHD`) | same network, HD feed |
| MTV | 60964 | MTV - Music Television HD (`MTVHD`) | same network; East feed; the lineup also lists a Pacific feed |
| MTV2 | 75077 | MTV2: Music Television HD (`MTV2HD`) | same network; East feed; the lineup also lists a Pacific feed |
| VH1 | 60046 | VH1 HD (`VH1HD`) | same network; East feed; the lineup also lists a Pacific feed |
| Paramount | 59186 | Paramount Network HD (`PARHD`) | YouTube TV's Paramount is the Paramount Network; East feed; the lineup also lists a Pacific feed |
| Pop | 68796 | POP HD (`POPHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Turner Classic Movies | 64312 | Turner Classic Movies HD (`TCMHD`) | same network, HD feed |
| truTV | 64490 | truTV HD (`TRUTVHD`) | same network; East feed; the lineup also lists a Pacific feed |
| USA | 103838 | USA Network HD Stream (`USAHDST`) | same network; East feed, the lineup's others are the Pacific and 4K ones |
| Nat Geo | 49438 | National Geographic HD (`NGCHD`) | Nat Geo is National Geographic; East feed; the lineup also lists a Pacific feed |
| Nat Geo Wild | 67331 | National Geographic Wild HD (`NGWIHD`) | Nat Geo Wild is National Geographic Wild |
| Animal Planet | 57394 | Animal Planet HD (`APLHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Discovery Channel | 56905 | Discovery Channel HD (`DSCHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Smithsonian Channel | 58532 | Smithsonian HD Network (`SMTHHD`) | same network; East feed; the lineup also lists a Pacific feed |
| SYFY | 101410 | Syfy Stream (`SYFYSTR`) | same network; East feed; the lineup also lists a Pacific feed |
| Travel Channel | 59303 | The Travel Channel HD (`TRAVHD`) | same network; East feed; the lineup also lists a Pacific feed |
| TV Land | 73541 | TV Land HD (`TVLNDHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Bravo | 99936 | Bravo Stream (`BRAVSTR`) | same network; East feed; the lineup also lists a Pacific feed |
| E! | 95601 | E! Entertainment Television Stream (`ESTR`) | same network; East feed; the lineup also lists a Pacific feed |
| Food Network | 50747 | Food Network HD (`FOODHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Magnolia Network | 67375 | Magnolia Network HD (`MAGNHD`) | same network; East feed; the lineup also lists a Pacific feed |
| HGTV | 49788 | Home & Garden Television HD (`HGTVD`) | HGTV is Home & Garden Television; East feed; the lineup also lists a Pacific feed |
| JusticeCentral.TV | 78850 | Justice Central HD (`JUST`) | same network |
| ID | 65342 | Investigation Discovery HD (`IDHD`) | ID is Investigation Discovery; East feed; the lineup also lists a Pacific feed |
| Discovery Turbo | 31046 | DISCOVERY TURBO HD (`MTHD`) | same network; East feed, the lineup's other is the West Coast one |
| OWN | 70388 | Oprah Winfrey Network HD (`OWNHD`) | OWN is the Oprah Winfrey Network; East feed; the lineup also lists a Pacific feed |
| True CRMZ | 114278 | TRUE CRMZ (`CRMES`) | same name, differs only in case |
| Oxygen True Crime | 99381 | Oxygen True Crime Stream (`OXYGSTR`) | same network; East feed; the lineup also lists a Pacific feed |
| Recipe.TV | 81289 | Recipe TV HD (`RECIPEH`) | same network |
| TLC | 57391 | TLC HD (US) (`TLCHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Game Show Network | 68827 | Game Show Network HD (`GSNHD`) | same network, HD feed |
| WE tv | 59296 | WE tv HD (`WEHD`) | same network, HD feed |
| All Reality We TV | 115679 | All Reality WE tv (`WEREAL`) | same name, differs only in case |
| BBC News | 105725 | BBC News Europe Stream (US) (`BBCNEUST`) | the only BBC News station in the lineup |
| CNN | 58646 | CNN HD (`CNNHD`) | same network, HD feed; not CNN en Espanol or CNN Max |
| C-SPAN | 10161 | CSPAN (`CSPAN`) | same network; name differs by the hyphen |
| C-SPAN2 | 68334 | CSPAN2 HD (`CSPN2HD`) | same network |
| C-SPAN3 | 68332 | CSPAN3 HD (`CSPN3HD`) | same network |
| FOX Business | 58718 | Fox Business HD (`FBNHD`) | same network, HD feed |
| FOX News | 60179 | Fox News Channel HD (`FNCHD`) | same network, HD feed |
| HLN | 64549 | HLN HD (`HLNHD`) | same network, HD feed |
| Localish | 70938 | LOCALISH EASTERN (`LCLSESD`) | same network; the only Localish station in the lineup |
| MS NOW | 99954 | MS NOW Streaming (`MSNOWSTR`) | same network; the only MS NOW station in the lineup |
| NEWSMAX | 87925 | Newsmax TV (`NEWSMX`) | same network |
| The Weather Channel | 58812 | The Weather Channel HD (`WEATHHD`) | same network, HD feed |
| TYT Network | 107478 | The Young Turks (`TYT`) | TYT is The Young Turks |
| Galavision | 68367 | Galavision Cable Network HD (`GALAHD`) | same network; East feed; the lineup also lists a Pacific feed |
| Start TV | 109454 | Start TV Network (`STARTTV`) | same network |
| Cozi | 89994 | COZI TV HD (`COZIHD`) | same network |
| GREAT | 82563 | Great (`GREATTV`) | same name, differs only in case |
| SundanceTV | 71280 | SundanceTV HD (`SUNDHD`) | same network, HD feed |

### Hand pairs — Philo against USA-PHILO-X (62)

| Marlin Cast name | station id | Schedules Direct station | reason |
|---|---|---|---|
| AMC | 92022 | AMC Stream East (`AMCSTR`) | same network; the lineup's only AMC station |
| HISTORY | 92259 | History Stream (`HISSTR`) | same network |
| A&E | 92258 | A&E Network Stream (`AESTR`) | same network |
| AccuWeather Network | 56193 | AccuWeather (`ACUWTHR`) | the only AccuWeather station in the lineup |
| American Heroes Channel | 78808 | American Heroes Channel HD (`AHCHD`) | same network, HD feed |
| Animal Planet | 57394 | Animal Planet HD (`APLHD`) | same network, HD feed |
| aspireTV | 97409 | ASPiRE HD (`ASPREHD`) | same network |
| BBC America | 76850 | BBC HD (`BBCHD`) | by elimination: Philo carries BBC America and BBC News, and the lineup's other BBC station is BBC News |
| BET | 63236 | BET HD (`BETHD`) | same network, HD feed |
| BET Her | 63220 | BET Her HD (`BHERHD`) | same network, HD feed |
| Catchy Comedy | 122694 | Catchy Comedy Digital (`CATCHCD`) | same network |
| CLEO TV | 110288 | Cleo TV (`CLEO`) | same name, differs only in case |
| CMT | 59440 | CMT HD (`CMTVHD`) | same network, HD feed |
| Comedy Central | 62420 | Comedy Central HD (`CCHD`) | same network, HD feed |
| Cooking Channel | 68065 | Cooking Channel HD (`COOKHD`) | same network, HD feed |
| Crime + Investigation | 61469 | Crime & Investigation Network HD (`CINHD`) | same network |
| Destination America | 60468 | Destination America HD (`DESTHD`) | same network, HD feed |
| Discovery Channel | 56905 | Discovery Channel HD (`DSCHD`) | same network, HD feed |
| Discovery Family | 67749 | Discovery Family Channel HD (`DFCHD`) | same network, HD feed |
| Discovery Life | 92204 | Discovery Life Channel HD (`DLCHD`) | same network, HD feed |
| Discovery Turbo | 31046 | DISCOVERY TURBO HD (`MTHD`) | same network, HD feed; not Philo's free channel Discovery TurboTV |
| Food Network | 50747 | Food Network HD (`FOODHD`) | same network, HD feed |
| FYI | 92256 | FYI Stream (`FYISTR`) | same network |
| Game Show Network | 68827 | Game Show Network HD (`GSNHD`) | same network, HD feed |
| Great American Faith & Living | 90858 | Great American Faith & Living HD (`GLIVHD`) | same network, HD feed |
| Great American Family | 82892 | Great American Family HD (`GFAMHD`) | same network, HD feed |
| Hallmark Channel | 101884 | Hallmark Channel Streaming (`HALLSTR`) | same network; the lineup's only Hallmark Channel station |
| Hallmark Mystery | 101934 | Hallmark Mystery Streaming (`HMYSSTR`) | same network; the lineup's only Hallmark Mystery station |
| HGTV | 49788 | Home & Garden Television HD (`HGTVD`) | HGTV is Home & Garden Television |
| IFC | 92008 | IFC Stream East (`IFCSTR`) | same network |
| INSP | 82773 | INSP HD (`INSPHD`) | same network, HD feed |
| Investigation Discovery | 65342 | Investigation Discovery HD (`IDHD`) | same network, HD feed |
| Law&Crime | 109553 | Law & Crime Stream (`LCSTR`) | same network |
| Lifetime | 92260 | Lifetime Stream (`LIFESTR`) | same network |
| LMN | 92261 | LMN Stream (`LMNSTR`) | same network |
| Logo | 96971 | Logo HD (`LOGOHD`) | same network, HD feed |
| Magnolia Network | 67375 | Magnolia Network HD (`MAGNHD`) | same network, HD feed |
| MeTV | 122696 | MeTV Digital (`METVD`) | same network; the lineup's only MeTV station |
| MTV | 60964 | MTV - Music Television HD (`MTVHD`) | same network, HD feed |
| MTV Live | 49141 | MTVLIVE (`MTVLIVE`) | same name, differs only by the space |
| MTV2 | 75077 | MTV2: Music Television HD (`MTV2HD`) | same network, HD feed |
| Nick Jr. | 82649 | Nick Jr HD (`NICJRHD`) | same network, HD feed |
| Nickelodeon | 59432 | Nickelodeon HD (`NIKHD`) | same network, HD feed |
| Nicktoons | 82654 | Nicktoons HD (`NIKTNHD`) | same network, HD feed |
| Oprah Winfrey Network | 70388 | Oprah Winfrey Network HD (`OWNHD`) | same network, HD feed |
| Paramount Network | 59186 | Paramount Network HD (`PARHD`) | same network, HD feed |
| Science Channel | 57390 | Science Channel HD (`SCIHD`) | same network, HD feed |
| Start TV | 109454 | Start TV Network (`STARTTV`) | same network |
| Story Television | 122968 | Story (`STRY`) | same network |
| Sundance TV | 92041 | Sundance Stream East (`SUNSTR`) | same network |
| TeenNick | 97047 | Teen Nick HD (`TNCKHD`) | same network, HD feed |
| TLC | 57391 | TLC HD (US) (`TLCHD`) | same network, HD feed |
| Travel Channel | 59303 | The Travel Channel HD (`TRAVHD`) | same network, HD feed |
| TV Land | 73541 | TV Land HD (`TVLNDHD`) | same network, HD feed |
| TV One | 35513 | TV ONE (`TVONE`) | same name, differs only in case |
| UPtv | 66143 | UPtv HD (`UPHD`) | same network, HD feed |
| VH1 | 60046 | VH1 HD (`VH1HD`) | same network, HD feed |
| Vice | 92255 | Vice Stream (`VICESTR`) | same network |
| We TV | 92020 | WE tv Stream East (`WETVSTR`) | same network |
| BBC News | 89690 | BBC News (North America) HD (`BBCNAHD`) | same network; the lineup's only BBC News station |
| FailArmy | 121204 | FailArmy Stream (`FLARMY`) | same network |
| Gusto TV | 111140 | GUSTOTV (`GUSTOTV`) | same name, differs only by the space and case |

---

## The untagged list (167)

### Untagged — YouTube TV (14 of 141)

Left out for a stated reason:

- **MPT** (2 channels) — two channels named MPT, one MPT station in the lineup (WMPB-DT, 46199); the two rows showed different programmes at enumeration, so which one is WMPB cannot be told.
- **CNBC** — two stations fit and nothing tells them apart: CNBC HD (CNBCHD, 58780) and CNBC HD Stream (CHDSTR, 103849).

No station of this name or network in USA-YTBE512-X (11):

GFAM; GLIV; Bloomberg TV+; Bloomberg Originals; One America News; AWE; Bounce; Cars.TV; theGRIO; HBCU GO; Pets.TV

### Untagged — Philo (153 of 234)

Left out for a stated reason:

- **Cheddar News** — the lineup has two stations both named Cheddar (CHEDSTR, 101103 and CBNSTR, 107241); which is Cheddar News cannot be told from the name.
- **Discovery TurboTV** — a free channel of its own; the lineup's DISCOVERY TURBO HD is paired with Discovery Turbo.
- **pocket.watch Game-On** — the lineup's pocket.watch (PWT, 118464) is not named Game-On; not credible as the same channel.

No station of this name or network in USA-PHILO-X (150):

Dabl; EarthX; FETV; Heroes & Icons; HSN; MeTV Toons; MeTV+; Military History Channel; Pop TV; QVC; Smithsonian Channel; 365BLK; 4UV; A&E Crime 360; Acorn TV Mysteries; All Reality WE tv; All Weddings WE tv; All-Out Alaska; AllBlk Gems; AMC Thrillers; America's Test Kitchen; Anger Management; ANIME x HIDIVE; Architectural Digest; Are We There Yet?; Are You Smarter than a 5th Grader?; At Home with Family Handyman; Ax Men; Baywatch; beIN Sports XTRA; BET x Tyler Perry Comedy; BET x Tyler Perry Drama; The Bob Ross Channel; Bon Appétit; Buzzr; Caught in Providence; Chasing Criminals; Cold Case Files; Comedy Dynamics; The Conners; Cook's Country; Cosmic Frontiers; CraftsyTV; Crime Cults Killers by A&E; Crime Scenes; Crime ThrillHer; Dance Moms; The Dead Files; Deal or No Deal; Deal Zone; The Design Network; Dog the Bounty Hunter; Dog Whisperer; Duck Dynasty; Ebony TV by Lionsgate; ElectricNOW; The Emeril Lagasse Channel; Family Unscripted; Fear Factor; Game Show Central; Ghosts are Real; Great American Romcoms; Growing Up Hip Hop WE tv; Heartland; HerSphere; History & Warfare; History Untold; Holiday Plus; Home.Made.Nation; Hot Bench; How To; I (Almost) Got Away With It; I Was Haunted; Ice Road Truckers; IFC Films Picks; INFAST; INWONDER; Judge Judy; Judge Nosey; LatiNation; Lifetime Movie Favorites; Living with Evil; LOL! Network; Love & Marriage; Love After Lockup We TV; Love Kills; Love Nature; MagellanTV Wildest; Magnolia Selects; The Martha Stewart Channel; Matched, Married, Meet; Medical Incredible; MGM Celebrates Black Cinema; MGM Presents; MGM Presents: Action; MGM Presents: Horror; MGM Presents: Westerns; Military Heroes; Miramax Movie Channel; Modern Marvels; MovieSphere by Lionsgate; MSG SportsZone; Mysterious Worlds; Mythbusters; Nash Bridges; Nashville; National Lampoon; Nosey; NOST - The Nostalgia Network; The Osbournes; OuterSphere by Lionsgate; Outlaw; Outside TV; Overtime; Pam Grier's Soul Flix; Paternity Court; Paws & Claws; PBS Antiques Roadshow; Perform; Pickleball TV; Portlandia; The Price is Right: The Barker Era; QVC 365; Real Crime Uncovered; Reality Gone Wild; RetroCrush; Say Yes to the Dress; Scares by Shudder; Screambox TV; Shockwave; Slightly Off IFC; Spooks (MI5); Stories by AMC; Survive or Die; Sweet Escapes; Tastemade Home; Tastemade Travel; Teen Wolf; The Tennis Channel 2; Tiny House Nation; Torque; True Crime Now; TV One Crime & Justice; Unique Lives; UnXplained Zone; The Walking Dead Universe; Welcome Home; Western Bound Wrangled by INSP; World Poker Tour; Xtreme Outdoor by HISTORY

---

## Step 6 — the change

`src/server.ts` only. Line numbers are after the change.

| lines | what |
|---|---|
| `:104-117` | the table is read once at start from `src/stations.json` into a `Map`. If the file cannot be read or parsed the app logs `The station table <path> cannot be read: <error>` and exits 1, as it does for a missing channel cache |
| `:132` | the attribute: the table's `stationId` for the channel's key, or nothing. Same place as the ESPN line: last, after `group-title` |

The ESPN constant and its comment are gone; ESPN is a row of the table.
Nothing else in the writer, the routes or the stream URLs changed.

```diff
@@ -101,11 +101,20 @@ function baseUrl(req: express.Request): string {
-/** Test sliver toward D015 (task-017), re-keyed by D020: an explicit Gracenote
- *  station id for ONE channel only — ESPN guide row 17, the regular ESPN feed
- *  the owner tunes. 32645 is PrismCast's own tvc-guide-stationid for ESPN.
- *  Hardcoded on this one key; no mapping table, file, or config. */
-const ESPN_SLIVER_KEY = "UCW7W_WAogi3qWDbO9PqOmZQ";
+/** D035: the Schedules Direct / Gracenote station id of each channel, keyed on
+ *  the channel key (D020). The table is src/stations.json, built from the
+ *  owner's Schedules Direct lineups; `basis` says how each pair was made
+ *  (notebook/reports/task-032.md). A key with no entry carries no
+ *  tvc-guide-stationid. Replaces the task-017 ESPN sliver (D015). */
+type Station = { stationId: string; basis: "name" | "callsign" | "hand" };
+const STATIONS_FILE = join(ROOT, "src", "stations.json");
+let stations: Map<string, Station>;
+try {
+  stations = new Map(Object.entries(JSON.parse(readFileSync(STATIONS_FILE, "utf8")) as Record<string, Station>));
+} catch (e) {
+  console.error(`The station table ${STATIONS_FILE} cannot be read: ${String(e)}`);
+  process.exit(1);
+}
@@ -120,7 +129,7 @@ function playlist(req: express.Request, providers: Provider[]): string {
         `group-title="${provider.label}"`,
-        c.key === ESPN_SLIVER_KEY ? `tvc-guide-stationid="32645"` : null,
+        stations.has(c.key) ? `tvc-guide-stationid="${stations.get(c.key)!.stationId}"` : null,
```

The table's shape, one entry per key:

```json
{
  "UCZmySpv9dwlwsU2ZxS0pipQ": {
    "stationId": "21231",
    "basis": "callsign"
  }
}
```

---

## Verify

On the step 4 container rebuilt from the working tree:

```
docker build -t marlin-cast:task032 .        -> Successfully built a9b741c83dd2 (2.26GB)
marlin-cast-t032a stopped (1.18 s, "shutdown complete"), removed
docker run -d --name marlin-cast-t032b … the same run line … marlin-cast:task032
```

Started 13:48:11Z on the same `/data`, so on the same channel cache: both
providers signed in, `stage 6: channel cache present`, 375 channels, nothing
enumerated again. Because both sets of playlists come from one cache, no
`tvg-logo` drifted between them (0 differences).

### Counts

| playlist | lines | entries | tagged | untagged |
|---|---|---|---|---|
| `/playlist` | 751 | 375 | 208 | 167 |
| — its YouTube TV lines | | 141 | 127 | 14 |
| — its Philo lines | | 234 | 81 | 153 |
| `/playlist/youtube-tv` | 283 | 141 | 127 | 14 |
| `/playlist/philo` | 469 | 234 | 81 | 153 |

**Counted twice, two ways.** With `grep -c` on the three files, and again by a
script that reads every entry, takes its `tvg-id` and its tag, and compares
both with the table. Both agree. Lines that disagree with the table: 0 in
each playlist. Table keys that are not in the channel list: none.
`/playlist` is `/playlist/youtube-tv` followed by the body of
`/playlist/philo`, byte for byte. `/playlist/nope` answers 404.

All 208 tagged lines have the tag in the same place: after `group-title`,
before the comma.

### Diff against HEAD's output

| playlist | lines that differ | after the tag is removed from the new file, ESPN's kept |
|---|---|---|
| `/playlist` | 207 | 0 |
| `/playlist/youtube-tv` | 126 | 0 |
| `/playlist/philo` | 81 | 0 |

The only differences are the added tags: 207 lines gained one, and nothing
else changed on any line. Every URL line is identical.

```
< #EXTINF:-1 tvg-id="UCZmySpv9dwlwsU2ZxS0pipQ" tvg-name="WBAL 11" tvg-logo=… group-title="YouTube TV",WBAL 11
> #EXTINF:-1 tvg-id="UCZmySpv9dwlwsU2ZxS0pipQ" tvg-name="WBAL 11" tvg-logo=… group-title="YouTube TV" tvc-guide-stationid="21231",WBAL 11
```

### ESPN

```
#EXTINF:-1 tvg-id="UCW7W_WAogi3qWDbO9PqOmZQ" tvg-name="ESPN" tvg-logo=… group-title="YouTube TV" tvc-guide-stationid="32645",ESPN
```

Byte-identical to HEAD's ESPN line (`cmp`).

### Ten random pairs

Drawn from the table's keys by a seeded random sample (seed 32), not chosen.

| provider | Marlin Cast name | station id | Schedules Direct name | callsign | basis |
|---|---|---|---|---|---|
| Philo | BET | 63236 | BET HD | `BETHD` | hand |
| Philo | Great American Family | 82892 | Great American Family HD | `GFAMHD` | hand |
| Philo | Crime + Investigation | 61469 | Crime & Investigation Network HD | `CINHD` | hand |
| Philo | CBS News 24/7 | 104846 | CBS News 24/7 | `CBSNSTR` | name |
| YouTube TV | NBA TV | 45526 | NBA TV HD | `NBATVHD` | hand |
| Philo | Ryan and Friends | 118462 | Ryan and Friends | `RAF` | name |
| YouTube TV | Univision | 68049 | Univision Network HD | `UNIHD` | hand |
| Philo | BBC America | 76850 | BBC HD | `BBCHD` | hand |
| YouTube TV | HGTV | 49788 | Home & Garden Television HD | `HGTVD` | hand |
| Philo | Travel Channel | 59303 | The Travel Channel HD | `TRAVHD` | hand |

### One WBAL 11 tune, 30 s

```
13:49:09Z  GET /stream/UCZmySpv9dwlwsU2ZxS0pipQ/index.m3u8   HTTP 200 in 6.78 s (the container's first tune)
ffmpeg -t 30 -i <URL> -c copy pull-30s.mp4                    exit 0, 22,540,548 bytes
[tune] WBAL 11 {"ok":true,"target":"hd1080","quality":"hd1080","is1080":true,"video":"1920x1080","box":"1920x1080","viewport":"1920x1080",…}
[tune-ms] WBAL 11 nav=419 layout=426 playing=1743 pinned=1745
[stop] WBAL 11: idle 20000ms with no client request
[stop] parked the youtubetv tab on https://tv.youtube.com/live

$ ffprobe -v error -show_entries stream=index,codec_type,codec_name,profile,width,height,r_frame_rate,sample_rate,channels,duration -show_entries format=format_name,duration,size -of default=noprint_wrappers=1 pull-30s.mp4
index=0
codec_name=h264
profile=High
codec_type=video
width=1920
height=1080
r_frame_rate=30/1
duration=30.000000
index=1
codec_name=aac
profile=LC
codec_type=audio
sample_rate=48000
channels=2
r_frame_rate=0/0
duration=30.016000
format_name=mov,mp4,m4a,3gp,3g2,mj2
duration=30.019000
size=22540548
```

H.264 High 1920×1080 at 30 fps, and AAC-LC 48 kHz stereo. The pull log holds
no error line. `/health` read `streaming`, `hd1080` during the pull and `idle`
35 s after it; `last_error` is ffmpeg's known message at the idle stop (D030
note). The `[gc]` warning line was logged 0 times.

### The search for the credentials

Searched for the password and the password's SHA-1, without regard to case,
in: the table, `src/server.ts`, `DECISIONS.md`, this report, the
SESSION-STATE entry, and every scratch file (the lineup data, the pairing
files, the saved playlists, the channel cache, the container log, the pull
log). **Zero hits.** The username was searched for in every line this pass
adds to the repo: **zero hits.** The token was never written to a file.

---

## Open questions — the owner's call

1. **Eight Philo channels have their exact name in the YouTube TV lineup
   only**: All Reality WE tv, AMC Thrillers, Overtime, Pickleball TV,
   Portlandia, Stories by AMC, The Tennis Channel 2, The Walking Dead
   Universe. The brief pairs Philo against `USA-PHILO-X` only, so they carry
   no tag. Marlin DVR's pass 155 joined them, by name, across lineups. Whether
   they may take the `USA-YTBE512-X` id is the owner's call.
2. **CNBC (YouTube TV) has two stations that fit**: CNBC HD (`CNBCHD`, 58780)
   and CNBC HD Stream (`CHDSTR`, 103849). Left out; one line in the table once
   the owner picks.
3. **MPT (YouTube TV, two channels)**: the lineup has one MPT station,
   WMPB-DT (`WMPBDT`, 46199). The two rows showed different programmes at
   enumeration. Which row is WMPB, and what the other is, needs the owner's
   eye on the two channels.
4. **Cheddar News (Philo)**: two stations named Cheddar (`CHEDSTR`, 101103 and
   `CBNSTR`, 107241). Left out.
5. **153 Philo channels have no station.** `USA-PHILO-X` holds 109 stations
   against 234 channels; most of Philo's free channels are not in it. Another
   lineup on the account is the only other source, and the account has one
   free slot of four (pass 155).
6. **The table is a snapshot.** A channel a provider adds later has no entry
   until the table is rebuilt; nothing warns of it. A key that leaves the
   lineup leaves a dead entry, which does no harm.
7. **`VERSION` was not bumped.** It stays 0.1.2; the steps did not ask for it.
8. **Unraid and the QNAP do not have this** until the owner updates them:
   Unraid runs `latest` as pulled on 2026-09-28, the QNAP is pinned to
   `sha-c876a3a`.

## Least sure of

1. **The hand pairs are made on names, 156 of them.** Each is the same
   network by name. Whether each is the same feed — the schedule the provider
   actually shows — was not checked against a picture or a listing.
2. **Four local pairs rest on what the builder knows of Baltimore's
   stations, not on anything in either list**: ABC 2 → WMAR-DT, FOX 45 →
   WBFF-DT, The CW Baltimore → WNUV-DT, MyTV Baltimore → WBFF-DT2. The last
   two are the weakest: the lineup also holds two national CW stations, and
   MyTV's place on WBFF's second subchannel is from memory.
3. **BBC America on Philo → "BBC HD" (76850)** is by elimination, and
   **BBC News on YouTube TV → "BBC News Europe Stream (US)" (105725)** is the
   lineup's only BBC News station, under a name that does not say America.
4. **Telemundo, Univision and UniMas** are paired with the national East
   feeds the lineup lists. If YouTube TV shows a local station's feed for any
   of them, the listings differ in the local hours.
5. **Production's channel list is not this one.** Unraid's cache was made at
   its own first boot. The playlist Marlin DVR read on 2026-09-28 had 367
   channels (Philo 226); this one has 375 (Philo 234). Keys are durable
   (D020), so a channel in both has the same key, but a key only Unraid holds
   has no entry. Unraid was not contacted, so this was not checked.
6. **Station ids in a public repo.** The table puts 208 Schedules Direct
   station ids, and this report some station names and callsigns, in a public
   repo (D027). The owner ruled both; Schedules Direct's terms were not read.
7. **The read-failure path** (`cannot be read`, exit 1) was read, not seen.
   No failure was induced.

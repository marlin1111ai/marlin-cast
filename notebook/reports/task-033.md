# Task 033 — nine more station ids: eight Philo channels from USA-YTBE512-X, and CNBC (D035 note)

Date: 2026-09-29, 11:43–11:56 and 12:52–13:05 EDT (15:43–15:56Z and
16:52–17:05Z). Host: marlinpc. Code read at `b2df851`; the change is on top of
it. Nothing on 192.168.1.250 or 192.168.1.30 was contacted. No owner Chrome
was running on marlinpc (0 chrome processes, nothing on 8091/8092/8804/9333
before either part). `data/chrome-profile` was not read. `backups/` was read
once with `tar -xzf` and hashed. No file was changed except
`src/stations.json`, `notebook/DECISIONS.md`, `notebook/SESSION-STATE.md`,
`MARLIN-CAST-BRIEF.md` and this report. `src/server.ts` and the `Dockerfile`
were not changed.

No credential appears in this report. The Schedules Direct username and
password were read from the owner's env file by a script that prints neither;
the token was held in memory only and written nowhere. `VNC_PASSWORD` was a
throwaway passed by `--env-file` from a 0600 scratch file.

**Owner's calls carried out** (task-032's open questions 1–4):

- 1a: the eight Philo channels named only in `USA-YTBE512-X` take that
  lineup's station ids;
- 2a: CNBC → 58780;
- MPT (both) and Cheddar News stay untagged.

Recorded as a note under D035.

**Result: done and verified.** 217 of 375 lines carry the tag, 9 more than
task-032's 208.

| | channels | tagged | untagged | task-032 tagged | added |
|---|---|---|---|---|---|
| YouTube TV | 141 | **128** | 13 | 127 | 1 |
| Philo | 234 | **89** | 145 | 81 | 8 |
| **Total** | 375 | **217** | 158 | 208 | 9 |

By basis, the table now holds 47 `name`, 5 `callsign` and 165 `hand` pairs
(task-032: 47, 5, 156). The 217 lines name 181 distinct stations: 36 stations
are carried by one channel of each provider (task-032: 179 and 29). No station
is used twice inside one provider.

This pass ran in two parts. The first stopped at the throwaway container's
sign-in check: YouTube TV read SIGNED OUT. The owner then ruled to start that
container once more and to continue only on a boot log that reads both
providers signed in. It did, and the pass resumed.

---

## Result per step

| Step | Result |
|---|---|
| 0 fetch, clean tree | passed — tree clean, `HEAD` = `origin/main` = `b2df851`, in both parts |
| (keys) | the nine channels' keys taken from the throwaway container's enumeration, before step 1 |
| 1 lineup | done — one token request, one lineup read, nothing written to the account |
| 2 table | done — nine entries appended to `src/stations.json`, 208 → 217 |
| 3 DECISIONS, SESSION-STATE, brief | done — the note under D035; the Unraid statement replaced in both files |
| verify | passed on every point — below |
| 4 this report, SESSION-STATE | written |
| 5 commit, push, GHCR | after this report is written; SHAs and the GHCR tag are in the hand-off and `git log` |
| second commit | after step 5 (the owner's change to the brief) |
| 6 clean-up | after the second commit; its evidence is in the hand-off |

## Files touched, mapped to steps

| File | Step | Change |
|---|---|---|
| `src/stations.json` | 2 | nine entries appended (+36 lines); no existing entry changed |
| `notebook/DECISIONS.md` | 3 | the note under D035 (+4 lines) |
| `notebook/SESSION-STATE.md` | 3, 4, second commit | the Unraid statement in "Where things stand"; the entry appended; GHCR `latest` in the second commit |
| `MARLIN-CAST-BRIEF.md` | 3, second commit | the Unraid statement in WHERE THE PROJECT STANDS; GHCR `latest` in the second commit |
| `notebook/reports/task-033.md` | 4 | this report |

Nothing else in the repo.

---

## The first part — stopped at the sign-in check

The channel keys come from an enumeration, so the throwaway container was
started before step 1. No Schedules Direct request had been made and no file
had been changed when the pass stopped.

```
docker build -t marlin-cast:task033-base .     (clean tree at b2df851)  -> 6821f8d627e6 (2.26GB)

backups/chrome-profile-2providers-20260913-0746.tgz
  sha256 before: 6ebd9ea976118bcb8c24e10b590680e5d44e405d1b3a9f7f09a0a3982258dbe3
tar -xzf … -C <scratchpad>/data      -> data/chrome-profile, 54,857 entries, 1.7G

docker run -d --name marlin-cast-t033a --cap-add SYS_ADMIN --shm-size=1g \
  -p 8091:8804 -p 8092:6080 -v <scratchpad>/data:/data \
  --env-file <scratchpad>/run.env -e PUID=99 -e PGID=100 \
  marlin-cast:task033-base
```

Started 15:52:59Z:

```
[login] youtubetv: tv.youtube.com: SIGNED OUT
[login]   url: https://tv.youtube.com/welcome/?utm_servlet=prod&rd_rsn=lo&zipcode=21047
[login] philo: www.philo.com: signed in (https://www.philo.com/player/mytv)
[entrypoint] WARNING: stage 5: a provider is SIGNED OUT (see the [login] lines above)
[entrypoint] stage 6: no /data/channels.json — first boot, enumerating the lineup
[channels] [youtubetv] guide rows 146, tiles 144, channels 141, skipped 5
[channels] [philo] 234 channels, totalCount 234, tiers {"Favorite channels":2,"All channels":74,"Free channels":158}
[channels] enumerated 375 channels at 2026-09-29T15:53:20.660Z
[entrypoint] stage 7 ready: app on 0.0.0.0:8804 (pid 487); channels: 375 state: idle
```

What was seen after that line, with no navigation and no retry:

- 20 s after the check the guide enumerated 141 YouTube TV channels. The
  enumeration treats a signed-out guide as one that yields 0 channels
  (`src/providers/youtubetv.ts:150-153`).
- At 15:54:52Z the YouTube TV tab, read in place over CDP, was on `/live`
  with no "SIGN IN" text and 288 watch links. The Philo tab was on
  `/player/guide`.
- `/playlist` 208 of 375 tagged, `/playlist/youtube-tv` 127 of 141,
  `/playlist/philo` 81 of 234: task-032's counts.

The container was stopped at 15:55:28Z (1.27 s, exit 0) and kept. Stopping it
was the builder's call, not the brief's.

**Not proven:** why the first load was sent to the signed-out welcome page.
The same backup read signed in on its first check at 13:40Z the same day
(task-032). The cookie store was not read.

## The resume

The owner's ruling: start `marlin-cast-t033a` once; continue only if the boot
log reads both providers signed in.

Started 16:52:57Z, on the same `/data`:

```
[entrypoint] stage 3 ready: Chrome/153.0.8010.36 on 127.0.0.1:9333 (loopback), missing tabs: tv.youtube.com (open: , www.philo.com)
[login] youtubetv: tv.youtube.com: signed in
[login]   url: https://tv.youtube.com/
[login] philo: www.philo.com: signed in (https://www.philo.com/player/mytv)
[entrypoint] stage 5: every provider signed in
[entrypoint] stage 6: channel cache present (/data/channels.json)
[app] channels: 375 (enumerated 2026-09-29T15:53:20.660Z) {"youtubetv":141,"philo":234}
[entrypoint] stage 7 ready: app on 0.0.0.0:8804 (pid 396); channels: 375 state: idle
```

Stage 3 listed the YouTube TV tab as missing: one of the two tabs had no URL
yet when stage 3 looked. The sign-in check found both tabs.

`b2df851`'s three playlists were saved again from this boot; each is
byte-identical to the one saved in the first part.

### The nine keys

From the channel cache of that enumeration. 375 keys, all distinct; all 208 of
task-032's table keys are among them.

| provider | Marlin Cast name | key (D020) |
|---|---|---|
| Philo | All Reality WE tv | `Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk3Mzc` |
| Philo | AMC Thrillers | `Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk3NDI` |
| Philo | Overtime | `Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk3OTE` |
| Philo | Pickleball TV | `Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk4NDI` |
| Philo | Portlandia | `Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk3Mzk` |
| Philo | Stories by AMC | `Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk4NDE` |
| Philo | The Tennis Channel 2 | `Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk4NDM` |
| Philo | The Walking Dead Universe | `Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk3MzU` |
| YouTube TV | CNBC | `UCBvMULs2YrbFjhPJQBKILhw` |

Each of the nine names is on exactly one channel of its provider.

---

## Step 1 — the lineup

At 16:53:50Z: one `POST /token` (HTTP 200, code 0), then one
`GET /lineups/USA-YTBE512-X` (HTTP 200). No other request was made. The
account's lineups and settings were not changed: no `PUT`, no `DELETE`.

| lineup | modified | station entries | distinct station ids |
|---|---|---|---|
| `USA-YTBE512-X` | 2026-09-24T07:16:11Z | 401 | 393 |

The same `modified` stamp and the same counts as task-032's read. For every
station only `stationID`, `name` and `callsign` were kept, in the scratchpad.

Each of the eight names was matched character for character against the
stations' names. **Each has exactly one station; none was left out.** 58780 is
in the lineup as CNBC HD.

The env file was not changed: same size, same modification time
(2026-09-29 09:36:40 EDT) and the same hash before and after.

## Step 2 — the table

Nine entries appended to the end of `src/stations.json`, the eight in
enumeration order and then CNBC. No existing entry was changed, moved or
removed.

**Basis.** The eight are `hand`, as the brief says. CNBC is `hand` too: the
channel's name is not the station's name (CNBC HD) and not its callsign
(`CNBCHD`), which is what task-032 called a hand pair ("same network, HD
feed").

## Step 3 — the records

- `notebook/DECISIONS.md`, under D035, after its dated line: the note, in the
  brief's words.
- `notebook/SESSION-STATE.md`, "Where things stand", and
  `MARLIN-CAST-BRIEF.md`, WHERE THE PROJECT STANDS: the sentence "Unraid shows
  tag `latest` and no version, so which build it runs is not known (D030)."
  is replaced by "Unraid runs `sha-13071d7` since the 2026-09-28 force-update
  (D026 note)." The tag is set in backticks, as both files set tags.
- The brief's D030 summary line ("Recorded answers: Unraid's build is not
  known") is left as it is, by the owner's ruling. D030 itself in
  `DECISIONS.md` is unchanged.

---

## Verify

On an image built from the working tree, on the same profile copy:

```
docker build -t marlin-cast:task033 .        -> Successfully built 81511ad96a7a (2.26GB)
marlin-cast-t033a stopped (1.23 s, "shutdown complete")
docker run -d --name marlin-cast-t033b … the same run line … marlin-cast:task033
```

Started 16:56:54Z on the same `/data`, so on the same channel cache:

```
[entrypoint] stage 3 ready: Chrome/153.0.8010.36 on 127.0.0.1:9333 (loopback), tabs: tv.youtube.com, www.philo.com
[login] youtubetv: tv.youtube.com: signed in
[login] philo: www.philo.com: signed in (https://www.philo.com/player/mytv)
[entrypoint] stage 5: every provider signed in
[entrypoint] stage 6: channel cache present (/data/channels.json)
[entrypoint] stage 7 ready: app on 0.0.0.0:8804 (pid 408); channels: 375 state: idle
```

Both providers signed in; nothing enumerated again. Because both sets of
playlists come from one cache, no `tvg-logo` drifted between them (0
differences).

### Counts

| playlist | lines | entries | tagged | untagged |
|---|---|---|---|---|
| `/playlist` | 751 | 375 | 217 | 158 |
| — its YouTube TV lines | | 141 | 128 | 13 |
| — its Philo lines | | 234 | 89 | 145 |
| `/playlist/youtube-tv` | 283 | 141 | 128 | 13 |
| `/playlist/philo` | 469 | 234 | 89 | 145 |

Against task-032's 127 and 81: 127 + 1 = 128 and 81 + 8 = 89.

**Counted twice, two ways.** With `grep -c` on the three files, and again by a
script that reads every entry, takes its `tvg-id` and its tag, and compares
both with the table. Both agree. Lines that disagree with the table: 0 in
each playlist. Table keys that are not in the channel list: none.
`/playlist` is `/playlist/youtube-tv` followed by the body of
`/playlist/philo`, byte for byte. `/playlist/nope` answers 404.

All 217 tagged lines have the tag in the same place: after `group-title`,
before the comma.

### Diff against b2df851's output

| playlist | lines that differ | lines that gained a tag | any other change | URL lines that differ |
|---|---|---|---|---|
| `/playlist` | 9 | 9 | 0 | 0 |
| `/playlist/youtube-tv` | 1 | 1 | 0 | 0 |
| `/playlist/philo` | 8 | 8 | 0 | 0 |

The only differences are the nine added tags, on the nine keys above, each
with the id the table holds. ESPN's line is byte-identical (`cmp`).

```
< #EXTINF:-1 tvg-id="UCBvMULs2YrbFjhPJQBKILhw" tvg-name="CNBC" tvg-logo=… group-title="YouTube TV",CNBC
> #EXTINF:-1 tvg-id="UCBvMULs2YrbFjhPJQBKILhw" tvg-name="CNBC" tvg-logo=… group-title="YouTube TV" tvc-guide-stationid="58780",CNBC

< #EXTINF:-1 tvg-id="Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk3OTE" tvg-name="Overtime" tvg-logo=… group-title="Philo",Overtime
> #EXTINF:-1 tvg-id="Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk3OTE" tvg-name="Overtime" tvg-logo=… group-title="Philo" tvc-guide-stationid="131737",Overtime
```

### The nine new pairs

Station names and callsigns as `USA-YTBE512-X` holds them.

| provider | Marlin Cast name | station id | Schedules Direct name | callsign | basis | the same station on YouTube TV |
|---|---|---|---|---|---|---|
| Philo | All Reality WE tv | 115679 | All Reality WE tv | `WEREAL` | hand | All Reality We TV (hand) |
| Philo | AMC Thrillers | 115678 | AMC Thrillers | `AMCRSH` | hand | AMC Thrillers (name) |
| Philo | Overtime | 131737 | Overtime | `OTFAST` | hand | none |
| Philo | Pickleball TV | 146769 | Pickleball TV | `PBTV` | hand | Pickleball TV (name) |
| Philo | Portlandia | 122435 | Portlandia | `PRTLNDA` | hand | Portlandia (name) |
| Philo | Stories by AMC | 115539 | Stories by AMC | `AMCPRES` | hand | Stories by AMC (name) |
| Philo | The Tennis Channel 2 | 137752 | The Tennis Channel 2 | `T2` | hand | T2 (callsign) |
| Philo | The Walking Dead Universe | 115540 | The Walking Dead Universe | `TWDU` | hand | The Walking Dead Universe (name) |
| YouTube TV | CNBC | 58780 | CNBC HD | `CNBCHD` | hand | — |

Seven of the eight stations were already in the table under a YouTube TV
channel. Overtime's station is new to the table, as is CNBC's.

### Left untagged, as ruled

```
#EXTINF:-1 tvg-id="UClbcLfVpLGEEr_r1-lTKg7g" tvg-name="MPT" tvg-logo=… group-title="YouTube TV",MPT
#EXTINF:-1 tvg-id="UCnScaf78e3cp-fS7SghUEsA" tvg-name="MPT" tvg-logo=… group-title="YouTube TV",MPT
#EXTINF:-1 tvg-id="Q2hhbm5lbDo2MDg1NDg4OTk2NDg0Mzk1MDM" tvg-name="Cheddar News" tvg-logo=… group-title="Philo",Cheddar News
```

### No tune

No channel was tuned in either part; the steps did not ask for one. The
verify container logged no `cannot be read` line and no `[gc]` warning, and
`/health` read `status: ok`, `state: idle`.

### The search for the credentials

Searched for the password and the password's SHA-1, without regard to case,
and for the throwaway `VNC_PASSWORD`, in: the table, `DECISIONS.md`, the
brief, this report, `SESSION-STATE.md`, and every scratch file (the lineup
data, the key and pair files, the scripts, the saved playlists, the channel
cache, the container logs). **Zero hits.** The username was searched for in
every scratch file and in every line this pass adds to the repo: the scratch
files hold none, and the pass adds no occurrence of it. The token was never
written to a file.

---

## The untagged list (158)

### Untagged — YouTube TV (13 of 141)

- **MPT** (2 channels) — owner-ruled: stay untagged.
- No station of this name or network in `USA-YTBE512-X` (11): GFAM; GLIV;
  Bloomberg TV+; Bloomberg Originals; One America News; AWE; Bounce; Cars.TV;
  theGRIO; HBCU GO; Pets.TV

### Untagged — Philo (145 of 234)

- **Cheddar News** — owner-ruled: stays untagged.
- **Discovery TurboTV** and **pocket.watch Game-On** — as in task-032.
- No station of this name or network in `USA-PHILO-X` (142): task-032's list
  of 150 less the eight paired here.

---

## Open questions — the owner's call

1. **The backup's YouTube TV session read signed out once.** The first boot
   of a fresh copy of the 2026-09-13 backup was sent to the signed-out welcome
   page; every later look read signed in. If the backup's cookies are ageing,
   a later pass may need a newer profile backup. Unraid was first deployed
   from this backup; it was not contacted, so whether production is affected
   is not known.
2. **145 Philo channels still have no station** (task-032's question 5,
   unchanged but for the eight).
3. **The table is a snapshot** (task-032's question 6, unchanged).
4. **`VERSION` was not bumped.** It stays 0.1.2; the steps did not ask for it.
5. **Unraid and the QNAP do not have this** until the owner updates them:
   Unraid runs `sha-13071d7`, the QNAP is pinned to `sha-c876a3a`.
6. **The brief still says Philo has 226 channels** "at last enumeration"; the
   last three enumerations on marlinpc and the QNAP read 234. Not changed: the
   steps name the statements to change.
7. **"Where things stand" is dated 2026-09-26** in its heading and says main
   is pushed "through the commit that records D031". Not changed, for the same
   reason.

## Least sure of

1. **The eight pairs cross lineups on the name alone.** Each Philo channel
   has the station's exact name, but the station is one Schedules Direct lists
   for YouTube TV. Whether Philo's channel shows that station's schedule was
   not checked against a picture or a listing. The free, single-show channels
   (Portlandia, Stories by AMC, The Walking Dead Universe, AMC Thrillers, All
   Reality WE tv) are the likeliest to run on each provider's own schedule.
2. **Overtime** is the weakest of the eight: a one-word name, and the only
   one with no YouTube TV channel of that name in the channel list to set
   beside it.
3. **CNBC → 58780** is the owner's pick between two stations that both fit.
   Nothing in either list says which one YouTube TV's CNBC follows.
4. **Why YouTube TV read signed out on the first boot.** See open question 1.
   One boot in five read signed out today (task-032's two boots on its copy
   of the backup, this pass's three on its own); that is too few to call.
5. **No tune was made.** The sign-in check reading "signed in" is not the
   same as a channel playing. task-032 tuned WBAL 11 on the same code this
   morning; this pass changes only the table.
6. **Production's channel list is not this one** (task-032's item 5,
   unchanged): a key only Unraid holds has no entry.

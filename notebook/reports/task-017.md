# Task 017 — tvc-guide-stationid on ESPN only (D015 test sliver)

Date: 2026-09-11. Host: marlinpc. Owner's Chrome pid 76888, never
touched this task. Only PrismCast's /playlist on port 5589 was fetched;
nothing else on 192.168.1.250.

**Result: done and verified.** The one ESPN entry the owner tunes in
every test (`MrXg0chrojg`) now carries
`tvc-guide-stationid="32645"` in /playlist. Nothing else changed: the
whole prior-vs-new playlist diff is a single line, the channel count is
144 as before, and exactly one station id exists in the file.

Whether this changes what Channels DVR does is for the owner's retest —
it cannot be tested here (Channels is not contacted; task-015 established
the failure is not reproducible locally).

---

## Step 1 — PrismCast's ESPN station id

PrismCast has an ESPN entry. Its /playlist line, fetched 2026-09-12
00:10Z:

```
#EXTINF:-1 channel-id="espn" group-title="Sports" tvg-name="ESPN" tvc-guide-stationid="32645",ESPN
http://192.168.1.250:5589/hls/espn/stream.m3u8
```

`tvc-guide-stationid` = **32645**. (PrismCast also ships ESPN2 45507,
ESPNews 59976, ESPNU 60696, ESPN Deportes 71914 — not used here.)

---

## Step 2 — the change

`src/server.ts`, the /playlist generator, one conditional attribute:

```ts
c.id === "MrXg0chrojg" ? `tvc-guide-stationid="32645"` : null,
```

appended to the existing `attrs` array after `group-title`. Hardcoded on
that single channel id; no mapping table, no file, no config.

**Which "ESPN"?** We carry **four** channels named exactly "ESPN":
`MrXg0chrojg`, `gaT2Q_KZxns`, `arlkwb9_uTw`, `n33BiPboLfo`. The station
id went on `MrXg0chrojg` only — the channel every task since task-010 has
tuned and the one the owner tests. The other three are deliberately left
without a station id (verified below); giving all four the same id would
be wrong and is out of this test's scope.

---

## Step 3 — verification, live

Server restarted on 0.0.0.0:8804; /playlist re-fetched.

**Our new ESPN line, verbatim:**

```
#EXTINF:-1 tvg-id="MrXg0chrojg" tvg-name="ESPN" tvg-logo="https://yt3.ggpht.com/6D1rBSDA-wflW4acQi-2eH7_pu_hs54frBgYTe3gatDUC5QLNs562KK3MqqgWMEigImA7vAC6GQ=ns-nd" group-title="YouTube TV" tvc-guide-stationid="32645",ESPN
```

**PrismCast's ESPN line, verbatim:**

```
#EXTINF:-1 channel-id="espn" group-title="Sports" tvg-name="ESPN" tvc-guide-stationid="32645",ESPN
```

The station id matches. Our other attributes (tvg-id, tvg-name, tvg-logo,
group-title) are unchanged and in place; PrismCast uses `channel-id` and
`group-title="Sports"`, which are its own conventions and were not
copied (out of scope — only the station id was the ask).

**One other channel unchanged** (TNT, `K3F9ZXlDx34`), prior vs new:

```
identical (diff empty)
```

**The other three ESPN-named entries carry no station id:**
`gaT2Q_KZxns`, `arlkwb9_uTw`, `n33BiPboLfo` — none has
`tvc-guide-stationid`.

**Channel count unchanged, re-verified by hand:**

| | prior (task-016 build) | new |
|---|---|---|
| `#EXTINF` lines | 144 | 144 |
| total playlist lines | 289 | 289 |
| `tvc-guide-stationid` occurrences | 0 | 1 |
| full diff | — | 1 line (the ESPN #EXTINF) |

---

## Files touched, mapped to steps

| File | Step | Change |
|---|---|---|
| `src/server.ts` | 2 | one conditional attribute on the `MrXg0chrojg` entry in the /playlist generator, with a comment |
| `notebook/KNOWN-FIXES.md` | 3 | entry: Channels' "stream timestamps start_at=end_at" is logged before it opens the connection, so it is not from the media playlist |
| `notebook/SESSION-STATE.md` | 3 | Task 017 section |
| `notebook/reports/task-017.md` | 3 | this report |

Nothing else. No mapping table, file, or config; no other channel
changed; stream URLs and the server binding unchanged. No dependency
added.

---

## What was committed

One commit on `main`, **not pushed**: `src/server.ts` and the three
notebook files. Commits `ea788bb` (task-016), `953b6cd` (task-014) and
`74e09c1` (task-012) are also still unpushed; all wait for the owner.

Server left running on `0.0.0.0:8804`.

---

## Open questions

1. **Does the station id change Channels' behaviour** (guide match, or
   the remux / `last_seq` symptom)? Only the owner's Channels DVR can
   answer; it is not contacted here.
2. **D015 is not recorded in DECISIONS.md.** The brief calls this a test
   sliver of D015, but no D015 exists yet. If the test succeeds, the
   decision — whether Marlin Cast ships station ids for all 144 channels,
   and where the mapping comes from — is the owner's to write. D006
   currently says guide data is Channels' own Gracenote matching with no
   XMLTV from Marlin Cast; a per-channel station id is adjacent to that
   and may want reconciling.
3. **Four channels named "ESPN".** Only the tuned one got the id. A real
   rollout needs a name/id→station-id mapping and must resolve the
   duplicate-name feeds (regional/overflow ESPNs), which this sliver
   deliberately does not.

## Least sure of

1. **That 32645 is the right station id for this specific feed.** It is
   PrismCast's ESPN id and PrismCast works in this install, so it is the
   best available value — but our `MrXg0chrojg` is a YouTube TV ESPN feed
   that may or may not be the exact same Gracenote station PrismCast maps.
2. **That a station id is even the lever.** D006's premise is that
   Channels does its own Gracenote matching, in which case an explicit
   station id changes guide accuracy but not playback. This sliver tests
   the assumption rather than relying on it.

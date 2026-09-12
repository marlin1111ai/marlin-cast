# Task 018 — on idle stop, return the capture tab to the YouTube TV guide

Date: 2026-09-11. Host: marlinpc. Owner's Chrome pid 76888, never
restarted, never sent to accounts.google.com, no credentials typed. It
was driven only through the app's tune/stop path plus the new idle-stop
navigation. Nothing on 192.168.1.250 was contacted.

**Result: done and verified live.** After the 20 s idle timeout stops the
encoder, the capture tab now navigates to `https://tv.youtube.com/live`
and stays there — logged in, no channel playing. The tab stays open, the
next tune works from the guide unchanged, and cold tune latency is
unaffected (4.212 s against the ~4.3 s baseline).

---

## Files touched, mapped to steps

| File | Step | Change |
|---|---|---|
| `src/capture.ts` | 1, 2 | `GUIDE_URL` constant; `stop()` gained an optional `{ returnToGuide }` arg; on that flag it navigates the page session to the guide after the encoder teardown; `checkIdle` passes the flag |
| `notebook/SESSION-STATE.md` | 3 | Task 018 section |
| `notebook/reports/task-018.md` | 3 | this report |

Nothing else. No dependency added. The idle timeout value (`IDLE_MS`),
the four tune polls, the ffmpeg encoder args, and the playlist/segment
settings are all unchanged.

**Why gate on idle only.** `stop()` has four callers: the idle watchdog,
a channel switch, ffmpeg-exit, and server shutdown. Only the idle path
passes `returnToGuide`. A channel switch immediately navigates to the
next channel (parking on the guide first would waste a navigation and add
latency); shutdown and ffmpeg-exit have no reason to park. The
navigation is wrapped in try/catch so a failed park never throws out of
the stop path.

The change, in full:

```ts
const GUIDE_URL = "https://tv.youtube.com/live";
// checkIdle:
void this.stop(`idle ${IDLE_MS}ms with no client request`, { returnToGuide: true });
// stop(reason, opts = {}):  ... after teardown + clearDeviceMetricsOverride + this.live = null:
if (opts.returnToGuide) {
  try { await this.cdp.send("Page.navigate", { url: GUIDE_URL }, this.page);
        console.log(`[stop] parked capture tab on the live guide`); }
  catch (e) { console.error(`[stop] guide navigation failed: ${String(e)}`); }
}
```

**Step 2 — nothing assumes the tab is on a channel.** `start()` begins
with `Page.navigate` to the channel URL, then poll 1 waits for
`location.href` to contain the channel id AND `#movie_player` to exist
(aborting on "SIGN IN"). None of that reads or depends on the prior
page's state; the device-metrics override is re-applied fresh each tune.
Tuning from the guide is identical to tuning from another channel. No
code change was required, and the live re-tune below confirms it.

---

## Post-idle tab state — evidence

Tuned ESPN 00:56:34Z, pulled ~10 s, stopped, waited 25 s. Server log:

```
[stop] ESPN: idle 20000ms with no client request
[stop] parked capture tab on the live guide
```

Read-only in-page eval of the capture tab (attach + `Runtime.evaluate`,
no navigation, no clicks):

```json
{
 "url": "https://tv.youtube.com/live",
 "playerVideoPresent": true,
 "paused": true,
 "currentTime": 0,
 "readyState": 0,
 "videoWH": "0x0",
 "title": "Live - YouTube TV"
}
```

The guide page carries a `#movie_player video.html5-main-video` element,
but it is **paused, currentTime 0, readyState 0, 0x0** — nothing is
playing. Alongside: `state: idle`, **0 ffmpeg processes, 0 HLS
directories**.

After the re-tune below was allowed to idle out again, a second probe
confirmed the tab parked once more: `https://tv.youtube.com/live`,
paused, readyState 0, 0x0 — the state the server is left in.

---

## Latency — re-tune from the guide

Task-011 method: waited for `state: idle` (tab on the guide), then timed
one request to a playlist with a playable segment.

| | cold tune |
|---|---|
| ESPN, from the guide (task-018) | **4.212 s** |
| baseline (task-016) | 4.317 s |
| baseline (task-014) | 4.307 s |

Stage split from the log: `nav=644 layout=657 playing=1763 pinned=1766`
ms — the navigation from the guide committed in 644 ms, indistinguishable
from a cold tune off any other page. Parking on the guide does not slow
the next tune; if anything the guide is already a logged-in
tv.youtube.com document, so navigation is a same-origin transition.

ESPN again settled at hd720 by the channel's own ceiling, warned as
usual — unchanged behaviour.

---

## What was committed

One commit on `main`, **not pushed**: `src/capture.ts`,
`notebook/SESSION-STATE.md`, and this report. Commits `53651b2`
(task-017), `ea788bb` (task-016), `953b6cd` (task-014) and `74e09c1`
(task-012) are also still unpushed; all wait for the owner.

Server left running on `0.0.0.0:8804`, idle, tab parked on the guide.

---

## Open questions

1. **Does parking on the guide help the owner's real symptom?** The
   motivation is that a tab left on a dead channel is not the state the
   owner wants between tunes; whether it affects anything in Channels DVR
   is unknown and not testable here. It is a hygiene change, not a fix
   for `last_seq=1`.
2. **The guide page keeps a `#movie_player` element mounted** (paused,
   0x0). It is not playing, but it does mean the tab is not completely
   inert. If a fully-idle tab is wanted, `about:blank` would be inert but
   would cost a full page load on the next tune and drop the logged-in
   YouTube TV context from the foreground — out of scope, and the task
   specified `/live`.

## Least sure of

1. **That the guide never auto-starts a preview.** In this run the guide
   player stayed paused at readyState 0 across two idle stops. YouTube TV
   could in principle begin a preview after longer dwell or on some
   layouts; I observed only short dwells. If it ever auto-plays, the tab
   would be decoding video with nobody watching — worth a longer-dwell
   check before relying on this for battery/CPU.
2. **That `Page.navigate` during teardown never races a concurrent
   tune.** `start()` awaits `this.starting`, and the watchdog only fires
   when `!this.live`, so a park and a new tune should not overlap; but I
   did not construct an adversarial interleave test. The navigation is
   idempotent (a new tune just navigates again), so a race would at worst
   cost one extra navigation.

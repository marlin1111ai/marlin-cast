Task 028: YouTube TV quality now follows the capture height; pushed and published

Steps 1–4 are done and the VERIFY runs passed. With MC_WIDTH=1280 MC_HEIGHT=720, the output is 1280×720 and YouTube TV settles at hd720 with no warning. With no size env set, behaviour is the same as before, and the Unraid container sets none. Everything the test used has been torn down and deleted, and the backup's sha256 is unchanged.

One thing needs your attention: in Run B2 (the 1280×720 display), both Philo tunes logged "the control overlay did NOT clear after 3 pointer sweeps". Details are in the open questions.

Files touched

┌──────┬────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────┐
│ Step │            File            │                                         Change                                         │
├──────┼────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
│      │                            │ Poll 4's ladder starts at the highest level whose height is ≤ MC_HEIGHT: 1080 or more  │
│ 1    │ src/providers/youtubetv.ts │ gives hd1080 (the same ladder and warning text as before), 720–1079 gives hd720, below │
│      │                            │  144 gives tiny. is1080 and the warning compare against that starting level.           │
├──────┼────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
│ 2    │ notebook/DECISIONS.md      │ D028 in your wording, plus how it's built and the A/B/B2 results.                      │
├──────┼────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
│      │                            │ D028 in the list; "(hd720 when MC_HEIGHT=720)" on the pin fact; the four env knobs     │
│ 3    │ MARLIN-CAST-BRIEF.md       │ with defaults; the QNAP install as one bullet; the unchecked shm_size under open       │
│      │                            │ questions.                                                                             │
└──────┴────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────┘

No new env var. Nothing changed in MC_WIDTH/MC_HEIGHT/MC_FPS/MC_XVFB_SCREEN, the bitrate, Philo or the entrypoint.

Runs A / B / B2

The test used the image built locally from this change and the 2026-09-13 two-provider backup as /data. Both providers were signed in, and first boot enumerated 375 channels (YouTube TV 141, Philo 234). CPU is % of one core on marlinpc, so compare runs with each other, not with the QNAP. "HLS / wall" is media added to the playlist over the 60 s, divided by elapsed time.

┌────────────┬──────────┬───────────┬─────────────────┬──────────────────┬────────────────────┬────────┬────────┬──────────┐
│    Run     │ Channel  │  Output   │ Quality (status │     Warning      │ Container (docker  │ Chrome │ ffmpeg │  HLS /   │
│            │          │           │      page)      │                  │       stats)       │        │        │   wall   │
├────────────┼──────────┼───────────┼─────────────────┼──────────────────┼────────────────────┼────────┼────────┼──────────┤
│ A          │ WBAL 11  │ 1920×1080 │ hd1080          │ none             │ 373%               │ 235%   │ 136%   │ 0.992    │
├────────────┼──────────┼───────────┼─────────────────┼──────────────────┼────────────────────┼────────┼────────┼──────────┤
│ B          │ WBAL 11  │ 1280×720  │ hd720           │ none             │ 280%               │ 190%   │ 78%    │ 1.005    │
├────────────┼──────────┼───────────┼─────────────────┼──────────────────┼────────────────────┼────────┼────────┼──────────┤
│ B2         │ WBAL 11  │ 1280×720  │ hd720           │ none             │ 270%               │ 183%   │ 76%    │ 1.006    │
├────────────┼──────────┼───────────┼─────────────────┼──────────────────┼────────────────────┼────────┼────────┼──────────┤
│ A          │ Philo    │ 1920×1080 │ 720p            │ D017 upscale     │ 253%               │ 132%   │ 116%   │ 1.010    │
│            │ AMC      │           │                 │                  │                    │        │        │          │
├────────────┼──────────┼───────────┼─────────────────┼──────────────────┼────────────────────┼────────┼────────┼──────────┤
│ B          │ Philo    │ 1280×720  │ 720p            │ D017 upscale     │ 189%               │ 122%   │ 65%    │ 0.991    │
│            │ AMC      │           │                 │                  │                    │        │        │          │
├────────────┼──────────┼───────────┼─────────────────┼──────────────────┼────────────────────┼────────┼────────┼──────────┤
│ B2 (1st    │ Philo    │ 1280×720  │ 720p            │ D017 upscale +   │ 178%               │ 111%   │ 56%    │ 0.991    │
│ tune)      │ AMC      │           │                 │ overlay          │                    │        │        │          │
├────────────┼──────────┼───────────┼─────────────────┼──────────────────┼────────────────────┼────────┼────────┼──────────┤
│ B2 (2nd    │ Philo    │ 1280×720  │ 720p            │ D017 upscale +   │ 185%               │ 123%   │ 65%    │ 1.007    │
│ tune)      │ AMC      │           │                 │ overlay          │                    │        │        │          │
└────────────┴──────────┴───────────┴─────────────────┴──────────────────┴────────────────────┴────────┴────────┴──────────┘

- WBAL offered hd1080 in every run. In B and B2 the tune still targeted hd720, with the player filling the 1280×720 viewport.
- 720p cut WBAL's CPU: container −25%, Chrome −19%, ffmpeg −43% against A.
- B2 saved almost nothing over B: about 4% on WBAL and 2% on Philo, which is within run-to-run noise.
- Both providers worked on the 1280×720 display. Both tabs were present in the entrypoint's stage 3 and in Chrome's own tab list, and both tunes succeeded.

Pushed and published

- Commit: local c876a3a4930d… = origin/main after git fetch (match).
- Workflow run: "Publish image" completed with success, 22:20:56Z → 22:23:14Z (github.com/marlin1111ai/marlin-cast/actions/runs/36275977847).
- New tag: sha-c876a3a, also on latest, created 22:22:20Z with revision label c876a3a….
- Rollback tag: sha-e28689d (2026-09-13), still in GHCR. The two commits in between changed only notebook and markdown files, so they built no image.

Open questions

1. Philo overlay on the small display. Both B2 Philo tunes logged "the control overlay did NOT clear after 3 pointer sweeps" and took 14–15 s to stream, against 4–6 s in A and B. Both landed in an ad break. The frames show Philo's "Advertisements · LIVE" label for the length of the ad and a clean picture after it, so the ad break is the likelier cause. I can't rule out the 1280×720 display, because I didn't keep the [philo] log lines from A and B before removing those containers. As instructed, I changed nothing.
2. Philo's warning is wrong in 720p mode. It reads "capturing 1280x720 upscaled into the 1280x720 frame", but nothing is upscaled. Philo was out of scope, so I left it. The fix would be one line in philo.ts.
3. Will 720p stop the slow motion on the QNAP? Scaling marlinpc's −25% onto 97% suggests about 73%, but that hasn't been measured there. It needs MC_WIDTH/MC_HEIGHT added to the QNAP compose file and a real playback test.
4. shm_size on Container Station is still unchecked (it's now in the brief).
5. I didn't add a SESSION-STATE entry or a report file, because neither was asked for this time.

What I'm least sure of

- The CPU numbers are single 60 s windows on live content (golf on WBAL; a movie or ads on AMC), and I didn't measure repeatability. The one repeat, B2 Philo, read 178% and 185%. The 4% difference between B and B2 is inside that spread.
- is1080 now means "reached the top of the ladder". At 720p it reads true, and the field name no longer says what it means.

Left on marlinpc: the image marlin-cast:task028 in the local Docker cache.

---

**Note (2026-09-26):** closed by D029 — line 66 (the Philo overlay sweep); line 67 (Philo's 720p warning — left as is, known and not fixed).

**Note (2026-09-26):** closed by D030 — lines 68 (QNAP at 720p — Philo History played at normal speed, owner), 74 (CPU figures are single windows), 75 (the `is1080` name).

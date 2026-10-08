# OPEN-ITEMS.md

**2026-09-26:** All items settled; see D030.

**2026-10-07:** one item open — the Philo stuck control overlay, below.
Owner: record it, do not work on it yet.
**2026-10-08:** a second item — Philo's guide found in front on Unraid.

Fresh as of 2026-09-11, at project creation. Contains only genuinely
live items for this project. See DECISIONS.md for standing rules.

---

## Open since 2026-10-07

- **Unraid, 0.1.3: Philo's guide was in front at 09:41 EDT on 2026-10-08**,
  not YouTube TV Library, after the owner clicked the Philo tab in the
  viewer at 09:26 and then played channels in Marlin DVR. Philo's guide in
  front idles at about a fifth of a core (recon-idle), so it matters. Cause
  not known; the owner has three read-only commands to run and their output
  is pending. The candidate readings are listed in `notebook/SESSION-STATE.md`
  ("Wrap 2026-10-08"); one of them is a design gap found by reading the
  code — only a Philo stop brings YouTube TV forward, so a manual switch to
  Philo during a YouTube TV capture is not undone by that capture's stop.

- **Philo: the control overlay sometimes does not clear (task-021).** After
  the autoplay click, the app sweeps the pointer up to three times until
  Philo hides the player's title bar, scrubber and button row. When it does
  not clear, the tune takes about 11 s longer (12–16 s to playing instead
  of 3–5 s) and those controls are burnt into the capture. Closed by D029
  as "whether the Philo overlay sweep holds up over many tunes — reopen if
  seen"; it has now been seen.
  - Counts on 2026-10-07, test containers on marlinpc (recon-idle E and
    the D038 acceptance): 0 of the day's first 13 Philo tunes stuck; then
    2 of 6; then 3 of 20 and 9 of 20 in two side-by-side passes (16:00–16:39Z).
    The rate rose through the afternoon and stuck tunes came in runs, in
    both the hidden-start and visible-start arms (hidden 7 of 20, visible
    5 of 20).
  - Lead, not verified: the D028 note (2026-09-26) records the only two
    earlier stuck overlays, on the QNAP-style 720p runs, and both had landed
    in an ad break ("Advertisements · LIVE / Fast Forward Restricted"), also
    14–15 s to stream. Today's stuck tunes were not checked for ads.
  - Owner's ruling (2026-10-07): keep the D038 bring-forward; record this
    item and look at it later. Not worked on.

---

## Live items (2026-09-11; all settled by D030)

- **MARLIN-CAST-BRIEF.md was never supplied.** D001–D006 are
  unrecorded and `notebook/BRIEF-v1.md` does not exist. Blocks nothing
  mechanical, but the project has no written statement of its own
  goal. See notebook/reports/task-001-kickoff.md.
- **Manual YouTube TV login (Task 001 step 5e) not completed.** The
  owner must log in by hand over Jump Desktop on display :10. Until
  then the persistence proof and the whole of the logged-in
  investigation (5f) are unobserved.
- **Capture method undecided.** Task 001 step 5g recommends the
  extension tab-capture path; the owner rules. See the report.
- **Playwright vs puppeteer-stream.** The recommended capture path has
  no Playwright equivalent today. See OPEN QUESTIONS in the report.

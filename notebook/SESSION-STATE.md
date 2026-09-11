# SESSION-STATE.md

Updated 2026-09-11. This is a cold-start brief for the Marlin Cast
project. See DECISIONS.md for the standing rules that govern every
session.

---

## Where things stand

Nothing existed before 2026-09-11. Task 001 created the repo and the
scaffold; no application code beyond a single manual-login launcher
exists, and no capture code exists by design (Task 001 scope lock).

---

## Task 001 — kickoff: scaffold, login, investigation (2026-09-11)

Repo initialized on main at /Apps/marlin-cast, origin set to
https://github.com/marlin1111ai/marlin-cast.git (remote pre-existed and
was empty; not created by this task).

Scaffold: package.json pinned to exactly four dependencies —
playwright, express, typescript, tsx — plus .gitignore, a gitignored
data/chrome-profile/, and src/login.ts as the only file in src/.

Prerequisites all present on marlinpc: Node v22.23.2, ffmpeg 6.1.1,
git 2.43.0, Google Chrome 153.0.8010.36, /dev/dri with card0 and
renderD128. Recorded in the Task 001 report as command output.

**The live X display on this machine is :10, not :0.** :0 belongs to
the cosmic-greeter login screen; :10 is the xrdp Xorg session the
owner reaches with Jump Desktop. Anything that needs to put a window
in front of the owner uses DISPLAY=:10.

**Playwright drives the real Chrome successfully and YouTube TV serves
it the normal site** — no unsupported-browser wall, no bot wall, and
Widevine L3 (com.widevine.alpha, SW_SECURE_CRYPTO) is available.
Widevine L1 (HW_SECURE_ALL) is not. navigator.webdriver reports true.

**Two things did not happen and are not deferred quietly:**
MARLIN-CAST-BRIEF.md was never supplied, so D001–D006 are unrecorded
and notebook/BRIEF-v1.md does not exist. And the manual login (5e)
needs the owner at a Jump Desktop session, so login persistence and
the entire logged-in investigation (5f) are unobserved. The capture
comparison (5g) was completed by reading PrismCast's source and is
the substantive finding of this task.

See notebook/reports/task-001-kickoff.md.

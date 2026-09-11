# DECISIONS.md

This file starts fresh on 2026-09-11 with the creation of the Marlin
Cast project. It covers this project only. See the Marlin IPTV Editor
project's own notebook for anything belonging to that project —
nothing is carried over here.

Numbering starts at D001. Each entry is a decision, correction, or
standing rule, owner-ruled or owner-confirmed unless marked otherwise.

---

## D001 — Name

Name: Marlin Cast. Repo `marlin1111ai/marlin-cast`, container
`marlin-cast`.

**Dated 2026-09-11.**

---

## D002 — First provider

First provider: YouTube TV (tv.youtube.com). One provider to start.

**Dated 2026-09-11.**

---

## D003 — Stack

Stack: Node.js 22 + TypeScript, Playwright driving installed Google
Chrome, ffmpeg. Not Go, not Python.

**Dated 2026-09-11.**

---

## D004 — Where development happens

Where development happens: on the Mac, with software (CPU) encoding.
Hardware encoding (Intel Quick Sync / VAAPI on the Unraid box's UHD
770) is wired and tested only at deploy time, by the owner, on Unraid.

**Dated 2026-09-11. SUPERSEDED by D007** — development moved to
marlinpc (Linux), and VAAPI is tested during development.

---

## D005 — Sessions

Sessions: one login session, one channel playing at a time. No
multi-session, no concurrent tunes. Not to be revisited.

**Dated 2026-09-11.**

---

## D006 — Output contract

Output contract: an M3U playlist at `/playlist` listing channels, each
pointing at an HLS stream served by Marlin Cast; consumed by Channels
DVR as a Custom Channels source (Stream Format HLS, stream limit 1).
Guide data comes from Channels DVR's own Gracenote matching — Marlin
Cast produces no XMLTV.

**Dated 2026-09-11.**

---

## D007 — Development host

Development host (owner, 2026-09-11): development happens on marlinpc
(Pop!_OS 24.04, Linux x86_64), not the Mac. This supersedes D004's "on
the Mac, with software (CPU) encoding." Hardware encoding via VAAPI on
marlinpc's /dev/dri is tested during development, not deferred to
deploy. D004's deferral existed only because the Mac had no /dev/dri.
Deploy target is unchanged: Unraid Docker with --device /dev/dri.

**Dated 2026-09-11.**

---

## D008 — Dev server binding

Dev server binding (foreman's contained call, 2026-09-11): the dev
server binds 0.0.0.0:8804 so the owner can reach it from the Mac at
http://<marlinpc-LAN-IP>:8804. Unraid container port remains 8091.
Never bind 3000, 5173, 5188, 5189, 8420, 8800, 8801, 8802, 8803.

**Dated 2026-09-11.**

---

## D009 — Browser control method

Browser control method (owner, 2026-09-11): the app attaches to an
owner-launched Chrome over CDP (chromium.connectOverCDP), rather than
Playwright launching and owning the profile via
launchPersistentContext. Reason: CDP attach is the only tested
configuration reporting navigator.webdriver === false, and automation
detection is the best-supported remaining explanation for server-side
session invalidation (task-001c). The debug port binds loopback only
and is never published from the container. Supersedes the
launchPersistentContext approach in Task 001's src/login.ts.

**Dated 2026-09-11.**

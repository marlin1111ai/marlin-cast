# DECISIONS.md

This file starts fresh on 2026-09-11 with the creation of the Marlin
Cast project. It covers this project only. See the Marlin IPTV Editor
project's own notebook for anything belonging to that project —
nothing is carried over here.

Numbering starts at D001. Each entry is a decision, correction, or
standing rule, owner-ruled or owner-confirmed unless marked otherwise.

---

## D001–D006 — NOT RECORDED: source brief was not supplied

These six decisions are final per the owner and are to be copied
**verbatim** from `MARLIN-CAST-BRIEF.md`. That file was not present at
`/Apps/marlin-cast/MARLIN-CAST-BRIEF.md` when Task 001 ran, and no
copy was pasted. They are therefore **absent, not lost** — nothing was
guessed, inferred, or reconstructed.

Task 001's report records the only second-hand knowledge of them that
this session has: D007's own text states that D004 said "on the Mac,
with software (CPU) encoding" and deferred hardware encoding. That
fragment is quoted here solely because D007 quotes it — it is **not** a
reconstruction of D004 and must not be treated as one.

**Action required:** supply the brief; D001–D006 get pasted in above
D007, in order, verbatim.

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

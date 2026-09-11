# Task 004 — Profile portability

Date: 2026-09-11. Host: marlinpc. DISPLAY=:10.

**A copied profile carries the session. Path and ownership are
irrelevant. The only thing that destroys it is the password-store
scheme — and that destroys it completely.**

Every arm ran on its own fresh copy of the backup, on debug port 9444,
loopback only. The live session (Chrome pid 72933, `data/chrome-profile`)
was never launched against, never stopped, never modified. The backup
was read from and copied from, never launched against and never written
to. No login was performed; `accounts.google.com` was never navigated to.

---

## (i) Per-arm results

Baseline is the backup's own cookie store, read without launching
anything against it. Values were never read or printed — only counts,
names and the three-byte version tag.

| Arm | Setup | Attached | `webdriver` | State | rows | tags | persistent | auth-shaped |
|---|---|---|---|---|---|---|---|---|
| **baseline** | backup, not launched | — | — | — | **48** | `v11` | 47 | 17 |
| **A** | copy → working path, same uid, `gnome-libsecret` | yes | `false` | **SIGNED IN** | 48 | `v11` | 47 | 17 |
| **B** | copy → `/home/marlinai/mc-portability-armB/deeply/nested/profile-dir`, same uid, `gnome-libsecret` | yes | `false` | **SIGNED IN** | 48 | `v11` | 47 | 17 |
| **C** | copy → `gid=126(docker)`, mode `770`/`660`, `gnome-libsecret` | yes | `false` | **SIGNED IN** | 48 | `v11` | 47 | 17 |
| **D** | copy → `--password-store=basic` | yes | `false` | **SIGNED OUT** | **10** | **`v10`** | **9** | **0** |

Each arm cleared stale `Singleton*` locks before launch, dwelled 95 s
before any cookie read (KNOWN-FIXES: Chrome batches commits), was
stopped with `SIGTERM`, and was deleted afterwards.

**Arm C is a partial test and is reported as such.** Group ownership
and mode were changed — `gid` 1000 → 126, mode 775 → 770, `Cookies`
660 — but **uid could not be changed**, because that needs root and
step 3 forbids `sudo`. A volume mount can present a different uid, and
that case is **not observed**.

---

## (ii) Does a copied profile carry a session?

**Yes.** Three independent copies, at three different paths, one with
different group ownership and permissions, all attached and all read
**SIGNED IN** with a cookie store byte-for-byte equal to the baseline —
48 rows, all `v11`, 47 persistent, all 17 auth-shaped cookies intact.

This closes the largest open question from Task 003, which could only
show that a profile survives a restart **in place**. Copying is not the
hazard. A container that mounts this profile as a volume would not lose
the session by the act of mounting it.

---

## (iii) What breaks it

**Only the password-store scheme.** Nothing else tested made any
difference:

- **Path** — irrelevant. Arm B moved the profile to a different
  filesystem subtree, several directories deep, under a different name.
  Identical result.
- **Group ownership and permissions** — irrelevant. Arm C ran the
  profile group-owned by `docker` at mode 770. Identical result.
- **The copy itself** — harmless. Arm A is the control and matched the
  baseline exactly.
- **uid** — **not observed.** See (viii).

---

## (iv) The basic-scheme result, and whether migration is possible

### Arm D destroys the session outright

This is no longer the inference Task 003 flagged; it is measured:

```
ARM D (pre-launch)     rows=48   tags=v11   persistent=47   auth=17
ARM D (post-launch)    rows=10   tags=v10   persistent=9    auth=0
```

**All 17 auth-shaped cookies were destroyed by a single launch.** The
10 surviving rows are `v10` — fresh anonymous cookies written by the
logged-out visit, not survivors. The browser landed on
`tv.youtube.com/welcome/?...&rd_rsn=lo` — the logged-out redirect.

Chrome does not warn, does not fail to start, and does not degrade
gracefully. It starts cleanly, silently discards everything it cannot
decrypt, and the profile is then unrecoverable. This is the same
signature as the 001b incident, reproduced deliberately on a disposable
copy.

### Migration: no

**There is no supported path to re-encrypt `v11` rows as `v10` without
a fresh login.** Three things support this:

1. **Measured behaviour (Arm D).** Given a `v11` store and a `v10` key,
   Chrome dropped the rows rather than re-encrypting them. Re-encryption
   would require decrypting first, which is precisely what it cannot do.
2. **The scheme definitions.** `v10` means a hardcoded password; `v11`
   means a password held by an OS-level library (libsecret). The `v11`
   secret is a random value living in the host's keyring — it is not
   derivable, and `v11` is simply not used when no such library is
   available.
3. **No Chrome mechanism exists.** There is no flag, no command, and no
   documented migration. Third-party scripts exist that decrypt and
   re-encrypt the SQLite stores when moving a profile between machines,
   but they are unsupported, must run somewhere the source keyring
   secret is readable, and would have to cover `Login Data` and
   `Web Data` as well as `Cookies`.

Since a hand-login costs a few minutes and a migration script costs
correctness risk on the one asset that is hard to replace, **the answer
is: don't migrate, re-login in the target scheme.**

Sources: [Local Data Encryption in Chromium](https://textslashplain.com/2020/09/28/local-data-encryption-in-chromium/),
[Chromium: Linux, keyrings && Secret Service](https://rtfm.co.ua/en/chromium-linux-keyrings-secret-service-passwords-encryption-and-store/),
[chrome-macos-linux-migration](https://github.com/tsuna/chrome-macos-linux-migration),
[pycookiecheat #64 — can't decrypt v11](https://github.com/n8henrie/pycookiecheat/issues/64).

---

## (v) Keyring in a container — options, and my pick

Read-only research. **No container was created, nothing was installed,
and the Unraid host was not touched.**

**Option 1 — run gnome-keyring inside the container.** It does not need
X; D-Bus is enough. The pattern is `dbus-launch`, then
`gnome-keyring-daemon --unlock` fed a fixed password on stdin, then
`--start`, with the app sharing that D-Bus session. *Cost:* two extra
daemons in the image, an unlock password stored somewhere at rest, and
a documented fragility — sources note that as of GLib 2.70 some of the
mechanisms this relies on may no longer work. **And it does not by
itself solve the problem**: a fresh container keyring holds a *different*
random secret, so a host-made `v11` profile is still undecryptable. To
make it work you would also have to extract the host's "Chrome Safe
Storage" secret and plant it in the container keyring under the right
schema — handling the one secret that protects the session.

**Option 2 — `--password-store=basic` everywhere, and take the login in
that scheme.** No keyring, no D-Bus, no daemons, no secret to
transplant. *Cost:* `v10` is a hardcoded key, so the cookie store is
effectively plaintext to anyone who can read the volume — and the
current `v11` profile cannot be carried over, so the login must be
retaken in the target scheme.

**Option 3 — take the login inside the container** over a VNC/noVNC
session, as PrismCast does. This is orthogonal to the scheme question —
it decides *where* the login happens, not how it is encrypted — but it
pairs naturally with Option 2, since a profile born in the container is
born in the container's scheme.

**Pick: Option 2.** The single reason: it removes the keyring entirely,
and the keyring is the only thing this task measured to destroy the
session.

Sources: [Using GNOME Keyring in Docker Container](https://alex-ber.medium.com/using-gnome-keyring-in-docker-container-2c8a56a894f7),
[Arch forums — gnome-keyring in Docker](https://bbs.archlinux.org/viewtopic.php?id=283812).

---

## (vi) What this means for the Docker design

The portability half is settled and favourable: copying a profile,
moving it to another path, and handing it to a process with different
group ownership all preserve the session exactly, so a volume-mounted
profile is not itself a risk. The risk is entirely the encryption
scheme, and it is binary — Arm D shows a single launch under the wrong
scheme takes the store from 48 rows with 17 auth cookies to 10 rows
with none, silently and unrecoverably. Since a stock container has no
keyring, and since planting the host's keyring secret inside a container
is the only way to make the existing `v11` profile readable there, the
practical consequence is that **the profile now on this machine is not
the profile that will run in Docker.** Whichever scheme the container
uses, the login has to be taken in that scheme — either inside the
container, or on this host with `--password-store=basic` so that the
resulting profile is portable by construction. There is one cheap
option worth weighing: switching `scripts/start-chrome.sh` to `basic`
and spending one more hand-login now would produce a profile that moves
to Unraid unchanged, at the cost of a `v10` store on this host. That is
a decision, not a finding, and nothing was changed.

---

## (vii) Files touched

| File | Step | Change |
|---|---|---|
| `notebook/reports/task-004-profile-portability.md` | 8 | this report |
| `notebook/SESSION-STATE.md` | house convention | Task 004 entry |
| `notebook/KNOWN-FIXES.md` | house convention | the basic-scheme destruction, now measured rather than inferred |

`src/login.ts`, `scripts/start-chrome.sh`, `package.json` and
`.gitignore` were **not modified**. No capture code, no ffmpeg, no
encoder, no HLS server, no `/playlist`, no Dockerfile, no workflow, no
new dependencies, no Xvfb, no window sizing. No container was built or
run. Nothing binds 8804.

**Arm copies:** all four created under the session scratchpad and
`/home/marlinai/mc-portability-armB`, all deleted (step 9). None were
ever in the repo.

### Live profile and backup — state check

| | At task start | At task end |
|---|---|---|
| `data/chrome-profile` cookie rows/tags/persistent/auth | 48 / `v11` / 47 / 17 | **48 / `v11` / 47 / 17** |
| `data/chrome-profile/Default/Cookies` mtime | 10:25:45 | **10:36:30** |
| live file count | 3130 | 4792 |
| Chrome pid 72933 | alive, signed in | **alive, signed in** |
| backup `Cookies` mtime | 10:14:41 | **10:14:41 (unchanged)** |
| backup rows/tags/persistent/auth | 48 / `v11` / 47 / 17 | **48 / `v11` / 47 / 17** |

**The live profile's mtime and file count did move, and I want to be
exact about why.** Chrome pid 72933 has been running on that profile
throughout — a live browser continuously writes cache, favicons and
metadata, and step 9 itself requires attaching to prove the session is
still signed in, which loads a page and causes writes. **Nothing in
this task launched a second Chrome against that profile or modified it
directly.** The invariant that matters is unchanged: the cookie store
still holds exactly 48 rows, all `v11`, 47 persistent, 17 auth-shaped,
and an attach still reports `signed in`. The backup is untouched to the
nanosecond.

---

## (viii) Least certain

1. **uid was never changed.** Arm C varied group and mode but not uid,
   because that needs root and `sudo` is forbidden. A Docker volume
   commonly presents files owned by a *different uid*, and if Chrome
   cannot write the profile it will behave differently from anything
   measured here. This is the remaining portability unknown, and it is
   testable inside a container without risking the live profile.

2. **The keyring-in-container research is reading, not running.** I did
   not build an image, start a container, or watch `gnome-keyring-daemon`
   succeed or fail. The GLib 2.70 caveat came from a secondary source
   and is not something I verified. Option 2 is recommended partly
   because it needs none of that to be true.

3. **Arm D may understate the damage.** I measured the cookie store. A
   scheme mismatch also affects `Login Data` and `Web Data`, which I did
   not inspect, so "17 auth cookies destroyed" is a floor on what a
   wrong-scheme launch costs, not a ceiling.

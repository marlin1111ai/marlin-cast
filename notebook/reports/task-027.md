# Task 027 — deployed: D026, D027; status page lists four URLs (2026-09-13)

Date: 2026-09-13 ~10:05–10:25 EDT. Host: marlinpc. Nothing on 192.168.1.250
was contacted (that address appears below only as a `Host:` header sent to
127.0.0.1); `backups/`, `data/`, `/tmp/mc-test`, the live Chrome (still quit),
`extension/`, `Dockerfile` and `docker/entrypoint.sh` were not touched. No host
installs. The V1 container ran on an empty throwaway profile under the session
scratchpad with no login of any kind; `VNC_PASSWORD` came from a 0600 scratch
file; the file and the throwaway data were deleted afterwards.

**Result: steps 1–5 done; V1 passes (via the built image — the dev server does
not start without Chrome); V2 below.**

---

## Result per step

| Step | Result |
|---|---|
| 1 status page | done — the URLs section lists `/playlist`, `/playlist/youtube-tv`, `/playlist/philo`, `/health`, each built from the request Host (`baseUrl(req)`), each with the existing copy button. The two per-provider lines are generated from the provider registry's `slug`s (`youtube-tv`, `philo` — the same values the `/playlist/:slug` route matches, D021), in registry order. No other page change: status table, styles, script unchanged; the section comment updated to match |
| 2 DECISIONS | done — D026 (Deployed), D027 (repo public), note under D014 (GPU decode test on Unraid open; CPU decode/encode today); all dated 2026-09-13, owner-ruled |
| 3 KNOWN-FIXES | done — "Unraid fetches the container icon at Apply time — serve it from the public repo, not from the container" |
| 4 SESSION-STATE | done — "Where things stand" rewritten to the deployed state: D026 summary, marlinpc dev-only, open/parked list (GPU decode open; Fios parked — recon-fios + fios-splash; stale-watch-id parked, D020 note; Channels defect parked, D016), and the owner's `sudo rm -rf /tmp/mc-test` (profile copy owned by 99:100). The old two-line starting-point paragraph is kept under its own heading. Task 027 record appended |
| 5 VERSION | done — `0.1.1` → `0.1.2` |

### Files touched

| File | Step |
|---|---|
| `src/server.ts` | 1 — one template line + the section comment (+3/−2 in total) |
| `notebook/DECISIONS.md` | 2 |
| `notebook/KNOWN-FIXES.md` | 3 |
| `notebook/SESSION-STATE.md` | 4 |
| `VERSION` | 5 |
| `notebook/reports/task-027.md` | report |

One reading to flag: the SESSION-STATE brief said "recon-fios". No
`notebook/reports/recon-fios.md` exists (reports has `fios-splash.md` and a
`fios-splash/` directory), so the state names "recon-fios" as given and links
only the file that exists.

---

## V1 — status page shows the four URLs with the request host

### Dev server: does not start without Chrome

Chrome is down (no chrome process; nothing on 8804/9333/8091/8092). To try
the dev server without reading `data/`, it was started with `MC_DATA_DIR`
pointing at a scratch directory holding a synthetic zero-channel
`channels.json`:

```
$ MC_DATA_DIR=<scratch> timeout 25 npx tsx src/server.ts
channels: 0 (enumerated 2026-09-13T00:00:00.000Z) {}
TypeError: fetch failed
    at async Function.attach (/Apps/marlin-cast/src/cdp.ts:37:21)
    at async Pipeline.connect (/Apps/marlin-cast/src/capture.ts:113:16)
    at async <anonymous> (/Apps/marlin-cast/src/server.ts:44:17) {
  [cause]: Error: connect ECONNREFUSED 127.0.0.1:9333
exit 1
```

The server attaches to Chrome before it listens (`src/server.ts:44`), so it
exits and nothing binds 8804. **Not started; verified through the built image
instead, as in task-026 V1.**

### Built image on a throwaway profile

`docker build -t marlin-cast:task027 .` → `882cc794bf31` (18 s, cached layers
up to `COPY src`; 592,613,853 bytes by `docker image inspect`, task-026's was
592,613,817).

Run: `--cap-add SYS_ADMIN --shm-size=1g -p 8091:8804 -p 8092:6080
-v <scratch>/data:/data -e PUID=1000 -e PGID=1000 -e VNC_PASSWORD=…`, where
`/data` held an **empty** `chrome-profile/` and a synthetic zero-channel
`channels.json` (cache-present branch, no login). PUID/PGID were set to this
account so the entrypoint did not re-own the scratch directory to 99:100 and
it could be deleted afterwards — the `/tmp/mc-test` problem, not repeated.

```
[entrypoint] stage 3 ready: Chrome/153.0.8010.36 on 127.0.0.1:9333 (loopback), tabs: tv.youtube.com, www.philo.com
[entrypoint] stage 4 ready: noVNC on 0.0.0.0:6080 -> x11vnc 127.0.0.1:5900 (password required)
[login] youtubetv: tv.youtube.com: SIGNED OUT
[login] philo: www.philo.com: SIGNED OUT (…)
[entrypoint] stage 7 ready: app on 0.0.0.0:8804 (pid 712); channels: 0 state: idle
```

Both providers SIGNED OUT is expected on an empty profile; nothing was tuned.

**`GET http://127.0.0.1:8091/`** → `HTTP/1.1 200 OK`; the URLs section:

```html
<div class="u"><code id="http://127.0.0.1:8091/playlist">http://127.0.0.1:8091/playlist</code><button type="button" data-url="http://127.0.0.1:8091/playlist">Copy</button></div>
<div class="u"><code id="http://127.0.0.1:8091/playlist/youtube-tv">http://127.0.0.1:8091/playlist/youtube-tv</code><button type="button" data-url="http://127.0.0.1:8091/playlist/youtube-tv">Copy</button></div>
<div class="u"><code id="http://127.0.0.1:8091/playlist/philo">http://127.0.0.1:8091/playlist/philo</code><button type="button" data-url="http://127.0.0.1:8091/playlist/philo">Copy</button></div>
<div class="u"><code id="http://127.0.0.1:8091/health">http://127.0.0.1:8091/health</code><button type="button" data-url="http://127.0.0.1:8091/health">Copy</button></div>
```

**Same request sent with `Host: 192.168.1.250:8091`** (what a browser on the
LAN sends to Unraid): all four read `http://192.168.1.250:8091/…`, with the
same four copy buttons carrying those URLs.

**Each listed URL answers** (through 8091):

| URL | status | type |
|---|---|---|
| `/playlist` | 200 | `application/x-mpegurl` |
| `/playlist/youtube-tv` | 200 | `application/x-mpegurl` |
| `/playlist/philo` | 200 | `application/x-mpegurl` |
| `/health` | 200 | `text/plain` |

(Playlists are empty bodies apart from `#EXTM3U` — zero-channel cache.)

**Stop:** `docker stop` 1.36 s; `app stopped`, `chrome stopped`, `novnc
stopped`, `x11vnc stopped`, `xvfb stopped`, `shutdown complete: no
chrome/Xvfb/ffmpeg/x11vnc/websockify/node left`; host `ps`: none. Container
removed; scratch data and the password file deleted.

Not verified in V1: the copy buttons clicked in a real browser (the button
markup and the click script are the unchanged task-era code; only two more
instances of the same `url()` helper were added).

## V2 — GHCR image for this commit

Push `e28689d` left marlinpc at 14:18:33Z. The repo is public now (D027:
`GET api.github.com/repos/marlin1111ai/marlin-cast` answers 200
unauthenticated), so for the first time the Actions run itself was readable:

| | |
|---|---|
| Actions run | `Publish image`, event `push`, **completed / success**, created 14:18:35Z, updated 14:19:27Z (52 s) — github.com/marlin1111ai/marlin-cast/actions/runs/34762285786 |
| `sha-e28689d` tag | present at 14:19:33Z (`docker manifest inspect`, polled every 15 s) |
| `latest` after pull | image `259873e4…`, created **2026-09-13T14:19:15Z — 42 s after the push** |
| `org.opencontainers.image.revision` | `e28689d3ee53469a3a3e72b3bd54d7c5f7a05b0b` — this commit |
| content check | `/app/src/server.ts:302` in the pulled image is the new `PROVIDERS.map(… /playlist/${p.slug} …)` line |

**V2 passes.** Unraid's `latest` now carries the four-URL page; it reaches
the running container when the owner updates it on Unraid (not done here —
192.168.1.250 is out of scope).

## Pushed

- `e28689d` — `src/server.ts`, `VERSION`, `notebook/DECISIONS.md`,
  `notebook/KNOWN-FIXES.md`, `notebook/SESSION-STATE.md`, this report (V1).
  `git fetch`: HEAD = `origin/main` = `e28689d3ee53…` (MATCH). This is the push
  that produced `latest` and `sha-e28689d`.
- A notebook-only follow-up adds the V2 evidence above; `paths-ignore`
  publishes nothing for it (SHA in the hand-off).
- **No `v0.1.2` git tag was pushed** — the task asked for the VERSION bump
  only; per D025 the `0.1.2` image tag is published by `git tag v0.1.2 && git
  push origin v0.1.2` when the owner wants it.

## Left behind on marlinpc

- Image `marlin-cast:task027` in the local Docker cache; `ghcr.io/…:latest`
  re-pulled to `259873e4…`. No container.
- `/tmp/mc-test` unchanged, still 99:100 — owner's `sudo rm -rf /tmp/mc-test`.
- Live Chrome still quit; dev server not running.

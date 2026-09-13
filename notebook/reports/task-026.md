# Task 026 — app icon at /icon.png; viewer opens at / (2026-09-13)

Date: 2026-09-13 08:29–08:45 EDT (12:29–12:45Z). Host: marlinpc. Nothing on
192.168.1.250 was contacted; `backups/`, `data/`, `/tmp/mc-test`, the live
Chrome (still quit) and `extension/` were not touched. No host installs. The
V1 container ran on an empty throwaway profile under the session scratchpad
with no login of any kind; `VNC_PASSWORD` came from a 0600 scratch file that
was deleted afterwards.

**Result: steps 1–3 done; V1 passes; V2 evidence below.**

---

## Result per step

| Step | Result |
|---|---|
| 1 icon | done — `/home/marlinai/marlincast.png` (PNG, 512×512 RGBA, 239,699 bytes) copied to `assets/icon.png`, same sha256 `3387b83ff001c125d49d73ae88627e27416a2dd0767256547f1add058483fc61`; `COPY assets ./assets` in the Dockerfile; `GET /icon.png` in `src/server.ts` via `res.sendFile` (Content-Type from the extension) with `cache-control: public, max-age=86400` |
| 2 viewer | done — the entrypoint builds `/tmp/marlin-cast/novnc-web` at start: a symlink per entry of `/usr/share/novnc` plus an `index.html` that forwards to `vnc.html` (meta refresh + JS that keeps the query string and hash); websockify's `--web` points there. The package directory is unmodified; ports, auth, x11vnc flags unchanged |
| 3 notebook | done — KNOWN-FIXES entry (websockify lists the directory at `/`); SESSION-STATE record; `VERSION` 0.1.0 → 0.1.1 |

### Files touched

| File | Step |
|---|---|
| `assets/icon.png` | 1 (new) |
| `src/server.ts` | 1 — `ROOT` import, `ICON` path, `GET /icon.png` route |
| `Dockerfile` | 1 — one `COPY assets ./assets` line |
| `docker/entrypoint.sh` | 2 — web root construction before the websockify line |
| `VERSION` | 3 (`0.1.1`) |
| `notebook/KNOWN-FIXES.md`, `notebook/SESSION-STATE.md` | 3 |
| `notebook/reports/task-026.md` | report |

Why a scratch web root rather than a redirect: websockify (0.10, the Ubuntu
package) has no redirect or index option and serves `--web` with Python's
`SimpleHTTPRequestHandler`, which does honour an `index.html`. Writing one
into `/usr/share/novnc` would modify a root-owned package directory at every
start; symlinks in scratch leave the package alone and cost nothing.

---

## V1 — build, run on a throwaway profile, curl, stop

`docker build -t marlin-cast:task026 .` → `11e60d7228d4`. In the image:
`/app/assets/icon.png` 239,699 bytes; `/entrypoint.sh` carries the web-root
block.

Run: `--cap-add SYS_ADMIN --shm-size=1g -p 8091:8804 -p 8092:6080
-v <scratch>/data:/data -e VNC_PASSWORD=…` (D024 item 8), where `/data`
held an **empty** `chrome-profile/` and a synthetic zero-channel
`channels.json` so stage 6 took the cache-present branch and the app
started without any login. Every stage reached ready; both providers
reported **SIGNED OUT** (expected on an empty profile) and the entrypoint's
loud warning fired; nothing was tuned.

```
[entrypoint] stage 4 ready: noVNC on 0.0.0.0:6080 -> x11vnc 127.0.0.1:5900 (password required)
[entrypoint] stage 7 ready: app on 0.0.0.0:8804 (pid 728); channels: 0 state: idle
```

**`curl -I http://127.0.0.1:8091/icon.png`:**

```
HTTP/1.1 200 OK
cache-control: public, max-age=86400
Accept-Ranges: bytes
ETag: W/"3a853-1a09abf7228"
Content-Type: image/png
Content-Length: 239699
```

Body fetched: 239,699 bytes, sha256 equal to `assets/icon.png` and to the
owner's source file.

**`curl -I http://127.0.0.1:8092/`:**

```
HTTP/1.1 200 OK
Server: WebSockify Python/3.12.3
Content-type: text/html
Content-Length: 295
```

Body is the forwarding page (`<meta http-equiv="refresh" content="0;
url=vnc.html">` plus `location.replace("vnc.html" + location.search +
location.hash)` and a plain link as fallback). Through the same root:
`/vnc.html` → 200 (96 lines mentioning noVNC), `/app/ui.js` → 200 — the
symlinks resolve.

**Stop:** `docker stop` 1.36 s, exit 0; `app stopped`, `chrome stopped`,
`novnc stopped`, `x11vnc stopped`, `xvfb stopped`, `shutdown complete: no
chrome/Xvfb/ffmpeg/x11vnc/websockify/node left`; host `ps`: no chrome, Xvfb,
ffmpeg, x11vnc or websockify. Container removed.

Not verified in V1: the viewer through a real browser (task-024 V3 did that
with `vnc.html` directly; the forward is a one-line meta refresh).

## V2 — GHCR image for this commit

Push `15b835a` left marlinpc at 12:33:12Z. Probed as in task-025 V2 (the
daemon's stored GHCR login; `gh` not installed, repo private):

| | |
|---|---|
| `sha-15b835a` tag | present at 12:34:47Z (first probe that found it) |
| `latest` after pull | image `8a585a17…`, created **2026-09-13T12:34:39Z — 87 s after the push** (the GHA layer cache from task-025 was warm; task-025's first build took 1 min 56 s) |
| `org.opencontainers.image.revision` | `15b835a385378d4b28f47cccd80dd10d24609461` — this commit |
| content check | `/app/assets/icon.png` 239,699 bytes; `/entrypoint.sh` carries the web-root block |

The package is still private (task-025 V2); making it public remains the
owner's step.

## Pushed

- `15b835a` — `assets/icon.png`, `src/server.ts`, `Dockerfile`,
  `docker/entrypoint.sh`, `VERSION`, KNOWN-FIXES, SESSION-STATE, this
  report. `git fetch`: HEAD = `origin/main` = `15b835a3…` (MATCH). This is
  the push that produced `latest` and `sha-15b835a`.
- A notebook-only follow-up adds the V2 evidence above; `paths-ignore`
  publishes nothing for it (SHA in the hand-off).

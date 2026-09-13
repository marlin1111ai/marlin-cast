#!/usr/bin/env bash
# Marlin Cast container entrypoint (task-024, D024).
#
# Stages, each gated on a readiness check before the next starts:
#   0. VNC_PASSWORD present; PUID/PGID user; /data ownership; scratch dirs
#   1. stale Singleton* locks removed from the profile (task-003)
#   2. Xvfb :99 at 1920x1080 — tab capture follows the display (brief, KNOWN-FIXES)
#   3. Chrome, with exactly scripts/start-chrome.sh's flags and both provider
#      tabs (D009/D010/D018); ready = /json/version answers and both tabs exist
#   4. x11vnc (loopback) + noVNC on 6080 — the re-login viewer
#   5. session check (npm run login) — informational, loud if signed out
#   6. channel cache: enumerate on first boot if /data/channels.json is absent;
#      signed-out = loud FATAL, and the container STAYS UP with the viewer so
#      the owner can log in, then restart the container
#   7. the app on 8804; ready = /health answers
# SIGTERM/SIGINT: app -> Chrome (graceful, task-003) -> viewer -> Xvfb, each
# waited on, then a ps check that nothing is left. tini (PID 1) reaps orphans.
#
# Everything after stage 0 runs as PUID:PGID, never root.

set -uo pipefail

log()  { echo "[entrypoint] $*"; }
warn() { echo "[entrypoint] WARNING: $*" >&2; }
die()  { echo "[entrypoint] FATAL: $*" >&2; exit 1; }

# ---------------------------------------------------------------- stage 0 ---
if [ -z "${VNC_PASSWORD:-}" ]; then
  echo "[entrypoint] FATAL: VNC_PASSWORD is not set." >&2
  echo "[entrypoint]   The noVNC viewer (container port 6080) is the re-login path and" >&2
  echo "[entrypoint]   is never started without a password. Set -e VNC_PASSWORD=... and" >&2
  echo "[entrypoint]   start the container again. Nothing was started." >&2
  exit 1
fi

PUID="${PUID:-99}"
PGID="${PGID:-100}"
DATA_DIR="${MC_DATA_DIR:-/data}"
PROFILE="${DATA_DIR}/chrome-profile"
HLS_DIR="${MC_HLS_DIR:-/tmp/marlin-cast/hls}"
SCRATCH="/tmp/marlin-cast"
CHROME_LOG="${SCRATCH}/chrome.log"
export DISPLAY="${DISPLAY:-:99}"
CDP_PORT="${CDP_PORT:-9333}"
APP_PORT=8804
VNC_PORT=5900
NOVNC_PORT=6080
XVFB_SCREEN="${MC_XVFB_SCREEN:-1920x1080x24}"
HOME_DIR=/home/marlin

# The user the whole tree runs as. Ids are taken as given (Unraid's appdata
# convention is 99:100); names are only so Chrome and npm have a passwd entry.
if ! getent group "$PGID" >/dev/null; then groupadd -o -g "$PGID" marlin; fi
if ! getent passwd "$PUID" >/dev/null; then
  useradd -o -u "$PUID" -g "$PGID" -d "$HOME_DIR" -M -s /usr/sbin/nologin marlin
fi
RUN_USER="$(getent passwd "$PUID" | cut -d: -f1)"
mkdir -p "$HOME_DIR" "$PROFILE" "$HLS_DIR" "$SCRATCH" /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix
chown "$PUID:$PGID" "$HOME_DIR" "$SCRATCH" "$HLS_DIR"

# The profile volume must be writable by PUID (recon-docker Q4: the copy from
# marlinpc is uid 1000). Only re-own when the top level says it is wrong, so a
# normal boot does not walk the whole tree.
if [ "$(stat -c %u "$DATA_DIR")" != "$PUID" ] || [ "$(stat -c %u "$PROFILE")" != "$PUID" ]; then
  log "re-owning ${DATA_DIR} to ${PUID}:${PGID} (was $(stat -c %u:%g "$PROFILE"))"
  chown -R "$PUID:$PGID" "$DATA_DIR"
fi

# run_as: foreground, forks. run_as_bg: for `run_as_bg cmd &` — bash runs a
# backgrounded function in a subshell, so exec makes $! the real process pid
# rather than the subshell's (otherwise stop_pid would kill the wrapper and
# orphan Xvfb/Chrome — seen in the first smoke run).
run_as()    { setpriv --reuid="$PUID" --regid="$PGID" --clear-groups env HOME="$HOME_DIR" USER="$RUN_USER" "$@"; }
run_as_bg() { exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups env HOME="$HOME_DIR" USER="$RUN_USER" "$@"; }

log "user ${RUN_USER} (${PUID}:${PGID}); profile ${PROFILE}; hls ${HLS_DIR}; display ${DISPLAY} ${XVFB_SCREEN}"
[ -n "${MC_PROVIDERS:-}" ] && warn "MC_PROVIDERS=${MC_PROVIDERS} — provider list restricted (test knob; unset in production)"

# ---------------------------------------------------------------- stage 1 ---
# SIGTERM and unclean stops leave Singleton* behind; they encode the previous
# host's name and pid and a socket path in a /tmp that no longer exists
# (task-003 report, PrismCast does the same at startup).
removed=""
for f in SingletonLock SingletonCookie SingletonSocket; do
  if [ -e "$PROFILE/$f" ] || [ -L "$PROFILE/$f" ]; then rm -f "$PROFILE/$f"; removed="$removed $f"; fi
done
if [ -n "$removed" ]; then log "removed stale profile locks:${removed}"; else log "no stale profile locks"; fi

# ------------------------------------------------------------- shutdown -----
XVFB_PID=""; CHROME_PID=""; X11VNC_PID=""; NOVNC_PID=""; APP_PID=""
STOPPING=0

# A direct child that has exited is a zombie until waited on, and kill -0 on a
# zombie succeeds — so liveness reads the process state, and gone pids are
# reaped with wait.
alive() {
  local st
  st="$(ps -o stat= -p "$1" 2>/dev/null | tr -d ' ')"
  [ -n "$st" ] && [ "${st:0:1}" != "Z" ]
}

# kill -TERM a pid and wait up to $2 seconds; SIGKILL if still there.
stop_pid() {
  local pid="$1" secs="$2" name="$3" i
  [ -n "$pid" ] || return 0
  if ! alive "$pid"; then wait "$pid" 2>/dev/null; log "$name already gone"; return 0; fi
  kill -TERM "$pid" 2>/dev/null
  for ((i = 0; i < secs * 10; i++)); do
    if ! alive "$pid"; then wait "$pid" 2>/dev/null; log "$name stopped"; return 0; fi
    sleep 0.1
  done
  warn "$name did not exit in ${secs}s — SIGKILL"
  kill -KILL "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
}

shutdown() {
  local code="${1:-0}"
  [ "$STOPPING" = 1 ] && return
  STOPPING=1
  log "shutting down (exit ${code})"
  stop_pid "$APP_PID"    8 "app"      # its own handler stops ffmpeg (4 s grace) and detaches
  stop_pid "$CHROME_PID" 8 "chrome"   # graceful: the session survives SIGTERM (task-003)
  stop_pid "$NOVNC_PID"  2 "novnc"
  stop_pid "$X11VNC_PID" 2 "x11vnc"
  stop_pid "$XVFB_PID"   2 "xvfb"
  # Nothing of ours may survive: sweep everything still running as PUID
  # (Chrome's helpers, an ffmpeg, x11vnc), TERM then KILL. tini reaps.
  if pkill -TERM -u "$PUID" 2>/dev/null; then
    warn "processes still running as ${RUN_USER} after the ordered stop — signalled"
    sleep 2
    pkill -KILL -u "$PUID" 2>/dev/null && warn "…and SIGKILLed"
  fi
  sleep 0.5
  local left
  left="$(ps -eo pid,comm,args --no-headers | grep -E 'chrome|Xvfb|ffmpeg|x11vnc|websockify|node' | grep -v grep || true)"
  if [ -n "$left" ]; then warn "processes left after shutdown:"; echo "$left" >&2; else log "shutdown complete: no chrome/Xvfb/ffmpeg/x11vnc/websockify/node left"; fi
  exit "$code"
}
trap 'shutdown 0' TERM INT

# -------------------------------------------------------------- helpers -----
wait_for() {  # wait_for <seconds> <label> <command...>
  local secs="$1" label="$2"; shift 2
  local i
  for ((i = 0; i < secs * 5; i++)); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 0.2
  done
  warn "$label: not ready after ${secs}s"
  return 1
}

# ---------------------------------------------------------------- stage 2 ---
run_as_bg Xvfb "$DISPLAY" -screen 0 "$XVFB_SCREEN" -nolisten tcp -nocursor > "$SCRATCH/xvfb.log" 2>&1 &
XVFB_PID=$!
wait_for 10 "xvfb" test -S "/tmp/.X11-unix/X${DISPLAY#:}" || { cat "$SCRATCH/xvfb.log" >&2; shutdown 1; }
log "stage 2 ready: Xvfb ${DISPLAY} ${XVFB_SCREEN} (pid ${XVFB_PID})"

# ---------------------------------------------------------------- stage 3 ---
# scripts/start-chrome.sh is the single source of the Chrome flags (D009, D010,
# D018 tabs). MC_PROFILE points it at the volume; CDP_PORT and DISPLAY pass
# through. stderr goes to a file so the Fontconfig check below can read it.
MC_PROFILE="$PROFILE" CDP_PORT="$CDP_PORT" run_as_bg bash /app/scripts/start-chrome.sh > "$CHROME_LOG" 2>&1 &
CHROME_PID=$!
wait_for 60 "chrome cdp" curl -sf "http://127.0.0.1:${CDP_PORT}/json/version" \
  || { tail -n 40 "$CHROME_LOG" >&2; shutdown 1; }

# Both provider tabs must exist (D018: the app selects by URL host, no fallback).
tabs_ready() {
  node -e '
    const want = (process.env.MC_PROVIDERS || "youtubetv,philo").split(",").map(s => s.trim()).filter(Boolean)
      .map(p => ({ youtubetv: "tv.youtube.com", philo: "www.philo.com" })[p]).filter(Boolean);
    fetch("http://127.0.0.1:" + process.env.CDP_PORT + "/json/list").then(r => r.json()).then(list => {
      const hosts = list.filter(t => t.type === "page").map(t => { try { return new URL(t.url).host; } catch { return ""; } });
      const missing = want.filter(h => !hosts.includes(h));
      if (missing.length) { console.error("missing tabs: " + missing.join(", ") + " (open: " + hosts.join(", ") + ")"); process.exit(1); }
      console.log("tabs: " + want.join(", "));
    }).catch(e => { console.error(String(e)); process.exit(1); });'
}
export CDP_PORT
wait_for 60 "provider tabs" tabs_ready || { tabs_ready >&2; shutdown 1; }
CHROME_VERSION="$(curl -sf "http://127.0.0.1:${CDP_PORT}/json/version" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).Browser))')"
log "stage 3 ready: ${CHROME_VERSION} on 127.0.0.1:${CDP_PORT} (loopback), $(tabs_ready 2>&1)"
fc_lines="$(grep -c 'Fontconfig' "$CHROME_LOG" 2>/dev/null || true)"
if [ "${fc_lines:-0}" != "0" ]; then warn "Chrome stderr has ${fc_lines} Fontconfig line(s):"; grep 'Fontconfig' "$CHROME_LOG" >&2; else log "chrome stderr: 0 Fontconfig lines"; fi

# ---------------------------------------------------------------- stage 4 ---
# x11vnc listens on loopback only; noVNC/websockify is what the host port
# reaches. VNC auth is the classic 8-character DES challenge: x11vnc keeps the
# first 8 characters of VNC_PASSWORD. The password never appears on a command
# line — it is written to a 0600 file by x11vnc's own -storepasswd.
run_as x11vnc -storepasswd "$VNC_PASSWORD" "$SCRATCH/vncpasswd" > /dev/null 2>&1 \
  || { warn "x11vnc -storepasswd failed"; shutdown 1; }
run_as_bg x11vnc -display "$DISPLAY" -rfbauth "$SCRATCH/vncpasswd" -rfbport "$VNC_PORT" -localhost \
  -forever -shared -xkb -noxrecord -noxfixes -quiet > "$SCRATCH/x11vnc.log" 2>&1 &
X11VNC_PID=$!
# The web root is a scratch directory of symlinks into /usr/share/novnc plus an
# index.html that forwards to vnc.html (query string kept), so GET / on the
# published port opens the viewer instead of websockify's directory listing
# (task-026). Nothing in the package is modified.
NOVNC_WEB="$SCRATCH/novnc-web"
rm -rf "$NOVNC_WEB" && mkdir -p "$NOVNC_WEB"
for f in /usr/share/novnc/*; do ln -s "$f" "$NOVNC_WEB/$(basename "$f")"; done
cat > "$NOVNC_WEB/index.html" <<'HTML'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Marlin Cast viewer</title>
<meta http-equiv="refresh" content="0; url=vnc.html">
<script>location.replace("vnc.html" + location.search + location.hash);</script>
</head><body><a href="vnc.html">Open the viewer</a></body></html>
HTML
chown -R "$PUID:$PGID" "$NOVNC_WEB"
run_as_bg websockify --web="$NOVNC_WEB" "$NOVNC_PORT" "127.0.0.1:${VNC_PORT}" > "$SCRATCH/novnc.log" 2>&1 &
NOVNC_PID=$!
wait_for 15 "novnc" curl -sf -o /dev/null "http://127.0.0.1:${NOVNC_PORT}/vnc.html" \
  || { tail -n 20 "$SCRATCH/novnc.log" "$SCRATCH/x11vnc.log" >&2; shutdown 1; }
log "stage 4 ready: noVNC on 0.0.0.0:${NOVNC_PORT} -> x11vnc 127.0.0.1:${VNC_PORT} (password required)"

# ---------------------------------------------------------------- stage 5 ---
cd /app
if run_as node --import tsx src/login.ts 2>&1 | sed -u 's/^/[login] /'; then
  SIGNED_IN=1
  log "stage 5: every provider signed in"
else
  SIGNED_IN=0
  warn "stage 5: a provider is SIGNED OUT (see the [login] lines above)"
fi

# ---------------------------------------------------------------- stage 6 ---
CACHE="${DATA_DIR}/channels.json"
if [ ! -s "$CACHE" ]; then
  log "stage 6: no ${CACHE} — first boot, enumerating the lineup"
  if run_as node --import tsx src/channels.ts 2>&1 | sed -u 's/^/[channels] /'; then
    log "stage 6 ready: lineup cached at ${CACHE}"
  else
    echo "[entrypoint] FATAL: enumeration failed — no channel cache was written, the app will NOT start." >&2
    echo "[entrypoint]   Most likely a provider is signed out (look for SIGNED OUT above)." >&2
    echo "[entrypoint]   Chrome and the viewer stay up: open http://<host>:8092/vnc.html, enter" >&2
    echo "[entrypoint]   VNC_PASSWORD, log in to each provider in its tab, wait 70 s so Chrome" >&2
    echo "[entrypoint]   commits the cookies (KNOWN-FIXES), then RESTART this container." >&2
    # Stay up. SIGTERM still tears everything down through the trap.
    while :; do sleep 3600 & wait $!; done
  fi
else
  log "stage 6: channel cache present (${CACHE})"
fi

# ---------------------------------------------------------------- stage 7 ---
# sed -u: container stdout is a pipe, and without it sed block-buffers, so the
# app's [tune]/[stop] lines reached `docker logs` only at exit (task-024 V6).
run_as_bg node --import tsx src/server.ts 2>&1 | sed -u 's/^/[app] /' &
# $! is the sed at the end of the pipeline; the node pid is what must be signalled.
sleep 1
APP_PID="$(pgrep -f 'node --import tsx src/server.ts' | head -1)"
wait_for 60 "app health" curl -sf -o /dev/null "http://127.0.0.1:${APP_PORT}/health" || shutdown 1
log "stage 7 ready: app on 0.0.0.0:${APP_PORT} (pid ${APP_PID}); $(curl -sf "http://127.0.0.1:${APP_PORT}/health" | grep -E '^(channels|state):' | tr '\n' ' ')"
[ "$SIGNED_IN" = 1 ] || warn "the app is up but a provider is signed out — tunes for it will fail loud until the owner logs in via the viewer"

# ---------------------------------------------------------------- run -------
# Any of the long-lived processes dying ends the container (exit 1), so a
# restart policy brings the whole tree back in order.
while :; do
  for p in "$XVFB_PID:xvfb" "$CHROME_PID:chrome" "$X11VNC_PID:x11vnc" "$NOVNC_PID:novnc" "$APP_PID:app"; do
    pid="${p%%:*}"; name="${p#*:}"
    if ! alive "$pid"; then
      warn "${name} (pid ${pid}) exited"
      [ "$name" = chrome ] && tail -n 20 "$CHROME_LOG" >&2
      shutdown 1
    fi
  done
  sleep 2 & wait $!
done

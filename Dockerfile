# Marlin Cast — container image (task-024, D024).
#
# One process tree under tini: Xvfb -> Google Chrome (owner-launched semantics,
# D009: the app attaches over CDP and never owns the profile) -> x11vnc + noVNC
# (the re-login viewer) -> the Node app. See docker/entrypoint.sh for the
# ordering, readiness checks and shutdown.
#
# Base: ubuntu:24.04 (owner ruling, task-024) — the same release the whole
# project was measured on (marlinpc is Pop!_OS 24.04), so apt's ffmpeg is the
# 6.1.x every HLS fact in notebook/KNOWN-FIXES.md was measured against. The
# build FAILS if apt hands back any other major.minor.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8

# System packages.
#   ffmpeg        — the encoder/segmenter src/capture.ts spawns by name (must be 6.1.x)
#   xvfb          — the display; tab capture follows the display size (KNOWN-FIXES)
#   x11vnc, novnc, websockify — the viewer (container port 6080)
#   fontconfig + fonts-liberation + fonts-dejavu-core — clears Chrome's
#                   "Fontconfig error: Cannot load default config file" on a bare image
#   tini          — PID 1, reaps Chrome's and ffmpeg's orphans
#   curl, ca-certificates, gnupg — NodeSource + the Chrome deb download
#   procps        — ps for the entrypoint's shutdown report
#   setpriv (util-linux, already in the base) drops root to PUID/PGID
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg \
      ffmpeg \
      xvfb x11vnc novnc websockify \
      fontconfig fonts-liberation fonts-dejavu-core \
      tini procps \
 && rm -rf /var/lib/apt/lists/*

# STOP condition made structural: every HLS/segmenter fact in the notebook was
# measured on ffmpeg 6.1.1 (task-012..019). Anything else fails the build.
RUN ffmpeg -version | head -1 | tee /dev/stderr | grep -qE '^ffmpeg version 6\.1\.' \
 || { echo "FATAL: ffmpeg is not 6.1.x — see notebook/reports/recon-docker.md Q6" >&2; exit 1; }

# Node 22 via NodeSource (D003; owner ruling, task-024).
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/* \
 && node --version | grep -qE '^v22\.'

# Google Chrome, pinned to the exact build every hard-won fact was measured on
# (KNOWN-FIXES: --load-extension inert on 153, Extensions.loadUnpacked works,
# triggerAction semantics; task-002/005 1080p on Widevine L3) and the build the
# copied profile's "Last Version" names (recon-docker item A). The deb is
# fetched by full pool URL; if Google prunes it the build fails loudly here
# rather than drifting to a newer Chrome (recon-docker Q3, owner ruling).
ARG CHROME_VERSION=153.0.8010.36-1
RUN printf 'repo_add_once="false"\nrepo_reenable_on_distupgrade="false"\n' > /etc/default/google-chrome \
 && curl -fsSL -o /tmp/google-chrome.deb \
      "https://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/google-chrome-stable_${CHROME_VERSION}_amd64.deb" \
 && apt-get update \
 && apt-get install -y --no-install-recommends /tmp/google-chrome.deb \
 && rm -f /tmp/google-chrome.deb /etc/apt/sources.list.d/google-chrome.list \
 && rm -rf /var/lib/apt/lists/* \
 && google-chrome --version | tee /dev/stderr | grep -qF "${CHROME_VERSION%-*}"

# The app. tsx runs the TypeScript directly (package.json scripts; there is no
# build step and no tsconfig), so dev dependencies are installed on purpose.
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY src ./src
COPY extension ./extension
COPY assets ./assets
COPY scripts/start-chrome.sh ./scripts/start-chrome.sh
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod 0755 /entrypoint.sh ./scripts/start-chrome.sh

# Runtime layout (D024):
#   /data/chrome-profile   the Chrome profile volume (v10 scheme, D010)
#   /data/channels.json    the channel cache (MC_DATA_DIR)
#   /tmp/marlin-cast/hls   HLS scratch, inside the container (MC_HLS_DIR)
#   8804                   the app (published as host 8091 -> 8804, D008/D024)
#   6080                   noVNC (published as host 8092 -> 6080)
#   9333                   Chrome's debug port: loopback only, never published (D009)
ENV MC_DATA_DIR=/data \
    MC_HLS_DIR=/tmp/marlin-cast/hls \
    DISPLAY=:99 \
    CDP_PORT=9333 \
    PUID=99 \
    PGID=100
EXPOSE 8804 6080
VOLUME ["/data"]

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]

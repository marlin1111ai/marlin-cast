#!/usr/bin/env bash
# start-chrome.sh — launch the Chrome that Marlin Cast attaches to.
#
# The OWNER runs this, and logs in by hand in the window it opens.
# The app never launches Chrome and never owns this profile (D009).
#
# Stays in the foreground. Ctrl-C, or closing the window, quits Chrome.

set -euo pipefail

PORT="${CDP_PORT:-9333}"
PROFILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/data/chrome-profile"
export DISPLAY="${DISPLAY:-:10}"

if ss -tln 2>/dev/null | grep -q "127.0.0.1:${PORT}[[:space:]]"; then
  echo "Something is already listening on 127.0.0.1:${PORT}."
  echo "If that is a Chrome from an earlier run, keep using it — do not start a second one."
  exit 1
fi

mkdir -p "$PROFILE"

echo "Marlin Cast — Chrome"
echo "  profile      : $PROFILE"
echo "  display      : $DISPLAY"
echo "  CDP endpoint : http://127.0.0.1:${PORT}  (loopback only)"
echo
echo "Log in to YouTube TV and Philo in the tabs that open. Leave this running."
echo

# --- The capture extension (Task 006) ---------------------------------------
#
# The flag that WOULD load it here is:
#
#     --load-extension=/Apps/marlin-cast/extension
#
# What it does: installs an unpacked (unzipped, un-signed) extension directory
# at startup, the command-line equivalent of "Load unpacked" on
# chrome://extensions, skipping the Web Store and Developer Mode.
#
# It is deliberately NOT passed, because on this Chrome it does nothing.
# Measured on Chrome 153.0.8010.36, five throwaway-profile arms, every one
# reporting an empty Extensions.getExtensions and no extension service worker:
#
#   --load-extension alone                                         -> ignored
#   + --disable-extensions-except=<same path>                      -> ignored
#   + --enable-unsafe-extension-debugging                          -> ignored
#   + --disable-features=DisableLoadExtensionCommandLineSwitch     -> ignored
#   + both of the above together                                   -> ignored
#
# Chrome removed the switch (M137) and there is no flag here that revives it.
# The extension is therefore installed at RUN TIME, over the loopback debug
# port this script already opens, by scripts/capture-spike.mjs calling the CDP
# command Extensions.loadUnpacked. That needs no extra flag, no Developer Mode,
# and — importantly — no Chrome restart, so the live login is never at risk.
#
# Nothing below this comment changed for Task 006: same port, same profile,
# same --password-store=basic (D010).

# --remote-debugging-address is deliberately not passed: Chrome binds the
# debugging port to loopback by default, and naming another address is what
# would expose it. --password-store=basic pins the cookie encryption scheme
# to v10 (hardcoded key) rather than v11 (machine-bound keyring), so this
# profile stays readable in a container that has no keyring. Do not change
# it back: D010, and notebook/KNOWN-FIXES.md.
#
# Two start URLs, one tab per provider (D018). Marlin Cast picks the tab by URL
# host and never falls back to "any page", so both tabs must be open and logged
# in before a tune: YouTube TV and Philo.
exec /usr/bin/google-chrome \
  --user-data-dir="$PROFILE" \
  --remote-debugging-port="$PORT" \
  --password-store=basic \
  --no-first-run \
  --no-default-browser-check \
  https://tv.youtube.com/ \
  https://www.philo.com/player/guide

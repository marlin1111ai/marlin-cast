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
echo "Log in to YouTube TV in the window that opens. Leave this running."
echo

# --remote-debugging-address is deliberately not passed: Chrome binds the
# debugging port to loopback by default, and naming another address is what
# would expose it. --password-store=basic pins the cookie encryption scheme
# to v10 (hardcoded key) rather than v11 (machine-bound keyring), so this
# profile stays readable in a container that has no keyring. Do not change
# it back: D010, and notebook/KNOWN-FIXES.md.
exec /usr/bin/google-chrome \
  --user-data-dir="$PROFILE" \
  --remote-debugging-port="$PORT" \
  --password-store=basic \
  --no-first-run \
  --no-default-browser-check \
  https://tv.youtube.com/

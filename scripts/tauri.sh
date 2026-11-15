#!/usr/bin/env sh
set -eu

if [ -d "$HOME/.cargo/bin" ]; then
  PATH="$HOME/.cargo/bin:$PATH"
fi

if [ -d "/opt/homebrew/bin" ]; then
  PATH="/opt/homebrew/bin:$PATH"
fi

if [ -d "/usr/local/bin" ]; then
  PATH="/usr/local/bin:$PATH"
fi

export PATH

if ! command -v cargo >/dev/null 2>&1; then
  echo "Error: cargo not found in PATH. Install Rust from https://rustup.rs and reopen your shell."
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "Error: bun not found in PATH. Install Bun from https://bun.sh and reopen your shell."
  exit 1
fi

# App flavor: FG_FLAVOR=grindr (default) or server (see flavors/README.md).
# Its manifest sets the app identity (name, IDs, OTA) and may bring build
# variables (scripts/flavor-env.mjs). The server flavor's backend, fixed at
# build time:
#   FG_API_URL   REST/WebSocket   (Rust, grindr-patched/src/server.rs)
#   FG_MEDIA_URL media host       (Rust + HTTP scope, flavor-config.mjs)
#   FG_RTC_URL   LiveKit host     (CSP, flavor-config.mjs)
#   FG_FCM_PROJECT_ID / FG_FCM_APP_ID / FG_FCM_API_KEY / FG_FCM_SENDER_ID
#                Firebase client config for Free Grind push (Rust, api/server.rs)
#   FG_CA_CERT   extra root CA, test builds only (server/LOCAL-TLS.md)
# Set in the environment, they win over the manifest. For local development
# against the dev stack, server/.env.app (if present) sets them.
if [ "${FG_FLAVOR:-}" = "server" ] && [ -f server/.env.app ]; then
  set -a
  . ./server/.env.app
  set +a
fi
eval "$(bun --no-env-file scripts/flavor-env.mjs)"
case "${1:-}" in
  android|ios) target="$1" ;;
  *) target="" ;; # desktop: the host OS
esac
TAURI_CONFIG="$(bun --no-env-file scripts/flavor-config.mjs $target)"
export TAURI_CONFIG

exec bunx tauri "$@"

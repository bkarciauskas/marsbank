#!/usr/bin/env bash
# Start Mars Bank locally: free the dev port, then run Next.js.
# Usage:
#   sh scripts/start.sh
#   PORT=3021 sh scripts/start.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3021}"

ensure_deps() {
  deps_ok() {
    [[ -x "node_modules/.bin/next" ]] \
      && [[ -f "node_modules/.package-lock.json" ]] \
      && [[ ! "package.json" -nt "node_modules/.package-lock.json" ]] \
      && [[ ! "package-lock.json" -nt "node_modules/.package-lock.json" ]] \
      && npm ls --depth=0 >/dev/null 2>&1
  }

  if deps_ok; then
    return 0
  fi

  echo "Installing dependencies..."
  npm install
}

free_port() {
  local port="$1"
  local pids leftover

  pids="$(lsof -nP -t -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    echo "Port ${port} is free"
    return 0
  fi

  echo "Stopping listener(s) on ${port}: ${pids//$'\n'/ }"
  # shellcheck disable=SC2086
  kill ${pids} 2>/dev/null || true
  sleep 0.4

  leftover="$(lsof -nP -t -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$leftover" ]]; then
    echo "Force-stopping listener(s) on ${port}: ${leftover//$'\n'/ }"
    # shellcheck disable=SC2086
    kill -9 ${leftover} 2>/dev/null || true
    sleep 0.2
  fi

  if lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port ${port} is still in use:" >&2
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >&2 || true
    exit 1
  fi
}

ensure_deps
free_port "$PORT"

echo "Starting Mars Bank on http://localhost:${PORT}"
exec npm run dev -- --port "$PORT"

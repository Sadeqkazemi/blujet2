#!/usr/bin/env bash
# Stop blujet local dev servers started by start-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/.local-dev-logs"

stop_pid() {
  local name="$1"
  local pidfile="$LOG_DIR/$name.pid"
  if [[ -f "$pidfile" ]]; then
    local pid
    pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "▶ Stopping $name (pid $pid)…"
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  fi
}

stop_pid backend
stop_pid frontend

# Also stop anything still listening on dev ports (best-effort)
for port in 5173 3000; do
  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -t -i:"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      echo "▶ Freeing port $port…"
      kill $pids 2>/dev/null || true
    fi
  fi
done

echo "✅ Local dev servers stopped."

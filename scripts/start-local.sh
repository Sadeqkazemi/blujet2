#!/usr/bin/env bash
# One-command local dev: Postgres + Redis + backend + frontend.
# Usage: ./scripts/start-local.sh
# Stop:  ./scripts/stop-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG_DIR="$ROOT/.local-dev-logs"
mkdir -p "$LOG_DIR"

echo "▶ Stopping any previous dev servers…"
"$ROOT/scripts/stop-local.sh" 2>/dev/null || true

if command -v docker >/dev/null 2>&1; then
  echo "▶ Starting Postgres + Redis (docker compose)…"
  docker compose up -d
  echo "▶ Waiting for Postgres…"
  for i in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U blujet >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
else
  echo "⚠ docker not found — assuming Postgres (5432) and Redis (6379) already running."
fi

if [[ ! -d backend/node_modules ]]; then
  echo "▶ Installing backend dependencies…"
  (cd backend && npm install)
fi

if [[ ! -d frontend/node_modules ]]; then
  echo "▶ Installing frontend dependencies…"
  (cd frontend && npm install)
fi

echo "▶ Applying database migrations…"
(cd backend && npx typeorm migrate deploy 2>/dev/null || npx typeorm migrate dev --name init --skip-seed)
(cd backend && npx typeorm db seed 2>/dev/null || true)

echo "▶ Starting backend on :3000…"
(cd backend && nohup npm run start:dev > "$LOG_DIR/backend.log" 2>&1 & echo $! > "$LOG_DIR/backend.pid")

echo "▶ Starting frontend on :5173…"
(cd frontend && nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 & echo $! > "$LOG_DIR/frontend.pid")

echo "▶ Waiting for servers…"
for i in $(seq 1 40); do
  FE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/ 2>/dev/null || echo 0)
  BE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health 2>/dev/null || echo 0)
  if [[ "$FE" == "200" && "$BE" == "200" ]]; then
    echo ""
    echo "✅ blujet is running!"
    echo ""
    echo "   Frontend:  http://localhost:5173/login"
    echo "   Backend:   http://localhost:3000/health"
    echo "   Staff login: chairman / Blujet@1404"
    echo ""
    echo "   Logs: $LOG_DIR/backend.log  |  $LOG_DIR/frontend.log"
    echo "   Stop: ./scripts/stop-local.sh"
    exit 0
  fi
  sleep 2
done

echo ""
echo "❌ Servers did not start in time. Check logs:"
echo "   tail -50 $LOG_DIR/backend.log"
echo "   tail -50 $LOG_DIR/frontend.log"
exit 1

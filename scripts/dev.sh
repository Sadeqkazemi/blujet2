#!/usr/bin/env bash
# Start blujet local dev stack: Postgres + Redis + backend + frontend.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▶ Starting Postgres + Redis (docker compose)…"
docker compose up -d

echo "▶ Waiting for Postgres…"
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U blujet >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if [[ ! -d backend/node_modules ]]; then
  echo "▶ Installing backend dependencies…"
  (cd backend && npm install)
fi

if [[ ! -d frontend/node_modules ]]; then
  echo "▶ Installing frontend dependencies…"
  (cd frontend && npm install)
fi

echo "▶ Applying database migrations (if needed)…"
(cd backend && npx typeorm migrate deploy 2>/dev/null || npx typeorm migrate dev --name init --skip-seed)
(cd backend && npx typeorm db seed 2>/dev/null || true)

echo ""
echo "✅ Infrastructure ready."
echo ""
echo "Open TWO terminals and run:"
echo ""
echo "  Terminal 1 — backend (port 3000):"
echo "    cd backend && npm run start:dev"
echo ""
echo "  Terminal 2 — frontend (port 5173):"
echo "    cd frontend && npm run dev"
echo ""
echo "Then open: http://localhost:5173/login"
echo "Staff login: chairman / Blujet@1404"

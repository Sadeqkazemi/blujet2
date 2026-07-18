#!/bin/sh
set -e

echo "Running typeorm migrate deploy..."
npx typeorm migrate deploy

if [ "$SEED_ON_START" = "true" ]; then
  echo "Seeding database..."
  npx tsx typeorm/seed.ts || true
fi

exec "$@"

#!/bin/sh
set -e

echo "Running prisma migrate deploy..."
npx prisma migrate deploy

if [ "$SEED_ON_START" = "true" ]; then
  echo "Seeding database..."
  npx tsx prisma/seed.ts || true
fi

exec "$@"

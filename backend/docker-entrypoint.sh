#!/bin/sh
set -e

echo "Running database migrations..."
npm run migration:run:prod

if [ "$SEED_ON_START" = "true" ]; then
  echo "Seeding database..."
  npm run seed:prod || true
fi

exec "$@"

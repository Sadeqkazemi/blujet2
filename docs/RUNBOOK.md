# RUNBOOK

Operational guide for the blujet production stack (`docker-compose.prod.yml`,
running from `/opt/app` on the server). No domain is configured yet — the
site is served over plain HTTP on the server's IP, behind the frontend's
nginx (see `frontend/nginx.conf`); see `docs/DEPLOY_IP.md` for the full
IP-only deployment guide and how to add a domain + TLS later.

## Reading logs

```bash
cd /opt/app
docker compose -f docker-compose.prod.yml logs -f            # all services
docker compose -f docker-compose.prod.yml logs -f backend    # one service
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f ml-service
docker compose -f docker-compose.prod.yml logs -f db
```

## Checking health

```bash
curl -i http://SERVER_IP/health
```

Should return `200` with DB connectivity status and the build/commit
version. The backend's port 3000 is not published directly (Phase 2
traffic hardening — everything goes through nginx on :80); an external
uptime monitor should be pointed at `http://SERVER_IP/health`.

Container-level health:

```bash
docker compose -f docker-compose.prod.yml ps
```

## Scaling the backend

See `docs/DEPLOY_IP.md`'s "مقیاس‌پذیری بک‌اند" section —
`docker compose -f docker-compose.prod.yml up -d --build --scale backend=3`.
nginx re-resolves the backend hostname via Docker's embedded DNS, so this
actually spreads load across replicas.

## Restoring a backup

Backups are written nightly by `scripts/backup-db.sh` (via cron) to
`/opt/app/backups/blujet-<timestamp>.sql.gz`, retained 7 days.

To restore into the running `db` service (destructive — stops writes and
overwrites current data):

```bash
cd /opt/app
docker compose -f docker-compose.prod.yml stop backend ml-service
gunzip -c backups/blujet-<timestamp>.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose -f docker-compose.prod.yml start backend ml-service
```

### Monthly restore drill (verify backups are actually restorable)

Once a month, restore the latest dump into a throwaway container and run a
sanity check — never test against the production `db` service:

```bash
docker run -d --name restore-check -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:16-alpine
sleep 5
gunzip -c /opt/app/backups/blujet-<latest>.sql.gz | \
  docker exec -i restore-check psql -U postgres
docker exec -it restore-check psql -U postgres -c \
  "SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM bookings) AS bookings;"
docker rm -f restore-check
```

Row counts should look sane (non-zero, roughly matching production). If the
restore fails or counts look wrong, investigate immediately — don't wait
for a real incident to find out backups are broken.

## Rolling back a bad deploy

Deploys happen via GitHub Actions on push to `main`. To roll back to the
previous commit:

```bash
cd /opt/app
git log --oneline -5              # find the last good commit SHA
git checkout <good-sha>
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
git checkout main                 # return HEAD to main once stable
```

The backend container runs `prisma migrate deploy` automatically on
startup (see `backend/docker-entrypoint.sh`) — rolling back code does NOT
undo an already-applied schema migration. Check
`backend/prisma/migrations/` before rolling back a release that touched
the schema, and restore from backup if the migration needs to be reversed.

## First-time server setup

See `docs/DEPLOY_IP.md` for cloning the repo to the server, creating `.env`
from `.env.production.example`, and configuring GitHub Actions secrets
(`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`).

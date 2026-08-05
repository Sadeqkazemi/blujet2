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

The backend container runs `npm run migration:run:prod` (TypeORM) automatically
on startup (see `backend/docker-entrypoint.sh`) — rolling back code does NOT
undo an already-applied schema migration. Check
`backend/src/database/migrations/` before rolling back a release that touched
the schema, and restore from backup if the migration needs to be reversed.

## First-time server setup

See `docs/DEPLOY_IP.md` for cloning the repo to the server, creating `.env`
from `.env.production.example`, and configuring GitHub Actions secrets
(`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`).

## Initial management-panel accounts

Do not run the development seed in production and do not put a plaintext
password, mobile number, or Kavenegar key in Git/GitHub. The production
bootstrap accepts named account owners, generates a different temporary
password for each account, enables mandatory SMS 2FA, and forces a password
change after first login.

First create `/root/blujet-panel-accounts.json` with mode `600`. Replace every
angle-bracket value with the real account owner's details. Each mobile number
must be real, controlled by that owner, and unique:

```json
[
  { "fullName": "<نام مالک ادمین سایت>", "username": "panel.siteadmin", "role": "SITE_ADMIN", "phone": "<09xxxxxxxxx>", "email": "<email-or-omit>" },
  { "fullName": "<نام مالک مدیر IT>", "username": "panel.it", "role": "IT_MANAGER", "phone": "<09xxxxxxxxx>", "email": "<email-or-omit>" },
  { "fullName": "<نام مالک مدیر بازرگانی>", "username": "panel.commercial", "role": "COMMERCIAL_MANAGER", "phone": "<09xxxxxxxxx>", "email": "<email-or-omit>" },
  { "fullName": "<نام مالک مدیر مالی>", "username": "panel.finance", "role": "FINANCE_MANAGER", "phone": "<09xxxxxxxxx>", "email": "<email-or-omit>" },
  { "fullName": "<نام مالک مدیر ارشد>", "username": "panel.senior", "role": "SENIOR_MANAGER", "phone": "<09xxxxxxxxx>", "email": "<email-or-omit>" },
  { "fullName": "<نام مالک مدیرعامل>", "username": "panel.ceo", "role": "CEO", "phone": "<09xxxxxxxxx>", "email": "<email-or-omit>" },
  { "fullName": "<نام مالک رئیس هیئت‌مدیره>", "username": "panel.chair", "role": "BOARD_CHAIR", "phone": "<09xxxxxxxxx>", "email": "<email-or-omit>" }
]
```

If an owner has no email, remove the `email` property instead of keeping the
placeholder. Validate the file without touching the database:

```bash
cd /opt/app
docker compose --env-file .env -f docker-compose.prod.yml exec -T backend \
  node dist/database/bootstrap-panel-accounts.js \
  < /root/blujet-panel-accounts.json
```

The dry run must show only the expected username/role pairs. Staff login
cannot work until real SMS delivery works. If Kavenegar is not already active
in the database, read its API key without echoing it or saving it in shell
history, then execute the atomic bootstrap and capture its only password
output in a root-only file:

```bash
umask 077
read -rsp 'Kavenegar API key: ' PANEL_KAVENEGAR_KEY
echo
docker compose --env-file .env -f docker-compose.prod.yml exec -T \
  -e PANEL_ACCOUNT_BOOTSTRAP_CONFIRM=CREATE_BLUJET_PANEL_ACCOUNTS \
  -e PANEL_ACCOUNT_BOOTSTRAP_KAVENEGAR_API_KEY="$PANEL_KAVENEGAR_KEY" \
  backend node dist/database/bootstrap-panel-accounts.js --execute \
  < /root/blujet-panel-accounts.json \
  > /root/blujet-panel-credentials.json
unset PANEL_KAVENEGAR_KEY
chmod 600 /root/blujet-panel-credentials.json
```

If Kavenegar was already configured, the API-key prompt/environment option is
not required. Move the generated temporary credentials into the organization's
password manager, give each password only to its named owner, and remove both
root-only JSON files afterward. A repeated run with any existing username,
mobile, or email is rejected and never resets that account.

## Temporary password-only panel UAT access

This owner-approved exception is used only while Kavenegar delivery is being
repaired. The first successful deployment writes the seven generated
credentials to `/root/blujet-temporary-panel-credentials.json` with mode
`0600`. GitHub Actions never receives or prints its contents. Read it only from
an authenticated root shell:

```bash
cat /root/blujet-temporary-panel-credentials.json
```

The passwords remain fixed and the database deadline is exactly seven days
after creation. Repeated deploys do not recreate or rotate the accounts because
`/root/.blujet-temporary-panel-bootstrap-complete` is retained. After the
deadline, login and refresh are rejected even if the password is correct.

As soon as Kavenegar works (or earlier on owner request), disable the accounts
and revoke every active session without deleting referenced audit/business
history:

```bash
docker compose --env-file .env -f docker-compose.prod.yml exec -T \
  -e TEMP_PANEL_CLEANUP_CONFIRM=DISABLE_TEMPORARY_PANEL_TEST_ACCOUNTS \
  backend node dist/database/cleanup-temporary-panel-accounts.js --execute
```

Keep the sentinel so a later deployment cannot recreate the exception. After
cleanup, securely delete only the credential file from the server.

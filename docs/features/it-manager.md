# Feature: IT Manager panel — accounts, permissions, services, security, logs, backups (Phase 8)

Covers `docs/API.md` → "Phase 8" and `docs/DB_SCHEMA.md` → "Phase 8".
Scope is the 6 tabs `PLAN.md`'s Phase 8 bullet names: کاربران و دسترسی‌ها
(accounts+permissions), رمزها و امنیت, سرویس‌های سایت, لاگ و رویدادها
(reuses Phase 1's `/audit/logs`), پشتیبان‌گیری, و داشبورد فنی. سامانه
رزرواسیون (Phase 9), دسترسی به پنل‌ها و تنظیمات سامانه (both Phase 12) are
explicitly out of scope — left `implemented: false` in `panel-nav.config.ts`.

## Acceptance checklist

Backend items proven by `backend/test/it-manager.e2e-spec.ts`; frontend by
`frontend/src/features/it-manager/*.test.tsx`; E2E by
`frontend/e2e/it-manager-journey.spec.ts`.

### Permission catalog & employees
- [ ] `GET /it/permissions` returns the 3-dept/12-key catalog verbatim from `PERM_CATALOG`; non-IT role → 403
- [ ] `GET /it/employees` lists only `role=EMPLOYEE` rows, `dept=`/`q=` filters work
- [ ] `POST /it/employees`: creates account (argon2 hash), grants `dashboard`+`cartable` implicitly + selected permissions, duplicate username → 409, password &lt;6 chars → 400, audited (ACCOUNT)
- [ ] `GET /it/employees/:id` returns granted + available permissions; non-EMPLOYEE id → 404
- [ ] `PATCH /it/employees/:id/status` suspends/reactivates, audited (ACCOUNT)
- [ ] `PATCH /it/employees/:id/permissions` grants/revokes one key idempotently, audited (ACCESS)
- [ ] `POST /it/employees/:id/reset-password` returns the temp password once, sets `mustChangePassword`, records `PasswordResetEvent`, audited (ACCOUNT); old password stops working (argon2 hash actually replaced)
- [ ] All employee endpoints: non-`IT_MANAGER` role → 403

### Security
- [ ] `GET /it/security/policy` auto-creates the singleton with design defaults on first read
- [ ] `PATCH /it/security/policy` updates a subset of fields, audited (SECURITY)
- [ ] `GET /it/security/sessions` lists only non-revoked/non-expired `RefreshToken`s with user+device+ip
- [ ] `POST /it/security/sessions/logout-all` revokes every active session, audited (SECURITY); a revoked token then fails `/auth/refresh`

### Services
- [ ] `GET /it/services` returns seeded internal+external lists; `apiKeyEncrypted` never returned in plaintext
- [ ] `PATCH /it/services/internal/:key` toggles enabled, audited (SYSTEM); unknown key → 404
- [ ] `POST /it/services/external` creates with encrypted API key; `PATCH`/`DELETE` update/remove
- [ ] `POST /it/services/external/:id/test` performs a real HTTP check and persists `lastTestAt/lastTestOk/lastTestMessage` — proven against both a reachable and an unreachable endpoint (no fabricated success)

### Backups
- [ ] `POST /it/backups` creates a `BackupRecord`, invokes real `pg_dump`, ends in `SUCCESS` or `FAILED` (never left `RUNNING`), size recorded on success
- [ ] `GET /it/backups` lists newest-first
- [ ] `GET /it/backups/schedule` returns the static cron description
- [ ] All backups endpoints: non-`IT_MANAGER` → 403

### Dashboard
- [ ] `GET /it/dashboard` KPIs reconcile with `/it/employees` (active count) and `/it/services` (up/total); `resources` are real `os.totalmem/freemem/loadavg` values, not random
- [ ] `recentEvents` pulls real `AuditLog` rows across SYSTEM/ACCOUNT/ACCESS/SECURITY

### Logs & Panel access (reused, not rebuilt)
- [ ] IT panel's لاگ و رویدادها tab renders `GET /audit/logs` (already implemented Phase 1) — no new backend
- [ ] Nav confirms سامانه رزرواسیون / دسترسی به پنل‌ها / تنظیمات سامانه stay `implemented: false`

### Frontend
- [ ] داشبورد فنی: KPI cards, service-health list, resource bars, recent events
- [ ] کاربران و دسترسی‌ها: create-employee form (dept picker incl. custom dept, permission checkboxes), list with status/actions, detail modal (grant/revoke, reset password shows temp password once), suspend confirmation
- [ ] رمزها و امنیت: policy toggles, params card, active-sessions list, «خروج همه» confirmation
- [ ] سرویس‌های سایت: internal toggle grid, external CRUD + settings modal + test-connection result banner
- [ ] لاگ و رویدادها: reuses the audit list UI pattern
- [ ] پشتیبان‌گیری: backup list with status pill, «پشتیبان جدید» triggers a real backup and shows the resulting status
- [ ] Role isolation: no other role sees these nav entries; direct API calls from another role → 403

### E2E
- [ ] IT Manager creates an employee, grants a permission, resets their password, suspends them
- [ ] IT Manager toggles an internal service off and back on; sees it reflected in سلامت سرویس‌ها on the dashboard
- [ ] IT Manager triggers a backup and sees it appear in the list with a terminal status
- [ ] Non-IT role has no IT nav entries (role isolation)

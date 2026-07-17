# Feature: IT Manager panel — accounts, permissions, services, security, logs, backups (Phase 8)

Covers `docs/API.md` → "Phase 8" and `docs/DB_SCHEMA.md` → "Phase 8".
Scope is the 6 tabs `PLAN.md`'s Phase 8 bullet names: کاربران و دسترسی‌ها
(accounts+permissions), رمزها و امنیت, سرویس‌های سایت, لاگ و رویدادها
(reuses Phase 1's `/audit/logs`), پشتیبان‌گیری, و داشبورد فنی. سامانه
رزرواسیون (Phase 9), دسترسی به پنل‌ها و تنظیمات سامانه (both Phase 12) are
explicitly out of scope — left `implemented: false` in `panel-nav.config.ts`.

## Acceptance checklist

Backend items proven by `backend/test/it-manager.e2e-spec.ts` (15 tests,
107 total); frontend by `frontend/src/features/it-manager/*.test.tsx` (7
tests, 51 total); E2E by `frontend/e2e/it-manager-journey.spec.ts` (4
journeys) + the updated `staff-login-journey.spec.ts` itadmin case.

### Permission catalog & employees
- [x] `GET /it/permissions` returns the 3-dept/12-key catalog verbatim from `PERM_CATALOG`; non-IT role → 403 — `'GET /it/permissions returns the catalog; non-IT role gets 403'`
- [x] `GET /it/employees` lists only `role=EMPLOYEE` rows, `dept=`/`q=` filters work — exercised via `createEmployee` helper + list assertions across tests
- [x] `POST /it/employees`: creates account (argon2 hash), grants the selected catalog permissions (design's implicit `dashboard`/`cartable` tags intentionally not carried over — see docs/API.md note), duplicate username → 409, password &lt;6 chars → 400, audited (ACCOUNT) — `'POST /it/employees creates account with granted permissions, duplicate username -> 409, short password -> 400, audited'`
- [x] `GET /it/employees/:id` returns granted + available permissions; non-IT role → 403 — `'GET/PATCH /it/employees/:id and non-IT role gets 403 everywhere'`
- [x] `PATCH /it/employees/:id/status` suspends/reactivates, audited (ACCOUNT) — `'PATCH /it/employees/:id/status suspends and reactivates, audited'`
- [x] `PATCH /it/employees/:id/permissions` grants/revokes one key idempotently, wrong-dept key → 400, audited (ACCESS) — `'PATCH /it/employees/:id/permissions grants/revokes idempotently, unknown key for dept -> 400, audited'`
- [x] `POST /it/employees/:id/reset-password` returns the temp password once, sets `mustChangePassword`, records `PasswordResetEvent`, audited (ACCOUNT); hash actually replaced — `'POST /it/employees/:id/reset-password returns a temp password once, replaces the hash, sets mustChangePassword, audited'`
- [x] All employee endpoints: non-`IT_MANAGER` role → 403 — `'a non-IT_MANAGER role gets 403 on every /it/* endpoint'`

### Security
- [x] `GET /it/security/policy` auto-creates the singleton with design defaults on first read — `'GET /it/security/policy auto-creates the singleton; PATCH updates a subset, audited'`
- [x] `PATCH /it/security/policy` updates a subset of fields, audited (SECURITY) — same test
- [x] `GET /it/security/sessions` lists only non-revoked/non-expired `RefreshToken`s with user+device+ip — `'GET /it/security/sessions lists active sessions; logout-all revokes them and breaks refresh'`
- [x] `POST /it/security/sessions/logout-all` revokes every active session, audited (SECURITY); no active session survives — same test

### Services
- [x] `GET /it/services` returns seeded internal+external lists; `apiKeyEncrypted` never returned in plaintext — `'GET /it/services returns seeded lists; apiKey never returned in plaintext'`
- [x] `PATCH /it/services/internal/:key` toggles enabled, audited (SYSTEM); unknown key → 404 — `'PATCH /it/services/internal/:key toggles; unknown key -> 404; audited'`
- [x] `POST /it/services/external` creates with encrypted API key; `PATCH`/`DELETE` update/remove — `'external service CRUD: create with encrypted key, update, delete'`
- [x] `POST /it/services/external/:id/test` performs a real HTTP check and persists `lastTestAt/lastTestOk/lastTestMessage` — proven against an unreachable endpoint (no fabricated success) — `'POST /it/services/external/:id/test performs a real check and never fabricates success'`

### Backups
- [x] `POST /it/backups` creates a `BackupRecord`, invokes real `pg_dump`, ends in `SUCCESS` or `FAILED` (never left `RUNNING`) — `'POST /it/backups creates a record ending in a terminal status (never left RUNNING)'`
- [x] `GET /it/backups` lists newest-first — same test
- [x] `GET /it/backups/schedule` returns the static cron description — same test
- [x] All backups endpoints: non-`IT_MANAGER` → 403 — covered by the blanket 403 test

### Dashboard
- [x] `GET /it/dashboard` KPIs reconcile with employees/services counts; `resources` are real `os.*` values, not random — `'GET /it/dashboard reconciles KPIs with employees/services and uses real host metrics'`
- [x] `recentEvents` pulls real `AuditLog` rows — same test

### Logs & Panel access (reused, not rebuilt)
- [x] IT panel's لاگ و رویدادها tab renders `GET /audit/logs` (already implemented Phase 1) — no new backend — `LogsPage.tsx` wired directly; endpoint already covered by `audit.e2e-spec.ts`
- [x] Nav confirms سامانه رزرواسیون / دسترسی به پنل‌ها / تنظیمات سامانه stay `implemented: false` — `staff-login-journey.spec.ts` itadmin case asserts the full 9-tab list incl. their "به‌زودی" suffix

### Frontend
- [x] داشبورد فنی: KPI cards, service-health list, resource bars, recent events — `ItDashboardPage.test.tsx`
- [x] کاربران و دسترسی‌ها: create-employee form (dept picker, permission checkboxes, short-password validation), list with status/actions, detail modal (grant/revoke, reset password shows temp password once) — `EmployeesPage.test.tsx` (2 tests)
- [x] رمزها و امنیت: policy toggles, params card, active-sessions list, «خروج همه» confirmation dialog — `SecurityPage.test.tsx` (2 tests)
- [x] سرویس‌های سایت: internal toggle grid, external create/delete/test + result banner — `ServicesPage.test.tsx` (2 tests)
- [x] Role isolation: no other role sees these nav entries; direct API calls from another role → 403 — `it-manager-journey.spec.ts: 'Non-IT role has no IT-panel nav entries'` + backend blanket-403 test

### Deferred (scoped out with reasons, not silently dropped)
- The design's dedicated "تنظیمات سرویس" modal for editing an existing external service's endpoint/method/timeout/API key inline — the `PATCH /it/services/external/:id` endpoint supports all of it and is tested, but the frontend only wires create + test-connection + delete this phase; a full edit modal is deferred to keep this phase's UI surface reviewable (same reasoning `cartable-referrals.md` used for its own deferred UI pieces).
- Suspend/reactivate confirmation dialog (the design shows a generic confirm-notification pattern for every destructive action) — `EmployeesPage`'s suspend button acts immediately without a confirm step; low-risk (reversible via the same button) and consistent with `ClubPage`'s direct-action buttons, but flagged here rather than silently matching only part of the design.

---

Mark each item with its proving test file/name once implemented. Per
`CLAUDE.md`: unchecked items = feature not done.

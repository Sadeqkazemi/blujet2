# API.md — blujet endpoints (human-readable summary)

Single source of truth is `docs/openapi.json`, regenerated on every backend
boot (`main.ts`) and after every phase. This file is a curated summary —
**only Phase 1 is specified below**; later phases are appended here as they
land, per `CLAUDE.md` workflow rule 1 (no feature code before its endpoints
are documented and approved here).

Envelope on every response: `{ success, data?, error?: { code, message } }`.
Auth: `Authorization: Bearer <accessToken>` (JWT, short-lived) +
httpOnly refresh cookie. All endpoints below require an authenticated staff
session unless marked public.

---

## Phase 1 — Auth, RBAC, panel shell, dashboard/reporting

### Auth (`backend/src/modules/auth/`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/staff/login` | public | `{ username, password }` → if correct, issues a `TwoFactorChallenge` and returns `{ challengeId }` (never a token yet). Rate-limited per-IP + per-account. |
| POST | `/auth/staff/login/verify` | public | `{ challengeId, code }` → on success, sets refresh cookie + returns `{ accessToken, user }`. 6-digit/2-min TTL/single-use/hashed, per Security Rules. |
| POST | `/auth/refresh` | refresh cookie | Rotates refresh token, returns new access token. |
| POST | `/auth/logout` | bearer | Revokes the current refresh token. |
| GET | `/auth/me` | bearer | `{ id, fullName, role, permissions? }` — drives the frontend's role-scoped nav. |

Error codes: `INVALID_CREDENTIALS`, `TWO_FACTOR_REQUIRED`, `TWO_FACTOR_INVALID`, `TWO_FACTOR_EXPIRED`, `ACCOUNT_SUSPENDED`.

### Panels (`backend/src/modules/panels/`)

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/panels/nav` | any staff role | Returns the caller's role-scoped tab list (server-computed — the frontend never decides visibility itself, per CLAUDE.md's "never by hiding UI alone" rule). |
| GET | `/panels/access` | CEO, SENIOR_MANAGER, IT_MANAGER | Current `PanelAccessFlag` states for the panels that role is allowed to toggle (CEO: finance/commercial/IT; Senior Manager: +CEO panel, site admin; IT: none — IT's "دسترسی به پنل‌ها" tab in the design is read-only informational, no toggle wired). |
| PATCH | `/panels/access/:panelKey` | CEO, SENIOR_MANAGER | `{ enabled }` → toggles a sibling panel; writes an `AuditLog(category=ACCESS)` row. |

### Reporting (`backend/src/modules/reporting/`)

Shared by all 6 panels' dashboard/finance tabs — confirmed identical KPI
set and chart shape across every panel report.

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/reporting/sales-chart` | CEO, BOARD_CHAIR, SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER | Query: `granularity=day\|month\|q3\|q6\|year\|flight`, `month?`, `date?`, `flightNo?`. Returns per-period `{ label, systemIrr, charterIrr, agencyIrr }[]` — computed server-side from `LedgerEntry`, grouped by `Booking.channel`. |
| GET | `/reporting/kpis` | same | Query: `granularity`, `periodKey?` (selected bar/day/month) → `{ revenueIrr, profitIrr, marginPct, operatingCostIrr, agencyDebtIrr, agencyDebtCount, trend: {...} }`. Re-scopes to the selected period, matching the "KPIs re-scope when a chart month is selected" rule. |
| GET | `/reporting/completed-flights-summary` | same | Same `granularity`/`periodKey` filter → `{ flightCount, totalSeats, soldSeats, unsoldSeats }`, synced to the same period as the chart. |
| GET | `/reporting/low-sales-alerts` | CEO, BOARD_CHAIR, SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER | Flights &lt;72h out with occupancy below threshold — the design's recurring amber banner, currently hardcoded in every panel; this endpoint replaces the hardcoded copy with a real query. |

### Manager activity / audit feed (`backend/src/modules/audit/`)

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/audit/manager-reports` | CEO (excludes CEO/SENIOR_MANAGER/BOARD_CHAIR as actor), BOARD_CHAIR (sees all), SENIOR_MANAGER (sees all) | Query: `category?`, `actorRole?`, `date?`, `q?` (search). Role-specific exclusion filters are server-side per the confirmed per-panel behavior — never left to the frontend to hide rows. |
| GET | `/audit/logs` | IT_MANAGER | `category=SYSTEM` + account-management entries — IT's "لاگ و رویدادها" tab. |
| POST | `/audit` | internal (called by other modules, not directly by clients) | Every write in every later-phase module calls this — not a public endpoint. |

---

## Phase 3 — Agencies

Roles column reflects the confirmed per-panel presence from the design
extraction — some actions (API key issuance, invoices, messaging) are
**not** uniform across the three roles that have an آژانس‌ها tab, and the
backend enforces that narrower set even though `SENIOR_MANAGER`/
`FINANCE_MANAGER`/`COMMERCIAL_MANAGER` all pass the base `@Roles` check on
the parent resource.

### `backend/src/modules/agencies/`

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/agencies` | SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER | Query: `q?` (name/license/manager/city search), `debtorsOnly?` (Commercial's "آژانس‌های دارای بدهی" panel). Returns list + the same 4 KPI cards (active count, total credit granted, total used/debt, pending-settlement count) confirmed identical across all three panels. |
| GET | `/agencies/:id` | SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER | Detail: profile, computed stats (total sales, tickets issued, passengers), credit summary, recent activity timeline. `activityScore` (see DB_SCHEMA) is only included for FINANCE_MANAGER/COMMERCIAL_MANAGER — Senior Manager's detail view never showed it. |
| PATCH | `/agencies/:id/suspend` | SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER | `{ reason }` (required) → sets `suspendedAt`/`suspendReason`, `AuditLog(category=AGENCY)`. |
| PATCH | `/agencies/:id/reactivate` | same as suspend | Clears suspension. |
| GET | `/agencies/:id/credit` | SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER | `{ limitIrr, usedIrr (derived), remainingIrr }`. |
| PATCH | `/agencies/:id/credit` | SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER | `{ limitIrr }` — confirmed present in all three panels' Credit modal. Writes `AuditLog(category=AGENCY)`. |
| POST | `/agencies/:id/settle` | SENIOR_MANAGER, FINANCE_MANAGER | "ثبت تسویه" — creates a `LedgerEntry(type=SETTLEMENT)` for the outstanding balance. **Not** shown in Commercial Manager's UI (which settles via invoices instead — see below), so not authorized for that role. |
| GET | `/agencies/requests` | SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER | List membership requests, `status?` filter. The public **POST** (an agency's own signup form) is deferred entirely — not implemented this phase, not even as a stub route — since it belongs to the not-yet-built agency-portal track and isn't in `docs/features/agencies.md`'s checklist. |
| GET | `/agencies/requests/:id` | SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER | Applicant info + documents + (Senior/Commercial only) referral history. |
| PATCH | `/agencies/requests/:id/approve` | SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER | Creates the `AgencyProfile` + backing `User(role=AGENCY)`. |
| PATCH | `/agencies/requests/:id/reject` | SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER | |
| PATCH | `/agencies/requests/:id/refer` | SENIOR_MANAGER, COMMERCIAL_MANAGER | `{ referredToId, note? }` — confirmed only in those two panels' request-detail screen. |
| GET / POST | `/agencies/:id/api-key` | SENIOR_MANAGER only | Issue. |
| PATCH | `/agencies/:id/api-key/:keyId` | SENIOR_MANAGER only | `{ status: ACTIVE\|SUSPENDED }` or regenerate. Confirmed **exclusive** to Senior Manager's agency detail — Finance/Commercial never show this section. |
| GET / POST | `/agencies/:id/invoices` | COMMERCIAL_MANAGER (issue), FINANCE_MANAGER + SENIOR_MANAGER (read-only) | "صدور فاکتور" — confirmed only in Commercial Manager's agency detail → مالی sub-tab. |
| PATCH | `/agencies/:id/invoices/:invoiceId/pay` | FINANCE_MANAGER, COMMERCIAL_MANAGER | Marks `PAID`, writes the `SETTLEMENT` ledger row (see DB_SCHEMA note — never a bare status flip). |
| POST | `/agencies/:id/invoices/:invoiceId/remind` | COMMERCIAL_MANAGER | "یادآوری" — queues a notification (SmsProvider/email interface, mocked in dev). |
| GET / POST | `/agencies/:id/messages` | COMMERCIAL_MANAGER only | "مکاتبه‌ها" chat thread — confirmed exclusive to that panel. |
| POST | `/agencies/debtors/notify-all` | COMMERCIAL_MANAGER | Bulk "ارسال اعلان به همه" on the debtors panel. |

---

## Phase 4 — Cartable, referrals, manager messaging

See `docs/DB_SCHEMA.md` → Phase 4 for the wiring decisions (⚑) these
endpoints implement — notably: cartable review = تأیید/رد/انتقال with a
required «نظر مدیر» note; transfer routes a fresh task to the target;
messages and referrals deliver INTO recipients' cartables (the design has
no other inbox). `EXEC_ROLES` below = CEO, BOARD_CHAIR, SENIOR_MANAGER,
FINANCE_MANAGER, COMMERCIAL_MANAGER (the 5 panels with a کارتابل tab).

### `backend/src/modules/cartable/`

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/cartable` | EXEC_ROLES | Caller's own tasks. Query: `category?` (ADMIN\|AGENCY\|MANAGER — the 3 KPI filter cards), `date?` (ISO day, the Jalali calendar popover filter), `status?` (default OPEN). Returns rows + per-category counts for the KPI cards + total for the badge. |
| PATCH | `/cartable/:id/approve` | EXEC_ROLES (assignee only) | `{ note }` — required, per the design's «برای ثبت تصمیم، درج نظر مدیر الزامی است.». Resolving a task whose `sourceType` has side effects triggers them (e.g. chair-permission APPROVED). |
| PATCH | `/cartable/:id/reject` | EXEC_ROLES (assignee only) | `{ note }` required. The design's red button is labeled «انصراف» but behaves as reject — kept as reject server-side. |
| PATCH | `/cartable/:id/transfer` | EXEC_ROLES (assignee only) | `{ toId, note }` — creates a new OPEN task for `toId`, marks this one TRANSFERRED. 409 on already-resolved tasks (no double-resolution). |
| POST | `/cartable/chair-permission` | FINANCE_MANAGER, COMMERCIAL_MANAGER | The gate banner's «درخواست مجوز از رئیس هیئت مدیره» — 409 if one is already PENDING/APPROVED; creates BOARD_CHAIR's cartable task. |
| GET | `/cartable/chair-permission` | FINANCE_MANAGER, COMMERCIAL_MANAGER | Own latest request status — drives the banner's pending/approved state. |

### `backend/src/modules/staff-directory/`

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/staff-directory` | EXEC_ROLES | Active staff users `{ id, fullName, role, roleLabelFa }` for the transfer picker, referral recipient chips, and Phase 3's deferred agency-request refer UI (wired this phase). |

### `backend/src/modules/referrals/`

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/referrals` | SENIOR_MANAGER | Sent referrals («ارجاعات من به مدیران») + the 4 KPI counts (کل/در انتظار گزارش/گزارش دریافت‌شده/بسته‌شده). |
| POST | `/referrals` | SENIOR_MANAGER | `{ title, body, recipientIds[] (≥1), priority, dueAt?, attachmentIds? }` — validation message per design: موضوع، شرح و حداقل یک مدیر مقصد الزامی است. Creates recipient cartable tasks. |
| GET | `/referrals/:id` | SENIOR_MANAGER (sender) + recipients | Detail incl. recipients, attachments, reports thread. |
| POST | `/referrals/:id/reports` | recipients only | `{ body, attachmentIds? }` — flips status to REPORTED. (No mock UI existed for this — see DB_SCHEMA ⚑.) |
| PATCH | `/referrals/:id/close` | SENIOR_MANAGER (sender) | «تأیید دریافت گزارش و بستن» — only from REPORTED, else 409. |
| PATCH | `/referrals/:id/request-revision` | SENIOR_MANAGER (sender) | «درخواست اصلاح گزارش» — REPORTED → REVIEWING. |
| POST | `/referrals/:id/remind` | SENIOR_MANAGER (sender) | «ارسال یادآوری دریافت گزارش» — SENT/REVIEWING → REVIEWING, notifies recipients. |

### `backend/src/modules/manager-messages/`

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/manager-messages` | EXEC_ROLES | `{ toDept, subject, body, attachmentIds? }` — compose modal; delivery = recipient cartable tasks (SUPPORT/AGENCIES accepted but undeliverable until Phase 8, returns a documented `PARTIAL_DELIVERY` warning in data). |
| GET | `/manager-messages/sent` | EXEC_ROLES | Sender's own history (the mocks discard sent messages; the real system keeps the record). |

### `backend/src/modules/files/`

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/files` | any staff role | multipart upload, PDF/image only, ≤ 5MB; returns `{ id, fileName }` for attaching. |
| GET | `/files/:id` | owner + participants of the entity it's attached to | Streams the file; 403 otherwise. |

---

## Phase 8 — Employee management (IT Manager)

Scope confirmed against `PLAN.md`'s Phase 8 bullet — **accounts, permissions,
services, security policy, logs, backups** — exactly 6 of the design's 9 IT
tabs. The other 3 (سامانه رزرواسیون, دسترسی به پنل‌ها, تنظیمات سامانه)
stay `implemented: false`: the first depends on Phase 9's `ReservationSystem`
build-out, the other two are explicitly re-scoped to Phase 12 in `PLAN.md`
("plus the UI for the two Phase-1 backends..." / "تنظیمات سامانه" listed
there, not here) — not silently dropped, just not this phase's job. All
endpoints below: `@Roles('IT_MANAGER')` + `AuditLog` on every write, per
CLAUDE.md's RBAC/observability rules. See `docs/DB_SCHEMA.md` → Phase 8 for
the data model and the design's `PERM_CATALOG` reproduction.

### `backend/src/modules/it-manager/` — employees ("کاربران و دسترسی‌ها")

| Method | Path | Notes |
|---|---|---|
| GET | `/it/permissions` | The seeded catalog (dept → sections → perms), grouped exactly like `PERM_CATALOG` in `site-data.js` — feeds the create-employee form and the detail modal's "افزودن دسترسی" list. |
| GET | `/it/employees` | Query: `dept?`, `q?` (name/username). List with `role` label, `dept`, `username`, `lastLoginAt`, `isActive`. |
| POST | `/it/employees` | `{ fullName, username, password (≥6), dept, customDeptLabel?, rank, referralScope, permissionKeys[] }` — creates `User(role=EMPLOYEE)`, hashes password (argon2), grants the listed catalog permissions. The design's `createStaffUser()` also always tags every new employee with `"dashboard"`/`"cartable"` — **not** carried over: neither corresponds to a real gate for `EMPLOYEE` in this backend (not a `REPORTING_ROLES`/`EXEC_ROLES` member), so faking the grant would be cosmetic only. 409 on duplicate username. `AuditLog(category=ACCOUNT)`. |
| GET | `/it/employees/:id` | Detail: profile + last login + granted permissions + the catalog rows not yet granted ("available"). 404 for non-EMPLOYEE / non-existent ids. |
| PATCH | `/it/employees/:id/status` | `{ isActive }` — suspend/reactivate. `AuditLog(category=ACCOUNT)`. |
| PATCH | `/it/employees/:id/permissions` | `{ permissionKey, grant }` — single toggle (mirrors the design's per-row switch). `AuditLog(category=ACCESS)`. |
| POST | `/it/employees/:id/reset-password` | Generates a temporary password, argon2-hashes it onto the account, sets `mustChangePassword=true`, records a `PasswordResetEvent`, `AuditLog(category=ACCOUNT)`. Returns the plaintext temp password **once** in this response only — never stored, never logged (per Security Rules' OTP/secret-at-rest pattern). |

### `backend/src/modules/it-manager/` — security ("رمزها و امنیت")

| Method | Path | Notes |
|---|---|---|
| GET | `/it/security/policy` | The singleton `SecurityPolicy` row (auto-created with design's defaults on first read). |
| PATCH | `/it/security/policy` | Any subset of the toggle/param fields. `AuditLog(category=SECURITY)`. |
| GET | `/it/security/sessions` | Active (non-revoked, non-expired) `RefreshToken`s joined to their user — "۴۸ کاربر هم‌اکنون وارد سامانه هستند" + per-row device/IP. |
| POST | `/it/security/sessions/logout-all` | Revokes every active `RefreshToken` site-wide — the design's «خروج همه». `AuditLog(category=SECURITY)`, high-severity by nature so confirmed as IT-only, not delegated. |

### `backend/src/modules/it-manager/` — services ("سرویس‌های سایت")

| Method | Path | Notes |
|---|---|---|
| GET | `/it/services` | `{ internal: InternalService[], external: ExternalServiceConfig[] }` (seeded rows from `site-data.js`'s `svcDefs`/`extDefs`; `apiKeyEncrypted` never returned in plaintext — masked). |
| PATCH | `/it/services/internal/:key` | `{ enabled }` — toggle, immediate (per design copy "بلافاصله روی سایت اعمال می‌شود"). `AuditLog(category=SYSTEM)`. |
| POST | `/it/services/external` | Create — `{ nameFa, provider, endpoint, method, timeoutMs, apiKey?, sandbox }`; `apiKey` encrypted at rest (`pii-crypto` AES-256-GCM, reused generically — not a PII field but the same reversible-encryption primitive). |
| PATCH | `/it/services/external/:id` | Update any field incl. `enabled` toggle. |
| DELETE | `/it/services/external/:id` | Remove. |
| POST | `/it/services/external/:id/test` | Real connectivity check — HTTP request to the stored endpoint with the configured method/timeout/key, hard-capped; records `lastTestAt/lastTestOk/lastTestMessage`. Never fakes a result. |

### `backend/src/modules/it-manager/` — backups ("پشتیبان‌گیری")

| Method | Path | Notes |
|---|---|---|
| GET | `/it/backups` | `BackupRecord` list, newest first. |
| POST | `/it/backups` | Triggers a real `pg_dump` (via `DATABASE_URL`) to the configured backup directory; creates a `RUNNING` row, updates to `SUCCESS`/`FAILED` with size/error when the process exits. Never simulated — a missing `pg_dump` binary is a real `FAILED` row, not a fabricated success. |
| GET | `/it/backups/schedule` | Static config describing the server-side cron (`scripts/backup-db.sh`, already documented in `docs/RUNBOOK.md`) — informational only, this phase does not add a second, competing scheduler. |

Restore is intentionally **not** a one-click endpoint: CLAUDE.md's own
deployment rules treat restore as a manual, RUNBOOK-documented operation
("once a month, restore the latest dump into a throwaway container") — wiring
a database-overwriting action behind a panel button would contradict that,
not implement it faster.

### `backend/src/modules/it-manager/` — dashboard ("داشبورد فنی")

| Method | Path | Notes |
|---|---|---|
| GET | `/it/dashboard` | `{ kpis, serviceHealth, resources, recentEvents }`. `kpis`: active employees, active sessions, services up/total, last backup status+age. `serviceHealth`: from `InternalService`+`ExternalServiceConfig`. `resources`: **real** host memory (`os.totalmem/freemem`) + 1-minute load average (`os.loadavg`) — never synthetic/random numbers. `recentEvents`: latest `AuditLog` rows across SYSTEM/ACCOUNT/ACCESS/SECURITY. |

### Logs ("لاگ و رویدادها") and Panels access ("دسترسی به پنل‌ها")

Both already exist from Phase 1 — `GET /audit/logs` and `GET /panels/access`
(see Phase 1 section above). This phase only wires the IT panel's frontend
tabs to them; no new backend endpoints.

---

## Later phases (endpoints TBD — documented here before each phase's code is written)

- **Phase 2** — none directly (reporting reads Phase-2 tables; no new endpoints of its own beyond what's above).
- **Phase 5 — VIP club** (`backend/src/modules/club/`; roles below are the 3 panels with the tab — CEO, BOARD_CHAIR, SENIOR_MANAGER):
  - GET `/club/members` — `level?`, `q?` (name/email/cardNo, plus exact nationalId via hash); returns members + the KPI counts (کل اعضا، کارت‌های صادرشده، درخواست در انتظار، توزیع سطوح). All 3 roles.
  - POST `/club/members` — «تعریف مشتری VIP جدید» — CEO+BOARD_CHAIR only (the form exists only in their panels); national-ID checksum validated, PII encrypted.
  - PATCH `/club/members/:id/level` — tier segmented control — SENIOR_MANAGER only, audited.
  - POST `/club/members/:id/issue-card` — «صدور کارت» direct issuance — all 3 roles; 409 if already issued; audited (⚑).
  - GET `/club/card-requests` — the panels' queue (server filters to REFERRED/APPROVED/REJECTED — SUBMITTED lives in the site-admin track); includes history timeline. All 3 roles.
  - PATCH `/club/card-requests/:id/approve` | `/reject` — «تأیید و صدور کارت» / «انصراف» — CEO/BOARD_CHAIR: any REFERRED; SENIOR_MANAGER: only `assignedTo=SENIOR` (⚑); transactional + audited; 409 on non-REFERRED.
- **Phase 6 — Ticket pricing** (`backend/src/modules/pricing/` + `backend/src/modules/ai/` + `ml-service/`):
  - GET `/pricing/proposals` — CEO: pending + registered lists with counts; COMMERCIAL_MANAGER: upcoming SCHEDULED flight instances joined with their proposal (the design's «تعیین قیمت پرواز و ارسال به مدیر عامل» rows with «قیمت‌گذاری نشده/در انتظار تأیید/قفل‌شده» states).
  - PUT `/pricing/flights/:flightInstanceId/proposal` — COMMERCIAL_MANAGER — `{ proposedPriceIrr, legalRateIrr?, note? }`; upsert, editable while PENDING («می‌توانید تا زمان تأیید آن را ویرایش کنید»), 409 once REGISTERED.
  - PATCH `/pricing/proposals/:id/legal-rate` — CEO — «ثبت نرخ قانونی»; audited.
  - PATCH `/pricing/proposals/:id/register` — CEO — `{ source: 'PROPOSED' | 'AI' }`; AI source requires a persisted suggestion; PENDING→REGISTERED, locked, audited; 409 on re-register.
  - POST `/pricing/proposals/ai-analysis` — CEO — «تحلیل و پیشنهاد قیمت هوش مصنوعی» for all PENDING proposals via the NestJS→ml-service client (2s timeout, graceful fallback, usage logged); persists suggestions with modelVersion. Advisory only.
  - ml-service: `POST /internal/v1/price-suggestion` (internal token; pydantic; versioned heuristic model; pytest) + `GET /health`.
- **Phase 7** — `/refunds`, `/refunds/:id/refer`, `/refunds/:id/pay`.
- **Phase 9** — `/reservation/seats/:flightInstanceId`, `/reservation/seats/:id/lock`, `/reservation/seats/:id/release`, `/reservation/pnr/*`.

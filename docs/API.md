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

## Phase 9 — Reservation system (seat lock / PNR)

Roles: `BOARD_CHAIR`, `SENIOR_MANAGER`, `IT_MANAGER` have the reachable
سامانه رزرواسیون/هواپیما nav entry (per `panel-nav.config.ts`); `CEO` is
authorized at the API level too (⚑ product decision, see `docs/DB_SCHEMA.md`
→ Phase 9) but has no reachable nav entry, matching Phase 1's confirmed
extraction. `canLock` = `CEO`/`BOARD_CHAIR`/`IT_MANAGER`; `SENIOR_MANAGER`
is view-only on every endpoint below (403 on the write ones).

### `backend/src/modules/reservation/`

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/reservation/seatmap/:flightInstanceId` | BOARD_CHAIR, SENIOR_MANAGER, IT_MANAGER, CEO | Computed from `AircraftSeatMap` (by the instance's `Flight.aircraftType`) + sold seats (`Passenger.seatCode` on non-CANCELLED bookings) + active `SeatLock`s. Returns `{ rows[], soldCount, lockedCount, capacity, occupancyPct }`; PII never included. |
| POST | `/reservation/seatmap/:flightInstanceId/lock` | canLock only | `{ seatCode, passengerName?, passengerNationalId?, passengerMobile? }` — 409 if the seat is already sold or actively locked (DB partial-unique-index-backed). PII encrypted+hashed like `ClubMember`. `AuditLog(category=RESERVATION)`. |
| PATCH | `/reservation/seatmap/locks/:id/release` | canLock only | Any canLock role may release any active lock (the design's «×» chip shows no per-locker ownership filter). Sets `releasedAt`; 409 if already released. Audited. |
| GET | `/reservation/pnr` | all 4 reservation roles | `q?` (PNR or passenger name). Grouped by flight instance, newest first — the design's «مدیریت رزروها» list. |
| GET | `/reservation/pnr/:pnr` | all 4 | Full detail incl. passenger + boarding-pass fields. 404 if not found. |
| PATCH | `/reservation/pnr/:pnr/seat` | canLock only | `{ seatCode }` — «تغییر رزرو»; 409 if the target seat is sold/locked by someone else; 409 if the booking is CANCELLED. Audited. |
| PATCH | `/reservation/pnr/:pnr/cancel` | canLock only | «لغو رزرو» → `BookingStatus.CANCELLED`; releases the seat for resale; 409 if already CANCELLED. Audited. |
| GET | `/reservation/search` | all 4 | `origin`, `dest`, `date` (Jalali, converted) → matching `SCHEDULED` `FlightInstance`s with a computed price (`FarePricingProposal.registeredPriceIrr` if REGISTERED, else a documented flat fallback — no invented dynamic pricing) and free-seat count. |
| POST | `/reservation/pnr` | canLock only | «صدور PNR و بلیط» — staff-side **manual/offline** issuance (phone/counter booking): `{ flightInstanceId, seatCode, passengerName, passengerNationalId?, passengerMobile? }` → creates a `TICKETED` `Booking`+`Passenger` directly (no HELD/PAID steps — no payment gateway involved, distinct from the public paid-checkout track) + a `LedgerEntry(type=SALE)`. 409 if the seat is sold/locked. Audited. |
| GET | `/reservation/dashboard-stats` | all 4 | Real counts only (today's bookings, active PNRs, seats sold, revenue) — the design's "microservices health" cards are **not** ported (they'd describe infrastructure that doesn't exist in this monolith; CLAUDE.md forbids fabricated status data). |
| POST | `/reservation/_test/flight-instance` | all 4 | E2E only — creates a fresh SCHEDULED instance with a randomized far-future date (avoids collisions across repeated test runs); always 404s in production. Same pattern as `club`'s and `pricing`'s own `_test/*` seeding hooks. |

Deliberately not built this phase (see `docs/DB_SCHEMA.md`'s Phase 9 note):
agency API access (duplicates Phase 3's `AgencyApiKey`), flight/schedule/
capacity creation (Phase 10's own scope).

---

## Agency Portal (self-service, پنل آژانس) — separate track, reassigned into this session

Explicitly authorized by the user (2026-07-17, after confirming this feature
did not exist anywhere despite `CLAUDE.md` scoping it to the public-site
track). Grounded in a full extraction of `پنل آژانس.dc.html`'s 7 نav tabs
(دشبورد/صندلی‌های تخصیص‌یافته/وب‌سرویس/اعتبار و مانده/فروش و گزارش/کارتابل و
پیام‌ها/پروفایل و مدارک) and reuses Phase 3's `AgencyProfile`/
`AgencyCreditLine`/`AgencyInvoice`/`AgencyMessage`/`AgencyApiKey` — this is
the agency's own self-service view over the SAME rows the staff آژانس‌ها tab
already manages, not a parallel data model.

⚑ **Login mechanism (product decision, no design-confirmed spec existed —
the design's «آژانس همکار» login tab labels the identifier «نام کاربری / کد
آژانس», a concept with no backing field anywhere in the schema):** login is
phone + password, no 2FA (`User.phone`, already populated for every AGENCY
user since Phase 3's `approveRequest` sets it from the membership request) —
reusing real data instead of inventing an "agency code" column. Frontend
copy reads «شماره تماس آژانس» rather than copying the design's literal
"کد آژانس" label, to stay honest about what's actually collected. 2FA is
skipped because the design shows no 2FA step anywhere in the آژانس همکار
tab (unlike staff login, which is 2FA-mandatory per `CLAUDE.md`).
`approveRequest` (Phase 3) is extended to also issue a one-time temp
password (same pattern as IT Manager's employee `resetPassword`) — before
this, an approved agency had a `User` row with `passwordHash: null` and no
way to ever log in.

⚑ **Credit top-up reinterpreted as an audited request, not a mutation**
(the design's «افزایش اعتبار» modal directly raises `_limitN` client-side —
exactly the mutable-balance anti-pattern `CLAUDE.md`'s financial rules
forbid carrying over). The agency submits an `AgencyCreditRequest`; a
staff member with credit authority (`SENIOR_MANAGER`/`FINANCE_MANAGER`/
`COMMERCIAL_MANAGER` — the same three roles already authorized on
`PATCH /agencies/:id/credit`) decides it, and only that decision calls the
existing `updateCredit` service method. No new code path can change a
credit limit outside that one already-audited method.

Deferred, not silently dropped (see `docs/features/agency-portal.md` for
full reasoning): «صندلی‌های تخصیص‌یافته» (allocated seats) — no staff-side
allocation workflow exists anywhere to allocate seats to an agency in the
first place; «وب‌سرویس» self-service API purchase+approval — no staff-side
purchase-approval counterpart exists (only issuance via Phase 3's Senior
Manager-only `AgencyApiKey` flow, which stays staff-initiated); staff-side
document review (uploaded docs stay `PENDING` — reviewing them is a new
staff workflow, not part of this slice); Excel export (mock-only button,
not a real feature anywhere else in the codebase either).

### `backend/src/modules/auth/` (new agency login path)

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/auth/agency/login` | public | `{ phone, password }` → `{ accessToken, user }` directly (no 2FA challenge step, unlike staff login). 401 on bad credentials, 403 if suspended (`AgencyProfile.suspendedAt` set) or inactive. Sets the same httpOnly refresh cookie as staff login; `/auth/refresh`, `/auth/me`, `/auth/logout` are already role-agnostic and work unchanged for AGENCY users. |

### `backend/src/modules/agencies/` (staff-side additions)

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/agencies/:id/credit-requests` | SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER | Pending + decided `AgencyCreditRequest` rows for one agency. |
| PATCH | `/agencies/:id/credit-requests/:reqId/decide` | same as above | `{ approve: boolean }` — approve calls the existing `updateCredit` internally with the requested limit (single audited code path); reject just marks `REJECTED`. 409 on an already-decided request. |

### `backend/src/modules/agency-portal/` — self-scoped to the caller (`actor.id` IS the `AgencyProfile.userId`; no `:id` param anywhere, ownership is implicit)

| Method | Path | Notes |
|---|---|---|
| GET | `/agency-portal/dashboard` | `{ credit, kpis: { salesThisMonthIrr, ticketsIssuedTotal, seatsSoldThisMonth }, monthlySales: [{month,salesIrr}] (last 6 months) }`. The design's «صندلی تخصیص‌یافته» KPI card is replaced with `ticketsIssuedTotal` (real, derived from `Booking`) — CLAUDE.md forbids fabricating a figure for a workflow (seat allocation) that doesn't exist yet, same reasoning as Phase 9's dashboard. |
| GET | `/agency-portal/credit` | `{ limitIrr, usedIrr, remainingIrr }` — reuses `AgenciesService.getCredit(actor.id)` verbatim. |
| GET | `/agency-portal/ledger` | Last 20 `LedgerEntry` rows for «گردش حساب اخیر» (recent activity), signed for +/- display. |
| GET | `/agency-portal/invoices` | Own invoices — reuses `AgenciesService.listInvoices(actor.id)`. |
| POST | `/agency-portal/invoices/:invoiceId/pay` | «پرداخت از اعتبار» — reuses `AgenciesService.payInvoice` verbatim (same transactional conditional-update + `SETTLEMENT` ledger row as the staff-side pay action); ownership is implicit since the agency can only ever pass its own id. |
| POST | `/agency-portal/credit-requests` | `{ requestedLimitIrr, note? }` — must exceed the current limit; creates `AgencyCreditRequest(PENDING)`, audited, fans a `CartableTask` out to SENIOR_MANAGER/FINANCE_MANAGER/COMMERCIAL_MANAGER (no `sourceType` — informational only, the actual decision goes through the dedicated decide endpoint above, not generic cartable resolution). |
| GET | `/agency-portal/credit-requests` | Own request history + status. |
| GET | `/agency-portal/sales` | «فروش و گزارش»: own ticket list (`Booking` rows, PAID/TICKETED/REFUNDED) + per-flight aggregation + summary KPIs (کل فروش، بلیط صادرشده، میانگین نرخ، نرخ استرداد — all real, computed server-side per `CLAUDE.md`'s reporting rule). |
| GET | `/agency-portal/inbox` | «کارتابل و پیام‌ها» — reuses `AgenciesService.listMessages(actor.id)`. |
| POST | `/agency-portal/inbox` | `{ body }` — reuses a `senderIsAgency`-aware `AgenciesService.postMessage` (the staff-side controller keeps calling it with `senderIsAgency=false`; this path passes `true`). |
| GET | `/agency-portal/profile` | Own `AgencyProfile` fields — a dedicated lightweight query, NOT a reuse of the staff `detail()` method, since that method also returns internal `AuditLog` rows and an `activityScore` never meant for the agency's own eyes. |
| GET | `/agency-portal/documents` | Own `AgencyDocument` list. |
| POST | `/agency-portal/documents` | multipart `{ file, docType }` — reuses `FilesService.store` (PDF/PNG/JPG, ≤5MB), wraps the resulting `StoredFile` in an `AgencyDocument(status=PENDING)`. Staff review is deferred (see above) — status stays `PENDING` until that phase. |

No `_test/*` seeding hook was needed for this feature (unlike club/pricing/reservation) — the seed already provisions two agencies (`+989120000002` gold, `+989120000003` silver, suspended) with the shared dev password, which is deterministic enough for Playwright. A `_test/set-password` endpoint was drafted and then removed: it would have lived under the same `@Roles('AGENCY')`-gated controller it was meant to bootstrap credentials for, which is unreachable before any credentials exist — a real chicken-and-egg gap, not a deliberate deferral.

---

## Phase 10 — Flight management (مدیریت پروازها)

Module `backend/src/modules/flights/`. Roles: `SENIOR_MANAGER` +
`COMMERCIAL_MANAGER` (the two panels with the tab; nav keys `flights` in
both — Commercial's tab already hosts Phase 6's pricing section, which
stays untouched on the same page).

- GET `/flights/overview` — the tab's data in one call: KPI row (پرواز
  فعال / صندلی فروخته‌شده / میانگین ضریب اشغال) + the three lists:
  - `active`: SCHEDULED instances — route label, flightNo, Jalali
    date/time, sold/capacity (+ derived status فعال/در حال فروش/تکمیل/لغو
    شده), basePriceIrr.
  - `completed`: DEPARTED instances — per-channel revenue sums from real
    bookings (سیستمی/چارتری/آژانس), tickets, نرخ اصلی, متوسط نرخ, سود/ضرر
    vs base rate + the 4 KPI totals.
  - `future`: SCHEDULED instances with `departureAt` beyond the active
    window — capacity, charterSeats, agencySeatsAllocated, persisted AI
    suggestion (if any), and the Jalali day list for the calendar filter.
- GET `/flights/airports` — seeded airport catalog for the add-flight
  selects.
- POST `/flights` — «افزودن پرواز» modal `{ originCode, destCode,
  flightNo, departureDate (Jalali), departureTime, capacity,
  basePriceToman }` — find-or-create Route/Flight, create instance;
  validation per design («لطفاً همه فیلدها را تکمیل کنید.») plus server
  rules (origin≠dest, future date, capacity/price bounds); audited.
- GET `/flights/:instanceId` — flight detail modal: sold/cap, ضریب اشغال,
  قیمت پایه, real channel breakdown (seats + revenue per سیستمی/چارتری/
  آژانس) and مجموع درآمد from bookings.
- PATCH `/flights/:instanceId/plan` — the future-flight نرخ‌گذاری modal
  `{ priceToman, agencySeats }` — agencySeats capped at capacity −
  charterSeats (مستقیم derived); sets `basePriceIrr` +
  `agencySeatsAllocated`; audited. ⚑ price registration authority: in the
  mocks BOTH Senior and Commercial set the final rate directly here,
  which conflicts with Phase 6's approved CEO-approval flow — proposed
  resolution: this endpoint stores the plan figures, and for COMMERCIAL
  it also upserts the Phase 6 proposal (still requiring CEO registration
  to become the bookable price); SENIOR_MANAGER's save is allowed as-is
  for the plan figures only. The bookable price NEVER comes from this
  endpoint.
- POST `/flights/ai-analysis` — «تحلیل قیمت‌گذاری با هوش مصنوعی» over the
  future list, reusing Phase 6's ml-service client verbatim (2s timeout,
  graceful degradation, advisory only, persisted with modelVersion).
- Deferred (explicit): خروجی Excel buttons (same deferral as Phase 3's,
  toast-only in mocks); RRULE schedules (no design UI — see DB_SCHEMA).

---

## Phase 13 — Reservation engine completion, Part A

See `docs/DB_SCHEMA.md`'s Phase 13 for the full reasoning. Note: the
public booking engine's own endpoints (`backend/src/modules/booking-engine/`
— `GET /search/flights`, `GET /search/flights/:id/seatmap`, `POST
/bookings`, `PATCH /bookings/:id/pay`, etc.) were built on the public-site
track and were never added to this file before the branches merged into
`main` — that's pre-existing doc debt from before this phase, not
something this phase caused; backfilling their full documentation here is
a separate task, not bundled into this one so this phase's diff stays
reviewable. Only what Phase 13 actually changes is documented below.

- `GET /search/flights` and `POST /bookings` (`booking-engine` module):
  - Both now respect `FlightInstance.saleStartsAt/saleEndsAt` — an instance
    outside its window is excluded from search results, and `POST /bookings`
    against one 409s `SALE_WINDOW_CLOSED`.
  - `POST /bookings` gains a channel-pool check alongside the existing
    per-seat conflict check — 409 `POOL_EXHAUSTED` (with which pool:
    `AGENCY` | `CHARTER` | `SYSTEM`) when the requested channel's pool is
    full, even if physical seats remain (they belong to a different pool).
  - `seatsLeft` in search results is unchanged (still physical vacancy per
    cabin) — see DB_SCHEMA's ⚑ scope-cut note; the enforced guarantee is the
    409 above, not the display number.
- PATCH `/flights/:instanceId/aircraft` (new, `backend/src/modules/flights/`,
  `SENIOR_MANAGER` + `COMMERCIAL_MANAGER`, matching Phase 10's existing
  role gate) — `{ aircraftType }`. Re-points the instance at a different
  `AircraftSeatMap`; 409 `CAPACITY_BELOW_CONFIRMED` (with the shortfall
  count) if the new type's capacity is less than the instance's current
  confirmed-or-later booking + active-lock count. No design mock shows
  this control (aircraft type is create-only in every existing panel), so
  it's a new form field on the flight-detail view — not a redesign of an
  existing one.
- `PATCH /flights/:instanceId/plan` (existing, Phase 10) gains optional
  `saleStartsAt`/`saleEndsAt` (Jalali in the request, stored UTC) —
  additive, no change to its existing `priceToman`/`agencySeats` behavior.

## Phase 13 — Reservation engine completion, Part B

See DB_SCHEMA.md's Phase 13 Part B for the full reasoning — no design
screen exists for this yet, so these are backend-only for now.

- `GET /flights/:instanceId/fare-rules` — `SENIOR_MANAGER` +
  `COMMERCIAL_MANAGER`. Lists the instance's fare-class rows ordered by
  price.
- `POST /flights/:instanceId/fare-rules` — same roles —
  `{ cabin, classCode, priceIrr, seatsAllocated, taxIrr?, refundable?,
  changeable?, baggageAllowanceKg?, validFrom?, validUntil?,
  allowedChannels? }`. 400 `VALIDATION_FAILED` if this rule would push the
  cabin's total `seatsAllocated` past its physical seat count, or if
  `validUntil <= validFrom`.
- `PATCH /flights/:instanceId/fare-rules/:id` — same roles, same body
  (partial) and validations, re-checked against the instance's OTHER
  existing rules.
- `DELETE /flights/:instanceId/fare-rules/:id` — same roles — 409
  `CONFLICT` if any active booking (`DRAFT|HELD|PAID|TICKETED`) is already
  stamped with this rule's `classCode` for the instance.
- `getCabinPrice`'s return shape is unchanged (still just the per-seat
  `priceIrr`, pre-tax) for backward compatibility with every existing
  caller; `POST /bookings`'s response gains a `taxIrr` field (0 when the
  resolved price didn't come from a `FareRule`) alongside the existing
  `priceIrr`, which now includes the tax total.

## Phase 13 — Reservation engine completion, Part C

See DB_SCHEMA.md's Phase 13 Part C — staff-side allotment bookkeeping
only this phase; an agency actually booking against one is a follow-up
(no payment-path design exists for it yet).

- `GET /flights/:instanceId/allotments` — `SENIOR_MANAGER` +
  `COMMERCIAL_MANAGER`. Lists the instance's allotments (agency name,
  seats, type, releaseAt, contractPriceIrr), each flagged `active: boolean`
  (false once a SOFT row's `releaseAt` has passed).
- `POST /flights/:instanceId/allotments` — same roles —
  `{ agencyId, seatsAllocated, type?, releaseAt?, contractPriceIrr? }`.
  400 `VALIDATION_FAILED` if the sum of every active allotment's
  `seatsAllocated` for this instance (including this new one) would
  exceed `FlightInstance.agencySeatsAllocated`, or if that field is unset.
  `releaseAt` is only meaningful (and only accepted) when `type: 'SOFT'`.
- `DELETE /flights/:instanceId/allotments/:id` — same roles — 409
  `CONFLICT` if that agency already has an active booking on this
  instance (there is currently no path that creates one — see
  DB_SCHEMA.md — so this guard is a no-op today and becomes real once
  agency booking creation lands).

## Phase 13 — Reservation engine completion, Part D

See DB_SCHEMA.md's Phase 13 Part D — backend-only governance layered onto
Phase 9's `SeatLock`; no design screen exists for a request/approval queue.
All endpoints live in `backend/src/modules/reservation/`, gated
`CAN_LOCK_ROLES` (`CEO`, `BOARD_CHAIR`, `IT_MANAGER`) unless noted.

- `POST /reservation/seatmap/:flightInstanceId/lock` (existing endpoint,
  changed body/behavior) — now `{ seatCode, reason, classification,
  discountPct?, passengerName?, passengerNationalId?, passengerMobile? }`.
  400 `VALIDATION_FAILED` if `discountPct` is given without
  `classification: 'DISCOUNTED'` (or vice versa) or is outside 0–100.
  409 `LOCK_CAP_EXCEEDED` if the requester already has
  `MAX_ACTIVE_MANAGERIAL_LOCKS_PER_REQUESTER` (5) active locks anywhere.
  Creates the lock `PENDING_APPROVAL` with `expiresAt = now + 24h` — it no
  longer immediately behaves like an active managerial hold; it must be
  approved first.
- `PATCH /reservation/seatmap/locks/:id/approve` (new) — no body. 409
  `CONFLICT` if not `PENDING_APPROVAL`, expired, or the caller is the
  original requester (self-approval blocked). Sets
  `approvalStatus: APPROVED`, `approvedById/At`, `expiresAt = now + 48h`.
- `PATCH /reservation/seatmap/locks/:id/reject` (new) — `{ rejectionReason }`.
  409 `CONFLICT` if not `PENDING_APPROVAL` or already expired. Unlike
  approve, self-rejection IS allowed (a requester withdrawing their own
  pending request isn't the segregation-of-duties gap approval guards
  against). Sets `approvalStatus: REJECTED`, `rejectedById/At`,
  `rejectionReason`, and `releasedAt` immediately (frees the seat).
- `PATCH /reservation/seatmap/locks/:id/release` (existing) — unchanged;
  still works on any not-yet-released lock regardless of approval state
  (a requester or another authorized manager can always stand down early).
- `POST /reservation/pnr/from-lock/:lockId` (new) — `{ passengerName,
  passengerNationalId?, passengerMobile? }`. 409 `CONFLICT` if the lock
  isn't `APPROVED` or has expired. Finalizes into a `TICKETED` booking
  priced per the lock's `classification` (see DB_SCHEMA.md), stamps the
  lock `releasedAt`/`bookingId`, records the same `LedgerEntry`+`AuditLog`
  pattern as the existing `POST /reservation/pnr` manual-issuance path.
- `GET /reservation/seatmap/:flightInstanceId` (existing) — response is
  unchanged in shape; a `LOCKED` seat now only reflects a currently-active
  lock (`releasedAt: null AND expiresAt > now`), so an expired
  never-approved request or an expired never-finalized hold shows as
  `FREE` again automatically.

## Phase 13 — Reservation engine completion, Part E

See DB_SCHEMA.md's Phase 13 Part E for full reasoning — a real bug fix
(payment reconciliation) plus a real-but-unwired flight-lifecycle gap
(`DEPARTED` was never written), not new UI-driven scope.

- `GET /reservation/pnr` / `GET /flights` completed-flights list
  (existing) — both now call `materializeDepartedInstances()` first, so
  «پروازهای انجام‌شده» reflects flights that have actually departed
  instead of only seed-backdated rows.
- `PATCH /reservation/pnr/:pnr/no-show` (new, `backend/src/modules/reservation/`,
  `CAN_LOCK_ROLES`) — marks a `TICKETED`/`FLOWN` booking `NO_SHOW`. 409
  `FLIGHT_NOT_DEPARTED` if the instance hasn't departed yet; 409
  `CONFLICT` if the booking is `CANCELLED`/`REFUNDED`/already `NO_SHOW`.
  Materializes departed instances + flown bookings first, so a booking
  that's technically still `TICKETED` in the DB (lazy flip hasn't run
  yet) is still handled correctly.
- New `backend/src/modules/reconciliation/` (`FINANCE_MANAGER` only,
  same gate as Phase 7 refunds):
  - `GET /reconciliation` — every `PENDING` `PaymentReconciliation` row
    (booking/PNR, gatewayRefId, amountIrr, age) — the actual "payment
    succeeded, ticket not issued" queue.
  - `PATCH /reconciliation/:id/resolve` — `{ resolutionNote }`. 409
    `CONFLICT` if already `RESOLVED`. Marks `RESOLVED`, audited (FINANCE
    category). Does not itself re-issue a ticket or reverse a charge —
    those remain separate, already-existing actions (manual PNR issuance,
    `PaymentGateway.reverse`) a finance user takes alongside resolving
    the queue entry; see DB_SCHEMA.md's reasoning for not automating this.
- `POST /bookings/:id/pay` (existing, `booking-engine` module) — behavior
  for `WALLET`/`POINTS` is unchanged. For `GATEWAY`, a `PaymentReconciliation`
  row is now created the moment the gateway confirms payment, before the
  ticketing transaction runs — invisible to the client (response shape
  unchanged), but real e2e evidence for anyone that a since-fixed bug (a
  transaction failure after gateway capture silently lost track of the
  money) can no longer happen unnoticed.

## Phase 14 — real SmsProvider + management log

See DB_SCHEMA.md's Phase 14 for full reasoning. Endpoints live in
`backend/src/modules/it-manager/` alongside the existing services tab
(`IT_MANAGER` only, matching that tab's existing role gate).

- `GET /it/services/sms-log` (new) — `{ enabled, todaySuccessCount,
  todayFailedCount, recent: [{ id, phoneMasked, messageType, status,
  failureReason, createdAt }] }` (latest 50). `enabled` is read straight
  from the existing `InternalService(key:"sms")` row — same value the
  existing `PATCH /it/services/internal/:key` toggle already writes; no
  new toggle endpoint needed. No uptime figure of any kind is returned.
- No other endpoint changes — `POST /admins` and `POST /admins/:id/reset-password`
  keep their existing request/response shape; they now genuinely send
  (or genuinely fail to send, if no phone is on file — see DB_SCHEMA.md)
  behind the same `delivery` flag, instead of only writing an audit-log
  sentence claiming they did.

---

## Phase 11 — Finance tab (مالی), گزارش مسافران, گزارش کارمندان

Grounded in the FINANCE / PASSENGER SEARCH / STAFF REPORTS markup of all 5
panels that carry these tabs. Design findings that scope this phase:
- The مالی tab has **two distinct layouts**: FINANCE_MANAGER gets the
  finance-ops view (KPI row + low-sales alert + completed-flights box +
  «تراکنش‌های مالی اخیر» + «ترکیب درآمد» donut + «تسویه‌حساب آژانس‌ها»);
  CEO/BOARD_CHAIR/SENIOR_MANAGER/COMMERCIAL_MANAGER get the analytic view
  (the full نمودار فروش with mode switcher روز/ماه/۳ماهه/۶ماهه/سال/پرواز +
  channel sum tiles + completed-flights box + «ترکیب درآمد» donut) — this
  matches CLAUDE.md's «تراکنش‌های اخیر و تسویه آژانس‌ها only in the finance
  manager panel» rule verbatim.
- The finance panel's `finMonths` income/expense bar chart is computed in
  the mock's script but **never rendered anywhere in its markup** (orphaned,
  same class as other confirmed orphans) — not built.
- Excel/PDF export buttons on گزارش مسافران are mock-only (toast) — same
  deferral as every prior phase.
- Almost the whole analytic مالی view is powered by the EXISTING Phase 1
  reporting endpoints (`/reporting/sales-chart` incl. `flight` granularity,
  `/reporting/kpis`, `/reporting/completed-flights-summary`,
  `/reporting/low-sales-alerts`) — the missing backend is only the four
  endpoints below.

### `backend/src/modules/reporting/` (additions)

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/reporting/recent-transactions` | FINANCE_MANAGER | Latest 20 `LedgerEntry` rows joined with party context (agency name via `agencyId`, passenger via `booking`) → `{ type, titleFa, party, occurredAt, signedAmountIrr }[]` + total count. Real rows only — the mock's static `txDefs` are replaced by the ledger. |
| GET | `/reporting/revenue-mix` | CEO, BOARD_CHAIR, SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER | «ترکیب درآمد» donut: per-channel SALE sums + pct over the same optional `granularity`/`periodKey` window as the KPIs. |
| GET | `/reporting/agency-settlements` | FINANCE_MANAGER | «تسویه‌حساب آژانس‌های همکار»: per-agency rows derived from Phase 3 invoices (`amount = SUM(invoices in period)`, `paidPct`, `due = earliest unpaid dueAt`, status تسویه شد/در انتظار/معوق + overdue days) + total outstanding. Remind action reuses Phase 3's `POST /agencies/:id/invoices/:invoiceId/remind` (no new write path). |

### `backend/src/modules/passenger-reports/` (new)

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/passenger-reports/search` | SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER | `q` (passenger full-name substring, or exact national ID via hash — reusing Phase 9's `Passenger.nationalIdHash`) → matching tickets `{ fullName, maskedNationalId, pnr, flightNo, route, departureAt, seatCode, cabin (derived from AircraftSeatMap row bands), priceIrr, status }[]`. PII rule: national ID always masked (`123******7` style) — this surface never decrypts. |

### `backend/src/modules/staff-reports/` (new)

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/staff-reports` | FINANCE_MANAGER, COMMERCIAL_MANAGER | «گزارش عملکرد کارمندان»: EMPLOYEE-role users whose `dept` maps to the caller (finance→FINANCE_MANAGER, sales/commercial→COMMERCIAL_MANAGER) + their `AuditLog` action feed (action, category, detail, at), `staffId?` filter for the per-employee tabs. Also returns the «کارمند جدید توسط مدیر IT اضافه شد» banner rows — real `AuditLog(category=ACCOUNT)` employee-creation events for the caller's dept, not a fabricated notification. |

Deliberately not in scope (documented, not dropped): Excel/PDF exports
(mock toast only); the finance mock's orphaned income/expense chart; the
notification "mark as read" persistence (the design's dismiss is purely
client-side state — kept client-side).

---

## Phase 12 — مدیران و ادمین‌ها, امنیت و رمز عبور, تنظیمات سامانه, CEO logs, IT panels view

Grounded in the ADMINS LIST / ADMIN PERMISSIONS / SECURITY-PASSWORD / LOGS /
SETTINGS / PANELS ACCESS markup of the CEO, Board Chair, Senior and IT
panels. Key ⚑ decisions:

- **Per-admin permission toggles are NOT built** (the design's 10-key
  toggle matrix on the admin detail screen). Authorization in this system
  is enum-role-based and enforced server-side (`RolesGuard`); shipping a
  stored-but-unenforced toggle matrix would violate CLAUDE.md's «never by
  hiding UI alone» rule, and enforcing it means a full dynamic-authorization
  redesign. Open item, documented — the admin detail keeps the real
  actions: block/unblock login and password reset.
- **«نقش سفارشی…» in add-admin is NOT supported** — roles are a seeded
  enum; a free-text role would have no real authorization backing.
- **Management hierarchy (server-enforced):** CEO and BOARD_CHAIR manage
  {SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER, IT_MANAGER,
  SITE_ADMIN}; SENIOR_MANAGER manages the same set minus SENIOR_MANAGER.
  Nobody can block/reset CEO/BOARD_CHAIR accounts or block themselves.
- **«آنلاین» state is real** — derived from unexpired, unrevoked
  `RefreshToken` rows, not a fabricated presence flag.
- The chair settings' «قوانین استرداد» inputs write the REAL Phase 7
  `RefundPenaltyRule` brackets. The mock shows 2 inputs; the real engine
  has 4 brackets — all 4 are shown (⚑ documented deviation: editing only
  half the real engine would be misleading).
- CEO «لاگ و رویدادها» level chips are a presentational mapping over real
  `AuditLog` rows: SECURITY→هشدار, financial categories→موفق, else info.

### `backend/src/modules/admins/` (new) — CEO, BOARD_CHAIR, SENIOR_MANAGER

| Method | Path | Notes |
|---|---|---|
| GET | `/admins` | Manager/admin accounts in the caller's managed set (+ hierarchy above): fullName, username, email, roleLabelFa, lastLoginAt, isActive, online (real session derivation), managedByCaller flag. |
| POST | `/admins` | «افزودن مدیر / ادمین» `{ fullName, email, username, role (managed-set enum only), password (min 6), delivery: sms\|email }` — creates the staff `User` (argon2, `mustChangePassword`), audited; credentials delivery goes through the mocked provider path in dev. 409 on duplicate username/email. |
| PATCH | `/admins/:id/block` / `/unblock` | Toggles `User.isActive` — really enforced (staff login already rejects inactive accounts). Only within the caller's managed set; never self, never CEO/BOARD_CHAIR. Audited. |
| POST | `/admins/:id/reset-password` | `{ password?, delivery? }` — explicit password (min 6) or a generated temp password (returned exactly once); sets `mustChangePassword`; audited; managed-set only. |

### `backend/src/modules/auth/` (addition)

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/auth/change-password` | any authenticated staff | «تغییر رمز عبور من» `{ currentPassword, newPassword (min 6) }` — verifies the current password (argon2) before updating; 401 on mismatch; audited (SECURITY, no password material logged). |

### `backend/src/modules/audit/` (addition)

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/audit/system-events` | CEO | «لاگ‌ها و رویدادهای سامانه» — latest 100 real `AuditLog` rows (all actors incl. CEO itself, unlike `/audit/manager-reports`) with the presentational level mapping above. |

### `backend/src/modules/settings/` (new) — BOARD_CHAIR, IT_MANAGER

| Method | Path | Notes |
|---|---|---|
| GET | `/settings` | All `SystemSetting` key-values with server defaults (companyName, supportEmail, supportPhone, gateway toggles mellat/saman/zarin, global toggles maintenance/registration/charterSale/apiPublic/sandbox, brandColor) + the real `RefundPenaltyRule` brackets. |
| PATCH | `/settings` | Partial key-value update; validated per key; audited (SYSTEM). |
| PATCH | `/settings/refund-rules` | BOARD_CHAIR only — updates the REAL Phase 7 `RefundPenaltyRule.penaltyPct` per bracket (0–100 validated); audited. The refund engine keeps reading these same rows. |

### `backend/src/modules/panels/` (change)

`GET /panels/access` gains IT_MANAGER as a READ-ONLY role (its دسترسی به
پنل‌ها tab is informational per the design: «تعیین سطح دسترسی ورود در
اختیار مدیر عامل است»); `PATCH` stays CEO/SENIOR_MANAGER only.

Deferred (documented, not dropped): per-admin permission matrix (see ⚑
above); site-logo upload in IT settings (the logo is a public-site asset —
no public site exists in this track to render it); the chair panel's
orphaned PROFILE & SECURITY section (no nav entry reaches it — confirmed
orphan like prior phases' dead blocks).

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
- **Phase 7 — Refunds** (`backend/src/modules/refunds/`; FINANCE_MANAGER only — the executives' panels have no live refund surface, confirmed):
  - GET `/refunds` — request cards + the 3 KPI counts (در صف پرداخت / پرداخت‌شده / در انتظار بررسی ادمین).
  - GET `/refunds/:id` — detail for the modal: passenger/account panel (شبا decrypted for this surface only), flight panel, amounts panel with the penalty breakdown (درصد جریمهٔ کنسلی → مبلغ نهایی قابل پرداخت).
  - PATCH `/refunds/:id/refer` — `{ assigneeId }` (finance staff via /staff-directory) — sets assignee + history, status unchanged (per design), audited.
  - PATCH `/refunds/:id/pay` — «تأیید، واریز به شبا و بستن پرونده» — only from FINANCE (else 409); transactional ledger reversal + booking REFUNDED + audit (see DB_SCHEMA ⚑).
  - POST `/refunds/_test/request` — non-production E2E seed hook (creates a booking + FINANCE-status request), 404 in production.

## Phase 15 — step-up verification for high-risk operations

See DB_SCHEMA.md's Phase 15 for full reasoning. One new shared endpoint,
then five existing endpoints gain two required body fields.

- `POST /auth/step-up/request` (new, any authenticated staff/agency
  actor, `@Throttle` 5/min like OTP) — `{ scope }` where scope is one of
  `ADMIN_ROLE_CHANGE | API_KEY_ROTATE | REFUND_PAYOUT |
  PRICE_CAPACITY_CHANGE | SESSION_REVOKE`. Returns `{ challengeId }`; the
  code is delivered through the actor's existing 2FA channel.
- `POST /admins` (existing) — body gains `stepUpChallengeId`,
  `stepUpCode`; scope `ADMIN_ROLE_CHANGE`. 401 `TWO_FACTOR_INVALID`/
  `TWO_FACTOR_EXPIRED` if the challenge doesn't check out — same codes
  the login 2FA flow already uses.
- `POST /agencies/:id/api-key` (existing) — same two fields required;
  scope `API_KEY_ROTATE`.
- `PATCH /agencies/:id/api-key/:keyId` (existing) — same two fields
  required **only when `regenerate: true`**; a plain `status` toggle
  (suspend/activate an existing key) does not need step-up.
- `PATCH /refunds/:id/pay` (existing) — same two fields required; scope
  `REFUND_PAYOUT`.
- `PATCH /pricing/proposals/:id/register` (existing) — same two fields
  required; scope `PRICE_CAPACITY_CHANGE`.
- `PATCH /flights/:instanceId/aircraft` (existing, capacity-affecting)
  — same two fields required; scope `PRICE_CAPACITY_CHANGE` (shared with
  price registration — both are the "price/capacity change" item in the
  spec's §5.1, not two separate scopes).
- `POST /security/sessions/logout-all` (existing) — same two fields
  required; scope `SESSION_REVOKE`.

## Phase 16 — agency self-registration + real seat allotments

See DB_SCHEMA.md's Phase 16 for full reasoning (design source, why a new
phone-keyed OTP table instead of reusing `TwoFactorChallenge`, and what's
explicitly out of scope).

- `POST /agencies/requests/otp` (new, public, `@Throttle` 5/min per-IP +
  per-phone) — `{ phone }`. Upserts nothing; creates an `AgencyRequestOtp`
  row and sends the code via the existing `TwoFactorProvider`. Returns
  `{ challengeId }`.
- `POST /agencies/requests` (new, public, `@Throttle` 5/min) — `{
  applicantName, managerName, licenseNo, phone, challengeId, code }`.
  Verifies the OTP (same 401 `TWO_FACTOR_INVALID`/`TWO_FACTOR_EXPIRED`
  codes as every other OTP check in this codebase), then creates an
  `AgencyMembershipRequest(status: PENDING, email: null, city: null,
  documents: null)`.
- `GET /agencies/requests`, `GET /agencies/requests/:id` (existing) — role
  gate widened to also allow `SITE_ADMIN` (method-level override; every
  other `/agencies/*` route keeps the original `AGENCY_TAB_ROLES` gate).
- `PATCH /agencies/requests/:id/refer` (existing) — role gate widened to
  `SITE_ADMIN | SENIOR_MANAGER | COMMERCIAL_MANAGER`.
- `PATCH /agencies/requests/:id/approve` (existing) — role gate
  **narrowed** to `COMMERCIAL_MANAGER` only (was
  `SENIOR_MANAGER | FINANCE_MANAGER | COMMERCIAL_MANAGER`). On success now
  also sends a real SMS with the temp password (Phase 14's `SmsProvider`/
  `SmsLog`), matching `POST /admins`'s existing delivery pattern, instead
  of only returning it in the response body.
- `PATCH /agencies/requests/:id/reject` (existing) — role gate widened to
  add `SITE_ADMIN` alongside the existing gate.
- `GET /flights/:instanceId/allotments`, `POST
  /flights/:instanceId/allotments`, `DELETE
  /flights/:instanceId/allotments/:allotmentId` — **no change**; these
  already exist (Phase C) and are only gaining a frontend caller this
  phase (a new section in the existing flights panel, same
  `SENIOR_MANAGER`/`COMMERCIAL_MANAGER` gate — no new endpoint).
- `GET /agency-portal/allotments` (new, `AGENCY` role, tenant-scoped to
  `actor.agencyId` server-side) — replaces `AgencySeatsPage.tsx`'s
  hardcoded sample data with each allotment's flight info,
  `seatsAllocated`, and seats consumed so far (derived via `COUNT` over
  real bookings, never a stored counter).

## Phase 17 — customer profile fields + completeness notification

See DB_SCHEMA.md's Phase 17 for full reasoning and explicit scope cuts
(no KYC/selfie, bank cards, sessions, invite-friends, saved passengers).

- `GET /my/profile` (new, `USER` role — matches the existing `/my/wallet`,
  `/my/refunds`, `/my/club-points` customer self-service convention) —
  current values of `fullName`, `nationalId` (decrypted for the owner
  only), `birthDate`, `passportNo` (decrypted), `emailVerifiedAt`, plus a
  server-computed `completionPct`.
- `PATCH /my/profile` (new, `USER` role) — partial update of the same
  fields; national ID validated with the official checksum server-side
  (CLAUDE.md security rule), encrypted at rest immediately.
- `POST /my/profile/email/verify-request` (new, `USER` role, `@Throttle`
  5/min) — sends a short-lived code to the account's current `email` via
  the existing `TwoFactorProvider`. 400 if no email is set yet.
- `POST /my/profile/email/verify` (new, `USER` role) — `{ challengeId,
  code }`; on success stamps `emailVerifiedAt`.
- No change to any booking/checkout endpoint's validation — national ID
  stays optional there, exactly as today; the checkout banner is a
  frontend-only read of `GET /users/me/profile`'s `completionPct`.

## Phase 18 — SITE_ADMIN + EMPLOYEE panel access

See DB_SCHEMA.md's Phase 18 for full reasoning (which design-listed
SITE_ADMIN tabs stay deferred, why EMPLOYEE's nav is computed per-user
instead of a static `PANEL_NAV` row, and the exact catalog keys wired vs
deferred). No schema change — reuses the existing `EmployeePermission`/
`Permission` tables from Phase 8.

- `GET /panels/nav` — now `async`; for `role === 'EMPLOYEE'` the response
  is computed per-user from that employee's real `EmployeePermission`
  grants (`["dashboard", ...granted sections]`, matching پنل کارمند.dc.html's
  `navKeys` formula) instead of a static table row. Every other role is
  unchanged.
- New `@RequiresPermission(...keys)` decorator +
  `EmployeePermissionGuard` (`src/common/guards/employee-permission.guard.ts`)
  — passes straight through for any non-EMPLOYEE actor; for EMPLOYEE it
  403s unless the actor holds at least one of the decorated keys via
  `EmployeePermission`. Added to `@UseGuards(...)` alongside the existing
  `RolesGuard`/`PanelAccessGuard` on every controller touched below.
- `GET /agencies`, `GET /agencies/:id` — role gate widened to add
  `SITE_ADMIN` and `EMPLOYEE` (method-level, was previously class-default
  `AGENCY_TAB_ROLES` only for these two). EMPLOYEE additionally requires
  `ag_list` (list) / `ag_info` (detail).
- `GET /agencies/requests`, `GET /agencies/requests/:id` — also widened to
  `EMPLOYEE` + `RequiresPermission('ag_requests')` (SITE_ADMIN was already
  granted in Phase 16).
- `GET /passenger-reports/search` — role gate widened to add `SITE_ADMIN`
  and `EMPLOYEE` (+ `RequiresPermission('rp_sales', 'rp_finance')` — same
  "reports" tab for either catalog dept's report permission).
- `GET /club/members`, `POST /club/members/:id/issue-card` — role gate
  widened to add `SITE_ADMIN` only (method-level). `createMember`
  (CEO/BOARD_CHAIR), `updateLevel` (SENIOR_MANAGER), and the
  `card-requests` approve/reject flow stay untouched — SITE_ADMIN never
  gets member creation, tier changes, or the referred-card decision.
- Cartable (`GET/PATCH /cartable/*`) — `SITE_ADMIN` added directly to
  `CartableController`'s class-level `@Roles(...)` (not to the shared
  `EXEC_ROLES` constant, which also backs `manager-messages`/
  `staff-directory` — those stay untouched, out of SITE_ADMIN's design
  access list). Every cartable endpoint is already self-scoped to the
  actor, so this is a safe "act on my own items" grant.
- `GET /refunds`, `GET /refunds/:id`, `PATCH /refunds/:id/refer` — role
  gate widened to add `SITE_ADMIN` and `EMPLOYEE` (+
  `RequiresPermission('rf_list' | 'rf_details' | 'rf_process')`
  respectively). `PATCH /refunds/:id/pay` is **never** widened — stays
  `FINANCE_MANAGER`-only, matching the same "site admin/employee review +
  refer, one specialist role executes" pattern used for agency requests
  in Phase 16.
- `GET /pricing/proposals`, `PUT /pricing/flights/:flightInstanceId/proposal`
  — role gate widened to add `EMPLOYEE` (+ `RequiresPermission('pr_propose')`).
  No SITE_ADMIN grant — pricing isn't in its design access list.
  `legal-rate`/`register`/`ai-analysis` stay `CEO`-only.
- `GET /flights/overview`, `GET /flights/airports`, `GET /flights/schedules`,
  `GET /flights/:instanceId`, `GET /flights/:instanceId/fare-rules`,
  `GET /flights/:instanceId/allotments` — role gate widened to add
  `EMPLOYEE` (+ `RequiresPermission('fl_view')`). Every write endpoint on
  this controller (create/schedule/plan/aircraft/fare-rule/allotment
  mutations — the catalog's `fl_manage`) is **deliberately deferred**;
  granting broad flight-write access needs individual per-endpoint review
  this phase didn't have time for.

### Explicit deferrals (flagged, not oversights)
- `flightops`, `tickets`, `blog`, `media` — present in
  پنل ادمین سایت.dc.html's `roleDefs.siteAdmin.access` but have **no**
  backend anywhere in the codebase for any role; excluded from
  `PANEL_NAV.SITE_ADMIN` rather than shipped as dead tabs.
- EMPLOYEE's `referrals` tab — پنل کارمند.dc.html's `navKeys` formula
  always appends it, but `GET /referrals` (the only listing endpoint) is
  sender-scoped (`SENIOR_MANAGER`'s own referrals); there's no
  recipient-side "referrals assigned to me" listing yet, only per-item
  detail/report access. Left out of the computed nav until that listing
  exists.
- Catalog keys `fl_manage`, `ag_settle`, `fn_invoices`, and the entire IT
  dept (`us_manage`, `sv_control`, `sc_manage`, `lg_view`) are **not**
  wired to any controller this phase — an employee granted only these
  gets no matching nav tab (no dead tabs), even though the permission row
  itself exists and can be granted by IT_MANAGER today.
- SITE_ADMIN's dashboard is a new, narrower `SiteAdminDashboardPage` (pending
  agency requests + refunds awaiting review) rather than
  پنل ادمین سایت.dc.html's fuller multi-widget combined feed — both source
  lists are real (no mock data), just a simpler composition.

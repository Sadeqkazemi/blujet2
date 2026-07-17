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

## Later phases (endpoints TBD — documented here before each phase's code is written)

- **Phase 2** — none directly (reporting reads Phase-2 tables; no new endpoints of its own beyond what's above).
- **Phase 5 — VIP club** (`backend/src/modules/club/`; roles below are the 3 panels with the tab — CEO, BOARD_CHAIR, SENIOR_MANAGER):
  - GET `/club/members` — `level?`, `q?` (name/email/cardNo, plus exact nationalId via hash); returns members + the KPI counts (کل اعضا، کارت‌های صادرشده، درخواست در انتظار، توزیع سطوح). All 3 roles.
  - POST `/club/members` — «تعریف مشتری VIP جدید» — CEO+BOARD_CHAIR only (the form exists only in their panels); national-ID checksum validated, PII encrypted.
  - PATCH `/club/members/:id/level` — tier segmented control — SENIOR_MANAGER only, audited.
  - POST `/club/members/:id/issue-card` — «صدور کارت» direct issuance — all 3 roles; 409 if already issued; audited (⚑).
  - GET `/club/card-requests` — the panels' queue (server filters to REFERRED/APPROVED/REJECTED — SUBMITTED lives in the site-admin track); includes history timeline. All 3 roles.
  - PATCH `/club/card-requests/:id/approve` | `/reject` — «تأیید و صدور کارت» / «انصراف» — CEO/BOARD_CHAIR: any REFERRED; SENIOR_MANAGER: only `assignedTo=SENIOR` (⚑); transactional + audited; 409 on non-REFERRED.
- **Phase 6** — `/pricing/proposals`, `/pricing/proposals/:id/approve`.
- **Phase 7** — `/refunds`, `/refunds/:id/refer`, `/refunds/:id/pay`.
- **Phase 8** — `/employees`, `/employees/:id/permissions`, `/employees/:id/reset-password`, `/it/services`, `/it/external-services`.
- **Phase 9** — `/reservation/seats/:flightInstanceId`, `/reservation/seats/:id/lock`, `/reservation/seats/:id/release`, `/reservation/pnr/*`.

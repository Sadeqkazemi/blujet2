# Sandbox UAT — Multi-Role Flight Lifecycle (2026-08-05)

Acceptance checklist for the cross-role sandbox scenario requested
2026-08-05: COMMERCIAL_MANAGER defines routes/flights/pricing →
CEO approves → IT_MANAGER manages external services and staff →
CEO/BOARD_CHAIR lock seats manually → a passenger registers and buys
a ticket → an agency onboards and gets a seat commitment. This doc
records, per item, whether the platform already proves it (with the
test file that proves it) or whether it is a real gap requiring a
product decision before any code is written (per `CLAUDE.md`
Workflow Rules 1 and 4).

Source-audited 2026-08-05 against `main`-derived branch state; file/line
references may drift as the code evolves — re-verify before relying on
line numbers.

## 1. مدیر بازرگانی → مدیرعامل: مسیر پرواز و قیمت‌گذاری

- [x] COMMERCIAL_MANAGER creates city/airport catalog —
  `POST /flights/airports` (`backend/src/modules/flights/flights.controller.ts:404-421`)
- [x] Cities appear live in the public origin/destination search box —
  `GET /search/airports` (`backend/src/modules/booking-engine/search.controller.ts:21-24`,
  `search.service.ts:40-49`, Redis-cached, not static)
- [x] COMMERCIAL_MANAGER creates a flight for a route —
  `POST /flights` (`flights.controller.ts:434-448`)
- [x] COMMERCIAL_MANAGER submits a ticket price proposal —
  `PUT /pricing/flights/:id/proposal` (`backend/src/modules/pricing/pricing.controller.ts:53-70`)
- [x] CEO approves/registers the price (step-up MFA required; locked
  after registration) — `PATCH /pricing/proposals/:id/register`
  (`pricing.controller.ts:84-102`)
- [x] Registered price is the single source of truth through search →
  checkout → payment → e-ticket — `backend/src/modules/booking-engine/pricing.ts:47-53`
  reads `registeredPriceIrr`; no mock/static fallback found in that chain
- [x] Frontend: `frontend/src/features/flights/FlightCitiesTab.tsx`,
  `AddFlightPage.tsx`, `frontend/src/features/pricing/PricingPage.tsx`
  (dual view: propose-only for COMMERCIAL_MANAGER/EMPLOYEE, approve for CEO)
- **Status: fully implemented, nothing missing.** Proven by existing e2e
  suites under `backend/test/pricing*.e2e-spec.ts` and the flights module tests.

## 2. مدیر IT: سرویس‌های خارجی/داخلی + ساخت کارمند

- [x] External service API-key CRUD (encrypted at rest, AES-256-GCM) —
  `GET/PATCH /it/services*` (`backend/src/modules/it-manager/services.controller.ts`,
  `services.service.ts:91,127-132`)
- [x] Internal service on/off toggle —
  `PATCH /it/services/internal/:key` (`services.service.ts:48-77`)
- [x] Real connectivity test endpoint (no fabricated results) — `testExternal`
- [x] Department-scoped EMPLOYEE creation with a permission-catalog picker —
  `employees.service.ts` `create()` (line 132), `PERMISSION_CATALOG`
  (`permission-catalog.ts`)
- [x] Runtime permission enforcement — `EmployeePermissionGuard` +
  `@RequiresPermission`
- [x] Frontend: `frontend/src/features/it-manager/ServicesPage.tsx`,
  `EmployeesPage.tsx`
- **Caveat (not a gap in the requested scope, flagged for awareness):**
  only the SMS provider actually reads its IT-configured key at runtime
  (`kavenegar-sms.provider.ts:68-76`). The payment-gateway key UI exists
  but no real Zarinpal driver consumes it yet (sandbox gateway only). The
  AI provider key intentionally stays env-var-only per `CLAUDE.md` — that
  is correct behavior, not a bug.
- **Status: fully implemented for everything the sandbox scenario asked for.**

## 3. مدیرعامل/رئیس هیئت‌مدیره: قفل دستی صندلی

- [x] `canLock`/seat-lock roles = CEO, BOARD_CHAIR only; IT_MANAGER is
  view-only — `backend/src/modules/reservation/reservation-roles.ts`
  (`CAN_SEAT_LOCK_ROLES`). This resolves the open item that
  `docs/DB_SCHEMA.md` §Phase 9 had flagged (`role === 'super'` mapping) —
  resolved 2026-07-17, not still open.
- [x] Lock / approve / reject / release endpoints, `@Roles(...CAN_SEAT_LOCK_ROLES)` —
  `backend/src/modules/reservation/seatmap.controller.ts:40-83`
- [x] `SeatLock` is a distinct entity from `Booking`/`Passenger`, one
  active lock per seat enforced by a partial unique index —
  `backend/src/database/entities/seat-lock.entity.ts`
- [x] Locked seats show as unavailable on the **public** seat map used
  during checkout, not just the internal panel —
  `search.service.ts` `takenSeatCodes()` (lines 389-421) unions sold +
  locked seats into one `taken` set
- [x] Internal panel lock UI — `ReservationPage.tsx:1096`,
  `FlightSeatMapModal.tsx`
- **Status: fully implemented, nothing missing.** Proven by
  `backend/test/phase13-managerial-lock-governance.e2e-spec.ts` (7 cases).

## 4. مسافر: ثبت‌نام تا پرداخت + نمایش اطلاعات + هشدار مدارک ناقص

- [x] Registration via phone + SMS OTP — `auth.controller.ts`
  `POST /auth/otp/request` + `/verify`
- [x] Search → seat selection → checkout → payment → e-ticket, full path —
  `booking-engine` module + `frontend/src/features/public-site/*`
- [x] Passenger info visible in SITE_ADMIN panel —
  `GET /customers`, `GET /customers/:id`
  (`backend/src/modules/customers/customers.controller.ts:13`, `@Roles('SITE_ADMIN')`)
- [x] Incomplete-profile warning shown to the passenger in their **own**
  panel — `AccountIdentityTab.tsx:29-30` («احراز هویت شما هنوز کامل
  نشده است»), weighted completion bar in `AccountProfileTab.tsx`
- [ ] **GAP:** the incomplete-profile flag is **only** surfaced in the
  SITE_ADMIN panel (`customers.controller.ts` is `@Roles('SITE_ADMIN')`
  with no other consumer) — not "هر پنلی که نیازه" as requested. No other
  manager panel currently reads it.
- [ ] **GAP:** "ناقص" is defined two different ways in two places —
  SITE_ADMIN's `isIncomplete()` checks only `fullName` + `nationalIdEnc`
  (`customers.service.ts:22-25`); the user's own profile bar additionally
  weighs `birthDate`, `passportNo`, `emailVerifiedAt`
  (`docs/DB_SCHEMA.md:1219-1222`). These should be the same rule if the
  badge is meant to mean one thing platform-wide.
- **Open decision (asked, not yet answered):** which panels beyond
  SITE_ADMIN need this badge, and should the two definitions be unified
  into one server-computed flag?
- **Status: registration→payment path fully implemented; the
  incomplete-docs visibility/consistency piece of the request is a real,
  scoped gap.**

## 5. آژانس: ثبت‌نام → درخواست وب‌سرویس → تایید → دسترسی پنل → مجوز فروش مسیر → قفل واقعی صندلی تعهدی

- [x] Public self-registration — `AgencyMembershipRequest` entity,
  `agency-requests-public.controller.ts` (Phase 16)
- [x] SITE_ADMIN triage/referral of a request —
  `PATCH /agencies/requests/:id/refer` (`agencies.controller.ts:121-122`,
  roles `SITE_ADMIN|SENIOR_MANAGER|COMMERCIAL_MANAGER`) — referral target
  is any arbitrary user today, not specifically "route to both
  COMMERCIAL_MANAGER and FINANCE_MANAGER"
- [~] **Approval is single-approver, not dual sign-off as requested** —
  `PATCH /agencies/requests/:id/approve` is `@Roles('COMMERCIAL_MANAGER')`
  only (`agencies.controller.ts:95-96`); FINANCE_MANAGER has no role in
  this approval at all. `PLAN.md` Phase 16 (lines 103-109) documents this
  as the deliberate original design, not an unfinished dual-approval flow.
- [x] Portal access + login granted on approval —
  `agencies.service.ts:794-880` (creates `AgencyProfile`/`User(role=AGENCY)`)
- [x] Partner API/webservice request + real API-key issuance on approval —
  `AgencyWebserviceRequest`, `AgencyWebservicePage.tsx`,
  `decideWebserviceRequest` (`agencies.service.ts:1381`) — approvable by
  any one of `SENIOR_MANAGER|FINANCE_MANAGER|COMMERCIAL_MANAGER`
  (inherited controller default, no dual sign-off, SITE_ADMIN cannot decide it)
- [x] Aggregate per-flight agency seat carve-out **is** enforced for
  real — `FlightInstance.agencySeatsAllocated` blocks public/staff
  bookings from exceeding `capacity - charterSeats - agencySeatsAllocated`
  (`booking-engine/booking.service.ts:320-331`, `reservation/pnr.service.ts:479-494`)
- [ ] **GAP (the core of the request): per-agency seat commitment is not
  enforced.** `AgencyAllotment` (`backend/src/database/entities/agency-allotment.entity.ts`)
  is a real per-flight-instance, per-agency row (SOFT/HARD, capped),
  created via `flights.service.ts:1237 createAllotment` — but no
  `Booking` has an `allotmentId` FK, and no real booking path sets
  `channel: AGENCY` / `agencyId` outside `seed.ts:458`. Code comment in
  `agency-portal.service.ts:445-447` confirms: *"'book against own
  allotment' isn't built yet — consumed is derived from this agency's
  real bookings."* Today an agency cannot actually book a flight through
  a real path, so "the promised seat count is actually locked in the
  reservation system" is bookkeeping only, not real inventory.
- **Open decisions (asked, not yet answered):**
  1. Keep the current single-approver (COMMERCIAL_MANAGER) design, or
     implement the requested dual COMMERCIAL_MANAGER + FINANCE_MANAGER
     sign-off with SITE_ADMIN as router?
  2. Build real per-agency seat locking (link `AgencyAllotment` to actual
     bookings, and give agencies a real booking path) as a new phase —
     `docs/API.md` + `docs/DB_SCHEMA.md` first, per Workflow Rule 1?
- **Status: registration, triage, portal access, and webservice/API-key
  issuance work; the seat-commitment enforcement and dual-approval parts
  of the request are real, unbuilt features.**

## Summary

| # | Flow | Status |
|---|------|--------|
| 1 | Commercial manager route/flight/pricing → CEO approval | Fully implemented |
| 2 | IT manager services + employee creation | Fully implemented |
| 3 | CEO/Board Chair manual seat lock | Fully implemented |
| 4 | Passenger registration → payment + document warning | Core flow implemented; visibility/consistency gap in the incomplete-docs warning |
| 5 | Agency onboarding + per-agency seat commitment | Registration/portal/API-key flow implemented; dual-approval and real seat-commitment enforcement are unbuilt |

## Next steps

Flows 1-3 need no new code — they should be exercised as manual/e2e
sandbox tests against the existing implementation to confirm they behave
as this doc claims. Flows 4 and 5 each have an open product decision
(see above) that must be resolved, then documented in `docs/API.md` /
`docs/DB_SCHEMA.md`, before any implementation code is written, per
`CLAUDE.md` Workflow Rules 1 and 4.

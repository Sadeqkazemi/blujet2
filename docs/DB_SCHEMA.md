# DB_SCHEMA.md — blujet data model

Source of truth: `backend/prisma/schema.prisma` (generated from this doc once
approved). This file groups entities by the phase that introduces them, per
`CLAUDE.md`'s workflow rule ("one feature = backend endpoint + tests +
frontend page, fully working, before starting the next feature").

Entities were reverse-engineered from the six executive panel design files
in `design-reference/` (پنل مدیر عامل, پنل رئیس هیئت مدیره, پنل مدیر ارشد,
پنل مدیر بازرگانی, پنل مدیر مالی, پنل مدیر IT) plus the shared
`ReservationSystem.dc.html` component and `site-data.js` mock store. Where a
design mock did something CLAUDE.md explicitly forbids (plaintext passwords,
a mutable balance column, floats for money, client-computed aggregates),
the schema below follows CLAUDE.md, not the mock — those spots are called
out inline.

All money columns are `Int` (IRR, no decimals) per the Financial Rules.
All `Jalali`-displayed dates are stored as UTC `DateTime`; Jalali conversion
happens at the frontend edge only (`frontend/src/lib/jalali.ts`).

---

## Phase 1 — Auth, RBAC, panel shell, dashboard/reporting core

### Role (enum)
```
USER | AGENCY | EMPLOYEE | IT_MANAGER | COMMERCIAL_MANAGER | FINANCE_MANAGER
| SENIOR_MANAGER | CEO | BOARD_CHAIR | SITE_ADMIN
```
Fixed by `CLAUDE.md`. `EMPLOYEE` covers all department staff (commercial/
finance/IT/sales); their fine-grained capabilities come from `Permission`
(Phase 6), not sub-roles.

### User
One table for every human in the system — customers, agency users, staff,
and the six manager roles. Two disjoint auth surfaces are enforced at the
service layer, not by separate tables (simpler migration path, one place to
enforce "a user has exactly one identity"):

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| role | Role | |
| phone | string? unique | customers/agencies — E.164, OTP login |
| username | string? unique | staff/managers — password + mandatory 2FA login |
| passwordHash | string? | argon2; **null for OTP-only customers** |
| email | string? unique | optional for customers, org email for staff |
| fullName | string | |
| twoFactorEnabled | bool | forced `true` for all roles except USER/AGENCY |
| twoFactorSecret | string? | encrypted at rest |
| isActive | bool default true | suspend/activate (اسکناس تعلیق حساب) toggles this |
| deletedAt | DateTime? | soft delete (GDPR hard-delete flow is separate) |
| createdAt / updatedAt | DateTime | |

Constraint: exactly one of `phone`/`username` is non-null depending on role
(`USER`/`AGENCY` → phone; everything else → username). Enforced in the
`auth` module's DTOs, not at the DB level (Prisma can't express XOR
constraints cleanly).

**Design-mock deviation**: the employee-panel login (`SiteData.authStaff`)
compares plaintext passwords and has no 2FA step. The real `passwordHash`
is argon2, and every staff/manager role requires a 2FA challenge on login
(`TwoFactorChallenge` below) — the mock's shortcut is not carried over.

### RefreshToken
`{ id, userId→User, tokenHash, userAgent, ip, expiresAt, revokedAt? }` —
revocable sessions per CLAUDE.md security rules. Access tokens are stateless
JWTs; only refresh tokens are persisted.

### TwoFactorChallenge
`{ id, userId→User, codeHash, purpose: STAFF_LOGIN_2FA, expiresAt,
consumedAt?, attempts }` — 6-digit, 2-minute TTL, single-use, hashed at
rest (shared shape with the customer OTP table introduced when the public
auth feature is built by the other track; kept separate here so this
track's migration doesn't collide with theirs).

### Permission (seed data, not a table with FKs to every row — see Phase 6)
Referenced here because `User.permissions String[]` (Employee only) stores
keys from this catalog; the catalog itself lands as a Phase 6 seed/enum,
not a Phase 1 migration.

### AuditLog
Backs both the security "audit log for every admin action" requirement and
the six panels' "گزارش مدیران" (manager oversight feed) / "لاگ و رویدادها"
(IT event log) UIs — those are just filtered views over this one table.

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| actorId | uuid → User | |
| actorRole | Role | denormalized for fast filtering |
| category | AuditCategory enum | `AGENCY, PRICING, FINANCE, REFUND, STRATEGY, SYSTEM, CLUB, ACCOUNT, ACCESS, SECURITY, RESERVATION` |
| action | string | short label, e.g. "تأیید و صدور کارت" |
| detail | string | Persian sentence, e.g. design's `detail` field |
| entityType / entityId | string? | polymorphic pointer to the affected row |
| metadata | Json? | before/after snapshot for the financial log trail |
| requestId | string? | correlates to the request-id log line |
| createdAt | DateTime | |

Query patterns confirmed across all 6 panels:
- CEO's "گزارش مدیران" excludes `actorRole IN (SUPER/BOARD_CHAIR, SENIOR_MANAGER, CEO)` — CEO oversees operational managers only.
- Board Chair's and Senior Manager's "گزارش مدیران" show everyone (read-only for Board Chair — it never appears as `actorRole` writer in any panel).
- IT's "لاگ و رویدادها" filters `category = SYSTEM` plus account-management entries.

### Panel access flags (feature, not a new table)
"دسترسی به پنل‌ها" (seen in CEO/Senior Manager/IT panels — each toggles a
different subset of sibling panels) is a small keyed bool set, modeled as
`PanelAccessFlag { panelKey, enabled, updatedBy→User, updatedAt }` — one
row per panel key (`SITE_ADMIN, FINANCE, COMMERCIAL, IT, CEO`), not
per-role, matching the design (toggling blocks the panel for everyone with
that role, it's not a per-user grant).

---

## Phase 2 — Flight/booking core (minimal slice needed to power dashboards)

The full booking engine (search, seat selection, checkout, payment,
e-ticketing) is the public-site track's responsibility per `CLAUDE.md`'s
repo layout — these tables are the **minimal subset the manager panels
read from** to compute real sales charts/KPIs instead of mock numbers.
Field names/relations are kept compatible with the full IATA-NDC-aligned
model `CLAUDE.md` specifies (`Route → Flight → Schedule → FlightInstance →
Inventory → FareRule`) so a later merge with the public-site track's
migrations doesn't require renaming.

- `Route { id, originCode, destCode }`
- `Flight { id, flightNo, routeId→Route, aircraftType }`
- `FlightInstance { id, flightId→Flight, departureAt(UTC), arrivalAt(UTC), capacity, charterSeats, status: SCHEDULED|DEPARTED|CANCELLED }`
- `Booking { id, pnr unique, flightInstanceId→FlightInstance, channel: DIRECT|AGENCY|VIP|MANAGERIAL, agencyId→User?, status: DRAFT|HELD|PAID|TICKETED|CANCELLED|EXPIRED|REFUNDED, priceIrr Int, createdAt }` — full state machine per CLAUDE.md; Phase 1 dashboards only read `PAID`/`TICKETED` rows.
- `Passenger { id, bookingId→Booking, fullName, nationalId(encrypted), mobile(encrypted) }`
- `LedgerEntry { id, bookingId→Booking?, agencyId→AgencyProfile?, type: SALE|REFUND|SETTLEMENT|COMMISSION, signedAmountIrr Int, occurredAt, createdBy→User? }` — double-entry, immutable, append-only; refunds/settlements are new rows, never edits. `agencyId` (added in Phase 3) is set on agency-channel `SALE` rows (mirroring `booking.agencyId`) and on every `SETTLEMENT` row, since a settlement (invoice payment or a direct "ثبت تسویه") isn't necessarily tied to one `Booking` — this lets `AgencyCreditLine.usedIrr` derive from a single `agencyId` filter instead of a join through `Booking` that `SETTLEMENT` rows wouldn't have anyway.

Sales-chart/KPI endpoints (`GET /reporting/sales`, etc., Phase 1 API) query
`LedgerEntry` grouped by `Booking.channel` and period — never a client-side
sum, per CLAUDE.md.

---

## Phase 3 — Agencies (credit, settlement, membership)

Grounded in the confirmed آژانس‌ها tab across all three roles that have it
(Senior Manager, Finance Manager, Commercial Manager) — the three views
share the same data but differ in which actions each role's UI exposes
(reconciled in the API section below, not by three separate schemas).

- `AgencyProfile { userId→User (role=AGENCY) pk, licenseNo, managerName, phone, email, city, address, tier: NORMAL|SILVER|GOLD (نقره‌ای/طلایی — matches the design's segmented control, not an invented scale), suspendedAt?, suspendReason?, joinedAt }`
- `AgencyCreditLine { agencyId→AgencyProfile pk, limitIrr, updatedById→User, updatedAt }` — **only the limit is stored**; "مصرف‌شده" (used) is never a mutable balance column per `CLAUDE.md`'s financial rules. It's derived at query time as `SUM(LedgerEntry.signedAmountIrr WHERE agencyId=X, type=SALE) − SUM(LedgerEntry.signedAmountIrr WHERE agencyId=X, type=SETTLEMENT)` (see `LedgerEntry.agencyId` above) — i.e. every `AgencyInvoice` marked `PAID` (or a direct "ثبت تسویه") writes a `SETTLEMENT` ledger row that reduces this figure; `LedgerEntry` stays the single source of truth, invoices are the paper trail on top of it. A design-mock deviation flagged by the extraction agents: the mocks store `used` as a plain mutable field — the real schema doesn't.
- **Agency activity score** (Commercial/Finance panel's "امتیاز فعالیت آژانس", gold/silver/bronze badge) — computed, not stored: `seatsSold*10 + paidInvoices*100 − unpaidInvoices*60 + (isActive ? 40 : 0)`, clamped ≥0; ≥700 گلد/gold, ≥400 نقره‌ای/silver, else برنز/bronze. Matches the design's exact formula (extraction confirmed it verbatim) — kept as-is rather than redesigned, since it's presentational scoring, not a financial figure.
- `AgencyMembershipRequest { id, applicantName, managerName, licenseNo, city, phone, email, documents Json (uploaded file refs), status: PENDING|REFERRED|APPROVED|REJECTED, referredToId→User?, reviewNote?, reviewedById→User?, reviewedAt?, createdAt }` — `REFERRED` covers the "ارجاع درخواست" flow (Commercial/Senior Manager forwarding to a named staffer/manager) found only in those two panels' request-detail screens.
- `AgencyApiKey { id, agencyId→AgencyProfile, keyHash, scope: FULL|SEARCH_BOOK|SEARCH_ONLY, status: ACTIVE|SUSPENDED, activatedAt, expiresAt?, lastUsedAt?, callCount Int }` — issuance/regeneration/suspend confirmed **only** in the Senior Manager panel's agency detail; other roles don't see this section.
- `AgencyInvoice { id, agencyId→AgencyProfile, invoiceNo unique, issuedById→User, issuedAt, dueAt, amountIrr, status: UNPAID|PAID|OVERDUE, paidAt? }` — "فاکتورهای صادرشده" / "صدور فاکتور", confirmed only in the Commercial Manager panel's agency detail → مالی sub-tab. Marking `PAID` creates a `LedgerEntry(type=SETTLEMENT)` row — never a bare status flip (the design mock's `updateInvoice`-style call alone isn't sufficient, same class of gap flagged for refunds in Phase 7).
- `AgencyMessage { id, agencyId→AgencyProfile, senderId→User, senderIsAgency Bool, body, createdAt }` — "مکاتبه‌ها" chat thread, confirmed only in the Commercial Manager panel's agency detail.

## Phase 4 — Cartable, referrals, manager messaging

Grounded in a full extraction of the کارتابل tab (all 5 exec panels — CEO,
Board Chair, Senior, Finance, Commercial), the ارجاعات tab (Senior Manager
only) and the «ایجاد پیام» compose modal (all 5 panels). **Critical design
finding:** in the mocks all three are demo-only — cartable items are static
seeds, compose is send-only with no inbox anywhere, referral reports are
pre-seeded with no recipient-side submission UI, and «انتقال» (transfer)
never reaches the target's cartable. The schema below defines the real
persistence and routing the mocks imply but don't implement. The wiring
decisions (marked ⚑) are product decisions surfaced for approval, not
silently invented.

- `CartableTask { id, assigneeId→User, category: ADMIN|AGENCY|MANAGER, title, description, senderId→User?, senderLabelFa? (display fallback when no User row backs the sender), sourceType?: MANAGER_MESSAGE|MANAGER_REFERRAL|AGENCY_REQUEST|CHAIR_PERMISSION, sourceId?, status: OPEN|APPROVED|REJECTED|TRANSFERRED, resolutionNote?, transferredToId→User?, resolvedAt?, createdAt }`
  - The design's review modal offers exactly three actions — تأیید /
    انصراف(=رد) / انتقال — with a **required** «نظر مدیر» note; there is no
    generic "done" state and no due-date on cartable rows (both confirmed
    absent from all 5 panels).
  - ⚑ Transfer creates a NEW `OPEN` task for the target (same source link)
    and marks the original `TRANSFERRED` — the mocks toast and drop the item;
    the real system routes it. Every resolution writes an
    `AuditLog(category=SYSTEM or AGENCY per source)` row.
  - ⚑ Cartable rows are never authored directly: they are materialized by
    real flows (a manager message, a referral, an agency-request referral
    from Phase 3, a chair-permission request). The static `taskDefs` demo
    seeds are reproduced only in `seed.ts`.
- `ManagerReferral { id, fromId→User (SENIOR_MANAGER only, per design), title, body, priority: HIGH|MEDIUM|LOW, dueAt? (DateTime — the mock's free-text «مثلاً: ۲۵ تیر» becomes a real Jalali date picker/parse), status: SENT|REVIEWING|REPORTED|CLOSED, attachments Json (StoredFile ids), createdAt }`
- `ManagerReferralRecipient { referralId→ManagerReferral, recipientId→User }` — the design's multi-select chips (مدیر مالی، مدیر بازرگانی، ادمین سایت، سرپرست پشتیبانی، مدیر فنی) map to real staff users; ⚑ each recipient also gets a `CartableTask(category=MANAGER, «درخواست مدیر»)`, which is how the recipient — who has NO referrals tab in the design — receives it.
- `ManagerReferralReport { id, referralId→ManagerReferral, fromId→User, body, attachments Json, createdAt }` — ⚑ recipient-side report submission has no UI in the mocks (reports are pre-seeded); the API defines it and the recipient's cartable review of the referral task doubles as the submission surface. First report flips referral status to `REPORTED`; sender actions per design: «تأیید دریافت گزارش و بستن» → CLOSED, «درخواست اصلاح گزارش» → REVIEWING, «ارسال یادآوری دریافت گزارش» → REVIEWING (+ notification).
- `ManagerMessage { id, fromId→User, toDept: FINANCE|COMMERCIAL|SUPPORT|AGENCIES|CEO|ALL_MANAGERS, subject, body, attachments Json, createdAt }` — the «ایجاد پیام» compose (identical in all 5 panels). ⚑ Since the design has no inbox, delivery materializes as `CartableTask(category=ADMIN, sourceType=MANAGER_MESSAGE)` for the mapped recipient(s): FINANCE→FINANCE_MANAGER, COMMERCIAL→COMMERCIAL_MANAGER, CEO→CEO, ALL_MANAGERS→all 5 exec roles. SUPPORT/AGENCIES have no backing staff role yet — accepted by the enum but flagged undeliverable until Phase 8's employee/department model lands (open item).
- `ChairReportPermission { id, requesterId→User (FINANCE_MANAGER|COMMERCIAL_MANAGER), status: PENDING|APPROVED|REJECTED, decidedById→User?, decidedAt?, createdAt }` — the gate banner shown only in Finance/Commercial cartables («ارسال گزارش به رئیس هیئت مدیره نیازمند مجوز ایشان است»). ⚑ The request creates a `CartableTask` for BOARD_CHAIR (the mock has no chair-side approval UI); chair's cartable تأیید/رد decides it.
- `StoredFile { id, ownerId→User, fileName, mimeType, sizeBytes, path, createdAt }` — minimal upload backing for the referral/message «بارگذاری مستندات (PDF یا تصویر)» chips; PDF/image only, size-capped, local disk in dev behind an interface. Reused later by club-card docs (Phase 5) and refunds (Phase 7).

Out of scope, confirmed dead/unreachable in the design (not built):
- Senior Manager's «اولویت‌های راهبردی» directive list — not reachable from
  the confirmed sidebar (orphaned tab), purely in-memory, never delivered.
- A standalone received-messages inbox — the cartable IS the inbox
  (decision ⚑ above).

## Phase 5 — VIP club (loyalty tie-in for manager panels)

Grounded in a full extraction of the club tab (CEO + Board Chair share a
byte-identical rich layout; Senior Manager has a simpler two-card layout)
and `site-data.js`'s `clubMembers`/`cardRequests` shapes. The full loyalty
ledger (points earn/burn, cashback) belongs to the customer-club feature
on the public-site track — this slice is the manager-panel view over it,
kept forward-compatible the same way Phase 2's `Booking` was.

- `ClubTier` enum: `SILVER|GOLD|PLATINUM` (نقره‌ای/طلایی/پلاتین — verbatim design tiers with point bands 0–5k/5k–15k/15k+; `CARD_THRESHOLD=5000` for card eligibility).
- `ClubMember { id, userId→User? (nullable link to the customer account once the public track exists), fullName, email, birthDate?, nationalIdEnc, nationalIdHash (deterministic hash for exact-match search — the design's search box matches nationalId, and the encrypted column can't be LIKE-searched), joinDate, points Int (read-model copy; authoritative points ledger lives in the public track), level ClubTier, cardStatus: NONE|REVIEW|ISSUED, cardNo?, issuedByLabelFa?, createdAt }`
  - PII rules apply even though the mocks store plaintext: national ID checksum-validated server-side, encrypted at rest, masked in logs.
  - The mocks' `cardBlocked`, `used`, `transactions[]` fields are never surfaced in any of the three executive panels — orphaned, not built.
- `ClubCardRequest { id, memberId→ClubMember, level ClubTier, points Int (snapshot at request time), status: SUBMITTED|REFERRED|APPROVED|REJECTED, assignedTo: SENIOR|CHAIR? (design's 'senior'/'super'; never CEO — the site-admin referral form only offers those two), decidedById→User?, decidedAt?, cardNo?, history Json[] of {step,labelFa,at}, createdAt }`
- ⚑ **Approval authority (replicated from the design, server-enforced + audited):** CEO and BOARD_CHAIR may approve/reject ANY `REFERRED` request regardless of `assignedTo` (the design gives them both an explicit override); SENIOR_MANAGER may only act on `assignedTo=SENIOR`, and sees `assignedTo=CHAIR` rows read-only with the design's «ارجاع‌شده به رئیس هیئت مدیره — در انتظار تأیید» note.
- Approval is transactional: request → APPROVED + `cardNo` generated (`SILV|GOLD|PLAT-####`), member → `cardStatus=ISSUED` + `issuedByLabelFa='<نقش> (تأیید درخواست)'`, a history row appended, and an `AuditLog(category=CLUB)` written. Reject sets member back to `cardStatus=NONE`. Acting on a non-REFERRED request → 409.
- ⚑ **Direct issuance** («صدور کارت» on a member row, all 3 panels): sets the card immediately with `issuedByLabelFa='<نقش> (صدور مستقیم)'`, creates no request record (per design) but DOES write an `AuditLog(category=CLUB)` row — the mocks' silent path gets a real audit trail.
- ⚑ **Tier changes** (Senior Manager's segmented control): `PATCH level`, Senior-only per design, audited — the mocks mutate with no confirmation or trail.
- Open item: `SUBMITTED→REFERRED` (admin-site referral) and passenger self-request belong to the site-admin/public tracks — until those land, requests in those states come from seed data only; no stub endpoints are built.

## Phase 6 — Pricing proposals & ticket approval

Grounded in extraction of the CEO «تعیین قیمت بلیط» tab and the Commercial
Manager's pricing section (inside its flights tab — Commercial has no
dedicated pricing tab). Confirmed 3-step flow, verbatim from the CEO
banner: «۱ پیشنهاد مدیر بازرگانی → ۲ تحلیل هوش مصنوعی → ۳ تأیید و ثبت
مدیر عامل».

- `FarePricingProposal { id, flightInstanceId→FlightInstance @unique (one live proposal per flight — ⚑ fixes the mocks' broken id scheme where the two panels wrote the same array under incompatible `PP-####` vs `PP-{flightNo}` keys and seeded proposals never matched any flight row), basePriceIrr, competitorPriceIrr, proposedPriceIrr, legalRateIrr?, note?, proposedById→User, status: PENDING|REGISTERED, registeredPriceIrr?, approvedById→User?, approvedAt?, aiSuggestion Json? of { priceIrr, reason, factors[], season, occasion, confidence, modelVersion, generatedAt }, createdAt, updatedAt }`
- ⚑ **AI suggestion is persisted on the proposal** (with the model version, per the ML-service traceability rule) — in the mocks it lives in component state and evaporates on reload, hiding the «ثبت با AI» button. Advisory-only stands: generation never mutates prices; registration is always an explicit CEO click.
- **Registration** («تأیید بازرگانی» / «ثبت با AI»): CEO picks one of the two computed values — the design has no free-price input at approval. Transitions PENDING→REGISTERED with `registeredPriceIrr`, audited (`category=PRICING`). A REGISTERED proposal is locked forever («پس از تأیید مدیر عامل، قیمت ثبت و قفل می‌شود و قابل تغییر نخواهد بود») — re-edits → 409.
- **Legal rate** (نرخ قانونی/مصوب سازمان هواپیمایی): Commercial sends it with the proposal AND the CEO can set/override it independently (both paths exist in the design; last write wins, both audited).
- Money: the mocks' numbers are toman — stored as IRR integers as everywhere; toman conversion only in the shared utils. Ticket-price magnitudes fit the current Int32 columns.
- ⚑ **ML service goes real this phase** (first ml-service implementation): FastAPI `POST /internal/v1/price-suggestion` per CLAUDE.md's ML rules — pydantic schemas, shared-token internal auth, structured logs with X-Request-Id, `GET /health`, versioned heuristic model (season/occasion/competitor factors mirroring the design's fallback logic), pytest. NestJS side: an `AiProvider`-style client in `backend/src/modules/ai/` with a 2s timeout and graceful fallback — if the service is down, pricing approval flows keep working, only the suggestion is unavailable. No PII is ever sent (route codes, dates, prices, capacity only).
- Out of scope (other phases): the Commercial add-flight flow and plan-modal AI hint (Phase 10 flight management); the design's client-side `window.claude.complete` path is replaced entirely by the backend ML call (frontend never talks to AI vendors, per CLAUDE.md).

## Phase 7 — Refunds

Grounded in extraction of the Finance Manager's استرداد بلیط tab (the
primary payout surface), the customer/site-admin submission flow (their
tracks, not built here), and `site-data.js`'s `refunds` shapes. Lifecycle:
مشتری ثبت → ادمین سایت ارجاع → مدیر مالی پرداخت, tracked as
`SUBMITTED → REVIEW → FINANCE → PAID`.

- `RefundRequest { id, bookingId→Booking, passengerName, nidEnc?/mobileEnc? (PII encrypted like everywhere else — the mocks store plaintext), ibanEnc (24-digit شبا, encrypted at rest, returned only to the finance surface), totalPaidIrr, penaltyPct, penaltyAmountIrr, refundableIrr, status: SUBMITTED|REVIEW|FINANCE|PAID, assigneeId→User? (finance staffer — the design's refer sets assignee WITHOUT advancing status; payment still happens from the finance manager's view), processedById→User?, paidAt?, history Json[] of {step, labelFa, at}, createdAt }` — real FK to Booking (⚑ fixes the mocks' `RF-{length+1044}` id-collision scheme).
- `RefundPenaltyRule { id, minHoursBeforeDeparture, penaltyPct, labelFa }` — ⚑ the mocks contain THREE inconsistent penalty schemes (customer engine: 30/50/70/100 by hours-to-departure; a dead two-bracket 30/80 settings editor; seeds hardcoding ٪۳۰). The customer panel's 4-bracket engine is the only actually-executed rule, so it becomes the seeded, server-side source of truth: ≥72h→30٪, 24–72h→50٪, 3–24h→70٪, <3h→100٪ (غیرقابل استرداد). Penalty is computed server-side at request creation; the static settings editor is dead UI and is not built.
- ⚑ **Real financial effect on pay** (the mocks only flip a status field): `PATCH pay` runs in one transaction — `LedgerEntry(type=REFUND, signedAmountIrr = −refundableIrr, bookingId, createdBy)`, `Booking.status → REFUNDED`, request → `PAID` + `processedById/paidAt` + history row, `AuditLog(category=REFUND)`. Double-pay guarded (409). The actual bank transfer to the شبا stays out-of-band until the PaymentGateway lands on the public track — the ledger row is the system of record.
- No reject action exists anywhere in the finance design — none is built (status enum stays minimal; a site-admin-side rejection belongs to that track).
- `REVIEW` is unreachable via any mock action (admin refer jumps straight to FINANCE) — kept in the enum for the site-admin track's future use; this track never sets it.
- Submission/site-admin referral belong to the customer/site-admin tracks — until they land, requests come from seed + the established non-production `_test` hook pattern for E2E.

## Phase 8 — Employee management (IT Manager)

- `Employee` is `User(role=EMPLOYEE)` + `{ dept: COMMERCIAL|FINANCE|IT|SALES|string(custom), rank, createdById→User }`.
- `Permission { id, dept, sectionKey, key, labelFa }` — seeded catalog (commercial/finance/IT sections found in `site-data.js`'s `PERM_CATALOG`).
- `EmployeePermission { employeeId→User, permissionId→Permission }` join table (replaces the mock's plain `permissions: string[]` with a real FK-checked grant).
- `InternalService { id, key, nameFa, enabled, uptimePct }`, `ExternalServiceConfig { id, key, nameFa, endpoint, timeoutMs, apiKeyEncrypted, sandbox, enabled }` — service on/off toggles + external API config.
- `PasswordResetEvent { id, employeeId→User, resetById→User, createdAt }` — audit-only; the actual new password is never stored/displayed after the one-time generation screen.

## Phase 9 — Reservation system (seat lock / PNR)

Shared `ReservationSystem` component contract, confirmed from
`ReservationSystem.dc.html`: only `BOARD_CHAIR` may lock/release seats or
create managerial reservations (`canLock`); `SENIOR_MANAGER` gets view-only
access to the same seat map. This governs authorization on:
- `SeatLock { id, flightInstanceId→FlightInstance, seatCode, lockedById→User, passengerName?, passengerNationalId?, releasedAt? }`

PNR issuance/change/cancel reuses `Booking`/`Passenger` from Phase 2.

---

## Open items to confirm with the public-site track before merging

1. `Booking`/`Passenger`/`LedgerEntry` above are a **minimal, forward-compatible
   guess** at what the public-site track will build for search/checkout/
   payment. Reconcile field names before both migration histories merge.
2. `ReservationSystem`'s `role="super"` string literal — several panels pass
   `"super"` (not `"ceo"`) as the prop even when logged in as CEO/Senior
   Manager, and one panel (CEO's) never mounts the component at all (dead
   nav). Confirm intended mapping: does `BOARD_CHAIR` alone get lock rights,
   or should `CEO` too? The design copy says "CEO or Board Chair" but the
   code only checks `role === 'super'`. **Needs a product decision, not an
   inferred one** — CLAUDE.md workflow rule 4.

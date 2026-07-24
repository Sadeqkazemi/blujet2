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

Scope, confirmed against `PLAN.md`'s Phase 8 bullet: **accounts,
permissions, services, security policy, logs, backups**. The IT panel's
other 3 design tabs (سامانه رزرواسیون, دسترسی به پنل‌ها, تنظیمات سامانه)
are out of scope here — first depends on Phase 9, the other two are
explicitly listed under Phase 12 in `PLAN.md` — not built, not stubbed.

- `User` gained Phase-8 columns directly (mirrors how Phase 3/4 extended
  shared tables rather than a parallel `Employee` table): `dept` (free
  string — design lets IT create custom departments beyond
  commercial/finance/IT/sales, so this is intentionally not a Prisma enum),
  `rank`, `referralScope: MANAGERS_ONLY|ALL_STAFF` (captured at creation
  per the design's «دسترسی ارجاعات» picker; consumed by the referral system
  once `EMPLOYEE` joins `EXEC_ROLES`, which it doesn't yet — captured
  honestly now rather than added as a later migration), `mustChangePassword`,
  `createdById→User` (self-relation, who provisioned the account),
  `lastLoginAt` (set on every successful `staffLogin` verify, also backs the
  employees list' "آخرین ورود" column).
- `Permission { id, dept, sectionKey, sectionLabelFa, key, labelFa }` —
  seeded **verbatim** from `design-reference/site-data.js`'s `PERM_CATALOG`
  (commercial: agencies/flights/pricing/reports; finance:
  refund/agencies/finance/reports; IT: users/services/security/logs — 12
  permission rows total). Custom depts get no catalog rows until product
  defines one — not fabricated.
- `EmployeePermission { employeeId→User, permissionId→Permission, grantedById? }`
  — replaces the mock's plain `permissions: string[]` with a real FK-checked
  grant; `@@unique([employeeId, permissionId])` makes toggling idempotent.
- `InternalService { id, key, nameFa, enabled, uptimePct }` — seeded from
  the design's `svcDefs` (search/payment/api/sms/email/club/charter/refund/
  checkin/cdn/dest/mobile).
- `ExternalServiceConfig { id, key, nameFa, provider, endpoint, method,
  timeoutMs, apiKeyEncrypted, sandbox, enabled, lastTestAt, lastTestOk,
  lastTestMessage }` — seeded from the design's `extDefs`
  (zarinpal/amadeus/kavenegar/neshan). `apiKeyEncrypted` reuses
  `pii-crypto`'s AES-256-GCM (a generic reversible-encryption primitive
  despite the file's name, needed here because the value must be sent back
  out on real test-connection calls — a hash would be one-way and useless).
- `PasswordResetEvent { id, employeeId→User, resetById→User, createdAt }` —
  audit-only; the actual new password is never stored/displayed after the
  one-time generation screen, same pattern as `TwoFactorChallenge`'s
  hashed/single-use codes.
- `SecurityPolicy` — singleton (`id=1`, upserted): `minLength`,
  `expiryDays`, `maxAttempts`, `requireUppercase`, `requireNumber`,
  `requireSymbol`, `blockReuse`, `staffTwoFactorMandatory`. The design shows
  these as static numbers; made editable since a settings screen with
  read-only toggles isn't a real feature.
- Active sessions ("نشست‌های فعال") reuse the existing `RefreshToken` table
  (`userAgent`, `ip`, `revokedAt`) from Phase 1 — no new table. «خروج همه»
  revokes every non-revoked row.
- `BackupRecord { id, fileName, sizeBytes, status: RUNNING|SUCCESS|FAILED,
  triggeredById→User?, startedAt, completedAt, errorMessage }` — one row per
  real `pg_dump` invocation. Restore stays a manual RUNBOOK step (see
  `docs/API.md`'s note) — no destructive one-click endpoint.

## Phase 9 — Reservation system (seat lock / PNR)

Shared `ReservationSystem` component contract, confirmed from
`ReservationSystem.dc.html`'s script (`canLock = this.props.role === 'super'`)
and its own copy ("لاک‌کردن صندلی فقط توسط مدیر عامل یا رئیس هیئت مدیره
انجام می‌شود"). ⚑ **Product decision (open item resolved by the user,
2026-07-17):** `canLock` = `CEO`, `BOARD_CHAIR`, `IT_MANAGER` (the design
hardcodes `resRole:"super"` for the IT panel's mount, and CEO/Chair's own
`state.role` resolves to `"super"` too); `SENIOR_MANAGER` gets view-only
access to the same seat map, matching the design's confirmed behavior.
Reachable nav entries (per `panel-nav.config.ts`, already confirmed in
Phase 1's extraction): only `BOARD_CHAIR`, `SENIOR_MANAGER`, `IT_MANAGER`
get a سامانه رزرواسیون/هواپیما sidebar tab — CEO's mount point is coded but
unreachable from its sidebar, so CEO's `canLock` grant is API-level only
(consistent with the design's own copy naming CEO as an authorized locker)
and has no UI entry point yet.

- `AircraftSeatMap { id, aircraftType (unique) →Flight.aircraftType, businessRowStart/End, businessColsLeft/Right, economyRowStart/End, economyColsLeft/Right }` — CLAUDE.md: "seat map config lives per aircraft type in the DB, not hardcoded." Seeded once for `"Airbus A320"` (the existing seed flight's type) matching the design's MD-88 mock numbers verbatim: rows 3–6 business 2-2 (16 seats), rows 7–32 economy 2-3 (130 seats) = 146 total.
- `SeatLock { id, flightInstanceId→FlightInstance, seatCode, lockedById→User, passengerName?, passengerNationalIdEnc?, passengerNationalIdHash?, passengerMobileEnc?, releasedById?→User, releasedAt? }` — PII fields follow the same encrypt+hash pattern as `ClubMember`. A partial unique index (`WHERE releasedAt IS NULL`) enforces exactly one active lock per seat at the DB level, not just an app-side check — CLAUDE.md's seat-inventory concurrency rule.
- `Passenger` gained `nationalIdHash` (same encrypt+hash pattern, needed for the design's «جستجوی مسافر» exact-match search) and `seatCode` (nullable — Phase 1–6 seed passengers predate seat selection).
- PNR issuance/change/cancel reuses `Booking`/`Passenger` from Phase 2. "New booking" (منوی جستجوی پرواز + صدور PNR) in this component is a **staff-side manual/offline issuance path** (phone/counter bookings), not the public paid-checkout flow — it creates a `TICKETED` booking directly (no `HELD`/`PAID` steps, no payment gateway), clearly distinct from and not a substitute for the public-site booking-and-payment track. Price comes from `FarePricingProposal.registeredPriceIrr` when one exists for that `FlightInstance` (Phase 6), else a documented flat fallback — no ad-hoc dynamic pricing invented here.
- Out of scope for Phase 9 (design tabs intentionally not built here): «دسترسی آژانس‌ها» duplicates Phase 3's `AgencyApiKey` feature already shipped; «پروازها» (flight/schedule/capacity creation) is Phase 10's own scope; the dashboard sub-tab's "microservices health" cards describe infrastructure that doesn't exist as separate services in this monolith — building it would mean fabricating status data, which CLAUDE.md forbids, so it's replaced by real booking/seat stats instead of ported verbatim.

---

## Agency Portal (self-service, پنل آژانس) — separate track, reassigned into this session

Explicitly authorized by the user (2026-07-17). Reuses Phase 3's
`AgencyProfile`/`AgencyCreditLine`/`AgencyInvoice`/`AgencyMessage`/
`Booking`/`LedgerEntry` — this feature is a self-service VIEW and a small
set of self-scoped WRITES over those same rows, not a new data model.
Two new tables only:

- `AgencyCreditRequest { id, agencyId→AgencyProfile, requestedLimitIrr Int, note String?, status: PENDING|APPROVED|REJECTED, decidedById?→User, decidedAt?, createdAt }` — ⚑ replaces the design's client-side «افزایش اعتبار» mutation (`_limitN = _baseLimit + _topupTotal`, applied with no approval) with an auditable request; only `AgenciesService.updateCredit` (Phase 3, unchanged) can ever actually change `AgencyCreditLine.limitIrr`, called from a dedicated staff decide endpoint, never from this table's row directly.
- `AgencyDocument { id, agencyId→AgencyProfile, fileId→StoredFile, docType: LICENSE|CONTRACT|OTHER, status: PENDING|APPROVED|REJECTED @default(PENDING), createdAt }` — wraps Phase 4's `StoredFile` (same PDF/image/≤5MB upload backing already used for referral/message attachments and club-card docs). Staff-side review is out of scope this phase (see `docs/API.md`) — every row stays `PENDING` until that workflow is built; the status enum exists now so it's forward-compatible rather than needing a later migration.

`User` gains no new columns — `phone`/`passwordHash`/`mustChangePassword`
(Phase 8) are reused as-is for AGENCY logins. `AgenciesService.approveRequest`
(Phase 3) is extended to also generate a one-time temp password (identical
pattern to `EmployeesService.resetPassword`'s `generateTempPassword`, now
lifted into a shared `backend/src/common/temp-password.ts` since two modules
need it) and set `mustChangePassword: true` — without this, an approved
agency's `User` row had `passwordHash: null` and could never log in; this
was a real gap in Phase 3, not a deliberate deferral, and this phase closes
it. `AgenciesService.postMessage` gains a `senderIsAgency` parameter
(default `false`, preserving the existing staff-side call site) so this
phase's inbox POST can pass `true` — `AgencyMessage.senderIsAgency` already
existed in the Phase 3 schema in anticipation of exactly this.

Out of scope this phase (see `docs/API.md`'s reasoning): «صندلی‌های
تخصیص‌یافته» (no staff-side seat-allocation workflow exists to allocate
seats to an agency in the first place — would require inventing one);
«وب‌سرویس» self-service purchase+approval (no staff-side purchase-approval
counterpart exists; `AgencyApiKey` issuance stays Senior-Manager-initiated
per Phase 3, and its `keyHash` is one-way — a self-service tab could only
ever show key STATUS, never the value, so it was judged not worth a
half-feature this phase); staff-side `AgencyDocument` review; Excel export
(mock-only everywhere else in the codebase too).

## Phase 10 — Flight management (مدیریت پروازها)

Extracted from the FLIGHTS MANAGEMENT sections of `پنل مدیر ارشد.dc.html`
and `پنل مدیر بازرگانی.dc.html` (near-identical markup: KPI row, three
sub-tabs پروازهای فعال / انجام‌شده / آینده, add-flight modal, flight detail
modal, future-flight نرخ‌گذاری/allocation modal with the AI hint).

- `Airport { id, code (unique, e.g. THR/DXB), cityFa, tz (IANA) }` — new,
  seeded with the CLAUDE.md list (20 Iranian cities + DXB/IST/NJF).
  ⚑ The mocks' add-flight modal uses free-text مبدأ/مقصد; the real form
  uses selects fed by this table so `Route.originCode/destCode` stay
  valid codes and departure times can render in airport-local time later.
- `Route`/`Flight`/`FlightInstance` (Phase 2) are reused as-is for
  creation: «افزودن پرواز» = find-or-create `Route`, find-or-create
  `Flight` (unique `flightNo`, default `aircraftType "Airbus A320"` —
  the one seat-mapped type), create one `FlightInstance` (Jalali
  date+time → UTC `departureAt`; ⚑ `arrivalAt` = departure + a
  per-route seeded duration since the design has no arrival input).
- `FlightInstance` gains:
  - `basePriceIrr Int?` — the modal's «قیمت بلیط (تومان)» (stored rial).
    ⚑ This is the design's «قیمت پایه/نرخ اصلی» display figure AND the
    denominator for the completed-flights سود/ضرر comparison; it does NOT
    bypass Phase 6 — the bookable price remains the registered
    `FarePricingProposal` (per CLAUDE.md, pricing separate from
    availability).
  - `agencySeatsAllocated Int?` — the future-flight تخصیص modal's آژانس
    figure; مستقیم is always derived (`capacity − charterSeats −
    agencySeatsAllocated`), never stored.
- ⚑ Statuses: the mocks show فعال / در حال فروش / تکمیل / لغو شده as
  hardcoded strings. Real mapping is derived server-side from
  `FlightInstanceStatus` + sales: `CANCELLED`→لغو شده; `DEPARTED` rows
  belong to پروازهای انجام‌شده; `SCHEDULED` with sold==capacity→تکمیل,
  with sold>0→در حال فروش, else فعال. No new enum values.
- ⚑ Completed-flights financials: the mocks fabricate an 18٪ profit
  margin and fixed channel ratios (`sysR/charR`). Real figures are
  aggregated from `Booking` (channel, priceIrr) per DEPARTED instance:
  سیستمی/چارتری/آژانس sums, متوسط نرخ = revenue/tickets, and سود/ضرر
  relative to the base rate (`(avg − base) × tickets`, split into the
  green/red columns). No fabricated margins (CLAUDE.md forbids invented
  figures); the design's column set is kept verbatim.
- ⚑ RRULE recurring schedules (`Schedule` entity from CLAUDE.md's domain
  model) have **no UI anywhere in the design** — every mock creates
  single instances. Per workflow rule 4 (design wins), Phase 10 ships
  single-instance creation only; the `Schedule` table is deferred until a
  design exists for it (noted as an open item, not silently dropped).
- Future-flight AI suggestions reuse Phase 6's `AiPriceSuggestion`
  persistence + ml-service path unchanged (advisory only).

---

## Phase 11 — Finance tab, passenger reports, staff reports

**No new tables and no schema changes.** Every figure is derived from
existing rows at query time, per CLAUDE.md's server-side-aggregates rule:
- مالی analytic view (CEO/Chair/Senior/Commercial): Phase 1 reporting
  queries over `LedgerEntry`/`Booking`/`FlightInstance` — reused unchanged.
- «تراکنش‌های مالی اخیر»: `LedgerEntry` (SALE/SETTLEMENT/COMMISSION/REFUND)
  joined to `AgencyProfile`/`Booking→Passenger` for the party label.
- «ترکیب درآمد»: SALE sums grouped by `Booking.channel`.
- «تسویه‌حساب آژانس‌ها»: `AgencyInvoice` per agency (paid ratio, earliest
  unpaid due date, overdue days) — presentation over Phase 3 data; the only
  write is the existing audited remind endpoint.
- گزارش مسافران: `Passenger` (name substring, or exact national-ID via the
  Phase 9 `nationalIdHash`) joined through `Booking` to flight/route; cabin
  derived from the `AircraftSeatMap` row bands; national ID rendered MASKED
  only (this surface never decrypts PII).
- گزارش کارمندان: `User(role=EMPLOYEE, dept∈caller's depts)` +
  `AuditLog(actorId∈those)` as the feed; the "new employee" banner rows are
  real `AuditLog(category=ACCOUNT)` creation events, not synthetic.

## Phase 12 — admins, security, settings, CEO logs, IT panels view

One new table:

- `SystemSetting { key String @id, value Json, updatedById?→User, updatedAt }` — key-value store for the تنظیمات سامانه tab (company info, gateway toggles, global site toggles, brand color). Server-side defaults fill missing keys; every write is audited (`category=SYSTEM`). ⚑ The chair mock's refund-rule inputs deliberately do NOT live here — they write the real Phase 7 `RefundPenaltyRule` rows so the refund engine and the settings screen can never disagree.

Everything else reuses existing tables: admins list/add/block/reset run on
`User` (+ `RefreshToken` for the real «آنلاین» derivation and the existing
`mustChangePassword` flag); CEO logs and the audit trail run on `AuditLog`;
the IT panels view reads `PanelAccessFlag` (read-only).

## Open items to confirm with the public-site track before merging

**Resolved 2026-07-22 (branches unified into `main`):**

1. ~~`Booking`/`Passenger`/`LedgerEntry` above are a minimal, forward-compatible
   guess...~~ Reconciled — see Phase 13 below. The public-site track's actual
   schema (`BookingStatus: DRAFT|HELD|PAID|TICKETED|CANCELLED|EXPIRED|REFUNDED`,
   `BookingChannel: SYSTEM|CHARTER|AGENCY`, `CabinClass`, `FareRule`) is the
   real one merged into `main` — this section's `DIRECT|AGENCY|VIP|MANAGERIAL`
   guess was never implemented and is superseded; no migration needed, just
   a doc correction (Phase 2's channel list above is historical/inaccurate,
   kept as-is for the historical record rather than silently rewritten).
2. ~~`ReservationSystem`'s `role="super"` string literal...~~ Already resolved
   per Phase 9 above (`CAN_LOCK_ROLES = [CEO, BOARD_CHAIR, IT_MANAGER]`,
   `SENIOR_MANAGER` view-only) — this open item was left unchecked after the
   decision shipped; marking it done here.

---

## Phase 13 — Reservation engine completion, Part A: sale window, aircraft registration, real inventory pools

Follow-up audit (2026-07-22) against a from-scratch reservation-engine spec
the user provided, checked line-by-line against the actual merged code (not
the mocks — none of this is grounded in a `.dc.html` design file, since no
design shows these controls; see the "not built here" list at the end for
the parts of that spec deliberately deferred pending a product decision,
per workflow rule 4 — design/product intent wins, this file doesn't invent
UI that was never specified anywhere).

- `FlightInstance` gains:
  - `saleStartsAt DateTime?`, `saleEndsAt DateTime?` — optional sale window.
    `NULL` on either end means "no restriction" (today's behavior, so every
    existing seeded/tested instance keeps working unchanged). When set,
    `SearchService.search`/`searchUncached` excludes instances where
    `now < saleStartsAt` or `now > saleEndsAt`, and `BookingService.createBooking`
    re-checks the same window server-side (never trust that a client that
    fetched search results a while ago is still inside the window) — 409
    `SALE_WINDOW_CLOSED` if not.
  - `aircraftRegistration String?` — the physical tail number assigned to
    this specific flown instance (a recurring `Flight`/`Schedule` keeps the
    same `aircraftType` across dates, but the actual airframe varies
    per-departure in reality) — display-only, no booking logic reads it.
  - ⚑ **Aircraft-type change is NOT a free-text field flip.** Changing the
    instance's effective `aircraftType`-derived capacity (i.e. re-pointing it
    at a different `AircraftSeatMap`) goes through a new
    `FlightsService.changeAircraftType(instanceId, newAircraftType)` that:
    1. Loads the new `AircraftSeatMap`'s total seat count.
    2. Counts currently CONFIRMED-or-later seats (`Booking.status IN
       (PAID, TICKETED)` for this instance, plus active `SeatLock` rows).
    3. If the new capacity is `<` that count, **rejects with 409
       `CAPACITY_BELOW_CONFIRMED`** — the response includes the shortfall
       count so staff can see how many passengers would need manual
       rebooking/cancellation first. The engine does **not** auto-cancel or
       auto-rebook paying customers — that's a business/legal decision
       (refund policy, compensation, rebooking priority) with no design or
       product guidance anywhere, so it's surfaced as a blocked action for a
       human to resolve deliberately, not automated.
    4. Otherwise updates `capacity` (from the new seat map's total) and a
       new `Flight.aircraftType` pointer *for this instance only* — this is
       genuinely an instance-level override, so `FlightInstance` gains its
       own nullable `aircraftTypeOverride String?` (falls back to
       `Flight.aircraftType` when null) rather than mutating the shared
       `Flight` row, which would silently change every other instance of
       the same recurring schedule.

- **Real inventory pools** (currently `charterSeats`/`agencySeatsAllocated`
  are informational-only integers — nothing actually stops a `SYSTEM`-channel
  booking from consuming a seat that was supposed to be reserved for charter
  or an agency's quota). `SearchService.takenSeatCodes` today returns one
  undifferentiated set of taken seat codes; this phase makes the channel
  pools real without introducing a per-seat-code pool assignment (matching
  the user's own inventory-vs-seat-map distinction — a pool is a *count*,
  the seat map is *which physical seat*, and they're deliberately kept
  separate):
  - New `SearchService.takenSeatCodesByChannel(flightInstanceId)` — same
    query as today's `takenSeatCodes` but grouped by `Booking.channel`
    (`SeatLock` rows count toward a new virtual `MANAGERIAL` bucket, not
    `SYSTEM`, so a managerial lock can never silently eat into the public
    pool's count).
  - `BookingService.createBooking`'s existing `FOR UPDATE`-guarded
    transaction gains a pool check alongside the existing per-seat-code
    conflict check: `AGENCY`-channel bookings 409 once
    `takenByChannel.AGENCY >= flightInstance.agencySeatsAllocated`;
    `CHARTER`-channel bookings 409 once `takenByChannel.CHARTER >=
    flightInstance.charterSeats`; `SYSTEM`-channel (public/direct)
    bookings 409 once `takenByChannel.SYSTEM >= capacity − charterSeats −
    agencySeatsAllocated − takenByChannel.MANAGERIAL` (managerial locks
    still physically occupy a seat, so they still count against the public
    pool's remaining count — only the agency/charter split is separated
    out). Error code `POOL_EXHAUSTED`, includes which pool.
  - ⚑ **Scope cut for this phase:** `SearchService.search`'s per-cabin
    `seatsLeft` stays "physically unoccupied seats in that cabin" (unchanged)
    rather than being reworked into a per-pool number — the pool split
    (charter/agency/managerial) is currently instance-wide, not per-cabin,
    so an accurate per-cabin-per-pool display number needs the cabin-level
    allotment model Phase C is scoped to build; doing it here risked a
    display figure that quietly disagreed with the cabin-level fare-class
    math (Phase 6/booking-engine's `pricing.ts`). What ships THIS phase is
    the hard guarantee that matters most — `createBooking` rejects a
    booking that would exceed its channel's pool even while the display
    still shows physical vacancy — not the softer, cosmetic display
    number. Revisit once Phase C lands.

- **Not built in this phase (needs a product decision first, not invented):**
  - `DRAFT` / `PENDING_APPROVAL` flight-instance statuses (from the user's
    spec) — no design file or existing panel shows a flight-approval queue,
    and today every `Flight`/`FlightInstance` created via Phase 10's «افزودن
    پرواز» goes live immediately. Adding a mandatory approval gate would be
    a real workflow change (who approves? does it block search
    immediately or only for a still-configuring flight?) with no grounding
    to build against — flagged here rather than guessed.
  - Full 6-status IATA-style flight lifecycle beyond `SCHEDULED → CLOSED
    (derived from the sale window, not a stored status) → DEPARTED /
    CANCELLED` — same reasoning; the user's spec's "بسته" state is covered
    by the sale-window fields above without inventing a separate manual
    toggle no design asks for.

---

## Phase 13 — Reservation engine completion, Part B: manageable fare classes + rate rules

No design file shows a fare-class management screen anywhere (none of the
six executive panels' diffs from the design refresh mention Y/B/M class
editing) — this phase is backend-only (endpoints + validation + tests),
same posture as Phase 6 before its UI existed. A frontend for this waits
for an actual design.

- `FareRule` (existing, previously seed-only — this phase adds the first
  way to create/edit/delete rows outside `seed.ts`) gains:
  - `validFrom DateTime?`, `validUntil DateTime?` — NULL on either end
    means unrestricted (existing seeded rows keep working unchanged).
    `resolveFareClass` (booking-engine/pricing.ts) now filters out a rule
    whose window doesn't cover "now" before picking the cheapest
    available bucket — an expired/not-yet-active class is invisible to
    pricing, not merely unavailable to buy.
  - `allowedChannels BookingChannel[]` — empty array (the default) means
    "all channels", matching the sale-window NULL convention above. A
    class scoped to e.g. `[AGENCY]` is invisible to a `SYSTEM`-channel
    booking's price resolution. (No channel actually creates AGENCY/
    CHARTER bookings yet — Phase C's job — so this is currently only
    exercised by SYSTEM-channel bookings seeing an empty/wildcard list;
    the filter is there so Phase C doesn't need a second migration.)
  - `taxIrr Int @default(0)` — per-passenger tax/fee, added on top of
    `priceIrr` at booking time (`getCabinPrice` returns the pre-tax fare
    unchanged for backward compatibility with every existing caller;
    `BookingService.createBooking` adds `taxIrr × passengers.length` to
    the stored `priceIrr` total when the resolved fare came from a
    `FareRule`, and the booking-detail response breaks out `taxIrr` so a
    receipt can show it separately — see docs/API.md). Flat/no-fare-class
    pricing (`CabinFare`/`FarePricingProposal`) is untouched — it was
    never in the multi-class scope this phase is fixing.
  - `changeable Boolean @default(true)` — mirrors the existing
    `refundable` flag's pattern (a same-shape yes/no gate, not a new
    concept). ⚑ Deliberately NOT wired to any enforcement yet: no
    "change reservation date" endpoint exists anywhere in the codebase to
    gate — adding the flag now (like `refundable` did originally) means
    that endpoint won't need a migration when it's eventually built.
  - `baggageAllowanceKg Int?` — informational only (shown alongside the
    fare, never validated against anything — there's no check-in/weigh-in
    flow in this codebase to enforce it against).

- **New endpoints** (`backend/src/modules/flights/`, same
  `SENIOR_MANAGER`/`COMMERCIAL_MANAGER` role gate as Phase 10's existing
  flight-management endpoints — fare classes are a flight-configuration
  concern, not a new domain):
  - `GET /flights/:instanceId/fare-rules` — list, ordered by `priceIrr`.
  - `POST /flights/:instanceId/fare-rules` — create. ⚑ **Capacity-sum
    validation** (the user spec's explicit "انجین باید مانع شود مجموع فروش
    کلاس‌ها از ظرفیت کابین بیشتر شود"): the sum of `seatsAllocated` across
    every rule sharing `(flightInstanceId, cabin)`, including the new one,
    must not exceed that cabin's physical seat count (from
    `AircraftSeatMap` via `enumerateSeats`, filtered to the cabin) — 400
    if it would. Also 400 if `validUntil <= validFrom` when both are set.
  - `PATCH /flights/:instanceId/fare-rules/:id` — same capacity-sum and
    date-window validation, re-checked against the OTHER existing rules
    (excluding the one being edited).
  - `DELETE /flights/:instanceId/fare-rules/:id` — 409 if any active
    (`DRAFT|HELD|PAID|TICKETED`) booking is already stamped with that
    `classCode` for the instance (mirrors the "REGISTERED proposal is
    locked" pattern from Phase 6 — never orphan a sold booking's price
    basis).

- **Explicitly not built this phase (spec items with no clear operational
  meaning in the current architecture — flagged per workflow rule 4, not
  guessed):**
  - «مهلت صدور» (ticketing deadline) — the current booking state machine
    collapses `PAID → TICKETED` atomically inside one `pay()` call (see
    Phase 2/booking-engine); there is no window where a booking sits PAID-
    but-not-yet-ticketed for a deadline to apply to. Adding this field
    would be inventing a gap in the pipeline that doesn't otherwise exist,
    purely to give the field somewhere to matter — needs a real product
    decision on whether/why payment and ticketing should ever be separate
    steps before this is worth building.
  - «حداقل ظرفیت فروش» (minimum sale capacity) — unclear what this means
    operationally for a single fare-class row (a floor the class refuses
    to sell below? a minimum guaranteed allocation regardless of demand?
    something else?) — flagged rather than guessed at.
  - Per-fare-class cancellation-penalty override — Phase 7's
    `RefundPenaltyRule` is already a global hours-before-departure
    schedule (30/50/70/100٪ tiers) that's the seeded, actually-executed
    source of truth for every refund today. A per-class override would
    mean two competing penalty systems disagreeing with each other for
    the same booking; `changeable`/`refundable` booleans (gates, not
    amounts) avoid that conflict, but a genuine per-class fee schedule
    needs a product decision on how it interacts with Phase 7's existing
    global rule before it's built.

---

## Phase 13 — Reservation engine completion, Part C: real per-agency allotments

`FlightInstance.agencySeatsAllocated` (Phase 10) is a single instance-wide
number with no link to which agency it's for, no contract terms, and no
soft/hard distinction — the user spec's "سهمیه آژانس" section asks for a
real per-agency breakdown of that quota (contract party, seat count,
firm-vs-refundable, release deadline, contract price). This phase adds
that breakdown; it does NOT touch `agencySeatsAllocated` itself or Phase
10's existing `PATCH /flights/:instanceId/plan` endpoint that writes it —
that field stays the coarse "how many seats total are reserved for
agencies" cap Phase A's public-pool formula already reads. Allotments
subdivide that same cap across specific agencies, the same way Phase
13B's fare-class capacity-sum check subdivides a cabin's physical seats
across price classes — additive, not a replacement.

- New `AgencyAllotment { id, agencyId→AgencyProfile, flightInstanceId→FlightInstance, seatsAllocated Int, type: AllotmentType (SOFT|HARD) @default(HARD), releaseAt DateTime?, contractPriceIrr Int?, createdById→User, createdAt }`.
  - `type: HARD` — "آژانس یا چارترکننده نسبت به ظرفیت تخصیصی متعهد است، حتی
    اگر آن را نفروشد" (the user spec's exact wording) — no `releaseAt`
    needed; the seats stay reserved for this agency until staff explicitly
    deletes the allotment.
  - `type: SOFT` + `releaseAt` — "صندلی‌های فروش‌نرفته در موعد مشخص به
    فروش عمومی بازمی‌گردند." Once `releaseAt` has passed, this row is
    excluded from the active-allotment sum (lazy, computed at read/
    validation time — same pattern as `Booking`'s `HELD`→`EXPIRED`
    materialization, no cron job) — its seats become available to the
    general agency pool again without deleting the historical row.
  - `contractPriceIrr` — this specific agency's contracted per-seat rate,
    nullable (falls back to normal price resolution when unset). Kept
    separate from Phase 13B's `FareRule.allowedChannels` because a fare
    rule scoped to `[AGENCY]` would be shared by every agency — an
    allotment's contract price is deliberately one specific agency's deal.
  - ⚑ No per-allotment credit cap: `AgencyCreditLine` (Phase 3) already
    owns the agency's overall financial credit limit. A second,
    allotment-level credit cap would be a competing figure with no clear
    reconciliation rule — same reasoning as Phase 7's refund-penalty
    conflict above.
- **Capacity-sum validation** (mirrors Phase 13B's fare-class check): the
  sum of `seatsAllocated` across every *active* allotment (HARD, or SOFT
  with `releaseAt` still in the future or unset) for an instance, including
  the one being created, must not exceed `FlightInstance.agencySeatsAllocated`
  — 400 if it would, and 400 if `agencySeatsAllocated` is unset (staff must
  set the coarse quota via Phase 10's `plan` endpoint first).
- New endpoints (`backend/src/modules/flights/`, same `SENIOR_MANAGER`/
  `COMMERCIAL_MANAGER` role gate): `GET/POST /flights/:instanceId/allotments`,
  `DELETE /flights/:instanceId/allotments/:id` (409 if any active booking
  already exists for that agency on this instance — mirrors Phase 13B's
  delete-guard for fare rules).

- **Explicitly not built this phase (needs its own dedicated design, not
  guessed at here):**
  - An agency actually BOOKING against its own allotment. Today literally
    nothing in the codebase ever creates an `AGENCY`-channel `Booking` row
    (confirmed while auditing Phase 13A — `channel: 'AGENCY'` only appears
    in reporting's group-by queries, never in a create call). Building
    this properly means an agency-side payment path that draws down
    `AgencyCreditLine` (Phase 3) instead of the Shetab/IPG gateway or
    wallet/points — a genuinely different payment method from every path
    `BookingService.pay()` currently supports, not a small addition to it.
    That deserves its own phase once the credit-billing flow is designed,
    rather than a rushed half-integration bolted onto this one. This
    phase ships the allotment bookkeeping (so staff can plan/contract
    agency capacity today); consuming it from an actual agency booking is
    the next phase.

---

## Phase 13 — Reservation engine completion, Part D: managerial reservation governance

Phase 9's `SeatLock` is a single-step control today: any `CAN_LOCK_ROLES`
member (`CEO`, `BOARD_CHAIR`, `IT_MANAGER`) locks a seat directly, with no
reason on record, no spending classification, no cap on how many seats one
person can hold, and no expiry — a lock sits active forever until someone
remembers to release it. The user's spec asks for real governance around
this: a reason, a free/discounted/payable classification, the requester's
rank on record, a per-requester seat cap, a hold-to-ticket deadline with
auto-release, and a genuine two-step request→approval flow before a lock
can be turned into a ticket. This phase adds all of that directly onto
`SeatLock` — it's still the same table Phase 9 built, not a new model,
because every new field describes that same row's lifecycle.

- `SeatLock` gains:
  - `reason String` — required free-text justification for the request
    (⚑ migration default `""` for the handful of pre-existing dev/test
    rows only; the DTO makes it mandatory for every new request — no real
    production lock exists yet, the platform hasn't launched).
  - New enum `LockClassification { FREE, DISCOUNTED, PAYABLE }` — the
    seat's eventual charge basis, decided at request time.
    `classification LockClassification @default(PAYABLE)`.
  - `discountPct Int?` — 0–100, required by the DTO only when
    `classification: DISCOUNTED`; ignored otherwise.
  - `requesterRank Role` — a snapshot of the requester's `User.role` at
    request time, not a live join. ⚑ Deliberate: if a requester's role
    ever changes later (promotion/demotion), the audit trail must keep
    showing what rank actually authorized the original request, the same
    reasoning `AgencyAllotment.contractPriceIrr` and other historical
    snapshot fields already use elsewhere in this schema.
  - New enum `LockApprovalStatus { PENDING_APPROVAL, APPROVED, REJECTED }`,
    `approvalStatus LockApprovalStatus @default(APPROVED)` (⚑ default only
    backfills pre-existing rows as already-decided; every new lock is
    always created `PENDING_APPROVAL` — the default never applies to a
    request going through the real flow).
  - `approvedById String?` / `approvedAt DateTime?` → `User` (`"SeatLockApprovedBy"`),
    `rejectedById String?` / `rejectedAt DateTime?` → `User` (`"SeatLockRejectedBy"`),
    `rejectionReason String?`.
  - `expiresAt DateTime` — a single deadline field reused across both
    phases of the lock's life instead of two separate TTL columns: set to
    `createdAt + 24h` at request time (**request-decision deadline** — a
    `PENDING_APPROVAL` lock nobody acts on stops blocking the seat after a
    day) and overwritten to `approvedAt + 48h` at approval time
    (**hold-to-ticket deadline** — an approved-but-never-finalized lock
    stops blocking the seat after two days). ⚑ Both windows are fixed
    constants (`LOCK_REQUEST_TTL_HOURS = 24`, `LOCK_HOLD_TTL_HOURS = 48`)
    rather than configurable — no design or spec value exists for either,
    and CLAUDE.md forbids inventing numbers presented as configurable
    product settings; these are documented code constants, changeable by
    a future phase if a real requirement shows up.
  - `bookingId String?` → `Booking` (`"SeatLockFinalizedBooking"`) — set
    when the lock is finalized into a real ticketed PNR, for traceability
    from the lock's audit trail to the booking it produced.
  - Auto-release mirrors `Booking`'s `HELD`→`EXPIRED` materialization
    exactly (no cron): reads (seat map, pool counts) filter on
    `releasedAt: null AND expiresAt > now`, and the two write paths that
    actually contend for a seat — creating a new lock, and finalizing one
    into a booking — first run a conditional `updateMany` that stamps
    `releasedAt: now` (system release, `releasedById` stays null so it's
    distinguishable from a human release) on any lock for that seat whose
    `expiresAt` has already passed. This has to be a real write rather
    than a purely-lazy read-time exclusion, unlike Part C's SOFT
    allotments: the DB-level partial unique index (`WHERE releasedAt IS
    NULL`) that guarantees one active lock per seat can't itself express
    "and not expired" (`now()` isn't allowed in a partial-index
    predicate), so an expired row has to actually be released before a
    new lock on the same seat can be inserted. `approvalStatus`,
    `reason`, and every other governance field are untouched — the row
    stays queryable for audit with its true history.
- **Two-step approval, segregation of duties (⚑ product decision — the
  user's spec says "authorized unit finalizes" without naming a distinct
  role, and broadening `CAN_LOCK_ROLES` would be inventing a new role):**
  requesting and approving both stay within the existing
  `CEO`/`BOARD_CHAIR`/`IT_MANAGER` set, but **a requester can never approve
  or reject their own request** (409 if attempted) — a real two-step
  control between the three governance roles rather than a single person
  rubber-stamping themselves. Rejection immediately sets `releasedAt`
  (frees the seat right away, no need to wait out `expiresAt`).
- **Per-requester seat cap (⚑ scoped globally, not per-flight — a cap
  meant to bound how many seats one manager can hold locked across the
  whole airline at once, not per route):** a fixed constant
  (`MAX_ACTIVE_MANAGERIAL_LOCKS_PER_REQUESTER = 5`, same "documented code
  constant, not a fabricated configurable setting" reasoning as the TTLs
  above) counted against the requester's own currently-active
  (`releasedAt: null AND expiresAt > now`) locks across every flight
  instance; 409 `LOCK_CAP_EXCEEDED` past the cap.
- **Finalize** — turning an `APPROVED`, not-yet-expired lock into a real
  `TICKETED` booking: reuses `PnrService`'s existing manual-issuance path
  (same pricing fallback, same PII handling), but the price is now derived
  from the lock's `classification`: `FREE` → `priceIrr: 0`; `DISCOUNTED` →
  base price minus `Math.round(base * discountPct / 100)` (same rounding
  convention as Phase 7's `penalty.ts`); `PAYABLE` → unchanged base price.
  `taxIrr` is not computed for this manual path — matches Part A/B's
  existing `issue()` behavior, which never applied `FareRule.taxIrr`
  either; extending that is out of scope here. On success the lock is
  stamped `releasedAt`/`bookingId` (finalized, no longer "active" — the
  seat is now held by the real `Passenger` row instead).
- **Explicitly not built this phase:** a UI for any of this (no design
  screen shows a request/approval queue — Phase 9's own screen already
  ships single-step locking only; this is backend governance ahead of a
  design that doesn't exist yet, same situation Part B was in); email/SMS
  notification to the approver when a request is pending (no notification
  design exists here either — `AuditLog` is the only trail for now).

---

## Phase 14 — real SmsProvider + management log

CLAUDE.md specifies a `SmsProvider` interface (OTP, ticket issuance,
refund notifications; mock in dev). It was never actually built: OTP/2FA
delivery goes through the generic `TwoFactorProvider` (mock, just logs
the code — see Phase 1), and two other call sites *claim* SMS delivery in
their audit-log text with no send behind it at all —
`AdminsService.create`/`resetPassword`'s own comment says so explicitly
("nothing is fabricated as 'sent' beyond the audit note"). Phase 12's IT
panel already has an `InternalService(key:"sms")` row (enable/disable
toggle, ported from the design mock including its `uptimePct: 99.8` —
itself a pre-existing minor deviation from CLAUDE.md's no-fabricated-data
rule, not introduced here) and an `ExternalServiceConfig(key:"ext_kavenegar")`
row for the vendor. This phase adds the missing piece: a real interface +
mock provider, a real send log, and a management tab over that log — per
the user's explicit scope (2026-07-22): **management panel only**
(settings + a real log), not a redesign, and **no fabricated uptime**.

- New `SmsProvider` interface (`backend/src/common/sms/`), same pattern
  as `PaymentGateway`/`AiProvider`: `send(phone, message, messageType):
  Promise<{ success, failureReason? }>`. `MockSmsProvider` logs the
  message at `info` level (same reasoning as `MockTwoFactorProvider`:
  it's the only delivery channel until a real vendor is wired) and always
  reports success — it never fabricates a random failure rate.
- New `SmsLog { id, phone, messageType: SmsMessageType (OTP|TEMP_PASSWORD),
  status: SmsStatus (SUCCESS|FAILED), failureReason?, createdAt }`. Stores
  the phone number in plaintext (same treatment `User.phone` already gets
  elsewhere in this schema — it isn't encrypted-PII like national ID),
  masked only at the IT panel's read layer (`0912***5678`), never the
  message body/OTP code/password itself (CLAUDE.md: never log secrets).
- `SmsService` (new, wraps the provider): checks
  `InternalService(key:"sms").enabled` for **display purposes only** — it
  does NOT gate whether a real send is attempted. ⚑ Deliberate: today
  that toggle has zero functional effect (it's decorative, per its
  existing Phase 12 code); making it newly load-bearing for actual OTP/
  login delivery would mean a wrong click in the IT panel could break
  customer login — a real product-safety change nobody asked for. The
  toggle stays exactly as informational as it already was; this phase
  only adds a genuine log under it.
- The only genuine (non-fabricated) failure mode this phase introduces:
  **no phone on file**. `AdminsService.create`/`resetPassword` accept a
  `delivery: 'sms'|'email'` flag but their DTOs never collect a phone
  number for the new/target account — so an `sms` delivery on an account
  with `phone: null` logs a real `FAILED` row (`این حساب شماره موبایل
  ثبت‌شده ندارد`) instead of a fabricated success. This is an honest
  reflection of a pre-existing gap (delivery was never real before), not
  a new bug — ⚑ flagged here rather than silently worked around by
  inventing a phone-collection field on the admin-create form, which
  would be its own product decision outside this phase's scope.
- Three real send sites wired through `SmsService` (matching the user's
  own scope wording, "OTP/رمز موقت"):
  1. `MockTwoFactorProvider.sendCode` — logs `OTP` when the user has a
     phone (2FA/OTP can also go by email under the same interface; only
     the phone-bound case is an SMS send, so only that case gets a
     `SmsLog` row).
  2. `AdminsService.create` — logs `TEMP_PASSWORD` when `delivery: 'sms'`.
  3. `AdminsService.resetPassword` — logs `TEMP_PASSWORD` when
     `delivery !== 'email'` (matches its existing ternary's own default).
  Employees' own reset-password (`EmployeesService.resetPassword`) makes
  no delivery claim at all today (returns the plaintext password once,
  no audit text asserting it was sent) — left untouched, out of scope.
  Agencies' invoice reminder (`AgenciesService.remindInvoice`) similarly
  only *comments* that it's "queued via SmsProvider" with no delivery
  claim in its audit text or DTO — also left untouched; wiring it would
  mean inventing what an invoice-reminder SMS says, which nothing in the
  design specifies.

---

## Phase 13 — Reservation engine completion, Part E: PNR lifecycle completion + payment reconciliation

Two real gaps found while auditing the booking/payment path for this
phase, both fixed the same way as everywhere else this session: real
data, computed lazily, no fabrication, no invented signals.

**1. `FlightInstance.status: DEPARTED` was never written anywhere.** It's
read by `reporting.service.ts`'s completed-flights query and
`flights.service.ts`'s پروازهای انجام‌شده list, but no code path — no
cron, no endpoint — ever transitions an instance from `SCHEDULED` to
`DEPARTED` once its `departureAt` passes. Only `prisma/seed.ts` sets it
by hand for historical demo rows. So every "completed flights" report has
been running against whatever the seed happened to backdate, never a
real flight that actually departed during a live session. Fixed with the
same lazy/computed pattern used for `HELD`→`EXPIRED` bookings and Part
C/D's expiry filters — no cron:
- `materializeDepartedInstances(prisma)` (new shared util,
  `backend/src/modules/flights/flight-lifecycle.util.ts`): one bulk
  `updateMany({ where: { status: 'SCHEDULED', departureAt: { lte: now } },
  data: { status: 'DEPARTED' } })`. Called at the top of every place that
  reads `DEPARTED` for real decisions: the reporting completed-flights
  query, the flight-management پروازهای انجام‌شده list, and the new
  no-show endpoint below.

**2. No `NO_SHOW`/`FLOWN` distinction, and no signal to base one on.**
`Booking` has no boarding/check-in concept anywhere — no gate scan, no
check-in endpoint, nothing in the design shows one either (confirmed: no
design-reference screen mentions «عدم حضور» or no-show). Building an
automatic FLOWN-vs-NO_SHOW split would mean fabricating a boarding
signal that doesn't exist. ⚑ Product decision: **default every
`TICKETED` booking on a `DEPARTED` instance to `FLOWN`** (lazily, same
bulk-materialize pattern — a booking is presumed flown unless someone
says otherwise, matching how a real airline's default assumption works
before check-in data exists); **staff can override to `NO_SHOW`** via a
new manual action once the flight has actually departed — this is a real
operational action (ops reviewing the manifest after departure), not a
fabricated automatic flag.
- New enum values: `BookingStatus` gains `NO_SHOW`, `FLOWN`.
- `materializeFlownBookings(prisma)` (same util file): after
  materializing departed instances, bulk-flips every `TICKETED` booking
  whose instance is now `DEPARTED` to `FLOWN`.
- `PnrService.markNoShow` (new) — only from `TICKETED` or `FLOWN`
  (already lazily flipped) on an actually-`DEPARTED` instance; 409
  `FLIGHT_NOT_DEPARTED` if the flight hasn't departed yet, 409 `CONFLICT`
  if the booking is `CANCELLED`/`REFUNDED`/already `NO_SHOW`. No refund-
  penalty interaction is built here — whether a no-show forfeits a refund
  is Phase 7's `RefundPenaltyRule` engine's own decision to make later;
  this phase only adds the state and its legal transitions.

**3. Payment reconciliation — the real gap in `BookingService.pay()`.**
For `paymentMethod: 'GATEWAY'`, `gateway.request()`/`gateway.verify()`
run and can return `ok: true` (money genuinely captured by the PSP)
**before** the `$transaction` that flips `HELD`→`PAID`→`TICKETED` even
starts. If that transaction throws for ANY reason afterward — a promo
code that turns out to be already-redeemed, a DB hiccup, a process
crash — the whole transaction rolls back and the booking silently stays
`HELD` (or later expires), while the customer's money has already been
taken. Today there is **no record anywhere** that this happened; this is
a real, latent bug this phase closes, not a new feature bolted on for its
own sake.
- New `PaymentReconciliation { id, bookingId→Booking, gatewayRefId,
  amountIrr, status: PaymentReconciliationStatus (PENDING|RESOLVED)
  @default(PENDING), resolvedById?→User, resolvedAt?, resolutionNote?,
  createdAt }`.
- `BookingService.pay()`: right after `gateway.verify()` returns
  `ok: true` (GATEWAY method only — WALLET/POINTS are synchronous
  internal ledger moves fully inside the one transaction, nothing
  external to reconcile against), creates a `PENDING` reconciliation row
  **before** entering `$transaction`. Inside that same transaction, once
  ticket issuance (`PAID`→`TICKETED`) succeeds, the row is flipped to
  `RESOLVED` in the same atomic unit. If the transaction throws for any
  reason, the row is simply never flipped — it stays `PENDING`, and its
  mere existence past that point IS the mismatch signal. No separate
  catch-block bookkeeping needed.
- New `backend/src/modules/reconciliation/` module (`FINANCE_MANAGER`
  only, matching Phase 7 refunds' own role gate — this is the same
  finance-ops surface): lists `PENDING` rows (money captured, no matching
  ticketed booking) for staff to manually resolve (re-run issuance, or
  reverse the gateway charge via the existing `PaymentGateway.reverse`),
  and a resolve action that stamps `resolvedById/At` + a free-text note.
- **Explicitly not built this phase:** automatic resolution (e.g., a
  background job that retries ticket issuance on its own) — a `PENDING`
  row means something already went wrong once; auto-retrying blind risks
  double-charging or double-issuing, exactly the kind of thing CLAUDE.md's
  idempotency-key rule exists to prevent elsewhere but shouldn't be
  re-invented ad hoc here. Staff review is the safer default until a real
  auto-resolution policy is designed.

---

## Phase 15 — step-up verification for high-risk operations

CLAUDE.md (updated 2026-07-22) requires step-up verification for sensitive
agency account changes, and the original spec's §5.1 names five more:
role change, API-key issuance/rotation, refund payout, price/capacity
change, session revocation. Confirmed by audit: none of these had any
re-authentication gate beyond the actor's existing session JWT — the same
15-minute access token that authorized every OTHER request today could
also authorize wiping every active session site-wide. This phase adds a
real, reusable step-up mechanism and wires it into every high-risk
operation that actually exists in the codebase today.

- **Reuses `TwoFactorChallenge` rather than a new table** — same
  codeHash/expiresAt/consumedAt/attempts machinery already proven at
  login, just a new `purpose: STEP_UP_VERIFICATION` and a new nullable
  `scope: StepUpScope?` column (only meaningful for that purpose) so a
  challenge issued for one sensitive action can't be replayed against a
  different one.
- New enum `StepUpScope { ADMIN_ROLE_CHANGE, API_KEY_ROTATE,
  REFUND_PAYOUT, PRICE_CAPACITY_CHANGE, SESSION_REVOKE }` — exactly the
  five real call sites found (see API.md); no speculative scopes added.
- `StepUpService` (new, `backend/src/modules/auth/step-up.service.ts`):
  `request(actor, scope)` creates the challenge and sends the code
  through the SAME `TwoFactorProvider.sendCode()` already used for staff
  2FA login — not a separate delivery path. For AGENCY actors (who always
  have a phone) this is a genuine SMS OTP end-to-end (logged in Phase 14's
  `SmsLog`), satisfying CLAUDE.md's explicit "SMS OTP" wording for agency
  account changes; for staff actors it uses whatever channel their 2FA
  already uses. `verify(actor, challengeId, code, scope)` checks
  ownership, purpose, scope match, expiry, attempt cap, and code — then
  consumes the challenge. Every sensitive endpoint calls `verify()` as its
  very first action, before touching any other state.
- ⚑ **AGENCY_ACCOUNT_CHANGE was not wired to anything**: audited and
  confirmed no endpoint exists anywhere (staff-side or agency self-
  service) that changes an agency's username/phone/email/password/MFA
  device today — `agencies.service.ts` only has suspend/credit/API-key
  operations. Per CLAUDE.md workflow rule 4, this phase does not invent
  that endpoint just to attach step-up to it; the requirement stays
  documented here as a MUST for whichever future phase builds it.
- One new endpoint (`POST /auth/step-up/request`) is enough for every
  scope — no per-scope request endpoints. Verification itself is inline:
  each sensitive endpoint's existing DTO gains `stepUpChallengeId` and
  `stepUpCode` fields rather than requiring a separate "verify, get a
  temp token, attach it" round trip.

---

## Phase 16 — agency self-registration + real seat allotments

Ground truth for this phase is the live `ورود و ثبتنام.dc.html` design
(confirmed against a fresher Claude Design screenshot than the exported
`design-reference/` snapshot — user-approved as authoritative): a single
public auth page has an «آژانس همکار / کاربر عادی» account-type toggle and
«ثبت‌نام / ورود» tabs. The agency signup tab collects: نام آژانس
(agency name), شماره مجوز بند ب (license number), نام مدیر آژانس
(manager name), شماره موبایل (mobile, with an inline format-valid
checkmark), a terms checkbox, and a single submit button «ثبت درخواست و
دریافت کد» (submit request AND receive code) — no email field, no
separate "get code" step before submit.

- **This is a new front door onto the EXISTING `AgencyMembershipRequest`
  model** (`agencies.service.ts` `approveRequest`/`rejectRequest`/
  `referRequest`, built in Phase 3) — audited and confirmed that workflow
  already creates the `User(role: AGENCY)` row with a one-time temp
  password on approval. This phase adds the public submission side (never
  existed — staff could previously only view/decide on rows seeded or
  manually inserted) AND corrects the review-chain role gates to match the
  real process, per explicit user correction (not the original audit's
  reading of "any of SENIOR_MANAGER/FINANCE_MANAGER/COMMERCIAL_MANAGER can
  approve directly"): **پیش‌ثبت‌نام (this new public submission) → اول
  ادمین سایت بررسی و ارجاع می‌دهد → مدیر بازرگانی تأیید نهایی می‌کند →
  پیامک تأیید و دسترسی برای آژانس ارسال می‌شود.**
  - `SITE_ADMIN` gets read+refer access to `GET /agencies/requests`,
    `GET /agencies/requests/:id`, `PATCH /agencies/requests/:id/refer` —
    added via an explicit method-level `@Roles(...)` override on those
    three routes (the controller's class-level `@Roles(...AGENCY_TAB_ROLES)`
    excludes `SITE_ADMIN` entirely today and stays as-is for every other
    route — agency financial/credit data is NOT part of this grant).
  - `PATCH /agencies/requests/:id/approve` **tightens** from
    `SENIOR_MANAGER | FINANCE_MANAGER | COMMERCIAL_MANAGER` to
    `COMMERCIAL_MANAGER` only — final approval is that role's call, not
    three roles' shared call, per the corrected flow.
  - `PATCH /agencies/requests/:id/reject` gets `SITE_ADMIN` added
    alongside the existing gate — either the first-line reviewer or the
    final approver can reject an obviously-invalid submission; approval
    stays single-role.
  - `approveRequest` now **sends a real SMS** (same `SmsProvider` +
    `SmsLog(messageType: TEMP_PASSWORD)` pattern Phase 14 built for admin
    account creation) instead of only returning `tempPassword` in the API
    response for staff to relay by hand.
- `AgencyMembershipRequest.email` and `.city` become **nullable** (were
  `NOT NULL`) — the current design's public form collects neither; staff
  can still fill them in during review (`reviewNote`/manual follow-up),
  and the approval flow's `email` usage falls back to `null` (agency users
  can add an email later from their portal, same as any other optional
  contact field elsewhere in this schema).
- ⚑ **No public document upload this phase**: the design's public form
  (confirmed against the live screenshot) has no upload field — only
  text fields. `AgencyMembershipRequest.documents` stays the existing
  nullable `Json?` and is populated later by staff during review (they
  already have file-upload access via the existing `/files` endpoint);
  building a new *unauthenticated* multipart upload endpoint is a real
  abuse-surface decision (anonymous file upload) that the design doesn't
  call for and shouldn't be added speculatively.
- ⚑ **No selfie step anywhere** (explicit user instruction) — not for
  this phase's agency flow (which never had one) and not for Phase 17's
  user identity fields below.
- **New model `AgencyRequestOtp`** — phone-keyed OTP for verifying the
  applicant actually controls the phone number, BEFORE any
  `AgencyMembershipRequest` row is created:
  ```
  model AgencyRequestOtp {
    id         String    @id @default(uuid())
    phone      String
    codeHash   String
    expiresAt  DateTime
    consumedAt DateTime?
    attempts   Int       @default(0)
    createdAt  DateTime  @default(now())
    @@index([phone])
  }
  ```
  ⚑ **Deliberately NOT reusing `TwoFactorChallenge`**: that table's
  `userId` is a required FK to an existing `User`, and an anonymous
  applicant has no account yet. The existing customer-OTP endpoint
  (`AuthService.requestOtp`) sidesteps this by upserting a `User(role:
  USER)` row before issuing the challenge — but doing the same here would
  create a phone-linked `User` row (with what role? not yet AGENCY, since
  approval is what creates that) before staff have reviewed anything,
  which the existing approval flow doesn't expect and would collide with
  (`approveRequest` creates a fresh `User` unconditionally). A small,
  purpose-built, anonymous, phone-keyed table avoids both problems and
  never touches the security-sensitive auth table.
- Same shape/limits as every other OTP in this codebase: 6-digit code,
  2-minute TTL, 5-attempt cap, single-use, hashed at rest, delivered
  through the existing `TwoFactorProvider`/`SmsProvider` (so it lands in
  Phase 14's `SmsLog` like every other outbound code).
- Rate limiting: per-phone AND per-IP on both the OTP-send and the
  request-submit endpoints (same posture as every other OTP endpoint —
  `common/errors.ts` gets no new codes, this reuses the existing
  throttler pattern).

### Staff seat allotment — frontend only (backend already complete)

- Audited and confirmed `AgencyAllotment` (schema) and its full CRUD
  (`GET/POST /flights/:instanceId/allotments`,
  `DELETE /flights/:instanceId/allotments/:allotmentId`, all
  `SENIOR_MANAGER`/`COMMERCIAL_MANAGER`-gated, built in Phase C) have zero
  frontend callers. This phase adds ONLY the frontend: a per-flight
  allotment section in the existing flights panel (same role gate as the
  rest of that panel — no new endpoint, no new guard).
- **New endpoint** `GET /agency-portal/allotments` (agency's own token,
  tenant-scoped to `actor.agencyId` server-side — never trusts a client-
  supplied agency id) — the agency-portal side has no read of its own
  allotments today; `AgencySeatsPage.tsx` currently renders hardcoded
  sample numbers with a comment admitting it. Returns each allotment's
  flight (route, date, aircraft), `seatsAllocated`, and seats already
  consumed (derived the same way every other "used" figure in this
  codebase is derived — `COUNT` over real `Booking` rows referencing that
  allotment, never a mutated counter column).
- ⚑ **Explicitly not built this phase**: an agency actually BOOKING a
  customer against its own allotment (a "book on behalf of" flow). The
  user's request was "give agencies API access and put seats at their
  disposal" — read/issue-and-allocate, not a new booking-engine entry
  point. `booking-engine` has zero `agencyId`/`AGENCY`-role awareness
  today; wiring that in is a materially different, larger feature
  (booking-engine changes, its own pricing/commission questions) that
  needs its own docs pass and approval before any code, per workflow
  rule 1 — not silently bundled into this phase.

---

## Phase 17 — customer profile fields + completeness notification

`design-reference/پنل کاربر.dc.html`'s «پروفایل من» tab is a large page
(identity KYC with document + selfie upload, saved bank cards, active
sessions, invite-friends referral, saved passengers) — far bigger than
the user's actual request (a notification when the profile is
incomplete). Per user confirmation, this phase builds ONLY the part that
notification needs to mean something: real identity fields a user can
enter, a completion percentage, and a nudge — not the KYC
document/selfie flow, not bank cards, not active-sessions, not
invite-friends, not saved passengers. Explicit instruction: no selfie
step anywhere in the project.

- `User` gains nullable profile columns, same encrypted-PII pattern
  already used for `ClubMember`/`Passenger` (`*Enc` AES column + `*Hash`
  keyed hash for exact-match lookup, per CLAUDE.md's PII encryption
  rule) — **not** stored on `ClubMember`, because `ClubMember.userId` is
  optional (club membership is a separate, opt-in concept per Phase 5)
  and the design's profile tab is for any logged-in customer, member or
  not:
  ```
  nationalIdEnc    String?
  nationalIdHash   String?
  passportNoEnc    String?
  birthDate        DateTime?
  emailVerifiedAt  DateTime?
  ```
  (`fullName` and `email` already exist on `User`.)
- **Profile completion** is computed server-side, never stored — a
  simple weighted check over which of {fullName, nationalId, birthDate,
  passportNo, emailVerifiedAt} are present, matching the design's
  percentage bar and its "complete passport + verify email" hint text.
- **Email verification**: reuses the existing OTP/2FA delivery
  machinery — a short-lived code sent to the address, confirmed via a
  new endpoint, stamps `emailVerifiedAt`. No new provider.
- **Checkout nudge**: `CheckoutPage` shows a dismissible banner ("تکمیل
  پروفایل" with the completion %) when the logged-in customer's profile
  is incomplete — informational only, never blocks the purchase flow
  (CLAUDE.md: booking/payment must keep working regardless of AI/profile
  state; national ID stays optional at the DTO level exactly as it is
  today — this phase does not make it required to book).
- ⚑ **Explicitly not built this phase**: saved-passengers CRUD, bank
  cards, active-sessions list, invite-friends, and any document/selfie
  upload — all real sections of the same design page, all out of scope
  for a "notify when incomplete" feature. Flagged here so a future phase
  doesn't assume they were silently included.

## Phase 18 — SITE_ADMIN + EMPLOYEE panel access

A full audit found `PANEL_NAV` had no entry at all for `SITE_ADMIN` or
`EMPLOYEE` — both panels rendered an empty sidebar (`getNav` fell through
to `?? []`). User confirmed the "real and complete" fix over the
"narrow/fast" option: widen backend authorization for SITE_ADMIN as
designed (adding a refund review+refer capability), and build genuine
per-employee permission enforcement for EMPLOYEE — not a shortcut that
leaves either panel nearly empty. No schema change; this phase is pure
authorization wiring on top of the `EmployeePermission`/`Permission`
tables that have existed since Phase 8.

**SITE_ADMIN** — `پنل ادمین سایت.dc.html`'s `roleDefs.siteAdmin.access` is
`["dashboard","agencies","flightops","reports","cartable","tickets","blog",
"media","club","refund"]`. Of these, `flightops` (close-flight +
نیرا-manifest-upload), `tickets` (internal support queue), `blog`, and
`media` have **no backend anywhere in the codebase for any role** — not a
SITE_ADMIN-specific gap, so they're excluded from `PANEL_NAV.SITE_ADMIN`
entirely (per this file's own "exclude coded-but-unreachable tabs"
convention) rather than shipped as `implemented:false` dead entries. The
remaining six get real, conservatively-scoped access:
- `agencies` → existing `AgenciesListPage`/`AgencyDetailPage`/
  `RequestDetailPage` (list/detail/requests/refer/reject — all already
  read-only or review-only for this role; **not** suspend, credit,
  settle, or api-key, which stay `SENIOR_MANAGER`/`FINANCE_MANAGER`-only).
- `reports` → existing `PassengerReportsPage` (passenger search).
- `cartable` → existing `CartablePage`, self-scoped to the actor; added
  directly on `CartableController`'s `@Roles(...)` rather than to the
  shared `EXEC_ROLES` constant, since that constant also gates
  `manager-messages`/`staff-directory`, which are **not** in this design's
  access list.
- `club` → existing `ClubPage`, `listMembers` + `issueCard` only (no
  `createMember`, `updateLevel`, or the card-request approve/reject
  queue — those stay CEO/BOARD_CHAIR/SENIOR_MANAGER-only). `issueCard`
  only flips a card-status flag + audits — no ledger/money movement, so
  granting it doesn't cross the "no unjustified financial-write
  expansion" line this phase held to elsewhere.
- `refund` → **new** capability: `list`/`detail`/`refer` on
  `RefundsController`, mirroring the exact "review + refer to a
  specialist, never execute" pattern Phase 16 already established for
  agency requests (`SITE_ADMIN` refers, `COMMERCIAL_MANAGER` alone
  approves). `pay` (the actual payout + ledger reversal) is **never**
  granted to `SITE_ADMIN` — stays `FINANCE_MANAGER`-only.
- `dashboard` → **not** the shared sales/KPI `DashboardPage` (that reads
  real revenue/profit data via `reporting.controller.ts`, which
  `SITE_ADMIN` was deliberately not added to — no financial-data
  expansion beyond what's justified above). Instead a new, narrower
  `SiteAdminDashboardPage` combining the two lists `SITE_ADMIN` already
  has real access to (pending agency requests, refunds awaiting review) —
  a real but simplified v1 of the design's fuller combined-feed widget.

**EMPLOYEE** — `پنل کارمند.dc.html` computes its sidebar per-user:
`navKeys = ["dashboard"].concat(granted).concat(["referrals"])`, where
`granted` is the distinct set of `PERMISSION_CATALOG` section keys the
employee actually holds. This is fundamentally different from every other
role's static `PANEL_NAV` array, so `PanelsService.getNav` is now `async`
and takes the full actor (not just the role): for `role !== 'EMPLOYEE'` it
behaves exactly as before; for `EMPLOYEE` it queries the caller's real
`EmployeePermission` rows and computes the nav dynamically.

A new `EMPLOYEE_SECTION_NAV` map (`panel-nav.config.ts`) pairs each nav
section with the catalog key(s) actually wired to a real endpoint this
phase — an employee only sees a tab if they hold at least one of its
wired keys, so a granted-but-unwired permission never produces a dead
tab:

| section (nav key) | wired catalog keys | real endpoint(s) |
|---|---|---|
| `agencies` | `ag_list`, `ag_requests`, `ag_info` | `GET /agencies`, `GET /agencies/requests(/:id)`, `GET /agencies/:id` |
| `flights` | `fl_view` | `GET /flights/{overview,airports,schedules,:id,:id/fare-rules,:id/allotments}` |
| `pricing` | `pr_propose` | `GET /pricing/proposals`, `PUT /pricing/flights/:id/proposal` |
| `reports` | `rp_sales`, `rp_finance` | `GET /passenger-reports/search` (same tab/endpoint for either dept's report key) |
| `refund` | `rf_list`, `rf_details`, `rf_process` | `GET /refunds`, `GET /refunds/:id`, `PATCH /refunds/:id/refer` |

Enforcement is a new `EmployeePermissionGuard` +
`@RequiresPermission(...keys)` decorator (`src/common/`) — the guard
passes straight through for any non-EMPLOYEE actor (RolesGuard already
fully gates those), so it's safe to add to every widened controller's
`@UseGuards(...)` uniformly. For an EMPLOYEE actor, it 403s unless
`EmployeePermission` has a row matching one of the handler's declared
keys. `refunds.controller.ts` needed per-key granularity rather than a
single per-section check because its three catalog keys are genuinely
different sensitivity levels (`rf_list` list-only, `rf_details` decrypted
PII, `rf_process` refer-only, never `pay`).

⚑ **Deferred, not wired this phase** (documented so a future phase
doesn't assume silent inclusion):
- `fl_manage` (flight create/schedule/plan/aircraft/fare-rule/allotment
  writes) — blanket-granting write access across that many endpoints
  needed more individual review than this phase had time for; only
  `fl_view` (read) is wired.
- `ag_settle` (agency settlement) and `fn_invoices` (invoice
  view/issue/pay) — both real money-movement/financial-document actions;
  left unwired for the same "no unjustified financial-write expansion"
  reason `SITE_ADMIN` was held to.
- The entire `it` dept (`us_manage`, `sv_control`, `sc_manage`, `lg_view`)
  — these would touch `IT_MANAGER`-exclusive controllers (user
  management, service control, security settings, logs) that deserve
  their own dedicated review, not a blanket widen alongside the
  commercial/finance keys above.
- EMPLOYEE's `referrals` tab — `navKeys`'s formula always appends it, but
  `GET /referrals` (`referrals.service.ts`'s `list`) is sender-scoped
  (`SENIOR_MANAGER`'s own outgoing referrals); there's no recipient-side
  "referrals assigned to me" listing, only per-item `detail`/`submitReport`
  access (already granted to EMPLOYEE since referrals were first built).
  Shipping the tab today would be a 403-on-load dead entry, so it's
  omitted from the computed nav until that listing exists.

**Tests**: `test/phase18-panel-access.e2e-spec.ts` (new) covers
SITE_ADMIN's full real-access list + confirms it never gets
suspend/credit/settle/api-key/create-member/update-level/pay; EMPLOYEE
tests use the two permission combinations already in `prisma/seed.ts`
(`sales.moradi`: `ag_list`+`fl_view`; a freshly IT_MANAGER-granted
`rf_list`+`rf_details`+`rf_process` employee; a freshly granted
`pr_propose` employee) to prove per-key granularity, plus one check that
a non-EMPLOYEE role (`FINANCE_MANAGER`) is unaffected by the new guard.
`test/panels.e2e-spec.ts` gained the SITE_ADMIN nav-shape test and the
EMPLOYEE dynamic-nav test (replacing its now-obsolete "EMPLOYEE gets an
empty nav" assertion).

## Phase 19 — مدیریت رزرو (anonymous PNR self-service)

No schema change — reuses `Booking`/`Passenger`/`RefundRequest`/
`RefundPenaltyRule` exactly as Phase 2/7/13 defined them. First item from
the post-Phase-18 "dead forms" punch list; user explicitly chose the
anonymous PNR+last-name lookup model over requiring login, matching
مدیریت رزرو.dc.html and standard airline self-service UX, over the
alternative of reusing the existing authenticated `GET /bookings/pnr/:pnr`
as-is (which would have forced customers to log in just to check a
booking they may have made as a guest during checkout).

- `BookingService` gains a public `getByPnrAndLastName(pnr, lastName)`
  alongside the existing (unchanged) `getByPnr(pnr, user)` — both funnel
  through the same private `toDetail()` shaping, so the anonymous and
  authenticated views can never drift in what fields they expose.
- `RefundsService.submitFromCustomer` (authenticated) and a new
  `submitAnonymous(pnr, lastName, iban)` both call a new shared private
  `createRefundRequest(booking, iban, passengerName)` — the exact same
  `RefundPenaltyRule` lookup, `computePenalty()` call, and
  one-request-per-booking/TICKETED-or-PAID-only guards apply to both
  paths. This was a deliberate refactor (not a copy-paste) specifically
  so a future penalty-rule change can't accidentally apply to only one of
  the two customer-facing refund entry points.
- New shared pure helper `matchesLastName(fullName, lastName)`
  (`backend/src/common/passenger-name.util.ts`) — compares the input
  against the last whitespace-separated token of a passenger's stored
  `fullName`, trimmed. Used by both new anonymous endpoints. A
  false/no-match and a nonexistent PNR return the identical
  `NotFoundException` (message + code) — no timing/response-shape oracle
  that would let an attacker distinguish "wrong last name" from "PNR
  doesn't exist" while brute-forcing PNRs.
- Both new endpoints are public (no `JwtAuthGuard`) and carry the same
  `@Throttle({ limit: 10, ttl: 60_000 })` per-IP rate already used on
  `POST /bookings` — a 6-character alphanumeric PNR (`generatePnr()`) is
  guessable at scale without a rate limit, per CLAUDE.md's "rate limiting
  on... booking and money endpoints" rule.
- No audit-log row on the anonymous path — `AuditService.record`'s
  `actorId` is a required real `User.id`; an anonymous caller has none.
  Same precedent as Phase 16's anonymous agency pre-registration
  (`createPublicRequest`), which also skips the audit call for the same
  reason.

⚑ **Explicitly deferred this phase** (see docs/API.md's Phase 19 section
for the full reasoning): real seat-change and ticket-download actions
(the mock's buttons already had no handler at all — left visibly
disabled rather than built); per-passenger partial refund selection (the
mock's UI, but the real `RefundRequest` model — and every other refund
surface in the app — is 1:1 with `Booking`, never per-passenger).

## Phase 20 — تماس با ما + پشتیبانی (contact + support tickets)

Two new tables, both intentionally kept separate rather than unified
into one "message" model (see docs/API.md's Phase 20 section for the
full reasoning):

```prisma
model ContactMessage {
  id        String   @id @default(uuid())
  name      String
  phone     String
  subject   String
  body      String
  createdAt DateTime @default(now())

  @@index([createdAt])
  @@map("contact_messages")
}

enum SupportTicketDept {
  SITE
  AGENCY
}

enum SupportTicketPriority {
  HIGH
  MEDIUM
  LOW
}

enum SupportTicketStatus {
  OPEN
  IN_PROGRESS
  ANSWERED
  CLOSED
}

model SupportTicket {
  id             String                @id @default(uuid())
  trackingCode   String                @unique
  subject        String
  body           String
  requesterName  String
  requesterPhone String
  userId         String?
  user           User?                 @relation("SupportTicketRequester", fields: [userId], references: [id])
  dept           SupportTicketDept     @default(SITE)
  priority       SupportTicketPriority @default(MEDIUM)
  status         SupportTicketStatus   @default(OPEN)
  forwardedToId  String?
  forwardedTo    User?                 @relation("SupportTicketForwardedTo", fields: [forwardedToId], references: [id])
  history        Json                  @default("[]")
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt

  @@index([status])
  @@index([createdAt])
  @@map("support_tickets")
}
```

- `ContactMessage` — no `userId`/relation at all; it is a pure anonymous
  inbox, never tied to an account even if the sender happens to be logged
  in (the design's own form has no such concept).
- `SupportTicket.userId` is optional and currently always `null` in
  practice — the public submission endpoint is fully unauthenticated (no
  `JwtAuthGuard`), so there is no request-context user to attach. The
  column exists for a future logged-in-submission path, not wired this
  phase.
- `SupportTicket.trackingCode` — generated as `TK` + 8 uppercase hex
  characters (`crypto.randomBytes(4)`), same "no collision-retry loop"
  convention already used by `generatePnr()` (Phase 2/13) — a random
  32-bit space is large enough in practice for this codebase's existing
  precedent.
- `SupportTicket.history: Json` — same append-only event-log pattern
  already established by `RefundRequest.history` (Phase 7) and
  `AgencyMembershipRequest.history` (Phase 16); no separate
  message-thread table this phase (see docs/API.md's deferral list).
- `SupportTicket.dept`/`priority` exist to match the design's admin
  ticket-table columns (`پنل ادمین سایت.dc.html`'s `tkDepts`/
  `tkPriorityOptions`) but are not user-settable on the public form this
  phase — `dept` always defaults to `SITE`, `priority` always defaults to
  `MEDIUM`. Only `status` and `forwardedToId` are mutated by the new
  SITE_ADMIN endpoints.
- `forwardedToId` references `User` (any active staff role via
  `StaffDirectoryService.list()`), not a fixed department table — mirrors
  `RefundRequest.assigneeId`'s existing pattern.
- No new `AuditCategory` enum value — forward/status-change actions log
  under the existing `SYSTEM` category rather than adding a `SUPPORT`
  value for a scoped-down v1 feature.

⚑ **Explicitly deferred this phase** (see docs/API.md's Phase 20 section
for the full reasoning): file attachments and multi-message reply
threads on tickets; a public "track my ticket" status lookup; a
dedicated تماس با ما admin review/reply UI (the new
`SiteAdminDashboardPage.tsx` section is this phase's only admin surface
for it).

## Phase 21 — فراموشی رمز (customer forgot/set password)

No schema change. Reuses `User.passwordHash` (already nullable, already
populated for staff — see the Phase 1 schema) and the existing
`TwoFactorChallenge` row with `purpose: 'CUSTOMER_OTP_LOGIN'` (Phase 2) as
the identity proof for a password reset — no new challenge purpose was
added since proving phone ownership is exactly the same trust level for
login and for reset.

- `POST /auth/set-password` writes `passwordHash` directly with no
  current-password read/compare, unlike `changeOwnPassword` (Phase 12).
  This is intentional and gated by `@Roles('USER')` at the controller —
  see docs/API.md's Phase 21 section for why that role gate is
  security-load-bearing here (it stops a staff/agency token from ever
  reaching this no-current-password-check path).
- `POST /auth/customer/login-password` reads `passwordHash` the same way
  `staffLogin`/`agencyLogin` do, but skips the 2FA challenge step (only
  staff logins require 2FA per CLAUDE.md).

## Phase 22 — وضعیت پرواز (flight status lookup)

No schema change. Reuses `FlightInstance`/`Flight`/`Route`/`Airport`
exactly as they already exist. Confirmed during this phase:
`FlightInstanceStatus` is only `SCHEDULED | DEPARTED | CANCELLED` — there
is no gate/baggage-belt/delay-minutes/terminal column anywhere, which is
why the real `GET /flight-status` response (see docs/API.md's Phase 22
section) omits those four fields the design shows rather than inventing
values for them.

## Phase 23 — وب‌سرویس آژانس (Agency B2B webservice purchase)

New table only — `AgencyApiKey`/`AgencyApiScope`/`AgencyApiKeyStatus`
already existed (Phase 3) and are unchanged.

```prisma
enum AgencyWebserviceRequestStatus {
  PENDING
  APPROVED
  REJECTED
}

model AgencyWebserviceRequest {
  id          String                         @id @default(uuid())
  agencyId    String
  agency      AgencyProfile                  @relation(fields: [agencyId], references: [userId])
  scope       AgencyApiScope
  months      Int
  priceIrr    Int
  note        String?
  status      AgencyWebserviceRequestStatus  @default(PENDING)
  decidedById String?
  decidedBy   User?                          @relation("AgencyWebserviceRequestDecidedBy", fields: [decidedById], references: [id])
  decidedAt   DateTime?
  createdAt   DateTime                       @default(now())

  @@index([agencyId, status])
  @@map("agency_webservice_requests")
}
```

- Mirrors `AgencyCreditRequest`'s shape exactly (Phase 16) — same
  "agency requests, an `AGENCY_TAB_ROLES` staff member decides"
  lifecycle, same conditional-`updateMany` race-guard on decide.
- `priceIrr` is a snapshot computed server-side from a fixed plan catalog
  at request time (see docs/API.md's Phase 23 section) — never
  client-supplied, and never recomputed later even if the catalog price
  were to change, so an already-PENDING request's price stays stable.
- No FK from this table to the `AgencyApiKey` row that approval produces
  — deliberately deferred, see docs/API.md's Phase 23 "Explicit
  deferrals".
- Migration: `20260723160000_phase23_agency_webservice_requests`.

## Phase 24 — پرواز (flightops: sale auto-close + نیرا manifest submission)

One new nullable column — no new table. See docs/API.md's Phase 24
section for the full feature scope and explicit deferrals.

```prisma
model FlightInstance {
  // ...existing fields unchanged...

  // Phase 24: when the real passenger manifest was submitted to سامانه
  // نیرا. Set exactly once, lazily, by the first flightops read after
  // departureAt − now ≤ 5h (see NiraService) — no cron job, same pattern
  // as materializeDepartedInstances/materializeExpiry elsewhere. NULL
  // means "not yet closed" for a SCHEDULED instance; a conditional
  // updateMany on write makes the transition idempotent under concurrent
  // reads.
  niraSubmittedAt DateTime?
}
```

- Deliberately NOT a new `NiraSubmission`/log table: `niraSubmittedAt`
  alone captures the design's full displayed state (done + timestamp, or
  pending) — the design shows no submission history, retry count, or
  failure state to justify a separate table. Contrast with `SmsLog`
  (Phase 14), which exists because SMS sends are frequent, per-message,
  and have a real (if narrow) failure mode; a نیرا submission is
  one-shot-per-flight and the mock provider never fails (see
  `MockNiraProvider`), so a boolean-via-nullable-timestamp is enough.
- No FK/relation change, no new enum, no index added — the existing
  `@@index([departureAt])` already serves the "soonest departure first"
  ordering `GET /flightops` needs.
- Migration: `<timestamp>_phase24_flightops_nira_submitted_at`.

## Phase 25 — حریم خصوصی و داده‌های من (GDPR export/delete UI)

No schema change. Reuses the `User.deletedAt`/`isActive` and
`Passenger.deletedAt`/`nationalIdEnc`/`nationalIdHash`/`mobileEnc` columns
that already existed for this exact purpose (see `deletedAt | DateTime? |
soft delete (GDPR hard-delete flow is separate)` in this file's User
table notes) — `PrivacyService.deleteMyAccount` (unchanged this phase) is
that "separate" flow. This phase only adds a frontend surface for the
already-real `GET /my/privacy/export` / `DELETE /my/privacy/account`
endpoints; see docs/API.md's Phase 25 section for the full read/delete
shape.

## Phase 26 — ارجاعات (EMPLOYEE recipient-side referral listing)

No schema change. `GET /referrals/mine` reads the existing
`ManagerReferral`/`ManagerReferralRecipient`/`ManagerReferralReport`
tables (Phase 4) via the already-indexed `ManagerReferralRecipient
.recipientId` (`@@index([recipientId])`) — no new index needed. See
docs/API.md's Phase 26 section for the full endpoint shape and explicit
scope narrowing.

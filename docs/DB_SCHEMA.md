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

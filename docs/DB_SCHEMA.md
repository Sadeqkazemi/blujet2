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
- `LedgerEntry { id, bookingId→Booking?, type: SALE|REFUND|SETTLEMENT|COMMISSION, signedAmountIrr Int, occurredAt, createdBy→User? }` — double-entry, immutable, append-only; refunds/settlements are new rows, never edits.

Sales-chart/KPI endpoints (`GET /reporting/sales`, etc., Phase 1 API) query
`LedgerEntry` grouped by `Booking.channel` and period — never a client-side
sum, per CLAUDE.md.

---

## Phase 3 — Agencies (credit, settlement, membership)

- `AgencyProfile { userId→User (role=AGENCY) pk, licenseNo, city, address, tier: BRONZE|SILVER|GOLD, joinedAt }`
- `AgencyCreditLine { agencyId→AgencyProfile pk, limitIrr, usedIrr, updatedBy→User, updatedAt }` — `usedIrr` is a read-model kept in sync by `LedgerEntry` triggers/service logic, never hand-edited.
- `AgencyMembershipRequest { id, applicantName, license, city, phone, email, documents Json, status: PENDING|APPROVED|REJECTED, reviewedBy→User?, reviewedAt? }`
- `AgencyApiKey { id, agencyId→AgencyProfile, keyHash, scope: FULL|SEARCH_BOOK|SEARCH_ONLY, status: ACTIVE|SUSPENDED, activatedAt, expiresAt?, lastUsedAt?, callCount Int }`

## Phase 4 — Cartable, referrals, manager messaging

- `CartableTask { id, assigneeId→User, category: ADMIN|AGENCY|MANAGER, title, description, senderId→User, dueAt?, status: OPEN|DONE, resolutionNote?, transferredTo→User?, createdAt }`
- `ManagerReferral { id, fromId→User, toIds User[] (relation table), title, body, priority: HIGH|MEDIUM|LOW, dueAt?, status: SENT|REVIEWING|REPORTED|CLOSED, files Json?, createdAt }`
- `ManagerReferralReport { id, referralId→ManagerReferral, fromId→User, body, files Json?, createdAt }`
- `ManagerMessage { id, fromId→User, toDept: FINANCE|COMMERCIAL|SUPPORT|AGENCIES|CEO|ALL_MANAGERS, subject, body, attachment?, createdAt }`

## Phase 5 — VIP club (loyalty tie-in for manager panels)

Full loyalty ledger (points, tiers, cashback) belongs to the customer-club
feature on the public-site track; the manager-panel slice only needs:
- `ClubCardRequest { id, memberId→User, status: REFERRED|APPROVED|REJECTED, assignedTo: SENIOR_MANAGER|BOARD_CHAIR, cardNo?, history Json[], createdAt }` — approval routes to whichever of the two roles it's `assignedTo`; the other role sees it read-only.

## Phase 6 — Pricing proposals & ticket approval

- `FarePricingProposal { id, flightInstanceId→FlightInstance, competitorPriceIrr, proposedPriceIrr, legalRateIrr?, proposedById→User, status: PENDING|REGISTERED, registeredPriceIrr?, aiSuggestionIrr?, aiReasoning?, registeredAt? }` — commercial manager proposes, CEO approves/registers; matches CLAUDE.md's ML-service advisory-only rule (`aiSuggestionIrr` is never auto-applied).

## Phase 7 — Refunds

- `RefundRequest { id, bookingId→Booking, status: SUBMITTED|REVIEW|FINANCE|PAID|REJECTED, ibanEncrypted, penaltyPct, penaltyAmountIrr, refundableIrr, assigneeId→User?, history Json[], createdAt }` — `PAID` transition creates a `LedgerEntry(type=REFUND)` reversal row; never a field mutation alone (the design mock only calls `updateRefund`, which is not sufficient — flagged explicitly by the extraction agents).

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

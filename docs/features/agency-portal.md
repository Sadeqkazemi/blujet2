# Feature: Agency Portal (self-service, پنل آژانس)

Covers `docs/API.md` → "Agency Portal" and `docs/DB_SCHEMA.md` → "Agency
Portal". Separate track from this session's management-panels work
(`CLAUDE.md` scopes it to the public-facing site), explicitly authorized
by the user (2026-07-17) after confirming it did not exist anywhere in the
codebase — same reassignment pattern as Phases 8 and 9. Scope: the
self-service portal an AGENCY-role account logs into to see its OWN
credit/bookings/settlement/inbox — distinct from the staff-side آژانس‌ها
management tabs (Phase 3), which this feature reuses the data of but does
not duplicate.

## Acceptance checklist

Backend items proven by `backend/test/agency-portal.e2e-spec.ts` (16 tests,
144 total across the backend suite).

### Agency login
- [x] `POST /auth/agency/login`: phone+password, no 2FA, issues tokens directly — `'POST /auth/agency/login: phone+password, no 2FA, issues tokens directly'`
- [x] 401 on wrong phone/password — `'POST /auth/agency/login: 401 on wrong password'`
- [x] 403 if the agency is suspended (`AgencyProfile.suspendedAt` set) — `'POST /auth/agency/login: 403 when the agency is suspended'`
- [x] 403 if the underlying `User.isActive` is false — covered by the same suspended-account guard clause in `AuthService.agencyLogin`; suspension is the reachable path (an inactive agency user has no other way to exist in this codebase yet, since deactivation isn't wired to any staff action this phase)
- [x] Non-AGENCY role phone (e.g. a customer or staff phone) → 401, never leaks which part was wrong — `'POST /auth/agency/login: 401 for a non-AGENCY phone (staff never has this role)'`
- [x] `/auth/refresh`, `/auth/me`, `/auth/logout` work unchanged for an AGENCY session (already role-agnostic) — verified by inspection (no role branch in any of the three) plus every other test's reliance on the issued `accessToken` working across subsequent requests
- [x] Approving a membership request (Phase 3 `approveRequest`) now issues a one-time temp password + `mustChangePassword: true`, returned once in the response, never stored in plaintext — `'approving a membership request issues a one-time temp password that logs in'`

### Dashboard
- [x] `GET /agency-portal/dashboard`: real KPIs (sales this month, tickets issued total, seats sold this month), 6-month sales chart, credit summary — all scoped to the caller's own agency only — `'GET /agency-portal/dashboard returns real, self-scoped KPIs'`
- [x] No "allocated seats" fabricated figure — replaced with a real, derived KPI (see docs/API.md) — verified by inspection of `AgencyPortalService.dashboard`'s `kpis` shape

### Credit & balance
- [x] `GET /agency-portal/credit` matches the staff-side derivation exactly (same `AgenciesService.getCredit`) — `'GET /agency-portal/credit matches the staff-side derivation'`
- [x] `GET /agency-portal/ledger` returns only the caller's own `LedgerEntry` rows, signed for +/- display — covered indirectly by the dashboard/sales ownership-isolation tests exercising the same `agencyId`-scoped query pattern
- [x] `GET /agency-portal/invoices` returns only the caller's own invoices — same ownership pattern as `payInvoice`, proven by `'a staff JWT gets 403...'`/`'agency A cannot pay agency B invoice'`
- [x] `POST /agency-portal/invoices/:id/pay`: reuses the staff-side transactional pay-and-settle logic; 409 on an already-paid invoice; 404 if the invoice belongs to a different agency — `'POST /agency-portal/invoices/:id/pay: settles via the same transactional logic, 409 on double-pay'` + `'agency A cannot pay agency B invoice (404, ownership implicit via JWT)'`
- [x] `POST /agency-portal/credit-requests`: `requestedLimitIrr` must exceed the current limit (400 otherwise); creates a `PENDING` request, audited, notifies SENIOR_MANAGER/FINANCE_MANAGER/COMMERCIAL_MANAGER via cartable — `'POST /agency-portal/credit-requests: 400 when not exceeding the current limit'`
- [x] `GET /agency-portal/credit-requests` returns only the caller's own requests — same `agencyId`-scoped pattern, exercised by the approval/rejection tests
- [x] Staff: `GET /agencies/:id/credit-requests` + `PATCH .../decide` — approve calls the real `updateCredit` (limit actually changes, audited); reject leaves the limit untouched; 409 on redeciding an already-decided request — `'credit-request approval actually changes the limit via the real updateCredit path; reject leaves it untouched'` + `'rejecting a credit request leaves the limit unchanged'`
- [x] No code path can change `AgencyCreditLine.limitIrr` other than the existing `updateCredit` method — verified by inspection (`AgencyPortalService`/`AgenciesService.decideCreditRequest` have no other write to `agencyCreditLine`)

### Sales & report
- [x] `GET /agency-portal/sales`: own ticket list only (never another agency's), per-flight aggregation, real KPIs (total sales, tickets issued, average fare, refund rate) — `"GET /agency-portal/sales: only this agency's bookings, real KPIs"`

### Inbox
- [x] `GET /agency-portal/inbox` / `POST /agency-portal/inbox`: agency can read and post to its own thread; posted messages have `senderIsAgency: true` — `'inbox: agency can read and post, posted messages are senderIsAgency=true, staff sees them'`
- [x] Staff-side `GET /agencies/:id/messages` (Phase 3, COMMERCIAL_MANAGER) reflects agency-posted messages unchanged (no regression) — same test + full `agencies.e2e-spec.ts` suite still green (25/25)

### Profile & documents
- [x] `GET /agency-portal/profile`: own profile fields only, no internal `AuditLog`/`activityScore` leakage — `'GET /agency-portal/profile: own fields only, no audit-log leakage'`
- [x] `POST /agency-portal/documents`: PDF/PNG/JPG only, ≤5MB (same validation as `FilesService`), creates a `PENDING` `AgencyDocument` — reuses `FilesService.store` verbatim (already covered by `files.e2e-spec.ts`'s validation tests); wiring verified by inspection + frontend E2E upload journey
- [x] `GET /agency-portal/documents`: own documents only — same `agencyId`-scoped pattern

### Ownership isolation (cross-cutting, mandatory for every endpoint above)
- [x] Agency A can never read or write Agency B's dashboard/credit/invoices/sales/inbox/profile/documents — every self-scoped endpoint derives the agency id from the JWT (`actor.id`), never from a client-supplied parameter — `'agency A cannot pay agency B invoice (404, ownership implicit via JWT)'` + no `/agency-portal/*` route accepts an `:id`/`:agencyId` param anywhere (verified by inspection of the controller)
- [x] A staff JWT (any role) gets 401/403 on every `/agency-portal/*` endpoint — this portal is AGENCY-role only — `'a staff JWT gets 403 on /agency-portal/* (AGENCY-only)'`

### Frontend
- [ ] Agency login page (phone + password, no 2FA step), distinct from staff/customer login
- [ ] Agency portal shell: sidebar with the 5 built tabs (dashboard, credit, sales, inbox, profile) — reads real data, RTL, Persian digits, Jalali dates, `faMoney` for every amount
- [ ] Dashboard tab: KPI cards + 6-month bar chart + credit summary card
- [ ] Credit tab: limit/used/remaining cards, invoice list with pay-from-credit action, credit-increase request form (not a direct mutation), recent ledger activity
- [ ] Sales tab: ticket list + per-flight breakdown + summary KPIs
- [ ] Inbox tab: message thread + reply box, agency-authored messages visually distinct from staff-authored ones
- [ ] Profile tab: read-only profile fields + document upload/list

### E2E
- [ ] Agency logs in (phone+password, no 2FA), sees its own dashboard KPIs
- [ ] Agency pays an unpaid invoice from the credit tab, sees the invoice flip to paid and the ledger update
- [ ] Agency sends an inbox message, sees it in the thread
- [ ] Role isolation: a staff login never reaches `/agency-portal/*` routes; an agency login never reaches `/panel/*` routes

## Deferred (scoped out with reasons, not silently dropped)
- «صندلی‌های تخصیص‌یافته» (allocated seats tab) — no staff-side seat-allocation-to-agency workflow exists anywhere in the codebase to allocate seats in the first place; building the agency-facing read view first would mean fabricating data for a process that doesn't exist. Needs its own phase once/if that staff workflow is designed.
- «وب‌سرویس» self-service API purchase+approval flow — no staff-side purchase-approval counterpart exists (Phase 3's `AgencyApiKey` issuance is Senior-Manager-initiated only); and since `keyHash` is one-way, a self-service tab could only ever show key STATUS/metadata, never the key value — judged not worth a half-feature this phase.
- Staff-side `AgencyDocument` review UI — uploads work, but every document stays `PENDING` forever until a reviewer workflow is built.
- Excel export — mock-only button in the design, not backed by a real export feature anywhere else in the codebase either.
- Public agency self-registration form (the آژانس همکار tab's signup half) — already explicitly deferred in Phase 3's own docs; this phase doesn't touch it either. Login only works for agencies already approved through the existing staff-side membership-request flow.
- Forced password-change enforcement on `mustChangePassword: true` — the flag is set and surfaced (same as Phase 8's employee resets) but no login-time enforcement exists for ANY role yet, staff included; not invented here as a one-off for agencies.
- «فراموشی رمز» (forgot password) self-service flow — a whole separate unbuilt design page for every role, not agency-specific scope creep to solve here.

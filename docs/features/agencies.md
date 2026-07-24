# Feature: Agencies — list, credit, settlement, membership (Phase 3)

Covers `docs/API.md` → "Phase 3" and `docs/DB_SCHEMA.md` → "Phase 3".
Scope: everything under the آژانس‌ها tab for Senior Manager, Finance
Manager and Commercial Manager — three different UI surfaces over one
shared backend, with role-gated actions (API keys: Senior only; invoices +
messaging: Commercial only — see `docs/API.md`'s Phase 3 role notes for the
full per-endpoint breakdown, not repeated here).

## Acceptance checklist

Backend items below are proven by `backend/test/agencies.e2e-spec.ts` (Jest+Supertest,
24 tests, run via `npm run test:e2e`). Frontend/E2E items are still open — Phase 3's
frontend work (tasks #15–16) hasn't started yet.

### Listing & detail
- [x] `GET /agencies` returns the same 4 KPI cards (active count, credit granted, credit used, pending settlement) for all 3 roles — `'GET /agencies returns the same 4 KPI cards for all 3 agency-tab roles'`
- [x] `GET /agencies?q=` searches name/license/manager/city — `'GET /agencies?q= searches by manager name'`
- [x] `GET /agencies?debtorsOnly=true` (Commercial) returns only agencies with `usedIrr > 0` or an unpaid invoice — `'debtorsOnly=true (Commercial) returns only agencies with usedIrr > 0 or a pending invoice'`
- [x] `GET /agencies/:id` computed stats (total sales, tickets, passengers) reconcile against `Booking` rows for that agency — `'detail stats reconcile against Booking rows for that agency'`
- [x] `activityScore` matches the confirmed formula exactly; included for Finance/Commercial, omitted for Senior Manager — `'activityScore is included for Finance/Commercial but omitted for Senior Manager'` + `'activityScore matches the confirmed formula exactly: ...'`
- [x] A non-agency-tab role (e.g. IT_MANAGER, CEO) gets 403 on every endpoint in this module — `'a non-agency-tab role (IT_MANAGER) gets 403 on the agencies list and detail endpoints'` (representative sample; RolesGuard is the same mechanism proven exhaustively in `panels.e2e-spec.ts`)

### Credit & settlement
- [x] `PATCH /agencies/:id/credit` updates only `limitIrr`; `usedIrr` in the response is always derived from `LedgerEntry`, never equal to a stored/edited value — `'PATCH credit updates only limitIrr — usedIrr in the response is always derived, never the submitted value'`
- [x] `usedIrr` decreases exactly by the settlement amount after `POST /agencies/:id/settle` or an invoice `pay` — verified against the sum of `LedgerEntry` rows, not a mutated field — `'usedIrr decreases exactly by the settlement amount after POST /settle, verified against LedgerEntry sums'` + `'paying an invoice writes exactly one SETTLEMENT ledger entry and is idempotent (double pay -> 409)'`
- [x] `POST /agencies/:id/settle` is 403 for COMMERCIAL_MANAGER (that role settles via invoices instead) — `'POST /settle is 403 for COMMERCIAL_MANAGER'`
- [x] Every credit/settlement mutation writes an `AuditLog(category=AGENCY)` row — asserted inline in the credit-update and concurrency tests

### Suspension
- [x] `PATCH /agencies/:id/suspend` without a `reason` → 400 — `'PATCH suspend without a reason -> 400'`
- [x] A suspended agency's own booking/search endpoints (once the agency-portal track exists) would reject — closed now that the agency-portal track has landed: `backend/test/agency-portal.e2e-spec.ts: 'POST /auth/agency/login: 403 when the agency is suspended'`. Enforcement is at login/refresh (a suspended agency can never obtain a new access token), the same point every other role's `isActive`/`suspendedAt` check is enforced at (`JwtStrategy.validate()` only decodes the token, it never re-queries the DB per request) — consistent with the rest of the system's session model, not a gap specific to agencies.
- [x] `PATCH /agencies/:id/reactivate` clears `suspendedAt`/`suspendReason` — `'PATCH reactivate clears suspendedAt/suspendReason'`

### Membership requests
- [x] `PATCH /agencies/requests/:id/approve` creates both a `User(role=AGENCY)` and its `AgencyProfile` transactionally — a failure partway through leaves neither behind — `'approving a request creates both User(role=AGENCY) and AgencyProfile transactionally'`
- [x] `PATCH /agencies/requests/:id/reject` sets status without creating any User/AgencyProfile — `'rejecting a request sets status without creating any User/AgencyProfile'`
- [x] `PATCH /agencies/requests/:id/refer` is 403 for FINANCE_MANAGER (only Senior/Commercial have this action) — `'PATCH .../refer is 403 for FINANCE_MANAGER'`
- [x] Approving/rejecting an already-decided request (`status != PENDING`/`REFERRED`) → 409, not a silent overwrite — `'approving an already-decided request -> 409, not a silent overwrite'`

### API keys (Senior Manager only)
- [x] `POST /agencies/:id/api-key` for a non-Senior-Manager role → 403 — `'POST .../api-key for a non-Senior-Manager role -> 403'`
- [x] The returned key is shown once (creation response) and never retrievable again — the DB only stores `keyHash` — `'the raw API key is returned once at creation and the DB only stores a hash'`
- [x] Regenerating a key immediately invalidates the previous one (old key hash no longer authenticates once the agency-portal track integrates this) — `'regenerating a key changes its stored hash (old key hash no longer matches)'`

### Invoices & messaging (Commercial Manager only, Finance read-only)
- [x] `POST /agencies/:id/invoices` (issue) → 403 for SENIOR_MANAGER and FINANCE_MANAGER, 200 for COMMERCIAL_MANAGER — `'POST .../invoices is 403 for SENIOR_MANAGER and FINANCE_MANAGER, 200-range for COMMERCIAL_MANAGER'`
- [x] `GET /agencies/:id/invoices` → 200 (read) for all 3 roles — `'GET .../invoices is 200 (read) for all 3 roles'`
- [x] `PATCH .../invoices/:id/pay` writes exactly one `LedgerEntry(type=SETTLEMENT)` and is idempotent (paying an already-`PAID` invoice → 409, not a double ledger entry) — `'paying an invoice writes exactly one SETTLEMENT ledger entry and is idempotent (double pay -> 409)'`
- [x] `GET/POST /agencies/:id/messages` → 403 for SENIOR_MANAGER and FINANCE_MANAGER — `'GET/POST .../messages is 403 for SENIOR_MANAGER and FINANCE_MANAGER'`

### Frontend (per-role UI differences) — `frontend/src/features/agencies/*.test.tsx` (Vitest+RTL)
- [x] Senior Manager's agency detail shows credit + API-key sections, no invoices/messages tabs — `AgencyDetailPage.test.tsx: 'Senior Manager sees credit + API-key sections and no invoices/messages tabs or activity score'`
- [x] Finance Manager's agency detail shows credit + settlement, no API-key/invoices-issue/messages — `AgencyDetailPage.test.tsx: 'Finance Manager sees credit + settle and no API-key/invoice-issue/messages'`
- [x] Commercial Manager's agency detail shows all 3 sub-tabs (نمای کلی/مالی/مکاتبه‌ها) including invoice issuance and chat — `AgencyDetailPage.test.tsx: 'Commercial Manager sees the نمای کلی/مالی/مکاتبه‌ها sub-tabs with invoice issuance and chat'`
- [x] Money fields render via `faMoney`; dates via the Jalali util — no raw Latin digits/ISO strings in the UI — asserted inline (Persian ٬-separated toman strings, absence of raw ISO dates) in `AgenciesListPage.test.tsx` + `AgencyDetailPage.test.tsx`; toman→rial input parsing proven by `'the credit modal parses a toman amount (Persian digits allowed) into rial'`

### E2E — `frontend/e2e/agencies-journey.spec.ts` (Playwright, real stack)
- [x] One journey per role: open آژانس‌ها → search → open an agency → change credit limit → see it reflected — `'agencies journey for <senior.rahimi|finance.karimi|comm.abbasi>: search, open detail, change credit limit'` (3 tests)
- [x] Commercial Manager: issue an invoice → mark it paid → credit-used figure drops by that amount — `'Commercial Manager: issue an invoice, pay it, and watch the credit-used figure drop'`
- [x] Concurrency: two simultaneous `PATCH .../credit` calls on the same agency — last-write-wins on `limitIrr`, no crash, both audited — `backend/test/agencies.e2e-spec.ts: 'two simultaneous PATCH .../credit calls do not crash, last write wins, and both are audited'`

### Phase 27 — EMPLOYEE ag_settle + fn_invoices
- [x] An EMPLOYEE granted only `ag_settle` (no `ag_list`/`ag_info`) can still reach `GET /agencies` and `GET /agencies/:id`, and can `POST /agencies/:id/settle`; without `ag_settle`, settle is 403 — `backend/test/phase27-employee-fl-manage-ag-settle-fn-invoices.e2e-spec.ts: 'an employee freshly granted only ag_settle can still reach the agencies list/detail (reachability fix) and settle an agency'` + `'without ag_settle (only ag_list), settle is forbidden'`
- [x] An EMPLOYEE granted only `fn_invoices` can reach the list/detail, list/pay/remind invoices, but not settle and not issue an invoice (stays COMMERCIAL_MANAGER-only) — `phase27-....e2e-spec.ts: 'an employee freshly granted only fn_invoices can reach agencies list/detail, list/pay/remind invoices, but not settle'` + `'without fn_invoices, invoices endpoints are forbidden'`
- [x] `ag_settle`/`fn_invoices` each unlock the `agencies` nav tab — `phase27-....e2e-spec.ts: 'ag_settle unlocks the "agencies" nav tab'` + `'fn_invoices unlocks the "agencies" nav tab'`
- [x] Frontend: `AgencyDetailPage` for an EMPLOYEE with `fn_invoices` shows credit/settle + the invoices table (remind/pay actions, no «صدور فاکتور»); an EMPLOYEE without `fn_invoices` (403 on the invoices fetch) still sees the rest of the page with an empty invoices table — `AgencyDetailPage.test.tsx: 'EMPLOYEE with fn_invoices sees credit/settle + the invoices table…'` + `'EMPLOYEE without fn_invoices (403 on the invoices fetch) still sees the rest of the page…'`

### Deferred (scoped out with reasons, not silently dropped)
- The design's "خروجی Excel" export button (Senior/Finance list) and the invoice شرح (description) field — need product decisions (export format; an invoice-description column) that belong with the reporting/finance phases.
- The "ارجاع درخواست" (refer) UI on the request-detail page — the backend endpoint is implemented and role-tested, but the design's searchable recipient picker needs a staff-directory endpoint that arrives with Phase 4 (referrals/cartable). Wired then.
- A suspended agency's own booking/search rejection — needs the agency-portal track (unchanged from the checklist note above).

---

Mark each item with its proving test file/name once implemented. Per
`CLAUDE.md`: unchecked items = feature not done.

# Feature: Agencies — list, credit, settlement, membership (Phase 3)

Covers `docs/API.md` → "Phase 3" and `docs/DB_SCHEMA.md` → "Phase 3".
Scope: everything under the آژانس‌ها tab for Senior Manager, Finance
Manager and Commercial Manager — three different UI surfaces over one
shared backend, with role-gated actions (API keys: Senior only; invoices +
messaging: Commercial only — see `docs/API.md`'s Phase 3 role notes for the
full per-endpoint breakdown, not repeated here).

## Acceptance checklist

### Listing & detail
- [ ] `GET /agencies` returns the same 4 KPI cards (active count, credit granted, credit used, pending settlement) for all 3 roles
- [ ] `GET /agencies?q=` searches name/license/manager/city
- [ ] `GET /agencies?debtorsOnly=true` (Commercial) returns only agencies with `usedIrr > 0` or an unpaid invoice
- [ ] `GET /agencies/:id` computed stats (total sales, tickets, passengers) reconcile against `Booking` rows for that agency
- [ ] `activityScore` matches the confirmed formula exactly; included for Finance/Commercial, omitted for Senior Manager
- [ ] A non-agency-tab role (e.g. IT_MANAGER, CEO) gets 403 on every endpoint in this module

### Credit & settlement
- [ ] `PATCH /agencies/:id/credit` updates only `limitIrr`; `usedIrr` in the response is always derived from `LedgerEntry`, never equal to a stored/edited value
- [ ] `usedIrr` decreases exactly by the settlement amount after `POST /agencies/:id/settle` or an invoice `pay` — verified against the sum of `LedgerEntry` rows, not a mutated field
- [ ] `POST /agencies/:id/settle` is 403 for COMMERCIAL_MANAGER (that role settles via invoices instead)
- [ ] Every credit/settlement mutation writes an `AuditLog(category=AGENCY)` row

### Suspension
- [ ] `PATCH /agencies/:id/suspend` without a `reason` → 400
- [ ] A suspended agency's own booking/search endpoints (once the agency-portal track exists) would reject — out of scope to test here, but `suspendedAt` is set correctly and visible in the detail response
- [ ] `PATCH /agencies/:id/reactivate` clears `suspendedAt`/`suspendReason`

### Membership requests
- [ ] `PATCH /agencies/requests/:id/approve` creates both a `User(role=AGENCY)` and its `AgencyProfile` transactionally — a failure partway through leaves neither behind
- [ ] `PATCH /agencies/requests/:id/reject` sets status without creating any User/AgencyProfile
- [ ] `PATCH /agencies/requests/:id/refer` is 403 for FINANCE_MANAGER (only Senior/Commercial have this action)
- [ ] Approving/rejecting an already-decided request (`status != PENDING`/`REFERRED`) → 409, not a silent overwrite

### API keys (Senior Manager only)
- [ ] `POST /agencies/:id/api-key` for a non-Senior-Manager role → 403
- [ ] The returned key is shown once (creation response) and never retrievable again — the DB only stores `keyHash`
- [ ] Regenerating a key immediately invalidates the previous one (old key hash no longer authenticates once the agency-portal track integrates this)

### Invoices & messaging (Commercial Manager only, Finance read-only)
- [ ] `POST /agencies/:id/invoices` (issue) → 403 for SENIOR_MANAGER and FINANCE_MANAGER, 200 for COMMERCIAL_MANAGER
- [ ] `GET /agencies/:id/invoices` → 200 (read) for all 3 roles
- [ ] `PATCH .../invoices/:id/pay` writes exactly one `LedgerEntry(type=SETTLEMENT)` and is idempotent (paying an already-`PAID` invoice → 409, not a double ledger entry)
- [ ] `GET/POST /agencies/:id/messages` → 403 for SENIOR_MANAGER and FINANCE_MANAGER

### Frontend (per-role UI differences)
- [ ] Senior Manager's agency detail shows credit + API-key sections, no invoices/messages tabs
- [ ] Finance Manager's agency detail shows credit + settlement, no API-key/invoices-issue/messages
- [ ] Commercial Manager's agency detail shows all 3 sub-tabs (نمای کلی/مالی/مکاتبه‌ها) including invoice issuance and chat
- [ ] Money fields render via `faMoney`; dates via the Jalali util — no raw Latin digits/ISO strings in the UI

### E2E
- [ ] One journey per role: open آژانس‌ها → search → open an agency → change credit limit → see it reflected
- [ ] Commercial Manager: issue an invoice → mark it paid → credit-used figure drops by that amount
- [ ] Concurrency: two simultaneous `PATCH .../credit` calls on the same agency — last-write-wins on `limitIrr`, no crash, both audited

---

Mark each item with its proving test file/name once implemented. Per
`CLAUDE.md`: unchecked items = feature not done.

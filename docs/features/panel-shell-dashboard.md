# Feature: staff auth + panel shell + dashboard/reporting (Phase 1)

Covers the endpoints in `docs/API.md` → "Phase 1" and the data model in
`docs/DB_SCHEMA.md` → "Phase 1". Scope: the shared shell + dashboard/finance
tab used identically by CEO, Board Chair, Senior Manager, Finance Manager,
Commercial Manager and IT Manager panels. Role-specific tabs beyond the
dashboard (Agencies, Cartable, VIP Club, Pricing, Refunds, Employee
management, Reservation) are later phases — not in scope here.

## Acceptance checklist

### Staff auth
- [ ] Login with correct username/password → 2FA challenge issued, no token yet
- [ ] Login with wrong password → `INVALID_CREDENTIALS`, 401, no challenge issued
- [ ] Login for a suspended account (`isActive=false`) → `ACCOUNT_SUSPENDED`, 403
- [ ] 2FA verify with correct code → access token + refresh cookie issued
- [ ] 2FA verify with wrong code → `TWO_FACTOR_INVALID`, attempts counter increments
- [ ] 2FA code expires after 2 minutes → `TWO_FACTOR_EXPIRED`
- [ ] 2FA code is single-use (replay fails)
- [ ] Rate limiting: N failed logins per phone/IP within window → `RATE_LIMITED`
- [ ] `/auth/refresh` rotates the refresh token; old one is rejected on reuse
- [ ] `/auth/logout` revokes the refresh token; subsequent refresh fails
- [ ] Passwords stored as argon2 hashes only — verified by inspecting the DB row in a test, never a plaintext compare (contra the design mock)

### RBAC / panel shell
- [ ] `/auth/me` returns the correct `role` for each of the 6 seeded manager accounts
- [ ] `/panels/nav` returns exactly the tab set confirmed per role from the design extraction (e.g. Finance Manager: dashboard/agencies/reports/staff/finance/refund/cartable — flights/admins/settings excluded)
- [ ] A request to a role-restricted endpoint from the wrong role → 403 `FORBIDDEN`, never a 200 with filtered data
- [ ] Frontend hides nav items the role can't see, but the backend independently rejects the request even if a client bypasses the UI (test hits the endpoint directly with a mismatched role's token)
- [ ] CEO/Senior Manager can toggle `PanelAccessFlag` for sibling panels; a toggled-off panel's endpoints return 403 for everyone with that role except the toggling role itself
- [ ] Toggling a panel access flag writes an `AuditLog(category=ACCESS)` row

### Reporting (sales chart / KPIs / completed-flights / low-sales alert)
- [ ] `/reporting/sales-chart?granularity=q6` returns 6 periods, each summing to the same total as the underlying `LedgerEntry` rows (no double-count across channels)
- [ ] `/reporting/sales-chart?granularity=month&month=4` (Jalali month index) returns daily bars for that month only
- [ ] `/reporting/sales-chart?granularity=flight&flightNo=EP-821` returns that flight's own sales only
- [ ] `/reporting/kpis?periodKey=<bar>` re-scopes `revenueIrr`/`profitIrr`/`operatingCostIrr` to the selected bar; omitting `periodKey` returns the full-range total
- [ ] `kpis.marginPct` = `round(profitIrr / revenueIrr * 100)`, never a hardcoded/static value (contra the design mock's hardcoded trend badges)
- [ ] `/reporting/completed-flights-summary` seat counts reconcile: `soldSeats + unsoldSeats === totalSeats`
- [ ] `/reporting/low-sales-alerts` only returns flights within 72h with occupancy below the configured threshold — verified with a seeded flight just inside and just outside the window
- [ ] All aggregates are computed in SQL (verified by checking the service has no in-memory `.reduce()` over full row sets pulled to Node)
- [ ] Money in every response is an integer IRR value; frontend applies `faMoney`/`faDigits` — no pre-formatted strings from the API (contra the design mock's `"۸۲٫۴ میلیارد"` display strings)

### Manager activity / audit feed
- [ ] `/audit/manager-reports` as CEO excludes rows where `actorRole` is CEO, SENIOR_MANAGER or BOARD_CHAIR
- [ ] `/audit/manager-reports` as BOARD_CHAIR or SENIOR_MANAGER returns all roles' rows, unfiltered
- [ ] `/audit/logs` as IT_MANAGER only returns `category=SYSTEM` + account-management rows
- [ ] A non-IT/CEO/Senior/Chair role gets 403 on both endpoints

### Frontend (Vitest + RTL)
- [ ] Login form renders RTL, Persian labels, inline Persian validation errors
- [ ] 2FA step renders after successful password submit, not before
- [ ] Sidebar nav renders only the tabs `/panels/nav` returned, in the confirmed order, with Persian labels matching the design
- [ ] KPI cards render Persian digits (`faDigits`) and تومان formatting (`faMoney`) — never raw Latin-digit numbers
- [ ] Sales chart mode switch (روزانه/ماهانه/۳ ماهه/۶ ماهه/سالانه/شماره پرواز) re-fetches with the right `granularity` param
- [ ] Dashboard loading/error/empty states render (no data yet, API error, slow network)

### E2E (Playwright)
- [ ] Full staff login journey (password → 2FA → dashboard) for one seeded account per role, landing on that role's dashboard with only its permitted tabs visible
- [ ] Visual check: dashboard KPI row + sales chart match `design-reference/پنل مدیر مالی.dc.html` layout (colors, spacing, RTL)
- [ ] Concurrency: two simultaneous `/panels/access` toggles on the same panel key from two CEO sessions — last-write-wins with no crash, both audit rows recorded

---

Mark each item with its proving test file/name once implemented. Per
`CLAUDE.md`: unchecked items = feature not done.

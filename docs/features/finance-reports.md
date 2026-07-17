# Feature: Phase 11 — مالی tab, گزارش مسافران, گزارش کارمندان

Covers `docs/API.md` → "Phase 11" and `docs/DB_SCHEMA.md` → "Phase 11"
(no schema changes — all derived data). Tabs unlocked this phase:
- مالی: CEO, BOARD_CHAIR, SENIOR_MANAGER (analytic view) +
  FINANCE_MANAGER (finance-ops view) + COMMERCIAL_MANAGER (analytic view)
- گزارش مسافران (`reports`): SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER
- گزارش کارمندان (`staff`): FINANCE_MANAGER, COMMERCIAL_MANAGER

## Acceptance checklist

Backend items proven by `backend/test/finance-reports.e2e-spec.ts` (10
tests, 169 total); frontend by the three new `*.test.tsx` files (5 tests,
85 total); E2E by `frontend/e2e/finance-reports-journey.spec.ts` (5
journeys).

### Backend — reporting additions
- [x] `GET /reporting/recent-transactions` (FINANCE_MANAGER only, 403 others): latest ledger rows with real party labels, newest first — `'GET /reporting/recent-transactions: finance manager gets real ledger rows with party labels; other roles 403'`
- [x] `GET /reporting/revenue-mix`: per-channel SALE sums + pct; respects the same period params as `/reporting/kpis` — `'GET /reporting/revenue-mix: per-channel sums add up to the total, pcts computed'`
- [x] `GET /reporting/agency-settlements` (FINANCE_MANAGER only): per-agency paid ratio + status derived from Phase 3 invoices — `'GET /reporting/agency-settlements: per-agency paid ratio + status from real invoices; finance only'`
- [x] FINANCE_MANAGER may now trigger the Phase 3 invoice remind (design shows the action in its settlements rows) — `'FINANCE_MANAGER can now trigger the Phase 3 invoice remind (design: settlements row action)'`
- [x] `GET /passenger-reports/search`: name-substring and exact-national-ID (hash) search; national ID masked in every response; 403 for roles without the tab — `'…name search returns ticket details; national ID always masked'` + `'…a 10-digit query matches by national-ID hash exactly'` + `'passenger reports: roles without the tab (CEO, IT) get 403'`
- [x] `GET /staff-reports`: only EMPLOYEE users of the caller's dept; audit-feed rows real; `staffId` filter; dept isolation — `'GET /staff-reports: finance manager sees only finance-dept employees and their real audit feed'` + `'GET /staff-reports?staffId= filters to one employee; a foreign-dept staffId yields an empty feed'` + `'staff reports: roles without the tab (SENIOR_MANAGER) get 403'`
- [x] New-employee banner rows come from real `AuditLog(category=ACCOUNT)` events — verified by inspection of `StaffReportsService.reports` (query filters `category: 'ACCOUNT', entityType: 'User'`) + the frontend banner test below

### Frontend — مالی tab
- [x] Analytic view (CEO/Chair/Senior/Commercial): sales chart with mode switcher, channel sum tiles, completed-flights box, «ترکیب درآمد» donut — `FinancePage.test.tsx`: `'CEO gets the analytic view: sales chart + revenue mix, no transactions/settlements'` (mode switcher ships the three granularities the shared `SalesBarChart` already supports — روز/ماه/پرواز stay deferred exactly as Phase 1's dashboard deferred them, one shared limitation, not a new one)
- [x] Finance-ops view (FINANCE_MANAGER): KPI row, low-sales alert, completed-flights box, transactions list, donut, settlements rows with paid-ratio bars and «ارسال یادآوری» wired to the real Phase 3 remind endpoint — `'FINANCE_MANAGER gets the finance-ops view: transactions, settlements, remind action'`
- [x] nav flags flipped to `implemented: true` for `finance` in all 5 roles — E2E journeys click the real nav link

### Frontend — گزارش مسافران
- [x] Search box + result card with the design's no-result state — `PassengerReportsPage.test.tsx`: `'searches and shows the ticket detail card with a masked national ID'` + `'shows the design no-result state'`
- [x] nav flag flipped for `reports` (Senior/Finance/Commercial) — E2E journey

### Frontend — گزارش کارمندان
- [x] Per-employee tabs, report cards, empty state, new-employee banner — `StaffReportsPage.test.tsx`: `'renders the staff tabs, real audit feed, and the new-employee banner; filters by employee'`
- [x] nav flag flipped for `staff` (Finance/Commercial) — E2E journey

### Tests
- [x] Backend: role isolation (403s), masked PII, dept isolation, settlement-status derivation, revenue-mix sums vs seeded ledger — the 10 tests above
- [x] Frontend: unit tests per new page — 5 tests above
- [x] Playwright: `'Finance Manager opens مالی and sees real transactions, revenue mix, and agency settlements'`, `'CEO opens مالی and gets the analytic view (no finance-ops sections)'`, `'Senior searches گزارش مسافران and sees the ticket card with a masked national ID'`, `'Finance Manager sees گزارش کارمندان with only its own dept employees'`, `'Role isolation: CEO has no گزارش مسافران/گزارش کارمندان nav entries'`

## Deferred (scoped out with reasons, not silently dropped)
- Excel/PDF export buttons — mock-only toasts in the design, consistent with every prior phase's deferral.
- The finance mock's `finMonths` income/expense chart — computed in the mock script but never rendered in any panel's markup (orphaned).
- «علامت‌گذاری به‌عنوان خوانده‌شده» persistence for the new-employee banner — client-side state in the mock, kept client-side.

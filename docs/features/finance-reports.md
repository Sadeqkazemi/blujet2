# Feature: Phase 11 — مالی tab, گزارش مسافران, گزارش کارمندان

Covers `docs/API.md` → "Phase 11" and `docs/DB_SCHEMA.md` → "Phase 11"
(no schema changes — all derived data). Tabs unlocked this phase:
- مالی: CEO, BOARD_CHAIR, SENIOR_MANAGER (analytic view) +
  FINANCE_MANAGER (finance-ops view) + COMMERCIAL_MANAGER (analytic view)
- گزارش مسافران (`reports`): SENIOR_MANAGER, FINANCE_MANAGER, COMMERCIAL_MANAGER
- گزارش کارمندان (`staff`): FINANCE_MANAGER, COMMERCIAL_MANAGER

## Acceptance checklist

### Backend — reporting additions
- [ ] `GET /reporting/recent-transactions` (FINANCE_MANAGER only, 403 others): latest ledger rows with real party labels, newest first
- [ ] `GET /reporting/revenue-mix`: per-channel SALE sums + pct; respects the same period params as `/reporting/kpis`
- [ ] `GET /reporting/agency-settlements` (FINANCE_MANAGER only): per-agency paid ratio + status (تسویه شد/در انتظار پرداخت/معوق with overdue days) derived from Phase 3 invoices; total outstanding matches `/agencies` debt figures
- [ ] `GET /passenger-reports/search`: name-substring and exact-national-ID (hash) search; national ID masked in every response; 403 for roles without the tab
- [ ] `GET /staff-reports`: only EMPLOYEE users of the caller's dept; audit-feed rows real; `staffId` filter; dept isolation (finance manager never sees commercial dept employees and vice versa)
- [ ] New-employee banner rows come from real `AuditLog(category=ACCOUNT)` events

### Frontend — مالی tab
- [ ] Analytic view (CEO/Chair/Senior/Commercial): sales chart with mode switcher (روز/ماه/۳ماهه/۶ماهه/سال/پرواز) reusing the Phase 1 dashboard components, channel sum tiles, completed-flights box, «ترکیب درآمد» donut
- [ ] Finance-ops view (FINANCE_MANAGER): KPI row (reusing `/reporting/kpis` figures), low-sales alert, completed-flights box, «تراکنش‌های مالی اخیر» list with typed icons/colors and signed amounts via `faMoney`, «ترکیب درآمد» donut, «تسویه‌حساب آژانس‌ها» rows with paid-ratio bars and «ارسال یادآوری» wired to the real Phase 3 remind endpoint
- [ ] nav flags flipped to `implemented: true` for `finance` in all 5 roles

### Frontend — گزارش مسافران
- [ ] Search box + result card (PNR, flight no, route, airline, Jalali date, time, seat/class, amount, status) with the design's no-result state
- [ ] nav flag flipped for `reports` (Senior/Finance/Commercial)

### Frontend — گزارش کارمندان
- [ ] Per-employee tabs (همه + one per dept employee), report cards (action, category chip, detail, staff name, time), empty state, new-employee banner
- [ ] nav flag flipped for `staff` (Finance/Commercial)

### Tests
- [ ] Backend: role isolation (403s), masked PII, dept isolation, settlement-status derivation, revenue-mix sums vs seeded ledger
- [ ] Frontend: unit tests per new page (real-shaped Persian/Jalali data, loading/empty states)
- [ ] Playwright: finance manager opens مالی and sees transactions + settlements; a passenger search round-trip; staff-reports tab isolation

## Deferred (scoped out with reasons, not silently dropped)
- Excel/PDF export buttons — mock-only toasts in the design, consistent with every prior phase's deferral.
- The finance mock's `finMonths` income/expense chart — computed in the mock script but never rendered in any panel's markup (orphaned).
- «علامت‌گذاری به‌عنوان خوانده‌شده» persistence for the new-employee banner — client-side state in the mock, kept client-side.

# Feature: Finance tab + passenger & staff reports (Phase 11)

Covers `docs/API.md` → "Phase 11" and `docs/DB_SCHEMA.md` → "Phase 11".
Scope: the مالی tab (5 panels), گزارش مسافران (3 panels), گزارش کارمندان
(2 panels). Design sources: FINANCE/showReports/showStaff sections of the
panel exports; «تراکنش‌ها» و «تسویه آژانس‌ها» فقط پنل مدیر مالی (CLAUDE.md).

## Acceptance checklist

### Backend — finance summary & chart modes
- [x] `GET /finance/summary` KPI row computed in SQL from the ledger: کل درآمد (SALE), هزینه عملیاتی (OPERATING_COST seeded rows), سود خالص = درآمد − استرداد − کمیسیون − هزینه (+ حاشیه ٪), مطالبات معوق = derived agency debt — all reconcile with raw ledger sums
      — backend/test/finance-reports.e2e-spec.ts › "finance summary KPIs reconcile with raw ledger sums; the donut percentages come from SALE channels"
- [x] `period` param re-scopes the KPI row + donut + seats summary (year / YYYY-MM / YYYY-MM-DD) — the design's «کل درآمد · {دوره}» caption behavior
      — finance-reports.e2e-spec.ts › "KPI re-scoping: a single periodKey returns a subset of the full-range revenue and its own cost figure" (⚑ implemented via the existing granularity/periodKey params, not a new `period=` string — see docs/API.md note)
- [x] «ترکیب درآمد» donut: SALE sums grouped by Booking.channel with percentages summing to ۱۰۰٪
      — finance-reports.e2e-spec.ts (donut assertions) + frontend/src/features/finance/FinancePage.test.tsx › "renders the KPI cards… and donut with percentages"
- [x] Completed-flights seats summary (پرواز / مجموع صندلی / فروخته / فروش‌نرفته) consistent with DEPARTED instances + bookings
      — finance-reports.e2e-spec.ts › "finance summary KPIs reconcile…" (seats assertions)
- [x] sales-chart `mode=month` returns month buckets + selecting a month returns its daily buckets; `mode=day` returns the گزارش فروش روز split; `mode=flight` returns per-flight financial cards filtered by `flightQ`
      — frontend/e2e/finance-reports-journey.spec.ts › "ماه mode re-scopes KPIs…"; FinancePage.test.tsx › "روز mode validates the Jalali date and shows the day report box" (⚑ month/day/flight granularities pre-existed from Phase 1 — this phase is the first UI to exercise them end-to-end)
- [x] مالی endpoints 403 for roles without the tab (IT_MANAGER)
      — finance-reports.e2e-spec.ts › "report role isolation: … IT gets 403 on مالی"; finance-reports-journey.spec.ts › "IT Manager has no مالی nav entry"

### Backend — finance-manager-only surfaces
- [x] `GET /finance/transactions` returns recent ledger rows typed فروش/تسویه/کمیسیون/استرداد/عملیاتی with party labels; 403 for the four executive roles (CLAUDE.md: only the finance manager panel has this block)
      — finance-reports.e2e-spec.ts › "transactions & settlements are finance-manager-only (403 for executives, per the design role rule)"
- [x] `GET /finance/settlements` maps AgencyInvoice state to the design's تسویه شد / در انتظار پرداخت / معوق rows with paid % and due dates; 403 for non-finance
      — finance-reports.e2e-spec.ts › "settlements map real invoice state (SETTLED/PENDING/OVERDUE) and the outstanding total reconciles"
- [x] `POST /finance/settlements/:invoiceId/remind` sends via the SmsProvider mock, audited; 404 for unknown invoice
      — finance-reports.e2e-spec.ts › "remind: audited for a real invoice, 404 for an unknown one"

### Backend — reports
- [x] `GET /reports/passengers?q=` finds by name contains AND by exact national-ID (via hash — never decrypting for search); returns the design's ticket card fields + quick names; empty result stays 200 with an empty list
      — finance-reports.e2e-spec.ts › "passenger report finds by name AND by exact national ID via the hash…"
- [x] Passenger report 403 for CEO/BOARD_CHAIR/IT (only the 3 panels with the tab)
      — finance-reports.e2e-spec.ts › "report role isolation: CEO gets 403 on passengers…"
- [x] `GET /reports/staff` groups AuditLog rows by EMPLOYEE actors with category chips + the IT-notice rows (ACCOUNT category); 403 for roles without the tab
      — finance-reports.e2e-spec.ts › "staff report groups audit rows by EMPLOYEE actors and surfaces IT ACCOUNT notices" + "…senior gets 403 on staff"

### Frontend
- [x] مالی tab (shared component, role-aware): sales chart with سال/ماه/روز/پرواز mode pills, month chips → KPI re-scope, روز calendar + گزارش فروش روز box, پرواز search cards; KPI row; seats summary; donut with legend
      — FinancePage.test.tsx › "renders the KPI cards…", "switching to ماه mode…", "روز mode validates…"
- [x] Finance manager additionally sees تراکنش‌های مالی اخیر + تسویه‌حساب آژانس‌ها (with «ارسال یادآوری» buttons + low-sales alert banner reused from Phase 1's endpoint); executives do NOT see those blocks
      — FinancePage.test.tsx › "an executive does NOT see the finance-manager-only blocks" + "the finance manager sees transactions + settlements and can send a reminder"
- [x] گزارش مسافران page: search box + quick chips + result card (LTR mono PNR/flightNo, Jalali date, amount in toman) + «مسافری با این نام یافت نشد.» empty state
      — frontend/src/features/reports/ReportsPages.test.tsx › "PassengerReportPage › searches and renders the ticket card…"
- [x] گزارش کارمندان page: per-employee tabs, report cards with category pills, the IT new-employee banner with «علامت‌گذاری به‌عنوان خوانده‌شده» (client-side dismissal)
      — ReportsPages.test.tsx › "StaffReportPage › renders the IT notice banner (dismissible), per-employee tabs and filtered reports"
- [x] faMoney/faDigits/Jalali everywhere
      — asserted throughout FinancePage.test.tsx/ReportsPages.test.tsx; fixed a real Jalali-locale bug found while writing these tests (see note below)

### E2E
- [x] Journey: finance manager opens مالی → switches to ماه mode → picks a month → KPI caption re-scopes → sees transactions + settlements and sends a reminder
      — frontend/e2e/finance-reports-journey.spec.ts › "finance manager: مالی tab in ماه mode re-scopes KPIs…"
- [x] Journey: an executive (CEO) opens مالی → chart + KPIs render, transactions/settlements blocks absent (role isolation inside the tab)
      — finance-reports-journey.spec.ts › "an executive (CEO) sees the chart + KPIs on مالی but not the finance-manager-only blocks"
- [x] Journey: passenger search finds a seeded passenger and shows the ticket card; staff report renders an employee's audit rows
      — finance-reports-journey.spec.ts › "passenger search finds a seeded passenger…" + "staff report renders an employee's real audit rows…"
- [x] Role isolation: IT_MANAGER has no مالی nav entry
      — finance-reports-journey.spec.ts › "IT Manager has no مالی nav entry (role isolation)"

### Deferred (explicit)
- Excel/PDF export buttons (same deferral as Phases 3/10)
- Finance-entered operating-cost CRUD (seeded rows only this phase)


### Notable fixes made while implementing this phase
- Corrected the profit formula in `reporting.service.ts` (سود خالص = درآمد − استرداد − کمیسیون − هزینه عملیاتی). The pre-Phase-11 calc lumped SETTLEMENT (an agency debt *payment*, cash in) into "cost" — a bug predating this phase, fixed here since Phase 11 is the first real consumer of the profit figure.
- `src/lib/jalali.ts` had no Persian locale registered, so `.format('MMMM…')` (first exercised by this phase's month chips) rendered English month names ("Khordaad") instead of Persian ("خرداد"). Fixed globally via `dayjs.locale('fa')` + a new `formatJalaliMonthYear` helper.
- Added Phase 11 seed rows for EMPLOYEE-actor `AuditLog` entries — no prior phase's endpoints let an EMPLOYEE actor log an action, so گزارش کارمندان would always be empty in a fresh dev DB without them (CLAUDE.md requires realistic seed data per domain).

---

Mark each item with its proving test file/name once implemented. Per
`CLAUDE.md`: unchecked items = feature not done.

# Feature: Finance tab + passenger & staff reports (Phase 11)

Covers `docs/API.md` → "Phase 11" and `docs/DB_SCHEMA.md` → "Phase 11".
Scope: the مالی tab (5 panels), گزارش مسافران (3 panels), گزارش کارمندان
(2 panels). Design sources: FINANCE/showReports/showStaff sections of the
panel exports; «تراکنش‌ها» و «تسویه آژانس‌ها» فقط پنل مدیر مالی (CLAUDE.md).

## Acceptance checklist

### Backend — finance summary & chart modes
- [ ] `GET /finance/summary` KPI row computed in SQL from the ledger: کل درآمد (SALE), هزینه عملیاتی (OPERATING_COST seeded rows), سود خالص = درآمد − استرداد − کمیسیون − هزینه (+ حاشیه ٪), مطالبات معوق = derived agency debt — all reconcile with raw ledger sums
- [ ] `period` param re-scopes the KPI row + donut + seats summary (year / YYYY-MM / YYYY-MM-DD) — the design's «کل درآمد · {دوره}» caption behavior
- [ ] «ترکیب درآمد» donut: SALE sums grouped by Booking.channel with percentages summing to ۱۰۰٪
- [ ] Completed-flights seats summary (پرواز / مجموع صندلی / فروخته / فروش‌نرفته) consistent with DEPARTED instances + bookings
- [ ] sales-chart `mode=month` returns month buckets + selecting a month returns its daily buckets; `mode=day` returns the گزارش فروش روز split; `mode=flight` returns per-flight financial cards filtered by `flightQ`
- [ ] مالی endpoints 403 for roles without the tab (IT_MANAGER)

### Backend — finance-manager-only surfaces
- [ ] `GET /finance/transactions` returns recent ledger rows typed فروش/تسویه/کمیسیون/استرداد/عملیاتی with party labels; 403 for the four executive roles (CLAUDE.md: only the finance manager panel has this block)
- [ ] `GET /finance/settlements` maps AgencyInvoice state to the design's تسویه شد / در انتظار پرداخت / معوق rows with paid % and due dates; 403 for non-finance
- [ ] `POST /finance/settlements/:invoiceId/remind` sends via the SmsProvider mock, audited; 404 for unknown invoice

### Backend — reports
- [ ] `GET /reports/passengers?q=` finds by name contains AND by exact national-ID (via hash — never decrypting for search); returns the design's ticket card fields + quick names; empty result stays 200 with an empty list
- [ ] Passenger report 403 for CEO/BOARD_CHAIR/IT (only the 3 panels with the tab)
- [ ] `GET /reports/staff` groups AuditLog rows by EMPLOYEE actors with category chips + the IT-notice rows (ACCOUNT category); 403 for roles without the tab

### Frontend
- [ ] مالی tab (shared component, role-aware): sales chart with سال/ماه/روز/پرواز mode pills, month chips → KPI re-scope, روز calendar + گزارش فروش روز box, پرواز search cards; KPI row; seats summary; donut with legend
- [ ] Finance manager additionally sees تراکنش‌های مالی اخیر + تسویه‌حساب آژانس‌ها (with «ارسال یادآوری» buttons + low-sales alert banner reused from Phase 1's endpoint); executives do NOT see those blocks
- [ ] گزارش مسافران page: search box + quick chips + result card (LTR mono PNR/flightNo, Jalali date, amount in toman) + «مسافری با این نام یافت نشد.» empty state
- [ ] گزارش کارمندان page: per-employee tabs, report cards with category pills, the IT new-employee banner with «علامت‌گذاری به‌عنوان خوانده‌شده» (client-side dismissal)
- [ ] faMoney/faDigits/Jalali everywhere

### E2E
- [ ] Journey: finance manager opens مالی → switches to ماه mode → picks a month → KPI caption re-scopes → sees transactions + settlements and sends a reminder
- [ ] Journey: an executive (CEO) opens مالی → chart + KPIs render, transactions/settlements blocks absent (role isolation inside the tab)
- [ ] Journey: passenger search finds a seeded passenger and shows the ticket card; staff report renders an employee's audit rows
- [ ] Role isolation: IT_MANAGER has no مالی nav entry

### Deferred (explicit)
- Excel/PDF export buttons (same deferral as Phases 3/10)
- Finance-entered operating-cost CRUD (seeded rows only this phase)

---

Mark each item with its proving test file/name once implemented. Per
`CLAUDE.md`: unchecked items = feature not done.

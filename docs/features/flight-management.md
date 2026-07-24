# Feature: Flight management — مدیریت پروازها (Phase 10)

Covers `docs/API.md` → "Phase 10" and `docs/DB_SCHEMA.md` → "Phase 10".
Scope: the مدیریت پروازها tab for SENIOR_MANAGER + COMMERCIAL_MANAGER
(Commercial's existing Phase 6 pricing section on the same page stays
untouched). Design source: FLIGHTS MANAGEMENT sections of
`پنل مدیر ارشد.dc.html` / `پنل مدیر بازرگانی.dc.html`.

## Acceptance checklist

### Backend — overview & detail
- [x] `GET /flights/overview` returns the 3 KPI figures (active count, sold seats, mean occupancy) that reconcile with the returned rows
      — backend/test/flights.e2e-spec.ts › "overview: KPI figures reconcile with the rows…"
- [x] `active` rows derive status server-side: CANCELLED→لغو شده, sold==cap→تکمیل, sold>0→در حال فروش, else فعال; each row has route label, LTR flightNo, Jalali date/time, sold/cap, basePrice
      — backend/test/flights.e2e-spec.ts › "overview: KPI figures reconcile…" (SELLING/CANCELLED assertions)
- [x] `completed` rows aggregate REAL per-channel revenue from bookings (SYSTEM/CHARTER/AGENCY) — no fabricated 18٪ margin; متوسط نرخ = revenue/tickets; سود/ضرر = (avg−base)×tickets split into green/red; the 4 KPI totals reconcile with the rows
      — backend/test/flights.e2e-spec.ts › "completed report aggregates REAL per-channel revenue…"
- [x] `future` rows expose capacity, charterSeats, agencySeatsAllocated, persisted AI suggestion, and the Jalali day list for the calendar filter
      — backend/test/flights.e2e-spec.ts › "overview…" (future split) + "ai-analysis persists suggestions…"
- [x] `GET /flights/:instanceId` (detail modal) returns real channel breakdown (seats + revenue each) and مجموع درآمد consistent with the bookings table
      — backend/test/flights.e2e-spec.ts › "GET /flights/:id detail: channel breakdown + total revenue…"
- [x] Both endpoints 403 for roles without the tab (CEO, FINANCE_MANAGER, IT_MANAGER)
      — backend/test/flights.e2e-spec.ts › "airports catalog is seeded…; roles without the tab get 403"

### Backend — create & plan
- [x] `POST /flights` creates Route (find-or-create, origin≠dest), Flight (unique flightNo), and a FlightInstance with UTC departureAt converted from the Jalali date+time; audited
      — backend/test/flights.e2e-spec.ts › "POST /flights: validations … then a clean create" (route/flight/instance + audit + durationMin assertions)
- [x] `POST /flights` validation: missing fields → 400 (design copy «لطفاً همه فیلدها را تکمیل کنید.»), past date → 400, duplicate flightNo on a different route → 409/400, capacity/price bounds (Int32 rial ceiling)
      — same test (400/409 cases) + DTO bounds in flights.controller.ts
- [x] `GET /flights/airports` returns the seeded catalog (Iranian cities + DXB/IST/NJF)
      — backend/test/flights.e2e-spec.ts › "airports catalog is seeded (Iranian cities + DXB/IST/NJF)…"
- [x] `PATCH /flights/:instanceId/plan` stores basePriceIrr + agencySeatsAllocated; agencySeats > capacity−charterSeats → 400; مستقیم always derived, never stored
      — backend/test/flights.e2e-spec.ts › "plan: agency-seat cap enforced…"
- [x] ⚑ plan ≠ bookable price: for COMMERCIAL the plan also upserts the Phase 6 proposal (CEO approval still required); a plan save NEVER creates a REGISTERED price by itself
      — same test (proposal stays PENDING; REGISTERED → 409) + "plan by SENIOR stores figures WITHOUT creating a Phase 6 proposal"
- [x] `POST /flights/ai-analysis` persists suggestions with modelVersion via the Phase 6 client; ml-service down → graceful `available:false`, everything else still works
      — backend/test/flights.e2e-spec.ts › "ai-analysis persists suggestions with modelVersion…; down service degrades gracefully"

### Frontend (both panels)
- [x] KPI row + three sub-tab pills (پروازهای فعال / پروازهای انجام‌شده / پروازهای آینده) matching the design
      — frontend/src/features/flights/FlightsPage.test.tsx › "renders KPI cards and the active table…"
- [x] Active table: 6 design columns, occupancy progress bar with the design's color thresholds (۱۰۰٪ amber, ≥۶۰٪ green, else blue), status pills, «افزودن پرواز» button
      — same test (status pills, occupancy, toman price)
- [x] Add-flight modal: مبدأ/مقصد selects from the airport catalog, LTR flightNo/time/capacity/price inputs, inline validation message, success toast «پرواز جدید … اضافه شد ✓», new row appears in پروازهای فعال
      — FlightsPage.test.tsx › "add-flight modal: empty submit shows the design message; a full form converts Jalali+toman…"
- [x] Flight detail modal: sold/cap, ضریب اشغال, قیمت پایه + the 3 channel bars (سیستمی/چارتری/آژانس with seats · revenue) + مجموع درآمد
      — FlightsPage.test.tsx › "flight detail modal shows the real channel breakdown and total revenue"
- [x] Completed sub-tab: 4 KPI cards + report table with expandable row detail (design's 6 detail boxes)
      — rendered from the same overview fixture; expand behavior exercised in the E2E journey
- [x] Future sub-tab: Jalali day-filter calendar (only days with flights clickable, «پاک‌کردن فیلتر»), expandable cards (ظرفیت / تعهد چارتری / قیمت پیشنهادی AI / نرخ نهایی و تخصیص), نرخ‌گذاری modal with «استفاده از قیمت AI», agency-seat cap, empty state «برای روز انتخاب‌شده پروازی برنامه‌ریزی نشده است.»
      — FlightsPage.test.tsx › "future tab: AI panel renders; the plan modal pre-fills from AI…" + calendar markup in FlightsPage.tsx (day chips disabled without flights)
- [x] faMoney/faDigits/Jalali everywhere; flight codes LTR mono
      — FlightsPage.test.tsx money/digit assertions (۳٬۸۰۰٬۰۰۰ / ۵۷۷٬۶۰۰٬۰۰۰ / ۸۴٪)

### E2E
- [x] Journey: Senior adds a flight via the modal → sees it in پروازهای فعال → opens its detail modal
      — frontend/e2e/flights-journey.spec.ts › "Senior adds a flight via the modal…"
- [x] Journey: future flight → AI analysis (real ml-service) → نرخ‌گذاری with the AI price → card shows نرخ نهایی + تخصیص; for Commercial the Phase 6 proposal appears pending CEO approval
      — frontend/e2e/flights-journey.spec.ts › "Commercial: new future flight → AI analysis → نرخ‌گذاری…" (real uvicorn; asserts the pending Phase 6 proposal)
- [x] Role isolation: FINANCE_MANAGER has no مدیریت پروازها nav entry
      — frontend/e2e/pricing-journey.spec.ts › "Finance Manager gets no pricing surfaces (role isolation)"

### Phase 27 — EMPLOYEE fl_manage
- [x] An EMPLOYEE granted `fl_manage` (with `fl_view`) can `POST /flights` and `PATCH /flights/:instanceId/plan`; an EMPLOYEE with only `fl_view` gets 403 on the same write endpoints — `backend/test/phase27-employee-fl-manage-ag-settle-fn-invoices.e2e-spec.ts: 'an employee freshly granted fl_manage can create a flight and plan an instance; fl_view alone (no fl_manage) is denied'`
- [x] `fl_manage` unlocks the `flights` nav tab — `phase27-....e2e-spec.ts: 'fl_manage unlocks the "flights" nav tab'`

### Deferred (explicit, per docs)
- خروجی Excel (both sub-tabs) — same deferral as Phase 3
- RRULE recurring schedules — no design UI exists; single-instance creation only

---

Mark each item with its proving test file/name once implemented. Per
`CLAUDE.md`: unchecked items = feature not done.

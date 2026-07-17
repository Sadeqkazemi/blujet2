# Feature: Flight management — مدیریت پروازها (Phase 10)

Covers `docs/API.md` → "Phase 10" and `docs/DB_SCHEMA.md` → "Phase 10".
Scope: the مدیریت پروازها tab for SENIOR_MANAGER + COMMERCIAL_MANAGER
(Commercial's existing Phase 6 pricing section on the same page stays
untouched). Design source: FLIGHTS MANAGEMENT sections of
`پنل مدیر ارشد.dc.html` / `پنل مدیر بازرگانی.dc.html`.

## Acceptance checklist

### Backend — overview & detail
- [ ] `GET /flights/overview` returns the 3 KPI figures (active count, sold seats, mean occupancy) that reconcile with the returned rows
- [ ] `active` rows derive status server-side: CANCELLED→لغو شده, sold==cap→تکمیل, sold>0→در حال فروش, else فعال; each row has route label, LTR flightNo, Jalali date/time, sold/cap, basePrice
- [ ] `completed` rows aggregate REAL per-channel revenue from bookings (SYSTEM/CHARTER/AGENCY) — no fabricated 18٪ margin; متوسط نرخ = revenue/tickets; سود/ضرر = (avg−base)×tickets split into green/red; the 4 KPI totals reconcile with the rows
- [ ] `future` rows expose capacity, charterSeats, agencySeatsAllocated, persisted AI suggestion, and the Jalali day list for the calendar filter
- [ ] `GET /flights/:instanceId` (detail modal) returns real channel breakdown (seats + revenue each) and مجموع درآمد consistent with the bookings table
- [ ] Both endpoints 403 for roles without the tab (CEO, FINANCE_MANAGER, IT_MANAGER)

### Backend — create & plan
- [ ] `POST /flights` creates Route (find-or-create, origin≠dest), Flight (unique flightNo), and a FlightInstance with UTC departureAt converted from the Jalali date+time; audited
- [ ] `POST /flights` validation: missing fields → 400 (design copy «لطفاً همه فیلدها را تکمیل کنید.»), past date → 400, duplicate flightNo on a different route → 409/400, capacity/price bounds (Int32 rial ceiling)
- [ ] `GET /flights/airports` returns the seeded catalog (Iranian cities + DXB/IST/NJF)
- [ ] `PATCH /flights/:instanceId/plan` stores basePriceIrr + agencySeatsAllocated; agencySeats > capacity−charterSeats → 400; مستقیم always derived, never stored
- [ ] ⚑ plan ≠ bookable price: for COMMERCIAL the plan also upserts the Phase 6 proposal (CEO approval still required); a plan save NEVER creates a REGISTERED price by itself
- [ ] `POST /flights/ai-analysis` persists suggestions with modelVersion via the Phase 6 client; ml-service down → graceful `available:false`, everything else still works

### Frontend (both panels)
- [ ] KPI row + three sub-tab pills (پروازهای فعال / پروازهای انجام‌شده / پروازهای آینده) matching the design
- [ ] Active table: 6 design columns, occupancy progress bar with the design's color thresholds (۱۰۰٪ amber, ≥۶۰٪ green, else blue), status pills, «افزودن پرواز» button
- [ ] Add-flight modal: مبدأ/مقصد selects from the airport catalog, LTR flightNo/time/capacity/price inputs, inline validation message, success toast «پرواز جدید … اضافه شد ✓», new row appears in پروازهای فعال
- [ ] Flight detail modal: sold/cap, ضریب اشغال, قیمت پایه + the 3 channel bars (سیستمی/چارتری/آژانس with seats · revenue) + مجموع درآمد
- [ ] Completed sub-tab: 4 KPI cards + report table with expandable row detail (design's 6 detail boxes)
- [ ] Future sub-tab: Jalali day-filter calendar (only days with flights clickable, «پاک‌کردن فیلتر»), expandable cards (ظرفیت / تعهد چارتری / قیمت پیشنهادی AI / نرخ نهایی و تخصیص), نرخ‌گذاری modal with «استفاده از قیمت AI», agency-seat cap, empty state «برای روز انتخاب‌شده پروازی برنامه‌ریزی نشده است.»
- [ ] faMoney/faDigits/Jalali everywhere; flight codes LTR mono

### E2E
- [ ] Journey: Senior adds a flight via the modal → sees it in پروازهای فعال → opens its detail modal
- [ ] Journey: future flight → AI analysis (real ml-service) → نرخ‌گذاری with the AI price → card shows نرخ نهایی + تخصیص; for Commercial the Phase 6 proposal appears pending CEO approval
- [ ] Role isolation: FINANCE_MANAGER has no مدیریت پروازها nav entry

### Deferred (explicit, per docs)
- خروجی Excel (both sub-tabs) — same deferral as Phase 3
- RRULE recurring schedules — no design UI exists; single-instance creation only

---

Mark each item with its proving test file/name once implemented. Per
`CLAUDE.md`: unchecked items = feature not done.

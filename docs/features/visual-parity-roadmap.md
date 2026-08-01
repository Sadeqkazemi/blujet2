# Visual parity roadmap — design-reference-v2/bundled

Systematic page-by-page alignment with bundled HTML exports. Each phase = layout/CSS port to React + responsive @ 767px + fa/en/ar strings from `.dc.html`.

## Status legend

- [x] Done (this PR or prior phases)
- [~] In progress
- [ ] Pending
- [-] Deferred (explicit user request)

## Phase order

| # | Page | Bundled ref | Est. | Status |
|---|------|-------------|------|--------|
| 1 | صفحه اصلی | `صفحه اصلی.html` | — | [x] Dual-month calendar, search overlay, hero |
| 2 | نتایج پرواز | `نتایج پرواز.html` | High | [x] Search summary, AI banner, filter bar, flight cards |
| 3 | تکمیل خرید | `تکمیل خرید.html` | High | [x] Two-column checkout, hold timer, seat map |
| 4 | پرداخت | `پرداخت.html` | High | [-] **Deferred** — user requested no changes |
| 5 | مدیریت رزرو | `مدیریت رزرو.html` | Med | [x] Lookup card, discover section, ticket card, action grid |
| 6 | وضعیت پرواز | `وضعیت پرواز.html` | Med | [x] Live badge hero, grid search, progress timeline, help links |
| 7 | ورود و ثبتنام | `ورود و ثبتنام.html` | Med | [ ] |
| 8 | فراموشی رمز | `فراموشی رمز.html` | Low | [ ] |
| 9 | مقاصد | `مقاصد.html` | Med | [~] i18n done; pixel pass pending |
| 10 | باشگاه مشتریان | `باشگاه مشتریان.html` | Med | [~] i18n done |
| 11 | پشتیبانی | `پشتیبانی.html` | Med | [~] i18n done |
| 12 | درباره ما / تماس / قوانین | bundled | Low | [~] i18n done |
| 13 | صفحه 404 / maintenance | bundled | Low | [ ] |
| 14 | فرصت‌های شغلی + فرم | bundled | Low | [ ] |
| 15 | پنل کاربر | `پنل کاربر.html` | High | [ ] |
| 16 | پنل آژانس | `پنل آژانس.html` | High | [ ] Mobile shell |
| 17–24 | Staff panels (8) | bundled | High each | [ ] Desktop fidelity pass |
| 25 | ReservationSystem | `ReservationSystem.html` | Med | [ ] Embed in panel tabs |

## Shared components (build once, reuse)

- [x] `FlightSearchForm` + airport/pax pickers
- [x] `FlightSearchDateRangePicker` — dual-month Jalali/Gregorian calendar (design search box)
- [x] `ResultsSearchSummary`, `ResultsPriceCalendarStrip`, `ResultsAiRadarBanner`, `ResultsFilterBar`, `ResultsFlightCard`
- [x] `CheckoutFlightSummary`, `CheckoutReviewSection`, `CheckoutPriceSidebar`, `CheckoutHoldBanner`, `BookSeatMap`
- [x] `ManageBookingLookupForm`, `ManageBookingDiscoverSection`, `ManageBookingTicketCard`, `ManageBookingPassengersCard`, `ManageBookingActionGrid`
- [x] `FlightStatusSearchForm`, `FlightStatusResultCard`, `FlightStatusNotFound`, `FlightStatusHelpLinks`
- [ ] Breakpoint utility: unify on `useIsMobile()` @767px (replace `lg:` @1024px on PaymentPage — deferred with payment phase)

## Acceptance

Each phase completes when: visual match to bundled HTML (manual check), existing tests pass, new RTL/i18n/responsive tests added, `npm run lint && npm run typecheck` clean.

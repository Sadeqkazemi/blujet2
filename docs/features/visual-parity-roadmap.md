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
| 7 | ورود و ثبتنام | `ورود و ثبتنام.html` | Med | [x] Two-column card, visual panel, OTP layout |
| 8 | فراموشی رمز | `فراموشی رمز.html` | Low | [x] Two-column card, stepper, OTP cells, visual panel |
| 9 | مقاصد | `مقاصد.html` | Med | [x] Route cards, map pins pulse, mobile map hide |
| 10 | باشگاه مشتریان | `باشگاه مشتریان.html` | Med | [x] Tier cards, card issuance, Saman banner, gold CTA |
| 11 | پشتیبانی | `پشتیبانی.html` | Med | [x] Hero card, FAQ + dark ticket sidebar |
| 12 | درباره ما / تماس / قوانین | bundled | Low | [x] Hero, stats cards, channels, TOC layout |
| 13 | صفحه 404 / maintenance | bundled | Low | [x] Light 404 + maintenance layout, gear animation |
| 14 | فرصت‌های شغلی + فرم | bundled | Low | [x] List + apply form layout, resume drop zone |
| 15 | پنل کاربر | `پنل کاربر.html` | High | [x] Sidebar + all primary tab content incl. profile hero/stats |
| 16 | پنل آژانس | `پنل آژانس.html` | High | [x] Shell, dashboard, seats, credit, inbox, profile, sales; webservice/apidocs pre-styled |
| 17 | پنل ادمین سایت + داشبوردها | `پنل ادمین سایت.dc.html` | High | [x] PanelShell dark + all role dashboards |
| 18 | تب‌های داخلی staff (شروع) | bundled | High | [~] Cartable, Refunds, Agencies, Finance, Flights dark theme |
| 19–24 | Staff panels (remaining tabs) | bundled | High each | [ ] Flights, Finance, IT tabs, etc. |
| 25 | ReservationSystem | `ReservationSystem.html` | Med | [ ] Embed in panel tabs |

## Shared components (build once, reuse)

- [x] `FlightSearchForm` + airport/pax pickers
- [x] `FlightSearchDateRangePicker` — dual-month Jalali/Gregorian calendar (design search box)
- [x] `ResultsSearchSummary`, `ResultsPriceCalendarStrip`, `ResultsAiRadarBanner`, `ResultsFilterBar`, `ResultsFlightCard`
- [x] `CheckoutFlightSummary`, `CheckoutReviewSection`, `CheckoutPriceSidebar`, `CheckoutHoldBanner`, `BookSeatMap`
- [x] `ManageBookingLookupForm`, `ManageBookingDiscoverSection`, `ManageBookingTicketCard`, `ManageBookingPassengersCard`, `ManageBookingActionGrid`
- [x] `FlightStatusSearchForm`, `FlightStatusResultCard`, `FlightStatusNotFound`, `FlightStatusHelpLinks`
- [x] `CustomerLoginVisualPanel`, `CustomerLoginCardHeader`, customer-login shared styles
- [ ] Breakpoint utility: unify on `useIsMobile()` @767px (replace `lg:` @1024px on PaymentPage — deferred with payment phase)

## Acceptance

Each phase completes when: visual match to bundled HTML (manual check), existing tests pass, new RTL/i18n/responsive tests added, `npm run lint && npm run typecheck` clean.

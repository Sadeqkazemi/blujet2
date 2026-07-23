# PLAN.md — blujet roadmap & progress

Scope of this track: the six executive management panels (پنل مدیر عامل،
پنل رئیس هیئت مدیره، پنل مدیر ارشد، پنل مدیر بازرگانی، پنل مدیر مالی، پنل
مدیر IT) plus the shared panel shell and reservation/lock system, per
`CLAUDE.md`. The public-facing site (search/booking/checkout/payment) was
a separate track (branch `claude/airline-project-design-difvku`, ~28
phases: customer purchase flow, price-lock, promo codes, club/wallet,
agencies, staff-auth, reports, GDPR, rate-limiting, Sentry). The two
tracks turned out to have near-total schema/architecture overlap on
admins/agencies/club/refunds/reporting/cartable/staff-auth — since this
track's version of those was already reviewed and merged to `main`, the
explicit merge decision (2026-07-18) was: **keep this track's schema and
modules as-is, and port only the genuinely-missing customer-facing half
(search/booking/payment/refund-submission, and still-pending price-lock/
promo/wallet/points-ledger/GDPR/public frontend) onto this schema**,
rather than reconciling two incompatible Prisma histories. See "Phase 13"
below for what's landed from that port so far.

## Status

- [x] Repo scaffold (frontend/backend/ml-service skeletons, design-reference import)
- [x] Design extraction — all 6 panels + shared shell + `ReservationSystem` read in full; findings folded into `docs/API.md` / `docs/DB_SCHEMA.md`
- [x] **Phase 1 — staff auth + RBAC + panel shell + dashboard/reporting** — see `docs/features/panel-shell-dashboard.md` for the proven checklist (35 backend + 21 frontend unit + 5 E2E tests, all passing; lint+typecheck clean in both packages). Known deferred scope, not silently dropped: IT Manager's real (service-health) dashboard, day/month/flight chart-mode UI, pixel-diff visual regression — see that doc's scope notes.
- [x] Phase 2 — flight/booking core (minimal read-side slice for reporting) — done as part of Phase 1's Prisma schema (Route/Flight/FlightInstance/Booking/LedgerEntry), since reporting needed real data to aggregate
- [x] **Phase 3 — Agencies (list/detail/credit/settlement/membership requests)** — backend: Prisma schema/migration/seed + full `agencies` module (all endpoints from `docs/API.md`'s Phase 3 table, role-reconciled), 25 integration tests (60 backend total). Frontend: آژانس‌ها list/detail/request pages with per-role differences (Senior: API keys; Finance: read+settle; Commercial: نمای کلی/مالی/مکاتبه‌ها sub-tabs, invoices, chat, debtors panel), 10 new Vitest+RTL tests (31 total) and 5 Playwright journeys. All checklist items in `docs/features/agencies.md` proven except the explicitly deferred ones listed at its end (Excel export, invoice description, refer-UI → Phase 4, agency-portal-side suspension). Lint+typecheck clean in both packages.
- [x] **Phase 4 — Cartable, referrals, manager messaging** — implemented end-to-end (docs approved 2026-07-17): 7 new tables, five backend modules (cartable با تأیید/رد/انتقال + نظر مدیر اجباری، ارجاعات مدیر ارشد با چرخه گزارش کامل، پیام سازمانی با تحویل به کارتابل، staff-directory، آپلود فایل), 23 backend tests + 9 Vitest + 3 Playwright loops. Totals now: 83 backend / 40 frontend / 14 Playwright, all green. Two explicitly deferred UI pieces (attachment chips UI → Phase 5, Jalali date-picker popover → shared component in Phase 5/7) listed at the end of `docs/features/cartable-referrals.md`. Merged to main (PR #3).
- [x] **Phase 5 — VIP club** — implemented end-to-end: ClubMember/ClubCardRequest schema (national ID checksum-validated, AES-256-GCM encrypted + HMAC hash for exact search), club module with the ⚑-approved authority rules (CEO/Chair approve any REFERRED, Senior only senior-assigned; direct issuance audited; tier change Senior-only), CEO/Chair rich layout + Senior simple layout, 13 backend tests + 4 Vitest + 4 Playwright journeys. Totals: 92 backend / 44 frontend / 18 Playwright. Merged to main (PR #4).
- [x] **Phase 6 — Ticket pricing proposals** — implemented end-to-end (docs approved 2026-07-17): FarePricingProposal FK-linked to FlightInstance (fixes the mocks' incompatible id schemes), pricing module with the locked-forever registration rule + CEO legal-rate path, the FIRST REAL ml-service (FastAPI price-suggestion: internal token, versioned heuristic, 11 pytest) behind a NestJS AiProvider client (2s timeout, graceful degradation — proven by a Playwright journey that runs with the real uvicorn service AND one with it down). CEO tab + Commercial pricing section (inside its مدیریت پروازها tab, per design). 8 backend + 5 Vitest + 3 Playwright new tests. Totals: 100 backend / 49 frontend / 21 Playwright / 11 pytest. Merged to main (PR #5).
- [x] **Phase 7 — Refunds (استرداد بلیط، پنل مدیر مالی)** — implemented end-to-end (docs approved 2026-07-17): `RefundPenaltyRule` (seeded 4-bracket engine: ≥72h→30٪ / 24–72h→50٪ / 3–24h→70٪ / <3h→100٪, unifying the mocks' 3 inconsistent schemes) + `RefundRequest` lifecycle SUBMITTED→REVIEW→FINANCE→PAID with IBAN/nid/mobile AES-256-GCM encrypted at rest; refunds module (list+KPIs / detail — the only surface that decrypts the شبا / refer without status change / pay as ONE transaction: `LedgerEntry(REFUND, −refundable)` + `Booking→REFUNDED` + PAID+processedBy, replay-guarded → 409). Finance-only (`@Roles('FINANCE_MANAGER')`). Frontend: استرداد بلیط tab (KPI cards, status-pill card list, 3-panel detail modal with penalty breakdown, refer select, pay/closed-case states). 7 backend integration + 11 penalty unit + 6 Vitest + 2 Playwright new tests — see `docs/features/refunds.md` for the item→test map. Totals: 107 backend / 55 frontend / 23 Playwright / 11 pytest. Merged to main (PR #8).
- [x] **Phase 8 — Employee management (IT Manager: accounts, permissions, services, security policy, logs, backups)** — implemented end-to-end (2026-07-17, reassigned to this track by the user, superseding the earlier "separate session" note below): `User` gained dept/rank/referralScope/mustChangePassword/lastLoginAt columns, `Permission`/`EmployeePermission` (seeded verbatim from the design's `PERM_CATALOG`), `InternalService`/`ExternalServiceConfig`, `SecurityPolicy` singleton, `BackupRecord`, `PasswordResetEvent`. New `it-manager` backend module (employees, security incl. active-session/logout-all reusing `RefreshToken`, services incl. a real HTTP test-connection check, real `pg_dump`-backed backups, a technical dashboard on real `os.*` metrics). Frontend: 6 real tabs wired into `PanelShell`/`App.tsx`. 15 new backend e2e tests, 7 new frontend unit tests, 4 new Playwright journeys + fixed the pre-existing `staff-login-journey` itadmin case. Merged with Phase 6's concurrently-landed work (2026-07-17): 115 backend / 56 frontend / 25 Playwright / all green, lint+typecheck clean in both packages. Proven checklist: `docs/features/it-manager.md` — reservation (Phase 9) and دسترسی به پنل‌ها/تنظیمات سامانه (Phase 12) explicitly stay deferred; two smaller UI pieces (external-service edit modal, suspend confirmation) listed as deferred at that doc's end.
- [x] **Phase 9 — Reservation system (seat lock/PNR)** — implemented end-to-end (2026-07-17): resolved the ⚑ `role="super"` open item per explicit user decision — `canLock` = CEO/BOARD_CHAIR/IT_MANAGER, SENIOR_MANAGER view-only, matching the design's own confirmed copy. New `AircraftSeatMap` (data-driven per CLAUDE.md, seeded for the existing "Airbus A320" flight matching the design's MD-88 numbers verbatim: 16 business + 130 economy = 146 seats), `SeatLock` (encrypt+hash PII, DB partial-unique-index for true concurrency safety — proven by a 5-parallel-request race test), `Passenger.nationalIdHash`/`seatCode`. `reservation` module: seat map + lock/release, PNR list/detail/seat-change/cancel (reusing Phase 2's Booking/Passenger), staff-side manual PNR issuance (TICKETED directly, no payment gateway — distinct from the public checkout track), flight search with Phase 6 pricing or a documented flat fallback, real dashboard stats (no fabricated "microservices health" data — CLAUDE.md forbids it). Frontend: one `ReservationPage` with PNR-management/seat-map/new-booking sub-tabs, wired into BOARD_CHAIR/SENIOR_MANAGER/IT_MANAGER panels. 13 new backend e2e tests (128 total), 3 new frontend unit tests (59 total), 4 new Playwright journeys against a fresh non-production `_test/flight-instance` hook (avoids depending on the seed's ambiguous historical/demo instances). Lint+typecheck clean in both packages. Proven checklist: `docs/features/reservation.md` — agency API access (Phase 3 already covers it), flight/schedule creation (Phase 10), ticket PDF printing, and exact aisle-gap pixel rendering are explicitly deferred with reasons at that doc's end.
- [x] **Agency Portal (self-service, پنل آژانس)** — implemented end-to-end (2026-07-17, reassigned into this track by explicit user approval, even though `CLAUDE.md` scopes it to the separate public-site track — same pattern as Phases 8/9): new AGENCY-role login (`POST /auth/agency/login`, phone+password, no 2FA — a ⚑ product decision documented since the design's own "کد آژانس" login-identifier concept has no backing field, so it reuses the agency's real registered phone instead); `AgencyProfile.approveRequest` now issues a one-time temp password (was a real gap — approved agencies previously had no way to ever log in). New `AgencyCreditRequest`/`AgencyDocument` models — the design's self-service "افزایش اعتبار" (which directly mutates its own credit limit client-side) is replaced with an audited request that only the existing, already-audited `updateCredit` method can approve (new staff endpoints `GET/PATCH /agencies/:id/credit-requests`). New `agency-portal` backend module: self-scoped dashboard/credit/ledger/invoices(pay-from-credit, reusing the staff transactional logic verbatim)/sales-report/inbox(bidirectional — `AgencyMessage.senderIsAgency` now writable by the agency itself)/profile/documents(reusing Phase 4's `FilesService`). Frontend: distinct `/agency/*` route tree with its own login page, protected-route guard (bidirectional role isolation with the staff `/panel/*` tree), and 5 tabs (allocated-seats and self-service webservice-purchase tabs explicitly deferred — no staff-side counterpart workflow exists for either). 16 new backend e2e tests (144 total), 8 new frontend unit tests (67 total), 4 new Playwright journeys. Lint+typecheck clean in both packages. Proven checklist: `docs/features/agency-portal.md`. Merged to main (PR #9).
- [x] **Phase 10 — Flight management (مدیریت پروازها — Senior/Commercial)** — implemented end-to-end (docs approved 2026-07-17): seeded `Airport` catalog (20 Iranian cities + DXB/IST/NJF) feeding the add-flight selects, `Route.durationMin`, `FlightInstance.basePriceIrr`/`agencySeatsAllocated`/`aiSuggestion`. `flights` module: overview (KPI + فعال/انجام‌شده/آینده with server-derived statuses), add-flight (find-or-create Route/Flight, UTC conversion at the edge, audited), detail modal with REAL channel breakdown from bookings, plan (⚑ stores plan figures only — Commercial's save upserts the Phase 6 proposal, CEO approval still required; REGISTERED → 409), future-flight AI analysis via the Phase 6 ml-service client (suggestion persisted on the instance with modelVersion, graceful degradation). Completed-flights financials computed from real bookings (سود/ضرر vs base rate — no fabricated 18٪ margin). Frontend: FlightsPage (3 sub-tabs, add/detail/plan modals, Jalali day-filter calendar, AI panel) for both panels; Commercial keeps the embedded Phase 6 pricing section on the same tab. 8 backend + 7 Vitest + 2 Playwright new tests — item→test map in `docs/features/flight-management.md`. Explicit deferrals: Excel exports, RRULE schedules (no design UI). Merged to main (PR #10).
- [x] **Phase 11 — Finance tab (مالی), گزارش مسافران, گزارش کارمندان** — implemented end-to-end (2026-07-17): NO schema changes — every figure derived at query time. مالی ships two design-confirmed layouts: FINANCE_MANAGER's finance-ops view (KPI row from the existing `/reporting/kpis`, low-sales alert, completed-flights box, NEW `/reporting/recent-transactions` real-ledger feed, NEW `/reporting/revenue-mix` donut, NEW `/reporting/agency-settlements` rows derived from Phase 3 invoices with the remind action reusing — and role-widening to FINANCE_MANAGER — the existing audited Phase 3 remind endpoint) and the analytic view (sales chart + channel tiles + donut) for CEO/Chair/Senior/Commercial, matching CLAUDE.md's «تراکنش‌ها/تسویه only in the finance panel» rule. گزارش مسافران: new `passenger-reports` module — name-substring or exact-national-ID(hash) search, national ID ALWAYS masked (surface never returns it whole), cabin derived from the Phase 9 seat map. گزارش کارمندان: new `staff-reports` module — dept-isolated EMPLOYEE audit feed + real ACCOUNT-event "new employee" banner. The finance mock's `finMonths` income/expense chart is confirmed orphaned (computed, never rendered) — not built. 10 new backend e2e tests (169 total), 5 new frontend unit tests (85 total), 5 new Playwright journeys. `finance`/`reports`/`staff` nav flags flipped for all their roles. Proven checklist: `docs/features/finance-reports.md`.
- [x] **Phase 12 — Remaining shell tabs (COMPLETE, 2026-07-17)** — first landed as a partial (گزارش مدیران + دسترسی به پنل‌ها UIs over their existing Phase 1 backends), then finished in full: new `admins` module («مدیران و ادمین‌ها», CEO/Chair/Senior — list with REAL «آنلاین» derived from unexpired refresh tokens, add-admin restricted to enum-backed roles با رمز اولیه + تحویل sms/email از مسیر mocked provider، block/unblock که واقعاً در staff-login اعمال می‌شود، بازنشانی رمز با رمز موقت یک‌بارنمایش؛ سلسله‌مراتب مدیریتی server-enforced: CEO/Chair بر ۵ نقش پایین‌تر، Senior بدون SENIOR_MANAGER؛ حساب CEO/Chair و self هرگز قابل مسدودسازی نیستند)؛ `POST /auth/change-password` (تأیید رمز فعلی با argon2)؛ `GET /audit/system-events` برای تب لاگ CEO (سطح presentational روی AuditLog واقعی)؛ ماژول `settings` با جدول جدید `SystemSetting` (key-value با defaultهای سروری و رد کلیدهای ناشناخته) و ⚑ ورودی‌های «قوانین استرداد» که مستقیم `RefundPenaltyRule`های واقعی فاز ۷ را می‌نویسند (هر ۴ بازهٔ واقعی نمایش داده می‌شود، نه ۲ ورودی mock)؛ IT حالا `GET /panels/access` را read-only می‌خواند (PATCH همچنان 403). فرانت‌اند: AdminsPage، OwnSecurityPage + SecurityRouter (IT صفحهٔ فاز ۸ خودش را نگه می‌دارد)، CeoLogsPage + LogsRouter، SettingsPage (بخش‌های chair در برابر IT)، PanelsAccessPage read-only برای IT. ⚑ deferrals مستند: ماتریس permission per-admin (stored-but-unenforced ممنوع؛ نیازمند redesign authorization)، نقش سفارشی free-text، آپلود لوگو، بخش orphaned پروفایل chair. 9 تست جدید بک‌اند (۱۷۸ کل)، 7 تست جدید فرانت (۹۵ کل)، 5 journey جدید Playwright + به‌روزرسانی تست «به‌زودی» قدیمی. **همهٔ nav flagها اکنون `implemented: true` هستند — هیچ تب «به‌زودی» در هیچ پنلی باقی نمانده.** Proven checklist: `docs/features/phase12-admin-settings.md`.
- [~] **Phase 13 — Public purchase engine (customer track, IN PROGRESS, started 2026-07-18)** — porting the standalone branch's customer-facing purchase flow onto this schema, per the merge decision above. Money stays `Int` (matching this track's existing convention/tech-debt note, not `BigInt`); ledger stays this track's single-signed-amount `LedgerEntry`, not the old branch's double-entry pair. Landed so far, all with real e2e coverage (green together with all 12 earlier phases — 197 backend / 95 frontend, lint+typecheck clean):
  - Schema (additive only, no Phase 1-12 column changed): `CabinClass` enum + `CabinFare` (per-cabin price, `@@unique([flightInstanceId, cabin])`); `Booking` gained `userId`/`contactPhone`/`cabin`/`holdExpiresAt`/`idempotencyKey` (all nullable — staff/agency bookings leave them null); `TwoFactorPurpose` gained `CUSTOMER_OTP_LOGIN`.
  - Auth: customer phone+OTP login (`POST /auth/otp/request`, `/auth/otp/verify`) — find-or-create a `role=USER` account, reuses the existing `TwoFactorChallenge` table/`TwoFactorProvider`/JWT machinery rather than a parallel auth stack. 6 new e2e tests in `auth.e2e-spec.ts`.
  - New `booking-engine` module: public unauthenticated search (`GET /search/flights`, `/search/airports`, `/search/flights/:id/seatmap`) reusing the reservation module's `AircraftSeatMap`-driven seat layout; `getCabinPrice` is the single pricing function shared by search results and pre-payment re-pricing so they can never disagree; customer booking (`POST /bookings`, USER-role-gated) row-locks the flight instance (`SELECT ... FOR UPDATE`) to serialize concurrent seat holds, creates a HELD booking with a 10-minute TTL and encrypted passenger PII, honors an `Idempotency-Key` header; a lazy `materializeExpiry` flips a past-TTL HELD booking to EXPIRED on read/pay (no cron); payment (`POST /bookings/:id/pay`) re-prices immediately before charging, requires client-confirmed price if it moved, transitions HELD→TICKETED, posts a `SALE` ledger entry. 9 new e2e tests including the mandatory concurrent-last-seat test (exactly one of two simultaneous buyers of the final seat succeeds, inventory never goes negative).
  - Refunds: added the customer-facing submission surface main's staff-only refunds module was missing (`POST/GET /my/refunds`, `GET /my/refunds/:id`, USER-role-gated, kept as a separate controller from the `PanelAccessGuard`-gated staff one) — reuses the existing `computePenalty`/`RefundPenaltyRule` engine and passenger PII already on the booking, so the penalty math a customer sees is provably the same one finance later approves. 5 new e2e tests.
  - Content management: extended the existing `تنظیمات سامانه` `SystemSetting` KV store (not a new table) with editable homepage/about/contact/terms text fields, surfaced in the BOARD_CHAIR-only section of `SettingsPage`.
  - Reporting charts: **already fully built on this track** (`FinancePage.tsx` + `SalesBarChart.tsx` against the existing `reporting` module) — nothing to do here, the standalone branch's gap was already closed independently.
  - Public-site frontend: `frontend/src/features/public-site` (home search, results, seat+passenger booking with an inline OTP gate, checkout with promo/payment-method, e-ticket + inline refund submission) wired to the backend above, reusing the existing `AuthProvider`/`token-store`/api client infra (optional `requestOtp`/`verifyOtp` on `AuthContextValue` so no existing staff/agency test needed updating). 15 new component tests + a real-browser Playwright golden path (search → OTP login → seat/passenger → pay → e-ticket → refund submission) run against live dev servers, not just mocked. Styling is functional/clean, not yet pixel-matched to `design-reference/` — see deferred list below.
  - Promo codes / wallet / club points ledger / price lock: `PromoCode`/`PromoRedemption` (applied inside `pay()`, full route/cabin/date-window/maxRedemptions/maxPerUser validation), `WalletEntry` (balance always `SUM(signedAmountIrr)`, sandbox top-up + pay-with-wallet), `ClubPointsEntry` (the authoritative points ledger — `ClubMember.points` stays a synced display-copy; real-money payments earn, points payments redeem, no redeem-to-earn loophole), `PriceLock` (gold-tier+ only, 72h TTL, flat NestJS-computed fee — the AI-suggested variable fee is deferred with the rest of the AI wiring below; a booking made against an active lock prices at the locked rate and skips re-pricing entirely at payment). Wired into `CheckoutPage.tsx` (promo-code field + payment-method picker with live wallet balance, points option disabled for non-members). 11 + 2 new e2e tests.
  - GDPR: `GET /my/privacy/export` (full JSON of the customer's own bookings/passengers/refunds/wallet/points/locks) and `DELETE /my/privacy/account` (soft-deletes `User`, anonymizes passenger PII on their bookings, revokes all refresh tokens — booking/ledger rows survive as financial records, never hard-deleted). 3 new e2e tests.
  - **Still not ported** (explicitly deferred, not silently dropped): the AI "buy-now-or-wait" advisory endpoint reusing the existing `PRICE_SUGGESTION_PROVIDER` (price-lock's fee is a flat rate instead, documented above); a dedicated site-content-management UI beyond the `SettingsPage` text fields already added (no `MediaTab`/asset-library equivalent exists on this track's frontend). All backend surfaces above are fully tested via Supertest; the frontend covers only the golden path, not every edge state (price-lock UI, wallet top-up UI, and a GDPR export/delete UI screen don't exist yet — those endpoints are currently curl/Supertest-only).

- **Sentry error tracking (backend + frontend)**: wired per CLAUDE.md's
  Observability rules. Backend: DSN-gated `Sentry.init()` in `main.ts`,
  `Sentry.captureException` hooked into `AllExceptionsFilter` for 5xx
  errors — no-op when `SENTRY_DSN` is unset. Frontend: DSN-gated init plus
  a React `ErrorBoundary` (Persian fallback UI) wrapping the app and a
  global `unhandledrejection` handler — no-op when `VITE_SENTRY_DSN` is
  unset. Threaded through `docker-compose.prod.yml`, the frontend
  Dockerfile build args, and `.env.production.example`.

- **Public-site pixel-matching (partial, in progress)**: built
  `PublicHeader`/`PublicFooter` (colors, spacing, layout copied verbatim
  from `design-reference/صفحه اصلی.dc.html`'s inline styles, not
  reinvented) wired to real auth/club-points state, applied across all 5
  public pages via a shared `PublicPageShell`. Rebuilt `HomeSearchPage`
  with the real hero banner, search card (origin/destination fields, swap
  button, a real `JalaliDatePicker` — the previous native
  `<input type="date">` was Gregorian, a CLAUDE.md violation), and
  popular-route shortcuts sourced from real airport data. A concurrent
  session then added `DestinationsPage`/`PublicClubPage`/`SupportPage`/
  `TravelInfoPage` (wired to the same `/destinations`, `/club`, `/support`,
  `/travel-info` routes the header already linked to) and filled the home
  page's "پیشنهادهای ویژه"/"مقصدهای محبوب" sections with **mock prices
  copied verbatim from the design mockup** (commented in
  `HomeSearchPage.tsx` as placeholders — the backend has no
  featured-routes/offers API to source real figures from). Product
  decision (confirmed with the user 2026-07-18): keep the mock figures for
  now; replace with a real backend-sourced endpoint once one exists — this
  is a known, intentional gap, not an oversight. A later commit added
  `CustomerLoginPage` (`/signin`, real phone+OTP flow — also fixed a bug
  where the header's "ورود / ثبت‌نام" link pointed at the *staff* login
  route), `ManageBookingPage`, `AboutPage`, `ContactPage`, `NotFoundPage`.

  **Known, accepted gap — not wired to any backend (confirmed with the
  user 2026-07-18, deploying to a controlled/internal test server only,
  not real customers yet):** `ManageBookingPage` (`/manage-booking`) is
  entirely mock — any PNR + last name resolves to a hardcoded sample
  booking, and its refund button shows a fake "درخواست استرداد ثبت شد"
  success message with **zero calls to the real, already-tested
  `/my/refunds` endpoint**. `ContactPage`'s "ارسال پیام" button similarly
  just flips local state, no message is actually sent anywhere. **Must be
  wired to the real backend (or removed/gated) before this branch is ever
  exposed to real customers** — a fake refund confirmation is a trust/
  financial-integrity issue, not a cosmetic one.

  **Also not yet done**: the body content of Results/Book/Checkout/Ticket
  (price calendar, AI price radar, seat map styling, boarding-pass ticket
  visual) is still the earlier functional/clean styling, not pixel-matched — only
  header/footer wrap them now.

- [x] **Phases 14–17 (merged to main, not previously logged here)**:
  Phase 14 — real `SmsProvider` + IT management log. Phase 15 — step-up
  2FA verification (`POST /auth/step-up/request` + code) gating high-risk
  actions (admin role changes, API-key rotation, refund payout, price
  capacity change, session revoke-all) across their respective controllers,
  with matching frontend `useStepUp` hook wiring. Phase 16 — agency
  self-registration (public OTP + pre-registration → SITE_ADMIN
  review/refer → COMMERCIAL_MANAGER sole approval → real confirmation
  SMS, explicit no-selfie decision) plus real agency seat-allotment
  frontend (`FlightsPage`'s plan modal, `AgencySeatsPage`). Phase 17 —
  customer profile fields (`/my/profile`, encrypted national ID/passport,
  email verification) + an incomplete-profile banner on `AccountPage`.
  See `docs/API.md`/`docs/DB_SCHEMA.md`'s Phase 14–17 sections for full
  detail (this file lagged behind actual merged work — backfilled here for
  accuracy, not re-litigated).
- [x] **Phase 18 — SITE_ADMIN + EMPLOYEE panel access** — a design/mock
  audit found both panels had an empty `PANEL_NAV` (no sidebar at all).
  Per explicit user decision ("real and complete", not a narrow fix):
  `SITE_ADMIN` gets real, conservatively-scoped access to six of its ten
  design-listed tabs (`agencies`, `reports`, `cartable`, `club`, `refund`,
  plus a new scoped `SiteAdminDashboardPage`) — `flightops`/`tickets`/
  `blog`/`media` stay excluded since none has a backend for ANY role.
  `EMPLOYEE`'s sidebar is now computed per-user from real
  `EmployeePermission` grants (new `EmployeePermissionGuard` +
  `@RequiresPermission(...)`, `PanelsService.getNav` now async), matching
  `پنل کارمند.dc.html`'s dynamic `navKeys` formula — wired for
  agencies/flights(view-only)/pricing(propose-only)/reports/refund
  (review+refer, never pay). No schema change. 18 new backend e2e tests
  (`phase18-panel-access.e2e-spec.ts` + 3 new cases in
  `panels.e2e-spec.ts`), 4 new frontend unit tests (2 new dashboard
  pages), plus a pre-existing frontend bug fixed along the way
  (`RequestDetailPage`'s approve button showed for roles that can't
  actually approve since Phase 16 narrowed that endpoint). See
  `docs/API.md`/`docs/DB_SCHEMA.md`'s Phase 18 sections for the full
  scope + explicit deferrals (`fl_manage`, `ag_settle`, `fn_invoices`, the
  IT dept's catalog keys, EMPLOYEE's `referrals` tab).
- [x] **Phase 19 — مدیریت رزرو (anonymous PNR self-service)** — first item
  from the post-Phase-18 "dead forms" punch list. Per explicit user
  decision, real anonymous PNR+last-name lookup/refund (no login), reusing
  the existing `BookingService`/`RefundsService` logic via new shared
  private helpers (`toDetail()`, `createRefundRequest()`) so the anonymous
  and authenticated paths can never compute results differently. No schema
  change. 7 new backend e2e tests, 4 new frontend tests. See
  `docs/API.md`/`docs/DB_SCHEMA.md`'s Phase 19 sections for full scope +
  explicit deferrals (seat change, ticket download, per-passenger partial
  refund).
- [x] **Phase 20 — تماس با ما + پشتیبانی (contact + support tickets)** —
  second "dead forms" item. Two new tables (`ContactMessage`, a plain
  inbox; `SupportTicket`, a SITE_ADMIN-reviewed dept/priority/status/
  forward workflow scoped down from the design's fuller attachment/thread
  version). Public submission endpoints for both (no login); new
  `PANEL_NAV.SITE_ADMIN` `tickets` tab (closes a gap Phase 18 explicitly
  flagged); `SiteAdminDashboardPage` gains a third section for recent
  contact messages; ticket-forward target picker reuses
  `StaffDirectoryService` via DI rather than widening its EXEC_ROLES-only
  endpoint. `ContactPage.tsx`'s form also gained the `subject` field the
  design always required but the earlier build was missing. 11 new
  backend e2e tests, 6 new frontend tests. See `docs/API.md`/
  `docs/DB_SCHEMA.md`'s Phase 20 sections for full scope + explicit
  deferrals (attachments, reply threads, public ticket-status lookup).
- [x] **Phase 21 — فراموشی رمز (customer forgot/set password)** — third
  "dead forms" item. Also fixed a real design-mismatch bug found along the
  way: staff `LoginPage.tsx`'s "فراموشی رمز عبور؟" wrongly linked to a
  self-service flow — the design's own handler just shows a "contact IT"
  toast (staff has no self-service reset). Real flow reuses the existing
  OTP challenge (`/auth/otp/request` + `/auth/otp/verify`) to prove phone
  ownership, then a new `POST /auth/set-password` (`@Roles('USER')`, no
  current-password check) sets the password; a new `POST
  /auth/customer/login-password` closes the loop so that password is
  actually usable, and doubles as first-time password setup — giving real
  meaning to CLAUDE.md's "email+password optional" line for customers,
  which nothing had implemented before. `CustomerLoginPage.tsx` gained a
  small password-login toggle (the design itself has no password field
  for customers at all, so this is the minimal addition needed to make
  the new capability reachable). No schema change — reuses
  `User.passwordHash`. 9 new backend e2e tests, 6 new frontend tests. See
  `docs/API.md`/`docs/DB_SCHEMA.md`'s Phase 21 sections.
- [x] **Phase 22 — وضعیت پرواز (flight status lookup)** — fourth "dead
  forms" item. New public `GET /flight-status` (by flightNo or by
  origin+dest, both +date) using only real `FlightInstance`/`Route`/
  `Airport` data — no schema change. Confirmed `FlightInstanceStatus` is
  only `SCHEDULED | DEPARTED | CANCELLED`, with no gate/baggage-belt/
  delay-minutes/terminal column anywhere in the codebase, so the design's
  four operational stat boxes are explicitly NOT in the real response
  (would be fabricated data) — the real page shows only route, scheduled
  times, aircraft, and a derived status label; the delay-SMS checkbox is
  disabled "(به‌زودی)" for the same reason. Frontend reuses the existing
  `JalaliDatePicker` and `fetchAirports()`+`<select>` patterns already
  used by `HomeSearchPage.tsx`, replacing the design's free-text city
  inputs with the airport-code pickers the backend needs. 5 new backend
  e2e tests, 5 new frontend tests. See `docs/API.md`/`docs/DB_SCHEMA.md`'s
  Phase 22 sections.
- [x] **Phase 23 — وب‌سرویس آژانس (Agency B2B webservice)** — fifth and
  final "dead forms" item. `AgencyWebservicePage.tsx` was pure local mock
  state including a fake sample API key. Replicates Phase 16's
  `AgencyCreditRequest` request/decide pattern for a new
  `AgencyWebserviceRequest` table (agency requests a plan, an
  `AGENCY_TAB_ROLES` staff member decides), reusing Phase 3's already-real
  `AgenciesService.issueApiKey` (step-up-gated) verbatim on approval
  instead of duplicating key-issuance logic. Server-computed `priceIrr`
  from a fixed plan catalog (client can't set it — whitelist DTO 400s
  any extra field). Raw key delivery: since `AgencyApiKey` only ever
  stores `keyHash` (unchanged Phase 3 design), the raw key is delivered
  exactly once, on approval, via the agency's own message thread
  (`AgenciesService.postMessage`) rather than inventing a new channel or
  storing the secret retrievably — a bounded scope decision documented in
  docs/API.md's Phase 23 section. The rewritten frontend page shows
  request status (pending/rejected+retry) and, once approved, the active
  key's scope/status/activation metadata — never a raw key. 7 new backend
  e2e tests, 4 new frontend tests. See `docs/API.md`/`docs/DB_SCHEMA.md`'s
  Phase 23 sections for full scope + explicit deferrals.

This completes all five items from the post-Phase-18 "dead forms" punch
list (مدیریت رزرو, تماس با ما + پشتیبانی, فراموشی رمز, وضعیت پرواز,
وب‌سرویس آژانس).

- [x] **Phase 24 — پرواز (flightops: sale auto-close + نیرا manifest
  submission)** — closes the `flightops` gap flagged deferred since Phase
  18's `PANEL_NAV` notes (CEO/SITE_ADMIN/FINANCE_MANAGER/
  COMMERCIAL_MANAGER — the only 4 roles the design's own `roleDefs`
  grants it to). Read verbatim from the design: **not** gate/baggage/
  delay tracking (that's a different, still-unbuilt customer-facing
  concept, Phase 22's dropped stat boxes) — sale on each flight
  auto-closes 5h before departure and the full passenger manifest
  auto-uploads to سامانه نیرا (Iran's civil aviation manifest system) at
  that same moment. One new nullable column
  (`FlightInstance.niraSubmittedAt`, no new table); a `NiraProvider`
  interface + `MockNiraProvider` (same swappable-provider pattern as
  `SmsProvider`/`PaymentGateway`); lazy materialization on every
  `flightops` read once an instance crosses the threshold — no cron job,
  same "no cron job" pattern as `materializeDepartedInstances`/
  `materializeExpiry`. Explicitly deferred (documented, not an
  oversight): the 5h close does NOT block `POST /booking` — the design
  has no manual "close" action either, this is a reporting/manifest
  surface, not a new booking rule; a real نیرا HTTP integration; CSV/
  Excel manifest export. 8 new backend e2e tests + 5 unit tests
  (`sale-close.util.spec.ts` + `nira.service.spec.ts`), 3 new frontend
  tests. See `docs/API.md`/`docs/DB_SCHEMA.md`/
  `docs/features/flightops.md` for full scope + explicit deferrals.

Each phase = backend endpoints + tests + frontend page(s), fully working,
before the next phase starts, per `CLAUDE.md` workflow rules. A phase is
"done" only when every checklist item in its `docs/features/<name>.md` has
a passing test — see `docs/features/panel-shell-dashboard.md` for Phase 1.

## Notable findings from design extraction (informs later phases)

- Several panels contain orphaned tabs/handlers (coded, unreachable from
  the sidebar) — e.g. CEO panel's Agencies/Flights/Reservation tabs, Board
  Chair's Agencies/Flights/Passenger-search tabs. Treat the **currently
  reachable sidebar item list per panel** as authoritative, not every
  `sc-if` block present in the file.
- `ReservationSystem`'s seat-lock authorization (`role === 'super'`) has an
  unresolved mapping question — flagged in `docs/DB_SCHEMA.md`'s open items,
  needs a product decision before Phase 9.
- The design mocks use plaintext passwords and no 2FA at the login gate,
  a mutable credit/balance field instead of a ledger, and several
  client-formatted display strings for money — all explicitly overridden by
  `CLAUDE.md` in the real implementation (see inline notes in `DB_SCHEMA.md`/
  `API.md`).

## Known technical debt (pre-launch, not blocking current phases)

- All IRR money columns (`priceIrr`, `signedAmountIrr`, `limitIrr`,
  `amountIrr`) are Postgres `integer` (max ~2.14e9 ≈ 214,000,000 toman).
  Fine for per-ticket/per-invoice amounts and current seed data, but a
  large agency's credit line or a yearly revenue aggregate could
  plausibly exceed that. Needs an `Int` → `BigInt` migration (with a
  matching Prisma/TS + JSON-serialization review, since `bigint` doesn't
  `JSON.stringify` by default) before real financial figures are trusted
  at scale — surfaced during Phase 3 seed data, not fixed inline to avoid
  disturbing already-tested Phase 1 code without discussing the blast
  radius first.

## Commands

See `CLAUDE.md` → Commands. `docker compose up -d` starts Postgres+Redis;
`cd backend && npm run start:dev` / `cd frontend && npm run dev` /
`cd ml-service && uvicorn app.main:app --reload` for the three services.

- `cd backend && npm run seed` — (re)seeds one dev account per role, all
  sharing the password `Blujet@1404` (see `backend/prisma/seed.ts` — dev
  usernames: `ceo`, `chair`, `senior.rahimi`, `finance.karimi`,
  `comm.abbasi`, `itadmin`, `site.admin`, `com.ahmadi`), plus 6 months of
  sample flights/bookings so the dashboard has real numbers to show.
- Backend tests need a local Postgres reachable at the `DATABASE_URL` in
  `backend/.env` (dev db) and `backend/.env.test` (test db, `blujet_test`) —
  `npm run test:e2e` runs Jest+Supertest against the latter.
- `cd frontend && npm test` — Vitest+RTL unit/component tests.
- `cd frontend && npm run test:e2e` — Playwright, needs both dev servers
  running (`backend: npm run start:dev` on :3000, `frontend: npm run dev`
  on :5173).

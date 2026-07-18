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
  popular-route shortcuts sourced from real airport data (deliberately no
  fabricated prices/offers, since the backend has no featured-routes/promo
  API to source them from honestly). **Not yet done**: the body content of
  Results/Book/Checkout/Ticket (price calendar, AI price radar, seat map
  styling, boarding-pass ticket visual) is still the earlier
  functional/clean styling, not pixel-matched — only header/footer wrap
  them now. Also surfaced: `مقاصد`, `باشگاه مشتریان` (public marketing
  page), `درباره ما`, `تماس با ما`, `پشتیبانی`, `قوانین و مقررات`, and a
  real `مدیریت رزرو` (PNR lookup) page do not exist on this branch despite
  earlier task-list entries claiming them complete — the header/footer nav
  links point at these paths already (`/destinations`, `/club`, `/about`,
  `/contact`, `/support`, `/travel-info`, `/manage-booking`) so no further
  routing change is needed once the pages themselves are built; until
  then they fall through to the catch-all redirect to `/`.

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

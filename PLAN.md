# PLAN.md — blujet roadmap & progress

Scope of this track: the six executive management panels (پنل مدیر عامل،
پنل رئیس هیئت مدیره، پنل مدیر ارشد، پنل مدیر بازرگانی، پنل مدیر مالی، پنل
مدیر IT) plus the shared panel shell and reservation/lock system, per
`CLAUDE.md`. The public-facing site (search/booking/checkout/payment) is a
separate track, expected to merge with this one later — see
`docs/DB_SCHEMA.md`'s "Open items" for the reconciliation points.

## Status

- [x] Repo scaffold (frontend/backend/ml-service skeletons, design-reference import)
- [x] Design extraction — all 6 panels + shared shell + `ReservationSystem` read in full; findings folded into `docs/API.md` / `docs/DB_SCHEMA.md`
- [x] **Phase 1 — staff auth + RBAC + panel shell + dashboard/reporting** — see `docs/features/panel-shell-dashboard.md` for the proven checklist (35 backend + 21 frontend unit + 5 E2E tests, all passing; lint+typecheck clean in both packages). Known deferred scope, not silently dropped: IT Manager's real (service-health) dashboard, day/month/flight chart-mode UI, pixel-diff visual regression — see that doc's scope notes.
- [x] Phase 2 — flight/booking core (minimal read-side slice for reporting) — done as part of Phase 1's Prisma schema (Route/Flight/FlightInstance/Booking/LedgerEntry), since reporting needed real data to aggregate
- [x] **Phase 3 — Agencies (list/detail/credit/settlement/membership requests)** — backend: Prisma schema/migration/seed + full `agencies` module (all endpoints from `docs/API.md`'s Phase 3 table, role-reconciled), 25 integration tests (60 backend total). Frontend: آژانس‌ها list/detail/request pages with per-role differences (Senior: API keys; Finance: read+settle; Commercial: نمای کلی/مالی/مکاتبه‌ها sub-tabs, invoices, chat, debtors panel), 10 new Vitest+RTL tests (31 total) and 5 Playwright journeys. All checklist items in `docs/features/agencies.md` proven except the explicitly deferred ones listed at its end (Excel export, invoice description, refer-UI → Phase 4, agency-portal-side suspension). Lint+typecheck clean in both packages.
- [x] **Phase 4 — Cartable, referrals, manager messaging** — implemented end-to-end (docs approved 2026-07-17): 7 new tables, five backend modules (cartable با تأیید/رد/انتقال + نظر مدیر اجباری، ارجاعات مدیر ارشد با چرخه گزارش کامل، پیام سازمانی با تحویل به کارتابل، staff-directory، آپلود فایل), 23 backend tests + 9 Vitest + 3 Playwright loops. Totals now: 83 backend / 40 frontend / 14 Playwright, all green. Two explicitly deferred UI pieces (attachment chips UI → Phase 5, Jalali date-picker popover → shared component in Phase 5/7) listed at the end of `docs/features/cartable-referrals.md`. Merged to main (PR #3).
- [x] **Phase 5 — VIP club** — implemented end-to-end: ClubMember/ClubCardRequest schema (national ID checksum-validated, AES-256-GCM encrypted + HMAC hash for exact search), club module with the ⚑-approved authority rules (CEO/Chair approve any REFERRED, Senior only senior-assigned; direct issuance audited; tier change Senior-only), CEO/Chair rich layout + Senior simple layout, 13 backend tests + 4 Vitest + 4 Playwright journeys. Totals: 92 backend / 44 frontend / 18 Playwright. Merged to main (PR #4).
- [x] **Phase 6 — Ticket pricing proposals** — implemented end-to-end (docs approved 2026-07-17): FarePricingProposal FK-linked to FlightInstance (fixes the mocks' incompatible id schemes), pricing module with the locked-forever registration rule + CEO legal-rate path, the FIRST REAL ml-service (FastAPI price-suggestion: internal token, versioned heuristic, 11 pytest) behind a NestJS AiProvider client (2s timeout, graceful degradation — proven by a Playwright journey that runs with the real uvicorn service AND one with it down). CEO tab + Commercial pricing section (inside its مدیریت پروازها tab, per design). 8 backend + 5 Vitest + 3 Playwright new tests. Totals: 100 backend / 49 frontend / 21 Playwright / 11 pytest. Awaiting merge approval.
- [ ] **Phase 7 — Refunds** ← docs drafted (`docs/API.md`/`docs/DB_SCHEMA.md` Phase 7 + `docs/features/refunds.md`), awaiting approval. Key ⚑ decisions: the customer panel’s 4-bracket penalty engine becomes the seeded server-side rule (the mocks had 3 inconsistent schemes); pay gains a real ledger reversal + Booking→REFUNDED (mocks only flip a status field); IBAN/PII encrypted at rest.
- [ ] Phase 8 — Employee management (IT Manager: accounts, permissions, services, security policy, logs, backups) — **assigned to a separate Claude Code session per the user (2026-07-17); this track must NOT implement the IT Manager panel.** Coordinate via docs/API.md + DB_SCHEMA.md Phase 8 sections before either side writes code touching shared tables (User/Permission).
- [ ] Phase 9 — Reservation system (seat lock/PNR), embedded per-panel per the confirmed `role`/`lockOnly` contract
- [ ] Phase 10 — Flight management (مدیریت پروازها — Senior/Commercial): routes, schedules (RRULE), instances, capacity — the largest unscheduled tab; docs must be drafted from the design before code, same gate as every phase
- [ ] Phase 11 — Finance tab (مالی in 5 panels: income/expense chart, transactions) + گزارش مسافران + گزارش کارمندان
- [ ] Phase 12 — Remaining shell tabs: مدیران و ادمین‌ها, امنیت و رمز عبور, تنظیمات سامانه, CEO's لاگ و رویدادها, plus the UI for the two Phase-1 backends that still render "به‌زودی" (گزارش مدیران, دسترسی به پنل‌ها)

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

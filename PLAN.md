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
- [ ] **Phase 4 — Cartable, referrals, manager messaging** ← docs drafted (`docs/API.md`/`docs/DB_SCHEMA.md` Phase 4 + `docs/features/cartable-referrals.md`), awaiting approval before implementation. Key finding from extraction: the mocks' cartable/compose/referral flows are demo-only (nothing persists or routes) — the drafted docs define the real routing (messages/referrals/chair-requests deliver into recipients' cartables; transfer re-routes the task) as explicit ⚑-marked decisions for review.
- [ ] Phase 5 — VIP club card-request approval
- [ ] Phase 6 — Ticket pricing proposals (commercial → CEO approval)
- [ ] Phase 7 — Refunds (finance approval/payout)
- [ ] Phase 8 — Employee management (IT Manager: accounts, permissions, services, security policy, logs, backups)
- [ ] Phase 9 — Reservation system (seat lock/PNR), embedded per-panel per the confirmed `role`/`lockOnly` contract

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

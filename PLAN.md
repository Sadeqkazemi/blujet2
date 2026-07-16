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
- [ ] **Phase 1 — staff auth + RBAC + panel shell + dashboard/reporting** ← awaiting approval of `docs/API.md`/`docs/DB_SCHEMA.md` before implementation starts
- [ ] Phase 2 — flight/booking core (minimal read-side slice for reporting)
- [ ] Phase 3 — Agencies (list/detail/credit/settlement/membership requests)
- [ ] Phase 4 — Cartable, referrals, manager messaging
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

## Commands

See `CLAUDE.md` → Commands. `docker compose up -d` starts Postgres+Redis;
`cd backend && npm run start:dev` / `cd frontend && npm run dev` /
`cd ml-service && uvicorn app.main:app --reload` for the three services.

# Feature: Reservation system — seat lock & PNR management (Phase 9)

Covers `docs/API.md` → "Phase 9" and `docs/DB_SCHEMA.md` → "Phase 9".
Scope: the shared `ReservationSystem` component's PNR management, seat
map + managerial seat lock, staff-side manual PNR issuance, and search —
embedded in BOARD_CHAIR, SENIOR_MANAGER, IT_MANAGER panels (CEO is
API-authorized per the ⚑ product decision but has no reachable nav entry).
Agency API access (Phase 3 already covers it) and flight/schedule creation
(Phase 10) are explicitly out of scope.

## Acceptance checklist

Backend items proven by `backend/test/reservation.e2e-spec.ts` (13 tests,
128 total); frontend by `frontend/src/features/reservation/*.test.tsx` (3
tests, 59 total); E2E by `frontend/e2e/reservation-journey.spec.ts` (4
journeys, run against a fresh `POST /reservation/_test/flight-instance`
instance per journey — non-production-only, same pattern as
club/pricing's own `_test` seeding hooks — so results never depend on the
seed's ambiguous historical/demo instances).

### Seat map & locking
- [x] `GET /reservation/seatmap/:flightInstanceId` computed from `AircraftSeatMap` + sold `Passenger.seatCode` + active `SeatLock`s; correct row/column layout — `'GET /reservation/seatmap/:id computes rows from AircraftSeatMap with correct capacity'`
- [x] `POST /reservation/seatmap/:id/lock`: canLock roles only (403 for SENIOR_MANAGER); 409 on already-sold/-locked seat; PII encrypted+hashed, never returned in plaintext; audited (RESERVATION) — `'POST lock: canLock roles only, 409 on already-locked, encrypted PII never returned, audited'`
- [x] Concurrent lock attempts on the same seat: exactly one succeeds (DB partial-unique-index enforced) — `'concurrent lock attempts on the same seat: exactly one succeeds (DB-enforced)'` (5 parallel requests, 1×201/4×409)
- [x] `PATCH /reservation/seatmap/locks/:id/release`: canLock only; 409 on already-released; seat relockable after release — `'PATCH release: canLock only, 409 on already-released, seat becomes lockable again'`

### PNR management
- [x] `GET /reservation/pnr` grouped-by-flight, `q=` filters PNR/passenger name — `'GET /reservation/pnr lists grouped by flight and q= filters by PNR/passenger'`
- [x] `GET /reservation/pnr/:pnr` full detail; 404 for unknown PNR — `'GET /reservation/pnr/:pnr returns detail; unknown PNR -> 404'`
- [x] `PATCH /reservation/pnr/:pnr/seat`: canLock only (403 SENIOR_MANAGER); 409 on taken seat; 409 on CANCELLED booking; audited — `'PATCH /reservation/pnr/:pnr/seat changes seat; 409 on a taken seat and on a CANCELLED booking'`
- [x] `PATCH /reservation/pnr/:pnr/cancel`: canLock only; frees the seat for resale; 409 if already CANCELLED — `'PATCH /reservation/pnr/:pnr/cancel frees the seat for resale; 409 if already cancelled'`

### Search & manual issuance
- [x] `GET /reservation/search`: origin/dest/date → SCHEDULED instances + computed price + free-seat count — `'GET /reservation/search finds SCHEDULED instances on origin/dest/date with computed price + free seats'`
- [x] `POST /reservation/pnr` (manual issuance): canLock only (403 SENIOR_MANAGER); TICKETED Booking+Passenger+LedgerEntry(SALE), no payment step; 409 on unavailable seat; audited — `'POST /reservation/pnr issues a TICKETED booking directly (no payment step), 409 on unavailable seat, audited'`
- [x] `GET /reservation/dashboard-stats` real counts, no fabricated fields — `'GET /reservation/dashboard-stats returns real counts, no fabricated fields'`

### Role isolation
- [x] FINANCE_MANAGER/COMMERCIAL_MANAGER 403 on every endpoint — `'FINANCE_MANAGER and COMMERCIAL_MANAGER get 403 on every /reservation/* endpoint'`
- [x] SENIOR_MANAGER: reads 200, every write 403 — `'SENIOR_MANAGER: reads succeed, every write is 403 (view-only)'`

### Frontend
- [x] Seat map: free/sold/locked/business-vs-economy visual states, click-to-lock (canLock roles), release chips — `ReservationPage.test.tsx` + `reservation-journey.spec.ts`
- [x] PNR list + detail modal: boarding-pass-style card, change-seat form, cancel action — `'BOARD_CHAIR sees the PNR list and change-seat/cancel controls in the detail modal'`
- [x] Manual "رزرو جدید" form with flight search + seat pick + issue — `reservation-journey.spec.ts`
- [x] SENIOR_MANAGER sees the seat map read-only (disabled seat buttons) and the PNR detail modal has no change/cancel controls — `'SENIOR_MANAGER is view-only: no change-seat/cancel controls in the detail modal'` + E2E
- [x] Role isolation: FINANCE_MANAGER/COMMERCIAL_MANAGER have no reservation nav entry — `'Non-reservation role has no reservation nav entry (role isolation)'`

### E2E
- [x] BOARD_CHAIR locks a seat, sees it reflected on the map, releases it — `'BOARD_CHAIR locks a seat on the seat map, sees it reflected, then releases it'`
- [x] IT_MANAGER searches, issues a manual PNR, finds it in PNR management, cancels it — `'IT Manager issues a manual PNR, finds it in PNR management, then cancels it'`
- [x] SENIOR_MANAGER sees the seat map but has no lock/issue controls (view-only) — `'SENIOR_MANAGER sees the seat map read-only — no lock or issue controls'`
- [x] Non-reservation role has no reservation nav entry — `'Non-reservation role has no reservation nav entry (role isolation)'`

### Deferred (scoped out with reasons, not silently dropped)
- Ticket print/PDF generation — no «چاپ بلیط» button wired this phase; a real PDF pipeline needs the public-site track's e-ticket template.
- Seat map's exact aisle-gap rendering (design shows a precise business-2-2/economy-2-3 gap position) — approximated as "gap after the 2nd seat" rather than reading the exact column-group split from the API response, to keep the seat grid component simple; visually close but not pixel-identical to the design.
- Agency API access sub-tab — already covered by Phase 3's `AgencyApiKey`; not duplicated here.
- Flight/schedule/capacity creation ("پروازها" sub-tab) — Phase 10's own scope.
- The design's fabricated "microservices health" dashboard cards — replaced with real booking/seat/revenue stats instead (see `docs/DB_SCHEMA.md`'s Phase 9 note); not ported verbatim since no such infrastructure exists in this monolith.

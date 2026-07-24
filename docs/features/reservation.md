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

### Phase 30 — data-driven seat-map aisle gap
- [x] `GET /reservation/seatmap/:id` returns `cabinLayout.{BUSINESS,ECONOMY}.aisleAfterIndex`, computed from that flight's real `AircraftSeatMap.{business,economy}ColsLeft.length` (via `resolveAircraftType`, so an aircraft-type override is respected) instead of the frontend assuming a fixed seat position — proven against both the seeded 2-2/2-3 config AND a distinct custom aircraft type with a reversed 3-2 economy split, so the test can't pass by coincidence — `backend/test/reservation.e2e-spec.ts: 'GET /reservation/seatmap/:id returns cabinLayout.aisleAfterIndex reflecting the real per-aircraft column split, not a fixed assumption'`
- [x] `ReservationPage.tsx`'s seat grid renders the aisle gap at `cabinLayout[row.cabin].aisleAfterIndex` per row instead of the previous hardcoded `idx === 1` — proven with a non-2/2-2/3 fixture that a fixed-index component would place wrong — `ReservationPage.test.tsx: 'renders the aisle gap from cabinLayout.aisleAfterIndex per row, not a fixed seat position'`

### Phase 36 — عدم حضور مسافر (mark no-show)

`PATCH /reservation/pnr/:pnr/no-show` (Phase 13 Part E, `CAN_LOCK_ROLES`)
shipped fully implemented and e2e-tested but had no frontend control —
found via the same endpoint-vs-frontend-caller audit as Phase 35's
reconciliation-queue gap. No design-reference screen mentions «عدم
حضور»/no-show at all (see `docs/DB_SCHEMA.md`'s Phase 13 Part E note —
there's no boarding/check-in concept in the design to attach a control
to), so this is a small, natural addition to the already-built PNR-detail
modal (next to the existing «تغییر صندلی»/«لغو رزرو» actions) rather than
a new screen.

- [x] The PNR detail modal shows a «ثبت عدم حضور مسافر» button for a
      `canLock` role when the booking is `TICKETED` or `FLOWN`, calling
      the existing endpoint and refreshing the detail + list on success —
      `ReservationPage.test.tsx: 'a canLock role can mark a TICKETED
      booking as no-show, and the detail refreshes'`
- [x] The button is not offered for a `CANCELLED` booking (the backend's
      own 409 `CONFLICT` guard is not relied on to hide it) —
      `ReservationPage.test.tsx: 'no-show is not offered for a CANCELLED
      booking'`
- [x] `FLOWN`/`NO_SHOW` added to the frontend's `BookingStatus` type and
      status-badge map (`فروخته → پرواز شده`/`عدم حضور`) — same tests

### Deferred (scoped out with reasons, not silently dropped)
- Ticket print/PDF generation — no «چاپ بلیط» button wired this phase; a real PDF pipeline needs the public-site track's e-ticket template.
- Agency API access sub-tab — already covered by Phase 3's `AgencyApiKey`; not duplicated here.
- Flight/schedule/capacity creation ("پروازها" sub-tab) — Phase 10's own scope.
- The design's fabricated "microservices health" dashboard cards — replaced with real booking/seat/revenue stats instead (see `docs/DB_SCHEMA.md`'s Phase 9 note); not ported verbatim since no such infrastructure exists in this monolith.
- Managerial seat-lock request/approval queue (`PATCH
  /reservation/seatmap/locks/:id/approve`/`reject`, `POST
  /reservation/pnr/from-lock/:lockId`) — still deliberately backend-only;
  `docs/API.md`'s Phase 13 Part D note already documents "no design
  screen exists for a request/approval queue," and building one now would
  mean inventing a multi-step approval UI with no reference to build it
  against — a larger, real product-design task, not a small wiring job
  like this phase's no-show button.

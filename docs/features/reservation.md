# Feature: Reservation system — seat lock & PNR management (Phase 9)

Covers `docs/API.md` → "Phase 9" and `docs/DB_SCHEMA.md` → "Phase 9".
Scope: the shared `ReservationSystem` component's PNR management, seat
map + managerial seat lock, staff-side manual PNR issuance, and search —
embedded in BOARD_CHAIR, SENIOR_MANAGER, IT_MANAGER panels (CEO is
API-authorized per the ⚑ product decision but has no reachable nav entry).
Agency API access (Phase 3 already covers it) and flight/schedule creation
(Phase 10) are explicitly out of scope.

## Acceptance checklist

Backend items proven by `backend/test/reservation.e2e-spec.ts`; frontend by
`frontend/src/features/reservation/*.test.tsx`; E2E by
`frontend/e2e/reservation-journey.spec.ts`.

### Seat map & locking
- [ ] `GET /reservation/seatmap/:flightInstanceId` computed from `AircraftSeatMap` + sold `Passenger.seatCode` + active `SeatLock`s; correct row/column layout for the seeded aircraft type
- [ ] `POST /reservation/seatmap/:id/lock`: canLock roles only (403 for SENIOR_MANAGER/others); 409 on an already-sold or already-locked seat; PII encrypted+hashed, never returned in plaintext; audited (RESERVATION)
- [ ] Concurrent lock attempts on the same seat: exactly one succeeds (DB partial-unique-index enforced, not just app-level)
- [ ] `PATCH /reservation/seatmap/locks/:id/release`: canLock only; 409 on an already-released lock; audited
- [ ] Released seat becomes lockable/sellable again

### PNR management
- [ ] `GET /reservation/pnr` lists grouped-by-flight, `q=` filters by PNR/passenger name; all 4 reservation roles can read
- [ ] `GET /reservation/pnr/:pnr` returns full detail; 404 for unknown PNR
- [ ] `PATCH /reservation/pnr/:pnr/seat`: canLock only (403 for SENIOR_MANAGER); 409 if target seat sold/locked by someone else; 409 on a CANCELLED booking; audited
- [ ] `PATCH /reservation/pnr/:pnr/cancel`: canLock only; frees the seat for resale; 409 if already CANCELLED; audited

### Search & manual issuance
- [ ] `GET /reservation/search`: origin/dest/date → matching SCHEDULED instances with computed price + free-seat count
- [ ] `POST /reservation/pnr` (manual issuance): canLock only (403 for SENIOR_MANAGER); creates TICKETED Booking+Passenger+LedgerEntry(SALE) directly, no payment step; 409 if seat unavailable; audited
- [ ] `GET /reservation/dashboard-stats` returns real counts (today's bookings, active PNRs, seats sold, revenue) — no fabricated service-health data

### Role isolation
- [ ] FINANCE_MANAGER/COMMERCIAL_MANAGER get 403 on every /reservation/* endpoint (no reachable nav entry either)
- [ ] SENIOR_MANAGER: read endpoints 200, every write endpoint 403 (view-only, per the design's confirmed behavior)

### Frontend
- [ ] Seat map: correct free/business/sold/locked/selected visual states, click-to-lock (canLock roles), release chips
- [ ] PNR list + detail: boarding-pass card, change-seat form, cancel action, print stub
- [ ] Manual "صدور PNR و بلیط" form with flight search
- [ ] SENIOR_MANAGER sees the seat map read-only (no lock/release/change/cancel/issue controls)
- [ ] Role isolation: FINANCE_MANAGER/COMMERCIAL_MANAGER have no reservation nav entry

### E2E
- [ ] BOARD_CHAIR locks a seat, sees it reflected on the map, releases it
- [ ] IT_MANAGER issues a manual PNR, finds it in PNR management, cancels it
- [ ] SENIOR_MANAGER sees the seat map but has no lock/issue controls (view-only)
- [ ] Non-reservation role has no reservation nav entry (role isolation)

### Deferred (scoped out with reasons, not silently dropped)
- Ticket print/PDF generation — "چاپ بلیط" button is wired to a stub (opens the boarding-pass card in a print-friendly view via `window.print()`); a real PDF pipeline needs the public-site track's e-ticket template, out of scope here.
- Agency API access sub-tab — already covered by Phase 3's `AgencyApiKey`; not duplicated here.
- Flight/schedule/capacity creation ("پروازها" sub-tab) — Phase 10's own scope.

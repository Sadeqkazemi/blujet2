# PSS core — electronic ticket documents and flight coupons

This phase replaces the passenger-only ticket-number marker with an auditable
airline ticket document model shared by public checkout, agency/API sales, and
staff manual issuance. It is the first PSS completion phase and the data
foundation for later DCS check-in/boarding, exchange/reissue, EMD, NDC/GDS, and
revenue-accounting work.

## Acceptance checklist

### Data model and migration

- [x] Every issued passenger owns exactly one `TicketDocument` for the current
      one-segment booking; the document number is unique and remains mirrored
      in `Passenger.ticketNo` for backward-compatible API/UI consumers.
- [x] Every ticket document owns one `FlightCoupon` for the booking's flight
      instance. The coupon captures immutable origin, destination, flight,
      cabin, fare-class, fare, tax, and issue-time snapshots.
- [x] Ticket-document status is constrained to
      `ISSUED | VOID | REFUNDED | EXCHANGED`; flight-coupon status is
      `OPEN | CHECKED_IN | BOARDED | FLOWN | REFUNDED | VOID | EXCHANGED`.
- [x] Existing issued passengers are backfilled idempotently into ticket
      documents and coupons without changing their ticket numbers.

### Issuance and retrieval

- [x] One shared `TicketingService` issues documents inside the caller's
      existing database transaction; no booking can become `TICKETED` while
      its passenger ticket documents are missing.
- [x] Public payment, agency/API booking, staff manual PNR issuance, and
      managerial seat-lock finalization all call the same idempotent issuer.
- [x] Repeating the same issuance command returns the existing documents and
      never creates a second document/coupon.
- [x] Authenticated booking detail and staff PNR detail expose ticket-document
      and coupon data while preserving existing `ticketNo` fields.

### Lifecycle integrity

- [x] A completed flight materializes `OPEN` coupons as `FLOWN`; a manual
      no-show keeps the ticket auditable without inventing a check-in event.
- [x] A confirmed full refund changes the corresponding document and open
      coupon to `REFUNDED` in the same financial transaction.
- [x] Database constraints prevent duplicate passenger documents, duplicate
      segment coupons, invalid statuses, and orphaned documents.

### Verification

- [ ] Unit tests cover idempotent issuance and immutable snapshots.
- [x] Backend E2E proves one passenger = one ticket document = one coupon for
      customer, agency, and staff issuance paths.
- [ ] Migration, seed, lint, build, unit, and E2E suites pass.

## Explicitly subsequent PSS phases

- DCS commands for check-in, baggage acceptance, boarding, gate control, and
  load/weight-and-balance use the coupon lifecycle introduced here.
- Exchange/reissue creates a new document and marks the prior document/coupon
  `EXCHANGED`; it is not simulated by editing an issued document.
- EMD documents for paid ancillary services are separate accountable
  documents and are not represented by a flight coupon.
- NDC/GDS distribution reads offers/orders/tickets through an adapter and
  never writes inventory outside the reservation transaction boundary.

# DCS core — airport departure control

This phase introduces a separate airline-operations surface backed by PSS
flight coupons. It is not a public website workflow: the public site may later
call a restricted online-check-in facade, while airport agents use these DCS
commands through the Operations panel.

## Acceptance checklist

### Flight control and manifest

- [x] `GET /dcs/flights` returns scheduled/departing flights with coupon-based
      booked, checked-in, boarded, baggage-piece and baggage-weight totals.
- [x] `GET /dcs/flights/:flightInstanceId` returns the operational manifest,
      coupon/document identity, passenger/seat, booking status and baggage.
- [x] Access is limited to `OPERATIONS_MANAGER`, `SITE_ADMIN`, and authorized
      operational employees; finance/commercial/customer/agency roles fail.

### Check-in and boarding

- [x] `POST /dcs/coupons/:couponId/check-in` locks the coupon, accepts only
      `OPEN`, validates the check-in window and seat, assigns a unique boarding
      pass number, then transitions the coupon to `CHECKED_IN` transactionally.
- [x] A repeated check-in is idempotent and returns the existing operation.
- [x] `POST /dcs/coupons/:couponId/board` accepts only `CHECKED_IN`, records
      actor/time/gate and transitions to `BOARDED`; duplicate scans are
      idempotent while invalid coupon states fail closed.
- [x] Every state transition is audited and concurrency-safe.

### Baggage

- [x] Every accepted bag has a unique tag, integer weight in grams, acceptance
      actor/time and lifecycle `ACCEPTED | LOADED | OFFLOADED | DELIVERED`.
- [x] Baggage can only be accepted for a checked-in coupon. Duplicate bag tags
      and non-positive/implausible weights are rejected.
- [x] Flight and passenger totals are computed from bag rows, never mutable
      counters.

### Load control foundation

- [x] `GET /dcs/flights/:id/load-summary` returns passenger counts by cabin and
      aircraft zone, standard passenger weight, baggage weight, cargo input,
      traffic load, takeoff weight and landing weight.
- [x] Structural limits are explicit inputs/configuration; exceedance is a
      hard `NOT_RELEASED` result with reasons. No AI or UI may authorize a load.
- [x] Certified CG/%MAC calculation remains disabled until aircraft-specific
      arms, datum, MAC and approved envelope data are configured; the API says
      `balanceStatus=CONFIGURATION_REQUIRED` rather than fabricating safety
      values.

### Verification

- [x] Migration and seed pass.
- [x] E2E covers check-in → baggage → boarding and role/state/concurrency
      failures against real PostgreSQL.
- [ ] Backend build, unit and full E2E suites pass.

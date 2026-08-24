# National ID seat limit — acceptance checklist

Rule: on one flight, a given Iranian national ID may occupy at most **2 seats**
(same passenger info may be used twice). A third seat with that کد ملی is forbidden.

## Backend
- [x] In-request: >2 seat-occupying passengers with the same national ID → `400 VALIDATION_FAILED` — `national-id-seat-limit.spec.ts`
- [x] Infants (no seat) do not count — `national-id-seat-limit.spec.ts`
- [x] Cross-booking on same `flightInstanceId` (active DRAFT/HELD/PAID/TICKETED) counted via `nationalIdHash` — `assertNationalIdSeatLimitForFlight` in `booking.service` (public + agency allotment)
- [x] Enforced inside booking transaction after flight row lock
- [x] An adjacent EXST counts as the passenger's second occupied seat, both in
  the current request and in existing active bookings
- [x] Expired HELD bookings do not consume the limit

## Frontend
- [x] Checkout blocks step advance / submit when the same national ID appears on >2 seat passengers — `CheckoutPage` + `national-id-seat-limit.ts`
- [x] Guest checkout validates missing/invalid identity fields before opening
  the OTP dialog and shows a localized inline error on the exact field

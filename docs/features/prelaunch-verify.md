# Pre-launch verification — full golden path

Acceptance checklist for the end-to-end scenario requested before go-live:
wipe transactional passenger/flight data, recreate flights via commercial
manager + CEO price approval, customer OTP purchase with reservation seat
occupancy, refund through finance, agency approve/reject + API + allotment,
IT employee create.

## How to run

```bash
# optional: clear passengers / flights / bookings (keeps staff + airports)
cd backend && npx tsx scripts/prelaunch-reset.ts
cd backend && npm run seed   # restore catalog flights if needed for other tests

# automated proof (uses blujet_test + seed via jest globalSetup)
cd backend && npm run test:e2e -- prelaunch-verify
```

Staff mock credentials (seed): password `Blujet@1404` — `comm`, `ceo`,
`finance`, `site.admin`, `itadmin`, `senior`. Customer OTP in non-prod is
fixed / readable via `GET /auth/_test/last-otp/:phone`.

## Checklist

| # | Behavior | Proven by |
|---|----------|-----------|
| 1 | Commercial creates THR↔MHD (+ extra route) flights | `prelaunch-verify.e2e-spec.ts` createAndPriceFlight |
| 2 | Commercial plans price; CEO registers → REGISTERED | same + `/pricing/proposals/:id/register` |
| 3 | Search lists CEO-approved prices | GET `/search/flights` assertions |
| 4 | Customer OTP register (mock); incomplete profile signal | `/my/profile` completionPct + `/customers/incomplete-count` |
| 5 | Customer panel named after profile; purchase to TICKETED | PATCH profile + POST `/bookings` + pay |
| 6 | Chosen seat appears SOLD on reservation seat map while HELD/TICKETED | GET `/reservation/seatmap/:id` |
| 7 | System auto-assigns seat when `seatCode` omitted | second booking without seatCode |
| 8 | Sale visible in user `/bookings/me`, finance recent tx, passenger reports, site-admin customer purchases | panel GETs |
| 9 | Customer refund → site.admin refer → finance pay | `/my/refunds` + `/refunds/:id/refer` + pay |
| 10 | After PAID refund, seat is FREE again on reservation map | seatmap after refund (occupancy filter fix) |
| 11 | Two agency requests: site.admin refer → commercial approve one + reject one | `/agencies/requests/*` |
| 12 | Approved agency logs in, requests API, senior approves key | agency-portal webservice + decide |
| 13 | Commercial allocates seats to agency; agency sees allotment | POST allotments + GET agency-portal/allotments |
| 14 | IT creates named employee; employee can login | POST `/it/employees` + staff login |

## Gaps closed in this phase

- Reservation seat map / PNR sold-conflict treated REFUNDED / EXPIRED /
  past-TTL HELD seats as still occupied — aligned with search via
  `applyOccupyingBookingFilter` (`booking-seat-occupancy.ts`).
- `POST /bookings` `seatCode` is optional; when omitted the first free
  cabin seat is assigned under the same row lock.
- Public search Redis cache is invalidated when a flight is created or a
  CEO registers a price (new flights appear immediately).
- Agency signup/approve now stores phones as E.164 (`+98…`) so
  `POST /auth/agency/login` finds the account after commercial approval.
- `NODE_ENV=test` skips Throttler so multi-role golden paths are not flaky.

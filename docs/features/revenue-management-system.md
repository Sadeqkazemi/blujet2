# Revenue Management System boundary

BluJet RMS uses the central flight inventory, fare classes, channel releases,
bookings and immutable ledger data. It is advisory: recommendations never
publish themselves, and Commercial/CEO governance remains the only path that
changes a live fare or released inventory.

## Acceptance checklist

- [x] `GET /rms/portfolio` returns the existing real active/future/completed
      flight portfolio and reconciled revenue/inventory metrics.
- [x] `GET /rms/flights/:id/control` returns class capacity, channel releases,
      sold/available seats, price history and revenue from PostgreSQL.
- [x] `POST /rms/flights/:id/fare-rules/:ruleId/recommendation` returns an
      advisory recommendation based on load factor, time to departure, current
      fare and competitor observation, preferring ML with a labelled heuristic
      fallback.
- [x] Recommendation calls do not mutate `FareRule`, inventory, tickets or
      ledgers. Publishing remains on the governed Commercial/CEO endpoints.
- [x] Finance/agency/customer roles cannot access RMS controls.

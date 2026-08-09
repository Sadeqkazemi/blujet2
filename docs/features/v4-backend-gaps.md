# Feature: V4 backend gaps (schedule templates, bank loans, destination stats)

## Non-goals (hard)

- Do **not** change OPERATIONS_MANAGER panel, menus, permissions, or
  `PENDING_OPERATIONS` / `OPERATIONS_REJECTED` workflow.
- Keep commercial → CEO pricing register path unchanged.
- Do **not** modify MD-80 seat map / AircraftSeatMap rows for MD-80.

## 1) Seasonal flight schedule templates

- [x] Preview dates without persisting — `schedule-templates.e2e-spec.ts`
- [x] Create with idempotency key; materialize instances in one transaction
- [x] Conflict detection (flightNo + departureAt / aircraft overlap)
- [x] Airport-local departure time → UTC via airport `tz` — `schedule-template.dates.spec.ts`
- [x] Cabin capacities derived from `AircraftDefinition` cabins
- [x] Deactivate future instances without deleting sold history
- [x] Unit + e2e: weekdays, range, replay, conflict

## 2) Bank loan adapter (no internal underwriting)

- [x] Config-driven bank HTTP adapter (no hard-coded bank name/URL)
- [x] Create → `bankReferenceId`; poll/status; signed webhook
- [x] Idempotent create + webhook; circuit breaker + timeout + backoff
- [x] Customer sees only own apps + display status mapping
- [x] SITE_ADMIN read-only list/detail
- [x] No mock auto-approval / wallet credit unless bank instructs with unique ref
- [x] Tests mock HTTP/provider boundary — `bank-loans.e2e-spec.ts`

## 3) Destination stats

- [x] Public endpoint returns domestic/international/active counts from
      airport catalog ∩ published flights (zeros when empty) — `destination-stats.e2e-spec.ts`
- [x] Never returns hard-coded 12 or 200+

# Feature: Flight approval workflow (operations → CEO → publish)

Acceptance checklist for Phase 1 (evolve-in-place on `FlightInstance.definitionStatus`).

## Status machine

| Status | Meaning |
|--------|---------|
| `DRAFT` | Commercial draft (not submitted) |
| `PENDING_OPERATIONS` | Awaiting operations manager review |
| `OPERATIONS_REJECTED` | Ops rejected; commercial can edit + resubmit |
| `PENDING_CEO` | Ops approved; awaiting CEO price/definition register |
| `REJECTED` | CEO rejected |
| `PENDING_REVISION` | Live published flight has pending commercial edit |
| `PUBLISHED` | Sellable (was `APPROVED`) |

### Allowed transitions

- `DRAFT` → `PENDING_OPERATIONS` (submit-operations)
- `PENDING_OPERATIONS` → `OPERATIONS_REJECTED` | `PENDING_CEO` (ops-decision)
- `OPERATIONS_REJECTED` | `REJECTED` → `PENDING_OPERATIONS` (resubmit)
- `PENDING_CEO` → `PUBLISHED` (CEO register/approve pricing)
- `PENDING_CEO` → `REJECTED` (CEO reject)
- `PUBLISHED` → `PENDING_REVISION` (commercial edit of live flight)
- `PENDING_REVISION` → `PENDING_OPERATIONS` (submit revision through ops again)

Invalid transition → HTTP `409 CONFLICT`.

## FE presentation mapping (`publishStatus` / ui)

| definitionStatus | publishStatus / ui |
|------------------|--------------------|
| `PENDING_OPERATIONS` | `PENDING_APPROVAL` / `pending_ops` |
| `OPERATIONS_REJECTED` | `REJECTED` / `ops_rejected` |
| `PENDING_CEO` \| `PENDING_REVISION` | `PENDING_APPROVAL` / `pending_ceo` |
| `PUBLISHED` | `PUBLISHED` / `registered` |
| `REJECTED` | `REJECTED` |
| `DRAFT` | `DRAFT` |

## Endpoints

- [ ] `POST /flights` creates `DRAFT` (not `PENDING_CEO`)
- [ ] `POST /flights/:id/submit-operations`
- [ ] `GET /flights/operations-queue`
- [ ] `POST /flights/:id/operations-decision` (comment required, `expectedVersion`)
- [ ] `GET /flights/:id/history`
- [ ] CEO `PATCH /pricing/proposals/:id/register` (and `/approve`) → `PUBLISHED`
- [ ] Public search only returns sellable (`PUBLISHED` or `PENDING_REVISION`+snapshot)
- [ ] Optimistic lock: stale `expectedVersion` → 409
- [ ] Migration maps legacy `APPROVED` → `PUBLISHED` without deleting rows
- [ ] RBAC: ops role cannot publish; commercial cannot ops-decide; non-ops 403

## Deferred (stubs only)

- Pricing alerts / AI recommendation job
- Loan applications
- Transactional outbox for domain events

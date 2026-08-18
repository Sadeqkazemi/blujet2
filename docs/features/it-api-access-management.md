# IT Manager — Agency API Access Management

## Status

Frontend-only preview. Every screen described here is implemented and
reviewable in the IT Manager panel under
**«وب‌سرویس‌ها / دسترسی API آژانس‌ها»** (`/panel/apiaccess`), a standalone
nav tab injected client-side (see `frontend/src/components/PanelShell.tsx`'s
`IT_MANAGER_PREVIEW_NAV`) since backend `PANEL_NAV`
(`backend/src/modules/panels/panel-nav.config.ts`) cannot be touched in this
phase. All data on the page comes from either:

- **Real backend endpoints** IT_MANAGER already has access to — agency
  identity (`GET /agencies`) and the route/flight catalog
  (`GET /reservation/flights`, gated by `RESERVATION_ROLES` which includes
  `IT_MANAGER`); or
- **A TEMP/DEV-ONLY mock adapter**, `frontend/src/api/it-webservice-access-mock.ts`,
  for the genuinely new records (access requests, per-environment
  credentials, usage/security/audit data) that have no backend yet.

No mock-backed action in this phase is operational. Nothing here writes to
the real database. This document is the acceptance checklist and API
contract for the real backend implementation that should replace the mock
adapter.

## Relationship to the existing agency API

blujet already has a narrower, working agency API surface —
`docs/features/direct-agency-booking-api.md` — with a real `AgencyApiKey`
entity (`frontend/src/types/agencies.ts`): one key per agency, `scope`
(`FULL` / `SEARCH_BOOK` / `SEARCH_ONLY`), `status` (`ACTIVE` / `SUSPENDED`),
issued through a purchase-request → cartable-approval flow
(`AgencyWebservicePage.tsx` on the agency-portal side).

This feature is a **superset**, not a parallel system. The real backend for
it must **extend** `AgencyApiKey` (or a new table that supersedes it) —
never create a second, disconnected key store for the same agencies. New
capabilities this admin page needs that the current entity does not have:

- Two keys per agency (Sandbox **and** Production), not one.
- Fine-grained scopes beyond the three existing ones (see below).
- Per-key rate limit, IP/CIDR allowlist, and expiration.
- Per-key rotate/suspend/reactivate/revoke actions and an admin-facing
  request queue (the current flow only supports agency-initiated purchase +
  admin cartable approval, not IT-manager-driven review with an explanation
  and full monitoring).

## Endpoints

All under an internal-only, IT_MANAGER-gated base path. Suggested prefix:
`/it/webservice-access`. Every endpoint requires an authenticated
`IT_MANAGER` session (see RBAC below) and returns the project's standard
envelope (`{ success, data?, error? }`).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/it/webservice-access/requests` | List access requests. Query: `q`, `agencyId`, `environment`, `status`, `route`, `dateFrom`, `dateTo`. |
| `GET` | `/it/webservice-access/requests/:id` | Request detail. |
| `POST` | `/it/webservice-access/requests/:id/approve` | Approve a `PENDING` request. Body: `{ note?: string }`. |
| `POST` | `/it/webservice-access/requests/:id/reject` | Reject a `PENDING` request. Body: `{ note?: string }`. |
| `GET` | `/it/webservice-access/credentials` | List credentials. Query: `agencyId`, `environment`. |
| `POST` | `/it/webservice-access/credentials` | Issue a new credential. Body: `{ agencyId, environment, config: AccessConfig }`. Response includes the raw secret **once**. |
| `POST` | `/it/webservice-access/credentials/:id/rotate` | Rotate — invalidates the old secret, returns a new raw secret once. |
| `POST` | `/it/webservice-access/credentials/:id/suspend` | Suspend (temporary). |
| `POST` | `/it/webservice-access/credentials/:id/reactivate` | Reactivate a suspended credential. |
| `POST` | `/it/webservice-access/credentials/:id/revoke` | Revoke permanently — irreversible. |
| `PATCH` | `/it/webservice-access/credentials/:id/config` | Update `AccessConfig` (scopes/routes/flights/rate limit/IP list/expiry). |
| `GET` | `/it/webservice-access/usage` | Usage summary. Query: `agencyId`, `environment`, `endpoint`, `dateFrom`, `dateTo`. |
| `GET` | `/it/webservice-access/security-events` | Security event list (rate-limit breach, IP rejection, invalid key, …). |
| `GET` | `/it/webservice-access/audit-log` | Admin-action audit trail for this feature. |
| `GET` | `/it/webservice-access/requests-log` | Sanitized per-request metadata for the monitoring detail modal. |

## Request/response payloads

```ts
type ApiEnvironment = 'SANDBOX' | 'PRODUCTION';
type ApiScopeKey = 'SEARCH' | 'BOOK' | 'TICKET_ISSUE' | 'CANCEL_REFUND' | 'PNR_MANAGE' | 'REPORTING';

interface AccessConfig {
  scopes: ApiScopeKey[];
  allowedRoutes: string[];      // [] = all routes
  allowedFlightIds: string[];   // required in practice when TICKET_ISSUE/CANCEL_REFUND is granted
  rateLimitPerMinute: number;   // 1–6000
  allowedCidrs: string[];       // [] = no IP restriction
  expiresAt: string | null;     // ISO 8601, must be in the future
}

interface AgencyApiCredential {
  id: string;
  agencyId: string;
  environment: ApiEnvironment;
  keyId: string;                // safe public identifier
  maskedKey: string;            // e.g. "sk_live_••••••••3f9a" — NEVER the full secret
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
  createdAt: string;
  lastUsedAt: string | null;
  config: AccessConfig;
}

// Only the issue/rotate response ever carries this:
interface AgencyApiCredentialIssued extends AgencyApiCredential {
  rawKey: string;
}
```

Full type definitions (including `ApiAccessRequest`, `ApiUsageSummary`,
`ApiSecurityEvent`, `ApiAuditLogEntry`, `ApiRequestLogEntry`) live in
`frontend/src/types/it-webservice-access.ts` and should be regenerated from
the real OpenAPI spec once the backend exists (per this repo's
`openapi-typescript` convention) rather than hand-copied.

## Validation rules

- `issue`/`config` update: at least one scope required; `rateLimitPerMinute`
  integer in `[1, 6000]`; each `allowedCidrs` entry must be a valid
  IPv4/CIDR; `expiresAt`, if set, must be strictly in the future. (Client-side
  mirror: `frontend/src/features/it-webservice/AccessConfigFields.tsx`'s
  `validateAccessConfig`.)
- `issue` rejects a second `ACTIVE` credential for the same
  `(agencyId, environment)` pair — rotate the existing one instead.
- `approve`/`reject` only act on a request currently `PENDING`; re-deciding
  an already-decided request is a 409/validation error, not a silent no-op.
- `TICKET_ISSUE` or `CANCEL_REFUND` in `scopes` without at least one entry in
  `allowedFlightIds` should be rejected server-side (the UI already nudges
  this, but must not be trusted as the only enforcement).

## RBAC rules

- Every endpoint: `@Roles('IT_MANAGER')`. No other role, including
  `SITE_ADMIN`, should be granted this surface without an explicit product
  decision — it is intentionally narrower than full agency management
  (`agencies.controller.ts`, which already covers credit/settlement/status
  for `COMMERCIAL_MANAGER`/`FINANCE_MANAGER`/`SITE_ADMIN`).
- `GET` endpoints may be safe for a future narrowly-scoped `EMPLOYEE`
  permission (mirroring `sv_control`'s pattern in
  `backend/src/modules/it-manager/permission-catalog.ts`), but mutation
  endpoints (issue/rotate/suspend/revoke/approve/reject) should stay
  `IT_MANAGER`-only until a real requirement for delegation appears — do not
  add this speculatively.
- Tenant isolation: every credential/request/usage row must resolve through
  `agencyId`, matching this repo's `Agency.user_id UNIQUE` / one-agency-one-
  account model. An agency must never see another agency's data (enforced
  today on the agency-portal side by `agency-portal.controller.ts`; this
  admin surface additionally must never leak one agency's raw secret to a
  request scoped to a different `agencyId`).

## Audit requirements

Every state-changing action (`approve`, `reject`, `issue`, `rotate`,
`suspend`, `reactivate`, `revoke`, `config` update) must write an
append-only audit row: actor, action, target `agencyId`/`credentialId`,
before/after status, and timestamp — matching this repo's existing
`AuditLogRow` pattern (`backend/src/modules/audit`) and the general
Financial/Security Rules in `CLAUDE.md` ("Audit log (append-only) for every
booking change, payment event and admin action"). The mock adapter's
`fetchApiAuditLog()` shape (`ApiAuditLogEntry`) is a direct stand-in for
this.

## Secret-handling requirements

- The full API key is generated once, returned exactly once in the
  issue/rotate response body, and **never stored in retrievable form** —
  only a hash (mirroring `AgencyApiKey.keyHash` today) plus a masked display
  form (`maskedKey`, e.g. `sk_live_••••••••3f9a`).
- No endpoint may ever return a previously-issued raw secret again. The
  frontend's "کپی" action must only be reachable from the one issue/rotate
  response — confirmed by
  `ItWebserviceAccessPage.test.tsx`'s "reveals the raw secret exactly once"
  test.
- Secrets, tokens, and passwords are never written to logs (Pino redact
  paths, per `CLAUDE.md`'s Observability rules) or to the audit/request-log
  tables — `ApiRequestLogEntry` is explicitly a *sanitized* shape (method,
  endpoint, status code, response time, masked IP, request ID) with no
  token/PII fields, and the monitoring detail modal must keep rendering only
  that shape.
- Passenger PII must never appear in usage/security/audit/request-log data
  for this feature — these are API-operations records, not booking records.

## Acceptance checklist

- [ ] Backend module `it-webservice-access` (or equivalent) implements the
      endpoint list above with `@nestjs/swagger` decorators on every route.
- [ ] `AgencyApiCredential` persists in Postgres, extending/superseding the
      existing `AgencyApiKey` entity rather than duplicating it (see
      "Relationship to the existing agency API" above).
- [ ] Validation rules above enforced server-side via `class-validator` DTOs
      (never trust the frontend's `validateAccessConfig`).
- [ ] RBAC rules above enforced via `@Roles('IT_MANAGER')` guards.
- [ ] Every mutating endpoint writes an audit row per "Audit requirements".
- [ ] Raw secrets follow "Secret-handling requirements" — hash at rest,
      one-time reveal, never re-served, never logged.
- [ ] `frontend/src/api/it-webservice-access-mock.ts` is deleted and
      `frontend/src/api/it-webservice-access.ts` calls the real endpoints
      with the same function signatures (so
      `frontend/src/features/it-webservice/*.tsx` need no rewrite, only the
      import path change).
- [ ] Types in `frontend/src/types/it-webservice-access.ts` are regenerated
      from `docs/openapi.json` instead of hand-maintained.
- [ ] Backend integration tests: happy path, 401/403, 400 validation,
      not-found/ownership, and the "second active key for the same
      (agency, environment)" conflict case.
- [ ] `docs/API.md` updated with this endpoint group.

## Related preview-only additions (not this feature's endpoints, but shipped alongside it)

- **Failed-login events** (`frontend/src/api/it-failed-logins-mock.ts`,
  Security page): needs a real `GET /it/security/failed-logins` backed by a
  new login-failure audit category. Usernames must stay masked exactly as
  the mock already does.
- **Internal IT support tickets** (`frontend/src/api/it-support-mock.ts`,
  `/panel/support`): needs `GET/POST /it/support/tickets`. Deliberately
  separate from `backend/src/modules/support-tickets` (`SITE_ADMIN`-only,
  customer-facing) — do not merge the two RBAC surfaces.
- **Board Chair account creation/password change**
  (`frontend/src/api/it-board-chair-mock.ts`,
  `BoardChairAccountSection.tsx` on the Users & Access page): **do not**
  build a real backend endpoint for this without an explicit product/
  security decision first. `backend/src/modules/admins/admins.service.ts`
  currently states "CEO/BOARD_CHAIR accounts are never manageable" except
  by `CEO`/`BOARD_CHAIR`/`SENIOR_MANAGER`
  (`admins.controller.ts`'s `@Roles('CEO', 'BOARD_CHAIR', 'SENIOR_MANAGER')`).
  Letting `IT_MANAGER` create or reset the Board Chair's credentials would
  remove that separation-of-duties control. This section exists only as a
  requested UI preview; see the PR's "known limitations".

## Explicit exclusions

- GDS/NDC integration — out of scope, matches `direct-agency-booking-api.md`.
- Any change to the existing `AgencyApiKey` purchase/cartable-approval flow
  on the agency-portal side (`AgencyWebservicePage.tsx`) — this feature adds
  an IT-manager-facing admin surface, it does not replace that flow.
- Payment/billing for API usage — not part of this feature.

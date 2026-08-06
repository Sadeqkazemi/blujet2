# Feature: temporary password-only panel access (Kavenegar recovery window)

This is a production UAT exception requested by the owner while Kavenegar
delivery is being repaired. It is deliberately account-scoped and expires
automatically; it does not disable staff 2FA globally.

## Addendum: one shared UAT password (`agent/shared-uat-panel-password`)

Originally every temporary account got its own independently-generated
16-character password (visible once in the bootstrap/rotation script's
stdout). This addendum replaces that with **one shared password**, read
from `UAT_PANEL_SHARED_PASSWORD`, and extends account coverage beyond the
original seven manager/admin roles. Nothing about expiry, session
revocation, real-account isolation, or the mock OTP changes.

- **Coverage**: `TEMPORARY_PANEL_ACCOUNTS` (username + password via
  `/auth/staff/login`) gained `uat.employee` (`EMPLOYEE`, `dept:
  'commercial'`) alongside the original seven. A new
  `TEMPORARY_PHONE_LOGIN_ACCOUNTS` covers `uat.agency` (`AGENCY`, phone
  `09000000001`, via `/auth/agency/login`) and `uat.customer` (`USER`,
  phone `09000000002`, via `/auth/customer/login-password`) — both
  password-based login surfaces, per scope. `uat.agency` also gets a real
  (not fabricated-business-data) `AgencyProfile` + zero-limit
  `AgencyCreditLine`, the same minimal shape a freshly-approved real
  agency starts with — required for the account to resolve a profile at
  login at all, not sample booking/credit/settlement history.
- **One shared password, not one per account**: `backend/src/common/
  uat-shared-password.ts`'s `resolveUatSharedPassword()` is the only
  source. It refuses (clear `Error`, never including the password value)
  when: `AUTH_SANDBOX_ENABLED` isn't `true` (so a real production run
  without the sandbox flag is refused even if `NODE_ENV=production`
  matches, per the scripts' pre-existing check), the variable is
  unset/empty, or the value fails the existing `IsStrongPassword` policy
  (≥8 chars, upper+lower+digit+symbol — same policy already used for
  customer self-service passwords, not a new one).
- Bootstrap (`bootstrap-temporary-panel-accounts.ts`) hashes the shared
  password once and assigns the same hash to every account — no
  per-account generation. It's now idempotent per account (skips ones
  that already exist with `status: 'already_exists'`) so it can safely run
  again on a server that already has the original seven, to add the newly
  configured ones.
- Rotation (`rotate-temporary-panel-passwords.ts`) still requires every
  configured account to exist, be active, unexpired, and share one
  expiry, then rotates all of them to the new shared password atomically
  and revokes every active refresh token for those accounts — unchanged
  from the original behavior, just against a shared password source
  instead of per-account random generation.
- **Neither script's stdout ever includes a password field** — only
  `username`, `role`, `fullName`/`expiresAt`/`status` per account. The
  shared password is the operator's own already-known secret; there is
  nothing to echo back.
- `agencyLogin()` and `customerPasswordLogin()` (`auth.service.ts`) gained
  the same `getTemporaryPanelAccessState` bypass-2FA/deadline-scoped-token
  branch `staffLogin()` already had for its temp accounts — additive only,
  keyed off `User.temporaryPasswordOnlyUntil`, which is `null` for every
  real agency/customer, so this never changes real-account behavior.
- `uat-demo-data-purge-policy.ts` gained `UAT_ROW_FILTERED_TABLES`
  (`agency_credit_lines`, `agency_profiles`): these two tables can't be
  blanket-preserved (real agencies have rows there too) or blanket-purged
  (the UAT temp agency's own row must survive the purge like its `users`
  row does), so `uat-demo-data-purge.ts` now deletes non-UAT rows from
  them individually, in FK-safe order, before the `users` DELETE.
- `.github/workflows/deploy.yml` passes `UAT_PANEL_SHARED_PASSWORD` from
  `${{ secrets.UAT_PANEL_SHARED_PASSWORD }}` to both scripts via `docker
  compose exec -T -e ...`, never printed; the existing two historical
  one-time sentinel blocks are untouched (already consumed on the live
  server), with a new third one-time block
  (`.blujet-uat-shared-password-v1-complete`) that bootstraps any missing
  accounts and rotates every temporary account to the shared password.

### Acceptance checklist (addendum)

- [x] Every temporary account (all 10, across both login surfaces) hashes
  to the identical shared password — `uat-shared-password.e2e-spec.ts`.
- [x] Bootstrap/rotation refuse without `AUTH_SANDBOX_ENABLED=true`, even
  with `NODE_ENV=production` — `uat-shared-password.spec.ts`,
  `uat-shared-password.e2e-spec.ts`.
- [x] Bootstrap/rotation refuse an empty or weak
  `UAT_PANEL_SHARED_PASSWORD` with a clear error that never echoes the
  value — `uat-shared-password.spec.ts`, `uat-shared-password.e2e-spec.ts`.
- [x] A real staff account's password/state is untouched by either script
  — `uat-shared-password.e2e-spec.ts`.
- [x] Rotation revokes every active refresh token for the temporary
  accounts — `uat-shared-password.e2e-spec.ts`.
- [x] The password never appears in either script's stdout JSON, nor in
  any thrown error message — `uat-shared-password.spec.ts`,
  `uat-shared-password.e2e-spec.ts`.
- [x] The sandbox mock OTP default (`123456`) is unchanged —
  `uat-shared-password.e2e-spec.ts`.
- [x] A temp EMPLOYEE/AGENCY/USER account logs in with the shared
  password on its real endpoint and an expired one is rejected —
  `uat-shared-password.e2e-spec.ts`.

## Acceptance checklist

- [ ] A controlled production bootstrap creates exactly one temporary account
  for each management panel role: `SITE_ADMIN`, `IT_MANAGER`,
  `COMMERCIAL_MANAGER`, `FINANCE_MANAGER`, `SENIOR_MANAGER`, `CEO`, and
  `BOARD_CHAIR` — `temporary-panel-accounts.spec.ts`.
- [ ] Bootstrap usernames are restricted to the reserved `uat.` namespace,
  passwords are cryptographically random 16-character values made only from
  English letters and digits, and are never committed or printed to
  GitHub Actions logs, and the one-time credential file is mode `0600` on the
  server — workflow/script inspection plus `temporary-panel-accounts.spec.ts`.
- [ ] The owner-approved password-format migration rotates all seven existing
  active and unexpired temporary accounts atomically, preserves their original
  expiry, revokes their active refresh sessions, replaces the root-only
  credential file atomically, and runs at most once — rotation script/workflow
  inspection plus `temporary-panel-accounts.spec.ts`.
- [ ] The seven passwords remain unchanged for the lifetime of the accounts;
  repeated deploys cannot recreate or rotate them — deploy sentinel check.
- [ ] A valid, unexpired temporary account can complete `/auth/staff/login`
  with username/password and receives a normal access token + refresh cookie
  without an OTP challenge — `auth.e2e-spec.ts`.
- [ ] Every ordinary staff account still receives a 2FA challenge, even while
  temporary access exists — `auth.e2e-spec.ts`.
- [ ] An expired temporary account is rejected even with the correct password,
  and no OTP fallback or token is issued — `auth.e2e-spec.ts`.
- [ ] Access and refresh tokens for a temporary account never outlive that
  account's `temporaryPasswordOnlyUntil` timestamp; refresh after expiry is
  rejected and the token family is revoked — `auth.e2e-spec.ts`.
- [ ] Every password-only login writes a security audit event without password,
  token, or credential material — `auth.e2e-spec.ts`.
- [ ] The staff login UI accepts both the ordinary 2FA response and the
  temporary direct-login response, navigating to the panel only for the latter
  — `LoginPage.test.tsx`.
- [ ] A controlled cleanup command immediately deactivates only the reserved
  temporary accounts, clears their password hashes, and revokes their sessions
  without deleting referenced business/audit history —
  `temporary-panel-accounts.spec.ts`.
- [ ] The exception has a hard maximum lifetime of seven days from creation and
  can be removed earlier when Kavenegar is operational —
  `temporary-panel-accounts.spec.ts`.

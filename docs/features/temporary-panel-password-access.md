# Feature: temporary password-only panel access (Kavenegar recovery window)

This is a production UAT exception requested by the owner while Kavenegar
delivery is being repaired. It is deliberately account-scoped and expires
automatically; it does not disable staff 2FA globally.

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

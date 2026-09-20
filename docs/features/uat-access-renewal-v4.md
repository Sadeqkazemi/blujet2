# UAT access renewal v4 (2026-09-20)

Owner requested one fresh seven-day window for the eleven reserved UAT
identities on 202.133.90.31. No public endpoint or schema migration is added.
The existing password, role, phone and business records are preserved.

- [x] Require production mode, explicit sandbox mode and the v4 confirmation
      (`extend-temporary-panel-access-v4.spec.ts`).
- [x] Grant exactly seven days from execution, only during September 20–21 UTC
      (`extend-temporary-panel-access-v4.spec.ts`).
- [x] Accept the renewed deadline beyond the historical 35-day ceiling only
      in sandbox, with an absolute September 28, 2026 end to this exception
      (`extend-temporary-panel-access-v4.spec.ts`).
- [ ] Lock all eleven accounts; refuse missing identities, role mismatch,
      missing passwords or missing trusted UAT audit provenance atomically.
- [ ] Restore active/password-only UAT access, revoke refresh sessions and
      record one security audit per account without credentials.
- [ ] A repeated or concurrent execution cannot extend access again, even
      if the host sentinel was lost; partial prior grants fail closed.
- [ ] Deployment uses a separate v4 sentinel and root-only audit artifact.
- [x] Verify all three login surfaces plus authenticated identity and logout;
      never log credentials (`verify-temporary-panel-access-v4.spec.ts`).
- [ ] Verify focused tests, backend build/lint and repository CI before merge.
- [ ] Deploy and verify the eleven live account deadlines and panel access.

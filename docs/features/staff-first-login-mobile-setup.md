# ورود مدیران و کارمندان — راه‌اندازی اولین ورود (رمز + موبایل خود-تعیین)

**Status: spec only, not yet implemented.** Written per `CLAUDE.md`
Workflow Rule 1 (`docs/API.md` + `docs/DB_SCHEMA.md` must cover a feature
and the user must approve before any implementation code is written).
Do not start backend/frontend work on this until the open decisions below
are answered.

Design source: user-provided mockup, 2026-08-06 — supersedes
`design-reference-v2/ورود مدیران و کارمندان.dc.html` (which has no
first-login or 2FA concept at all; see that file's gap noted in
`docs/features/staff-auth-surfaces.md`).

Full endpoint/schema design: `docs/API.md` Phase 68, `docs/DB_SCHEMA.md`
Phase 68.

## The problem this closes

Staff/admin/employee accounts (`AdminsService.create()`,
`EmployeesService.create()`) never collect a phone number today —
`User.phone` stays `null` for every one of them. Mandatory staff 2FA
(`STAFF_LOGIN_2FA`) sends its code through `TwoFactorProvider.sendCode`,
which has nothing to send to. This is a real, currently-shipping gap
independent of this request — it surfaced during the audit that produced
this doc.

## Flow (from the mockup)

1. User enters **username only**. `POST /auth/staff/lookup` reports
   whether the account exists and whether it still needs first-time setup
   (`passwordHash IS NULL`).
2. **Returning user** (has a password already) → normal password field →
   existing `STAFF_LOGIN_2FA` challenge → panel.
3. **First-ever login** (no password yet) → «راه‌اندازی اولین ورود» screen:
   new password, confirm password, mobile number (`09xxxxxxxxx`).
4. Submit → OTP sent to the entered mobile → dedicated OTP screen (kept
   in frontend state only; server never stores the unconfirmed
   password/mobile — see DB_SCHEMA.md Phase 68).
5. Correct OTP → password + mobile become permanently attached to that
   username, account logs straight into its panel.

## Open decisions — must be answered before implementation starts

1. **Username-enumeration posture.** `POST /auth/staff/lookup` reveals
   whether a username exists (matching the mockup's explicit "چنین
   کاربری در سامانه ثبت نشده است" error), which is a deliberate reversal
   of every existing staff-auth endpoint's generic-401 posture. Confirm
   this is acceptable for a small, pre-vetted staff user base, or ask for
   a less revealing variant.
2. **OTP length**: mockup uses 5 digits; this spec proposes 6 to match
   every other OTP in the app (CLAUDE.md Security Rules: "OTP codes: 6
   digits"). Confirm.
3. **Password minimum length**: mockup says ≥8; this spec proposes 8 to
   match the existing customer-side policy, replacing the weaker legacy
   staff/admin/employee minimum of 6. Confirm, or keep 6.
4. **Delivery channel prerequisite**: no real `TwoFactorProvider`
   implementation exists yet (only `MockTwoFactorProvider`) — this
   feature's OTP can't reach a real phone until that's wired (likely
   reusing the existing Kavenegar `SmsProvider`). Confirm whether wiring a
   real provider is in scope for this phase or a separate prerequisite
   phase.
5. **Staff forgot-password reuse**: the mockup also designs a
   forgot-password screen reusing this OTP mechanism for staff who
   already have a password (today's «فراموشی رمز عبور؟» is a toast stub).
   Proposed as an explicitly deferred follow-up, not part of this phase.
   Confirm.

## Acceptance checklist (to fill in once implemented)

### Database
- [ ] New `TwoFactorPurpose` enum value `STAFF_FIRST_LOGIN_SETUP`
- [ ] No new tables/columns beyond the enum value (confirm this stays true — see DB_SCHEMA.md Phase 68's "no staging columns" design)

### Backend
- [ ] `POST /auth/staff/lookup` — 404 for unknown/non-staff username, `{ needsSetup }` for known
- [ ] `POST /auth/staff/first-login/otp/request` — 409 if account already has a password; sends OTP to submitted mobile; does not persist it yet
- [ ] `POST /auth/staff/first-login/otp/verify` — full challenge validation (ownership/expiry/attempts/code); re-checks `passwordHash IS NULL` inside the transaction; persists password+phone+`twoFactorEnabled` atomically; issues tokens; audit-logged
- [ ] Concurrency: two simultaneous setup attempts for the same account — exactly one succeeds, the other gets a clean conflict error
- [ ] `POST /admins` and `POST /it/employees` — `password` optional; omitted → passwordless account, no credential delivery attempted
- [ ] Rate limiting on all three new public endpoints (per-IP + per-mobile where applicable)
- [ ] Existing `POST /auth/staff/login` behavior unchanged for passwordless accounts (still generic 401)

### Frontend
- [ ] `LoginPage` gains the username-first step calling `/auth/staff/lookup`
- [ ] First-time-setup screen (password + confirm + mobile) matching the mockup
- [ ] OTP screen reused/extended for this purpose, 6-digit cells
- [ ] «افزودن مدیر / ادمین» and «افزودن کارمند» forms gain the admin-sets-password vs. user-sets-own-password choice
- [ ] Validation messages match project convention (byte-exact Persian strings, per existing auth pages' test patterns)

### Tests
- [ ] Backend e2e: happy path (lookup → setup → OTP → panel access), wrong OTP, expired OTP, attempt-cap, duplicate setup attempt (409), unknown username (404), weak password (400), invalid mobile format (400)
- [ ] Backend e2e: concurrency (two parallel setup submissions)
- [ ] Frontend: `LoginPage`/new setup screen/OTP screen unit tests (loading/error states, Persian validation copy)
- [ ] Playwright: full journey, IT-created employee with no password → first login → panel

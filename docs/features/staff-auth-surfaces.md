# Staff auth surfaces — forced password change + login polish

Closes the deferred gap documented in `docs/features/agency-portal.md` and
`docs/features/it-manager.md`: IT/admin password resets set
`mustChangePassword=true` but login never enforced a change before panel
access.

Design reference: `design-reference/ورود مدیران و کارمندان.dc.html` (staff
login + 2FA shell). Staff panels stay Persian-only — no i18n scope here.

## Database

No schema changes — uses existing `User.mustChangePassword`.

## API

| Method | Path | Change |
|--------|------|--------|
| GET | `/auth/me` | Response adds `mustChangePassword: boolean` |
| POST | `/auth/staff/login/verify` | `user` object adds `mustChangePassword` + `preferredLocale` |
| POST | `/auth/agency/login` | same |
| POST | `/auth/change-password` | Still allowed while `mustChangePassword=true`; clears the flag on success |
| * | any other JWT-protected staff/agency route | `403 PASSWORD_CHANGE_REQUIRED` when flag is set |

Skipped routes (decorator `@SkipMustChangePassword()`): `/auth/me`,
`/auth/change-password`, `/auth/logout`.

## Frontend

- `ForcePasswordChangePage` at `/required-password-change` — blocks panel/agency
  until the user submits current (temp) + new password via
  `POST /auth/change-password`.
- `ProtectedRoute` / `AgencyProtectedRoute` redirect authenticated users with
  `mustChangePassword` to that page.
- `LoginPage` / `StaffLoginLayout` / `TwoFactorPage` visual polish to match
  the staff login design (button copy, toast for forgot-password, SVG feature
  icons, 2FA back link).

## Acceptance checklist

### Backend
- [x] `GET /auth/me` returns `mustChangePassword` — `auth.e2e-spec.ts`
- [x] `verifyTwoFactor` returns `mustChangePassword: true` after IT reset — `auth.e2e-spec.ts`
- [x] `GET /panels/nav` → 403 `PASSWORD_CHANGE_REQUIRED` while flag set — `auth.e2e-spec.ts`
- [x] `POST /auth/change-password` clears flag; `/panels/nav` succeeds after — `auth.e2e-spec.ts`

### Frontend
- [x] `ForcePasswordChangePage` submits and refreshes session — `ForcePasswordChangePage.test.tsx`
- [x] `LoginPage` button «ورود به سامانه», forgot-password toast — `LoginPage.test.tsx`
- [x] `TwoFactorPage` back link + redirects to force-change when flagged — `TwoFactorPage.test.tsx`
- [ ] Playwright: reset employee password → login → force change → reach panel — deferred (manual path covered by e2e + unit tests)

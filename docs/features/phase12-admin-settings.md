# Feature: Phase 12 — مدیران و ادمین‌ها، امنیت و رمز عبور، تنظیمات سامانه، لاگ مدیر عامل، دسترسی پنل‌های IT

Covers `docs/API.md` → "Phase 12" and `docs/DB_SCHEMA.md` → "Phase 12".
Tabs unlocked: `admins` (CEO/Chair/Senior), `security` (CEO/Senior — IT
already had its own), `logs` (CEO — IT already had its own), `settings`
(Chair/IT), `panels` (IT read-only — CEO/Senior already had it).

## Acceptance checklist

### Backend — admins
- [ ] `GET /admins`: managed-set scoping per role hierarchy (Senior never sees a SENIOR_MANAGER row as manageable), real online derivation from refresh tokens, 403 for roles without the tab
- [ ] `POST /admins`: creates a real staff account (argon2, mustChangePassword), enum-role only, min-6 password, 409 duplicate username, audited
- [ ] `PATCH /admins/:id/block|unblock`: really flips `User.isActive` (blocked admin cannot staff-login anymore); never self, never CEO/BOARD_CHAIR, managed-set enforced server-side; audited
- [ ] `POST /admins/:id/reset-password`: explicit or generated temp password returned once; `mustChangePassword` set; audited

### Backend — own password, CEO logs, settings
- [ ] `POST /auth/change-password`: wrong current password → 401; success updates the hash (old password stops working, new one works); audited without password material
- [ ] `GET /audit/system-events`: CEO only; real rows; level mapping (SECURITY→WARN, financial→OK, else INFO)
- [ ] `GET /settings`: defaults + stored overrides + real refund brackets
- [ ] `PATCH /settings`: persists key-values, audited; unknown keys rejected
- [ ] `PATCH /settings/refund-rules`: BOARD_CHAIR only; updates the REAL `RefundPenaltyRule` rows (Phase 7 engine reads the same rows); 0–100 validated; audited
- [ ] `GET /panels/access`: IT_MANAGER can now read; PATCH still 403 for IT

### Frontend
- [ ] AdminsPage (CEO/Chair/Senior): list with role chips + real last-login/online, add-admin modal (role select — no custom role, password min 6, sms/email delivery pick), detail view with block/unblock + change-password + temp-password modal
- [ ] SecurityRouter: IT keeps its Phase 8 SecurityPage; CEO/Senior get OwnSecurityPage (change own password with current/new/confirm + مدیریت رمز سایر مدیران with reset + block toggle)
- [ ] LogsRouter: IT keeps its Phase 8 LogsPage; CEO gets CeoLogsPage (time/user/event/level table)
- [ ] SettingsPage: chair sections (company info, gateways, refund rules → real brackets, brand color) + IT sections (global toggles); save persists via the real endpoints
- [ ] PanelsAccessPage: IT sees the flags read-only (disabled switches + explanatory banner); CEO/Senior keep the working toggles
- [ ] nav flags flipped: admins (3 roles), security (CEO/Senior), logs (CEO), settings (Chair/IT), panels (IT)

### Tests
- [ ] Backend e2e: hierarchy/authz cases, block-really-blocks-login, change-password flow, settings round-trip, refund-rule write visible to the Phase 7 engine's table, IT read-only panels access
- [ ] Frontend unit tests per new page
- [ ] Playwright: CEO admins journey (add → block → unblock), CEO own-password change + revert, chair settings save, IT read-only panels

## Deferred (scoped out with reasons, not silently dropped)
- Per-admin permission toggle matrix — would be stored-but-unenforced (violates «never by hiding UI alone») or requires a dynamic-authorization redesign; open item.
- «نقش سفارشی…» free-text role — no enum/authorization backing.
- Site-logo upload (IT settings) — public-site asset with no public site in this track to render it.
- Chair panel's PROFILE & SECURITY section — orphaned (no nav entry reaches it).
- SMS/email delivery of credentials — goes through the existing mocked provider path in dev, same as OTP.

# Customer identity verification (احراز هویت)

Design: `design-reference-v2/پنل کاربر.dc.html` → `isIdentity` tab.

**Scope cut (CLAUDE.md):** no selfie step — only profile identity fields + national ID card upload.

## Acceptance checklist

- [x] `GET /my/identity` — USER only; steps reflect profile fields + id card file — `customer-identity.e2e-spec.ts`
- [x] `POST /my/identity/id-card` — stores PDF/PNG/JPG via FilesService — `customer-identity.e2e-spec.ts`
- [x] `POST /my/identity/submit` — requires both steps; sets SUBMITTED — `customer-identity.e2e-spec.ts`
- [x] 400 submit without id card; 403 for staff — `customer-identity.e2e-spec.ts`
- [x] No selfie upload anywhere — UI has exactly 2 steps — `AccountIdentityTab.tsx`
- [x] Frontend: identity tab with banner, steps, upload, submit — `AccountPage.test.tsx`

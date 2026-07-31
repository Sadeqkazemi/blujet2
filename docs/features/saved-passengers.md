# Saved passengers (مسافران ذخیره‌شده) — acceptance checklist

Design: `design-reference-v2/پنل کاربر.dc.html` → profile section `savedPax` + account tab `passengers`.

## Backend
- [x] `GET /my/saved-passengers` — USER only; returns decrypted list with `{ id, fullName, latinName, nationalId, passportNo, mobile, isChild, createdAt }` — `saved-passengers.e2e-spec.ts`
- [x] `POST /my/saved-passengers` — creates row; validates national-ID checksum when provided; requires at least one of nationalId/passportNo; max 20 per user; 409 duplicate nationalId — `saved-passengers.e2e-spec.ts`
- [x] `PATCH /my/saved-passengers/:id` — owner-only update — `saved-passengers.e2e-spec.ts`
- [x] `DELETE /my/saved-passengers/:id` — owner-only; 404 for others — `saved-passengers.e2e-spec.ts`
- [x] Staff roles get 403 on all `/my/saved-passengers` endpoints — `saved-passengers.e2e-spec.ts`
- [x] PII stored encrypted (`nationalIdEnc`, `passportNoEnc`, `mobileEnc`); nationalId never returned in list for wrong owner — `saved-passengers.e2e-spec.ts`

## Frontend
- [x] `AccountPage` `passengers` tab lists cards (initials, Persian name, LTR meta line) — `AccountPage.test.tsx`
- [x] Add-passenger modal saves via API — `AccountPage.test.tsx`
- [x] Remove passenger via ✕ — `AccountPage.test.tsx`
- [x] Empty state «مسافری ذخیره نشده است» — covered by `AccountPassengersTab` (empty array in other tests)

## Explicitly deferred
- Autofill chips on `BookPage` / `ResultsPage` checkout (separate follow-up).
- Saved-passengers preview block on profile tab (passengers tab is canonical for CRUD).

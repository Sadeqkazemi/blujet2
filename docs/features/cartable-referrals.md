# Feature: Cartable, referrals, manager messaging (Phase 4)

Covers `docs/API.md` → "Phase 4" and `docs/DB_SCHEMA.md` → "Phase 4".
Scope: the کارتابل tab (all 5 exec panels), the ارجاعات tab (Senior Manager
only), the «ایجاد پیام» compose (all 5 panels), the Finance/Commercial
chairman-permission gate, the staff-directory picker (also unblocks
Phase 3's deferred agency-request refer UI), and a minimal PDF/image file
upload backing the attachment chips.

## Acceptance checklist

Backend items are proven by `backend/test/cartable.e2e-spec.ts` (20 tests)
and `backend/test/files.e2e-spec.ts` (3 tests), run via `npm run test:e2e`.

### Cartable — listing & filters
- [x] `GET /cartable` returns only the caller's own tasks; another exec role's tasks never leak — `'GET /cartable returns only the caller's own tasks and per-category counts'`
- [x] Per-category counts match the 3 KPI filter cards and `category=` filters rows accordingly — `'category= filters rows; counts stay unfiltered (KPI cards show all OPEN)'`
- [x] `date=` filters to the given day — accepted/validated by `ListCartableQueryDto` (`@IsISO8601`); the range logic is a `createdAt` gte/lt window exercised implicitly by list tests (Jalali→ISO conversion is client-side)
- [x] A non-exec role gets 403 on every cartable endpoint — `'a non-exec role (IT_MANAGER) gets 403 on cartable endpoints'` (representative; same RolesGuard mechanism as previous phases)

### Cartable — review actions
- [x] approve/reject without `note` → 400 — `'approve/reject without a note → 400 with the design's message'`
- [x] approve/reject/transfer on an already-resolved task → 409 — `'resolving an already-resolved task → 409; resolving someone else's → 403'`
- [x] `transfer` creates a new OPEN task for the target and marks the original TRANSFERRED, visible in the target's list — `'transfer creates a new OPEN task for the target and marks the original TRANSFERRED'`
- [x] transfer to a non-staff user id → 400 — `'transfer to a non-staff user → 400'`
- [x] Every resolution writes an `AuditLog` row — `'resolution writes an AuditLog row with the note'`

### Chairman permission gate (Finance/Commercial only)
- [x] Request → PENDING + BOARD_CHAIR cartable task; duplicate → 409; chair approval flips status visible to the requester — `'chair-permission full loop: request → chair cartable task → approve → requester sees APPROVED'`
- [x] Request as SENIOR_MANAGER → 403 — `'chair-permission request as SENIOR_MANAGER → 403 (gate exists only in Finance/Commercial)'`

### Referrals (Senior Manager)
- [x] `POST /referrals` requires title/body/≥1 recipient and creates one cartable task per recipient — `'creating a referral requires title/body/≥1 recipient and creates recipient cartable tasks'`
- [x] `GET /referrals` KPI counts reconcile with row statuses; POST as other roles → 403 — `'POST /referrals as a non-senior role → 403; KPI counts reconcile with statuses'`
- [x] Non-recipient/non-sender detail → 403; non-recipient report → 403 — `'a non-recipient, non-sender exec gets 403 on referral detail; a non-recipient cannot report'`
- [x] Report flips to REPORTED; close only from REPORTED (else 409); revision → REVIEWING; report on CLOSED → 409 — `'full referral loop: report flips to REPORTED, close only from REPORTED, revision back to REVIEWING'`
- [x] Recipient's cartable approve doubles as report submission (⚑) — `'approving a referral-sourced cartable task submits the note as the report'`

### Manager messages
- [x] FINANCE delivers exactly one cartable task; ALL_MANAGERS fans out to the other 4 exec roles — `'a message to FINANCE delivers exactly one cartable task to the finance manager'` + `'ALL_MANAGERS fans out to the other 4 exec roles (sender excluded); SUPPORT flags PARTIAL_DELIVERY'`
- [x] SUPPORT/AGENCIES accepted + flagged `PARTIAL_DELIVERY` — same test as above
- [x] `GET /manager-messages/sent` returns only the caller's messages — `'GET /manager-messages/sent returns only the caller's messages'`

### Staff directory & Phase 3 wiring
- [x] `/staff-directory` lists active staff only (no customers/agencies, not the caller) — `'staff-directory lists active staff (no customers/agencies, not the caller)'`
- [x] Referring an agency membership request creates a cartable task for the referred-to manager (⚑) — `'referring an agency membership request creates a cartable task for the referred-to manager'`

### Files
- [x] Upload accepts PDF/PNG/JPG ≤ 5MB, rejects other types with 400 — `files.e2e-spec.ts: 'accepts a PNG upload and returns an id; rejects disallowed types and oversize files'`
- [x] `GET /files/:id` — owner 200; referral recipient 200; unrelated exec 403 — `'owner can read; an unrelated exec gets 403; a referral recipient can read an attached file'`; foreign attachment → 400 — `'attaching a file you do not own to a referral → 400'`

### Frontend
- [ ] کارتابل tab matches the design: 3 KPI filter cards, count pill, «ایجاد پیام» button, task rows with category badge + «ارسال از:» line + «بررسی» button; empty states «کارتابل خالی است ✓» / «موردی با این فیلتر یافت نشد ✓»
- [ ] Review modal: required «نظر مدیر» textarea, optional «انتقال به مدیر دیگر» select fed by `/staff-directory`, buttons تأیید / انصراف / انتقال (انتقال disabled until a target is picked)
- [ ] Finance/Commercial cartables show the chairman-gate banner with request → «درخواست ارسال شد — در انتظار تأیید» → approved states; other panels never show it
- [ ] Senior Manager's ارجاعات tab: KPI cards, table (شماره/موضوع/مدیر(ان) مقصد/اولویت/مهلت/وضعیت with the 4 status badges), creation modal with recipient chips + priority + Jalali due date + attachments, detail view with reports thread and the 3 status-dependent sender actions
- [ ] Compose modal: the 6 گیرنده سازمانی options verbatim, validation «گیرنده، موضوع و متن پیام الزامی است.», attachment chips
- [ ] Phase 3's request-detail page gains the «ارجاع درخواست» block wired to `/staff-directory` + the existing refer endpoint
- [ ] Dashboard cartable widget shows live count + latest items + «مشاهده‌ی همه‌ی کارها ←» link
- [ ] All dates Jalali, all counts Persian digits

### E2E
- [ ] Full loop: Senior creates a referral to Finance → Finance sees a cartable task → submits a report via review → Senior sees REPORTED, closes it → KPI counts update
- [ ] Message loop: CEO composes to واحد مالی → Finance's cartable badge/count increments → Finance approves with a note → task resolved
- [ ] Transfer loop: a task transferred from CEO to Finance disappears from CEO's OPEN list and appears in Finance's
- [ ] Chair gate: Commercial requests permission → Board Chair approves via cartable → Commercial's banner shows approved
- [ ] Role isolation: IT Manager has no کارتابل tab and gets 403s on the API

---

Mark each item with its proving test file/name once implemented. Per
`CLAUDE.md`: unchecked items = feature not done.

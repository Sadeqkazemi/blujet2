# Feature: Cartable, referrals, manager messaging (Phase 4)

Covers `docs/API.md` → "Phase 4" and `docs/DB_SCHEMA.md` → "Phase 4".
Scope: the کارتابل tab (all 5 exec panels), the ارجاعات tab (Senior Manager
only), the «ایجاد پیام» compose (all 5 panels), the Finance/Commercial
chairman-permission gate, the staff-directory picker (also unblocks
Phase 3's deferred agency-request refer UI), and a minimal PDF/image file
upload backing the attachment chips.

## Acceptance checklist

### Cartable — listing & filters
- [ ] `GET /cartable` returns only the caller's own tasks; another exec role's tasks never leak (ownership test)
- [ ] Per-category counts match the 3 KPI filter cards (درخواست اداری / همکاری آژانس / درخواست مدیران) and `category=` filters rows accordingly
- [ ] `date=` filters to the given day (the Jalali popover sends an ISO day; conversion happens client-side via the shared Jalali module)
- [ ] A non-exec role (IT_MANAGER, SITE_ADMIN, EMPLOYEE) gets 403 on every cartable endpoint

### Cartable — review actions
- [ ] approve/reject without `note` → 400 with the design's «برای ثبت تصمیم، درج نظر مدیر الزامی است.» message
- [ ] approve/reject/transfer on an already-resolved task → 409, never a silent double-resolution
- [ ] `transfer` creates a new OPEN task for the target (same `sourceType`/`sourceId`) and marks the original TRANSFERRED — the target actually sees it in their `GET /cartable`
- [ ] transfer to a non-staff user id → 400
- [ ] Every resolution writes an `AuditLog` row (actor, action, note)

### Chairman permission gate (Finance/Commercial only)
- [ ] `POST /cartable/chair-permission` → creates a PENDING request + a BOARD_CHAIR cartable task; second POST while PENDING/APPROVED → 409
- [ ] `POST /cartable/chair-permission` as SENIOR_MANAGER/CEO/BOARD_CHAIR → 403 (gate exists only in the two panels)
- [ ] Board Chair approving/rejecting the generated cartable task flips the request to APPROVED/REJECTED; requester's `GET /cartable/chair-permission` reflects it

### Referrals (Senior Manager)
- [ ] `POST /referrals` requires title, body, ≥1 recipient (400 with the design's combined validation message); creates one cartable task per recipient (category=MANAGER)
- [ ] `GET /referrals` returns the 4 KPI counts and they reconcile with the row statuses
- [ ] `POST /referrals` as any other role → 403; `GET /referrals/:id` as a non-recipient, non-sender exec → 403 (resource-level check, not just role)
- [ ] Recipient `POST /referrals/:id/reports` flips SENT/REVIEWING → REPORTED; sender sees the report in the detail thread
- [ ] `close` only from REPORTED (else 409); `request-revision` REPORTED → REVIEWING; `remind` SENT/REVIEWING → REVIEWING
- [ ] A report from a non-recipient → 403

### Manager messages
- [ ] `POST /manager-messages` to FINANCE delivers exactly one cartable task to the finance manager; ALL_MANAGERS delivers to all 5 exec roles minus the sender
- [ ] SUPPORT/AGENCIES targets are accepted, stored, and flagged `PARTIAL_DELIVERY` (no backing role yet) — documented, not a crash
- [ ] `GET /manager-messages/sent` returns only the caller's messages

### Files
- [ ] Upload accepts PDF/PNG/JPG ≤ 5MB, rejects other types/oversize with 400
- [ ] `GET /files/:id` — owner 200; a referral recipient 200 for a file attached to that referral; an unrelated exec 403

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

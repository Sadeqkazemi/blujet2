# Feature: Refunds — finance approval & payout (Phase 7)

Covers `docs/API.md` → "Phase 7" and `docs/DB_SCHEMA.md` → "Phase 7".
Scope: the Finance Manager's استرداد بلیط tab (review/refer/pay). Customer
submission and site-admin referral live in their own tracks.

## Acceptance checklist

### Backend — listing & detail
- [ ] `GET /refunds` returns the request cards + the 3 KPI counts and they reconcile with row statuses
- [ ] `GET /refunds/:id` returns the passenger/account panel with the شبا (decrypted for this surface), flight info, and the penalty breakdown; PII columns are encrypted in the DB (verified by reading the row)
- [ ] Every endpoint 403s for non-FINANCE_MANAGER roles (CEO, Commercial, IT)

### Backend — penalty engine
- [ ] `computePenalty(hoursLeft)` unit tests: ≥72h→30٪, 24–72h→50٪, 3–24h→70٪, <3h→100٪, boundary values (exactly 72/24/3), and refundable = totalPaid − penalty
- [ ] Rules are seeded from `RefundPenaltyRule` (server-side source of truth) — not hardcoded in the handler

### Backend — refer & pay
- [ ] `refer {assigneeId}` sets the assignee + appends the design's history label, does NOT change status, audited; non-staff assignee → 400
- [ ] `pay` from FINANCE: one transaction — `LedgerEntry(type=REFUND, −refundableIrr)`, `Booking.status=REFUNDED`, request PAID + processedBy/paidAt + history, `AuditLog(category=REFUND)`
- [ ] `pay` on SUBMITTED/REVIEW → 409 («در انتظار ادمین»); double-pay → 409 with exactly ONE ledger row (idempotency assertion)
- [ ] The ledger stays consistent: sum of REFUND entries equals the sum of refundable amounts of PAID requests

### Frontend (Finance panel)
- [ ] Tab header with the «{n} در صف پرداخت» pill; 3 KPI cards (در صف پرداخت / پرداخت‌شده / در انتظار بررسی ادمین)
- [ ] Card list: passenger + ticket id (LTR mono) + route + «ارجاع به:» line + شماره پرواز + مبلغ قابل پرداخت + status pills (ثبت مشتری / بررسی ادمین / آمادهٔ پرداخت / پرداخت شد); «تأیید و پرداخت» only on FINANCE rows, «در انتظار ادمین» static otherwise; empty state «درخواست استردادی ثبت نشده است.»
- [ ] Detail modal: the three panels (اطلاعات مسافر و حساب / اطلاعات پرواز / مبالغ), «درصد جریمهٔ کنسلی» in red + «مبلغ نهایی قابل پرداخت» in green, refer select fed by /staff-directory with «ثبت و انتقال فرآیند ارجاع», pay button «تأیید، واریز به شبا و بستن پرونده», paid banner «پرداخت شد و پرونده بسته است ✓» (no timeline in this modal — per design)
- [ ] Money via `faMoney`, dates Jalali, شبا rendered LTR mono

### E2E
- [ ] Full loop: seeded FINANCE request → finance manager opens the modal → refers to a finance staffer (assignee line appears) → pays → status flips to پرداخت شد, KPI counts update
- [ ] Paying an already-paid request is impossible from the UI (button gone) and the API refuses a replay
- [ ] Role isolation: Commercial Manager has no استرداد بلیط nav entry

---

Mark each item with its proving test file/name once implemented. Per
`CLAUDE.md`: unchecked items = feature not done.

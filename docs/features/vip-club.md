# Feature: VIP club — members & card-request approval (Phase 5)

Covers `docs/API.md` → "Phase 5" and `docs/DB_SCHEMA.md` → "Phase 5".
Scope: the مشتریان VIP tab in CEO/Board Chair (rich, byte-identical
layouts) and Senior Manager (simpler two-card layout). Site-admin referral
and passenger self-request stay in their own tracks.

## Acceptance checklist

### Members
- [ ] `GET /club/members` returns members + KPI counts (کل اعضای باشگاه، کارت‌های صادرشده، درخواست در انتظار، توزیع سطوح per tier) and they reconcile with the rows
- [ ] `level=` filter and `q=` search (name/email/cardNo + exact national-ID via hash) work; national IDs are never returned in plaintext
- [ ] `POST /club/members` as SENIOR_MANAGER → 403 (form exists only in CEO/Chair panels); invalid national-ID checksum → 400; the stored ID is encrypted (verified by reading the DB row)
- [ ] `PATCH /club/members/:id/level` as CEO/BOARD_CHAIR → 403 (Senior-only control); writes `AuditLog(category=CLUB)`
- [ ] `POST /club/members/:id/issue-card` issues with `issuedByLabelFa='<نقش> (صدور مستقیم)'`, 409 if already ISSUED, audited
- [ ] A non-club role (FINANCE_MANAGER, IT_MANAGER) gets 403 on every endpoint

### Card requests
- [ ] `GET /club/card-requests` returns only REFERRED/APPROVED/REJECTED (never SUBMITTED) with history timelines
- [ ] Approve as CEO or BOARD_CHAIR works on any REFERRED request regardless of `assignedTo` (design override, ⚑)
- [ ] Approve as SENIOR_MANAGER on `assignedTo=CHAIR` → 403; on `assignedTo=SENIOR` → 200
- [ ] Approval is transactional: request APPROVED + cardNo `TIER-####`, member `cardStatus=ISSUED` + issuedBy label, history row appended, audit row — a mid-way failure leaves none of it
- [ ] Reject sets the member back to `cardStatus=NONE` and appends history
- [ ] Approve/reject on an already-decided request → 409

### Frontend
- [ ] CEO/Chair tab: 4 KPI cards (verbatim labels), pending-requests list with status pills + request detail modal incl. «روند درخواست» timeline, member directory with tier filter chips + search + «صدور کارت», collapsible «تعریف مشتری VIP جدید» form
- [ ] Senior tab: only the two cards — «درخواست‌های صدور کارت (ارجاع‌شده)» with inline تأیید و صدور کارت/انصراف (read-only note for chair-assigned rows) and the expandable member list with tier segmented control + issue button; NO KPI row/search/add-form
- [ ] Tier badges use the design's three verbatim labels; points render with Persian digits + ٬ separator
- [ ] FINANCE/COMMERCIAL/IT panels have no VIP nav entry

### E2E
- [ ] Full loop: Senior approves a seeded senior-assigned request → member's card appears; Chair approves a chair-assigned one
- [ ] Senior cannot act on a chair-assigned request (read-only note visible)
- [ ] CEO adds a new VIP member → appears in the directory with the chosen tier

---

Mark each item with its proving test file/name once implemented. Per
`CLAUDE.md`: unchecked items = feature not done.

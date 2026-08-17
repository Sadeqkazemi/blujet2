# Commercial panel — agencies cross-view tabs, web-service & seat-request modals

**Status: frontend implemented against real endpoints where they exist,
temp mock-backed where they don't; backend for the mock-backed parts is
NOT yet implemented.** Per explicit instruction, this branch
(`claude/frontend-overhaul-20260816`) ships the updated design's UI ahead
of backend, using an isolated, clearly-labeled `TEMP/DEV ONLY` mock
adapter (`frontend/src/api/agencies-mock.ts`) only where no backend
endpoint exists at all — never as inline fake data inside a component.
See `docs/API.md`'s "Commercial panel design refresh" section for the
exact endpoint contract a future backend phase should implement, after
which the mock adapter file is deleted and the two call sites below swap
to real `api/agencies.ts` functions (same signatures).

Source: uploaded design handoff `design_handoff_commercial_panel/` (new
5,547-line prototype, superseding `design-reference-v2/پنل مدیر
بازرگانی.dc.html`'s 3,631-line version) — sections "AGENCIES: MAIN TABS",
"AGENCIES WITH DEBT", "ALL INVOICES", "ALL COOPERATION REQUESTS", "ALL
SEAT REQUESTS", "HISTORY TAB", "WEB SERVICE REQUEST DETAIL MODAL", "SEAT
REQUEST DETAIL MODAL".

## Acceptance checklist

### Real data (no mock)

- [x] Commercial Manager's آژانس‌ها page shows a 3-pill tab bar (آژانس‌های
  همکار / درخواست همکاری / آژانس‌های دارای بدهی) replacing the previous
  always-stacked layout — `GET /agencies`, `GET /agencies/requests`,
  `POST /agencies/debtors/notify-all`, `POST /agencies/:id/settle` unchanged
  — `AgenciesListPage.test.tsx` › "sees the 3-tab bar and the agency list
  by default", "coop-requests tab shows pending requests", "debtors tab
  shows the notify-all + all-invoices entry points"
- [x] Non-Commercial roles (`SITE_ADMIN`/`EMPLOYEE`/`SENIOR_MANAGER`/
  `FINANCE_MANAGER`) branch is byte-for-byte unchanged —
  `AgenciesListPage.test.tsx`'s pre-existing Senior/Finance-role tests
  still pass unmodified
- [x] Web-service purchase requests preview box on the main tab, backed
  by the already-permitted `GET /agencies/webservice-requests`
  (`COMMERCIAL_MANAGER` was already in its `@Roles`, just never consumed
  by a Commercial-facing page) — opens `WebserviceRequestDetailModal`,
  approve re-uses the existing `API_KEY_ROTATE` step-up flow, reject
  needs no step-up — `AgenciesListPage.test.tsx` › "web service request
  preview opens the real-data detail modal"; `WebserviceRequestDetailModal.test.tsx`
  (render, reject, approve-requests-step-up)
- [x] Agency detail page gains a تاریخچه (History) tab; its "تاریخچهٔ
  پرداخت" section reuses the already-fetched real
  `AgencyDetail.commercialExtras.transactions` ledger data (no new
  endpoint), with client-side search + `JalaliDatePicker` date filter —
  `AgencyDetailPage.test.tsx` › "تاریخچه (History) tab shows real payment
  history and mock seat-request history"

### Temp mock-backed (documented in docs/API.md, not yet real)

- [x] "همه فاکتورها" (all invoices across agencies) drill-down with the
  design's صادرشده/پرداخت‌شده/باطل‌شده sub-tabs, reachable from the
  debtors tab — no aggregate invoice endpoint exists; rows are anchored
  to real agencies from `GET /agencies`, only invoice-specific fields are
  synthesized — `frontend/src/api/agencies-mock.ts`'s
  `fetchAggregateInvoices`
- [x] "همه درخواست‌های صندلی" (all seat requests) drill-down + preview box
  + `SeatRequestDetailModal` — no manager-side seat-request read/decide
  endpoint exists (only `POST /agency-portal/seat-requests`, which today
  creates an unstructured cartable task, see `docs/API.md`) —
  `fetchAggregateSeatRequests` / `decideAggregateSeatRequest`
- [x] History tab's "سابقهٔ درخواست‌های خرید صندلی" sub-list — same mock
  adapter, filtered client-side by `agencyId`
- [x] Every mock function has the same async signature the documented
  real endpoint would have; swapping the import is a one-line change per
  call site, never a component rewrite

### Explicitly NOT done this phase

- [ ] No new backend endpoint, migration, or `panel-nav.config.ts` change
  — out of scope for this frontend-only branch per instruction
- [ ] No merge to `main`, no deploy

---

Per `CLAUDE.md`: unchecked items are the follow-up backend phase's scope,
not "not done" for this frontend phase — the checklist above documents
exactly what is real today vs. mock-backed pending backend, per the
explicit instruction under which this branch was built.

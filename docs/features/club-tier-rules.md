# Feature: قوانین باشگاه مشتریان (Club Tier Rules)

**Status: implemented and merged.** Docs were drafted and explicitly
approved by the user before any code was written, per `CLAUDE.md`'s
workflow rule 1.

Commercial Manager panel tab (`clubrules`), found in the earlier
design-bundle audit: `design-reference-v2/پنل مدیر بازرگانی.dc.html`'s
own `titles.clubrules`/`subs.clubrules` and the `showClubRules` markup
block (lines 723–747 of that file). Access restricted to `CEO` and
`COMMERCIAL_MANAGER` only — confirmed against that file's own
`roleDefs.access` arrays (only `super` and `commercial` list
`clubrules`) and against every other executive-panel design file (none
of them mention a `clubrules` tab at all).

Lets a manager configure the point thresholds that define each club
membership tier (`نقره‌ای`/`طلایی`/`پلاتین` — SILVER/GOLD/PLATINUM), plus
a separate point threshold for card-issuance requests. Unlike a purely
cosmetic settings screen, this phase wires the tier thresholds into
`ClubPointsService.syncCache` so a member's `level` is recomputed for
real every time their points balance changes — replacing today's
behavior where `level` never changes except via an explicit manual
`PATCH /club/members/:id/level` staff action.

## Acceptance checklist

- [x] `GET /club/tier-rules` returns the singleton row (seeded via
      `prisma/seed.ts`) with `goldMinPoints`, `platinumMinPoints`,
      `cardRequestMinPoints`, `updatedAt`, `updatedByLabelFa`, and a
      computed 3-row `preview` array (SILVER/GOLD/PLATINUM with min/max
      point range) — accessible only to `CEO`/`COMMERCIAL_MANAGER`
      (401/403 for every other role, including `SENIOR_MANAGER` and
      `BOARD_CHAIR` who have no `clubrules` access per the design) —
      `club.e2e-spec.ts` › "GET returns the seeded defaults + computed
      preview for CEO and COMMERCIAL_MANAGER; other roles get 403"
- [x] `PATCH /club/tier-rules` accepts `{ goldMinPoints,
      platinumMinPoints, cardRequestMinPoints }`, validates all three
      are non-negative integers and `goldMinPoints < platinumMinPoints`,
      rejecting with `VALIDATION_FAILED` (400) otherwise —
      `club.e2e-spec.ts` › "PATCH rejects goldMinPoints >=
      platinumMinPoints with VALIDATION_FAILED"
- [x] A successful `PATCH` updates the singleton row and records an
      audit-log entry (category `CLUB`) naming the actor and the
      before/after values — `club.e2e-spec.ts` › "PATCH updates the
      singleton row, is reflected on the next GET, and is audited"
- [x] `ClubPointsService.syncCache` recomputes `ClubMember.level` from
      the current `ClubTierRule` thresholds every time points change
      (both `earnForPurchase` and `redeemForPayment` paths), inside the
      same transaction as the points-ledger write — verified by a real
      purchase that pushes a member's points across a tier boundary
      resulting in a real `level` change with no separate action —
      `club.e2e-spec.ts` › "a real points credit recomputes
      ClubMember.level from the current rules, with no separate action"
      + `club-tier.spec.ts` (8-case unit spec for the boundary logic,
      including a redemption-demotes-the-tier case)
- [x] Saving new rules does NOT retroactively recompute existing
      members' tiers (matches the design's own scope — no bulk-recompute
      action exists in the mock; confirmed by inspection — `updateTierRules`
      only ever writes the `ClubTierRule` row, never touches `ClubMember`)
- [x] Frontend: new `ClubTierRulesPage.tsx` renders the 4-field form
      (`SILVER` fixed/disabled at `۰`, editable Gold/Platinum/card-request
      thresholds), inline validation error display, a "ذخیره قوانین"
      save button, and the read-only 3-row tier-preview table — matching
      `design-reference-v2/پنل مدیر بازرگانی.dc.html`'s layout
- [x] `PANEL_NAV` gains a `clubrules` key for `CEO` and
      `COMMERCIAL_MANAGER` only (`backend/src/modules/panels/panel-nav.config.ts`)
- [x] Backend (Jest + Supertest): integration tests for `GET`/`PATCH`
      `/club/tier-rules` — happy path, 401/403 for non-`CEO`/
      `COMMERCIAL_MANAGER` roles (including `SENIOR_MANAGER`/
      `BOARD_CHAIR`), 400 on invalid ordering/negative values, audit-log
      entry created. Unit test for `ClubPointsService.syncCache`'s tier
      recompute (crossing into GOLD, crossing into PLATINUM, staying in
      SILVER, redemption dropping a member back a tier). — 4 pre-existing
      + 9 new tests in `club.e2e-spec.ts` (13/13 passing), 8/8 passing in
      `club-tier.spec.ts`
- [x] Frontend (Vitest + RTL): form rendering, validation messages,
      save success/error states, tier-preview table rendering with
      real-shaped data. — `ClubTierRulesPage.test.tsx`, 4/4 passing
- [x] No new Playwright E2E script this phase — consistent with this
      session's established cadence for Phases 51–64 (real-DB Jest e2e +
      Vitest/RTL as the testing bar for a scoped feature of this size,
      rather than a dedicated Playwright script per small feature)

---

Per `CLAUDE.md`: unchecked items = feature not done. Implementation
began only after this document (and `docs/API.md`/`docs/DB_SCHEMA.md`'s
Phase 65 sections) were explicitly approved by the user.

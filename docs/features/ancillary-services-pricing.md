# Commercial panel — خدمات (ancillary services pricing)

**Status: frontend implemented, entirely temp mock-backed. Backend is
NOT yet implemented — this is a wholly new domain with zero existing
backend module.** Per explicit instruction, shipped ahead of backend
using an isolated `TEMP/DEV ONLY` mock adapter
(`frontend/src/api/ancillary-services-mock.ts`, localStorage-persisted
so a reviewer's edits survive a reload — never a source of truth, never
read by any other feature). See `docs/API.md`'s "Ancillary services
pricing" subsection for the endpoint contract a future backend phase
should implement; `docs/DB_SCHEMA.md` for the new `ancillary_services`
table.

Source: uploaded design handoff, section "SERVICES (per-service
pricing)" — a new top-level «خدمات» nav tab not present in the previously
implemented Commercial Manager panel.

## Acceptance checklist

- [x] "قیمت انواع صندلی" card: 3 seat-type rows (عادی / پای بلندتر /
  کنار پنجره یا راهرو), each with a price input, «ثبت قیمت» save, and an
  enabled/disabled toggle — `AncillaryServicesPage.test.tsx` › "renders
  seat-type pricing and other services"
- [x] "سایر خدمات جانبی" card: 8 built-in rows (بار اضافه، وعده غذایی،
  بیمه مسافرتی، CIP، هزینه استرداد، حیوان خانگی، ویلچر، انتخاب صندلی از
  پیش), same price/toggle controls
- [x] «افزودن خدمت جدید» opens an inline form (title required, price,
  optional description); submitting adds a custom row with a delete (×)
  action that built-in rows don't have — `AncillaryServicesPage.test.tsx`
  › "adding a custom service submits title/description/price"
- [x] Saving a price shows a Persian success toast (auto-dismiss) —
  `AncillaryServicesPage.test.tsx` › "saving a price calls the mock
  adapter and shows a confirmation toast"
- [x] Page is reachable at `/panel/ancillary-services`, client-side
  guarded to `COMMERCIAL_MANAGER` (falls back to the shared
  `ComingSoonPage` for any other role) since the route is not
  `TabGate`-wrapped — no real `GET /panels/nav` key exists yet (adding
  one requires a `backend/panel-nav.config.ts` change, out of scope for
  this frontend-only branch) — `AncillaryServicesPage.test.tsx` › "shows
  the coming-soon placeholder for a non-Commercial role"
- [x] Sidebar nav link is appended client-side in `PanelShell.tsx`,
  `COMMERCIAL_MANAGER` only, clearly commented as temporary
- [x] A visible in-page notice tells the reviewer this screen isn't
  backend-connected yet and edits only persist in the current browser
- [x] No fake data inside the component — all rows come from
  `api/ancillary-services-mock.ts`'s `fetchSeatServices`/
  `fetchOtherServices`

### Explicitly NOT done this phase

- [ ] No real `ancillary_services` table, endpoints, or
  `panel-nav.config.ts` key — documented in `docs/API.md`/
  `docs/DB_SCHEMA.md` for a follow-up backend phase
- [ ] Public checkout's "services" step is NOT wired to this pricing yet
  (still whatever it reads today) — that switch happens once the real
  table/endpoints exist
- [ ] No merge to `main`, no deploy

---

Per `CLAUDE.md`: unchecked items are the follow-up backend phase's scope.
This page is a design-review-ready UI shell, not a production-connected
feature, until the backend phase above lands.

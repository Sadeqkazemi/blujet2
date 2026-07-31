# SITE_ADMIN media CMS — acceptance checklist

Design source: `design-reference-v2/پنل ادمین سایت.dc.html` (media tab ~L1521+).

**Scope this phase:** image library, hero/announcement/promo banners,
popular destinations, popular routes. Deferred: social links (settings tab),
app download links, support contact fields, job postings block (jobapps tab),
static site pages list.

## Admin panel (`MediaAdminPage`, tab `media`)

- [x] Image library: list, upload, soft-delete — `site-content.e2e-spec.ts` library
- [x] Hero banner edit (title, subtitle, button, cover) — e2e + `MediaAdminPage.test.tsx`
- [x] Announcement bar toggle + text + optional image — e2e
- [x] Promo banner edit (badge, title, button, cover) — e2e
- [x] Popular destinations CRUD — e2e
- [x] Popular routes CRUD — e2e
- [x] `media` tab in SITE_ADMIN nav — `panels.e2e-spec.ts`

## Public API

- [x] `GET /site-content/home` returns blocks, destinations, routes — e2e
- [x] `GET /site-content/media/:fileId` serves library/block images — e2e

## Home page wiring

- [x] `HomeSearchPage` reads CMS hero/announcement/promo/routes/destinations — `HomeSearchPage.test.tsx`

## Explicit deferrals

- Social links, app store links, support phone/email (existing settings paths)
- Job postings section in media tab (use jobapps tab)
- Full static pages CMS
- CMS-only destinations not in the static catalog (Phase H wires matching codes only)

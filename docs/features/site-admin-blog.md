# SITE_ADMIN blog CMS — acceptance checklist

Design source: `design-reference-v2/پنل ادمین سایت.dc.html` (blog tab ~L1181+).

## Admin panel (`BlogAdminPage`, tab `blog`)

- [x] KPI row: published count, draft count, total views (`GET /blog/admin/stats`) — `BlogAdminPage.test.tsx` "renders KPI stats"
- [x] Category filter chips: همه / اخبار پرواز / راهنمای سفر / مقاصد / تخفیف‌ها — `BlogAdminPage.test.tsx` "filters posts by category"
- [x] Post list shows title, category label, author, Jalali date, view count, status badge — `BlogAdminPage.test.tsx` "renders post rows"
- [x] «نوشتهٔ جدید» opens editor form (title, category, body, optional cover file id) — `BlogAdminPage.test.tsx` "opens create editor"
- [x] «انتشار» saves as PUBLISHED — `blog.e2e-spec.ts` admin publish flow
- [x] «ذخیرهٔ پیش‌نویس» saves as DRAFT — `blog.e2e-spec.ts` admin create draft
- [x] «ویرایش» loads existing post into editor — `BlogAdminPage.test.tsx` "opens edit form"
- [x] «حذف» soft-deletes post — `blog.e2e-spec.ts` admin delete
- [x] `blog` tab appears in SITE_ADMIN sidebar (`PANEL_NAV`) — `panels.e2e-spec.ts` "returns the confirmed tab set for SITE_ADMIN"

## Public API (no login)

- [x] `GET /blog/posts` returns only visible posts (PUBLISHED or SCHEDULED with `scheduledAt <= now`) — `blog.e2e-spec.ts` public list
- [x] `GET /blog/posts/:slug` returns detail and increments viewCount — `blog.e2e-spec.ts` public detail
- [x] Draft/scheduled-future posts return 404 on public detail — `blog.e2e-spec.ts` public 404 cases

## Auth / RBAC

- [x] Admin endpoints require SITE_ADMIN JWT — `blog.e2e-spec.ts` 401/403 cases
- [x] Non-SITE_ADMIN staff get 403 on admin routes — `blog.e2e-spec.ts`

## Explicit deferrals

- Comments count in design KPI row (always 0 until comments feature exists)
- Public blog listing page on marketing site (API only this phase)
- Full media CMS tab (banners, destinations, image library)

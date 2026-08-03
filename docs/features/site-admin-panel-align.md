# SITE_ADMIN panel dark-align (design-reference-v2)

Acceptance checklist for پنل ادمین سایت parity with
`design-reference-v2/پنل ادمین سایت.dc.html`.

## Nav
- [x] Sidebar order: داشبورد → آژانس‌ها → پرواز → گزارش مسافران → باشگاه مشتریان → استرداد بلیط → کارتابل → تیکت‌ها → مدیریت بلاگ → مدیریت سایت → درخواست‌های استخدام (+ kyc/settings product tabs) — `backend/test/panels.e2e-spec.ts` «confirmed tab set for SITE_ADMIN»
- [x] Labels match design sidebar (آژانس‌ها / پرواز / تیکت‌ها / درخواست‌های استخدام) — `panel-nav.config.ts`

## Shell
- [x] Brand subtitle «مدیریت عملیاتی» — `PanelShell.tsx` ROLE_BRAND_SUB
- [x] Avatar initial «اس» in footer chrome — `PanelShell.tsx`
- [x] Nav badges: refund awaiting review + open tickets for SITE_ADMIN — `PanelShell.tsx`
- [x] Cartable uses dark theme for SITE_ADMIN — `CartablePage.tsx`

## Dashboard
- [x] Four KPI cards: آژانس فعال / مسافر این ماه / بلیط فروخته‌شده / درخواست در انتظار اقدام — `SiteAdminDashboardPage.test.tsx`
- [x] Widgets: درخواست‌های آژانس‌ها، استرداد، کارتابل — same test
- [x] Backend `GET /reporting/site-admin-overview` (SITE_ADMIN) — docs/API.md + controller

## Login
- Username `site.admin` / password `Blujet@1404`

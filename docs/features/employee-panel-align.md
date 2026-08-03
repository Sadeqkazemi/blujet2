# EMPLOYEE panel dark-align (design-reference-v2)

Acceptance checklist for پنل کارمند parity with
`design-reference-v2/پنل کارمند.dc.html`.

## Nav
- [x] Labels match design: مدیریت آژانس‌ها / نرخ‌گذاری / گزارش‌ها — `EMPLOYEE_SECTION_NAV`
- [x] Order: agencies → flights → pricing → refund → reports → cartable (+ referrals always) — `panels.e2e-spec.ts`
- [x] Zero-perm employee still gets dashboard + referrals — `emp.none` in `panels.e2e-spec.ts`
- [x] Design demo `com.ahmadi` gets agencies + reports + cartable — `panels.e2e-spec.ts`

## Shell
- [x] Brand subtitle «پنل کارمند» — `PanelShell` ROLE_BRAND_SUB
- [x] No «نقش این پنل» chip for EMPLOYEE — `PanelShell.tsx`
- [x] Footer: name initials + fullName + واحد · رتبه + logout icon — `PanelShell.tsx`

## Dashboard
- [x] Title «داشبورد کارمند» + واحد pill — `EmployeeDashboardPage.test.tsx`
- [x] KPI row: کارهای باز / ارجاعات در انتظار / واحد سازمانی — same test

- [x] Dark employee cartable (کارتابل من) — `EmployeeCartablePage.tsx`

## Seed logins
- `com.ahmadi` / `Blujet@1404` — design demo (agencies, reports, cartable)
- `sales.moradi` / `Blujet@1404` — commercial demo (+ flights)
- `emp.none` / `Blujet@1404` — zero permissions

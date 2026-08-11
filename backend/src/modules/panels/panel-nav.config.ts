import { Role } from '../../database/enums';

export interface PanelNavItem {
  key: string;
  labelFa: string;
  /** Only "dashboard" is a working page in Phase 1 — everything else renders
   * a "به‌زودی" placeholder on the frontend until its phase lands. */
  implemented: boolean;
}

/**
 * SITE_ADMIN sidebar must never surface these keys (product request 2026-08).
 * Kept as an explicit denylist so a future accidental re-add to PANEL_NAV
 * cannot ship them again without also deleting this set.
 */
export const SITE_ADMIN_SIDEBAR_DENYLIST = new Set(['blog', 'kyc', 'settings']);

/**
 * Server-computed per-role sidebar, confirmed from a full read of each
 * panel's design file. Deliberately excludes tabs the extraction found to
 * be coded-but-unreachable (dead `sc-if` blocks with no nav trigger) —
 * see docs/DB_SCHEMA.md's design-extraction notes and PLAN.md.
 */
export const PANEL_NAV: Partial<Record<Role, PanelNavItem[]>> = {
  // Confirmed from پنل ادمین سایت.dc.html's roleDefs.siteAdmin.access.
  // `media` is in that same design list but still has no backend — left
  // out rather than shipped as a dead tab; see Phase 18 notes in
  // `blog` added in Phase D (real CMS backend).
  // `media` added in Phase E (site content CMS backend).
  // Order/labels match design-reference-v2/پنل ادمین سایت.dc.html
  // roleDefs.siteAdmin.access (visible sidebar). Blog/KYC/settings are
  // reachable via routes for other workflows but deliberately omitted from
  // the SITE_ADMIN sidebar per product request (2026-08).
  SITE_ADMIN: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'agencies', labelFa: 'آژانس‌ها', implemented: true },
    { key: 'flightops', labelFa: 'پرواز', implemented: true },
    { key: 'reports', labelFa: 'گزارش مسافران', implemented: true },
    { key: 'customers', labelFa: 'مشتریان', implemented: true },
    { key: 'club', labelFa: 'باشگاه مشتریان', implemented: true },
    { key: 'loans', labelFa: 'درخواست وام', implemented: true },
    { key: 'refund', labelFa: 'استرداد بلیط', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
    { key: 'tickets', labelFa: 'تیکت‌ها', implemented: true },
    { key: 'media', labelFa: 'مدیریت سایت', implemented: true },
    { key: 'jobapps', labelFa: 'درخواست‌های استخدام', implemented: true },
  ],
  // Order matches design-reference-v2/پنل مدیر عامل.dc.html sidebar
  // (settings is display:none there). clubrules stays on COMMERCIAL_MANAGER;
  // flightops stays on SITE_ADMIN. `reservation` (label هواپیما) is in
  // roleDefs.ceo.access and the approved CEO screenshots — same key/label
  // as BOARD_CHAIR.
  CEO: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'admins', labelFa: 'مدیران', implemented: true },
    { key: 'finance', labelFa: 'مالی', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
    { key: 'club', labelFa: 'مشتریان VIP', implemented: true },
    { key: 'survey', labelFa: 'نظرسنجی مسافران', implemented: true },
    { key: 'mgrreports', labelFa: 'گزارش مدیران', implemented: true },
    { key: 'reservation', labelFa: 'هواپیما', implemented: true },
    { key: 'pricing', labelFa: 'تعیین قیمت بلیط', implemented: true },
    { key: 'panels', labelFa: 'دسترسی به پنل‌ها', implemented: true },
    { key: 'security', labelFa: 'امنیت و رمز عبور', implemented: true },
    { key: 'logs', labelFa: 'لاگ و رویدادها', implemented: true },
  ],
  BOARD_CHAIR: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'admins', labelFa: 'مدیران', implemented: true },
    { key: 'finance', labelFa: 'مالی', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
    { key: 'club', labelFa: 'مشتریان VIP', implemented: true },
    { key: 'reservation', labelFa: 'هواپیما', implemented: true },
    { key: 'mgrreports', labelFa: 'گزارش مدیران', implemented: true },
    { key: 'survey', labelFa: 'نظرسنجی مسافران', implemented: true },
  ],
  // Senior Manager sidebar — mirrors CEO executive tabs for shared surfaces;
  // `reservation` labeled هواپیما like CEO (content: ExecReservationView).
  SENIOR_MANAGER: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'customers', labelFa: 'مشتریان', implemented: true },
    { key: 'admins', labelFa: 'مدیران و ادمین‌ها', implemented: true },
    { key: 'finance', labelFa: 'مالی', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
    { key: 'mgrreports', labelFa: 'گزارش مدیران', implemented: true },
    { key: 'vip', labelFa: 'مشتریان VIP', implemented: true },
    { key: 'survey', labelFa: 'نظرسنجی مسافران', implemented: true },
    { key: 'reservation', labelFa: 'هواپیما', implemented: true },
    { key: 'aircraft', labelFa: 'تعریف هواپیما', implemented: true },
    { key: 'panels', labelFa: 'دسترسی به پنل‌ها', implemented: true },
    { key: 'security', labelFa: 'امنیت و رمز عبور', implemented: true },
  ],
  FINANCE_MANAGER: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'agencies', labelFa: 'آژانس‌ها', implemented: true },
    { key: 'reports', labelFa: 'گزارش مسافران', implemented: true },
    { key: 'staff', labelFa: 'گزارش کارمندان', implemented: true },
    { key: 'finance', labelFa: 'مالی', implemented: true },
    { key: 'refund', labelFa: 'استرداد بلیط', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
  ],
  COMMERCIAL_MANAGER: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'agencies', labelFa: 'آژانس‌ها', implemented: true },
    { key: 'flights', labelFa: 'مدیریت پروازها', implemented: true },
    { key: 'routes', labelFa: 'مسیرهای پروازی', implemented: true },
    { key: 'aircraft', labelFa: 'تعریف هواپیما', implemented: true },
    { key: 'reports', labelFa: 'گزارش مسافران', implemented: true },
    { key: 'staff', labelFa: 'گزارش کارمندان', implemented: true },
    { key: 'clubrules', labelFa: 'قوانین باشگاه مشتریان', implemented: true },
    { key: 'webservice', labelFa: 'وب سرویس', implemented: true },
    { key: 'finance', labelFa: 'مالی', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
  ],
  OPERATIONS_MANAGER: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
    { key: 'flights', labelFa: 'مدیریت پرواز', implemented: true },
  ],
  IT_MANAGER: [
    // Phase 8: real service-health/os-metrics dashboard, not the shared
    // sales/KPI one the other 5 roles get (IT_MANAGER stays excluded from
    // REPORTING_ROLES). reservation/panels/settings stay deferred to
    // Phase 9 / Phase 12 respectively — see docs/API.md's Phase 8 note.
    { key: 'dashboard', labelFa: 'داشبورد فنی', implemented: true },
    { key: 'users', labelFa: 'کاربران و دسترسی‌ها', implemented: true },
    { key: 'security', labelFa: 'رمزها و امنیت', implemented: true },
    { key: 'services', labelFa: 'سرویس‌های سایت', implemented: true },
    { key: 'reservation', labelFa: 'سامانه رزرواسیون', implemented: true },
    { key: 'panels', labelFa: 'دسترسی به پنل‌ها', implemented: true },
    { key: 'logs', labelFa: 'لاگ و رویدادها', implemented: true },
    { key: 'survey', labelFa: 'نظرسنجی مسافران', implemented: true },
    { key: 'backup', labelFa: 'پشتیبان‌گیری', implemented: true },
    { key: 'settings', labelFa: 'تنظیمات سامانه', implemented: true },
  ],
};

/** Which panel keys each role may toggle via PATCH /panels/access/:panelKey. */
export const PANEL_ACCESS_TOGGLE_RIGHTS: Partial<Record<Role, string[]>> = {
  CEO: ['FINANCE', 'COMMERCIAL', 'OPERATIONS', 'IT'],
  SENIOR_MANAGER: [
    'CEO',
    'SITE_ADMIN',
    'FINANCE',
    'COMMERCIAL',
    'OPERATIONS',
    'IT',
  ],
};

/**
 * EMPLOYEE's sidebar is computed per-user (see پنل کارمند.dc.html's
 * `navKeys = ["dashboard"].concat(granted).concat(["referrals"])`), not a
 * static PANEL_NAV row. This maps each PERMISSION_CATALOG sectionKey to
 * the nav tab it unlocks and the exact catalog key(s) actually wired to
 * real backend access this phase — an employee only sees the tab if they
 * hold one of its wired keys, so a section that's in the catalog but not
 * yet wired (the whole IT dept: users/services/security/logs) never
 * renders as a dead tab. See Phase 18 notes in docs/DB_SCHEMA.md;
 * fl_manage/ag_settle/fn_invoices wired in Phase 27.
 *
 * fn_invoices' real UI surface is the per-agency invoice list on
 * AgencyDetailPage (reached via the `agencies` tab, same as ag_settle) —
 * NOT FinancePage.tsx's FINANCE_MANAGER-only company-wide financial
 * dashboard (revenue/profit/all-transactions), which stays unwidened:
 * fn_invoices's catalog label ("مشاهده و مدیریت فاکتورها") is scoped to
 * invoices, and granting that full dashboard would be a real
 * over-broad-access risk, not a mechanical nav wiring.
 */
export const EMPLOYEE_SECTION_NAV: Record<
  string,
  { labelFa: string; wiredKeys: string[] }
> = {
  // Order + labels match design-reference-v2/پنل کارمند.dc.html + user
  // screenshots (سمیرا احمدی). «مدیریت پروازها» removed from employee
  // sidebar per product — fl_* stays permission-catalog only, no tab.
  // finance / IT sections stay unwired — no dead tabs.
  agencies: {
    labelFa: 'مدیریت آژانس‌ها',
    wiredKeys: [
      'ag_list',
      'ag_requests',
      'ag_info',
      'ag_settle',
      'fn_invoices',
    ],
  },
  pricing: { labelFa: 'نرخ‌گذاری', wiredKeys: ['pr_propose'] },
  refund: {
    labelFa: 'استرداد بلیط',
    wiredKeys: ['rf_list', 'rf_details', 'rf_process'],
  },
  reports: { labelFa: 'گزارش‌ها', wiredKeys: ['rp_sales', 'rp_finance'] },
  cartable: {
    labelFa: 'کارتابل',
    wiredKeys: ['ct_list', 'ct_process'],
  },
};

export const ALL_PANEL_KEYS = [
  'SITE_ADMIN',
  'CEO',
  'BOARD_CHAIR',
  'SENIOR_MANAGER',
  'FINANCE',
  'COMMERCIAL',
  'OPERATIONS',
  'IT',
];

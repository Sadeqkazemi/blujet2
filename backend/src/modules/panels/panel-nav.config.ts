import { Role } from '../../../generated/prisma/enums';

export interface PanelNavItem {
  key: string;
  labelFa: string;
  /** Only "dashboard" is a working page in Phase 1 — everything else renders
   * a "به‌زودی" placeholder on the frontend until its phase lands. */
  implemented: boolean;
}

/**
 * Server-computed per-role sidebar, confirmed from a full read of each
 * panel's design file. Deliberately excludes tabs the extraction found to
 * be coded-but-unreachable (dead `sc-if` blocks with no nav trigger) —
 * see docs/DB_SCHEMA.md's design-extraction notes and PLAN.md.
 */
export const PANEL_NAV: Partial<Record<Role, PanelNavItem[]>> = {
  // Confirmed from پنل ادمین سایت.dc.html's roleDefs.siteAdmin.access.
  // blog/media are in that same design list but still have no backend
  // anywhere in the codebase — left out entirely rather than shipped as an
  // unreachable tab; see Phase 18 notes in docs/DB_SCHEMA.md. `tickets`
  // was in the same deferred list but now has a real (scoped-down)
  // backend (Phase 20); `flightops` likewise now has a real backend
  // (Phase 24 — sale auto-close + نیرا manifest submission).
  SITE_ADMIN: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'agencies', labelFa: 'مدیریت آژانس‌ها', implemented: true },
    { key: 'flightops', labelFa: 'پروازها', implemented: true },
    { key: 'reports', labelFa: 'گزارش مسافران', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
    { key: 'club', labelFa: 'باشگاه مشتریان', implemented: true },
    { key: 'refund', labelFa: 'استرداد بلیط', implemented: true },
    { key: 'tickets', labelFa: 'تیکت‌های پشتیبانی', implemented: true },
  ],
  CEO: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'flightops', labelFa: 'پروازها', implemented: true },
    { key: 'admins', labelFa: 'مدیران', implemented: true },
    { key: 'finance', labelFa: 'مالی', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
    { key: 'club', labelFa: 'مشتریان VIP', implemented: true },
    { key: 'mgrreports', labelFa: 'گزارش مدیران', implemented: true },
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
    { key: 'settings', labelFa: 'تنظیمات سامانه', implemented: true },
    { key: 'club', labelFa: 'مشتریان VIP', implemented: true },
    { key: 'reservation', labelFa: 'هواپیما', implemented: true },
    { key: 'mgrreports', labelFa: 'گزارش مدیران', implemented: true },
  ],
  SENIOR_MANAGER: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'agencies', labelFa: 'آژانس‌ها', implemented: true },
    { key: 'flights', labelFa: 'مدیریت پروازها', implemented: true },
    { key: 'admins', labelFa: 'مدیران و ادمین‌ها', implemented: true },
    { key: 'reports', labelFa: 'گزارش مسافران', implemented: true },
    { key: 'finance', labelFa: 'مالی', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
    { key: 'referrals', labelFa: 'ارجاعات', implemented: true },
    { key: 'mgrreports', labelFa: 'گزارش مدیران', implemented: true },
    { key: 'vip', labelFa: 'مشتریان VIP', implemented: true },
    { key: 'panels', labelFa: 'دسترسی به پنل‌ها', implemented: true },
    { key: 'security', labelFa: 'امنیت و رمز عبور', implemented: true },
    { key: 'reservation', labelFa: 'سامانه رزرواسیون', implemented: true },
  ],
  FINANCE_MANAGER: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'agencies', labelFa: 'آژانس‌ها', implemented: true },
    { key: 'flightops', labelFa: 'پروازها', implemented: true },
    { key: 'reports', labelFa: 'گزارش مسافران', implemented: true },
    { key: 'staff', labelFa: 'گزارش کارمندان', implemented: true },
    { key: 'finance', labelFa: 'مالی', implemented: true },
    { key: 'refund', labelFa: 'استرداد بلیط', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
  ],
  COMMERCIAL_MANAGER: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'agencies', labelFa: 'آژانس‌ها', implemented: true },
    { key: 'flightops', labelFa: 'پروازها', implemented: true },
    { key: 'flights', labelFa: 'مدیریت پروازها', implemented: true },
    { key: 'reports', labelFa: 'گزارش مسافران', implemented: true },
    { key: 'staff', labelFa: 'گزارش کارمندان', implemented: true },
    { key: 'finance', labelFa: 'مالی', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
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
    { key: 'backup', labelFa: 'پشتیبان‌گیری', implemented: true },
    { key: 'settings', labelFa: 'تنظیمات سامانه', implemented: true },
  ],
};

/** Which panel keys each role may toggle via PATCH /panels/access/:panelKey. */
export const PANEL_ACCESS_TOGGLE_RIGHTS: Partial<Record<Role, string[]>> = {
  CEO: ['FINANCE', 'COMMERCIAL', 'IT'],
  SENIOR_MANAGER: ['CEO', 'SITE_ADMIN', 'FINANCE', 'COMMERCIAL', 'IT'],
};

/**
 * EMPLOYEE's sidebar is computed per-user (see پنل کارمند.dc.html's
 * `navKeys = ["dashboard"].concat(granted).concat(["referrals"])`), not a
 * static PANEL_NAV row. This maps each PERMISSION_CATALOG sectionKey to
 * the nav tab it unlocks and the exact catalog key(s) actually wired to
 * real backend access this phase — an employee only sees the tab if they
 * hold one of its wired keys, so a section that's in the catalog but not
 * yet wired (finance/fn_invoices, agencies/ag_settle, and the whole IT
 * dept: users/services/security/logs) never renders as a dead tab. See
 * Phase 18 notes in docs/DB_SCHEMA.md.
 */
export const EMPLOYEE_SECTION_NAV: Record<
  string,
  { labelFa: string; wiredKeys: string[] }
> = {
  agencies: {
    labelFa: 'آژانس‌ها',
    wiredKeys: ['ag_list', 'ag_requests', 'ag_info'],
  },
  flights: { labelFa: 'مدیریت پروازها', wiredKeys: ['fl_view'] },
  pricing: { labelFa: 'تعیین قیمت بلیط', wiredKeys: ['pr_propose'] },
  reports: { labelFa: 'گزارش مسافران', wiredKeys: ['rp_sales', 'rp_finance'] },
  refund: {
    labelFa: 'استرداد بلیط',
    wiredKeys: ['rf_list', 'rf_details', 'rf_process'],
  },
};

export const ALL_PANEL_KEYS = [
  'SITE_ADMIN',
  'CEO',
  'BOARD_CHAIR',
  'SENIOR_MANAGER',
  'FINANCE',
  'COMMERCIAL',
  'IT',
];

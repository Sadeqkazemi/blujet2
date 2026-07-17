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
  CEO: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'admins', labelFa: 'مدیران', implemented: false },
    { key: 'finance', labelFa: 'مالی', implemented: false },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
    { key: 'club', labelFa: 'مشتریان VIP', implemented: true },
    { key: 'mgrreports', labelFa: 'گزارش مدیران', implemented: false },
    { key: 'pricing', labelFa: 'تعیین قیمت بلیط', implemented: true },
    { key: 'panels', labelFa: 'دسترسی به پنل‌ها', implemented: false },
    { key: 'security', labelFa: 'امنیت و رمز عبور', implemented: false },
    { key: 'logs', labelFa: 'لاگ و رویدادها', implemented: false },
  ],
  BOARD_CHAIR: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'admins', labelFa: 'مدیران', implemented: false },
    { key: 'finance', labelFa: 'مالی', implemented: false },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
    { key: 'settings', labelFa: 'تنظیمات سامانه', implemented: false },
    { key: 'club', labelFa: 'مشتریان VIP', implemented: true },
    { key: 'reservation', labelFa: 'هواپیما', implemented: false },
    { key: 'mgrreports', labelFa: 'گزارش مدیران', implemented: false },
  ],
  SENIOR_MANAGER: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'agencies', labelFa: 'آژانس‌ها', implemented: true },
    { key: 'flights', labelFa: 'مدیریت پروازها', implemented: false },
    { key: 'admins', labelFa: 'مدیران و ادمین‌ها', implemented: false },
    { key: 'reports', labelFa: 'گزارش مسافران', implemented: false },
    { key: 'finance', labelFa: 'مالی', implemented: false },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
    { key: 'referrals', labelFa: 'ارجاعات', implemented: true },
    { key: 'mgrreports', labelFa: 'گزارش مدیران', implemented: false },
    { key: 'vip', labelFa: 'مشتریان VIP', implemented: true },
    { key: 'panels', labelFa: 'دسترسی به پنل‌ها', implemented: false },
    { key: 'security', labelFa: 'امنیت و رمز عبور', implemented: false },
    { key: 'reservation', labelFa: 'سامانه رزرواسیون', implemented: false },
  ],
  FINANCE_MANAGER: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'agencies', labelFa: 'آژانس‌ها', implemented: true },
    { key: 'reports', labelFa: 'گزارش مسافران', implemented: false },
    { key: 'staff', labelFa: 'گزارش کارمندان', implemented: false },
    { key: 'finance', labelFa: 'مالی', implemented: false },
    { key: 'refund', labelFa: 'استرداد بلیط', implemented: false },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
  ],
  COMMERCIAL_MANAGER: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'agencies', labelFa: 'آژانس‌ها', implemented: true },
    { key: 'flights', labelFa: 'مدیریت پروازها', implemented: true },
    { key: 'reports', labelFa: 'گزارش مسافران', implemented: false },
    { key: 'staff', labelFa: 'گزارش کارمندان', implemented: false },
    { key: 'finance', labelFa: 'مالی', implemented: false },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
  ],
  IT_MANAGER: [
    // Not the shared sales/KPI dashboard the other 5 roles get (IT's real
    // "داشبورد فنی" is service-health widgets, no reporting endpoints back
    // it yet — IT_MANAGER is deliberately excluded from REPORTING_ROLES).
    { key: 'dashboard', labelFa: 'داشبورد فنی', implemented: false },
    { key: 'users', labelFa: 'کاربران و دسترسی‌ها', implemented: false },
    { key: 'security', labelFa: 'رمزها و امنیت', implemented: false },
    { key: 'services', labelFa: 'سرویس‌های سایت', implemented: false },
    { key: 'reservation', labelFa: 'سامانه رزرواسیون', implemented: false },
    { key: 'panels', labelFa: 'دسترسی به پنل‌ها', implemented: false },
    { key: 'logs', labelFa: 'لاگ و رویدادها', implemented: false },
    { key: 'backup', labelFa: 'پشتیبان‌گیری', implemented: false },
    { key: 'settings', labelFa: 'تنظیمات سامانه', implemented: false },
  ],
};

/** Which panel keys each role may toggle via PATCH /panels/access/:panelKey. */
export const PANEL_ACCESS_TOGGLE_RIGHTS: Partial<Record<Role, string[]>> = {
  CEO: ['FINANCE', 'COMMERCIAL', 'IT'],
  SENIOR_MANAGER: ['CEO', 'SITE_ADMIN', 'FINANCE', 'COMMERCIAL', 'IT'],
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

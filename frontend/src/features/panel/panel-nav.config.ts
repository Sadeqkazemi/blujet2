import type { Role } from '../../types/auth';
import type { PanelNavItem } from '../../types/panels';

/**
 * Client-side mirror of backend `panel-nav.config.ts` — used when GET /panels/nav
 * fails (backend down, cookie/CORS) or returns an empty list so TabGate never
 * blocks real pages with the coming-soon placeholder.
 */
export const CLIENT_PANEL_NAV: Partial<Record<Role, PanelNavItem[]>> = {
  SITE_ADMIN: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'agencies', labelFa: 'مدیریت آژانس‌ها', implemented: true },
    { key: 'flightops', labelFa: 'پروازها', implemented: true },
    { key: 'reports', labelFa: 'گزارش مسافران', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
    { key: 'club', labelFa: 'باشگاه مشتریان', implemented: true },
    { key: 'refund', labelFa: 'استرداد بلیط', implemented: true },
    { key: 'tickets', labelFa: 'تیکت‌های پشتیبانی', implemented: true },
    { key: 'blog', labelFa: 'مدیریت بلاگ', implemented: true },
    { key: 'media', labelFa: 'مدیریت سایت', implemented: true },
    { key: 'jobapps', labelFa: 'فرصت‌های شغلی', implemented: true },
    { key: 'kyc', labelFa: 'احراز هویت مشتریان', implemented: true },
    { key: 'settings', labelFa: 'تنظیمات سامانه', implemented: true },
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
    { key: 'clubrules', labelFa: 'قوانین باشگاه مشتریان', implemented: true },
    { key: 'panels', labelFa: 'دسترسی به پنل‌ها', implemented: true },
    { key: 'security', labelFa: 'امنیت و رمز عبور', implemented: true },
    { key: 'logs', labelFa: 'لاگ و رویدادها', implemented: true },
    { key: 'survey', labelFa: 'نظرسنجی مسافران', implemented: true },
  ],
  // Order matches design-reference-v2/پنل رئیس هیئت مدیره.dc.html sidebar.
  BOARD_CHAIR: [
    { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    { key: 'admins', labelFa: 'مدیران', implemented: true },
    { key: 'finance', labelFa: 'مالی', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
    { key: 'settings', labelFa: 'تنظیمات سامانه', implemented: true },
    { key: 'club', labelFa: 'مشتریان VIP', implemented: true },
    { key: 'survey', labelFa: 'نظرسنجی مسافران', implemented: true },
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
    { key: 'survey', labelFa: 'نظرسنجی مسافران', implemented: true },
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
    { key: 'reports', labelFa: 'گزارش مسافران', implemented: true },
    { key: 'staff', labelFa: 'گزارش کارمندان', implemented: true },
    { key: 'clubrules', labelFa: 'قوانین باشگاه مشتریان', implemented: true },
    { key: 'webservice', labelFa: 'وب سرویس', implemented: true },
    { key: 'finance', labelFa: 'مالی', implemented: true },
    { key: 'cartable', labelFa: 'کارتابل', implemented: true },
  ],
  IT_MANAGER: [
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

export function fallbackNavForRole(role: string | undefined): PanelNavItem[] {
  if (!role) return [];
  return CLIENT_PANEL_NAV[role as Role] ?? [];
}

/** Prefer API nav; fall back to static role nav when API is empty or unavailable. */
export function resolvePanelNav(
  apiNav: PanelNavItem[] | null,
  role: string | undefined,
): PanelNavItem[] | null {
  if (apiNav === null) return null;
  if (apiNav.length > 0) return apiNav;
  return fallbackNavForRole(role);
}

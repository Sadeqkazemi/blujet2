import type { AdminCreatableRole } from '../../types/admins';

export type PermKey =
  | 'flights'
  | 'agencies'
  | 'reports'
  | 'finance'
  | 'refunds'
  | 'club'
  | 'content'
  | 'support'
  | 'admins'
  | 'settings';

export type PermState = Record<PermKey, boolean>;

export const PERM_DEFS: { key: PermKey; label: string; desc: string }[] = [
  {
    key: 'flights',
    label: 'مدیریت پروازها',
    desc: 'افزودن، ویرایش و نرخ‌گذاری پروازها',
  },
  {
    key: 'agencies',
    label: 'مدیریت آژانس‌ها',
    desc: 'پروفایل، اعتبار و درخواست آژانس‌ها',
  },
  { key: 'reports', label: 'گزارش مسافران', desc: 'جستجوی مسافر و گزارش فروش' },
  { key: 'finance', label: 'مالی و تسویه', desc: 'تراکنش‌ها و تسویه‌حساب' },
  {
    key: 'refunds',
    label: 'استرداد بلیط',
    desc: 'بررسی و تأیید درخواست‌های استرداد',
  },
  {
    key: 'club',
    label: 'باشگاه مشتریان',
    desc: 'اعضا، امتیاز و صدور کارت عضویت',
  },
  {
    key: 'content',
    label: 'محتوای سایت و بلاگ',
    desc: 'بنرها، مقاصد و مطالب بلاگ',
  },
  {
    key: 'support',
    label: 'پشتیبانی و تیکت‌ها',
    desc: 'پاسخ به تیکت‌های کاربران',
  },
  {
    key: 'admins',
    label: 'مدیریت مدیران',
    desc: 'افزودن و تعیین سطح دسترسی مدیران',
  },
  { key: 'settings', label: 'تنظیمات سامانه', desc: 'پیکربندی کلی سیستم' },
];

/** Default permission toggles per creatable role — design-reference-v2 rolePresets(). */
const ROLE_PRESET_BITS: Record<AdminCreatableRole, Record<PermKey, 0 | 1>> = {
  SENIOR_MANAGER: {
    flights: 1,
    agencies: 1,
    reports: 1,
    finance: 1,
    refunds: 1,
    club: 1,
    content: 1,
    support: 1,
    admins: 1,
    settings: 1,
  },
  FINANCE_MANAGER: {
    flights: 0,
    agencies: 0,
    reports: 1,
    finance: 1,
    refunds: 1,
    club: 0,
    content: 0,
    support: 0,
    admins: 0,
    settings: 0,
  },
  COMMERCIAL_MANAGER: {
    flights: 1,
    agencies: 1,
    reports: 1,
    finance: 1,
    refunds: 0,
    club: 0,
    content: 0,
    support: 0,
    admins: 0,
    settings: 0,
  },
  IT_MANAGER: {
    flights: 0,
    agencies: 0,
    reports: 0,
    finance: 0,
    refunds: 0,
    club: 0,
    content: 0,
    support: 1,
    admins: 1,
    settings: 1,
  },
  SITE_ADMIN: {
    flights: 0,
    agencies: 0,
    reports: 1,
    finance: 0,
    refunds: 0,
    club: 1,
    content: 1,
    support: 1,
    admins: 0,
    settings: 0,
  },
};

export function rolePermissionPreset(role: AdminCreatableRole): PermState {
  const bits = ROLE_PRESET_BITS[role];
  return PERM_DEFS.reduce((acc, { key }) => {
    acc[key] = bits[key] === 1;
    return acc;
  }, {} as PermState);
}

export function enabledPermissionKeys(perms: PermState): PermKey[] {
  return PERM_DEFS.filter(({ key }) => perms[key]).map(({ key }) => key);
}

export function permissionStateFromKeys(
  keys: readonly string[],
  fallbackRole: AdminCreatableRole,
): PermState {
  const known = new Set(PERM_DEFS.map(({ key }) => key));
  if (keys.some((key) => !known.has(key as PermKey))) {
    return rolePermissionPreset(fallbackRole);
  }
  const selected = new Set(keys);
  return PERM_DEFS.reduce((state, { key }) => {
    state[key] = selected.has(key);
    return state;
  }, {} as PermState);
}

export function deriveUsernameFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim().toLowerCase() ?? '';
  const sanitized = local
    .replace(/[^a-z0-9._-]/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  if (sanitized.length >= 3) return sanitized;
  return `admin.${Date.now().toString(36).slice(-6)}`;
}

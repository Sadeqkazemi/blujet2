/** SVG inner paths for each panel nav key — extracted from design-reference-v2 panel files. */
export const PANEL_NAV_ICON_PATHS: Record<string, string> = {
  dashboard:
    '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  agencies:
    '<path d="M3 21h18"/><path d="M6 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16"/><path d="M19 21V10a1 1 0 0 0-1-1h-3"/><path d="M9 8h3M9 12h3M9 16h3"/>',
  flights:
    '<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>',
  flightops:
    '<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>',
  admins:
    '<path d="M12 3l7 3v5.5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  reports:
    '<circle cx="10" cy="8" r="3.5"/><path d="M4 19c0-3 2.7-5.5 6-5.5"/><circle cx="16.5" cy="16.5" r="3"/><path d="M21 21l-2.3-2.3"/>',
  staff:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  finance:
    '<path d="M3 3v18h18"/><path d="M7 14l3.5-3.5 3 3L20 7"/><path d="M16 7h4v4"/>',
  refund:
    '<path d="M9 14l-4-4 4-4"/><path d="M5 10h9a5 5 0 0 1 0 10h-3"/>',
  cartable:
    '<path d="M4 13h4l1.5 3h5L16 13h4"/><path d="M5.5 13L7 5.5h10L18.5 13v5a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1z"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  club:
    '<path d="M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.8 6.8 18.2l1-5.8L3.5 8.2l5.9-.9z"/>',
  vip:
    '<path d="M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.8 6.8 18.2l1-5.8L3.5 8.2l5.9-.9z"/>',
  mgrreports:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17v-5M12 17v-8M15 17v-3"/>',
  pricing:
    '<path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
  clubrules:
    '<path d="M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.8 6.8 18.2l1-5.8L3.5 8.2l5.9-.9z"/>',
  panels:
    '<path d="M12 3l7 3v5.5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
  security:
    '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  logs:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/>',
  survey:
    '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  reservation:
    '<path d="M12 3l7 3v5.5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-3z"/>',
  referrals:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  users:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  services:
    '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  backup:
    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/>',
  tickets:
    '<path d="M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5z"/><path d="M9 8h6M9 12h6"/>',
  blog:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  media:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  jobapps:
    '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
  kyc:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2M15 12h2M7 16h10"/>',
  webservice:
    '<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M13.5 6l-3 12"/>',
};

export const PANEL_PAGE_SUBTITLES: Record<string, string> = {
  dashboard: 'نمای کلی فروش و کارهای در انتظار اقدام',
  agencies: 'مدیریت آژانس‌های همکار و درخواست‌های عضویت',
  flights: 'برنامه‌ریزی، ظرفیت و قیمت‌گذاری پروازها',
  flightops: 'وضعیت پروازها و ارسال مانیفست',
  admins: 'افزودن و تعیین سطح دسترسی مدیران',
  reports: 'جستجو و گزارش مسافران',
  staff: 'فعالیت و گزارش‌های کارمندان',
  finance: 'گزارش‌های مالی، درآمد و تسویه',
  refund: 'بررسی و پرداخت درخواست‌های استرداد',
  cartable: 'وظایف و پیام‌های سازمانی',
  settings: 'تنظیمات کلی سامانه',
  club: 'باشگاه مشتریان VIP',
  vip: 'باشگاه مشتریان VIP',
  mgrreports: 'فعالیت مدیران و رویدادهای سیستم',
  pricing: 'پیشنهادات قیمت و تأیید نرخ',
  clubrules: 'قوانین امتیاز و سطوح باشگاه',
  panels: 'فعال/غیرفعال کردن دسترسی نقش‌ها',
  security: 'رمز عبور و تنظیمات امنیتی',
  logs: 'لاگ و رویدادهای سیستم',
  survey: 'نظرسنجی مسافران',
  reservation: 'سامانه رزرواسیون و قفل صندلی',
  referrals: 'ارجاعات و گزارش‌های پیگیری',
  users: 'کاربران، دسترسی‌ها و مجوزها',
  services: 'سرویس‌های داخلی و خارجی',
  backup: 'پشتیبان‌گیری و بازیابی',
  tickets: 'تیکت‌های پشتیبانی مشتریان',
  blog: 'مدیریت مطالب بلاگ',
  media: 'محتوا و رسانه‌های سایت',
  jobapps: 'آگهی‌ها و درخواست‌های استخدام',
  kyc: 'بررسی احراز هویت مشتریان',
  webservice: 'تعرفه و تنظیمات وب‌سرویس B2B',
};

export function panelInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

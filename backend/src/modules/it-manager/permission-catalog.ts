/**
 * Verbatim reproduction of design-reference/site-data.js's PERM_CATALOG —
 * seeded into the `Permission` table (see docs/DB_SCHEMA.md -> Phase 8).
 * Keep in sync if the design bundle is ever re-exported.
 */
export interface PermissionCatalogEntry {
  dept: string;
  sectionKey: string;
  sectionLabelFa: string;
  key: string;
  labelFa: string;
}

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  // commercial
  {
    dept: 'commercial',
    sectionKey: 'agencies',
    sectionLabelFa: 'مدیریت آژانس‌ها',
    key: 'ag_list',
    labelFa: 'مشاهدهٔ فهرست آژانس‌ها',
  },
  {
    dept: 'commercial',
    sectionKey: 'agencies',
    sectionLabelFa: 'مدیریت آژانس‌ها',
    key: 'ag_requests',
    labelFa: 'بررسی درخواست عضویت جدید آژانس',
  },
  {
    dept: 'commercial',
    sectionKey: 'agencies',
    sectionLabelFa: 'مدیریت آژانس‌ها',
    key: 'ag_info',
    labelFa: 'دسترسی به اطلاعات کامل آژانس',
  },
  {
    dept: 'commercial',
    sectionKey: 'flights',
    sectionLabelFa: 'مدیریت پروازها',
    key: 'fl_view',
    labelFa: 'مشاهدهٔ پروازها',
  },
  {
    dept: 'commercial',
    sectionKey: 'flights',
    sectionLabelFa: 'مدیریت پروازها',
    key: 'fl_manage',
    labelFa: 'ویرایش و مدیریت پرواز',
  },
  {
    dept: 'commercial',
    sectionKey: 'pricing',
    sectionLabelFa: 'نرخ‌گذاری',
    key: 'pr_propose',
    labelFa: 'ثبت نرخ پیشنهادی',
  },
  {
    dept: 'commercial',
    sectionKey: 'reports',
    sectionLabelFa: 'گزارش‌ها',
    key: 'rp_sales',
    labelFa: 'گزارش فروش',
  },
  // finance
  {
    dept: 'finance',
    sectionKey: 'refund',
    sectionLabelFa: 'استرداد بلیط',
    key: 'rf_list',
    labelFa: 'مشاهدهٔ درخواست‌های استرداد',
  },
  {
    dept: 'finance',
    sectionKey: 'refund',
    sectionLabelFa: 'استرداد بلیط',
    key: 'rf_details',
    labelFa: 'مشاهدهٔ جزییات کامل مسافر',
  },
  {
    dept: 'finance',
    sectionKey: 'refund',
    sectionLabelFa: 'استرداد بلیط',
    key: 'rf_process',
    labelFa: 'پردازش و ارجاع استرداد',
  },
  {
    dept: 'finance',
    sectionKey: 'agencies',
    sectionLabelFa: 'آژانس‌ها',
    key: 'ag_settle',
    labelFa: 'تسویه حساب آژانس‌ها',
  },
  {
    dept: 'finance',
    sectionKey: 'agencies',
    sectionLabelFa: 'آژانس‌ها',
    key: 'ag_info',
    labelFa: 'دسترسی به اطلاعات آژانس',
  },
  {
    dept: 'finance',
    sectionKey: 'finance',
    sectionLabelFa: 'امور مالی',
    key: 'fn_invoices',
    labelFa: 'مشاهده و مدیریت فاکتورها',
  },
  {
    dept: 'finance',
    sectionKey: 'reports',
    sectionLabelFa: 'گزارش‌ها',
    key: 'rp_finance',
    labelFa: 'گزارش مالی',
  },
  // it
  {
    dept: 'it',
    sectionKey: 'users',
    sectionLabelFa: 'مدیریت کاربران',
    key: 'us_manage',
    labelFa: 'ایجاد و مدیریت کاربران',
  },
  {
    dept: 'it',
    sectionKey: 'services',
    sectionLabelFa: 'سرویس‌های سایت',
    key: 'sv_control',
    labelFa: 'کنترل و راه‌اندازی سرویس‌ها',
  },
  {
    dept: 'it',
    sectionKey: 'security',
    sectionLabelFa: 'امنیت',
    key: 'sc_manage',
    labelFa: 'مدیریت امنیت و رمزها',
  },
  {
    dept: 'it',
    sectionKey: 'logs',
    sectionLabelFa: 'لاگ و رویدادها',
    key: 'lg_view',
    labelFa: 'مشاهدهٔ لاگ و رویدادها',
  },
];

/** Departments that pick a real permission catalog; anything else is a
 * custom department created ad hoc by IT and starts with zero perm rows. */
export const CATALOG_DEPTS = ['commercial', 'finance', 'it'] as const;

export function catalogDeptFor(dept: string): string {
  // The design's "واحد فروش" (sales) card is explicitly a sub-unit of
  // Commercial Manager — reuse the commercial catalog for it.
  if (dept === 'sales') return 'commercial';
  return dept;
}

export const INTERNAL_SERVICE_SEED = [
  { key: 'search', nameFa: 'موتور جستجوی پرواز', uptimePct: 99.99 },
  { key: 'payment', nameFa: 'درگاه پرداخت بانکی', uptimePct: 99.95 },
  { key: 'api', nameFa: 'وب‌سرویس API آژانس‌ها', uptimePct: 99.9 },
  { key: 'sms', nameFa: 'سامانه پیامک (SMS)', uptimePct: 99.8 },
  { key: 'email', nameFa: 'سرویس ایمیل', uptimePct: 99.99 },
  { key: 'club', nameFa: 'باشگاه مشتریان', uptimePct: 100 },
  { key: 'charter', nameFa: 'فروش چارتر', uptimePct: 99.7 },
  { key: 'refund', nameFa: 'استرداد آنلاین', uptimePct: 98.2 },
  { key: 'checkin', nameFa: 'چک‌این آنلاین', uptimePct: 99.6 },
  { key: 'cdn', nameFa: 'CDN و تصاویر', uptimePct: 100 },
  { key: 'dest', nameFa: 'نقشه و مقاصد', uptimePct: 99.99 },
  { key: 'mobile', nameFa: 'اپلیکیشن موبایل (API)', uptimePct: 99.85 },
];

export const EXTERNAL_SERVICE_SEED = [
  {
    key: 'ext_zarinpal',
    nameFa: 'درگاه پرداخت زرین‌پال',
    provider: 'زرین‌پال',
    endpoint: 'https://api.zarinpal.com/pg/v4/payment/request.json',
  },
  {
    key: 'ext_amadeus',
    nameFa: 'موتور رزرواسیون آمادئوس',
    provider: 'Amadeus GDS',
    endpoint: 'https://api.amadeus.com/v2/shopping/flight-offers',
  },
  {
    key: 'ext_kavenegar',
    nameFa: 'سرویس پیامک کاوه‌نگار',
    provider: 'Kavenegar',
    endpoint: 'https://api.kavenegar.com/v1/sms/send.json',
  },
  {
    key: 'ext_neshan',
    nameFa: 'نقشه و مسیریابی نشان',
    provider: 'Neshan Maps',
    endpoint: 'https://api.neshan.org/v4/direction',
  },
];

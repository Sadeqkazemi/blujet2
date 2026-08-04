import type { StoredLocale } from '../../../hooks/useLocale';
import { formatJalaliDate, formatJalaliDateTime } from '../../../lib/jalali';
import type { BookingDetail } from '../../../types/public-site';

export const CITY_NAMES: Record<string, Record<StoredLocale, string>> = {
  THR: { fa: 'تهران — مهرآباد', en: 'Tehran — Mehrabad', ar: 'طهران — مهرآباد' },
  MHD: { fa: 'مشهد', en: 'Mashhad', ar: 'مشهد' },
  IST: { fa: 'استانبول', en: 'Istanbul', ar: 'إسطنبول' },
  DXB: { fa: 'دبی', en: 'Dubai', ar: 'دبي' },
  KIH: { fa: 'کیش', en: 'Kish', ar: 'كيش' },
  SYZ: { fa: 'شیراز', en: 'Shiraz', ar: 'شيراز' },
  NJF: { fa: 'نجف', en: 'Najaf', ar: 'النجف' },
};

export function cityLabel(code: string, locale: StoredLocale): string {
  return CITY_NAMES[code]?.[locale] ?? code;
}

export function passengerInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2);
}

export function flightDurationLabel(departureAt: string, arrivalAt: string, locale: StoredLocale): string {
  const dep = new Date(departureAt).getTime();
  const arr = new Date(arrivalAt).getTime();
  const mins = Math.max(0, Math.round((arr - dep) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (locale === 'en') {
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  }
  if (h && m) return `${h} ساعت و ${m} دقیقه`;
  if (h) return `${h} ساعت`;
  return `${m} دقیقه`;
}

export function formatFlightTime(iso: string, locale: StoredLocale): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const raw = `${hh}:${mm}`;
  if (locale === 'en') return raw;
  return raw.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

export function formatBookingDate(iso: string, locale: StoredLocale): string {
  if (locale === 'en') {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return formatJalaliDate(iso);
}

export function bookingStatusLabel(status: BookingDetail['status'], locale: StoredLocale): string {
  const map: Record<BookingDetail['status'], Record<StoredLocale, string>> = {
    DRAFT: { fa: 'پیش‌نویس', en: 'Draft', ar: 'مسودة' },
    HELD: { fa: 'رزرو موقت', en: 'On hold', ar: 'محجوز مؤقتًا' },
    PAID: { fa: 'پرداخت‌شده', en: 'Paid', ar: 'مدفوع' },
    TICKETED: { fa: 'تأییدشده', en: 'Confirmed', ar: 'مؤكد' },
    CANCELLED: { fa: 'لغوشده', en: 'Cancelled', ar: 'ملغى' },
    EXPIRED: { fa: 'منقضی', en: 'Expired', ar: 'منتهٍ' },
    REFUNDED: { fa: 'مستردشده', en: 'Refunded', ar: 'مسترد' },
  };
  return map[status]?.[locale] ?? status;
}

export { formatJalaliDateTime };

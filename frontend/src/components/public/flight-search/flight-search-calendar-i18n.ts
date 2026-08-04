import type { StoredLocale } from '../../../hooks/useLocale';
import { arDigits, faDigits } from '../../../lib/fa-format';

export type CalendarTrip = 'oneway' | 'round';

const JALALI_MONTHS_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

const JALALI_MONTHS_EN = [
  'Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar',
  'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand',
];

const GREG_MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const GREG_MONTHS_FA = [
  'ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن',
  'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر',
];

const WEEKDAYS: Record<StoredLocale, string[]> = {
  fa: ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'],
  en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
  ar: ['أ', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'],
};

const WEEKDAY_LONG: Record<StoredLocale, string[]> = {
  fa: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ar: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
};

export function localeDigits(value: string | number, locale: StoredLocale): string {
  if (locale === 'en') return String(value);
  return locale === 'ar' ? arDigits(value) : faDigits(value);
}

export function calendarStrings(locale: StoredLocale) {
  const isEn = locale === 'en';
  return {
    today: isEn ? 'Today' : locale === 'ar' ? 'اليوم' : 'تاریخ امروز',
    gregorian: isEn ? 'Gregorian calendar' : locale === 'ar' ? 'التقويم الميلادي' : 'تقویم میلادی',
    jalali: isEn ? 'Jalali calendar' : locale === 'ar' ? 'التقويم الشمسي' : 'تقویم شمسی',
    oneWay: isEn ? 'One-way' : locale === 'ar' ? 'ذهاب فقط' : 'یک‌طرفه',
    confirm: isEn ? 'Confirm' : locale === 'ar' ? 'تأكيد' : 'تأیید',
    depShort: isEn ? 'Departure' : locale === 'ar' ? 'المغادرة' : 'رفت',
    retShort: isEn ? 'Return' : locale === 'ar' ? 'العودة' : 'برگشت',
    select: isEn ? 'Select' : locale === 'ar' ? 'اختر' : 'انتخاب کنید',
    pickDep: isEn ? 'Select your departure date' : locale === 'ar' ? 'اختر تاريخ المغادرة' : 'تاریخ رفت را انتخاب کنید',
    pickRet: isEn ? 'When are you coming back?' : locale === 'ar' ? 'متى ستعود؟' : 'چه زمانی برمی‌گردید؟',
    depBar: isEn ? 'Departure: ' : locale === 'ar' ? 'المغادرة: ' : 'رفت: ',
    retBar: isEn ? 'Return: ' : locale === 'ar' ? 'العودة: ' : 'برگشت: ',
    placeholder: isEn ? 'Select' : locale === 'ar' ? 'اختر' : 'انتخاب کنید',
    needDest: isEn ? 'Select origin and destination first' : locale === 'ar' ? 'اختر المبدأ والمقصد أولاً' : 'ابتدا مبدا و مقصد را انتخاب کنید',
  };
}

export function monthName(monthIndex: number, locale: StoredLocale, gregorian: boolean): string {
  if (gregorian) {
    if (locale === 'en') return GREG_MONTHS_EN[monthIndex] ?? '';
    return GREG_MONTHS_FA[monthIndex] ?? GREG_MONTHS_EN[monthIndex] ?? '';
  }
  if (locale === 'en') return JALALI_MONTHS_EN[monthIndex] ?? '';
  return JALALI_MONTHS_FA[monthIndex] ?? '';
}

export function weekdayHeaders(locale: StoredLocale): string[] {
  return WEEKDAYS[locale];
}

export function weekdayLong(date: Date, locale: StoredLocale): string {
  return WEEKDAY_LONG[locale][date.getDay()] ?? '';
}

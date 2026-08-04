import type { StoredLocale } from '../../../hooks/useLocale';
import type { SavedPassenger } from '../../../types/public-site';
import type { Gender, PassengerFormDraft } from './checkout-types';

/** Autofill payload for one saved-passenger chip on the checkout form. */
export interface CheckoutSavedPaxOption {
  id: string;
  label: string;
  firstNameLatin: string;
  lastNameLatin: string;
  gender: Gender;
  nationalId: string;
  passportNo: string;
  birthDay: string;
  /** 1–12 month index as string (matches PassengerStep selects). */
  birthMonth: string;
  birthYear: string;
}

const FA_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

const EN_MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const AR_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

/** Map a month name (or numeric string) to the form's 1–12 value. */
export function monthNameToValue(month: string): string {
  const trimmed = month.trim();
  if (!trimmed) return '';
  if (/^\d{1,2}$/.test(trimmed)) {
    const n = Number(trimmed);
    if (n >= 1 && n <= 12) return String(n);
  }
  const lists = [FA_MONTHS, EN_MONTHS_FULL, AR_MONTHS] as const;
  for (const list of lists) {
    const idx = (list as readonly string[]).findIndex(
      (m) => m === trimmed || m.toLowerCase() === trimmed.toLowerCase(),
    );
    if (idx >= 0) return String(idx + 1);
  }
  return '';
}

/**
 * Design-reference demo list from `تکمیل خرید.dc.html` — used when the
 * account has no saved passengers yet so the UI stays exercisable.
 */
export function demoCheckoutSavedPassengers(locale: StoredLocale): CheckoutSavedPaxOption[] {
  const isEn = locale === 'en';
  const isAr = locale === 'ar';
  return [
    {
      id: 'demo-negar',
      label: isEn ? 'Negar Rezaei' : isAr ? 'نيغار رضائي' : 'نگار رضایی',
      firstNameLatin: 'Negar',
      lastNameLatin: 'Rezaei',
      gender: 'female',
      nationalId: '0074185969',
      passportNo: '',
      birthDay: '13',
      birthMonth: monthNameToValue(isEn ? 'June' : isAr ? 'يونيو' : 'خرداد'),
      birthYear: isEn || isAr ? '1991' : '1370',
    },
    {
      id: 'demo-sadeq',
      label: isEn ? 'Sadeq Kazemi' : isAr ? 'صادق كاظمي' : 'صادق کاظمی',
      firstNameLatin: 'Sadeq',
      lastNameLatin: 'Kazemi',
      gender: 'male',
      nationalId: '0060326786',
      passportNo: '',
      birthDay: '26',
      birthMonth: monthNameToValue(isEn ? 'August' : isAr ? 'أغسطس' : 'مرداد'),
      birthYear: isEn || isAr ? '1986' : '1365',
    },
    {
      id: 'demo-mohammad',
      label: isEn ? 'Mohammad Rezaei' : isAr ? 'محمد رضائي' : 'محمد رضایی',
      firstNameLatin: 'Mohammad',
      lastNameLatin: 'Rezaei',
      gender: 'male',
      nationalId: '0012345679',
      passportNo: '',
      birthDay: '19',
      birthMonth: monthNameToValue(isEn ? 'January' : isAr ? 'يناير' : 'دی'),
      birthYear: isEn || isAr ? '1964' : '1342',
    },
  ];
}

function splitLatinName(latinName: string): { first: string; last: string } {
  const parts = latinName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0]!, last: '' };
  return { first: parts[0]!, last: parts.slice(1).join(' ') };
}

/** Enrich API rows with design demo DOB/gender when nationalId matches. */
function demoByNationalId(locale: StoredLocale): Map<string, CheckoutSavedPaxOption> {
  const map = new Map<string, CheckoutSavedPaxOption>();
  for (const d of demoCheckoutSavedPassengers(locale)) {
    if (d.nationalId) map.set(d.nationalId, d);
  }
  return map;
}

export function apiToCheckoutSavedOptions(
  rows: SavedPassenger[],
  locale: StoredLocale,
): CheckoutSavedPaxOption[] {
  const demos = demoByNationalId(locale);
  return rows.map((row) => {
    const { first, last } = splitLatinName(row.latinName || '');
    const demo = row.nationalId ? demos.get(row.nationalId) : undefined;
    return {
      id: row.id,
      label: row.fullName,
      firstNameLatin: first || demo?.firstNameLatin || '',
      lastNameLatin: last || demo?.lastNameLatin || '',
      gender: demo?.gender ?? '',
      nationalId: row.nationalId ?? demo?.nationalId ?? '',
      passportNo: row.passportNo ?? '',
      birthDay: demo?.birthDay ?? '',
      birthMonth: demo?.birthMonth ?? '',
      birthYear: demo?.birthYear ?? '',
    };
  });
}

/** Prefer live account list; fall back to design demo chips when empty. */
export function resolveCheckoutSavedPassengers(
  apiRows: SavedPassenger[],
  locale: StoredLocale,
): CheckoutSavedPaxOption[] {
  if (apiRows.length > 0) return apiToCheckoutSavedOptions(apiRows, locale);
  return demoCheckoutSavedPassengers(locale);
}

export function savedOptionToPassengerPatch(
  opt: CheckoutSavedPaxOption,
): Partial<PassengerFormDraft> {
  return {
    firstNameLatin: opt.firstNameLatin.toUpperCase(),
    lastNameLatin: opt.lastNameLatin.toUpperCase(),
    gender: opt.gender,
    nationalId: opt.nationalId,
    passportNo: opt.passportNo,
    docType: opt.passportNo && !opt.nationalId ? 'PASSPORT' : 'NATIONAL_ID',
    birthDay: opt.birthDay,
    birthMonth: opt.birthMonth,
    birthYear: opt.birthYear,
  };
}

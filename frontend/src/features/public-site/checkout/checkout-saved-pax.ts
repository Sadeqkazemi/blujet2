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

function splitLatinName(latinName: string): { first: string; last: string } {
  const parts = latinName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0]!, last: '' };
  return { first: parts[0]!, last: parts.slice(1).join(' ') };
}

export function apiToCheckoutSavedOptions(
  rows: SavedPassenger[],
  _locale: StoredLocale,
): CheckoutSavedPaxOption[] {
  return rows.map((row) => {
    const { first, last } = splitLatinName(row.latinName || '');
    return {
      id: row.id,
      label: row.fullName,
      firstNameLatin: first,
      lastNameLatin: last,
      gender: '',
      nationalId: row.nationalId ?? '',
      passportNo: row.passportNo ?? '',
      birthDay: '',
      birthMonth: '',
      birthYear: '',
    };
  });
}

/** Only live account passengers are eligible for checkout autofill. */
export function resolveCheckoutSavedPassengers(
  apiRows: SavedPassenger[],
  locale: StoredLocale,
): CheckoutSavedPaxOption[] {
  return apiToCheckoutSavedOptions(apiRows, locale);
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

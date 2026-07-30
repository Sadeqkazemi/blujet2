const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Converts Latin digits in a string/number to Persian digits for display. */
export function faDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** Converts Latin digits in a string/number to Eastern Arabic-Indic digits. */
export function arDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

export type DisplayLocale = 'fa' | 'en' | 'ar';

/**
 * Formats a plain toman amount (already converted from rial, e.g. page-local
 * marketing mock figures) with locale-appropriate digits and ٬/, thousands
 * separators. For a raw IRR amount straight from the API, use `faMoney`
 * instead — that's the only place the rial→toman division happens.
 */
export function formatToman(tomanAmount: number, locale: DisplayLocale): string {
  const grouped = Math.round(tomanAmount).toLocaleString('en-US');
  if (locale === 'en') return grouped;
  const withSeparator = grouped.replace(/,/g, '٬');
  return locale === 'ar' ? arDigits(withSeparator) : faDigits(withSeparator);
}

/** Locale-aware percent, e.g. formatLocalePercent(19, 'en') -> "19%", ('fa') -> "۱۹٪". */
export function formatLocalePercent(value: number, locale: DisplayLocale): string {
  if (locale === 'en') return `${value}%`;
  return `${locale === 'ar' ? arDigits(value) : faDigits(value)}٪`;
}

/**
 * Formats an integer IRR amount as تومان (rial ÷ 10) with ٬ thousands
 * separators and Persian digits. This is the ONLY place rial→toman
 * conversion happens — never divide by 10 anywhere else.
 */
export function faMoney(amountRial: number): string {
  const toman = Math.round(amountRial / 10);
  const grouped = toman.toLocaleString('en-US').replace(/,/g, '٬');
  return faDigits(grouped);
}

/**
 * Locale-aware version of `faMoney`: converts a real IRR amount from the API
 * to toman (rial ÷ 10 — still the only place that division happens) and
 * formats it with the active locale's digits/separators via `formatToman`.
 */
export function localeMoney(amountRial: number, locale: DisplayLocale): string {
  return formatToman(Math.round(amountRial / 10), locale);
}

/** Persian-digit percentage, e.g. faPercent(12.5) -> "۱۲.۵٪" */
export function faPercent(value: number): string {
  return `${faDigits(value)}٪`;
}

/** Converts Persian/Arabic digits in user input back to Latin digits. */
export function latinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/**
 * Parses a تومان amount typed by the user (Persian or Latin digits, optional
 * ٬/, separators) into integer IRR. The rial↔toman conversion lives ONLY in
 * this module. Returns null for non-numeric input.
 */
export function parseTomanToRial(input: string): number | null {
  const cleaned = latinDigits(input).replace(/[٬,\s]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  return Number(cleaned) * 10;
}

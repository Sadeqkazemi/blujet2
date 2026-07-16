const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** Converts Latin digits in a string/number to Persian digits for display. */
export function faDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
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

/** Persian-digit percentage, e.g. faPercent(12.5) -> "۱۲.۵٪" */
export function faPercent(value: number): string {
  return `${faDigits(value)}٪`;
}

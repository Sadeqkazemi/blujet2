const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Normalize Iranian mobile numbers for auth forms (+98/98 autofill, Persian digits). */
export function normalizePhone(raw: string): string {
  let digits = raw
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/\D/g, '');

  if (digits.startsWith('98') && digits.length >= 12) {
    digits = `0${digits.slice(2)}`;
  } else if (digits.length === 10 && digits.startsWith('9')) {
    digits = `0${digits}`;
  }

  return digits.slice(0, 11);
}

export function phoneOk(phone: string): boolean {
  return /^09\d{9}$/.test(phone);
}

import {
  faDigits,
  latinDigits,
  parseTomanToRial,
  parseTomanToRialString,
} from "./fa-format";

/** Format raw user input as Persian-digit تومان with ٬ separators (no float math). */
export function formatTomanGrouped(raw: string): string {
  const digits = latinDigits(raw).replace(/[^\d]/g, "");
  if (!digits) return "";
  const withSep = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  return faDigits(withSep);
}

export function tomanDigitsOnly(grouped: string): string {
  return latinDigits(grouped).replace(/[^\d]/g, "");
}

/** Keeps a controlled toman input Persian and grouped while the user types. */
export function normalizeTomanInput(raw: string): string {
  return formatTomanGrouped(tomanDigitsOnly(raw));
}

/** Convert MoneyInput display value to IRR via the shared utility (no float). */
export function moneyInputToRial(valueToman: string): number | null {
  return parseTomanToRial(tomanDigitsOnly(valueToman));
}

/** IRR decimal string for API payloads — BigInt-safe, never a float. */
export function moneyInputToRialString(valueToman: string): string | null {
  return parseTomanToRialString(tomanDigitsOnly(valueToman));
}

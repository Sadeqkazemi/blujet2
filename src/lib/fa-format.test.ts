import { describe, expect, it } from 'vitest';
import { faDigits, faMoney, faPercent } from './fa-format';

describe('faDigits', () => {
  it('converts Latin digits to Persian digits', () => {
    expect(faDigits(1234567890)).toBe('۱۲۳۴۵۶۷۸۹۰');
  });

  it('leaves non-digit characters untouched', () => {
    expect(faDigits('PNR-42')).toBe('PNR-۴۲');
  });
});

describe('faMoney', () => {
  it('converts rial to toman (÷10) with ٬ thousands separators and Persian digits', () => {
    expect(faMoney(127_680_000_000)).toBe('۱۲٬۷۶۸٬۰۰۰٬۰۰۰');
  });

  it('rounds to the nearest toman', () => {
    expect(faMoney(15)).toBe('۲');
  });

  it('handles zero', () => {
    expect(faMoney(0)).toBe('۰');
  });
});

describe('faPercent', () => {
  it('appends the Persian percent sign with Persian digits', () => {
    expect(faPercent(42)).toBe('۴۲٪');
  });
});

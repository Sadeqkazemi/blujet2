import {
  normalizeIranPhone,
  toLatinDigits,
  toLocalIranMobile,
} from './normalize-iran-phone';

describe('normalizeIranPhone', () => {
  it('converts 09… to E.164', () => {
    expect(normalizeIranPhone('09120000001')).toBe('+989120000001');
  });

  it('accepts Persian digits', () => {
    expect(normalizeIranPhone('۰۹۱۲۰۰۰۰۰۰۱')).toBe('+989120000001');
  });

  it('passes through +98… unchanged', () => {
    expect(normalizeIranPhone('+989120000001')).toBe('+989120000001');
  });
});

describe('toLatinDigits', () => {
  it('converts Persian OTP digits', () => {
    expect(toLatinDigits('۴۸۲۹۱۳')).toBe('482913');
  });
});

describe('toLocalIranMobile', () => {
  it('round-trips E.164 to 09…', () => {
    expect(toLocalIranMobile('+989120000001')).toBe('09120000001');
  });
});

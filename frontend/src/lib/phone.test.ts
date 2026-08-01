import { describe, expect, it } from 'vitest';
import { normalizePhone, phoneOk } from './phone';

describe('normalizePhone', () => {
  it('accepts standard 09 numbers', () => {
    expect(normalizePhone('09121234567')).toBe('09121234567');
    expect(phoneOk('09121234567')).toBe(true);
  });

  it('converts +98 autofill to local 09 format', () => {
    expect(normalizePhone('+989121234567')).toBe('09121234567');
    expect(normalizePhone('989121234567')).toBe('09121234567');
  });

  it('adds leading 0 when autofill omits it', () => {
    expect(normalizePhone('9121234567')).toBe('09121234567');
  });

  it('normalizes Persian digits', () => {
    expect(normalizePhone('۰۹۱۲۱۲۳۴۵۶۷')).toBe('09121234567');
  });
});

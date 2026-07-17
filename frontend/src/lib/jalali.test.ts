import { describe, expect, it } from 'vitest';
import { formatJalaliDate, formatJalaliDateTime } from './jalali';

describe('formatJalaliDate', () => {
  it('converts a UTC ISO date to YYYY/MM/DD Jalali', () => {
    // 2026-03-21 is Nowruz — 1405/01/01 in the Jalali calendar.
    expect(formatJalaliDate('2026-03-21T00:00:00.000Z')).toBe('1405/01/01');
  });
});

describe('formatJalaliDateTime', () => {
  it('includes the time portion', () => {
    expect(formatJalaliDateTime('2026-03-21T14:30:00.000Z')).toMatch(/^1405\/01\/01 \d{2}:\d{2}$/);
  });
});

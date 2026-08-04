import { describe, expect, it } from 'vitest';
import { buildResultsUrl, parseResultsSearchParams } from './search-url';

describe('search-url', () => {
  it('builds one-way results URL', () => {
    const url = buildResultsUrl({
      trip: 'oneway',
      legs: [{ origin: 'THR', dest: 'MHD', date: '2026-08-01' }],
      adults: 2,
      cabin: 'ECONOMY',
    });
    expect(url).toBe('/results?trip=oneway&origin=THR&dest=MHD&date=2026-08-01&adults=2&cabin=ECONOMY');
  });

  it('builds round-trip results URL with return date', () => {
    const url = buildResultsUrl({
      trip: 'round',
      legs: [{ origin: 'THR', dest: 'MHD', date: '2026-08-01' }],
      returnDate: '2026-08-05',
    });
    expect(url).toContain('trip=round');
    expect(url).toContain('returnDate=2026-08-05');
  });

  it('builds multi-city results URL', () => {
    const url = buildResultsUrl({
      trip: 'multi',
      legs: [
        { origin: 'THR', dest: 'MHD', date: '2026-08-01' },
        { origin: 'MHD', dest: 'DXB', date: '2026-08-03' },
      ],
    });
    expect(url).toContain('legs=THR%3AMHD%3A2026-08-01%7CMHD%3ADXB%3A2026-08-03');
  });

  it('parses round-trip params', () => {
    const parsed = parseResultsSearchParams(
      new URLSearchParams(
        'trip=round&origin=THR&dest=MHD&date=2026-08-01&returnDate=2026-08-05&adults=1&cabin=BUSINESS',
      ),
    );
    expect(parsed?.trip).toBe('round');
    expect(parsed?.returnDate).toBe('2026-08-05');
    expect(parsed?.cabin).toBe('BUSINESS');
  });
});

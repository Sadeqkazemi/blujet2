import { filterPublicSearchAirports, isTestAirportCity } from './public-airport-filter';

describe('public-airport-filter', () => {
  it('flags e2e fixture city names', () => {
    expect(isTestAirportCity('شهر آزمایش الف')).toBe(true);
    expect(isTestAirportCity('شهر آزمایش ب')).toBe(true);
    expect(isTestAirportCity('شهر تست AB12')).toBe(true);
    expect(isTestAirportCity('تهران')).toBe(false);
    expect(isTestAirportCity('زاهدان')).toBe(false);
  });

  it('filters test airports from public search lists', () => {
    const airports = [
      { code: 'THR', cityFa: 'تهران' },
      { code: 'QEL', cityFa: 'شهر آزمایش الف' },
      { code: 'Z36', cityFa: 'شهر آزمایش ب' },
      { code: 'ZFX', cityFa: 'شهر تست F5WR' },
    ];
    expect(filterPublicSearchAirports(airports).map((a) => a.code)).toEqual(['THR']);
  });
});

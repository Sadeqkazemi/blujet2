import { describe, expect, it } from 'vitest';
import { airportCityLabel, airportCityName } from './airport-cities';

describe('airport-cities', () => {
  it('returns localized city names for known airport codes', () => {
    expect(airportCityName('THR', 'fa')).toBe('تهران');
    expect(airportCityName('THR', 'en')).toBe('Tehran');
    expect(airportCityName('MHD', 'fa')).toBe('مشهد');
  });

  it('falls back to API cityFa then code for unknown airports', () => {
    expect(airportCityName('ABC', 'fa', 'شهر ناشناخته')).toBe('شهر ناشناخته');
    expect(airportCityName('ABC', 'fa')).toBe('ABC');
  });

  it('formats city labels with airport code like the design bundle', () => {
    expect(airportCityLabel('THR', 'fa')).toBe('تهران (THR)');
    expect(airportCityLabel('MHD', 'en')).toBe('Mashhad (MHD)');
  });
});

import { describe, expect, it } from 'vitest';
import { airportsForSearchScope } from './airport-search-scope';
import type { Airport } from '../types/public-site';

const AIRPORTS: Airport[] = [
  { id: 'thr', code: 'THR', cityFa: 'تهران', airportNameFa: 'فرودگاه بین‌المللی مهرآباد', tz: 'Asia/Tehran', isInternational: false },
  { id: 'ika', code: 'IKA', cityFa: 'تهران', airportNameFa: 'فرودگاه بین‌المللی امام خمینی', tz: 'Asia/Tehran', isInternational: false },
  { id: 'dxb', code: 'DXB', cityFa: 'دبی', airportNameFa: 'فرودگاه بین‌المللی دبی', tz: 'Asia/Dubai', isInternational: true },
];

describe('airportsForSearchScope', () => {
  it('keeps all Iranian airports and excludes foreign airports for domestic search', () => {
    expect(airportsForSearchScope(AIRPORTS, 'domestic').map((row) => row.code)).toEqual(['THR', 'IKA']);
  });

  it('keeps Iranian international and foreign airports but excludes domestic-only Iranian airports', () => {
    expect(airportsForSearchScope(AIRPORTS, 'intl').map((row) => row.code)).toEqual(['IKA', 'DXB']);
  });
});

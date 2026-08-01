import { describe, expect, it } from 'vitest';
import {
  isMd80Aircraft,
  md80ColsForRow,
  md80LeftAmenity,
  MD80_EXCLUDED,
} from './md80-seat-layout';

describe('md80-seat-layout', () => {
  it('detects MD-80 / MD-88 type strings', () => {
    expect(isMd80Aircraft('MD-80')).toBe(true);
    expect(isMd80Aircraft('MD-88')).toBe(true);
    expect(isMd80Aircraft('Airbus A320')).toBe(false);
  });

  it('uses 2-2 A/B|E/F in first class and 2-3 A/B|D/E/F in economy', () => {
    expect(md80ColsForRow(3)).toEqual({
      left: ['A', 'B'],
      right: ['E', 'F'],
      cabin: 'BUSINESS',
    });
    expect(md80ColsForRow(12)).toEqual({
      left: ['A', 'B'],
      right: ['D', 'E', 'F'],
      cabin: 'ECONOMY',
    });
  });

  it('marks rear exit/galley omissions', () => {
    expect(md80LeftAmenity(28)).toBe('exit');
    expect(md80LeftAmenity(29)).toBe('galley');
    expect(md80LeftAmenity(30)).toBe('empty');
    expect(MD80_EXCLUDED.has('28A')).toBe(true);
    expect(MD80_EXCLUDED.has('30B')).toBe(true);
    expect(MD80_EXCLUDED.has('31A')).toBe(false);
  });
});

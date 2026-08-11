import { describe, expect, it } from 'vitest';
import {
  passengerTotalIrr,
  seatCountForMix,
  validatePassengerAges,
} from './checkout-types';

describe('passenger pricing helpers', () => {
  it('calculates system adult, child and infant totals', () => {
    expect(
      passengerTotalIrr('1000000', { adults: 1, children: 1, infants: 1 }),
    ).toBe(1_600_000n);
  });

  it('uses age on the flight date for child and infant validation', () => {
    expect(
      validatePassengerAges(
        [{ passengerType: 'CHILD', birthDate: '2014-08-11' }],
        '2026-08-10T10:00:00.000Z',
      ),
    ).toBeNull();
    expect(
      validatePassengerAges(
        [{ passengerType: 'CHILD', birthDate: '2014-08-10' }],
        '2026-08-10T10:00:00.000Z',
      ),
    ).toBe('CHILD_AGE_INVALID');
  });

  it('requires the adult passenger to be fully 12 on the departure date', () => {
    expect(
      validatePassengerAges(
        [{ passengerType: 'ADULT', birthDate: '2014-08-11' }],
        '2026-08-10T10:00:00.000Z',
      ),
    ).toBe('ADULT_TOO_YOUNG');
    expect(
      validatePassengerAges(
        [{ passengerType: 'ADULT', birthDate: '2014-08-10' }],
        '2026-08-10T10:00:00.000Z',
      ),
    ).toBeNull();
  });

  it('allows an under-two passenger on a child fare with a dedicated seat', () => {
    expect(
      validatePassengerAges(
        [{ passengerType: 'CHILD', birthDate: '2025-08-10' }],
        '2026-08-10T10:00:00.000Z',
      ),
    ).toBeNull();
  });

  it('allows only one lap infant per adult', () => {
    expect(
      validatePassengerAges(
        [
          { passengerType: 'ADULT', birthDate: '1990-01-01' },
          { passengerType: 'INFANT', birthDate: '2025-01-01' },
          { passengerType: 'INFANT', birthDate: '2025-02-01' },
        ],
        '2026-08-10T10:00:00.000Z',
      ),
    ).toBe('TOO_MANY_LAP_INFANTS');
  });

  it('uses full fare for a charter child', () => {
    expect(
      passengerTotalIrr(
        '1000000',
        { adults: 1, children: 1, infants: 0 },
        true,
      ),
    ).toBe(2_000_000n);
  });

  it('does not allocate a seat to a lap infant', () => {
    expect(seatCountForMix({ adults: 2, children: 1, infants: 2 })).toBe(3);
  });
});

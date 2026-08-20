import {
  assertInRequestNationalIdSeatLimit,
  countOccupyingNationalIdHashes,
  MAX_SEATS_PER_NATIONAL_ID,
} from './national-id-seat-limit';
import { hashPii, normalizeNationalId } from '../../common/pii-crypto';

/** Known-valid Iranian national ID used across booking/saved-pax tests. */
const VALID_NID = '0012345679';
const VALID_NID_B = '0499370899';

describe('national-id-seat-limit', () => {
  const originalKey = process.env.PII_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.PII_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.PII_ENCRYPTION_KEY;
    else process.env.PII_ENCRYPTION_KEY = originalKey;
  });

  it(`allows up to ${MAX_SEATS_PER_NATIONAL_ID} seats for the same national ID`, () => {
    expect(() =>
      assertInRequestNationalIdSeatLimit([
        { nationalId: VALID_NID, passengerType: 'ADULT' },
        { nationalId: VALID_NID, passengerType: 'ADULT' },
      ]),
    ).not.toThrow();
  });

  it(`rejects more than ${MAX_SEATS_PER_NATIONAL_ID} seats for the same national ID`, () => {
    expect(() =>
      assertInRequestNationalIdSeatLimit([
        { nationalId: VALID_NID, passengerType: 'ADULT' },
        { nationalId: VALID_NID, passengerType: 'CHILD' },
        { nationalId: VALID_NID, passengerType: 'ADULT' },
      ]),
    ).toThrow(/حداکثر/);
  });

  it('ignores infants (no seat) when counting', () => {
    expect(() =>
      assertInRequestNationalIdSeatLimit([
        { nationalId: VALID_NID, passengerType: 'ADULT' },
        { nationalId: VALID_NID, passengerType: 'ADULT' },
        { nationalId: VALID_NID, passengerType: 'INFANT' },
      ]),
    ).not.toThrow();
  });

  it('counts distinct national IDs independently', () => {
    const counts = countOccupyingNationalIdHashes([
      { nationalId: VALID_NID, passengerType: 'ADULT' },
      { nationalId: VALID_NID, passengerType: 'ADULT' },
      { nationalId: VALID_NID_B, passengerType: 'ADULT' },
    ]);
    expect(counts.get(hashPii(normalizeNationalId(VALID_NID)))).toBe(2);
    expect(counts.get(hashPii(normalizeNationalId(VALID_NID_B)))).toBe(1);
  });
});

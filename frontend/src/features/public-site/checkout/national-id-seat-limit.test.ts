import { describe, expect, it } from 'vitest';
import { nationalIdsExceedingSeatLimit } from './national-id-seat-limit';
import { emptyPassenger } from './checkout-types';

describe('nationalIdsExceedingSeatLimit', () => {
  const passenger = (extraSeatRequested = false) => ({
    nationalId: '0012345679',
    docType: 'NATIONAL_ID' as const,
    passengerType: 'ADULT' as const,
    extraSeatRequested,
  });

  it('counts an additional seat as a second occupied seat', () => {
    expect(nationalIdsExceedingSeatLimit([passenger(true)])).toEqual([]);
    expect(nationalIdsExceedingSeatLimit([passenger(true), passenger(false)])).toEqual([
      '0012345679',
    ]);
  });
  it('allows two seats with the same national ID', () => {
    const a = {
      ...emptyPassenger(''),
      nationalId: '0012345679',
      docType: 'NATIONAL_ID' as const,
    };
    const b = {
      ...emptyPassenger(''),
      nationalId: '0012345679',
      docType: 'NATIONAL_ID' as const,
    };
    expect(nationalIdsExceedingSeatLimit([a, b])).toEqual([]);
  });

  it('rejects a third seat with the same national ID', () => {
    const rows = [1, 2, 3].map(() => ({
      ...emptyPassenger(''),
      nationalId: '0012345679',
      docType: 'NATIONAL_ID' as const,
    }));
    expect(nationalIdsExceedingSeatLimit(rows)).toEqual(['0012345679']);
  });

  it('ignores infants and passport-only rows', () => {
    const adult = {
      ...emptyPassenger(''),
      nationalId: '0012345679',
      docType: 'NATIONAL_ID' as const,
    };
    const infant = {
      ...emptyPassenger(''),
      nationalId: '0012345679',
      docType: 'NATIONAL_ID' as const,
      passengerType: 'INFANT' as const,
    };
    const passport = {
      ...emptyPassenger(''),
      nationalId: '',
      passportNo: 'A1234567',
      docType: 'PASSPORT' as const,
    };
    expect(nationalIdsExceedingSeatLimit([adult, adult, infant, passport])).toEqual([]);
  });
});

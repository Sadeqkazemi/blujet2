import { FlightDefinitionStatus, FlightInstanceStatus } from '../../database/enums';
import { isAgencySeatRequestOccurrence } from './agency-portal.service';

describe('agency seat request occurrence source', () => {
  const now = new Date('2026-08-25T10:00:00.000Z');
  const base = {
    status: FlightInstanceStatus.SCHEDULED,
    definitionStatus: FlightDefinitionStatus.PUBLISHED,
    approvedSnapshot: { flightNo: 'XY1235' },
    departureAt: new Date('2026-09-03T05:00:00.000Z'),
    saleStartsAt: null,
    saleEndsAt: null,
  };

  it('includes only CEO-approved active occurrences', () => {
    expect(isAgencySeatRequestOccurrence(base as never, now)).toBe(true);
    expect(
      isAgencySeatRequestOccurrence(
        { ...base, definitionStatus: FlightDefinitionStatus.PENDING_CEO } as never,
        now,
      ),
    ).toBe(false);
    expect(
      isAgencySeatRequestOccurrence(
        { ...base, definitionStatus: FlightDefinitionStatus.REJECTED } as never,
        now,
      ),
    ).toBe(false);
  });

  it('keeps an already approved occurrence live during a pending revision', () => {
    expect(
      isAgencySeatRequestOccurrence(
        { ...base, definitionStatus: FlightDefinitionStatus.PENDING_REVISION } as never,
        now,
      ),
    ).toBe(true);
    expect(
      isAgencySeatRequestOccurrence(
        {
          ...base,
          definitionStatus: FlightDefinitionStatus.PENDING_REVISION,
          approvedSnapshot: null,
        } as never,
        now,
      ),
    ).toBe(false);
  });

  it('excludes expired sale windows and past occurrences', () => {
    expect(
      isAgencySeatRequestOccurrence(
        { ...base, saleEndsAt: new Date('2026-08-24T00:00:00.000Z') } as never,
        now,
      ),
    ).toBe(false);
    expect(
      isAgencySeatRequestOccurrence(
        { ...base, departureAt: new Date('2026-08-24T00:00:00.000Z') } as never,
        now,
      ),
    ).toBe(false);
  });
});

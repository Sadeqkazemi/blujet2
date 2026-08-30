import {
  FlightDefinitionStatus,
  FlightInstanceStatus,
} from '../../database/enums';
import {
  agencySeatRequestClassOffer,
  AgencyPortalService,
  isAgencySeatRequestOccurrence,
} from './agency-portal.service';

describe('agency seat request occurrence source', () => {
  const now = new Date('2026-08-25T10:00:00.000Z');
  const base = {
    status: FlightInstanceStatus.SCHEDULED,
    definitionStatus: FlightDefinitionStatus.PUBLISHED,
    approvedSnapshot: { flightNo: 'XY1235' },
    agencySaleEnabled: true,
    departureAt: new Date('2026-09-03T05:00:00.000Z'),
    saleStartsAt: null,
    saleEndsAt: null,
  };

  it('includes only CEO-approved active occurrences', () => {
    expect(isAgencySeatRequestOccurrence(base as never, now)).toBe(true);
    expect(
      isAgencySeatRequestOccurrence(
        {
          ...base,
          definitionStatus: FlightDefinitionStatus.PENDING_CEO,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isAgencySeatRequestOccurrence(
        { ...base, definitionStatus: FlightDefinitionStatus.REJECTED },
        now,
      ),
    ).toBe(false);
  });

  it('keeps an already approved occurrence live during a pending revision', () => {
    expect(
      isAgencySeatRequestOccurrence(
        {
          ...base,
          definitionStatus: FlightDefinitionStatus.PENDING_REVISION,
        },
        now,
      ),
    ).toBe(true);
    expect(
      isAgencySeatRequestOccurrence(
        {
          ...base,
          definitionStatus: FlightDefinitionStatus.PENDING_REVISION,
          approvedSnapshot: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it('excludes expired sale windows and past occurrences', () => {
    expect(
      isAgencySeatRequestOccurrence(
        { ...base, saleEndsAt: new Date('2026-08-24T00:00:00.000Z') },
        now,
      ),
    ).toBe(false);
    expect(
      isAgencySeatRequestOccurrence(
        { ...base, departureAt: new Date('2026-08-24T00:00:00.000Z') },
        now,
      ),
    ).toBe(false);
  });

  it('excludes a flight explicitly hidden from the agency catalogue', () => {
    expect(
      isAgencySeatRequestOccurrence({ ...base, agencySaleEnabled: false }, now),
    ).toBe(false);
  });
});

describe('agency seat request class offer', () => {
  const baseRule = {
    seatsAllocated: 120,
    agencySeatsReleased: 0,
    agencyReleasePriceIrr: null,
    sitePriceIrr: 32_000_000n,
    priceIrr: 30_000_000n,
  };

  it('keeps an active class closed until a dedicated agency release exists', () => {
    expect(agencySeatRequestClassOffer(baseRule, 20)).toEqual({
      hasDedicatedAgencyRelease: false,
      availableToRequest: 0,
      pricePerSeatIrr: 32_000_000n,
    });
  });

  it('uses the dedicated agency pool as the hard ceiling after release', () => {
    expect(
      agencySeatRequestClassOffer(
        {
          ...baseRule,
          agencySeatsReleased: 25,
          agencyReleasePriceIrr: 28_000_000n,
        },
        7,
      ),
    ).toEqual({
      hasDedicatedAgencyRelease: true,
      availableToRequest: 18,
      pricePerSeatIrr: 28_000_000n,
    });
  });
});

describe('agency seat request option source', () => {
  it('does not truncate scheduled flights before sellability and fare-class filtering', async () => {
    const find = jest
      .fn<(options: Record<string, unknown>) => Promise<unknown[]>>()
      .mockResolvedValue([]);
    const service = Object.create(
      AgencyPortalService.prototype,
    ) as AgencyPortalService;
    Object.assign(service, {
      isUatSandboxAgencyActor: jest.fn().mockResolvedValue(true),
      flightInstanceRepo: { find },
    });

    await service.seatRequestOptions(
      {} as Parameters<AgencyPortalService['seatRequestOptions']>[0],
    );

    const calls = find.mock.calls as Array<[Record<string, unknown>]>;
    expect(calls[0]?.[0]).not.toHaveProperty('take');
  });
});

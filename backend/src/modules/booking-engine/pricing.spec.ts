import { getCabinPrice, resolveFareClass } from './pricing';
import type { TypeORMService } from '../../typeorm/typeorm.service';

function mockTypeORM(overrides: Partial<TypeORMService>): TypeORMService {
  return overrides as unknown as TypeORMService;
}

describe('booking-engine pricing (unit)', () => {
  it('resolveFareClass returns the cheapest class with remaining allocation', async () => {
    const typeorm = mockTypeORM({
      fareRule: {
        findMany: jest.fn().mockResolvedValue([
          {
            classCode: 'Y',
            priceIrr: 30_000_000,
            taxIrr: 0,
            seatsAllocated: 1,
            validFrom: null,
            validUntil: null,
            allowedChannels: [],
          },
          {
            classCode: 'B',
            priceIrr: 40_000_000,
            taxIrr: 0,
            seatsAllocated: 2,
            validFrom: null,
            validUntil: null,
            allowedChannels: [],
          },
        ]),
      },
      booking: {
        groupBy: jest.fn().mockResolvedValue([{ fareClassCode: 'Y', _count: { _all: 1 } }]),
      },
    });

    const result = await resolveFareClass(typeorm, 'fi-1', 'ECONOMY');
    expect(result).toEqual({
      classCode: 'B',
      priceIrr: 40_000_000,
      taxIrr: 0,
    });
  });

  it('getCabinPrice prefers fare-class pricing over cabinFare rows', async () => {
    const typeorm = mockTypeORM({
      fareRule: { findMany: jest.fn().mockResolvedValue([]) },
      booking: { groupBy: jest.fn().mockResolvedValue([]) },
      cabinFare: {
        findUnique: jest.fn().mockResolvedValue({ priceIrr: 99_000_000 }),
      },
      flightInstance: {
        findUnique: jest.fn(),
      },
    });

    await expect(getCabinPrice(typeorm, 'fi-1', 'ECONOMY')).resolves.toBe(99_000_000);
    expect(typeorm.cabinFare.findUnique).toHaveBeenCalled();
  });

  it('getCabinPrice applies the business multiplier when no per-cabin fare row exists', async () => {
    const typeorm = mockTypeORM({
      fareRule: { findMany: jest.fn().mockResolvedValue([]) },
      booking: { groupBy: jest.fn().mockResolvedValue([]) },
      cabinFare: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      flightInstance: {
        findUnique: jest.fn().mockResolvedValue({
          basePriceIrr: 38_000_000,
          pricing: null,
        }),
      },
    });

    await expect(getCabinPrice(typeorm, 'fi-1', 'BUSINESS')).resolves.toBe(68_400_000);
  });
});

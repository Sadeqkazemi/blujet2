import type { EntityManager } from 'typeorm';
import type { FareRule } from '../../database/entities/fare-rule.entity';
import { resolveFareClass } from './pricing';

function managerFor(rules: Partial<FareRule>[]): EntityManager {
  const usageQuery = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  return {
    find: jest.fn().mockResolvedValue(rules),
    createQueryBuilder: jest.fn().mockReturnValue(usageQuery),
  } as unknown as EntityManager;
}

describe('fare-class channel pricing', () => {
  const common = {
    flightInstanceId: 'flight-1',
    cabin: 'ECONOMY' as const,
    seatsAllocated: 20,
    taxIrr: 0n,
    validFrom: null,
    validUntil: null,
    allowedChannels: [],
  };

  it('sorts and prices public-site sales with the independent site price', async () => {
    const manager = managerFor([
      {
        ...common,
        classCode: 'Y',
        priceIrr: 5_000_000n,
        sitePriceIrr: 7_000_000n,
      },
      {
        ...common,
        classCode: 'B',
        priceIrr: 6_000_000n,
        sitePriceIrr: 4_000_000n,
      },
    ]);

    await expect(
      resolveFareClass(manager, 'flight-1', 'ECONOMY', 'SYSTEM'),
    ).resolves.toEqual({
      classCode: 'B',
      priceIrr: 4_000_000n,
      taxIrr: 0n,
    });
  });

  it('keeps agency pricing on the base fare-class price', async () => {
    const manager = managerFor([
      {
        ...common,
        classCode: 'Y',
        priceIrr: 5_000_000n,
        sitePriceIrr: 7_000_000n,
      },
      {
        ...common,
        classCode: 'B',
        priceIrr: 6_000_000n,
        sitePriceIrr: 4_000_000n,
      },
    ]);

    await expect(
      resolveFareClass(manager, 'flight-1', 'ECONOMY', 'AGENCY'),
    ).resolves.toEqual({
      classCode: 'Y',
      priceIrr: 5_000_000n,
      taxIrr: 0n,
    });
  });
});

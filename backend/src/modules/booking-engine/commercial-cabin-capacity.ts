import type { EntityManager } from 'typeorm';
import { FareRule } from '../../database/entities/fare-rule.entity';
import type { CabinClass } from '../../database/enums';

/**
 * A configured aircraft cabin remains the physical ceiling. Once Commercial
 * Management defines fare classes, however, the sum of those approved fare
 * allocations becomes the smaller sellable ceiling shown to customers and
 * enforced during checkout.
 */
export function commercialCabinCapacity(
  physicalCapacity: number,
  fareAllocations: readonly number[],
): number {
  const safePhysical = Math.max(0, Math.trunc(physicalCapacity));
  if (fareAllocations.length === 0) return safePhysical;
  const approved = fareAllocations.reduce(
    (sum, seats) => sum + Math.max(0, Math.trunc(seats)),
    0,
  );
  return Math.min(safePhysical, approved);
}

export async function resolveCommercialCabinCapacity(
  manager: EntityManager,
  flightInstanceId: string,
  cabin: CabinClass,
  physicalCapacity: number,
): Promise<number> {
  const rules = await manager.find(FareRule, {
    where: { flightInstanceId, cabin },
  });
  return commercialCabinCapacity(
    physicalCapacity,
    rules.map((rule) => rule.seatsAllocated),
  );
}

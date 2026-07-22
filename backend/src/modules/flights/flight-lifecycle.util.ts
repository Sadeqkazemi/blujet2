import type { TypeORMService } from '../../typeorm/typeorm.service';

/** Lazily flips SCHEDULED instances past their departureAt to DEPARTED —
 * no cron job. Nothing previously wrote this transition (only
 * typeorm/seed.ts backdated demo rows by hand); every real reader of
 * "DEPARTED" now calls this first. See docs/DB_SCHEMA.md Phase 13 Part E. */
export async function materializeDepartedInstances(
  typeorm: TypeORMService,
): Promise<void> {
  await typeorm.flightInstance.updateMany({
    where: { status: 'SCHEDULED', departureAt: { lte: new Date() } },
    data: { status: 'DEPARTED' },
  });
}

/** Lazily flips TICKETED bookings to FLOWN once their flight instance has
 * departed — the default assumption absent any boarding/check-in signal
 * (none exists anywhere in this codebase or design). NO_SHOW is always a
 * manual staff override on top of this, never inferred here. */
export async function materializeFlownBookings(
  typeorm: TypeORMService,
): Promise<void> {
  await materializeDepartedInstances(typeorm);
  const eligible = await typeorm.booking.findMany({
    where: { status: 'TICKETED', flightInstance: { status: 'DEPARTED' } },
    select: { id: true },
  });
  if (eligible.length === 0) return;
  await typeorm.booking.updateMany({
    where: { id: { in: eligible.map((b) => b.id) }, status: 'TICKETED' },
    data: { status: 'FLOWN' },
  });
}

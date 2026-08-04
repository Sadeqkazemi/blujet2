/**
 * Booking statuses that physically occupy a seat for search, checkout,
 * and the staff reservation seat map. Must stay identical everywhere —
 * CLAUDE.md: sold/held seats agree across surfaces; REFUNDED / CANCELLED /
 * EXPIRED (and past-TTL HELD) free the seat for resale.
 */
export const OCCUPYING_BOOKING_STATUSES = [
  'DRAFT',
  'HELD',
  'PAID',
  'TICKETED',
] as const;

export type OccupyingBookingStatus =
  (typeof OCCUPYING_BOOKING_STATUSES)[number];

/**
 * TypeORM QueryBuilder fragment: passenger rows whose booking currently
 * occupies the seat. Alias `b` must already be the Booking join.
 */
export function applyOccupyingBookingFilter(
  qb: {
    andWhere: (condition: string, parameters?: object) => unknown;
  },
  now: Date = new Date(),
): void {
  qb.andWhere('b.status IN (:...occupyingStatuses)', {
    occupyingStatuses: [...OCCUPYING_BOOKING_STATUSES],
  });
  qb.andWhere('(b.status != :heldStatus OR b."holdExpiresAt" > :occupyNow)', {
    heldStatus: 'HELD',
    occupyNow: now,
  });
}

import type { DataSource } from 'typeorm';
import { In, LessThanOrEqual } from 'typeorm';
import { FlightInstance } from '../../database/entities/flight-instance.entity';
import { Booking } from '../../database/entities/booking.entity';
import { FlightCoupon } from '../../database/entities/flight-coupon.entity';
import { TicketDocument } from '../../database/entities/ticket-document.entity';
import {
  FlightInstanceStatus,
  BookingStatus,
  FlightCouponStatus,
} from '../../database/enums';

/** Lazily flips SCHEDULED instances past their departureAt to DEPARTED —
 * no cron job. Nothing previously wrote this transition (only
 * src/database/seed.ts backdated demo rows by hand); every real reader of
 * "DEPARTED" now calls this first. See docs/DB_SCHEMA.md Phase 13 Part E. */
export async function materializeDepartedInstances(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.getRepository(FlightInstance).update(
    {
      status: FlightInstanceStatus.SCHEDULED,
      departureAt: LessThanOrEqual(new Date()),
    },
    { status: FlightInstanceStatus.DEPARTED },
  );
}

/** Lazily flips TICKETED bookings to FLOWN once their flight instance has
 * departed — the default assumption absent any boarding/check-in signal
 * (none exists anywhere in this codebase or design). NO_SHOW is always a
 * manual staff override on top of this, never inferred here. */
export async function materializeFlownBookings(
  dataSource: DataSource,
): Promise<void> {
  await materializeDepartedInstances(dataSource);
  const bookingRepo = dataSource.getRepository(Booking);
  const eligible = await bookingRepo
    .createQueryBuilder('b')
    .innerJoin('b.flightInstance', 'fi')
    .where('b.status = :status', { status: BookingStatus.TICKETED })
    .andWhere('fi.status = :fiStatus', {
      fiStatus: FlightInstanceStatus.DEPARTED,
    })
    .select('b.id', 'id')
    .getRawMany<{ id: string }>();
  if (eligible.length === 0) return;
  await bookingRepo
    .createQueryBuilder()
    .update(Booking)
    .set({ status: BookingStatus.FLOWN })
    .where('id IN (:...ids)', { ids: eligible.map((b) => b.id) })
    .andWhere('status = :status', { status: BookingStatus.TICKETED })
    .execute();
  const documents = await dataSource.getRepository(TicketDocument).find({
    where: { bookingId: In(eligible.map((booking) => booking.id)) },
    select: { id: true },
  });
  if (documents.length === 0) return;
  await dataSource
    .getRepository(FlightCoupon)
    .createQueryBuilder()
    .update(FlightCoupon)
    .set({ status: FlightCouponStatus.FLOWN })
    .where('"ticketDocumentId" IN (:...documentIds)', {
      documentIds: documents.map((document) => document.id),
    })
    .andWhere('status IN (:...statuses)', {
      statuses: [
        FlightCouponStatus.OPEN,
        FlightCouponStatus.CHECKED_IN,
        FlightCouponStatus.BOARDED,
      ],
    })
    .execute();
}

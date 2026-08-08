import type { EntityManager } from 'typeorm';
import { AgencySeatCommitment } from '../../database/entities/agency-seat-commitment.entity';
import { CharterCommitment } from '../../database/entities/charter-commitment.entity';
import { CommitmentStatus } from '../../database/enums';
import type { CabinClass } from '../../database/enums';

/** Sum of ACTIVE charter + agency seat commitments for one cabin on one
 * flight instance — the amount online search/booking must subtract from
 * physical seatsLeft so online sale never dips into committed capacity
 * (CLAUDE.md goal #12: "کاهش موجودی رزرو آنلاین همان کلاس"). A pure
 * function over an EntityManager (not an injectable service) so it has no
 * module/DI dependency and can be called from CommitmentsService (flights
 * module) as well as SearchService/BookingService (booking-engine module)
 * without a cross-module provider import. */
export async function sumActiveCommittedSeats(
  manager: EntityManager,
  flightInstanceId: string,
  cabin: CabinClass,
): Promise<number> {
  const [charterSum, agencySum] = await Promise.all([
    manager
      .createQueryBuilder(CharterCommitment, 'c')
      .select('COALESCE(SUM(c.seats), 0)', 'sum')
      .where('c."flightInstanceId" = :id', { id: flightInstanceId })
      .andWhere('c.cabin = :cabin', { cabin })
      .andWhere('c.status = :status', { status: CommitmentStatus.ACTIVE })
      .getRawOne<{ sum: string }>(),
    manager
      .createQueryBuilder(AgencySeatCommitment, 'a')
      .select('COALESCE(SUM(a.seats), 0)', 'sum')
      .where('a."flightInstanceId" = :id', { id: flightInstanceId })
      .andWhere('a.cabin = :cabin', { cabin })
      .andWhere('a.status = :status', { status: CommitmentStatus.ACTIVE })
      .getRawOne<{ sum: string }>(),
  ]);
  return Number(charterSum?.sum ?? 0) + Number(agencySum?.sum ?? 0);
}

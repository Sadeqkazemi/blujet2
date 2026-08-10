import type { EntityManager } from 'typeorm';
import { CabinFare } from '../../database/entities/cabin-fare.entity';
import { FareRule } from '../../database/entities/fare-rule.entity';
import { FlightInstance } from '../../database/entities/flight-instance.entity';
import { FarePricingProposal } from '../../database/entities/fare-pricing-proposal.entity';
import { Booking } from '../../database/entities/booking.entity';
import type { BookingChannel, CabinClass } from '../../database/enums';
import { type Irr, pctOfIrr, roundIrrTo } from '../../common/money';

/** Same documented flat fallback as reservation/pnr.service.ts — no
 * canonical public-site fare exists for a flight with neither a Phase 6
 * registered price nor a Phase 11 CabinFare row. */
const FALLBACK_ECONOMY_PRICE_IRR: Irr = 38_000_000n;
/** Business multiplier over the resolved economy price, as an integer
 * percent (180 = ×1.8) — a documented placeholder until commercial pricing
 * owns per-cabin fares directly. */
const BUSINESS_MULTIPLIER_PCT = 180;

/**
 * Pricing is separate from availability (CLAUDE.md) — the single source of
 * truth for what a cabin costs right now, used identically at search time
 * and at pre-payment re-price time so the two can never disagree.
 */
export async function getCabinPrice(
  manager: EntityManager,
  flightInstanceId: string,
  cabin: CabinClass,
  channel: BookingChannel = 'SYSTEM',
): Promise<Irr> {
  const byClass = await resolveFareClass(
    manager,
    flightInstanceId,
    cabin,
    channel,
  );
  if (byClass) return byClass.priceIrr;

  const fare = await manager.findOneBy(CabinFare, { flightInstanceId, cabin });
  if (fare) return fare.priceIrr;

  const [instance, pricing] = await Promise.all([
    manager
      .createQueryBuilder(FlightInstance, 'fi')
      .where('fi.id = :flightInstanceId', { flightInstanceId })
      .getOne(),
    manager
      .createQueryBuilder(FarePricingProposal, 'p')
      .where('p.flightInstanceId = :flightInstanceId', { flightInstanceId })
      .getOne(),
  ]);
  const economyPrice: Irr =
    pricing?.status === 'REGISTERED'
      ? (pricing.registeredPriceIrr as Irr)
      : ((instance?.basePriceIrr as Irr | null) ?? FALLBACK_ECONOMY_PRICE_IRR);

  if (cabin === 'BUSINESS') {
    return roundIrrTo(
      pctOfIrr(economyPrice, BUSINESS_MULTIPLIER_PCT),
      100_000n,
    );
  }
  // ECONOMY and COMFORT share the economy base when no CabinFare / fare-class row exists.
  return economyPrice;
}

/**
 * IATA-style fare-class buckets (Y/B/M …): when FareRule rows exist for an
 * instance+cabin, the bookable price is the CHEAPEST class that still has
 * allocation left. A class's consumption = active bookings stamped with its
 * classCode (EXPIRED/CANCELLED bookings release the bucket automatically).
 * Returns null when the instance has no fare-class rows (or none are
 * currently valid/channel-eligible — see below) — flat CabinFare / Phase 6
 * pricing applies then.
 *
 * Phase 13 Part B: a rule outside its validFrom/validUntil window "now", or
 * whose allowedChannels doesn't include the requesting channel (empty list
 * = all channels), is treated as if it didn't exist for this call — not
 * merely unavailable to buy, invisible to pricing entirely.
 */
export async function resolveFareClass(
  manager: EntityManager,
  flightInstanceId: string,
  cabin: CabinClass,
  channel: BookingChannel = 'SYSTEM',
): Promise<{ classCode: string; priceIrr: Irr; taxIrr: Irr } | null> {
  const now = new Date();
  const allRules = await manager.find(FareRule, {
    where: { flightInstanceId, cabin },
    order: { priceIrr: 'ASC' },
  });
  const rules = allRules.filter(
    (r) =>
      (!r.validFrom || r.validFrom <= now) &&
      (!r.validUntil || r.validUntil >= now) &&
      ((r.allowedChannels ?? []).length === 0 ||
        (r.allowedChannels ?? []).includes(channel)),
  );
  if (rules.length === 0) return null;

  const usageRows = await manager
    .createQueryBuilder(Booking, 'b')
    .select('b.fareClassCode', 'fareClassCode')
    .addSelect('COUNT(p.id)', 'count')
    .innerJoin(
      'passengers',
      'p',
      'p."bookingId" = b.id AND p."seatCode" IS NOT NULL',
    )
    .where('b.flightInstanceId = :flightInstanceId', { flightInstanceId })
    .andWhere('b.cabin = :cabin', { cabin })
    .andWhere('b.fareClassCode IS NOT NULL')
    .andWhere('b.status IN (:...statuses)', {
      statuses: ['DRAFT', 'HELD', 'PAID', 'TICKETED'],
    })
    .groupBy('b.fareClassCode')
    .getRawMany<{ fareClassCode: string; count: string }>();
  const used = new Map(
    usageRows.map((u) => [u.fareClassCode, Number(u.count)]),
  );

  for (const rule of rules) {
    if ((used.get(rule.classCode) ?? 0) < rule.seatsAllocated) {
      return {
        classCode: rule.classCode,
        priceIrr: rule.priceIrr,
        taxIrr: rule.taxIrr,
      };
    }
  }
  // every bucket exhausted → most expensive (still-valid/eligible) class
  // keeps selling while physical seats remain (availability itself is the
  // seat map's job).
  const last = rules[rules.length - 1];
  return {
    classCode: last.classCode,
    priceIrr: last.priceIrr,
    taxIrr: last.taxIrr,
  };
}

import { PrismaService } from '../../prisma/prisma.service';
import type {
  BookingChannel,
  CabinClass,
} from '../../../generated/prisma/enums';

/** Same documented flat fallback as reservation/pnr.service.ts — no
 * canonical public-site fare exists for a flight with neither a Phase 6
 * registered price nor a Phase 11 CabinFare row. */
const FALLBACK_ECONOMY_PRICE_IRR = 38_000_000;
/** Business multiplier over the resolved economy price — a documented
 * placeholder until commercial pricing owns per-cabin fares directly. */
const BUSINESS_MULTIPLIER = 1.8;

/**
 * Pricing is separate from availability (CLAUDE.md) — the single source of
 * truth for what a cabin costs right now, used identically at search time
 * and at pre-payment re-price time so the two can never disagree.
 */
export async function getCabinPrice(
  prisma: PrismaService,
  flightInstanceId: string,
  cabin: CabinClass,
  channel: BookingChannel = 'SYSTEM',
): Promise<number> {
  const byClass = await resolveFareClass(
    prisma,
    flightInstanceId,
    cabin,
    channel,
  );
  if (byClass) return byClass.priceIrr;

  const fare = await prisma.cabinFare.findUnique({
    where: { flightInstanceId_cabin: { flightInstanceId, cabin } },
  });
  if (fare) return fare.priceIrr;

  const instance = await prisma.flightInstance.findUnique({
    where: { id: flightInstanceId },
    include: { pricing: true },
  });
  const economyPrice =
    instance?.pricing?.status === 'REGISTERED'
      ? instance.pricing.registeredPriceIrr!
      : (instance?.basePriceIrr ?? FALLBACK_ECONOMY_PRICE_IRR);

  return cabin === 'BUSINESS'
    ? Math.round((economyPrice * BUSINESS_MULTIPLIER) / 100_000) * 100_000
    : economyPrice;
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
  prisma: PrismaService,
  flightInstanceId: string,
  cabin: CabinClass,
  channel: BookingChannel = 'SYSTEM',
): Promise<{ classCode: string; priceIrr: number; taxIrr: number } | null> {
  const now = new Date();
  const allRules = await prisma.fareRule.findMany({
    where: { flightInstanceId, cabin },
    orderBy: { priceIrr: 'asc' },
  });
  const rules = allRules.filter(
    (r) =>
      (!r.validFrom || r.validFrom <= now) &&
      (!r.validUntil || r.validUntil >= now) &&
      (r.allowedChannels.length === 0 || r.allowedChannels.includes(channel)),
  );
  if (rules.length === 0) return null;

  const usage = await prisma.booking.groupBy({
    by: ['fareClassCode'],
    where: {
      flightInstanceId,
      cabin,
      fareClassCode: { not: null },
      status: { in: ['DRAFT', 'HELD', 'PAID', 'TICKETED'] },
    },
    _count: { _all: true },
  });
  const used = new Map(
    usage.map((u) => [u.fareClassCode as string, u._count._all]),
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

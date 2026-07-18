import { PrismaService } from '../../prisma/prisma.service';
import type { CabinClass } from '../../../generated/prisma/enums';

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
): Promise<number> {
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

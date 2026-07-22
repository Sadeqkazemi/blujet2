import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { getCabinPrice } from './pricing';
import { enumerateSeats } from '../reservation/seat-layout';
import { resolveAircraftType } from '../flights/aircraft-type.util';
import type { CabinClass } from '../../../generated/prisma/enums';
import type { Prisma } from '../../../generated/prisma/client';

const ACTIVE_BOOKING_STATUSES = ['DRAFT', 'HELD', 'PAID', 'TICKETED'] as const;

/** Phase 13: an instance with a sale window is excluded from search once
 * outside it; NULL on either end means "no restriction" (existing
 * instances keep working unchanged). Reused by createBooking's own
 * re-check so a stale search result can't be booked past the window. */
const SALE_WINDOW_OPEN_WHERE = {
  OR: [{ saleStartsAt: null }, { saleStartsAt: { lte: new Date() } }],
  AND: [{ OR: [{ saleEndsAt: null }, { saleEndsAt: { gte: new Date() } }] }],
} satisfies Prisma.FlightInstanceWhereInput;

// CLAUDE.md: search-result cache TTL 5-10 min; Redis is never the source of
// truth for seats/bookings — availability is still re-checked (takenSeatCodes
// queries Postgres directly) at seat-map/booking time, never from this cache.
const AIRPORTS_TTL_SECONDS = 600;
const SEARCH_TTL_SECONDS = 300;

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async airports() {
    const cacheKey = 'search:airports';
    const cached = await this.redis.get<unknown>(cacheKey);
    if (cached) return cached;

    const airports = await this.prisma.airport.findMany({
      orderBy: { cityFa: 'asc' },
    });
    await this.redis.set(cacheKey, airports, AIRPORTS_TTL_SECONDS);
    return airports;
  }

  /** Public flight search — same SCHEDULED/day-window semantics as the
   * staff reservation search, but unauthenticated and cabin/price-aware
   * (design's نتایج پرواز needs both cabins' price + seatsLeft per card).
   * Cached briefly (SEARCH_TTL_SECONDS): a cache hit can serve a slightly
   * stale seatsLeft count, which is fine since the buy flow always
   * re-validates the seat map / re-prices against Postgres directly. */
  async search(origin: string, dest: string, date: string) {
    const cacheKey = `search:flights:${origin.toUpperCase()}:${dest.toUpperCase()}:${date}`;
    const cached = await this.redis.get<unknown[]>(cacheKey);
    if (cached) return cached;

    const results = await this.searchUncached(origin, dest, date);
    await this.redis.set(cacheKey, results, SEARCH_TTL_SECONDS);
    return results;
  }

  private searchCacheKey(
    originCode: string,
    destCode: string,
    departureAt: Date,
  ): string {
    const date = departureAt.toISOString().slice(0, 10);
    return `search:flights:${originCode.toUpperCase()}:${destCode.toUpperCase()}:${date}`;
  }

  /** Called right after a booking mutates seat availability/pricing for an
   * instance, so a customer never sees a stale seatsLeft/price for the rest
   * of the TTL window after someone else just booked the seat they're
   * looking at. */
  async invalidateForInstance(flightInstanceId: string): Promise<void> {
    const instance = await this.prisma.flightInstance.findUnique({
      where: { id: flightInstanceId },
      include: { flight: { include: { route: true } } },
    });
    if (!instance) return;
    await this.redis.del(
      this.searchCacheKey(
        instance.flight.route.originCode,
        instance.flight.route.destCode,
        instance.departureAt,
      ),
    );
  }

  private async searchUncached(origin: string, dest: string, date: string) {
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const instances = await this.prisma.flightInstance.findMany({
      where: {
        status: 'SCHEDULED',
        departureAt: { gte: dayStart, lt: dayEnd },
        flight: {
          route: {
            originCode: { equals: origin, mode: 'insensitive' },
            destCode: { equals: dest, mode: 'insensitive' },
          },
        },
        ...SALE_WINDOW_OPEN_WHERE,
      },
      include: { flight: { include: { route: true } } },
      orderBy: { departureAt: 'asc' },
    });

    const results: {
      flightInstanceId: string;
      flightNo: string;
      aircraftType: string;
      originCode: string;
      destCode: string;
      departureAt: Date;
      arrivalAt: Date;
      cabins: { cabin: CabinClass; priceIrr: number; seatsLeft: number }[];
    }[] = [];
    for (const instance of instances) {
      const map = await this.prisma.aircraftSeatMap.findUnique({
        where: { aircraftType: resolveAircraftType(instance) },
      });
      const seats = map ? enumerateSeats(map) : [];
      const taken = await this.takenSeatCodes(instance.id);

      const cabins: {
        cabin: CabinClass;
        priceIrr: number;
        seatsLeft: number;
      }[] = [];
      for (const cabin of ['ECONOMY', 'BUSINESS'] as const) {
        const cabinSeats = seats.filter((s) => s.cabin === cabin);
        const seatsLeft = cabinSeats.filter(
          (s) => !taken.has(s.seatCode),
        ).length;
        if (cabinSeats.length === 0) continue;
        cabins.push({
          cabin,
          priceIrr: await getCabinPrice(this.prisma, instance.id, cabin),
          seatsLeft,
        });
      }

      results.push({
        flightInstanceId: instance.id,
        flightNo: instance.flight.flightNo,
        aircraftType: resolveAircraftType(instance),
        originCode: instance.flight.route.originCode,
        destCode: instance.flight.route.destCode,
        departureAt: instance.departureAt,
        arrivalAt: instance.arrivalAt,
        cabins,
      });
    }
    // ── 1-stop connection builder (CLAUDE.md search rules) ──
    // Only when the route has few/no direct flights; legs must respect the
    // transfer airport's minimum connection time and stay ≤2 connections
    // (i.e. up to 2 legs here; deeper chains are out of scope until a GDS
    // integration needs them).
    const connections =
      results.length > 0
        ? []
        : await this.findConnections(origin, dest, dayStart, dayEnd);

    return [...results, ...connections];
  }

  /** A→X→B same-window pairs where leg2 departs at least the transfer
   * airport's minConnectMin after leg1 arrives. Priced as the SUM of both
   * legs (each leg re-uses getCabinPrice, so connection pricing can never
   * disagree with the legs' own pages); seatsLeft is the min of the legs. */
  private async findConnections(
    origin: string,
    dest: string,
    dayStart: Date,
    dayEnd: Date,
  ) {
    const [firstLegs, secondLegs] = await Promise.all([
      this.prisma.flightInstance.findMany({
        where: {
          status: 'SCHEDULED',
          departureAt: { gte: dayStart, lt: dayEnd },
          flight: {
            route: { originCode: { equals: origin, mode: 'insensitive' } },
          },
          ...SALE_WINDOW_OPEN_WHERE,
        },
        include: { flight: { include: { route: true } } },
      }),
      this.prisma.flightInstance.findMany({
        where: {
          status: 'SCHEDULED',
          departureAt: { gte: dayStart },
          flight: {
            route: { destCode: { equals: dest, mode: 'insensitive' } },
          },
          ...SALE_WINDOW_OPEN_WHERE,
        },
        include: { flight: { include: { route: true } } },
      }),
    ]);

    const transferCodes = new Set(
      firstLegs.map((l) => l.flight.route.destCode),
    );
    const airports = await this.prisma.airport.findMany({
      where: { code: { in: [...transferCodes] } },
    });
    const minConnect = new Map(
      airports.map((a) => [a.code, a.minConnectMin * 60_000]),
    );

    const pairs: {
      a: (typeof firstLegs)[number];
      b: (typeof firstLegs)[number];
    }[] = [];
    for (const a of firstLegs) {
      const via = a.flight.route.destCode;
      if (via.toUpperCase() === dest.toUpperCase()) continue;
      const gap = minConnect.get(via) ?? 60 * 60_000;
      for (const b of secondLegs) {
        if (b.flight.route.originCode !== via) continue;
        if (b.departureAt.getTime() < a.arrivalAt.getTime() + gap) continue;
        // keep connections same-day-ish: leg2 departs within 24h of leg1 arrival
        if (b.departureAt.getTime() > a.arrivalAt.getTime() + 24 * 60 * 60_000)
          continue;
        pairs.push({ a, b });
        break; // earliest feasible second leg per first leg
      }
    }

    const out: {
      flightInstanceId: string;
      flightNo: string;
      aircraftType: string;
      originCode: string;
      destCode: string;
      departureAt: Date;
      arrivalAt: Date;
      cabins: { cabin: CabinClass; priceIrr: number; seatsLeft: number }[];
      connection: {
        via: string;
        legs: {
          flightInstanceId: string;
          flightNo: string;
          originCode: string;
          destCode: string;
          departureAt: Date;
          arrivalAt: Date;
        }[];
      };
    }[] = [];
    for (const { a, b } of pairs.slice(0, 5)) {
      const legs = [a, b];
      const cabins: {
        cabin: CabinClass;
        priceIrr: number;
        seatsLeft: number;
      }[] = [];
      for (const cabin of ['ECONOMY', 'BUSINESS'] as const) {
        let priceSum = 0;
        let seatsLeft = Number.MAX_SAFE_INTEGER;
        let ok = true;
        for (const leg of legs) {
          const map = await this.prisma.aircraftSeatMap.findUnique({
            where: { aircraftType: resolveAircraftType(leg) },
          });
          const seats = (map ? enumerateSeats(map) : []).filter(
            (s) => s.cabin === cabin,
          );
          if (seats.length === 0) {
            ok = false;
            break;
          }
          const taken = await this.takenSeatCodes(leg.id);
          seatsLeft = Math.min(
            seatsLeft,
            seats.filter((s) => !taken.has(s.seatCode)).length,
          );
          priceSum += await getCabinPrice(this.prisma, leg.id, cabin);
        }
        if (ok) cabins.push({ cabin, priceIrr: priceSum, seatsLeft });
      }
      out.push({
        flightInstanceId: a.id,
        flightNo: `${a.flight.flightNo}+${b.flight.flightNo}`,
        aircraftType: resolveAircraftType(a),
        originCode: a.flight.route.originCode,
        destCode: b.flight.route.destCode,
        departureAt: a.departureAt,
        arrivalAt: b.arrivalAt,
        cabins,
        connection: {
          via: a.flight.route.destCode,
          legs: legs.map((l) => ({
            flightInstanceId: l.id,
            flightNo: l.flight.flightNo,
            originCode: l.flight.route.originCode,
            destCode: l.flight.route.destCode,
            departureAt: l.departureAt,
            arrivalAt: l.arrivalAt,
          })),
        },
      });
    }
    return out;
  }

  async seatMap(flightInstanceId: string) {
    const instance = await this.prisma.flightInstance.findUniqueOrThrow({
      where: { id: flightInstanceId },
      include: { flight: true },
    });
    const map = await this.prisma.aircraftSeatMap.findUniqueOrThrow({
      where: { aircraftType: resolveAircraftType(instance) },
    });
    const seats = enumerateSeats(map);
    const taken = await this.takenSeatCodes(flightInstanceId);

    return {
      flightInstanceId,
      seats: seats.map((s) => ({
        ...s,
        status: taken.has(s.seatCode) ? 'TAKEN' : 'FREE',
      })),
    };
  }

  /** Sold + actively-held + managerially-locked seat codes for a flight
   * instance — the single availability check reused by search, the seat
   * map, and booking creation so they can never disagree. Excludes
   * expired HELD bookings (materializeExpiry keeps holdExpiresAt honest;
   * a booking already past its TTL frees the seat immediately here even
   * before the lazy-expiry sweep runs on that row). */
  async takenSeatCodes(flightInstanceId: string): Promise<Set<string>> {
    const [passengers, locks] = await Promise.all([
      this.prisma.passenger.findMany({
        where: {
          seatCode: { not: null },
          booking: {
            flightInstanceId,
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
            OR: [
              { status: { not: 'HELD' } },
              { holdExpiresAt: { gt: new Date() } },
            ],
          },
        },
        select: { seatCode: true },
      }),
      this.prisma.seatLock.findMany({
        where: {
          flightInstanceId,
          releasedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { seatCode: true },
      }),
    ]);
    return new Set([
      ...passengers.map((p) => p.seatCode!),
      ...locks.map((l) => l.seatCode),
    ]);
  }

  /** Phase 13: per-channel taken-seat counts for the real inventory pools
   * (agency quota / charter allotment / public). A managerial `SeatLock`
   * physically occupies a seat but isn't a `Booking`, so it's tallied
   * under a virtual `MANAGERIAL` bucket rather than `SYSTEM` — it still
   * counts against the public pool's remaining count at the call site
   * (see `BookingService.createBooking`), just not conflated with genuine
   * public-channel sales. */
  async takenCountsByChannel(flightInstanceId: string): Promise<{
    SYSTEM: number;
    CHARTER: number;
    AGENCY: number;
    MANAGERIAL: number;
  }> {
    const [passengers, lockCount] = await Promise.all([
      this.prisma.passenger.findMany({
        where: {
          seatCode: { not: null },
          booking: {
            flightInstanceId,
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
            OR: [
              { status: { not: 'HELD' } },
              { holdExpiresAt: { gt: new Date() } },
            ],
          },
        },
        select: { booking: { select: { channel: true } } },
      }),
      this.prisma.seatLock.count({
        where: {
          flightInstanceId,
          releasedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);
    const counts = { SYSTEM: 0, CHARTER: 0, AGENCY: 0, MANAGERIAL: lockCount };
    for (const p of passengers) counts[p.booking.channel] += 1;
    return counts;
  }
}

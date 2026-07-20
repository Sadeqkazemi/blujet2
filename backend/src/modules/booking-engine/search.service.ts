import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCabinPrice } from './pricing';
import { enumerateSeats } from '../reservation/seat-layout';
import type { CabinClass } from '../../../generated/prisma/enums';

const ACTIVE_BOOKING_STATUSES = ['DRAFT', 'HELD', 'PAID', 'TICKETED'] as const;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async airports() {
    return this.prisma.airport.findMany({ orderBy: { cityFa: 'asc' } });
  }

  /** Public flight search — same SCHEDULED/day-window semantics as the
   * staff reservation search, but unauthenticated and cabin/price-aware
   * (design's نتایج پرواز needs both cabins' price + seatsLeft per card). */
  async search(origin: string, dest: string, date: string) {
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
        where: { aircraftType: instance.flight.aircraftType },
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
        aircraftType: instance.flight.aircraftType,
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
            where: { aircraftType: leg.flight.aircraftType },
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
        aircraftType: a.flight.aircraftType,
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
      where: { aircraftType: instance.flight.aircraftType },
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
        where: { flightInstanceId, releasedAt: null },
        select: { seatCode: true },
      }),
    ]);
    return new Set([
      ...passengers.map((p) => p.seatCode!),
      ...locks.map((l) => l.seatCode),
    ]);
  }
}

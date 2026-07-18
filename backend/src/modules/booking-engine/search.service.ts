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
    return results;
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

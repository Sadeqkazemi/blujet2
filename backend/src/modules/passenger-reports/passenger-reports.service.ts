import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  decryptPii,
  hashPii,
  normalizeNationalId,
} from '../../common/pii-crypto';
import { resolveAircraftType } from '../flights/aircraft-type.util';
import type { AircraftSeatMap } from '../../../generated/prisma/client';

/** «123******7»-style mask — this surface never returns a full national ID. */
function maskNationalId(nid: string): string {
  if (nid.length < 4) return '*'.repeat(nid.length);
  return `${nid.slice(0, 3)}${'*'.repeat(nid.length - 4)}${nid.slice(-1)}`;
}

function cabinFor(map: AircraftSeatMap | null, seatCode: string | null) {
  if (!map || !seatCode) return null;
  const row = parseInt(seatCode, 10);
  if (Number.isNaN(row)) return null;
  if (row >= map.businessRowStart && row <= map.businessRowEnd)
    return 'BUSINESS';
  if (row >= map.economyRowStart && row <= map.economyRowEnd) return 'ECONOMY';
  return null;
}

@Injectable()
export class PassengerReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string) {
    // A 10-digit input (Persian or Latin digits) is treated as an exact
    // national-ID lookup via the deterministic hash — same pattern as the
    // club/reservation searches; anything else is a name substring match.
    const normalized = normalizeNationalId(q);
    const isNationalId = /^\d{10}$/.test(normalized);

    const passengers = await this.prisma.passenger.findMany({
      where: isNationalId
        ? { nationalIdHash: hashPii(normalized) }
        : { fullName: { contains: q.trim() } },
      take: 20,
      include: {
        booking: {
          include: {
            flightInstance: {
              include: { flight: { include: { route: true } } },
            },
          },
        },
      },
    });

    const aircraftTypes = [
      ...new Set(
        passengers.map((p) => resolveAircraftType(p.booking.flightInstance)),
      ),
    ];
    const seatMaps = await this.prisma.aircraftSeatMap.findMany({
      where: { aircraftType: { in: aircraftTypes } },
    });
    const mapByType = new Map(seatMaps.map((m) => [m.aircraftType, m]));

    return passengers.map((p) => {
      const instance = p.booking.flightInstance;
      return {
        fullName: p.fullName,
        maskedNationalId: p.nationalIdEnc
          ? maskNationalId(decryptPii(p.nationalIdEnc))
          : null,
        pnr: p.booking.pnr,
        status: p.booking.status,
        flightNo: instance.flight.flightNo,
        originCode: instance.flight.route.originCode,
        destCode: instance.flight.route.destCode,
        departureAt: instance.departureAt.toISOString(),
        seatCode: p.seatCode,
        cabin: cabinFor(
          mapByType.get(resolveAircraftType(instance)) ?? null,
          p.seatCode,
        ),
        priceIrr: p.booking.priceIrr,
      };
    });
  }
}

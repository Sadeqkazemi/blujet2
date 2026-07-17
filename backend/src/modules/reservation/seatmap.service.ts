import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import {
  encryptPii,
  hashPii,
  isValidIranianNationalId,
  normalizeNationalId,
} from '../../common/pii-crypto';
import { enumerateSeats, isKnownSeat } from './seat-layout';
import { Prisma } from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { LockSeatDto } from './dto/reservation.dtos';

@Injectable()
export class SeatmapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async getFlightInstanceOrThrow(id: string) {
    const instance = await this.prisma.flightInstance.findUnique({
      where: { id },
      include: { flight: true },
    });
    if (!instance) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد.',
      });
    }
    return instance;
  }

  private async getSeatMapConfigOrThrow(aircraftType: string) {
    const map = await this.prisma.aircraftSeatMap.findUnique({
      where: { aircraftType },
    });
    if (!map) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `نقشهٔ صندلی برای «${aircraftType}» تعریف نشده است.`,
      });
    }
    return map;
  }

  async getSeatMap(flightInstanceId: string) {
    const instance = await this.getFlightInstanceOrThrow(flightInstanceId);
    const map = await this.getSeatMapConfigOrThrow(
      instance.flight.aircraftType,
    );
    const seats = enumerateSeats(map);

    const [soldPassengers, activeLocks] = await Promise.all([
      this.prisma.passenger.findMany({
        where: {
          seatCode: { not: null },
          booking: { flightInstanceId, status: { not: 'CANCELLED' } },
        },
        select: { seatCode: true },
      }),
      this.prisma.seatLock.findMany({
        where: { flightInstanceId, releasedAt: null },
      }),
    ]);
    const soldCodes = new Set(soldPassengers.map((p) => p.seatCode!));
    const lockedByCode = new Map(activeLocks.map((l) => [l.seatCode, l]));

    const rowsMap = new Map<
      number,
      { row: number; cabin: string; seats: unknown[] }
    >();
    for (const seat of seats) {
      if (!rowsMap.has(seat.row)) {
        rowsMap.set(seat.row, { row: seat.row, cabin: seat.cabin, seats: [] });
      }
      const lock = lockedByCode.get(seat.seatCode);
      const status = soldCodes.has(seat.seatCode)
        ? 'SOLD'
        : lock
          ? 'LOCKED'
          : 'FREE';
      rowsMap.get(seat.row)!.seats.push({
        seatCode: seat.seatCode,
        status,
        lockId: lock?.id ?? null,
      });
    }

    return {
      flightInstanceId,
      aircraftType: instance.flight.aircraftType,
      rows: Array.from(rowsMap.values()).sort((a, b) => a.row - b.row),
      capacity: seats.length,
      soldCount: soldCodes.size,
      lockedCount: activeLocks.length,
      occupancyPct:
        seats.length === 0
          ? 0
          : Math.round(
              ((soldCodes.size + activeLocks.length) / seats.length) * 1000,
            ) / 10,
    };
  }

  async lockSeat(
    actor: AuthenticatedUser,
    flightInstanceId: string,
    dto: LockSeatDto,
  ) {
    const instance = await this.getFlightInstanceOrThrow(flightInstanceId);
    const map = await this.getSeatMapConfigOrThrow(
      instance.flight.aircraftType,
    );
    if (!isKnownSeat(map, dto.seatCode)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'این شماره صندلی در این هواپیما معتبر نیست.',
      });
    }

    const sold = await this.prisma.passenger.findFirst({
      where: {
        seatCode: dto.seatCode,
        booking: { flightInstanceId, status: { not: 'CANCELLED' } },
      },
    });
    if (sold) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این صندلی قبلاً فروخته شده است.',
      });
    }

    const nationalId = dto.passengerNationalId
      ? normalizeNationalId(dto.passengerNationalId)
      : undefined;
    if (nationalId && !isValidIranianNationalId(nationalId)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'کد ملی واردشده معتبر نیست.',
      });
    }

    try {
      const lock = await this.prisma.seatLock.create({
        data: {
          flightInstanceId,
          seatCode: dto.seatCode,
          lockedById: actor.id,
          passengerName: dto.passengerName,
          passengerNationalIdEnc: nationalId
            ? encryptPii(nationalId)
            : undefined,
          passengerNationalIdHash: nationalId ? hashPii(nationalId) : undefined,
          passengerMobileEnc: dto.passengerMobile
            ? encryptPii(dto.passengerMobile)
            : undefined,
        },
      });

      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        category: 'RESERVATION',
        action: 'لاک مدیریتی صندلی',
        detail: `صندلی ${dto.seatCode} توسط ${actor.fullName} برای پرواز رزرو مدیریتی شد.`,
        entityType: 'SeatLock',
        entityId: lock.id,
      });

      return this.toLockView(lock);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این صندلی هم‌اکنون توسط شخص دیگری لاک شده است.',
        });
      }
      throw err;
    }
  }

  async releaseLock(actor: AuthenticatedUser, lockId: string) {
    const lock = await this.prisma.seatLock.findUnique({
      where: { id: lockId },
    });
    if (!lock) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'لاک صندلی یافت نشد.',
      });
    }
    if (lock.releasedAt) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این لاک قبلاً آزاد شده است.',
      });
    }

    const updated = await this.prisma.seatLock.update({
      where: { id: lockId },
      data: { releasedAt: new Date(), releasedById: actor.id },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'RESERVATION',
      action: 'آزادسازی لاک صندلی',
      detail: `صندلی ${lock.seatCode} توسط ${actor.fullName} آزاد شد.`,
      entityType: 'SeatLock',
      entityId: lockId,
    });

    return this.toLockView(updated);
  }

  private toLockView(lock: Prisma.SeatLockGetPayload<Record<string, never>>) {
    const {
      passengerNationalIdEnc,
      passengerNationalIdHash,
      passengerMobileEnc,
      ...rest
    } = lock;
    void passengerNationalIdEnc;
    void passengerNationalIdHash;
    void passengerMobileEnc;
    return rest;
  }
}

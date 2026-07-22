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
import { resolveAircraftType } from '../flights/aircraft-type.util';
import { Prisma } from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { LockSeatDto, RejectLockDto } from './dto/reservation.dtos';

/** Phase 13 Part D — request-decision deadline (createdAt+this) and
 * hold-to-ticket deadline (approvedAt+this), see docs/DB_SCHEMA.md. Fixed
 * code constants, not configurable settings — no design/spec value exists
 * for either. */
const LOCK_REQUEST_TTL_HOURS = 24;
const LOCK_HOLD_TTL_HOURS = 48;
/** Fixed cap on how many seats a single requester may hold locked at once,
 * across every flight instance (⚑ global, not per-flight — see docs). */
const MAX_ACTIVE_MANAGERIAL_LOCKS_PER_REQUESTER = 5;

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

@Injectable()
export class SeatmapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** "Currently active" for a managerial lock — mirrors the Booking
   * HELD/holdExpiresAt lazy-exclusion pattern: still un-released AND not
   * past its request-decision/hold-to-ticket deadline. */
  private activeLockWhere() {
    return { releasedAt: null, expiresAt: { gt: new Date() } };
  }

  /** The DB's partial unique index only knows `releasedAt IS NULL`, not
   * `expiresAt` — it can't (a partial index predicate can't call now()).
   * So the write paths that actually contend for a seat (a new request,
   * finalizing one into a booking) must release an expired-but-not-yet-
   * released lock themselves before proceeding. A conditional update
   * guards a concurrent double-release. */
  private async releaseIfExpired(flightInstanceId: string, seatCode: string) {
    await this.prisma.seatLock.updateMany({
      where: {
        flightInstanceId,
        seatCode,
        releasedAt: null,
        expiresAt: { lte: new Date() },
      },
      data: { releasedAt: new Date() },
    });
  }

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
      resolveAircraftType(instance),
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
        where: { flightInstanceId, ...this.activeLockWhere() },
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
      aircraftType: resolveAircraftType(instance),
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
      resolveAircraftType(instance),
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

    if (dto.discountPct !== undefined && dto.classification !== 'DISCOUNTED') {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'درصد تخفیف فقط برای طبقه‌بندی «تخفیف‌دار» معتبر است.',
      });
    }

    const activeRequesterLocks = await this.prisma.seatLock.count({
      where: { lockedById: actor.id, ...this.activeLockWhere() },
    });
    if (activeRequesterLocks >= MAX_ACTIVE_MANAGERIAL_LOCKS_PER_REQUESTER) {
      throw new ConflictException({
        code: ErrorCode.LOCK_CAP_EXCEEDED,
        message: `شما در حال حاضر به سقف ${MAX_ACTIVE_MANAGERIAL_LOCKS_PER_REQUESTER} صندلی لاک‌شدهٔ فعال رسیده‌اید.`,
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

    await this.releaseIfExpired(flightInstanceId, dto.seatCode);

    try {
      const lock = await this.prisma.seatLock.create({
        data: {
          flightInstanceId,
          seatCode: dto.seatCode,
          lockedById: actor.id,
          reason: dto.reason,
          classification: dto.classification,
          discountPct: dto.discountPct,
          requesterRank: actor.role,
          approvalStatus: 'PENDING_APPROVAL',
          expiresAt: hoursFromNow(LOCK_REQUEST_TTL_HOURS),
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
        action: 'درخواست لاک مدیریتی صندلی',
        detail: `صندلی ${dto.seatCode} توسط ${actor.fullName} برای رزرو مدیریتی درخواست شد (${dto.reason}).`,
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

  private async getPendingLockOrThrow(lockId: string) {
    const lock = await this.prisma.seatLock.findUnique({
      where: { id: lockId },
    });
    if (!lock) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'لاک صندلی یافت نشد.',
      });
    }
    if (
      lock.approvalStatus !== 'PENDING_APPROVAL' ||
      lock.releasedAt ||
      lock.expiresAt <= new Date()
    ) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این درخواست دیگر در وضعیت در انتظار تأیید نیست.',
      });
    }
    return lock;
  }

  /** Two-step approval: requesting and approving both stay within
   * CAN_LOCK_ROLES, but a requester can never approve their own request —
   * a real control between the governance roles, not a rubber stamp. */
  async approveLock(actor: AuthenticatedUser, lockId: string) {
    const lock = await this.getPendingLockOrThrow(lockId);
    if (lock.lockedById === actor.id) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'شما نمی‌توانید درخواست خودتان را تأیید کنید.',
      });
    }

    const updated = await this.prisma.seatLock.update({
      where: { id: lockId },
      data: {
        approvalStatus: 'APPROVED',
        approvedById: actor.id,
        approvedAt: new Date(),
        expiresAt: hoursFromNow(LOCK_HOLD_TTL_HOURS),
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'RESERVATION',
      action: 'تأیید درخواست لاک مدیریتی',
      detail: `درخواست لاک صندلی ${lock.seatCode} توسط ${actor.fullName} تأیید شد.`,
      entityType: 'SeatLock',
      entityId: lockId,
    });

    return this.toLockView(updated);
  }

  async rejectLock(
    actor: AuthenticatedUser,
    lockId: string,
    dto: RejectLockDto,
  ) {
    const lock = await this.getPendingLockOrThrow(lockId);

    const updated = await this.prisma.seatLock.update({
      where: { id: lockId },
      data: {
        approvalStatus: 'REJECTED',
        rejectedById: actor.id,
        rejectedAt: new Date(),
        rejectionReason: dto.rejectionReason,
        releasedAt: new Date(),
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'RESERVATION',
      action: 'رد درخواست لاک مدیریتی',
      detail: `درخواست لاک صندلی ${lock.seatCode} توسط ${actor.fullName} رد شد (${dto.rejectionReason}).`,
      entityType: 'SeatLock',
      entityId: lockId,
    });

    return this.toLockView(updated);
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
    return {
      ...rest,
      active: rest.releasedAt === null && rest.expiresAt > new Date(),
    };
  }
}

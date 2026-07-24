import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/errors';
import { getCabinPrice } from './pricing';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { CabinClass } from '../../../generated/prisma/enums';

const LOCK_TTL_MS = 72 * 60 * 60 * 1000;
/** Flat, NestJS-computed fee — CLAUDE.md: "fee/risk suggested by the ML
 * service but authorized and computed by NestJS." The AI-suggested variable
 * fee is deferred (see PLAN.md Phase 13); this is a documented flat rate. */
const LOCK_FEE_PCT = 3;
const GOLD_TIER_LEVELS = ['GOLD', 'PLATINUM'] as const;

@Injectable()
export class PriceLockService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    user: AuthenticatedUser,
    dto: { flightInstanceId: string; cabin: CabinClass },
  ) {
    const member = await this.prisma.clubMember.findUnique({
      where: { userId: user.id },
    });
    if (
      !member ||
      !GOLD_TIER_LEVELS.includes(
        member.level as (typeof GOLD_TIER_LEVELS)[number],
      )
    ) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message:
          'قفل قیمت هوشمند فقط برای اعضای طلایی و بالاتر باشگاه مشتریان است.',
      });
    }

    const instance = await this.prisma.flightInstance.findUnique({
      where: { id: dto.flightInstanceId },
    });
    if (!instance || instance.status !== 'SCHEDULED') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد یا دیگر قابل رزرو نیست.',
      });
    }

    const existing = await this.prisma.priceLock.findFirst({
      where: {
        userId: user.id,
        flightInstanceId: dto.flightInstanceId,
        cabin: dto.cabin,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
    });
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'شما قبلاً برای این پرواز و کلاس، قیمت را قفل کرده‌اید.',
      });
    }

    const priceIrr = await getCabinPrice(
      this.prisma,
      dto.flightInstanceId,
      dto.cabin,
    );
    const feeIrr =
      Math.round((priceIrr * LOCK_FEE_PCT) / 100 / 10_000) * 10_000;

    return this.prisma.priceLock.create({
      data: {
        userId: user.id,
        flightInstanceId: dto.flightInstanceId,
        cabin: dto.cabin,
        lockedPriceIrr: priceIrr,
        feeIrr,
        expiresAt: new Date(Date.now() + LOCK_TTL_MS),
      },
    });
  }

  async listMine(user: AuthenticatedUser) {
    const locks = await this.prisma.priceLock.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        flightInstance: { include: { flight: { include: { route: true } } } },
      },
    });
    return locks.map((l) => ({
      id: l.id,
      flightInstanceId: l.flightInstanceId,
      cabin: l.cabin,
      lockedPriceIrr: l.lockedPriceIrr,
      feeIrr: l.feeIrr,
      status: l.status,
      expiresAt: l.expiresAt,
      createdAt: l.createdAt,
      bookingId: l.bookingId,
      flight: {
        flightNo: l.flightInstance.flight.flightNo,
        originCode: l.flightInstance.flight.route.originCode,
        destCode: l.flightInstance.flight.route.destCode,
        departureAt: l.flightInstance.departureAt,
      },
    }));
  }

  async cancel(user: AuthenticatedUser, id: string) {
    const lock = await this.prisma.priceLock.findUnique({ where: { id } });
    if (!lock || lock.userId !== user.id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'قفل قیمت یافت نشد.',
      });
    }
    if (lock.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'این قفل قیمت دیگر فعال نیست.',
      });
    }
    return this.prisma.priceLock.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /** Finds an active, non-expired, not-yet-consumed lock for this exact
   * user/flight/cabin — used by BookingService.createBooking to price the
   * new HELD booking at the locked rate instead of the live rate. */
  async findUsableLock(
    userId: string,
    flightInstanceId: string,
    cabin: CabinClass,
  ) {
    return this.prisma.priceLock.findFirst({
      where: {
        userId,
        flightInstanceId,
        cabin,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
        bookingId: null,
      },
    });
  }
}

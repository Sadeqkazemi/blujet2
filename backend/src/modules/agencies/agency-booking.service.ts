import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { AuditService } from '../audit/audit.service';
import { AgenciesService } from './agencies.service';
import { SearchService } from '../booking-engine/search.service';
import { ErrorCode } from '../../common/errors';
import {
  encryptPii,
  hashPii,
  isValidIranianNationalId,
  normalizeNationalId,
} from '../../common/pii-crypto';
import { generateUniquePnr } from '../../common/pnr.util';
import { captureAndTicket } from '../../common/booking-state.util';
import { enumerateSeats } from '../reservation/seat-layout';
import { resolveAircraftType } from '../flights/aircraft-type.util';
import { getCabinPrice, resolveFareClass } from '../booking-engine/pricing';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { CreateAgencyBookingDto } from './dto/create-agency-booking.dto';
import type { TypeORM } from '../../../generated/typeorm/client';

const HOLD_TTL_MS = 10 * 60 * 1000;

const ACTIVE_STATUSES = ['DRAFT', 'HELD', 'PAID', 'TICKETED'] as const;

const BOOKING_INCLUDE = {
  passengers: true,
  flightInstance: { include: { flight: { include: { route: true } } } },
} satisfies TypeORM.BookingInclude;

type BookingWithRelations = TypeORM.BookingGetPayload<{
  include: typeof BOOKING_INCLUDE;
}>;

@Injectable()
export class AgencyBookingService {
  constructor(
    private readonly typeorm: TypeORMService,
    private readonly audit: AuditService,
    private readonly search: SearchService,
    private readonly agencies: AgenciesService,
  ) {}

  private toDetail(b: BookingWithRelations) {
    return {
      id: b.id,
      pnr: b.pnr,
      status: b.status,
      cabin: b.cabin,
      priceIrr: b.priceIrr,
      taxIrr: b.taxIrr,
      holdExpiresAt: b.holdExpiresAt,
      flightInstanceId: b.flightInstanceId,
      flightNo: b.flightInstance.flight.flightNo,
      originCode: b.flightInstance.flight.route.originCode,
      destCode: b.flightInstance.flight.route.destCode,
      departureAt: b.flightInstance.departureAt,
      arrivalAt: b.flightInstance.arrivalAt,
      passengers: b.passengers.map((p) => ({
        fullName: p.fullName,
        seatCode: p.seatCode,
      })),
    };
  }

  private async getAgencyProfileOrThrow(actor: AuthenticatedUser) {
    const profile = await this.typeorm.agencyProfile.findUnique({
      where: { userId: actor.id },
    });
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پروفایل آژانس یافت نشد.',
      });
    }
    if (profile.suspendedAt) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'حساب آژانس معلق است و امکان فروش وجود ندارد.',
      });
    }
    return profile;
  }

  private async countActiveAgencySeats(
    agencyId: string,
    flightInstanceId: string,
    tx: TypeORM.TransactionClient = this.typeorm,
  ): Promise<number> {
    return tx.passenger.count({
      where: {
        booking: {
          agencyId,
          flightInstanceId,
          channel: 'AGENCY',
          status: { in: [...ACTIVE_STATUSES] },
          OR: [
            { status: { not: 'HELD' } },
            { holdExpiresAt: { gt: new Date() } },
          ],
        },
      },
    });
  }

  private isAllotmentActive(
    type: 'HARD' | 'SOFT',
    releaseAt: Date | null,
    now = new Date(),
  ): boolean {
    return type === 'HARD' || !releaseAt || releaseAt > now;
  }

  private async resolveAllotment(
    agencyId: string,
    flightInstanceId: string,
    passengerCount: number,
    allotmentId: string | undefined,
    tx: TypeORM.TransactionClient,
  ) {
    const now = new Date();
    const allotments = await tx.agencyAllotment.findMany({
      where: { agencyId, flightInstanceId },
    });

    const active = allotments.filter((a) =>
      this.isAllotmentActive(a.type, a.releaseAt, now),
    );

    let chosen = allotmentId
      ? active.find((a) => a.id === allotmentId)
      : undefined;

    if (allotmentId && !chosen) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'سهمیه انتخاب‌شده برای این پرواز فعال یا موجود نیست.',
      });
    }

    if (!chosen) {
      for (const a of active) {
        const used = await this.countActiveAgencySeats(
          agencyId,
          flightInstanceId,
          tx,
        );
        if (a.seatsAllocated - used >= passengerCount) {
          chosen = a;
          break;
        }
      }
    }

    if (chosen) {
      const used = await this.countActiveAgencySeats(
        agencyId,
        flightInstanceId,
        tx,
      );
      if (used + passengerCount > chosen.seatsAllocated) {
        throw new ConflictException({
          code: ErrorCode.POOL_EXHAUSTED,
          message: 'ظرفیت سهمیه آژانس برای این پرواز تکمیل شده است.',
        });
      }
      return chosen;
    }

    const instance = await tx.flightInstance.findUniqueOrThrow({
      where: { id: flightInstanceId },
    });
    if (!instance.agencySeatsAllocated) {
      throw new ConflictException({
        code: ErrorCode.POOL_EXHAUSTED,
        message: 'سهمیه آژانسی برای این پرواز تعریف نشده است.',
      });
    }

    const counts = await this.search.takenCountsByChannel(flightInstanceId);
    if (counts.AGENCY + passengerCount > instance.agencySeatsAllocated) {
      throw new ConflictException({
        code: ErrorCode.POOL_EXHAUSTED,
        message: 'ظرفیت فروش آژانسی این پرواز تکمیل شده است.',
      });
    }

    return null;
  }

  async createBooking(
    actor: AuthenticatedUser,
    dto: CreateAgencyBookingDto,
    idempotencyKey?: string,
  ) {
    await this.getAgencyProfileOrThrow(actor);

    if (idempotencyKey) {
      const existing = await this.typeorm.booking.findUnique({
        where: { idempotencyKey },
        include: BOOKING_INCLUDE,
      });
      if (existing) {
        if (existing.agencyId !== actor.id) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: 'این رزرو متعلق به آژانس شما نیست.',
          });
        }
        return this.toDetail(existing);
      }
    }

    const instance = await this.typeorm.flightInstance.findUnique({
      where: { id: dto.flightInstanceId },
      include: { flight: true },
    });
    if (!instance || instance.status !== 'SCHEDULED') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد یا دیگر قابل رزرو نیست.',
      });
    }

    const now = new Date();
    if (
      (instance.saleStartsAt && instance.saleStartsAt > now) ||
      (instance.saleEndsAt && instance.saleEndsAt < now)
    ) {
      throw new ConflictException({
        code: ErrorCode.SALE_WINDOW_CLOSED,
        message: 'مهلت فروش این پرواز به پایان رسیده یا هنوز آغاز نشده است.',
      });
    }

    const map = await this.typeorm.aircraftSeatMap.findUnique({
      where: { aircraftType: resolveAircraftType(instance) },
    });
    if (!map) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'نقشه صندلی برای این هواپیما تعریف نشده است.',
      });
    }

    const seatsByCode = new Map(
      enumerateSeats(map).map((s) => [s.seatCode, s]),
    );
    const requestedCodes = dto.passengers.map((p) => p.seatCode);
    if (new Set(requestedCodes).size !== requestedCodes.length) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'صندلی تکراری انتخاب شده است.',
      });
    }
    for (const code of requestedCodes) {
      const seat = seatsByCode.get(code);
      if (!seat || seat.cabin !== dto.cabin) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: `صندلی ${code} در کلاس ${dto.cabin === 'BUSINESS' ? 'بیزینس' : 'اکونومی'} معتبر نیست.`,
        });
      }
    }

    for (const p of dto.passengers) {
      if (
        p.nationalId &&
        !isValidIranianNationalId(normalizeNationalId(p.nationalId))
      ) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: `کد ملی «${p.fullName}» معتبر نیست.`,
        });
      }
    }

    const profile = await this.typeorm.agencyProfile.findUniqueOrThrow({
      where: { userId: actor.id },
    });

    const activeAllotments = await this.typeorm.agencyAllotment.findMany({
      where: { agencyId: actor.id, flightInstanceId: instance.id },
    });
    const active = activeAllotments.filter((a) =>
      this.isAllotmentActive(a.type, a.releaseAt, now),
    );
    const pricingAllotment = dto.allotmentId
      ? active.find((a) => a.id === dto.allotmentId)
      : active[0];

    const unitPriceIrr = pricingAllotment?.contractPriceIrr
      ? pricingAllotment.contractPriceIrr
      : await getCabinPrice(this.typeorm, instance.id, dto.cabin, 'AGENCY');
    const fareClass = pricingAllotment?.contractPriceIrr
      ? null
      : await resolveFareClass(this.typeorm, instance.id, dto.cabin, 'AGENCY');
    const taxIrr = (fareClass?.taxIrr ?? 0) * dto.passengers.length;
    const priceIrr = unitPriceIrr * dto.passengers.length + taxIrr;

    const booking = await this.typeorm.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM flight_instances WHERE id = ${instance.id} FOR UPDATE`;

      const taken = await this.search.takenSeatCodes(instance.id);
      const conflict = requestedCodes.find((c) => taken.has(c));
      if (conflict) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: `صندلی ${conflict} هم‌اکنون در دسترس نیست.`,
        });
      }

      const allotment = await this.resolveAllotment(
        actor.id,
        instance.id,
        dto.passengers.length,
        dto.allotmentId,
        tx,
      );

      const created = await tx.booking.create({
        data: {
          pnr: await generateUniquePnr(tx),
          flightInstanceId: instance.id,
          channel: 'AGENCY',
          agencyId: actor.id,
          status: 'HELD',
          cabin: dto.cabin,
          fareClassCode: fareClass?.classCode ?? null,
          priceIrr,
          taxIrr,
          contactPhone: profile.phone,
          holdExpiresAt: new Date(Date.now() + HOLD_TTL_MS),
          idempotencyKey,
          passengers: {
            create: dto.passengers.map((p) => {
              const nationalId = p.nationalId
                ? normalizeNationalId(p.nationalId)
                : undefined;
              return {
                fullName: p.fullName,
                seatCode: p.seatCode,
                nationalIdEnc: nationalId ? encryptPii(nationalId) : undefined,
                nationalIdHash: nationalId ? hashPii(nationalId) : undefined,
                mobileEnc: p.mobile ? encryptPii(p.mobile) : undefined,
              };
            }),
          },
        },
        include: BOOKING_INCLUDE,
      });

      return created;
    });

    await this.search.invalidateForInstance(instance.id);

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'RESERVATION',
      action: 'رزرو آژانس (HELD)',
      detail: `رزرو ${booking.pnr} برای پرواز ${booking.flightInstance.flight.flightNo} توسط آژانس ثبت شد.`,
      entityType: 'Booking',
      entityId: booking.id,
    });

    return this.toDetail(booking);
  }

  private async getOwnedBooking(
    bookingId: string,
    agencyId: string,
  ): Promise<BookingWithRelations> {
    const booking = await this.typeorm.booking.findUnique({
      where: { id: bookingId },
      include: BOOKING_INCLUDE,
    });
    if (!booking || booking.agencyId !== agencyId) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'رزرو یافت نشد.',
      });
    }
    if (
      booking.status === 'HELD' &&
      booking.holdExpiresAt &&
      booking.holdExpiresAt <= new Date()
    ) {
      await this.typeorm.booking.updateMany({
        where: { id: booking.id, status: 'HELD' },
        data: { status: 'EXPIRED' },
      });
      return { ...booking, status: 'EXPIRED' };
    }
    return booking;
  }

  async getById(actor: AuthenticatedUser, bookingId: string) {
    await this.getAgencyProfileOrThrow(actor);
    return this.toDetail(await this.getOwnedBooking(bookingId, actor.id));
  }

  /** Issue a HELD agency booking on credit — re-prices, checks limit, posts SALE. */
  async issue(
    actor: AuthenticatedUser,
    bookingId: string,
    options: { confirmedPriceIrr?: number } = {},
  ) {
    await this.getAgencyProfileOrThrow(actor);
    const booking = await this.getOwnedBooking(bookingId, actor.id);

    if (booking.status === 'EXPIRED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'مهلت نگهداری این رزرو به پایان رسیده است.',
      });
    }
    if (booking.status !== 'HELD') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          booking.status === 'TICKETED' || booking.status === 'PAID'
            ? 'این رزرو قبلاً صادر شده است.'
            : 'این رزرو قابل صدور نیست.',
      });
    }

    const currentFareClass = await resolveFareClass(
      this.typeorm,
      booking.flightInstanceId,
      booking.cabin,
      'AGENCY',
    );
    const currentTaxIrr =
      (currentFareClass?.taxIrr ?? 0) * booking.passengers.length;

    const allotments = await this.typeorm.agencyAllotment.findMany({
      where: {
        agencyId: actor.id,
        flightInstanceId: booking.flightInstanceId,
      },
    });
    const now = new Date();
    const active = allotments.filter((a) =>
      this.isAllotmentActive(a.type, a.releaseAt, now),
    );
    const pricingAllotment = active[0];

    const unitPriceIrr = pricingAllotment?.contractPriceIrr
      ? pricingAllotment.contractPriceIrr
      : await getCabinPrice(
          this.typeorm,
          booking.flightInstanceId,
          booking.cabin,
          'AGENCY',
        );
    const currentPriceIrr =
      unitPriceIrr * booking.passengers.length + currentTaxIrr;

    if (currentPriceIrr !== booking.priceIrr) {
      if (options.confirmedPriceIrr !== currentPriceIrr) {
        return {
          priceChanged: true as const,
          previousPriceIrr: booking.priceIrr,
          currentPriceIrr,
        };
      }
    }

    const credit = await this.agencies.getCredit(actor.id);
    if (credit.remainingIrr < currentPriceIrr) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'اعتبار آژانس برای صدور این بلیط کافی نیست.',
      });
    }

    const issued = await this.typeorm.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM flight_instances WHERE id = ${booking.flightInstanceId} FOR UPDATE`;

      const creditNow = await this.agencies.getCredit(actor.id);
      if (creditNow.remainingIrr < currentPriceIrr) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'اعتبار آژانس برای صدور این بلیط کافی نیست.',
        });
      }

      await captureAndTicket(tx, bookingId, { priceIrr: currentPriceIrr });

      await tx.ledgerEntry.create({
        data: {
          bookingId,
          agencyId: actor.id,
          type: 'SALE',
          signedAmountIrr: currentPriceIrr,
          createdById: actor.id,
        },
      });

      return tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: BOOKING_INCLUDE,
      });
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'RESERVATION',
      action: 'صدور بلیط آژانس (اعتبار)',
      detail: `رزرو ${issued.pnr} با اعتبار آژانس صادر شد.`,
      entityType: 'Booking',
      entityId: issued.id,
      metadata: { priceIrr: currentPriceIrr },
    });

    return {
      priceChanged: false as const,
      booking: this.toDetail(issued),
    };
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import {
  encryptPii,
  hashPii,
  isValidIranianNationalId,
  normalizeNationalId,
} from '../../common/pii-crypto';
import { enumerateSeats } from '../reservation/seat-layout';
import { getCabinPrice, resolveFareClass } from './pricing';
import { PAYMENT_GATEWAY, type PaymentGateway } from './payment-gateway';
import { SearchService } from './search.service';
import { PriceLockService } from './price-lock.service';
import { WalletService } from './wallet.service';
import { ClubPointsService } from './club-points.service';
import { applyPromoCode } from './promo.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { CreateBookingDto } from './dto/create-booking.dto';
import type { Prisma } from '../../../generated/prisma/client';

export type PaymentMethod = 'GATEWAY' | 'WALLET' | 'POINTS';

/** CLAUDE.md: "HELD has a 10-minute TTL (matches the design's hold timer);
 * expiry releases inventory automatically." */
const HOLD_TTL_MS = 10 * 60 * 1000;

function generatePnr(): string {
  return `BJ${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

const BOOKING_INCLUDE = {
  passengers: true,
  flightInstance: { include: { flight: { include: { route: true } } } },
  priceLock: true,
} satisfies Prisma.BookingInclude;

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: typeof BOOKING_INCLUDE;
}>;

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly search: SearchService,
    private readonly priceLocks: PriceLockService,
    private readonly wallet: WalletService,
    private readonly clubPoints: ClubPointsService,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
  ) {}

  /** Lazily flips a past-TTL HELD booking to EXPIRED, releasing its seats
   * for the next reader (search/seatmap only look at non-expired holds) —
   * no cron job needed. Conditional update guards a concurrent double-flip. */
  private async materializeExpiry(
    booking: BookingWithRelations,
  ): Promise<BookingWithRelations> {
    if (
      booking.status !== 'HELD' ||
      !booking.holdExpiresAt ||
      booking.holdExpiresAt > new Date()
    ) {
      return booking;
    }
    await this.prisma.booking.updateMany({
      where: { id: booking.id, status: 'HELD' },
      data: { status: 'EXPIRED' },
    });
    return { ...booking, status: 'EXPIRED' };
  }

  private toDetail(b: BookingWithRelations) {
    return {
      id: b.id,
      pnr: b.pnr,
      status: b.status,
      cabin: b.cabin,
      priceIrr: b.priceIrr,
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

  async createBooking(
    user: AuthenticatedUser,
    dto: CreateBookingDto,
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const existing = await this.prisma.booking.findUnique({
        where: { idempotencyKey },
        include: BOOKING_INCLUDE,
      });
      if (existing) return this.toDetail(existing);
    }

    const instance = await this.prisma.flightInstance.findUnique({
      where: { id: dto.flightInstanceId },
      include: { flight: true },
    });
    if (!instance || instance.status !== 'SCHEDULED') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد یا دیگر قابل رزرو نیست.',
      });
    }

    const map = await this.prisma.aircraftSeatMap.findUnique({
      where: { aircraftType: instance.flight.aircraftType },
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

    // An active, unused price lock for this exact user/flight/cabin prices
    // the whole booking at the locked rate instead of the live rate — the
    // point of the feature is shielding the customer from a market move.
    const usableLock = await this.priceLocks.findUsableLock(
      user.id,
      instance.id,
      dto.cabin,
    );
    const unitPriceIrr = usableLock
      ? usableLock.lockedPriceIrr
      : await getCabinPrice(this.prisma, instance.id, dto.cabin);
    // Fare-class bucket (Y/B/M) this booking consumes, when class-based
    // pricing is active for the instance; null under flat pricing.
    const fareClass = usableLock
      ? null
      : await resolveFareClass(this.prisma, instance.id, dto.cabin);
    const priceIrr = unitPriceIrr * dto.passengers.length;
    const contactUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { phone: true },
    });

    // Row lock on the flight instance serializes concurrent booking-creation
    // attempts for the same flight — CLAUDE.md: "Prevent double-booking with
    // SELECT ... FOR UPDATE ... Exactly one of two concurrent buyers of the
    // last seat may succeed."
    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM flight_instances WHERE id = ${instance.id} FOR UPDATE`;

      const taken = await this.search.takenSeatCodes(instance.id);
      const conflict = requestedCodes.find((c) => taken.has(c));
      if (conflict) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: `صندلی ${conflict} هم‌اکنون در دسترس نیست.`,
        });
      }

      const created = await tx.booking.create({
        data: {
          pnr: generatePnr(),
          flightInstanceId: instance.id,
          channel: 'SYSTEM',
          status: 'HELD',
          cabin: dto.cabin,
          fareClassCode: fareClass?.classCode ?? null,
          priceIrr,
          userId: user.id,
          contactPhone: contactUser.phone ?? undefined,
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

      if (usableLock) {
        // Conditional update: guards against the same user's lock being
        // consumed twice by a concurrent duplicate request.
        await tx.priceLock.updateMany({
          where: { id: usableLock.id, bookingId: null },
          data: { bookingId: created.id },
        });
      }

      return created;
    });

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      category: 'RESERVATION',
      action: 'رزرو آنلاین (HELD)',
      detail: `رزرو ${booking.pnr} برای پرواز ${booking.flightInstance.flight.flightNo} توسط مشتری ثبت شد.`,
      entityType: 'Booking',
      entityId: booking.id,
    });

    return this.toDetail(booking);
  }

  private async getOwnedBooking(id: string, user: AuthenticatedUser) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'رزرو یافت نشد.',
      });
    }
    if (booking.userId !== user.id) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'این رزرو متعلق به شما نیست.',
      });
    }
    return this.materializeExpiry(booking);
  }

  async getById(id: string, user: AuthenticatedUser) {
    return this.toDetail(await this.getOwnedBooking(id, user));
  }

  async getByPnr(pnr: string, user: AuthenticatedUser) {
    const booking = await this.prisma.booking.findUnique({
      where: { pnr },
      include: BOOKING_INCLUDE,
    });
    if (!booking || booking.userId !== user.id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'رزرو یافت نشد.',
      });
    }
    return this.toDetail(await this.materializeExpiry(booking));
  }

  async listMine(user: AuthenticatedUser) {
    const bookings = await this.prisma.booking.findMany({
      where: { userId: user.id },
      include: BOOKING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return bookings.map((b) => this.toDetail(b));
  }

  /**
   * Re-prices immediately before charging (CLAUDE.md: "ALWAYS re-price
   * immediately before payment; if the price changed, show the new price
   * and require explicit user confirmation") — UNLESS the booking was
   * created against an active PriceLock, whose whole point is shielding the
   * customer from exactly that. Applies an optional promo code, charges via
   * the chosen payment method (sandbox gateway / wallet / club points),
   * transitions HELD -> TICKETED, posts the SALE ledger entry for the
   * actual net amount, and earns club points on real-money payments — all
   * inside one transaction.
   */
  async pay(
    id: string,
    user: AuthenticatedUser,
    options: {
      confirmedPriceIrr?: number;
      promoCode?: string;
      paymentMethod?: PaymentMethod;
    } = {},
  ) {
    const booking = await this.getOwnedBooking(id, user);
    if (booking.status === 'EXPIRED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          'مهلت نگهداری این رزرو به پایان رسیده است. لطفاً دوباره رزرو کنید.',
      });
    }
    if (booking.status !== 'HELD') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          booking.status === 'TICKETED' || booking.status === 'PAID'
            ? 'این رزرو قبلاً پرداخت شده است.'
            : 'این رزرو قابل پرداخت نیست.',
      });
    }

    const isLocked =
      !!booking.priceLock && booking.priceLock.status === 'ACTIVE';
    const currentPriceIrr = isLocked
      ? booking.priceIrr
      : (await getCabinPrice(
          this.prisma,
          booking.flightInstanceId,
          booking.cabin,
        )) * booking.passengers.length;

    if (!isLocked && currentPriceIrr !== booking.priceIrr) {
      if (options.confirmedPriceIrr !== currentPriceIrr) {
        return {
          priceChanged: true as const,
          previousPriceIrr: booking.priceIrr,
          currentPriceIrr,
        };
      }
    }

    const paymentMethod: PaymentMethod = options.paymentMethod ?? 'GATEWAY';
    const member = await this.clubPoints.findMemberByUserId(user.id);

    // Shetab/IPG handshake happens BEFORE the DB transaction (a real driver
    // is a network call; sandbox approves synchronously). Wallet/points pay
    // internally, so no gateway round-trip for them.
    let gatewayRefId: string | null = null;
    if (paymentMethod === 'GATEWAY') {
      const { authority } = await this.gateway.request(currentPriceIrr, id);
      const verified = await this.gateway.verify(authority, currentPriceIrr);
      if (!verified.ok) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'پرداخت از سوی درگاه تأیید نشد. مبلغی کسر نشده است.',
        });
      }
      gatewayRefId = verified.refId;
    }

    const paid = await this.prisma.$transaction(async (tx) => {
      let finalPriceIrr = currentPriceIrr;
      let discountIrr = 0;
      if (options.promoCode) {
        const result = await applyPromoCode(tx, {
          code: options.promoCode,
          userId: user.id,
          bookingId: id,
          originCode: booking.flightInstance.flight.route.originCode,
          destCode: booking.flightInstance.flight.route.destCode,
          cabin: booking.cabin,
          priceIrr: currentPriceIrr,
        });
        finalPriceIrr = result.finalPriceIrr;
        discountIrr = result.discountIrr;
      }

      if (paymentMethod === 'WALLET') {
        await this.wallet.charge(tx, user.id, finalPriceIrr, id);
      } else if (paymentMethod === 'POINTS') {
        if (!member) {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'پرداخت با امتیاز فقط برای اعضای باشگاه مشتریان است.',
          });
        }
        await this.clubPoints.redeemForPayment(
          tx,
          member.id,
          finalPriceIrr,
          id,
        );
      }

      // Explicit state machine: payment capture flips HELD→PAID, ticket
      // issuance then flips PAID→TICKETED — both inside this transaction,
      // each guarded so a concurrent double-pay hits count===0 and 409s.
      const captured = await tx.booking.updateMany({
        where: { id, status: 'HELD' },
        data: { status: 'PAID', priceIrr: finalPriceIrr },
      });
      if (captured.count === 0) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این رزرو قبلاً پرداخت شده است.',
        });
      }
      const issued = await tx.booking.updateMany({
        where: { id, status: 'PAID' },
        data: { status: 'TICKETED' },
      });
      if (issued.count === 0) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'صدور بلیط ناموفق بود.',
        });
      }

      if (isLocked) {
        await tx.priceLock.update({
          where: { id: booking.priceLock!.id },
          data: { status: 'USED' },
        });
      }

      await tx.ledgerEntry.create({
        data: {
          bookingId: id,
          type: 'SALE',
          signedAmountIrr: finalPriceIrr,
          createdById: user.id,
        },
      });

      // Real money spent (gateway/wallet) earns points; redeeming points to
      // pay never earns points back (no redeem-to-earn loophole).
      if (member && paymentMethod !== 'POINTS') {
        await this.clubPoints.earnForPurchase(tx, member.id, finalPriceIrr, id);
      }

      return {
        booking: await tx.booking.findUniqueOrThrow({
          where: { id },
          include: BOOKING_INCLUDE,
        }),
        discountIrr,
      };
    });

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      category: 'RESERVATION',
      action: 'پرداخت و صدور بلیط',
      detail: `رزرو ${paid.booking.pnr} پرداخت و بلیط صادر شد.`,
      entityType: 'Booking',
      entityId: paid.booking.id,
      metadata: {
        priceIrr: paid.booking.priceIrr,
        paymentMethod,
        discountIrr: paid.discountIrr,
        gatewayRefId,
      },
    });

    return {
      priceChanged: false as const,
      booking: this.toDetail(paid.booking),
    };
  }
}

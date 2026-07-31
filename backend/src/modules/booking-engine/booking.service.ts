import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import {
  encryptPii,
  hashPii,
  isValidIranianNationalId,
  normalizeNationalId,
} from '../../common/pii-crypto';
import {
  generateUniqueItineraryPnr,
  generateUniquePnr,
  legPnr,
} from '../../common/pnr.util';
import { captureAndTicket } from '../../common/booking-state.util';
import { enumerateSeats } from '../reservation/seat-layout';
import { matchesLastName } from '../../common/passenger-name.util';
import { resolveAircraftType } from '../flights/aircraft-type.util';
import { getCabinPrice, resolveFareClass } from './pricing';
import { PAYMENT_GATEWAY, type PaymentGateway } from './payment-gateway';
import { SearchService } from './search.service';
import { PriceLockService } from './price-lock.service';
import { WalletService } from './wallet.service';
import { ClubPointsService } from './club-points.service';
import { applyPromoCode } from './promo.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { CreateBookingDto } from './dto/create-booking.dto';
import type { CreateConnectionBookingDto } from './dto/create-connection-booking.dto';
import type { TypeORM } from '../../../generated/typeorm/client';

type ConnectionFlightInstance = TypeORM.FlightInstanceGetPayload<{
  include: { flight: { include: { route: true } } };
}>;

export type PaymentMethod = 'GATEWAY' | 'WALLET' | 'POINTS';

/** CLAUDE.md: "HELD has a 10-minute TTL (matches the design's hold timer);
 * expiry releases inventory automatically." */
const HOLD_TTL_MS = 10 * 60 * 1000;

const BOOKING_INCLUDE = {
  passengers: true,
  flightInstance: { include: { flight: { include: { route: true } } } },
  priceLock: true,
} satisfies TypeORM.BookingInclude;

type BookingWithRelations = TypeORM.BookingGetPayload<{
  include: typeof BOOKING_INCLUDE;
}>;

@Injectable()
export class BookingService {
  constructor(
    private readonly typeorm: TypeORMService,
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
    await this.typeorm.booking.updateMany({
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
      taxIrr: b.taxIrr,
      holdExpiresAt: b.holdExpiresAt,
      flightInstanceId: b.flightInstanceId,
      flightNo: b.flightInstance.flight.flightNo,
      originCode: b.flightInstance.flight.route.originCode,
      destCode: b.flightInstance.flight.route.destCode,
      departureAt: b.flightInstance.departureAt,
      arrivalAt: b.flightInstance.arrivalAt,
      isPriceLocked: !!b.priceLock,
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
      const existing = await this.typeorm.booking.findUnique({
        where: { idempotencyKey },
        include: BOOKING_INCLUDE,
      });
      if (existing) return this.toDetail(existing);
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
      : await getCabinPrice(this.typeorm, instance.id, dto.cabin);
    // Fare-class bucket (Y/B/M) this booking consumes, when class-based
    // pricing is active for the instance; null under flat pricing.
    const fareClass = usableLock
      ? null
      : await resolveFareClass(this.typeorm, instance.id, dto.cabin);
    // Tax/fee is per-fare-class (Phase 13 Part B) and included in the
    // stored total so ledger/refunds/reporting — which all read
    // priceIrr as-is — never need to know tax exists; taxIrr is stored
    // alongside purely for receipt display.
    const taxIrr = (fareClass?.taxIrr ?? 0) * dto.passengers.length;
    const priceIrr = unitPriceIrr * dto.passengers.length + taxIrr;
    const contactUser = await this.typeorm.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { phone: true },
    });

    // Row lock on the flight instance serializes concurrent booking-creation
    // attempts for the same flight — CLAUDE.md: "Prevent double-booking with
    // SELECT ... FOR UPDATE ... Exactly one of two concurrent buyers of the
    // last seat may succeed."
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

      // This booking is always channel SYSTEM (public/direct sale) — must
      // not eat into seats reserved for the agency/charter pools even
      // though physical seats remain (CLAUDE.md pools: they belong to a
      // different pool). Managerial locks still count against this pool
      // (they physically occupy a public-pool seat).
      const counts = await this.search.takenCountsByChannel(instance.id);
      const publicPoolLimit =
        instance.capacity -
        instance.charterSeats -
        (instance.agencySeatsAllocated ?? 0);
      const publicPoolUsed = counts.SYSTEM + counts.MANAGERIAL;
      if (publicPoolUsed + dto.passengers.length > publicPoolLimit) {
        throw new ConflictException({
          code: ErrorCode.POOL_EXHAUSTED,
          message: 'ظرفیت فروش عمومی این پرواز تکمیل شده است.',
        });
      }

      const created = await tx.booking.create({
        data: {
          pnr: await generateUniquePnr(tx),
          flightInstanceId: instance.id,
          channel: 'SYSTEM',
          status: 'HELD',
          cabin: dto.cabin,
          fareClassCode: fareClass?.classCode ?? null,
          priceIrr,
          taxIrr,
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

    // The just-consumed seat/fare-bucket must not keep showing as available
    // on a cached search result for the rest of the cache TTL.
    await this.search.invalidateForInstance(instance.id);

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      category: 'RESERVATION',
      action: 'رزرو آنلاین (HELD)',
      detail: `رزرو ${booking.pnr} برای پرواز ${booking.flightInstance.flight.flightNo} توسط مشتری ثبت شد.`,
      entityType: 'Booking',
      entityId: booking.id,
    });

    // `booking` was fetched (with BOOKING_INCLUDE) before the priceLock
    // claim above ran in the same transaction, so its `priceLock` relation
    // is a stale pre-claim snapshot — `usableLock` (resolved earlier) is
    // the reliable signal that this booking actually consumed a lock.
    const detail = this.toDetail(booking);
    return usableLock ? { ...detail, isPriceLocked: true } : detail;
  }

  private async getOwnedBooking(id: string, user: AuthenticatedUser) {
    const booking = await this.typeorm.booking.findUnique({
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
    const booking = await this.typeorm.booking.findUnique({
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

  /** Anonymous مدیریت رزرو self-service — PNR + last name instead of a
   * login session. Same generic 404 whether the PNR doesn't exist or the
   * name doesn't match, so brute-forcing PNRs can't distinguish the two. */
  async getByPnrAndLastName(pnr: string, lastName: string) {
    const booking = await this.typeorm.booking.findUnique({
      where: { pnr: pnr.trim().toUpperCase() },
      include: BOOKING_INCLUDE,
    });
    if (
      !booking ||
      !booking.passengers.some((p) => matchesLastName(p.fullName, lastName))
    ) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'رزرو یافت نشد.',
      });
    }
    return this.toDetail(await this.materializeExpiry(booking));
  }

  async listMine(user: AuthenticatedUser) {
    const bookings = await this.typeorm.booking.findMany({
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
    // Re-pricing must include the current tax the same way it was included
    // at creation, or every taxed booking would spuriously look
    // price-changed (untaxed re-quote vs. the tax-inclusive stored total).
    const currentFareClass = isLocked
      ? null
      : await resolveFareClass(
          this.typeorm,
          booking.flightInstanceId,
          booking.cabin,
        );
    const currentTaxIrr =
      (currentFareClass?.taxIrr ?? 0) * booking.passengers.length;
    const currentPriceIrr = isLocked
      ? booking.priceIrr
      : (await getCabinPrice(
          this.typeorm,
          booking.flightInstanceId,
          booking.cabin,
        )) *
          booking.passengers.length +
        currentTaxIrr;

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
    // Phase 13 Part E: written the instant the gateway confirms capture,
    // before the ticketing transaction below even starts — if that
    // transaction later fails for any reason (bad promo, DB hiccup, crash),
    // this PENDING row is the only durable proof the money was taken. See
    // docs/DB_SCHEMA.md.
    let reconciliationId: string | null = null;
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
      const reconciliation = await this.typeorm.paymentReconciliation.create({
        data: {
          bookingId: id,
          gatewayRefId: verified.refId,
          amountIrr: currentPriceIrr,
        },
      });
      reconciliationId = reconciliation.id;
    }

    const paid = await this.typeorm.$transaction(async (tx) => {
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

      // Explicit state machine via shared helper — HELD→PAID→TICKETED.
      await captureAndTicket(tx, id, { priceIrr: finalPriceIrr });

      if (isLocked) {
        await tx.priceLock.update({
          where: { id: booking.priceLock!.id },
          data: { status: 'USED' },
        });
      }

      if (reconciliationId) {
        await tx.paymentReconciliation.update({
          where: { id: reconciliationId },
          data: { status: 'RESOLVED', resolvedAt: new Date() },
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

  private toItineraryDetail(
    itinerary: {
      id: string;
      pnr: string;
      holdExpiresAt: Date | null;
      legs: BookingWithRelations[];
    },
    totalPriceIrr: number,
  ) {
    return {
      itineraryId: itinerary.id,
      pnr: itinerary.pnr,
      holdExpiresAt: itinerary.holdExpiresAt,
      totalPriceIrr,
      legs: itinerary.legs.map((leg) => this.toDetail(leg)),
    };
  }

  /** Atomic hold for a 2-leg connection — shared itinerary PNR, per-leg bookings. */
  async createConnectionBooking(
    user: AuthenticatedUser,
    dto: CreateConnectionBookingDto,
    idempotencyKey?: string,
  ) {
    if (dto.legs.length !== 2) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'رزرو اتصال فقط برای دو پرواز پشتیبانی می‌شود.',
      });
    }

    const paxCount = dto.legs[0].passengers.length;
    if (dto.legs[1].passengers.length !== paxCount) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'تعداد مسافران در هر دو پرواز باید یکسان باشد.',
      });
    }

    if (idempotencyKey) {
      const existing = await this.typeorm.booking.findUnique({
        where: { idempotencyKey },
        include: {
          ...BOOKING_INCLUDE,
          itinerary: { include: { legs: { include: BOOKING_INCLUDE } } },
        },
      });
      if (existing?.itinerary) {
        const total = existing.itinerary.legs.reduce(
          (sum, leg) => sum + leg.priceIrr,
          0,
        );
        return this.toItineraryDetail(existing.itinerary, total);
      }
    }

    const contactUser = await this.typeorm.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { phone: true },
    });

    const holdExpiresAt = new Date(Date.now() + HOLD_TTL_MS);
    let totalPriceIrr = 0;

    const result = await this.typeorm.$transaction(async (tx) => {
      const legInstances: {
        leg: CreateConnectionBookingDto['legs'][number];
        instance: ConnectionFlightInstance;
      }[] = [];
      for (const leg of dto.legs) {
        const instance = await tx.flightInstance.findUnique({
          where: { id: leg.flightInstanceId },
          include: { flight: { include: { route: true } } },
        });
        if (!instance || instance.status !== 'SCHEDULED') {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'یکی از پروازهای اتصال یافت نشد.',
          });
        }
        legInstances.push({ leg, instance });
      }

      const sortedIds = legInstances
        .map((l) => l.instance.id)
        .sort()
        .join(',');
      for (const id of sortedIds.split(',')) {
        await tx.$queryRaw`SELECT id FROM flight_instances WHERE id = ${id} FOR UPDATE`;
      }

      const itineraryPnr = await generateUniqueItineraryPnr(tx);
      const itinerary = await tx.itinerary.create({
        data: {
          pnr: itineraryPnr,
          userId: user.id,
          channel: 'SYSTEM',
          holdExpiresAt,
        },
      });

      const first = legInstances[0]!.instance;
      const second = legInstances[1]!.instance;
      const via = first.flight.route.destCode;
      if (second.flight.route.originCode !== via) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'پرواز دوم باید از همان فرودگاه اتصال حرکت کند.',
        });
      }
      const airport = await tx.airport.findUnique({ where: { code: via } });
      const minGapMs = (airport?.minConnectMin ?? 60) * 60_000;
      if (second.departureAt.getTime() < first.arrivalAt.getTime() + minGapMs) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'زمان اتصال بین دو پرواز کافی نیست.',
        });
      }

      const createdLegs: BookingWithRelations[] = [];

      for (let legIndex = 0; legIndex < legInstances.length; legIndex++) {
        const { leg, instance } = legInstances[legIndex]!;
        const map = await tx.aircraftSeatMap.findUnique({
          where: { aircraftType: resolveAircraftType(instance) },
        });
        if (!map) {
          throw new NotFoundException({
            code: ErrorCode.NOT_FOUND,
            message: 'نقشه صندلی برای یکی از پروازها تعریف نشده است.',
          });
        }

        const seatsByCode = new Map(
          enumerateSeats(map).map((s) => [s.seatCode, s]),
        );
        const requestedCodes = leg.passengers.map((p) => p.seatCode);
        for (const code of requestedCodes) {
          const seat = seatsByCode.get(code);
          if (!seat || seat.cabin !== dto.cabin) {
            throw new BadRequestException({
              code: ErrorCode.VALIDATION_FAILED,
              message: `صندلی ${code} در پرواز ${instance.flight.flightNo} معتبر نیست.`,
            });
          }
        }

        const taken = await this.search.takenSeatCodes(instance.id);
        const conflict = requestedCodes.find((c) => taken.has(c));
        if (conflict) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: `صندلی ${conflict} در پرواز ${instance.flight.flightNo} در دسترس نیست.`,
          });
        }

        const counts = await this.search.takenCountsByChannel(instance.id);
        const publicPoolLimit =
          instance.capacity -
          instance.charterSeats -
          (instance.agencySeatsAllocated ?? 0);
        if (counts.SYSTEM + counts.MANAGERIAL + paxCount > publicPoolLimit) {
          throw new ConflictException({
            code: ErrorCode.POOL_EXHAUSTED,
            message: `ظرفیت فروش عمومی پرواز ${instance.flight.flightNo} تکمیل شده است.`,
          });
        }

        const fareClass = await resolveFareClass(
          this.typeorm,
          instance.id,
          dto.cabin,
        );
        const taxIrr = (fareClass?.taxIrr ?? 0) * paxCount;
        const unitPriceIrr = await getCabinPrice(
          this.typeorm,
          instance.id,
          dto.cabin,
        );
        const priceIrr = unitPriceIrr * paxCount + taxIrr;
        totalPriceIrr += priceIrr;

        const booking = await tx.booking.create({
          data: {
            pnr: legPnr(itineraryPnr, legIndex),
            flightInstanceId: instance.id,
            itineraryId: itinerary.id,
            legIndex,
            channel: 'SYSTEM',
            status: 'HELD',
            cabin: dto.cabin,
            fareClassCode: fareClass?.classCode ?? null,
            priceIrr,
            taxIrr,
            userId: user.id,
            contactPhone: contactUser.phone ?? undefined,
            holdExpiresAt,
            idempotencyKey: legIndex === 0 ? idempotencyKey : undefined,
            passengers: {
              create: leg.passengers.map((p) => {
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
        createdLegs.push(booking);
      }

      return { itinerary, legs: createdLegs };
    });

    for (const leg of result.legs) {
      await this.search.invalidateForInstance(leg.flightInstanceId);
    }

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      category: 'RESERVATION',
      action: 'رزرو اتصال (HELD)',
      detail: `رزرو اتصال ${result.itinerary.pnr} با ${result.legs.length} پرواز ثبت شد.`,
      entityType: 'Itinerary',
      entityId: result.itinerary.id,
    });

    return this.toItineraryDetail(
      { ...result.itinerary, legs: result.legs },
      totalPriceIrr,
    );
  }

  async payItinerary(
    itineraryId: string,
    user: AuthenticatedUser,
    options: {
      confirmedPriceIrr?: number;
      promoCode?: string;
      paymentMethod?: PaymentMethod;
    } = {},
  ) {
    const itinerary = await this.typeorm.itinerary.findUnique({
      where: { id: itineraryId },
      include: { legs: { include: BOOKING_INCLUDE, orderBy: { legIndex: 'asc' } } },
    });
    if (!itinerary || itinerary.userId !== user.id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'رزرو اتصال یافت نشد.',
      });
    }
    if (itinerary.legs.length === 0) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'رزرو اتصال یافت نشد.',
      });
    }

    for (const leg of itinerary.legs) {
      if (leg.status === 'HELD' && leg.holdExpiresAt && leg.holdExpiresAt <= new Date()) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'مهلت نگهداری این رزرو به پایان رسیده است.',
        });
      }
      if (leg.status !== 'HELD') {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این رزرو اتصال قبلاً پرداخت شده یا قابل پرداخت نیست.',
        });
      }
    }

    let currentTotalIrr = 0;
    const repricedLegs: { id: string; currentPriceIrr: number }[] = [];
    for (const leg of itinerary.legs) {
      const fareClass = await resolveFareClass(
        this.typeorm,
        leg.flightInstanceId,
        leg.cabin,
      );
      const taxIrr = (fareClass?.taxIrr ?? 0) * leg.passengers.length;
      const currentPriceIrr =
        (await getCabinPrice(
          this.typeorm,
          leg.flightInstanceId,
          leg.cabin,
        )) *
          leg.passengers.length +
        taxIrr;
      currentTotalIrr += currentPriceIrr;
      repricedLegs.push({ id: leg.id, currentPriceIrr });
    }

    const storedTotal = itinerary.legs.reduce((s, l) => s + l.priceIrr, 0);
    if (currentTotalIrr !== storedTotal) {
      if (options.confirmedPriceIrr !== currentTotalIrr) {
        return {
          priceChanged: true as const,
          previousPriceIrr: storedTotal,
          currentPriceIrr: currentTotalIrr,
        };
      }
    }

    const paymentMethod: PaymentMethod = options.paymentMethod ?? 'GATEWAY';
    const member = await this.clubPoints.findMemberByUserId(user.id);
    let gatewayRefId: string | null = null;
    let reconciliationId: string | null = null;

    if (paymentMethod === 'GATEWAY') {
      const { authority } = await this.gateway.request(
        currentTotalIrr,
        itineraryId,
      );
      const verified = await this.gateway.verify(authority, currentTotalIrr);
      if (!verified.ok) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'پرداخت از سوی درگاه تأیید نشد.',
        });
      }
      gatewayRefId = verified.refId;
      const reconciliation = await this.typeorm.paymentReconciliation.create({
        data: {
          bookingId: itinerary.legs[0]!.id,
          gatewayRefId: verified.refId,
          amountIrr: currentTotalIrr,
        },
      });
      reconciliationId = reconciliation.id;
    }

    const paid = await this.typeorm.$transaction(async (tx) => {
      let finalTotalIrr = currentTotalIrr;
      let discountIrr = 0;
      if (options.promoCode) {
        const firstLeg = itinerary.legs[0]!;
        const result = await applyPromoCode(tx, {
          code: options.promoCode,
          userId: user.id,
          bookingId: firstLeg.id,
          originCode: firstLeg.flightInstance.flight.route.originCode,
          destCode:
            itinerary.legs[itinerary.legs.length - 1]!.flightInstance.flight.route
              .destCode,
          cabin: firstLeg.cabin,
          priceIrr: currentTotalIrr,
        });
        finalTotalIrr = result.finalPriceIrr;
        discountIrr = result.discountIrr;
      }

      if (paymentMethod === 'WALLET') {
        await this.wallet.charge(tx, user.id, finalTotalIrr, itinerary.legs[0]!.id);
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
          finalTotalIrr,
          itinerary.legs[0]!.id,
        );
      }

      const ratio = finalTotalIrr / currentTotalIrr;
      for (const repriced of repricedLegs) {
        const legFinal = Math.round(repriced.currentPriceIrr * ratio);
        await captureAndTicket(tx, repriced.id, { priceIrr: legFinal });
      }

      if (reconciliationId) {
        await tx.paymentReconciliation.update({
          where: { id: reconciliationId },
          data: { status: 'RESOLVED', resolvedAt: new Date() },
        });
      }

      await tx.ledgerEntry.create({
        data: {
          bookingId: itinerary.legs[0]!.id,
          type: 'SALE',
          signedAmountIrr: finalTotalIrr,
          createdById: user.id,
        },
      });

      if (member && paymentMethod !== 'POINTS') {
        await this.clubPoints.earnForPurchase(
          tx,
          member.id,
          finalTotalIrr,
          itinerary.legs[0]!.id,
        );
      }

      const refreshed = await tx.itinerary.findUniqueOrThrow({
        where: { id: itineraryId },
        include: { legs: { include: BOOKING_INCLUDE, orderBy: { legIndex: 'asc' } } },
      });
      return { itinerary: refreshed, discountIrr };
    });

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      category: 'RESERVATION',
      action: 'پرداخت رزرو اتصال',
      detail: `رزرو اتصال ${paid.itinerary.pnr} پرداخت شد.`,
      entityType: 'Itinerary',
      entityId: paid.itinerary.id,
      metadata: { paymentMethod, gatewayRefId },
    });

    const total = paid.itinerary.legs.reduce((s, l) => s + l.priceIrr, 0);
    return {
      priceChanged: false as const,
      itinerary: this.toItineraryDetail(paid.itinerary, total),
      discountIrr: paid.discountIrr,
    };
  }
}

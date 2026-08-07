import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'node:crypto';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { Booking } from '../../database/entities/booking.entity';
import { Passenger } from '../../database/entities/passenger.entity';
import { FlightInstance } from '../../database/entities/flight-instance.entity';
import { AircraftSeatMap } from '../../database/entities/aircraft-seat-map.entity';
import { User } from '../../database/entities/user.entity';
import { PriceLock } from '../../database/entities/price-lock.entity';
import { PaymentReconciliation } from '../../database/entities/payment-reconciliation.entity';
import { PayIdempotencyRecord } from '../../database/entities/pay-idempotency-record.entity';
import { LedgerEntry } from '../../database/entities/ledger-entry.entity';
import { AgencyAllotment } from '../../database/entities/agency-allotment.entity';
import { AgencyCreditLine } from '../../database/entities/agency-credit-line.entity';
import { TravelExtraSetting } from '../../database/entities/travel-extra-setting.entity';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import {
  encryptPii,
  hashPii,
  isValidIranianNationalId,
  normalizeNationalId,
} from '../../common/pii-crypto';
import { enumerateSeats } from '../reservation/seat-layout';
import { matchesLastName } from '../../common/passenger-name.util';
import { resolveAircraftType } from '../flights/aircraft-type.util';
import { getCabinPrice, resolveFareClass } from './pricing';
import type { Irr } from '../../common/money';
import { PAYMENT_GATEWAY, type PaymentGateway } from './payment-gateway';
import { SearchService } from './search.service';
import { PriceLockService } from './price-lock.service';
import { WalletService } from './wallet.service';
import { ClubPointsService } from './club-points.service';
import { CustomerReferralsService } from '../customer-referrals/customer-referrals.service';
import { applyPromoCode } from './promo.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { CreateBookingDto } from './dto/create-booking.dto';
import type { CreateAllotmentBookingDto } from '../agency-portal/dto/create-allotment-booking.dto';

export type PaymentMethod = 'GATEWAY' | 'WALLET' | 'POINTS';

/** CLAUDE.md: "HELD has a 10-minute TTL (matches the design's hold timer);
 * expiry releases inventory automatically." */
const HOLD_TTL_MS = 10 * 60 * 1000;

function generatePnr(): string {
  return `BJ${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

type BookingWithRelations = Omit<Booking, 'generateId' | 'defaultTaxIrr'> & {
  passengers: Passenger[];
  priceLock: PriceLock | null;
};

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Passenger)
    private readonly passengerRepo: Repository<Passenger>,
    @InjectRepository(FlightInstance)
    private readonly flightInstanceRepo: Repository<FlightInstance>,
    @InjectRepository(AircraftSeatMap)
    private readonly seatMapRepo: Repository<AircraftSeatMap>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PriceLock)
    private readonly priceLockRepo: Repository<PriceLock>,
    @InjectRepository(PaymentReconciliation)
    private readonly reconciliationRepo: Repository<PaymentReconciliation>,
    @InjectRepository(PayIdempotencyRecord)
    private readonly payIdempotencyRepo: Repository<PayIdempotencyRecord>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(AgencyAllotment)
    private readonly allotmentRepo: Repository<AgencyAllotment>,
    @InjectRepository(TravelExtraSetting)
    private readonly travelExtraRepo: Repository<TravelExtraSetting>,
    private readonly audit: AuditService,
    private readonly search: SearchService,
    private readonly priceLocks: PriceLockService,
    private readonly wallet: WalletService,
    private readonly clubPoints: ClubPointsService,
    private readonly customerReferrals: CustomerReferralsService,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
  ) {}

  private bookingWithFlightQuery(manager: EntityManager) {
    return manager
      .createQueryBuilder(Booking, 'b')
      .leftJoinAndSelect('b.flightInstance', 'flightInstance')
      .leftJoinAndSelect('flightInstance.flight', 'flight')
      .leftJoinAndSelect('flight.route', 'route');
  }

  /** Booking has no inverse relation to Passenger/PriceLock — both are
   * fetched separately and merged, mirroring the reservation module's
   * `getBookingOrThrow` pattern. */
  private async loadBookingRelations(
    booking: Booking,
    manager: EntityManager = this.bookingRepo.manager,
  ): Promise<BookingWithRelations> {
    const [passengers, priceLock] = await Promise.all([
      manager.find(Passenger, { where: { bookingId: booking.id } }),
      manager.findOneBy(PriceLock, { bookingId: booking.id }),
    ]);
    return { ...booking, passengers, priceLock };
  }

  private async findBookingWithRelations(
    where: { id?: string; pnr?: string; idempotencyKey?: string },
    manager: EntityManager = this.bookingRepo.manager,
  ): Promise<BookingWithRelations | null> {
    const qb = this.bookingWithFlightQuery(manager);
    if (where.id) qb.andWhere('b.id = :id', { id: where.id });
    if (where.pnr) qb.andWhere('b.pnr = :pnr', { pnr: where.pnr });
    if (where.idempotencyKey) {
      qb.andWhere('b.idempotencyKey = :idempotencyKey', {
        idempotencyKey: where.idempotencyKey,
      });
    }
    const booking = await qb.getOne();
    if (!booking) return null;
    return this.loadBookingRelations(booking, manager);
  }

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
    await this.bookingRepo.update(
      { id: booking.id, status: 'HELD' },
      { status: 'EXPIRED' },
    );
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
      extrasIrr: b.extrasIrr,
      extras: b.extrasSnapshot,
      channel: b.channel,
      agencyId: b.agencyId,
      allotmentId: b.allotmentId,
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

  /** Anonymous manage-booking surface — only the credential-matching
   * passenger keeps their name; co-travellers are redacted. */
  private toAnonymousDetail(b: BookingWithRelations, lastName: string) {
    const detail = this.toDetail(b);
    return {
      ...detail,
      passengers: b.passengers.map((p) => ({
        fullName: matchesLastName(p.fullName, lastName)
          ? p.fullName
          : 'مسافر همراه',
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
      const existing = await this.findBookingWithRelations({
        idempotencyKey,
      });
      if (existing) return this.toDetail(existing);
    }

    const instance = await this.flightInstanceRepo
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.flight', 'flight')
      .where('fi.id = :id', { id: dto.flightInstanceId })
      .getOne();
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

    const map = await this.seatMapRepo.findOneBy({
      aircraftType: resolveAircraftType(instance),
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
    const unitPriceIrr: Irr = usableLock
      ? usableLock.lockedPriceIrr
      : await getCabinPrice(this.bookingRepo.manager, instance.id, dto.cabin);
    // Fare-class bucket (Y/B/M) this booking consumes, when class-based
    // pricing is active for the instance; null under flat pricing.
    const fareClass = usableLock
      ? null
      : await resolveFareClass(
          this.bookingRepo.manager,
          instance.id,
          dto.cabin,
        );
    const requestedExtras = dto.extras ?? [];
    const requestedExtraIds = requestedExtras.map((extra) => extra.id);
    if (new Set(requestedExtraIds).size !== requestedExtraIds.length) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'هر هزینه سفر فقط یک‌بار قابل انتخاب است.',
      });
    }
    const configuredExtras = requestedExtraIds.length
      ? await this.travelExtraRepo.findBy({ id: In(requestedExtraIds) })
      : [];
    if (
      configuredExtras.length !== requestedExtraIds.length ||
      configuredExtras.some((extra) => !extra.active || !extra.purchaseEnabled)
    ) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'یکی از هزینه‌های سفر انتخاب‌شده دیگر فعال نیست.',
      });
    }
    const configuredById = new Map(
      configuredExtras.map((extra) => [extra.id, extra]),
    );
    const extrasSnapshot = requestedExtras.map((selection) => {
      const extra = configuredById.get(selection.id)!;
      if (extra.billingUnit !== 'PER_KG' && selection.quantity !== 1) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'تعداد فقط برای هزینه بار اضافه قابل تغییر است.',
        });
      }
      const quantity =
        extra.billingUnit === 'PER_PASSENGER'
          ? dto.passengers.length
          : selection.quantity;
      const totalIrr = extra.priceIrr * BigInt(quantity);
      return {
        id: extra.id,
        code: extra.code,
        titleFa: extra.titleFa,
        billingUnit: extra.billingUnit,
        unitPriceIrr: extra.priceIrr.toString(),
        quantity,
        totalIrr: totalIrr.toString(),
      };
    });
    const extrasIrr = extrasSnapshot.reduce(
      (total, extra) => total + BigInt(extra.totalIrr),
      0n,
    );
    // Tax/fee is per-fare-class (Phase 13 Part B) and included in the
    // stored total so ledger/refunds/reporting — which all read
    // priceIrr as-is — never need to know tax exists; taxIrr is stored
    // alongside purely for receipt display.
    const passengerCount = BigInt(dto.passengers.length);
    const taxIrr: Irr = (fareClass?.taxIrr ?? 0n) * passengerCount;
    const priceIrr: Irr = unitPriceIrr * passengerCount + taxIrr + extrasIrr;
    const contactUser = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.phone'])
      .where('u.id = :id', { id: user.id })
      .getOneOrFail();

    // Row lock on the flight instance serializes concurrent booking-creation
    // attempts for the same flight — CLAUDE.md: "Prevent double-booking with
    // SELECT ... FOR UPDATE ... Exactly one of two concurrent buyers of the
    // last seat may succeed."
    const booking = await this.bookingRepo.manager.transaction(async (tx) => {
      await tx
        .createQueryBuilder(FlightInstance, 'fi')
        .setLock('pessimistic_write')
        .where('fi.id = :id', { id: instance.id })
        .getOne();

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

      const created = await tx.save(
        tx.create(Booking, {
          pnr: generatePnr(),
          flightInstanceId: instance.id,
          channel: 'SYSTEM',
          status: 'HELD',
          cabin: dto.cabin,
          fareClassCode: fareClass?.classCode ?? null,
          priceIrr,
          taxIrr,
          extrasIrr,
          extrasSnapshot,
          userId: user.id,
          contactPhone: contactUser.phone ?? null,
          holdExpiresAt: new Date(Date.now() + HOLD_TTL_MS),
          idempotencyKey: idempotencyKey ?? null,
        }),
      );

      const passengerEntities = dto.passengers.map((p) => {
        const nationalId = p.nationalId
          ? normalizeNationalId(p.nationalId)
          : undefined;
        return tx.create(Passenger, {
          bookingId: created.id,
          fullName: p.fullName,
          seatCode: p.seatCode,
          nationalIdEnc: nationalId ? encryptPii(nationalId) : null,
          nationalIdHash: nationalId ? hashPii(nationalId) : null,
          mobileEnc: p.mobile ? encryptPii(p.mobile) : null,
        });
      });
      await tx.save(passengerEntities);

      if (usableLock) {
        // Conditional update: guards against the same user's lock being
        // consumed twice by a concurrent duplicate request.
        await tx.update(
          PriceLock,
          { id: usableLock.id, bookingId: IsNull() },
          { bookingId: created.id },
        );
      }

      return created;
    });

    // The just-consumed seat/fare-bucket must not keep showing as available
    // on a cached search result for the rest of the cache TTL.
    await this.search.invalidateForInstance(instance.id);

    const bookingWithRelations = (await this.findBookingWithRelations({
      id: booking.id,
    }))!;

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      category: 'RESERVATION',
      action: 'رزرو آنلاین (HELD)',
      detail: `رزرو ${booking.pnr} برای پرواز ${instance.flight.flightNo} توسط مشتری ثبت شد.`,
      entityType: 'Booking',
      entityId: booking.id,
      metadata: {
        extrasIrr: extrasIrr.toString(),
        extraCodes: extrasSnapshot.map((extra) => extra.code),
      },
    });

    // `bookingWithRelations` is re-fetched right after the priceLock claim
    // ran in the same transaction, so its `priceLock` relation reflects the
    // claim already — `usableLock` (resolved earlier) is kept as the
    // reliable signal that this booking actually consumed a lock, matching
    // the original Prisma code's own caution about staleness.
    const detail = this.toDetail(bookingWithRelations);
    return usableLock ? { ...detail, isPriceLocked: true } : detail;
  }

  private async getOwnedBooking(id: string, user: AuthenticatedUser) {
    const booking = await this.findBookingWithRelations({ id });
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
    const booking = await this.findBookingWithRelations({ pnr });
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
    const booking = await this.findBookingWithRelations({
      pnr: pnr.trim().toUpperCase(),
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
    return this.toAnonymousDetail(
      await this.materializeExpiry(booking),
      lastName,
    );
  }

  async listMine(user: AuthenticatedUser) {
    const bookings = await this.bookingWithFlightQuery(this.bookingRepo.manager)
      .where('b.userId = :userId', { userId: user.id })
      .orderBy('b.createdAt', 'DESC')
      .getMany();
    return Promise.all(
      bookings.map(async (b) =>
        this.toDetail(await this.loadBookingRelations(b)),
      ),
    );
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
  async createAgencyAllotmentBooking(
    actor: AuthenticatedUser,
    allotmentId: string,
    dto: CreateAllotmentBookingDto,
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const existing = await this.findBookingWithRelations({ idempotencyKey });
      if (existing) {
        if (
          existing.channel !== 'AGENCY' ||
          existing.agencyId !== actor.id ||
          existing.allotmentId !== allotmentId
        ) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'کلید تکرار برای درخواست دیگری استفاده شده است.',
          });
        }
        return this.toDetail(existing);
      }
    }

    const allotment = await this.allotmentRepo.findOne({
      where: { id: allotmentId, agencyId: actor.id },
      relations: { flightInstance: { flight: true } },
    });
    const instance = allotment?.flightInstance;
    const now = new Date();
    if (
      !allotment ||
      !instance ||
      instance.status !== 'SCHEDULED' ||
      (allotment.type === 'SOFT' &&
        !!allotment.releaseAt &&
        allotment.releaseAt <= now)
    ) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'سهمیه فعال و متعلق به این آژانس یافت نشد.',
      });
    }
    if (
      (instance.saleStartsAt && instance.saleStartsAt > now) ||
      (instance.saleEndsAt && instance.saleEndsAt < now)
    ) {
      throw new ConflictException({
        code: ErrorCode.SALE_WINDOW_CLOSED,
        message: 'مهلت فروش این پرواز به پایان رسیده یا هنوز آغاز نشده است.',
      });
    }

    const map = await this.seatMapRepo.findOneBy({
      aircraftType: resolveAircraftType(instance),
    });
    if (!map) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'نقشه صندلی برای این هواپیما تعریف نشده است.',
      });
    }
    const seatsByCode = new Map(
      enumerateSeats(map).map((seat) => [seat.seatCode, seat]),
    );
    const requestedCodes = dto.passengers.map(
      (passenger) => passenger.seatCode,
    );
    if (new Set(requestedCodes).size !== requestedCodes.length) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'صندلی تکراری انتخاب شده است.',
      });
    }
    for (const passenger of dto.passengers) {
      const seat = seatsByCode.get(passenger.seatCode);
      if (!seat || seat.cabin !== dto.cabin) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: `صندلی ${passenger.seatCode} برای کلاس انتخابی معتبر نیست.`,
        });
      }
      if (
        passenger.nationalId &&
        !isValidIranianNationalId(normalizeNationalId(passenger.nationalId))
      ) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: `کد ملی «${passenger.fullName}» معتبر نیست.`,
        });
      }
    }

    const fareClass = await resolveFareClass(
      this.bookingRepo.manager,
      instance.id,
      dto.cabin,
    );
    const unitPriceIrr =
      allotment.contractPriceIrr ??
      (await getCabinPrice(this.bookingRepo.manager, instance.id, dto.cabin));
    const passengerCount = BigInt(dto.passengers.length);
    const taxIrr = (fareClass?.taxIrr ?? 0n) * passengerCount;
    const priceIrr = unitPriceIrr * passengerCount + taxIrr;
    const contactUser = await this.userRepo.findOneByOrFail({ id: actor.id });

    const transactionResult = await this.bookingRepo.manager.transaction(
      async (tx) => {
        await tx
          .createQueryBuilder(FlightInstance, 'fi')
          .setLock('pessimistic_write')
          .where('fi.id = :id', { id: instance.id })
          .getOneOrFail();
        const lockedAllotment = await tx.findOne(AgencyAllotment, {
          where: { id: allotmentId, agencyId: actor.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !lockedAllotment ||
          (lockedAllotment.type === 'SOFT' &&
            !!lockedAllotment.releaseAt &&
            lockedAllotment.releaseAt <= new Date())
        ) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'سهمیه دیگر فعال نیست.',
          });
        }

        if (idempotencyKey) {
          const concurrentExisting = await tx.findOne(Booking, {
            where: { idempotencyKey },
          });
          if (concurrentExisting) {
            if (
              concurrentExisting.channel !== 'AGENCY' ||
              concurrentExisting.agencyId !== actor.id ||
              concurrentExisting.allotmentId !== allotmentId
            ) {
              throw new ConflictException({
                code: ErrorCode.CONFLICT,
                message: 'کلید تکرار برای درخواست دیگری استفاده شده است.',
              });
            }
            return { booking: concurrentExisting, created: false };
          }
        }

        const taken = await this.search.takenSeatCodes(instance.id);
        const seatConflict = requestedCodes.find((code) => taken.has(code));
        if (seatConflict) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: `صندلی ${seatConflict} هم‌اکنون در دسترس نیست.`,
          });
        }

        const usedSeats = await tx
          .createQueryBuilder(Passenger, 'p')
          .innerJoin(Booking, 'b', 'b.id = p.bookingId')
          .where('b.allotmentId = :allotmentId', { allotmentId })
          .andWhere(
            `(b.status IN ('PAID', 'TICKETED', 'FLOWN', 'NO_SHOW') OR (b.status = 'HELD' AND b.holdExpiresAt > :now))`,
            { now: new Date() },
          )
          .getCount();
        if (
          usedSeats + dto.passengers.length >
          lockedAllotment.seatsAllocated
        ) {
          throw new ConflictException({
            code: ErrorCode.POOL_EXHAUSTED,
            message: 'ظرفیت سهمیه این آژانس تکمیل شده است.',
          });
        }

        const credit = await tx.findOne(AgencyCreditLine, {
          where: { agencyId: actor.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!credit) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'خط اعتباری آژانس تعریف نشده است.',
          });
        }
        const ledgerSum = await tx
          .createQueryBuilder(LedgerEntry, 'entry')
          .select('SUM(entry.signedAmountIrr)', 'sum')
          .where('entry.agencyId = :agencyId', { agencyId: actor.id })
          .andWhere('entry.type IN (:...types)', {
            types: ['SALE', 'SETTLEMENT'],
          })
          .getRawOne<{ sum: string | null }>();
        const rawUsedIrr = BigInt(ledgerSum?.sum ?? '0');
        const usedIrr = rawUsedIrr > 0n ? rawUsedIrr : 0n;
        if (priceIrr > credit.limitIrr - usedIrr) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'اعتبار باقی‌مانده آژانس برای این فروش کافی نیست.',
          });
        }

        const created = await tx.save(
          tx.create(Booking, {
            pnr: generatePnr(),
            flightInstanceId: instance.id,
            channel: 'AGENCY',
            agencyId: actor.id,
            allotmentId,
            status: 'TICKETED',
            cabin: dto.cabin,
            fareClassCode: fareClass?.classCode ?? null,
            priceIrr,
            taxIrr,
            userId: null,
            contactPhone: contactUser.phone ?? null,
            holdExpiresAt: null,
            idempotencyKey: idempotencyKey ?? null,
          }),
        );
        await tx.save(
          dto.passengers.map((passenger) => {
            const nationalId = passenger.nationalId
              ? normalizeNationalId(passenger.nationalId)
              : undefined;
            return tx.create(Passenger, {
              bookingId: created.id,
              fullName: passenger.fullName,
              seatCode: passenger.seatCode,
              nationalIdEnc: nationalId ? encryptPii(nationalId) : null,
              nationalIdHash: nationalId ? hashPii(nationalId) : null,
              mobileEnc: passenger.mobile ? encryptPii(passenger.mobile) : null,
            });
          }),
        );
        await tx.save(
          tx.create(LedgerEntry, {
            bookingId: created.id,
            agencyId: actor.id,
            type: 'SALE',
            signedAmountIrr: priceIrr,
            createdById: actor.id,
          }),
        );
        return { booking: created, created: true };
      },
    );

    const booking = transactionResult.booking;
    if (transactionResult.created) {
      await this.search.invalidateForInstance(instance.id);
      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        category: 'RESERVATION',
        action: 'فروش قطعی از سهمیه آژانس',
        detail: `بلیت ${booking.pnr} از سهمیه آژانس برای پرواز ${instance.flight.flightNo} صادر شد.`,
        entityType: 'Booking',
        entityId: booking.id,
        metadata: { allotmentId, priceIrr },
      });
    }
    const saved = await this.findBookingWithRelations({ id: booking.id });
    return this.toDetail(saved!);
  }

  async pay(
    id: string,
    user: AuthenticatedUser,
    options: {
      confirmedPriceIrr?: Irr;
      promoCode?: string;
      paymentMethod?: PaymentMethod;
    } = {},
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const prior = await this.payIdempotencyRepo.findOneBy({
        idempotencyKey,
      });
      if (prior) {
        if (prior.bookingId !== id || prior.userId !== user.id) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'کلید یکتایی پرداخت برای رزرو دیگری استفاده شده است.',
          });
        }
        const priorBooking = await this.findBookingWithRelations({
          id: prior.bookingId,
        });
        return {
          priceChanged: false as const,
          booking: this.toDetail(await this.materializeExpiry(priorBooking!)),
        };
      }
    }

    const booking = await this.getOwnedBooking(id, user);
    if (booking.status === 'EXPIRED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          'مهلت نگهداری این رزرو به پایان رسیده است. لطفاً دوباره رزرو کنید.',
      });
    }
    if (booking.status === 'TICKETED' || booking.status === 'PAID') {
      if (idempotencyKey) {
        return {
          priceChanged: false as const,
          booking: this.toDetail(await this.materializeExpiry(booking)),
        };
      }
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این رزرو قبلاً پرداخت شده است.',
      });
    }
    if (booking.status !== 'HELD') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این رزرو قابل پرداخت نیست.',
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
          this.bookingRepo.manager,
          booking.flightInstanceId,
          booking.cabin,
        );
    const bookingPassengerCount = BigInt(booking.passengers.length);
    const currentTaxIrr: Irr =
      (currentFareClass?.taxIrr ?? 0n) * bookingPassengerCount;
    const currentPriceIrr: Irr = isLocked
      ? booking.priceIrr
      : (await getCabinPrice(
          this.bookingRepo.manager,
          booking.flightInstanceId,
          booking.cabin,
        )) *
          bookingPassengerCount +
        currentTaxIrr +
        booking.extrasIrr;

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
      const existingRecon = await this.reconciliationRepo.findOne({
        where: { bookingId: id },
        order: { createdAt: 'DESC' },
      });
      if (existingRecon) {
        gatewayRefId = existingRecon.gatewayRefId;
        reconciliationId = existingRecon.id;
      } else {
        const { authority } = await this.gateway.request(currentPriceIrr, id);
        const verified = await this.gateway.verify(authority, currentPriceIrr);
        if (!verified.ok) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'پرداخت از سوی درگاه تأیید نشد. مبلغی کسر نشده است.',
          });
        }
        gatewayRefId = verified.refId;
        const reconciliation = await this.reconciliationRepo.save(
          this.reconciliationRepo.create({
            bookingId: id,
            gatewayRefId: verified.refId,
            amountIrr: currentPriceIrr,
          }),
        );
        reconciliationId = reconciliation.id;
      }
    }

    const paid = await this.bookingRepo.manager.transaction(async (tx) => {
      let finalPriceIrr = currentPriceIrr;
      let discountIrr: Irr = 0n;
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
      // each guarded so a concurrent double-pay hits affected===0 and 409s.
      const captured = await tx.update(
        Booking,
        { id, status: 'HELD' },
        { status: 'PAID', priceIrr: finalPriceIrr },
      );
      if ((captured.affected ?? 0) === 0) {
        const latestRaw = await this.bookingWithFlightQuery(tx)
          .where('b.id = :id', { id })
          .getOneOrFail();
        const latest = await this.loadBookingRelations(latestRaw, tx);
        if (latest.status === 'TICKETED' || latest.status === 'PAID') {
          return { booking: latest, discountIrr: 0n };
        }
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این رزرو قبلاً پرداخت شده است.',
        });
      }
      const issued = await tx.update(
        Booking,
        { id, status: 'PAID' },
        { status: 'TICKETED' },
      );
      if ((issued.affected ?? 0) === 0) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'صدور بلیط ناموفق بود.',
        });
      }

      if (isLocked) {
        await tx.update(
          PriceLock,
          { id: booking.priceLock!.id },
          { status: 'USED' },
        );
      }

      if (reconciliationId) {
        await tx.update(
          PaymentReconciliation,
          { id: reconciliationId },
          { status: 'RESOLVED', resolvedAt: new Date() },
        );
      }

      await tx.save(
        tx.create(LedgerEntry, {
          bookingId: id,
          type: 'SALE',
          signedAmountIrr: finalPriceIrr,
          createdById: user.id,
        }),
      );

      // Real money spent (gateway/wallet) earns points; redeeming points to
      // pay never earns points back (no redeem-to-earn loophole).
      if (member && paymentMethod !== 'POINTS') {
        await this.clubPoints.earnForPurchase(tx, member.id, finalPriceIrr, id);
      }

      if (booking.userId) {
        await this.customerReferrals.processFirstTicketedBooking(
          tx,
          booking.userId,
          id,
        );
      }

      const finalRaw = await this.bookingWithFlightQuery(tx)
        .where('b.id = :id', { id })
        .getOneOrFail();
      return {
        booking: await this.loadBookingRelations(finalRaw, tx),
        discountIrr,
      };
    });

    if (idempotencyKey) {
      await this.payIdempotencyRepo
        .save(
          this.payIdempotencyRepo.create({
            idempotencyKey,
            bookingId: id,
            userId: user.id,
          }),
        )
        .catch(() => undefined);
    }

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

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { TypeORMService } from '../../typeorm/typeorm.service';
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
import { materializeFlownBookings } from '../flights/flight-lifecycle.util';
import { SearchService } from '../booking-engine/search.service';
import { ZERO_IRR, pctOfIrr, subIrr } from '../../common/money';
import type { Irr } from '../../common/money';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type {
  FinalizeLockDto,
  IssuePnrDto,
  ListPnrQueryDto,
  ListReservationFlightsQueryDto,
  SearchFlightsQueryDto,
} from './dto/reservation.dtos';

/** No canonical public-site fare table exists yet — a documented flat
 * fallback (never invented dynamic pricing) when a flight instance has no
 * Phase 6 registered price. */
const FALLBACK_PRICE_IRR: Irr = 38_000_000n;

function generatePnr(): string {
  return `BJ${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

@Injectable()
export class PnrService {
  constructor(
    private readonly typeorm: TypeORMService,
    private readonly audit: AuditService,
    private readonly searchService: SearchService,
  ) {}

  private async getBookingOrThrow(pnr: string) {
    const booking = await this.typeorm.booking.findUnique({
      where: { pnr },
      include: {
        passengers: true,
        flightInstance: { include: { flight: { include: { route: true } } } },
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'رزرو با این کد PNR یافت نشد.',
      });
    }
    return booking;
  }

  async list(query: ListPnrQueryDto) {
    await materializeFlownBookings(this.typeorm);
    const bookings = await this.typeorm.booking.findMany({
      where: query.q
        ? {
            OR: [
              { pnr: { contains: query.q, mode: 'insensitive' } },
              {
                passengers: {
                  some: {
                    fullName: { contains: query.q, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : undefined,
      include: {
        passengers: true,
        flightInstance: { include: { flight: { include: { route: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const groups = new Map<
      string,
      {
        flightInstanceId: string;
        flightNo: string;
        route: string;
        departureAt: Date;
        rows: unknown[];
      }
    >();
    for (const b of bookings) {
      const key = b.flightInstanceId;
      if (!groups.has(key)) {
        groups.set(key, {
          flightInstanceId: key,
          flightNo: b.flightInstance.flight.flightNo,
          route: `${b.flightInstance.flight.route.originCode} → ${b.flightInstance.flight.route.destCode}`,
          departureAt: b.flightInstance.departureAt,
          rows: [],
        });
      }
      groups.get(key)!.rows.push({
        pnr: b.pnr,
        passenger: b.passengers[0]?.fullName ?? '—',
        channel: b.channel,
        status: b.status,
      });
    }

    return Array.from(groups.values()).sort(
      (a, b) => b.departureAt.getTime() - a.departureAt.getTime(),
    );
  }

  async detail(pnr: string) {
    await materializeFlownBookings(this.typeorm);
    const b = await this.getBookingOrThrow(pnr);
    const passenger = b.passengers[0];
    return {
      pnr: b.pnr,
      status: b.status,
      channel: b.channel,
      priceIrr: b.priceIrr,
      flightNo: b.flightInstance.flight.flightNo,
      originCode: b.flightInstance.flight.route.originCode,
      destCode: b.flightInstance.flight.route.destCode,
      departureAt: b.flightInstance.departureAt,
      arrivalAt: b.flightInstance.arrivalAt,
      flightInstanceId: b.flightInstanceId,
      passenger: passenger
        ? { fullName: passenger.fullName, seatCode: passenger.seatCode }
        : null,
    };
  }

  async changeSeat(actor: AuthenticatedUser, pnr: string, seatCode: string) {
    const booking = await this.getBookingOrThrow(pnr);
    if (booking.status === 'CANCELLED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این رزرو لغو شده است و قابل تغییر نیست.',
      });
    }
    const map = await this.typeorm.aircraftSeatMap.findUnique({
      where: { aircraftType: resolveAircraftType(booking.flightInstance) },
    });
    if (!map || !isKnownSeat(map, seatCode)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'این شماره صندلی در این هواپیما معتبر نیست.',
      });
    }

    await this.typeorm.$transaction(async (tx) => {
      // Lock this flight instance's row so two concurrent changeSeat calls
      // targeting it can't both pass the conflict check before either
      // commits — mirrors the same pattern used in issue().
      await tx.$queryRaw`SELECT "id" FROM "flight_instances" WHERE "id" = ${booking.flightInstanceId} FOR UPDATE`;

      const [soldConflict, lockConflict] = await Promise.all([
        tx.passenger.findFirst({
          where: {
            seatCode,
            bookingId: { not: booking.id },
            booking: {
              flightInstanceId: booking.flightInstanceId,
              status: { not: 'CANCELLED' },
            },
          },
        }),
        tx.seatLock.findFirst({
          where: {
            flightInstanceId: booking.flightInstanceId,
            seatCode,
            releasedAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
      ]);
      if (soldConflict || lockConflict) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این صندلی در حال حاضر در دسترس نیست.',
        });
      }

      await tx.passenger.updateMany({
        where: { bookingId: booking.id },
        data: { seatCode },
      });
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'RESERVATION',
      action: 'تغییر صندلی رزرو',
      detail: `صندلی رزرو ${pnr} توسط ${actor.fullName} به ${seatCode} تغییر کرد.`,
      entityType: 'Booking',
      entityId: booking.id,
    });

    return this.detail(pnr);
  }

  async cancel(actor: AuthenticatedUser, pnr: string) {
    const booking = await this.getBookingOrThrow(pnr);
    if (booking.status === 'CANCELLED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این رزرو قبلاً لغو شده است.',
      });
    }

    await this.typeorm.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'RESERVATION',
      action: 'لغو رزرو',
      detail: `رزرو ${pnr} توسط ${actor.fullName} لغو شد.`,
      entityType: 'Booking',
      entityId: booking.id,
    });

    return this.detail(pnr);
  }

  /** Phase 13 Part E — manual no-show override. Only legal once the
   * flight has actually departed (materialized here, not assumed); a
   * TICKETED booking that hasn't been lazily flipped to FLOWN yet is
   * still handled correctly since we flip it first. */
  async markNoShow(actor: AuthenticatedUser, pnr: string) {
    const booking = await this.getBookingOrThrow(pnr);
    await materializeFlownBookings(this.typeorm);
    const refreshed = await this.getBookingOrThrow(pnr);

    if (refreshed.flightInstance.status !== 'DEPARTED') {
      throw new ConflictException({
        code: ErrorCode.FLIGHT_NOT_DEPARTED,
        message: 'این پرواز هنوز انجام نشده است.',
      });
    }
    if (!['TICKETED', 'FLOWN'].includes(refreshed.status)) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این رزرو در وضعیتی نیست که بتوان آن را «عدم حضور» ثبت کرد.',
      });
    }

    await this.typeorm.booking.update({
      where: { id: booking.id },
      data: { status: 'NO_SHOW' },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'RESERVATION',
      action: 'ثبت عدم حضور مسافر',
      detail: `رزرو ${pnr} توسط ${actor.fullName} «عدم حضور» ثبت شد.`,
      entityType: 'Booking',
      entityId: booking.id,
    });

    return this.detail(pnr);
  }

  async search(query: SearchFlightsQueryDto) {
    const dayStart = new Date(query.date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const instances = await this.typeorm.flightInstance.findMany({
      where: {
        status: 'SCHEDULED',
        departureAt: { gte: dayStart, lt: dayEnd },
        flight: {
          route: {
            originCode: { contains: query.origin, mode: 'insensitive' },
            destCode: { contains: query.dest, mode: 'insensitive' },
          },
        },
      },
      include: {
        flight: { include: { route: true, instances: false } },
        pricing: true,
      },
    });

    const results: {
      flightInstanceId: string;
      flightNo: string;
      aircraftType: string;
      originCode: string;
      destCode: string;
      departureAt: Date;
      arrivalAt: Date;
      priceIrr: Irr;
      seatsLeft: number;
    }[] = [];
    for (const instance of instances) {
      const [soldCount, map] = await Promise.all([
        this.typeorm.passenger.count({
          where: {
            seatCode: { not: null },
            booking: {
              flightInstanceId: instance.id,
              status: { not: 'CANCELLED' },
            },
          },
        }),
        this.typeorm.aircraftSeatMap.findUnique({
          where: { aircraftType: resolveAircraftType(instance) },
        }),
      ]);
      const capacity = map ? enumerateSeats(map).length : instance.capacity;
      results.push({
        flightInstanceId: instance.id,
        flightNo: instance.flight.flightNo,
        aircraftType: resolveAircraftType(instance),
        originCode: instance.flight.route.originCode,
        destCode: instance.flight.route.destCode,
        departureAt: instance.departureAt,
        arrivalAt: instance.arrivalAt,
        priceIrr:
          instance.pricing?.status === 'REGISTERED'
            ? instance.pricing.registeredPriceIrr!
            : FALLBACK_PRICE_IRR,
        seatsLeft: Math.max(0, capacity - soldCount),
      });
    }
    return results;
  }

  async issue(actor: AuthenticatedUser, dto: IssuePnrDto) {
    const instance = await this.typeorm.flightInstance.findUnique({
      where: { id: dto.flightInstanceId },
      include: { flight: true },
    });
    if (!instance) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد.',
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
    if (!map || !isKnownSeat(map, dto.seatCode)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'این شماره صندلی در این هواپیما معتبر نیست.',
      });
    }

    const [sold, lock, pricing] = await Promise.all([
      this.typeorm.passenger.findFirst({
        where: {
          seatCode: dto.seatCode,
          booking: {
            flightInstanceId: dto.flightInstanceId,
            status: { not: 'CANCELLED' },
          },
        },
      }),
      this.typeorm.seatLock.findFirst({
        where: {
          flightInstanceId: dto.flightInstanceId,
          seatCode: dto.seatCode,
          releasedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
      this.typeorm.farePricingProposal.findUnique({
        where: { flightInstanceId: dto.flightInstanceId },
      }),
    ]);
    if (sold || lock) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این صندلی در دسترس نیست.',
      });
    }

    // Staff-issued PNRs are channel SYSTEM, same public pool as the online
    // booking engine — must not oversell past what's reserved for agencies/
    // charter (Phase 13).
    const counts = await this.searchService.takenCountsByChannel(
      dto.flightInstanceId,
    );
    const publicPoolLimit =
      instance.capacity -
      instance.charterSeats -
      (instance.agencySeatsAllocated ?? 0);
    if (counts.SYSTEM + counts.MANAGERIAL + 1 > publicPoolLimit) {
      throw new ConflictException({
        code: ErrorCode.POOL_EXHAUSTED,
        message: 'ظرفیت فروش عمومی این پرواز تکمیل شده است.',
      });
    }

    const priceIrr =
      pricing?.status === 'REGISTERED'
        ? pricing.registeredPriceIrr!
        : FALLBACK_PRICE_IRR;
    const nationalId = dto.passengerNationalId
      ? normalizeNationalId(dto.passengerNationalId)
      : undefined;
    if (nationalId && !isValidIranianNationalId(nationalId)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'کد ملی واردشده معتبر نیست.',
      });
    }

    const booking = await this.typeorm.$transaction(async (tx) => {
      // Lock this flight instance's row so two concurrent seat-issuance
      // requests for it can't both pass the sold/lock check below before
      // either has committed — the check + insert must be atomic per seat.
      await tx.$queryRaw`SELECT "id" FROM "flight_instances" WHERE "id" = ${dto.flightInstanceId} FOR UPDATE`;

      const [sold, lock] = await Promise.all([
        tx.passenger.findFirst({
          where: {
            seatCode: dto.seatCode,
            booking: {
              flightInstanceId: dto.flightInstanceId,
              status: { not: 'CANCELLED' },
            },
          },
        }),
        tx.seatLock.findFirst({
          where: {
            flightInstanceId: dto.flightInstanceId,
            seatCode: dto.seatCode,
            releasedAt: null,
          },
        }),
      ]);
      if (sold || lock) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این صندلی در دسترس نیست.',
        });
      }

      const created = await tx.booking.create({
        data: {
          pnr: generatePnr(),
          flightInstanceId: dto.flightInstanceId,
          channel: 'SYSTEM',
          status: 'TICKETED',
          priceIrr,
          passengers: {
            create: {
              fullName: dto.passengerName,
              seatCode: dto.seatCode,
              nationalIdEnc: nationalId ? encryptPii(nationalId) : undefined,
              nationalIdHash: nationalId ? hashPii(nationalId) : undefined,
              mobileEnc: dto.passengerMobile
                ? encryptPii(dto.passengerMobile)
                : undefined,
            },
          },
        },
      });
      await tx.ledgerEntry.create({
        data: {
          bookingId: created.id,
          type: 'SALE',
          signedAmountIrr: priceIrr,
        },
      });
      return created;
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'RESERVATION',
      action: 'صدور دستی PNR',
      detail: `رزرو ${booking.pnr} برای «${dto.passengerName}» توسط ${actor.fullName} صادر شد.`,
      entityType: 'Booking',
      entityId: booking.id,
    });

    return this.detail(booking.pnr);
  }

  /** Phase 13 Part D — turns an APPROVED, not-yet-expired managerial
   * SeatLock into a real TICKETED booking, priced per the lock's
   * classification (FREE/DISCOUNTED/PAYABLE). Reuses this service's own
   * manual-issuance pricing fallback and PII handling; taxIrr is left at
   * 0 like every other manual-issuance path (see docs/DB_SCHEMA.md). */
  async finalizeLock(
    actor: AuthenticatedUser,
    lockId: string,
    dto: FinalizeLockDto,
  ) {
    const lock = await this.typeorm.seatLock.findUnique({
      where: { id: lockId },
    });
    if (!lock) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'لاک صندلی یافت نشد.',
      });
    }
    if (lock.releasedAt || lock.expiresAt <= new Date()) {
      // Self-heal an expired-but-not-yet-released lock, same as the
      // seatmap request path — see docs/DB_SCHEMA.md Phase 13 Part D.
      await this.typeorm.seatLock.updateMany({
        where: { id: lockId, releasedAt: null, expiresAt: { lte: new Date() } },
        data: { releasedAt: new Date() },
      });
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این لاک آزاد شده یا منقضی شده و قابل صدور بلیط نیست.',
      });
    }
    if (lock.approvalStatus !== 'APPROVED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این درخواست هنوز تأیید نشده است.',
      });
    }

    const sold = await this.typeorm.passenger.findFirst({
      where: {
        seatCode: lock.seatCode,
        booking: {
          flightInstanceId: lock.flightInstanceId,
          status: { not: 'CANCELLED' },
        },
      },
    });
    if (sold) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این صندلی در دسترس نیست.',
      });
    }

    const pricing = await this.typeorm.farePricingProposal.findUnique({
      where: { flightInstanceId: lock.flightInstanceId },
    });
    const basePriceIrr =
      pricing?.status === 'REGISTERED'
        ? pricing.registeredPriceIrr!
        : FALLBACK_PRICE_IRR;
    const priceIrr: Irr =
      lock.classification === 'FREE'
        ? ZERO_IRR
        : lock.classification === 'DISCOUNTED'
          ? subIrr(basePriceIrr, pctOfIrr(basePriceIrr, lock.discountPct ?? 0))
          : basePriceIrr;

    const nationalId = dto.passengerNationalId
      ? normalizeNationalId(dto.passengerNationalId)
      : undefined;
    if (nationalId && !isValidIranianNationalId(nationalId)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'کد ملی واردشده معتبر نیست.',
      });
    }

    const booking = await this.typeorm.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          pnr: generatePnr(),
          flightInstanceId: lock.flightInstanceId,
          channel: 'SYSTEM',
          status: 'TICKETED',
          priceIrr,
          passengers: {
            create: {
              fullName: dto.passengerName,
              seatCode: lock.seatCode,
              nationalIdEnc: nationalId ? encryptPii(nationalId) : undefined,
              nationalIdHash: nationalId ? hashPii(nationalId) : undefined,
              mobileEnc: dto.passengerMobile
                ? encryptPii(dto.passengerMobile)
                : undefined,
            },
          },
        },
      });
      await tx.ledgerEntry.create({
        data: {
          bookingId: created.id,
          type: 'SALE',
          signedAmountIrr: priceIrr,
        },
      });
      await tx.seatLock.update({
        where: { id: lockId },
        data: { releasedAt: new Date(), bookingId: created.id },
      });
      return created;
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'RESERVATION',
      action: 'صدور بلیط از لاک مدیریتی',
      detail: `رزرو ${booking.pnr} از لاک صندلی ${lock.seatCode} توسط ${actor.fullName} صادر شد.`,
      entityType: 'Booking',
      entityId: booking.id,
    });

    return this.detail(booking.pnr);
  }

  /**
   * «پروازها» sub-tab of سامانه رزرواسیون/هواپیما — SCHEDULED instances
   * with sold/locked/free counts so staff can open a seat map.
   * Returns one shape covering CEO/Senior/IT/Board Chair tables:
   * Persian `route`, city fields, and IT occupancy/status keys.
   */
  async listFlights(query: ListReservationFlightsQueryDto | string = {}) {
    const q = (typeof query === 'string' ? query : query.q)?.trim();
    await materializeFlownBookings(this.typeorm);
    const airports = await this.typeorm.airport.findMany({
      select: { code: true, cityFa: true },
    });
    const cityByCode = new Map(airports.map((a) => [a.code, a.cityFa]));

    // Include past-dated SCHEDULED rows too — the seed (and some E2E
    // fixtures) keep deliberately-past "SCHEDULED" instances for demos;
    // staff still need to open their seat maps. Prefer soonest first.
    const instances = await this.typeorm.flightInstance.findMany({
      where: { status: 'SCHEDULED' },
      include: {
        flight: { include: { route: true } },
      },
      orderBy: { departureAt: 'asc' },
      take: 120,
    });

    const qLower = q?.toLowerCase();
    const filtered = qLower
      ? instances.filter((instance) => {
          const originCode = instance.flight.route.originCode;
          const destCode = instance.flight.route.destCode;
          const origin = cityByCode.get(originCode) ?? originCode;
          const dest = cityByCode.get(destCode) ?? destCode;
          const hay =
            `${instance.flight.flightNo} ${originCode} ${destCode} ${origin} ${dest} ${instance.aircraftTypeOverride ?? instance.flight.aircraftType}`.toLowerCase();
          return hay.includes(qLower);
        })
      : instances;
    const limited = filtered.slice(0, 60);

    const now = new Date();
    const rows = await Promise.all(
      limited.map(async (instance) => {
        const aircraftType = resolveAircraftType(instance);
        const map = await this.typeorm.aircraftSeatMap.findUnique({
          where: { aircraftType },
        });
        const capacity = map ? enumerateSeats(map).length : instance.capacity;
        const [soldCount, lockedCount] = await Promise.all([
          this.typeorm.passenger.count({
            where: {
              seatCode: { not: null },
              booking: {
                flightInstanceId: instance.id,
                status: { not: 'CANCELLED' },
              },
            },
          }),
          this.typeorm.seatLock.count({
            where: {
              flightInstanceId: instance.id,
              releasedAt: null,
              expiresAt: { gt: now },
            },
          }),
        ]);
        const originCode = instance.flight.route.originCode;
        const destCode = instance.flight.route.destCode;
        const originCityFa = cityByCode.get(originCode) ?? originCode;
        const destCityFa = cityByCode.get(destCode) ?? destCode;
        const occupancyPct =
          capacity > 0 ? Math.round((soldCount / capacity) * 100) : 0;
        const statusKey =
          occupancyPct >= 100
            ? 'FULL'
            : occupancyPct >= 90
              ? 'NEAR_FULL'
              : 'SELLING';
        return {
          flightInstanceId: instance.id,
          flightNo: instance.flight.flightNo,
          aircraftType,
          originCode,
          destCode,
          originCityFa,
          destCityFa,
          route: `${originCityFa} ← ${destCityFa}`,
          departureAt: instance.departureAt,
          capacity,
          sold: soldCount,
          soldCount,
          lockedCount,
          freeCount: Math.max(0, capacity - soldCount - lockedCount),
          occupancyPct,
          statusKey,
        };
      }),
    );
    return rows;
  }

  async dashboardStats() {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const pnrStoreStarted = Date.now();
    const [todayCount, activePnrCount, soldSeats, revenue, channelGroups, toggles] =
      await Promise.all([
        this.typeorm.booking.count({ where: { createdAt: { gte: dayStart } } }),
        this.typeorm.booking.count({
          where: { status: { in: ['HELD', 'PAID', 'TICKETED'] } },
        }),
        this.typeorm.passenger.count({
          where: {
            seatCode: { not: null },
            booking: { status: { not: 'CANCELLED' } },
          },
        }),
        this.typeorm.ledgerEntry.aggregate({
          // Real ticket revenue only — AgenciesService.resetTestDebt
          // reuses type:'SALE' for agency debt-line calibration
          // (bookingId null, amount can be negative); excluded here the
          // same way ReportingService's revenue aggregates exclude it.
          where: { type: 'SALE', bookingId: { not: null } },
          _sum: { signedAmountIrr: true },
        }),
        this.typeorm.booking.groupBy({
          by: ['channel'],
          _count: { _all: true },
          where: { status: { notIn: ['CANCELLED', 'EXPIRED'] } },
        }),
        this.typeorm.internalService.findMany({
          where: { key: { in: ['payment', 'api', 'sms', 'search'] } },
          select: { key: true, enabled: true },
        }),
      ]);
    const pnrStoreLatencyMs = Date.now() - pnrStoreStarted;

    const seatInvStarted = Date.now();
    await this.typeorm.passenger.count({
      where: { seatCode: { not: null } },
    });
    const seatInventoryLatencyMs = Date.now() - seatInvStarted;

    const toggleByKey = new Map(toggles.map((t) => [t.key, t.enabled]));
    const channelLabel: Record<string, string> = {
      SYSTEM: 'فروش مستقیم سایت',
      AGENCY: 'API آژانس‌های همکار',
      CHARTER: 'فروش چارتر',
    };
    const channelColor: Record<string, string> = {
      SYSTEM: '#3b82f6',
      AGENCY: '#34d399',
      CHARTER: '#a855f7',
    };
    const channelTotal = channelGroups.reduce((a, g) => a + g._count._all, 0);
    const channels =
      channelTotal === 0
        ? []
        : channelGroups
            .map((g) => ({
              key: g.channel,
              label: channelLabel[g.channel] ?? g.channel,
              color: channelColor[g.channel] ?? '#6b7b94',
              count: g._count._all,
              pct:
                Math.round((g._count._all / channelTotal) * 1000) / 10,
            }))
            .sort((a, b) => b.count - a.count);

    const svc = (
      name: string,
      fa: string,
      ok: boolean,
      latencyMs: number | null,
    ) => ({
      name,
      fa,
      ok,
      latencyMs,
      statusLabel: ok ? 'سالم' : 'قطع',
    });

    const services = [
      svc('reservation-api', 'سرویس رزرواسیون مرکزی', true, pnrStoreLatencyMs),
      svc('pnr-store', 'پایگاه ذخیره PNR', true, pnrStoreLatencyMs),
      svc(
        'payment-gateway',
        'درگاه پرداخت',
        toggleByKey.get('payment') !== false,
        null,
      ),
      svc(
        'agency-api',
        'پلتفرم API آژانس‌ها',
        toggleByKey.get('api') !== false,
        null,
      ),
      svc('seat-inventory', 'موجودی صندلی', true, seatInventoryLatencyMs),
      svc(
        'notification-svc',
        'سرویس اعلان و پیامک',
        toggleByKey.get('sms') !== false,
        null,
      ),
    ];

    return {
      todayBookings: todayCount,
      activePnrs: activePnrCount,
      seatsSold: soldSeats,
      revenueIrr: revenue._sum.signedAmountIrr ?? ZERO_IRR,
      channels,
      services,
      servicesStable: services.every((s) => s.ok),
    };
  }

  /** Agencies that already hold an API key — design «دسترسی آژانس‌ها». */
  async agencyApiAccess() {
    const keys = await this.typeorm.agencyApiKey.findMany({
      include: { agency: { include: { user: { select: { fullName: true } } } } },
      orderBy: { activatedAt: 'desc' },
    });
    return keys.map((k) => {
      const name = k.agency.user.fullName;
      const initials = name.replace(/\s+/g, '').slice(0, 2) || '؟';
      return {
        id: k.id,
        agencyId: k.agencyId,
        name,
        initials,
        // Raw key is never stored — only an opaque hint from the key id.
        keyHint: `bjk_••••${k.id.replace(/-/g, '').slice(0, 4)}`,
        callCount: k.callCount,
        status: k.status,
      };
    });
  }

  /**
   * Non-production only: a fresh, unambiguous SCHEDULED instance for E2E
   * runs to search/lock/issue against, so tests never depend on which of
   * the seed's historical/demo instances happens to sort first. Always
   * 404s in production (enforced here AND by the controller).
   */
  async createTestInstance() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'یافت نشد.',
      });
    }
    // Persistent E2E databases also contain synthetic AAA/BBB-style routes
    // from lower-level tests. Pick a route whose codes exist in the public
    // airport selector or the browser journey cannot select the fresh
    // instance even though it was created successfully.
    const airportCodes = (
      await this.typeorm.airport.findMany({ select: { code: true } })
    ).map((airport) => airport.code);
    const aircraftTypes = (
      await this.typeorm.aircraftSeatMap.findMany({
        select: { aircraftType: true },
      })
    ).map((seatMap) => seatMap.aircraftType);
    const flight = await this.typeorm.flight.findFirstOrThrow({
      where: {
        aircraftType: { in: aircraftTypes },
        route: {
          originCode: { in: airportCodes },
          destCode: { in: airportCodes },
        },
      },
    });
    // Wide random jitter (25-125 days out) so repeated E2E runs practically
    // never collide on the same calendar day and confuse the date search.
    const daysAhead = 25 + Math.floor(Math.random() * 100);
    const departureAt = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    return this.typeorm.flightInstance.create({
      data: {
        flightId: flight.id,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 3 * 60 * 60 * 1000),
        capacity: 180,
        charterSeats: 60,
        status: 'SCHEDULED',
      },
      include: { flight: { include: { route: true } } },
    });
  }
}

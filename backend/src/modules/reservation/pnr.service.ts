import {
  BadRequestException,
  ConflictException,
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
import { enumerateSeats, isKnownSeat } from './seat-layout';
import { resolveAircraftType } from '../flights/aircraft-type.util';
import { SearchService } from '../booking-engine/search.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type {
  FinalizeLockDto,
  IssuePnrDto,
  ListPnrQueryDto,
  SearchFlightsQueryDto,
} from './dto/reservation.dtos';

/** No canonical public-site fare table exists yet — a documented flat
 * fallback (never invented dynamic pricing) when a flight instance has no
 * Phase 6 registered price. */
const FALLBACK_PRICE_IRR = 38_000_000;

function generatePnr(): string {
  return `BJ${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

@Injectable()
export class PnrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly searchService: SearchService,
  ) {}

  private async getBookingOrThrow(pnr: string) {
    const booking = await this.prisma.booking.findUnique({
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
    const bookings = await this.prisma.booking.findMany({
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
    const map = await this.prisma.aircraftSeatMap.findUnique({
      where: { aircraftType: resolveAircraftType(booking.flightInstance) },
    });
    if (!map || !isKnownSeat(map, seatCode)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'این شماره صندلی در این هواپیما معتبر نیست.',
      });
    }

    const [soldConflict, lockConflict] = await Promise.all([
      this.prisma.passenger.findFirst({
        where: {
          seatCode,
          bookingId: { not: booking.id },
          booking: {
            flightInstanceId: booking.flightInstanceId,
            status: { not: 'CANCELLED' },
          },
        },
      }),
      this.prisma.seatLock.findFirst({
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

    await this.prisma.passenger.updateMany({
      where: { bookingId: booking.id },
      data: { seatCode },
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

    await this.prisma.booking.update({
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

  async search(query: SearchFlightsQueryDto) {
    const dayStart = new Date(query.date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const instances = await this.prisma.flightInstance.findMany({
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
      priceIrr: number;
      seatsLeft: number;
    }[] = [];
    for (const instance of instances) {
      const [soldCount, map] = await Promise.all([
        this.prisma.passenger.count({
          where: {
            seatCode: { not: null },
            booking: {
              flightInstanceId: instance.id,
              status: { not: 'CANCELLED' },
            },
          },
        }),
        this.prisma.aircraftSeatMap.findUnique({
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
    const instance = await this.prisma.flightInstance.findUnique({
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
    const map = await this.prisma.aircraftSeatMap.findUnique({
      where: { aircraftType: resolveAircraftType(instance) },
    });
    if (!map || !isKnownSeat(map, dto.seatCode)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'این شماره صندلی در این هواپیما معتبر نیست.',
      });
    }

    const [sold, lock, pricing] = await Promise.all([
      this.prisma.passenger.findFirst({
        where: {
          seatCode: dto.seatCode,
          booking: {
            flightInstanceId: dto.flightInstanceId,
            status: { not: 'CANCELLED' },
          },
        },
      }),
      this.prisma.seatLock.findFirst({
        where: {
          flightInstanceId: dto.flightInstanceId,
          seatCode: dto.seatCode,
          releasedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
      this.prisma.farePricingProposal.findUnique({
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

    const booking = await this.prisma.$transaction(async (tx) => {
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
    const lock = await this.prisma.seatLock.findUnique({
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
      await this.prisma.seatLock.updateMany({
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

    const sold = await this.prisma.passenger.findFirst({
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

    const pricing = await this.prisma.farePricingProposal.findUnique({
      where: { flightInstanceId: lock.flightInstanceId },
    });
    const basePriceIrr =
      pricing?.status === 'REGISTERED'
        ? pricing.registeredPriceIrr!
        : FALLBACK_PRICE_IRR;
    const priceIrr =
      lock.classification === 'FREE'
        ? 0
        : lock.classification === 'DISCOUNTED'
          ? basePriceIrr -
            Math.round((basePriceIrr * (lock.discountPct ?? 0)) / 100)
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

    const booking = await this.prisma.$transaction(async (tx) => {
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

  async dashboardStats() {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const [todayCount, activePnrCount, soldSeats, revenue] = await Promise.all([
      this.prisma.booking.count({ where: { createdAt: { gte: dayStart } } }),
      this.prisma.booking.count({
        where: { status: { in: ['HELD', 'PAID', 'TICKETED'] } },
      }),
      this.prisma.passenger.count({
        where: {
          seatCode: { not: null },
          booking: { status: { not: 'CANCELLED' } },
        },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { type: 'SALE' },
        _sum: { signedAmountIrr: true },
      }),
    ]);

    return {
      todayBookings: todayCount,
      activePnrs: activePnrCount,
      seatsSold: soldSeats,
      revenueIrr: revenue._sum.signedAmountIrr ?? 0,
    };
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
    const flight = await this.prisma.flight.findFirstOrThrow();
    // Wide random jitter (25-125 days out) so repeated E2E runs practically
    // never collide on the same calendar day and confuse the date search.
    const daysAhead = 25 + Math.floor(Math.random() * 100);
    const departureAt = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    return this.prisma.flightInstance.create({
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

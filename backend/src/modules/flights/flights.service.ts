import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RRule } from 'rrule';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import { enumerateSeats } from '../reservation/seat-layout';
import { resolveAircraftType } from './aircraft-type.util';
import {
  PRICE_SUGGESTION_PROVIDER,
  type PriceSuggestionProvider,
} from '../ai/price-suggestion.provider';
import type { PersistedAiSuggestion } from '../pricing/pricing.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { Prisma } from '../../../generated/prisma/client';

/** SCHEDULED instances departing beyond this window belong to the
 * پروازهای آینده sub-tab; the rest are پروازهای فعال. */
const FUTURE_WINDOW_DAYS = 7;

/** Statuses that count as a sold seat (design: «صندلی فروخته‌شده»). */
const SOLD_STATUSES = ['PAID', 'TICKETED'] as const;

type InstanceWithFlight = Prisma.FlightInstanceGetPayload<{
  include: { flight: { include: { route: true } } };
}>;

@Injectable()
export class FlightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(PRICE_SUGGESTION_PROVIDER)
    private readonly priceSuggestions: PriceSuggestionProvider,
  ) {}

  private async soldByInstance(
    instanceIds: string[],
  ): Promise<Map<string, number>> {
    if (instanceIds.length === 0) return new Map();
    const rows = await this.prisma.booking.groupBy({
      by: ['flightInstanceId'],
      where: {
        flightInstanceId: { in: instanceIds },
        status: { in: [...SOLD_STATUSES] },
      },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.flightInstanceId, r._count._all]));
  }

  /** ⚑ Derived status per docs — the mocks' hardcoded strings mapped to
   * real state: CANCELLED→لغو شده; sold==cap→تکمیل; sold>0→در حال فروش;
   * else فعال. */
  private derivedStatus(
    status: string,
    sold: number,
    capacity: number,
  ): 'ACTIVE' | 'SELLING' | 'FULL' | 'CANCELLED' {
    if (status === 'CANCELLED') return 'CANCELLED';
    if (capacity > 0 && sold >= capacity) return 'FULL';
    if (sold > 0) return 'SELLING';
    return 'ACTIVE';
  }

  private baseRow(i: InstanceWithFlight, sold: number) {
    return {
      id: i.id,
      flightNo: i.flight.flightNo,
      originCode: i.flight.route.originCode,
      destCode: i.flight.route.destCode,
      departureAt: i.departureAt.toISOString(),
      capacity: i.capacity,
      charterSeats: i.charterSeats,
      sold,
      basePriceIrr: i.basePriceIrr,
    };
  }

  async overview() {
    const futureCutoff = new Date(
      Date.now() + FUTURE_WINDOW_DAYS * 24 * 3_600_000,
    );
    const instances = await this.prisma.flightInstance.findMany({
      include: { flight: { include: { route: true } } },
      orderBy: { departureAt: 'asc' },
    });
    const sold = await this.soldByInstance(instances.map((i) => i.id));

    const scheduled = instances.filter(
      (i) => i.status === 'SCHEDULED' || i.status === 'CANCELLED',
    );
    const activeRows = scheduled.filter(
      (i) => i.departureAt <= futureCutoff || (sold.get(i.id) ?? 0) > 0,
    );
    const futureRows = scheduled.filter(
      (i) =>
        i.status === 'SCHEDULED' &&
        i.departureAt > futureCutoff &&
        (sold.get(i.id) ?? 0) === 0,
    );

    const active = activeRows.map((i) => {
      const s = sold.get(i.id) ?? 0;
      return {
        ...this.baseRow(i, s),
        derivedStatus: this.derivedStatus(i.status, s, i.capacity),
      };
    });

    const future = futureRows.map((i) => ({
      ...this.baseRow(i, sold.get(i.id) ?? 0),
      agencySeatsAllocated: i.agencySeatsAllocated,
      aiSuggestion: i.aiSuggestion as PersistedAiSuggestion | null,
    }));

    const completed = await this.completedReport();

    const nonCancelled = active.filter((r) => r.derivedStatus !== 'CANCELLED');
    const soldTotal = nonCancelled.reduce((a, r) => a + r.sold, 0);
    const capTotal = nonCancelled.reduce((a, r) => a + r.capacity, 0);
    const kpis = {
      activeCount: nonCancelled.length,
      soldSeats: soldTotal,
      meanOccupancyPct:
        capTotal > 0 ? Math.round((soldTotal / capTotal) * 100) : 0,
    };

    return { kpis, active, completed, future };
  }

  /** ⚑ Real per-channel figures from bookings — no fabricated margins.
   * سود/ضرر compare the achieved average rate to the base rate. */
  private async completedReport() {
    const departed = await this.prisma.flightInstance.findMany({
      where: { status: 'DEPARTED' },
      include: { flight: { include: { route: true } } },
      orderBy: { departureAt: 'desc' },
      take: 30,
    });
    const byChannel = await this.prisma.booking.groupBy({
      by: ['flightInstanceId', 'channel'],
      where: {
        flightInstanceId: { in: departed.map((d) => d.id) },
        status: { in: [...SOLD_STATUSES] },
      },
      _count: { _all: true },
      _sum: { priceIrr: true },
    });

    const rows = departed.map((i) => {
      const channels = { SYSTEM: 0, CHARTER: 0, AGENCY: 0 } as Record<
        'SYSTEM' | 'CHARTER' | 'AGENCY',
        number
      >;
      let tickets = 0;
      let revenueIrr = 0;
      for (const c of byChannel.filter((b) => b.flightInstanceId === i.id)) {
        channels[c.channel] = c._sum.priceIrr ?? 0;
        tickets += c._count._all;
        revenueIrr += c._sum.priceIrr ?? 0;
      }
      const base = i.basePriceIrr ?? 0;
      const avgIrr = tickets > 0 ? Math.round(revenueIrr / tickets) : 0;
      const delta = (avgIrr - base) * tickets;
      return {
        id: i.id,
        flightNo: i.flight.flightNo,
        originCode: i.flight.route.originCode,
        destCode: i.flight.route.destCode,
        departureAt: i.departureAt.toISOString(),
        tickets,
        basePriceIrr: base,
        avgPriceIrr: avgIrr,
        revenueIrr,
        channelRevenueIrr: channels,
        profitIrr: Math.max(delta, 0),
        lossIrr: Math.max(-delta, 0),
      };
    });

    return {
      rows,
      kpis: {
        totalSalesIrr: rows.reduce((a, r) => a + r.revenueIrr, 0),
        totalProfitIrr: rows.reduce((a, r) => a + r.profitIrr, 0),
        totalTickets: rows.reduce((a, r) => a + r.tickets, 0),
        flightCount: rows.length,
      },
    };
  }

  async airports() {
    return this.prisma.airport.findMany({ orderBy: { cityFa: 'asc' } });
  }

  async create(
    actor: AuthenticatedUser,
    dto: {
      originCode: string;
      destCode: string;
      flightNo: string;
      departureAt: string;
      capacity: number;
      basePriceIrr: number;
    },
  ) {
    if (dto.originCode === dto.destCode) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'مبدأ و مقصد نمی‌توانند یکسان باشند.',
      });
    }
    const airports = await this.prisma.airport.findMany({
      where: { code: { in: [dto.originCode, dto.destCode] } },
    });
    if (airports.length !== 2) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'فرودگاه انتخاب‌شده معتبر نیست.',
      });
    }
    const departureAt = new Date(dto.departureAt);
    if (Number.isNaN(departureAt.getTime()) || departureAt <= new Date()) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'تاریخ و ساعت پرواز باید در آینده باشد.',
      });
    }

    const route = await this.prisma.route.upsert({
      where: {
        originCode_destCode: {
          originCode: dto.originCode,
          destCode: dto.destCode,
        },
      },
      update: {},
      create: { originCode: dto.originCode, destCode: dto.destCode },
    });

    const existingFlight = await this.prisma.flight.findUnique({
      where: { flightNo: dto.flightNo },
    });
    if (existingFlight && existingFlight.routeId !== route.id) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این شماره پرواز قبلاً برای مسیر دیگری ثبت شده است.',
      });
    }
    const flight =
      existingFlight ??
      (await this.prisma.flight.create({
        data: {
          flightNo: dto.flightNo,
          routeId: route.id,
          aircraftType: 'Airbus A320',
        },
      }));

    const instance = await this.prisma.flightInstance.create({
      data: {
        flightId: flight.id,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + route.durationMin * 60_000),
        capacity: dto.capacity,
        charterSeats: 0,
        status: 'SCHEDULED',
        basePriceIrr: dto.basePriceIrr,
      },
      include: { flight: { include: { route: true } } },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'افزودن پرواز جدید',
      detail: `پرواز ${dto.flightNo} (${dto.originCode} ← ${dto.destCode}) توسط ${actor.fullName} ایجاد شد.`,
      entityType: 'FlightInstance',
      entityId: instance.id,
    });

    return { ...this.baseRow(instance, 0), derivedStatus: 'ACTIVE' as const };
  }

  /** Flight detail modal: real channel breakdown from bookings. */
  async detail(id: string) {
    const instance = await this.prisma.flightInstance.findUnique({
      where: { id },
      include: { flight: { include: { route: true } } },
    });
    if (!instance) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد.',
      });
    }
    const byChannel = await this.prisma.booking.groupBy({
      by: ['channel'],
      where: { flightInstanceId: id, status: { in: [...SOLD_STATUSES] } },
      _count: { _all: true },
      _sum: { priceIrr: true },
    });
    const channels = (['SYSTEM', 'CHARTER', 'AGENCY'] as const).map((ch) => {
      const row = byChannel.find((b) => b.channel === ch);
      return {
        channel: ch,
        seats: row?._count._all ?? 0,
        revenueIrr: row?._sum.priceIrr ?? 0,
      };
    });
    const sold = channels.reduce((a, c) => a + c.seats, 0);
    return {
      ...this.baseRow(instance, sold),
      derivedStatus: this.derivedStatus(
        instance.status,
        sold,
        instance.capacity,
      ),
      channels,
      totalRevenueIrr: channels.reduce((a, c) => a + c.revenueIrr, 0),
      occupancyPct:
        instance.capacity > 0
          ? Math.round((sold / instance.capacity) * 100)
          : 0,
    };
  }

  /** نرخ‌گذاری/allocation modal. ⚑ Stores plan figures only — the bookable
   * price stays with Phase 6: for COMMERCIAL the plan also upserts the
   * pricing proposal (still requiring CEO registration). A REGISTERED
   * (locked) proposal blocks re-planning. */
  async plan(
    actor: AuthenticatedUser,
    id: string,
    dto: {
      priceIrr: number;
      agencySeats: number;
      saleStartsAt?: string;
      saleEndsAt?: string;
    },
  ) {
    const instance = await this.prisma.flightInstance.findUnique({
      where: { id },
      include: { pricing: true },
    });
    if (!instance || instance.status !== 'SCHEDULED') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز برنامه‌ریزی‌شده یافت نشد.',
      });
    }
    if (instance.pricing?.status === 'REGISTERED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          'قیمت این پرواز توسط مدیر عامل تأیید و قفل شده است و دیگر قابل تغییر نیست.',
      });
    }
    const agencyMax = instance.capacity - instance.charterSeats;
    if (dto.agencySeats > agencyMax) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `تخصیص آژانس نمی‌تواند از ${agencyMax} صندلی بیشتر باشد.`,
      });
    }

    const updated = await this.prisma.flightInstance.update({
      where: { id },
      data: {
        basePriceIrr: dto.priceIrr,
        agencySeatsAllocated: dto.agencySeats,
        ...(dto.saleStartsAt !== undefined
          ? {
              saleStartsAt: dto.saleStartsAt
                ? new Date(dto.saleStartsAt)
                : null,
            }
          : {}),
        ...(dto.saleEndsAt !== undefined
          ? { saleEndsAt: dto.saleEndsAt ? new Date(dto.saleEndsAt) : null }
          : {}),
      },
    });

    if (actor.role === 'COMMERCIAL_MANAGER') {
      await this.prisma.farePricingProposal.upsert({
        where: { flightInstanceId: id },
        update: { proposedPriceIrr: dto.priceIrr },
        create: {
          flightInstanceId: id,
          basePriceIrr: dto.priceIrr,
          competitorPriceIrr: dto.priceIrr,
          proposedPriceIrr: dto.priceIrr,
          proposedById: actor.id,
        },
      });
    }

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'PRICING',
      action: 'نرخ‌گذاری و تخصیص صندلی پرواز آینده',
      detail: `نرخ برنامه‌ریزی و تخصیص صندلی پرواز توسط ${actor.fullName} ثبت شد.`,
      entityType: 'FlightInstance',
      entityId: id,
      metadata: { priceIrr: dto.priceIrr, agencySeats: dto.agencySeats },
    });

    return {
      id: updated.id,
      basePriceIrr: updated.basePriceIrr,
      agencySeatsAllocated: updated.agencySeatsAllocated,
      directSeats: Math.max(
        updated.capacity - updated.charterSeats - dto.agencySeats,
        0,
      ),
      proposalPending: actor.role === 'COMMERCIAL_MANAGER',
    };
  }

  /** Phase 13: re-points this instance at a different aircraft type/seat
   * map without touching the shared `Flight` row (which would silently
   * change every other instance of the same recurring schedule) — sets
   * `aircraftTypeOverride` instead. Rejects with a shortfall count rather
   * than auto-cancelling/rebooking paying customers, which is a business
   * decision with no design/product guidance anywhere (see DB_SCHEMA.md
   * Phase 13). */
  async changeAircraftType(
    actor: AuthenticatedUser,
    id: string,
    newAircraftType: string,
  ) {
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
    const newMap = await this.prisma.aircraftSeatMap.findUnique({
      where: { aircraftType: newAircraftType },
    });
    if (!newMap) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `نقشهٔ صندلی برای «${newAircraftType}» تعریف نشده است.`,
      });
    }
    const newCapacity = enumerateSeats(newMap).length;

    const [confirmedCount, lockCount] = await Promise.all([
      this.prisma.passenger.count({
        where: {
          seatCode: { not: null },
          booking: {
            flightInstanceId: id,
            status: { in: ['PAID', 'TICKETED'] },
          },
        },
      }),
      this.prisma.seatLock.count({
        where: { flightInstanceId: id, releasedAt: null },
      }),
    ]);
    const confirmedOrLocked = confirmedCount + lockCount;
    if (newCapacity < confirmedOrLocked) {
      const shortfall = confirmedOrLocked - newCapacity;
      throw new ConflictException({
        code: ErrorCode.CAPACITY_BELOW_CONFIRMED,
        message: `ظرفیت هواپیمای جدید (${newCapacity}) کمتر از تعداد رزروهای قطعی/لاک‌شدهٔ فعلی (${confirmedOrLocked}) است — ${shortfall} مسافر مازاد باید ابتدا جابه‌جا یا لغو شود.`,
      });
    }

    const updated = await this.prisma.flightInstance.update({
      where: { id },
      data: { aircraftTypeOverride: newAircraftType, capacity: newCapacity },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'تغییر نوع هواپیمای پرواز',
      detail: `نوع هواپیمای پرواز ${instance.flight.flightNo} از «${resolveAircraftType(instance)}» به «${newAircraftType}» توسط ${actor.fullName} تغییر کرد.`,
      entityType: 'FlightInstance',
      entityId: id,
      metadata: {
        previousAircraftType: resolveAircraftType(instance),
        newAircraftType,
        newCapacity,
      },
    });

    return {
      id: updated.id,
      aircraftType: newAircraftType,
      capacity: updated.capacity,
    };
  }

  /** Advisory ML analysis over the future list (suggestion persisted on the
   * instance; graceful degradation identical to Phase 6). */
  async runAiAnalysis(actor: AuthenticatedUser, requestId?: string) {
    const futureCutoff = new Date(
      Date.now() + FUTURE_WINDOW_DAYS * 24 * 3_600_000,
    );
    const future = await this.prisma.flightInstance.findMany({
      where: { status: 'SCHEDULED', departureAt: { gt: futureCutoff } },
      include: { flight: { include: { route: true } } },
    });
    if (future.length === 0) return { analyzed: 0, available: true };

    const result = await this.priceSuggestions.suggest(
      future.map((i) => ({
        proposal_id: i.id,
        origin_code: i.flight.route.originCode,
        dest_code: i.flight.route.destCode,
        departure_at: i.departureAt.toISOString(),
        base_price_irr: i.basePriceIrr ?? 30_000_000,
        competitor_price_irr: i.basePriceIrr ?? 30_000_000,
        proposed_price_irr: i.basePriceIrr ?? 30_000_000,
        capacity: i.capacity,
        charter_seats: i.charterSeats,
      })),
      requestId,
    );
    if (!result) return { analyzed: 0, available: false };

    const generatedAt = new Date().toISOString();
    for (const s of result.suggestions) {
      const suggestion: PersistedAiSuggestion = {
        priceIrr: s.price_irr,
        reason: s.reason_fa,
        factors: s.factors_fa,
        season: s.season_fa,
        occasion: s.occasion_fa,
        confidence: s.confidence,
        modelVersion: result.model_version,
        generatedAt,
      };
      await this.prisma.flightInstance.update({
        where: { id: s.proposal_id },
        data: { aiSuggestion: suggestion as unknown as Prisma.InputJsonValue },
      });
    }

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'PRICING',
      action: 'تحلیل قیمت‌گذاری پروازهای آینده با هوش مصنوعی',
      detail: `تحلیل هوش مصنوعی برای ${result.suggestions.length} پرواز آینده توسط ${actor.fullName} اجرا شد.`,
      metadata: {
        analyzed: result.suggestions.length,
        modelVersion: result.model_version,
      },
    });

    return { analyzed: result.suggestions.length, available: true };
  }

  // ─── Recurring schedules (CLAUDE.md: Schedule via RRULE) ───────────────

  async createSchedule(
    actor: AuthenticatedUser,
    dto: {
      originCode: string;
      destCode: string;
      flightNo: string;
      rrule: string;
      depTime: string;
      capacity: number;
      daysAhead?: number;
    },
  ) {
    if (dto.originCode === dto.destCode) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'مبدأ و مقصد نمی‌توانند یکسان باشند.',
      });
    }
    const airports = await this.prisma.airport.findMany({
      where: { code: { in: [dto.originCode, dto.destCode] } },
    });
    if (airports.length !== 2) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'فرودگاه انتخاب‌شده معتبر نیست.',
      });
    }
    try {
      RRule.parseString(dto.rrule);
    } catch {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'الگوی تکرار (RRULE) معتبر نیست.',
      });
    }
    const [depHour, depMinute] = dto.depTime.split(':').map(Number);

    const route = await this.prisma.route.upsert({
      where: {
        originCode_destCode: {
          originCode: dto.originCode,
          destCode: dto.destCode,
        },
      },
      update: {},
      create: { originCode: dto.originCode, destCode: dto.destCode },
    });
    const existingFlight = await this.prisma.flight.findUnique({
      where: { flightNo: dto.flightNo },
    });
    if (existingFlight && existingFlight.routeId !== route.id) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این شماره پرواز قبلاً برای مسیر دیگری ثبت شده است.',
      });
    }
    const flight =
      existingFlight ??
      (await this.prisma.flight.create({
        data: {
          flightNo: dto.flightNo,
          routeId: route.id,
          aircraftType: 'Airbus A320',
        },
      }));

    const schedule = await this.prisma.schedule.create({
      data: {
        flightId: flight.id,
        rrule: dto.rrule,
        depHour,
        depMinute,
        durationMin: route.durationMin,
        capacity: dto.capacity,
      },
    });
    const materialized = await this.materializeSchedule(
      schedule.id,
      dto.daysAhead ?? 30,
    );

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'ثبت برنامه تکرارشونده پرواز',
      detail: `برنامه ${dto.flightNo} (${dto.rrule}) با ${materialized} پرواز آینده ثبت شد.`,
      entityType: 'Schedule',
      entityId: schedule.id,
      metadata: { rrule: dto.rrule, materialized },
    });

    return { scheduleId: schedule.id, materialized };
  }

  /**
   * Materializes FlightInstances for the next `daysAhead` days from the
   * schedule's RRULE. Idempotent: @@unique([scheduleId, departureAt]) +
   * skipDuplicates means re-running never doubles instances. depHour/
   * depMinute are UTC (storage is UTC per CLAUDE.md; rendering converts to
   * the airport's IANA tz at the edge).
   */
  async materializeSchedule(scheduleId: string, daysAhead: number) {
    const schedule = await this.prisma.schedule.findUniqueOrThrow({
      where: { id: scheduleId },
    });
    if (!schedule.active) return 0;

    const parsed = RRule.parseString(schedule.rrule);
    const start = new Date();
    const until = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    const rule = new RRule({ ...parsed, dtstart: start });
    const dates = rule.between(start, until, true);

    const rows = dates.map((d) => {
      const departureAt = new Date(
        Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
          schedule.depHour,
          schedule.depMinute,
        ),
      );
      return {
        flightId: schedule.flightId,
        scheduleId: schedule.id,
        departureAt,
        arrivalAt: new Date(
          departureAt.getTime() + schedule.durationMin * 60_000,
        ),
        capacity: schedule.capacity,
        charterSeats: 0,
        status: 'SCHEDULED' as const,
      };
    });
    const created = await this.prisma.flightInstance.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return created.count;
  }

  async listSchedules() {
    const schedules = await this.prisma.schedule.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        flight: { include: { route: true } },
        _count: { select: { instances: true } },
      },
    });
    return schedules.map((s) => ({
      id: s.id,
      flightNo: s.flight.flightNo,
      originCode: s.flight.route.originCode,
      destCode: s.flight.route.destCode,
      rrule: s.rrule,
      depTime: `${String(s.depHour).padStart(2, '0')}:${String(s.depMinute).padStart(2, '0')}`,
      capacity: s.capacity,
      active: s.active,
      instanceCount: s._count.instances,
    }));
  }

  // ── Phase 13 Part B: manageable fare classes ──────────────────────────

  async listFareRules(instanceId: string) {
    const rules = await this.prisma.fareRule.findMany({
      where: { flightInstanceId: instanceId },
      orderBy: [{ cabin: 'asc' }, { priceIrr: 'asc' }],
    });
    return rules;
  }

  /** Physical seat count for one cabin of this instance's (possibly
   * overridden, Phase 13 Part A) aircraft type — the ceiling that
   * seatsAllocated across every fare rule sharing this cabin must never
   * exceed (the user spec's explicit anti-oversell rule for fare classes
   * sharing one physical cabin). */
  private async cabinSeatCount(
    instance: {
      flight: { aircraftType: string };
      aircraftTypeOverride: string | null;
    },
    cabin: 'ECONOMY' | 'BUSINESS',
  ): Promise<number> {
    const map = await this.prisma.aircraftSeatMap.findUnique({
      where: { aircraftType: resolveAircraftType(instance) },
    });
    if (!map) return 0;
    return enumerateSeats(map).filter((s) => s.cabin === cabin).length;
  }

  private validateFareRuleWindow(dto: {
    validFrom?: string;
    validUntil?: string;
  }) {
    if (
      dto.validFrom &&
      dto.validUntil &&
      new Date(dto.validUntil) <= new Date(dto.validFrom)
    ) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'پایان بازه اعتبار باید بعد از شروع آن باشد.',
      });
    }
  }

  async createFareRule(
    actor: AuthenticatedUser,
    instanceId: string,
    dto: {
      cabin: 'ECONOMY' | 'BUSINESS';
      classCode: string;
      priceIrr: number;
      seatsAllocated: number;
      taxIrr?: number;
      refundable?: boolean;
      changeable?: boolean;
      baggageAllowanceKg?: number;
      validFrom?: string;
      validUntil?: string;
      allowedChannels?: ('SYSTEM' | 'CHARTER' | 'AGENCY')[];
    },
  ) {
    const instance = await this.prisma.flightInstance.findUnique({
      where: { id: instanceId },
      include: { flight: true },
    });
    if (!instance) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد.',
      });
    }
    this.validateFareRuleWindow(dto);

    const cabinSeats = await this.cabinSeatCount(instance, dto.cabin);
    const existing = await this.prisma.fareRule.findMany({
      where: { flightInstanceId: instanceId, cabin: dto.cabin },
    });
    const existingTotal = existing.reduce((a, r) => a + r.seatsAllocated, 0);
    if (existingTotal + dto.seatsAllocated > cabinSeats) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `مجموع صندلی تخصیص‌یافته کلاس‌های نرخی (${existingTotal + dto.seatsAllocated}) از ظرفیت کابین ${dto.cabin === 'BUSINESS' ? 'بیزینس' : 'اکونومی'} (${cabinSeats}) بیشتر است.`,
      });
    }

    const created = await this.prisma.fareRule.create({
      data: {
        flightInstanceId: instanceId,
        cabin: dto.cabin,
        classCode: dto.classCode,
        priceIrr: dto.priceIrr,
        seatsAllocated: dto.seatsAllocated,
        taxIrr: dto.taxIrr ?? 0,
        refundable: dto.refundable ?? true,
        changeable: dto.changeable ?? true,
        baggageAllowanceKg: dto.baggageAllowanceKg,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        allowedChannels: dto.allowedChannels ?? [],
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'PRICING',
      action: 'ایجاد کلاس نرخی',
      detail: `کلاس نرخی «${dto.classCode}» برای پرواز ${instance.flight.flightNo} توسط ${actor.fullName} ایجاد شد.`,
      entityType: 'FareRule',
      entityId: created.id,
    });

    return created;
  }

  async updateFareRule(
    actor: AuthenticatedUser,
    instanceId: string,
    ruleId: string,
    dto: {
      priceIrr?: number;
      seatsAllocated?: number;
      taxIrr?: number;
      refundable?: boolean;
      changeable?: boolean;
      baggageAllowanceKg?: number;
      validFrom?: string;
      validUntil?: string;
      allowedChannels?: ('SYSTEM' | 'CHARTER' | 'AGENCY')[];
    },
  ) {
    const rule = await this.prisma.fareRule.findUnique({
      where: { id: ruleId },
      include: { flightInstance: { include: { flight: true } } },
    });
    if (!rule || rule.flightInstanceId !== instanceId) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'کلاس نرخی یافت نشد.',
      });
    }
    this.validateFareRuleWindow({
      validFrom: dto.validFrom ?? rule.validFrom?.toISOString(),
      validUntil: dto.validUntil ?? rule.validUntil?.toISOString(),
    });

    if (dto.seatsAllocated !== undefined) {
      const cabinSeats = await this.cabinSeatCount(
        rule.flightInstance,
        rule.cabin,
      );
      const others = await this.prisma.fareRule.findMany({
        where: {
          flightInstanceId: instanceId,
          cabin: rule.cabin,
          id: { not: ruleId },
        },
      });
      const othersTotal = others.reduce((a, r) => a + r.seatsAllocated, 0);
      if (othersTotal + dto.seatsAllocated > cabinSeats) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: `مجموع صندلی تخصیص‌یافته کلاس‌های نرخی (${othersTotal + dto.seatsAllocated}) از ظرفیت کابین ${rule.cabin === 'BUSINESS' ? 'بیزینس' : 'اکونومی'} (${cabinSeats}) بیشتر است.`,
        });
      }
    }

    const updated = await this.prisma.fareRule.update({
      where: { id: ruleId },
      data: {
        priceIrr: dto.priceIrr,
        seatsAllocated: dto.seatsAllocated,
        taxIrr: dto.taxIrr,
        refundable: dto.refundable,
        changeable: dto.changeable,
        baggageAllowanceKg: dto.baggageAllowanceKg,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        allowedChannels: dto.allowedChannels,
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'PRICING',
      action: 'ویرایش کلاس نرخی',
      detail: `کلاس نرخی «${rule.classCode}» پرواز ${rule.flightInstance.flight.flightNo} توسط ${actor.fullName} ویرایش شد.`,
      entityType: 'FareRule',
      entityId: rule.id,
    });

    return updated;
  }

  async deleteFareRule(
    actor: AuthenticatedUser,
    instanceId: string,
    ruleId: string,
  ) {
    const rule = await this.prisma.fareRule.findUnique({
      where: { id: ruleId },
      include: { flightInstance: { include: { flight: true } } },
    });
    if (!rule || rule.flightInstanceId !== instanceId) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'کلاس نرخی یافت نشد.',
      });
    }
    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        flightInstanceId: instanceId,
        cabin: rule.cabin,
        fareClassCode: rule.classCode,
        status: { in: ['DRAFT', 'HELD', 'PAID', 'TICKETED'] },
      },
    });
    if (activeBooking) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این کلاس نرخی توسط رزروهای فعال استفاده شده و قابل حذف نیست.',
      });
    }

    await this.prisma.fareRule.delete({ where: { id: ruleId } });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'PRICING',
      action: 'حذف کلاس نرخی',
      detail: `کلاس نرخی «${rule.classCode}» پرواز ${rule.flightInstance.flight.flightNo} توسط ${actor.fullName} حذف شد.`,
      entityType: 'FareRule',
      entityId: rule.id,
    });

    return { success: true };
  }

  // ── Phase 13 Part C: per-agency allotments ────────────────────────────

  async listAllotments(instanceId: string) {
    const rows = await this.prisma.agencyAllotment.findMany({
      where: { flightInstanceId: instanceId },
      include: { agency: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    return rows.map((r) => ({
      id: r.id,
      agencyId: r.agencyId,
      agencyName: r.agency.user.fullName,
      seatsAllocated: r.seatsAllocated,
      type: r.type,
      releaseAt: r.releaseAt,
      contractPriceIrr: r.contractPriceIrr,
      createdAt: r.createdAt,
      active: r.type === 'HARD' || !r.releaseAt || r.releaseAt > now,
    }));
  }

  /** Active = counts toward the agencySeatsAllocated cap right now: HARD
   * always counts; SOFT counts only until its releaseAt passes (lazy,
   * same pattern as Booking's HELD→EXPIRED — no cron job). */
  private async activeAllotmentsTotal(
    instanceId: string,
    excludeId?: string,
  ): Promise<number> {
    const now = new Date();
    const rows = await this.prisma.agencyAllotment.findMany({
      where: {
        flightInstanceId: instanceId,
        id: excludeId ? { not: excludeId } : undefined,
        OR: [{ type: 'HARD' }, { releaseAt: null }, { releaseAt: { gt: now } }],
      },
    });
    return rows.reduce((a, r) => a + r.seatsAllocated, 0);
  }

  async createAllotment(
    actor: AuthenticatedUser,
    instanceId: string,
    dto: {
      agencyId: string;
      seatsAllocated: number;
      type?: 'SOFT' | 'HARD';
      releaseAt?: string;
      contractPriceIrr?: number;
    },
  ) {
    const instance = await this.prisma.flightInstance.findUnique({
      where: { id: instanceId },
    });
    if (!instance) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد.',
      });
    }
    const agency = await this.prisma.agencyProfile.findUnique({
      where: { userId: dto.agencyId },
    });
    if (!agency) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'آژانس یافت نشد.',
      });
    }
    if (!instance.agencySeatsAllocated) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message:
          'ابتدا سهمیه کلی آژانس‌ها برای این پرواز را از بخش نرخ‌گذاری تعیین کنید.',
      });
    }

    const existingTotal = await this.activeAllotmentsTotal(instanceId);
    if (existingTotal + dto.seatsAllocated > instance.agencySeatsAllocated) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `مجموع سهمیه‌های تخصیص‌یافته به آژانس‌ها (${existingTotal + dto.seatsAllocated}) از سقف کلی این پرواز (${instance.agencySeatsAllocated}) بیشتر است.`,
      });
    }

    const created = await this.prisma.agencyAllotment.create({
      data: {
        agencyId: dto.agencyId,
        flightInstanceId: instanceId,
        seatsAllocated: dto.seatsAllocated,
        type: dto.type ?? 'HARD',
        releaseAt:
          dto.type === 'SOFT' && dto.releaseAt
            ? new Date(dto.releaseAt)
            : undefined,
        contractPriceIrr: dto.contractPriceIrr,
        createdById: actor.id,
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'تخصیص سهمیه پرواز به آژانس',
      detail: `${dto.seatsAllocated} صندلی برای این پرواز به آژانس تخصیص یافت (نوع: ${dto.type ?? 'HARD'}) توسط ${actor.fullName}.`,
      entityType: 'AgencyAllotment',
      entityId: created.id,
    });

    return created;
  }

  async deleteAllotment(
    actor: AuthenticatedUser,
    instanceId: string,
    allotmentId: string,
  ) {
    const allotment = await this.prisma.agencyAllotment.findUnique({
      where: { id: allotmentId },
    });
    if (!allotment || allotment.flightInstanceId !== instanceId) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'سهمیه یافت نشد.',
      });
    }
    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        flightInstanceId: instanceId,
        agencyId: allotment.agencyId,
        status: { in: ['DRAFT', 'HELD', 'PAID', 'TICKETED'] },
      },
    });
    if (activeBooking) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          'این آژانس رزرو فعالی روی این پرواز دارد و سهمیه قابل حذف نیست.',
      });
    }

    await this.prisma.agencyAllotment.delete({ where: { id: allotmentId } });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'حذف سهمیه آژانس',
      detail: `سهمیه آژانس روی این پرواز توسط ${actor.fullName} حذف شد.`,
      entityType: 'AgencyAllotment',
      entityId: allotmentId,
    });

    return { success: true };
  }
}

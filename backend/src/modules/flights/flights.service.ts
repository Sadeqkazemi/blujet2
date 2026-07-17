import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
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
      meanOccupancyPct: capTotal > 0 ? Math.round((soldTotal / capTotal) * 100) : 0,
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
      derivedStatus: this.derivedStatus(instance.status, sold, instance.capacity),
      channels,
      totalRevenueIrr: channels.reduce((a, c) => a + c.revenueIrr, 0),
      occupancyPct:
        instance.capacity > 0 ? Math.round((sold / instance.capacity) * 100) : 0,
    };
  }

  /** نرخ‌گذاری/allocation modal. ⚑ Stores plan figures only — the bookable
   * price stays with Phase 6: for COMMERCIAL the plan also upserts the
   * pricing proposal (still requiring CEO registration). A REGISTERED
   * (locked) proposal blocks re-planning. */
  async plan(
    actor: AuthenticatedUser,
    id: string,
    dto: { priceIrr: number; agencySeats: number },
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
}

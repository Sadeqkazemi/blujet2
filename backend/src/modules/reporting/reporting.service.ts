import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgenciesService } from '../agencies/agencies.service';
import { ErrorCode } from '../../common/errors';
import { materializeDepartedInstances } from '../flights/flight-lifecycle.util';
import {
  ZERO_IRR,
  absIrr,
  addIrr,
  divRoundBigInt,
  isPositiveIrr,
  subIrr,
} from '../../common/money';
import type { Irr } from '../../common/money';
import {
  Bucket,
  CompletedFlightsSummary,
  FinanceDashboardStats,
  FlightSalesResult,
  KpiResult,
  KpiTrends,
  SalesChartPeriod,
  SalesGranularity,
  TransactionStatusTone,
} from './reporting.types';

const LOW_SALES_WINDOW_HOURS = 72;
const LOW_SALES_OCCUPANCY_THRESHOLD = 0.6;
const FLIGHT_SALES_LIST_LIMIT = 60;

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencies: AgenciesService,
  ) {}

  private buildBuckets(
    granularity: SalesGranularity,
    params: { periodStart?: string; date?: string },
  ): Bucket[] {
    const now = new Date();

    if (
      granularity === 'year' ||
      granularity === 'q6' ||
      granularity === 'q3'
    ) {
      const count = granularity === 'year' ? 12 : granularity === 'q6' ? 6 : 3;
      const buckets: Bucket[] = [];
      for (let i = count - 1; i >= 0; i--) {
        const start = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
        );
        const end = new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
        );
        buckets.push({ key: start.toISOString().slice(0, 10), start, end });
      }
      return buckets;
    }

    if (granularity === 'month') {
      if (!params.periodStart) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'periodStart لازم است.',
        });
      }
      const monthStart = new Date(params.periodStart);
      const daysInMonth = new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
      ).getUTCDate();
      const buckets: Bucket[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const start = new Date(
          Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), d),
        );
        const end = new Date(
          Date.UTC(
            monthStart.getUTCFullYear(),
            monthStart.getUTCMonth(),
            d + 1,
          ),
        );
        buckets.push({ key: start.toISOString().slice(0, 10), start, end });
      }
      return buckets;
    }

    if (granularity === 'day') {
      if (!params.date) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'date لازم است.',
        });
      }
      const start = new Date(params.date);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      return [{ key: start.toISOString().slice(0, 10), start, end }];
    }

    // 'flight' granularity has no date bucket — handled separately by callers.
    return [];
  }

  private async sumByChannel(start: Date, end: Date, flightNo?: string) {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        type: 'SALE',
        // Real ticket revenue only — excludes agency-debt-calibration
        // rows (AgenciesService.resetTestDebt reuses type:'SALE' with no
        // bookingId; see kpis()'s comment for the full explanation).
        bookingId: { not: null },
        occurredAt: { gte: start, lt: end },
        ...(flightNo
          ? { booking: { flightInstance: { flight: { flightNo } } } }
          : {}),
      },
      select: { signedAmountIrr: true, booking: { select: { channel: true } } },
    });

    const totals = { SYSTEM: ZERO_IRR, CHARTER: ZERO_IRR, AGENCY: ZERO_IRR };
    for (const entry of entries) {
      const channel = entry.booking?.channel;
      if (channel)
        totals[channel] = addIrr(totals[channel], entry.signedAmountIrr);
    }
    return totals;
  }

  async salesChart(
    granularity: SalesGranularity,
    params: { periodStart?: string; date?: string; flightNo?: string },
  ): Promise<SalesChartPeriod[]> {
    if (granularity === 'flight') {
      if (!params.flightNo) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'flightNo لازم است.',
        });
      }
      const epoch = new Date(0);
      const now = new Date();
      const totals = await this.sumByChannel(epoch, now, params.flightNo);
      return [
        {
          periodKey: params.flightNo,
          startDate: epoch.toISOString(),
          endDate: now.toISOString(),
          systemIrr: totals.SYSTEM,
          charterIrr: totals.CHARTER,
          agencyIrr: totals.AGENCY,
        },
      ];
    }

    const buckets = this.buildBuckets(granularity, params);
    return Promise.all(
      buckets.map(async (bucket) => {
        const totals = await this.sumByChannel(bucket.start, bucket.end);
        return {
          periodKey: bucket.key,
          startDate: bucket.start.toISOString(),
          endDate: bucket.end.toISOString(),
          systemIrr: totals.SYSTEM,
          charterIrr: totals.CHARTER,
          agencyIrr: totals.AGENCY,
        };
      }),
    );
  }

  private resolvePeriodRange(
    granularity: SalesGranularity,
    params: {
      periodStart?: string;
      date?: string;
      flightNo?: string;
      periodKey?: string;
    },
  ): { start: Date; end: Date; flightNo?: string } {
    if (granularity === 'flight') {
      if (!params.flightNo) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'flightNo لازم است.',
        });
      }
      return { start: new Date(0), end: new Date(), flightNo: params.flightNo };
    }

    const buckets = this.buildBuckets(granularity, params);
    if (params.periodKey) {
      const match = buckets.find((b) => b.key === params.periodKey);
      if (!match) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'periodKey نامعتبر است.',
        });
      }
      return { start: match.start, end: match.end };
    }

    // No periodKey — full range across every bucket.
    if (buckets.length === 0) return { start: new Date(0), end: new Date() };
    return { start: buckets[0].start, end: buckets[buckets.length - 1].end };
  }

  private monthUtcRange(offsetMonths: number): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1),
    );
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths + 1, 1),
    );
    return { start, end };
  }

  private trendPct(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private async aggregateKpiWindow(
    start: Date,
    end: Date,
    flightNo?: string,
  ): Promise<Omit<KpiResult, 'trends' | 'agencyDebtIrr' | 'agencyDebtCount'>> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        occurredAt: { gte: start, lt: end },
        ...(flightNo
          ? { booking: { flightInstance: { flight: { flightNo } } } }
          : {}),
      },
      select: { type: true, signedAmountIrr: true, bookingId: true },
    });

    let revenueIrr: Irr = ZERO_IRR;
    let refundIrr: Irr = ZERO_IRR;
    let operatingCostIrr: Irr = ZERO_IRR;
    for (const e of entries) {
      const amount: Irr =
        e.signedAmountIrr < 0n ? -e.signedAmountIrr : e.signedAmountIrr;
      // AgenciesService.resetTestDebt reuses type:'SALE' for agency
      // debt-line calibration (agencyId set, bookingId null, amount can
      // be negative) — that's not ticket revenue, so it's excluded here
      // the same way sumByChannel() already excludes it via its
      // booking-relation filter.
      if (e.type === 'SALE') {
        if (e.bookingId) revenueIrr = addIrr(revenueIrr, amount);
      } else if (e.type === 'REFUND') refundIrr = addIrr(refundIrr, amount);
      else if (e.type === 'SETTLEMENT' || e.type === 'COMMISSION')
        operatingCostIrr = addIrr(operatingCostIrr, amount);
    }

    const profitIrr = subIrr(subIrr(revenueIrr, refundIrr), operatingCostIrr);
    const marginPct = isPositiveIrr(revenueIrr)
      ? Number(divRoundBigInt(profitIrr * 100n, revenueIrr))
      : 0;

    return { revenueIrr, profitIrr, marginPct, operatingCostIrr };
  }

  private previousPeriodRange(
    start: Date,
    end: Date,
  ): { start: Date; end: Date } {
    const spanMs = end.getTime() - start.getTime();
    return {
      start: new Date(start.getTime() - spanMs),
      end: new Date(start.getTime()),
    };
  }

  async kpis(
    granularity: SalesGranularity,
    params: {
      periodStart?: string;
      date?: string;
      flightNo?: string;
      periodKey?: string;
    },
  ): Promise<KpiResult> {
    const { start, end, flightNo } = this.resolvePeriodRange(
      granularity,
      params,
    );

    const current = await this.aggregateKpiWindow(start, end, flightNo);
    const prevRange = this.previousPeriodRange(start, end);
    const previous = await this.aggregateKpiWindow(
      prevRange.start,
      prevRange.end,
      flightNo,
    );

    const { agencyDebtIrr, agencyDebtCount } =
      await this.agencies.getDebtSummary();

    const trends: KpiTrends = {
      revenuePct: this.trendPct(
        Number(current.revenueIrr),
        Number(previous.revenueIrr),
      ),
      profitPct: this.trendPct(
        Number(current.profitIrr),
        Number(previous.profitIrr),
      ),
      operatingCostPct: this.trendPct(
        Number(current.operatingCostIrr),
        Number(previous.operatingCostIrr),
      ),
      agencyDebtPct: this.trendPct(
        Number(agencyDebtIrr),
        Number(agencyDebtIrr),
      ),
    };

    return {
      ...current,
      agencyDebtIrr,
      agencyDebtCount,
      trends,
    };
  }

  /** Design-aligned dashboard stat cards for FINANCE_MANAGER — all real DB counts. */
  async financeDashboardStats(): Promise<FinanceDashboardStats> {
    const thisMonth = this.monthUtcRange(0);
    const lastMonth = this.monthUtcRange(-1);

    const bookingStatuses = ['PAID', 'TICKETED'] as const;

    const [
      activeAgencies,
      prevActiveAgencies,
      passengersThisMonth,
      prevPassengers,
      ticketsThisMonth,
      prevTickets,
      revenueThisMonth,
      prevRevenue,
    ] = await Promise.all([
      this.prisma.agencyProfile.count({
        where: { suspendedAt: null, user: { isActive: true } },
      }),
      this.prisma.agencyProfile.count({
        where: {
          suspendedAt: null,
          user: { isActive: true },
          joinedAt: { lt: thisMonth.start },
        },
      }),
      this.prisma.passenger.count({
        where: {
          deletedAt: null,
          booking: {
            status: { in: [...bookingStatuses] },
            createdAt: { gte: thisMonth.start, lt: thisMonth.end },
          },
        },
      }),
      this.prisma.passenger.count({
        where: {
          deletedAt: null,
          booking: {
            status: { in: [...bookingStatuses] },
            createdAt: { gte: lastMonth.start, lt: lastMonth.end },
          },
        },
      }),
      this.prisma.booking.count({
        where: {
          status: { in: [...bookingStatuses] },
          createdAt: { gte: thisMonth.start, lt: thisMonth.end },
          deletedAt: null,
        },
      }),
      this.prisma.booking.count({
        where: {
          status: { in: [...bookingStatuses] },
          createdAt: { gte: lastMonth.start, lt: lastMonth.end },
          deletedAt: null,
        },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          type: 'SALE',
          bookingId: { not: null },
          occurredAt: { gte: thisMonth.start, lt: thisMonth.end },
        },
        _sum: { signedAmountIrr: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          type: 'SALE',
          bookingId: { not: null },
          occurredAt: { gte: lastMonth.start, lt: lastMonth.end },
        },
        _sum: { signedAmountIrr: true },
      }),
    ]);

    const revenueThisMonthIrr = absIrr(
      revenueThisMonth._sum.signedAmountIrr ?? ZERO_IRR,
    );
    const revenuePrevIrr = absIrr(prevRevenue._sum.signedAmountIrr ?? ZERO_IRR);

    return {
      activeAgencies,
      activeAgenciesTrendPct: this.trendPct(activeAgencies, prevActiveAgencies),
      passengersThisMonth,
      passengersTrendPct: this.trendPct(passengersThisMonth, prevPassengers),
      ticketsSoldThisMonth: ticketsThisMonth,
      ticketsTrendPct: this.trendPct(ticketsThisMonth, prevTickets),
      revenueThisMonthIrr,
      // Percentage derived from bigint money via divRoundBigInt (never a
      // float division on the raw amounts) — trendPct itself stays
      // number-only since it's also reused for plain counts above.
      revenueTrendPct: isPositiveIrr(revenuePrevIrr)
        ? Number(
            divRoundBigInt(
              subIrr(revenueThisMonthIrr, revenuePrevIrr) * 100n,
              revenuePrevIrr,
            ),
          )
        : revenueThisMonthIrr > ZERO_IRR
          ? 100
          : 0,
    };
  }

  /** Departed instances + per-channel SALE totals for the «شماره پرواز» picker. */
  async flightSales(): Promise<FlightSalesResult> {
    await materializeDepartedInstances(this.prisma);

    const instances = await this.prisma.flightInstance.findMany({
      where: { status: 'DEPARTED' },
      orderBy: { departureAt: 'desc' },
      take: FLIGHT_SALES_LIST_LIMIT,
      select: {
        id: true,
        departureAt: true,
        capacity: true,
        flight: {
          select: {
            flightNo: true,
            route: { select: { originCode: true, destCode: true } },
          },
        },
        _count: {
          select: {
            bookings: { where: { status: { in: ['PAID', 'TICKETED'] } } },
          },
        },
      },
    });

    const instanceIds = instances.map((i) => i.id);
    const [entries, airports] = await Promise.all([
      instanceIds.length === 0
        ? Promise.resolve([])
        : this.prisma.ledgerEntry.findMany({
            where: {
              type: 'SALE',
              bookingId: { not: null },
              booking: { flightInstanceId: { in: instanceIds } },
            },
            select: {
              signedAmountIrr: true,
              booking: {
                select: { channel: true, flightInstanceId: true },
              },
            },
          }),
      this.prisma.airport.findMany({ select: { code: true, cityFa: true } }),
    ]);

    const cityByCode = new Map(airports.map((a) => [a.code, a.cityFa]));
    const totalsByInstance = new Map<
      string,
      { SYSTEM: Irr; CHARTER: Irr; AGENCY: Irr }
    >();
    for (const entry of entries) {
      const instanceId = entry.booking?.flightInstanceId;
      const channel = entry.booking?.channel;
      if (!instanceId || !channel) continue;
      const cur = totalsByInstance.get(instanceId) ?? {
        SYSTEM: ZERO_IRR,
        CHARTER: ZERO_IRR,
        AGENCY: ZERO_IRR,
      };
      cur[channel] = addIrr(cur[channel], entry.signedAmountIrr);
      totalsByInstance.set(instanceId, cur);
    }

    return {
      rows: instances.map((i) => {
        const totals = totalsByInstance.get(i.id) ?? {
          SYSTEM: ZERO_IRR,
          CHARTER: ZERO_IRR,
          AGENCY: ZERO_IRR,
        };
        const totalIrr = addIrr(totals.SYSTEM, totals.CHARTER, totals.AGENCY);
        const originCode = i.flight.route.originCode;
        const destCode = i.flight.route.destCode;
        return {
          flightInstanceId: i.id,
          flightNo: i.flight.flightNo,
          originCode,
          destCode,
          originCityFa: cityByCode.get(originCode) ?? originCode,
          destCityFa: cityByCode.get(destCode) ?? destCode,
          departureAt: i.departureAt.toISOString(),
          systemIrr: totals.SYSTEM,
          charterIrr: totals.CHARTER,
          agencyIrr: totals.AGENCY,
          totalIrr,
          capacity: i.capacity,
          soldSeats: i._count.bookings,
        };
      }),
    };
  }

  async completedFlightsSummary(
    granularity: SalesGranularity,
    params: {
      periodStart?: string;
      date?: string;
      flightNo?: string;
      periodKey?: string;
    },
  ): Promise<CompletedFlightsSummary> {
    const { start, end, flightNo } = this.resolvePeriodRange(
      granularity,
      params,
    );

    await materializeDepartedInstances(this.prisma);
    const instances = await this.prisma.flightInstance.findMany({
      where: {
        status: 'DEPARTED',
        departureAt: { gte: start, lt: end },
        ...(flightNo ? { flight: { flightNo } } : {}),
      },
      select: {
        capacity: true,
        _count: {
          select: {
            bookings: { where: { status: { in: ['PAID', 'TICKETED'] } } },
          },
        },
      },
    });

    const flightCount = instances.length;
    const totalSeats = instances.reduce((sum, i) => sum + i.capacity, 0);
    const soldSeats = instances.reduce((sum, i) => sum + i._count.bookings, 0);

    return {
      flightCount,
      totalSeats,
      soldSeats,
      unsoldSeats: totalSeats - soldSeats,
    };
  }

  async lowSalesAlerts() {
    const now = new Date();
    const windowEnd = new Date(
      now.getTime() + LOW_SALES_WINDOW_HOURS * 60 * 60 * 1000,
    );

    const instances = await this.prisma.flightInstance.findMany({
      where: { status: 'SCHEDULED', departureAt: { gte: now, lte: windowEnd } },
      select: {
        id: true,
        departureAt: true,
        capacity: true,
        flight: {
          select: {
            flightNo: true,
            route: { select: { originCode: true, destCode: true } },
          },
        },
        _count: {
          select: {
            bookings: { where: { status: { in: ['PAID', 'TICKETED'] } } },
          },
        },
      },
    });

    return instances
      .map((i) => ({
        flightNo: i.flight.flightNo,
        originCode: i.flight.route.originCode,
        destCode: i.flight.route.destCode,
        departureAt: i.departureAt.toISOString(),
        capacity: i.capacity,
        soldSeats: i._count.bookings,
        occupancyPct: i.capacity > 0 ? i._count.bookings / i.capacity : 0,
      }))
      .filter((i) => i.occupancyPct < LOW_SALES_OCCUPANCY_THRESHOLD);
  }

  // ── Phase 11: finance tab additions ──────────────────────────────────

  /** «تراکنش‌های مالی اخیر» — real ledger rows with party context. The
   * mock's static txDefs are replaced entirely; nothing is fabricated. */
  async recentTransactions() {
    const [entries, totalCount] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        orderBy: { occurredAt: 'desc' },
        take: 20,
        include: {
          agency: { include: { user: { select: { fullName: true } } } },
          booking: {
            select: {
              pnr: true,
              passengers: { select: { fullName: true }, take: 1 },
              flightInstance: {
                select: {
                  flight: {
                    select: {
                      route: {
                        select: { originCode: true, destCode: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.ledgerEntry.count(),
    ]);

    const TITLE_FA: Record<string, string> = {
      SALE: 'درآمد فروش بلیط',
      SETTLEMENT: 'تسویه حساب',
      COMMISSION: 'کمیسیون آژانس همکار',
      REFUND: 'استرداد بلیط',
    };

    const statusFor = (
      type: string,
    ): { statusFa: string; statusTone: TransactionStatusTone } => {
      if (type === 'REFUND')
        return { statusFa: 'بازپرداخت', statusTone: 'danger' };
      if (type === 'COMMISSION')
        return { statusFa: 'در انتظار', statusTone: 'warning' };
      return { statusFa: 'موفق', statusTone: 'success' };
    };

    const rows = entries.map((e) => {
      const passenger = e.booking?.passengers[0]?.fullName;
      const route = e.booking
        ? `${e.booking.flightInstance.flight.route.originCode} → ${e.booking.flightInstance.flight.route.destCode}`
        : null;
      const party =
        e.agency?.user.fullName ??
        (passenger
          ? `${passenger}${e.booking ? ` · ${e.booking.pnr}` : ''}`
          : (route ?? '—'));
      const { statusFa, statusTone } = statusFor(e.type);
      return {
        id: e.id,
        type: e.type,
        titleFa: TITLE_FA[e.type] ?? e.type,
        party,
        occurredAt: e.occurredAt.toISOString(),
        signedAmountIrr: e.signedAmountIrr,
        statusFa,
        statusTone,
      };
    });

    return { rows, totalCount };
  }

  /** «ترکیب درآمد» donut — per-channel SALE sums over the same optional
   * period window as the KPIs. */
  async revenueMix(
    granularity: SalesGranularity,
    params: {
      periodStart?: string;
      date?: string;
      flightNo?: string;
      periodKey?: string;
    },
  ) {
    const { start, end, flightNo } = this.resolvePeriodRange(
      granularity,
      params,
    );

    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        type: 'SALE',
        // Real ticket revenue only — see kpis()'s comment: excludes
        // AgenciesService.resetTestDebt's bookingless debt-calibration rows.
        bookingId: { not: null },
        occurredAt: { gte: start, lt: end },
        ...(flightNo
          ? { booking: { flightInstance: { flight: { flightNo } } } }
          : {}),
      },
      select: {
        signedAmountIrr: true,
        booking: { select: { channel: true } },
      },
    });

    const sums = { SYSTEM: ZERO_IRR, CHARTER: ZERO_IRR, AGENCY: ZERO_IRR };
    for (const e of entries) {
      if (!e.booking) continue;
      const amount: Irr =
        e.signedAmountIrr < 0n ? -e.signedAmountIrr : e.signedAmountIrr;
      sums[e.booking.channel] = addIrr(sums[e.booking.channel], amount);
    }
    const totalIrr = addIrr(sums.SYSTEM, sums.CHARTER, sums.AGENCY);
    const pct = (n: Irr) =>
      isPositiveIrr(totalIrr) ? Number(divRoundBigInt(n * 100n, totalIrr)) : 0;

    return {
      totalIrr,
      channels: [
        {
          channel: 'SYSTEM',
          labelFa: 'فروش سیستمی',
          amountIrr: sums.SYSTEM,
          pct: pct(sums.SYSTEM),
        },
        {
          channel: 'CHARTER',
          labelFa: 'چارتر',
          amountIrr: sums.CHARTER,
          pct: pct(sums.CHARTER),
        },
        {
          channel: 'AGENCY',
          labelFa: 'آژانس همکار',
          amountIrr: sums.AGENCY,
          pct: pct(sums.AGENCY),
        },
      ],
    };
  }

  /** «تسویه‌حساب آژانس‌های همکار» — per-agency settlement status derived
   * from Phase 3 invoices; presentation only, no new write path. */
  async agencySettlements() {
    const agencies = await this.prisma.agencyProfile.findMany({
      include: {
        user: { select: { fullName: true } },
        invoices: true,
      },
    });

    const now = new Date();
    const rows = agencies
      .filter((a) => a.invoices.length > 0)
      .map((a) => {
        const totalIrr = a.invoices.reduce(
          (s, i) => addIrr(s, i.amountIrr),
          ZERO_IRR,
        );
        const paidIrr = a.invoices
          .filter((i) => i.status === 'PAID')
          .reduce((s, i) => addIrr(s, i.amountIrr), ZERO_IRR);
        const unpaid = a.invoices
          .filter((i) => i.status !== 'PAID')
          .sort((x, y) => x.dueAt.getTime() - y.dueAt.getTime());
        const earliestUnpaid = unpaid[0] ?? null;
        const overdueDays = earliestUnpaid
          ? Math.max(
              0,
              Math.floor(
                (now.getTime() - earliestUnpaid.dueAt.getTime()) /
                  (24 * 60 * 60 * 1000),
              ),
            )
          : 0;
        const status: 'SETTLED' | 'PENDING' | 'OVERDUE' =
          unpaid.length === 0
            ? 'SETTLED'
            : overdueDays > 0
              ? 'OVERDUE'
              : 'PENDING';

        return {
          agencyId: a.userId,
          agencyName: a.user.fullName,
          totalIrr,
          paidIrr,
          paidPct: isPositiveIrr(totalIrr)
            ? Number(divRoundBigInt(paidIrr * 100n, totalIrr))
            : 0,
          dueAt: earliestUnpaid?.dueAt.toISOString() ?? null,
          overdueDays,
          status,
          // The remind action reuses Phase 3's audited endpoint — the row
          // carries the invoice id it would target.
          remindInvoiceId: earliestUnpaid?.id ?? null,
        };
      });

    const outstandingIrr = rows.reduce(
      (s, r) => addIrr(s, subIrr(r.totalIrr, r.paidIrr)),
      ZERO_IRR,
    );
    return { rows, outstandingIrr };
  }

  /** Commercial Manager dashboard KPI row — per design-reference-v2/پنل مدیر بازرگانی.dc.html */
  async commercialOverview(): Promise<{
    activeAgencies: number;
    passengersThisMonth: number;
    pendingAgencyRequests: number;
  }> {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const [activeAgencies, passengersThisMonth, pendingAgencyRequests] =
      await Promise.all([
        this.prisma.agencyProfile.count({ where: { suspendedAt: null } }),
        this.prisma.passenger.count({
          where: {
            booking: {
              status: { in: ['PAID', 'TICKETED'] },
              createdAt: { gte: monthStart, lt: monthEnd },
            },
          },
        }),
        this.prisma.agencyMembershipRequest.count({
          where: { status: { in: ['PENDING', 'REFERRED'] } },
        }),
      ]);

    return { activeAgencies, passengersThisMonth, pendingAgencyRequests };
  }
}

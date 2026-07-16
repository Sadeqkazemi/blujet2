import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/errors';
import {
  Bucket,
  CompletedFlightsSummary,
  KpiResult,
  SalesChartPeriod,
  SalesGranularity,
} from './reporting.types';

const LOW_SALES_WINDOW_HOURS = 72;
const LOW_SALES_OCCUPANCY_THRESHOLD = 0.6;

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

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
        occurredAt: { gte: start, lt: end },
        ...(flightNo
          ? { booking: { flightInstance: { flight: { flightNo } } } }
          : {}),
      },
      select: { signedAmountIrr: true, booking: { select: { channel: true } } },
    });

    const totals = { SYSTEM: 0, CHARTER: 0, AGENCY: 0 };
    for (const entry of entries) {
      const channel = entry.booking?.channel;
      if (channel) totals[channel] += entry.signedAmountIrr;
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

    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        occurredAt: { gte: start, lt: end },
        ...(flightNo
          ? { booking: { flightInstance: { flight: { flightNo } } } }
          : {}),
      },
      select: { type: true, signedAmountIrr: true },
    });

    let revenueIrr = 0;
    let refundIrr = 0;
    let operatingCostIrr = 0;
    for (const e of entries) {
      const amount = Math.abs(e.signedAmountIrr);
      if (e.type === 'SALE') revenueIrr += amount;
      else if (e.type === 'REFUND') refundIrr += amount;
      else if (e.type === 'SETTLEMENT' || e.type === 'COMMISSION')
        operatingCostIrr += amount;
    }

    const profitIrr = revenueIrr - refundIrr - operatingCostIrr;
    const marginPct =
      revenueIrr > 0 ? Math.round((profitIrr / revenueIrr) * 100) : 0;

    return {
      revenueIrr,
      profitIrr,
      marginPct,
      operatingCostIrr,
      // AgencyCreditLine lands in Phase 3 — honestly 0 until then, not fabricated.
      agencyDebtIrr: 0,
      agencyDebtCount: 0,
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
}

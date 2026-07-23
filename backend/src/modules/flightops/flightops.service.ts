import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NiraService } from '../nira/nira.service';
import { decryptPii } from '../../common/pii-crypto';
import { ErrorCode } from '../../common/errors';
import { isSaleAutoClosed } from './sale-close.util';
import type { Prisma } from '../../../generated/prisma/client';

/** Statuses that count as a real, ticketed passenger — same convention
 * as FlightsService/AgencyPortalService. */
const SOLD_STATUSES = ['PAID', 'TICKETED'] as const;

type InstanceWithFlight = Prisma.FlightInstanceGetPayload<{
  include: { flight: { include: { route: true } } };
}>;

@Injectable()
export class FlightopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nira: NiraService,
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

  /** Lazily submits the manifest to نیرا once an instance has crossed the
   * 5h-before-departure threshold — no cron job, same pattern as
   * materializeDepartedInstances/materializeExpiry. Conditional update
   * guards a concurrent double-submit; a second call after the first
   * succeeds is a pure no-op (niraSubmittedAt already non-null). */
  private async materializeNiraSubmission(
    instance: InstanceWithFlight,
  ): Promise<InstanceWithFlight> {
    if (
      instance.niraSubmittedAt !== null ||
      !isSaleAutoClosed(instance.departureAt)
    ) {
      return instance;
    }

    const passengers = await this.prisma.passenger.findMany({
      where: {
        booking: {
          flightInstanceId: instance.id,
          status: { in: [...SOLD_STATUSES] },
        },
        deletedAt: null,
      },
      select: { fullName: true, nationalIdEnc: true, seatCode: true },
    });

    await this.nira.submitManifest(
      instance.flight.flightNo,
      instance.departureAt,
      passengers.map((p) => ({
        fullName: p.fullName,
        nationalId: p.nationalIdEnc ? decryptPii(p.nationalIdEnc) : null,
        seatCode: p.seatCode,
      })),
    );

    const submittedAt = new Date();
    const updated = await this.prisma.flightInstance.updateMany({
      where: { id: instance.id, niraSubmittedAt: null },
      data: { niraSubmittedAt: submittedAt },
    });
    return updated.count > 0
      ? { ...instance, niraSubmittedAt: submittedAt }
      : instance;
  }

  private baseRow(i: InstanceWithFlight, sold: number) {
    const closed = isSaleAutoClosed(i.departureAt);
    return {
      id: i.id,
      flightNo: i.flight.flightNo,
      originCode: i.flight.route.originCode,
      destCode: i.flight.route.destCode,
      departureAt: i.departureAt.toISOString(),
      capacity: i.capacity,
      sold,
      free: i.capacity - sold,
      closed,
      niraSubmittedAt: i.niraSubmittedAt?.toISOString() ?? null,
    };
  }

  async list() {
    const instances = await this.prisma.flightInstance.findMany({
      where: { status: 'SCHEDULED' },
      include: { flight: { include: { route: true } } },
      orderBy: { departureAt: 'asc' },
    });

    const materialized = await Promise.all(
      instances.map((i) => this.materializeNiraSubmission(i)),
    );
    const sold = await this.soldByInstance(materialized.map((i) => i.id));

    const rows = materialized.map((i) => this.baseRow(i, sold.get(i.id) ?? 0));
    const kpis = {
      total: rows.length,
      open: rows.filter((r) => !r.closed).length,
      closed: rows.filter((r) => r.closed).length,
      soldTotal: rows.reduce((a, r) => a + r.sold, 0),
    };

    return { kpis, rows };
  }

  async detail(id: string) {
    const instance = await this.prisma.flightInstance.findUnique({
      where: { id },
      include: { flight: { include: { route: true } } },
    });
    if (!instance || instance.status === 'CANCELLED') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد.',
      });
    }

    const materialized = await this.materializeNiraSubmission(instance);
    const sold = await this.soldByInstance([materialized.id]);
    const soldCount = sold.get(materialized.id) ?? 0;

    const passengers = await this.prisma.passenger.findMany({
      where: {
        booking: {
          flightInstanceId: materialized.id,
          status: { in: [...SOLD_STATUSES] },
        },
        deletedAt: null,
      },
      include: { booking: { select: { pnr: true } } },
    });

    return {
      ...this.baseRow(materialized, soldCount),
      occupancyPct:
        materialized.capacity > 0
          ? Math.round((soldCount / materialized.capacity) * 100)
          : 0,
      manifest: passengers.map((p) => ({
        fullName: p.fullName,
        nationalId: p.nationalIdEnc ? decryptPii(p.nationalIdEnc) : null,
        seatCode: p.seatCode,
        pnr: p.booking.pnr,
      })),
    };
  }
}

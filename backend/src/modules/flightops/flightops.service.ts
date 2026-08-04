import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { FlightInstance } from '../../database/entities/flight-instance.entity';
import { Passenger } from '../../database/entities/passenger.entity';
import { Booking } from '../../database/entities/booking.entity';
import { NiraService } from '../nira/nira.service';
import { decryptPii } from '../../common/pii-crypto';
import { ErrorCode } from '../../common/errors';
import { isSaleAutoClosed } from './sale-close.util';

/** Statuses that count as a real, ticketed passenger — same convention
 * as FlightsService/AgencyPortalService. */
const SOLD_STATUSES = ['PAID', 'TICKETED'] as const;

@Injectable()
export class FlightopsService {
  constructor(
    @InjectRepository(FlightInstance)
    private readonly instanceRepo: Repository<FlightInstance>,
    @InjectRepository(Passenger)
    private readonly passengerRepo: Repository<Passenger>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly nira: NiraService,
  ) {}

  private async soldByInstance(
    instanceIds: string[],
  ): Promise<Map<string, number>> {
    if (instanceIds.length === 0) return new Map();
    const rows = await this.bookingRepo
      .createQueryBuilder('b')
      .select('b.flightInstanceId', 'flightInstanceId')
      .addSelect('COUNT(*)', 'count')
      .where('b.flightInstanceId IN (:...ids)', { ids: instanceIds })
      .andWhere('b.status IN (:...statuses)', { statuses: [...SOLD_STATUSES] })
      .groupBy('b.flightInstanceId')
      .getRawMany<{ flightInstanceId: string; count: string }>();
    return new Map(rows.map((r) => [r.flightInstanceId, Number(r.count)]));
  }

  /** Lazily submits the manifest to نیرا once an instance has crossed the
   * 5h-before-departure threshold — no cron job, same pattern as
   * materializeDepartedInstances/materializeExpiry. Conditional update
   * guards a concurrent double-submit; a second call after the first
   * succeeds is a pure no-op (niraSubmittedAt already non-null). */
  private async materializeNiraSubmission(
    instance: FlightInstance,
  ): Promise<FlightInstance> {
    if (
      instance.niraSubmittedAt !== null ||
      !isSaleAutoClosed(instance.departureAt)
    ) {
      return instance;
    }

    const passengers = await this.passengerRepo
      .createQueryBuilder('p')
      .leftJoin('p.booking', 'booking')
      .select(['p.id', 'p.fullName', 'p.nationalIdEnc', 'p.seatCode'])
      .where('booking.flightInstanceId = :id', { id: instance.id })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: [...SOLD_STATUSES],
      })
      .andWhere('p.deletedAt IS NULL')
      .getMany();

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
    const updated = await this.instanceRepo.update(
      { id: instance.id, niraSubmittedAt: IsNull() },
      { niraSubmittedAt: submittedAt },
    );
    if ((updated.affected ?? 0) > 0) instance.niraSubmittedAt = submittedAt;
    return instance;
  }

  private baseRow(i: FlightInstance, sold: number) {
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
    const instances = await this.instanceRepo
      .createQueryBuilder('fi')
      .leftJoin('fi.flight', 'flight')
      .leftJoin('flight.route', 'route')
      .select(['fi.id', 'fi.departureAt', 'fi.capacity', 'fi.niraSubmittedAt'])
      .addSelect(['flight.id', 'flight.flightNo'])
      .addSelect(['route.id', 'route.originCode', 'route.destCode'])
      .where('fi.status = :status', { status: 'SCHEDULED' })
      .orderBy('fi.departureAt', 'ASC')
      .getMany();

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
    const instance = await this.instanceRepo
      .createQueryBuilder('fi')
      .leftJoin('fi.flight', 'flight')
      .leftJoin('flight.route', 'route')
      .addSelect(['flight.id', 'flight.flightNo'])
      .addSelect(['route.id', 'route.originCode', 'route.destCode'])
      .where('fi.id = :id', { id })
      .getOne();
    if (!instance || instance.status === 'CANCELLED') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد.',
      });
    }

    const materialized = await this.materializeNiraSubmission(instance);
    const sold = await this.soldByInstance([materialized.id]);
    const soldCount = sold.get(materialized.id) ?? 0;

    const passengers = await this.passengerRepo
      .createQueryBuilder('p')
      .leftJoin('p.booking', 'booking')
      .select(['p.id', 'p.fullName', 'p.nationalIdEnc', 'p.seatCode'])
      .addSelect(['booking.id', 'booking.pnr'])
      .where('booking.flightInstanceId = :id', { id: materialized.id })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: [...SOLD_STATUSES],
      })
      .andWhere('p.deletedAt IS NULL')
      .getMany();

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

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, In, Repository } from 'typeorm';
import { Airport } from '../../database/entities/airport.entity';
import { AircraftDefinition } from '../../database/entities/aircraft-definition.entity';
import { AircraftCabin } from '../../database/entities/aircraft-cabin.entity';
import { Flight } from '../../database/entities/flight.entity';
import { Route } from '../../database/entities/route.entity';
import { FlightInstance } from '../../database/entities/flight-instance.entity';
import { FlightScheduleTemplate } from '../../database/entities/flight-schedule-template.entity';
import { Booking } from '../../database/entities/booking.entity';
import {
  FlightDefinitionStatus,
  FlightInstanceStatus,
  FlightScheduleTemplateStatus,
} from '../../database/enums';
import { ErrorCode } from '../../common/errors';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuditService } from '../audit/audit.service';
import {
  enumerateMatchingDates,
  zonedLocalToUtc,
} from './schedule-template.dates';
import type {
  CreateScheduleTemplateDto,
  ScheduleTemplatePreviewDto,
} from './dto/schedule-template.dto';

@Injectable()
export class ScheduleTemplateService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(FlightScheduleTemplate)
    private readonly templateRepo: Repository<FlightScheduleTemplate>,
    @InjectRepository(Airport)
    private readonly airportRepo: Repository<Airport>,
    @InjectRepository(AircraftDefinition)
    private readonly aircraftRepo: Repository<AircraftDefinition>,
    @InjectRepository(AircraftCabin)
    private readonly cabinRepo: Repository<AircraftCabin>,
    @InjectRepository(FlightInstance)
    private readonly instanceRepo: Repository<FlightInstance>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Route)
    private readonly routeRepo: Repository<Route>,
    @InjectRepository(Flight)
    private readonly flightRepo: Repository<Flight>,
    private readonly audit: AuditService,
  ) {}

  private parseIrr(value: string, field: string): bigint {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `${field} باید عدد صحیح ریال باشد.`,
      });
    }
    return BigInt(value);
  }

  private async resolveContext(dto: ScheduleTemplatePreviewDto) {
    if (dto.originAirportId === dto.destinationAirportId) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'مبدأ و مقصد نمی‌توانند یکسان باشند.',
      });
    }
    const agency = this.parseIrr(dto.agencyPriceIrr, 'agencyPriceIrr');
    const legal = this.parseIrr(dto.legalCeilingIrr, 'legalCeilingIrr');
    if (agency > legal) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'قیمت آژانس نمی‌تواند از سقف قانونی بیشتر باشد.',
      });
    }
    if (dto.startDate > dto.endDate) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'بازه تاریخ نامعتبر است.',
      });
    }

    const [origin, dest, aircraft] = await Promise.all([
      this.airportRepo.findOne({
        where: { id: dto.originAirportId, active: true },
      }),
      this.airportRepo.findOne({
        where: { id: dto.destinationAirportId, active: true },
      }),
      this.aircraftRepo.findOne({ where: { id: dto.aircraftDefinitionId } }),
    ]);
    if (!origin || !dest) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'فرودگاه انتخاب‌شده معتبر نیست.',
      });
    }
    if (!aircraft || aircraft.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'تعریف هواپیما معتبر نیست.',
      });
    }
    // Never mutate MD-80 seat maps — only read cabin capacities.
    const cabins = await this.cabinRepo.find({
      where: { aircraftDefinitionId: aircraft.id },
    });
    if (cabins.length === 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'ظرفیت کابین برای این هواپیما تعریف نشده است.',
      });
    }
    const cabinCapacities = cabins.map((c) => ({
      cabin: c.cabinType,
      seats: c.capacity,
    }));
    const capacity = cabins.reduce((s, c) => s + c.capacity, 0);

    const dates = enumerateMatchingDates(
      dto.startDate,
      dto.endDate,
      dto.weekdays,
    );
    const occurrences = dates.map((dateOnly) => {
      const departureAt = zonedLocalToUtc(
        dateOnly,
        dto.departureTime,
        origin.tz,
      );
      const arrivalAt = new Date(
        departureAt.getTime() + dto.durationMinutes * 60_000,
      );
      return { dateOnly, departureAt, arrivalAt };
    });

    return {
      origin,
      dest,
      aircraft,
      cabinCapacities,
      capacity,
      agency,
      legal,
      occurrences,
    };
  }

  async preview(dto: ScheduleTemplatePreviewDto) {
    const ctx = await this.resolveContext(dto);
    return {
      occurrenceCount: ctx.occurrences.length,
      capacity: ctx.capacity,
      cabinCapacities: ctx.cabinCapacities,
      dates: ctx.occurrences.map((o) => ({
        localDate: o.dateOnly,
        departureAt: o.departureAt.toISOString(),
        arrivalAt: o.arrivalAt.toISOString(),
      })),
    };
  }

  private async findConflicts(
    flightNo: string,
    aircraftDefinitionId: string,
    departures: Date[],
  ) {
    if (departures.length === 0) return [];
    const rows = await this.instanceRepo
      .createQueryBuilder('fi')
      .innerJoinAndSelect('fi.flight', 'f')
      .where('fi.status = :scheduled', {
        scheduled: FlightInstanceStatus.SCHEDULED,
      })
      .andWhere('fi.departureAt IN (:...deps)', { deps: departures })
      .andWhere(
        '(f.flightNo = :flightNo OR fi.aircraftDefinitionId = :aircraftId)',
        { flightNo, aircraftId: aircraftDefinitionId },
      )
      .getMany();
    return rows.map((r) => ({
      flightInstanceId: r.id,
      flightNo: r.flight.flightNo,
      departureAt: r.departureAt.toISOString(),
      aircraftDefinitionId: r.aircraftDefinitionId,
    }));
  }

  async create(actor: AuthenticatedUser, dto: CreateScheduleTemplateDto) {
    const existing = await this.templateRepo.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      return this.toView(existing.id);
    }

    const ctx = await this.resolveContext(dto);
    if (ctx.occurrences.length === 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'هیچ تاریخی در بازه و روزهای هفته انتخاب‌شده نیست.',
      });
    }

    const conflicts = await this.findConflicts(
      dto.flightNoBase,
      dto.aircraftDefinitionId,
      ctx.occurrences.map((o) => o.departureAt),
    );
    if (conflicts.length > 0) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: `تداخل زمان/هواپیما/شماره پرواز با پرواز موجود (${conflicts.length} مورد).`,
      });
    }

    const templateId = await this.dataSource.transaction(async (manager) => {
      let route = await manager.findOne(Route, {
        where: {
          originCode: ctx.origin.code,
          destCode: ctx.dest.code,
        },
      });
      if (!route) {
        route = await manager.save(
          manager.create(Route, {
            originCode: ctx.origin.code,
            destCode: ctx.dest.code,
            durationMin: dto.durationMinutes,
          }),
        );
      }

      let flight = await manager.findOne(Flight, {
        where: { flightNo: dto.flightNoBase },
      });
      if (!flight) {
        flight = await manager.save(
          manager.create(Flight, {
            flightNo: dto.flightNoBase,
            routeId: route.id,
            aircraftType: ctx.aircraft.code,
          }),
        );
      } else if (flight.routeId !== route.id) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'شماره پرواز برای مسیر دیگری ثبت شده است.',
        });
      }

      const template = await manager.save(
        manager.create(FlightScheduleTemplate, {
          originAirportId: ctx.origin.id,
          destinationAirportId: ctx.dest.id,
          flightNoBase: dto.flightNoBase,
          aircraftDefinitionId: ctx.aircraft.id,
          departureTime: dto.departureTime,
          durationMinutes: dto.durationMinutes,
          startDate: dto.startDate,
          endDate: dto.endDate,
          weekdays: dto.weekdays,
          agencyPriceIrr: ctx.agency,
          legalCeilingIrr: ctx.legal,
          cabinCapacities: ctx.cabinCapacities,
          status: FlightScheduleTemplateStatus.ACTIVE,
          idempotencyKey: dto.idempotencyKey,
          createdByUserId: actor.id,
        }),
      );

      const rows = ctx.occurrences.map((o) => ({
        id: randomUUID(),
        flightId: flight!.id,
        scheduleId: null,
        scheduleTemplateId: template.id,
        departureAt: o.departureAt,
        arrivalAt: o.arrivalAt,
        capacity: ctx.capacity,
        charterSeats: 0,
        status: FlightInstanceStatus.SCHEDULED,
        definitionStatus: FlightDefinitionStatus.DRAFT,
        durationMinutes: dto.durationMinutes,
        basePriceIrr: ctx.agency,
        cabinCapacities: ctx.cabinCapacities,
        aircraftDefinitionId: ctx.aircraft.id,
        aircraftTypeOverride: ctx.aircraft.code,
      }));

      // Bulk insert via query builder hits TS2589 on this entity graph.
      await manager
        .createQueryBuilder()
        .insert()
        .into(FlightInstance)
        .values(rows as never)
        .orIgnore()
        .execute();

      return template.id;
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'ایجاد برنامه فصلی پرواز',
      detail: `برنامه ${dto.flightNoBase} با ${ctx.occurrences.length} پرواز ساخته شد.`,
      entityType: 'FlightScheduleTemplate',
      entityId: templateId,
      metadata: {
        occurrenceCount: ctx.occurrences.length,
        idempotencyKey: dto.idempotencyKey,
      },
    });

    return this.toView(templateId);
  }

  async list(page = 1, pageSize = 20) {
    const [rows, total] = await this.templateRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      relations: {
        originAirport: true,
        destinationAirport: true,
        aircraftDefinition: true,
      },
    });
    return {
      items: rows.map((t) => this.serialize(t)),
      page,
      pageSize,
      total,
    };
  }

  async get(id: string) {
    return this.toView(id);
  }

  async deactivate(actor: AuthenticatedUser, id: string) {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'برنامه یافت نشد.',
      });
    }
    if (template.status === FlightScheduleTemplateStatus.DEACTIVATED) {
      return this.toView(id);
    }

    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      template.status = FlightScheduleTemplateStatus.DEACTIVATED;
      template.deactivatedAt = now;
      await manager.save(template);

      const future = await manager.find(FlightInstance, {
        where: {
          scheduleTemplateId: id,
          status: FlightInstanceStatus.SCHEDULED,
        },
      });
      const futureIds = future
        .filter((fi) => fi.departureAt.getTime() > now.getTime())
        .map((fi) => fi.id);
      if (futureIds.length === 0) return;

      const sold = await manager.find(Booking, {
        where: {
          flightInstanceId: In(futureIds),
          status: In(['HELD', 'PAID', 'TICKETED']),
        },
      });
      const soldSet = new Set(sold.map((b) => b.flightInstanceId));
      const cancellable = futureIds.filter((fid) => !soldSet.has(fid));
      if (cancellable.length > 0) {
        await manager
          .createQueryBuilder()
          .update(FlightInstance)
          .set({ status: FlightInstanceStatus.CANCELLED })
          .where('id IN (:...ids)', { ids: cancellable })
          .execute();
      }
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'غیرفعال‌سازی برنامه فصلی پرواز',
      detail: `برنامه ${template.flightNoBase} برای آینده غیرفعال شد (سوابق فروش حفظ شد).`,
      entityType: 'FlightScheduleTemplate',
      entityId: id,
    });

    return this.toView(id);
  }

  private async toView(id: string) {
    const t = await this.templateRepo.findOne({
      where: { id },
      relations: {
        originAirport: true,
        destinationAirport: true,
        aircraftDefinition: true,
      },
    });
    if (!t) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'برنامه یافت نشد.',
      });
    }
    const instanceCount = await this.instanceRepo.count({
      where: { scheduleTemplateId: id },
    });
    return { ...this.serialize(t), instanceCount };
  }

  private serialize(t: FlightScheduleTemplate) {
    return {
      id: t.id,
      originAirportId: t.originAirportId,
      destinationAirportId: t.destinationAirportId,
      originCode: t.originAirport?.code,
      destCode: t.destinationAirport?.code,
      flightNoBase: t.flightNoBase,
      aircraftDefinitionId: t.aircraftDefinitionId,
      aircraftCode: t.aircraftDefinition?.code,
      departureTime: t.departureTime,
      durationMinutes: t.durationMinutes,
      startDate: t.startDate,
      endDate: t.endDate,
      weekdays: t.weekdays,
      agencyPriceIrr: t.agencyPriceIrr.toString(),
      legalCeilingIrr: t.legalCeilingIrr.toString(),
      cabinCapacities: t.cabinCapacities,
      status: t.status,
      idempotencyKey: t.idempotencyKey,
      createdByUserId: t.createdByUserId,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      deactivatedAt: t.deactivatedAt?.toISOString() ?? null,
    };
  }
}

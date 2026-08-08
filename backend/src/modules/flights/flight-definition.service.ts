import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Airport } from '../../database/entities/airport.entity';
import { AircraftSeatMap } from '../../database/entities/aircraft-seat-map.entity';
import { Booking } from '../../database/entities/booking.entity';
import { Flight } from '../../database/entities/flight.entity';
import { FlightChargeRule } from '../../database/entities/flight-charge-rule.entity';
import { FlightInstance } from '../../database/entities/flight-instance.entity';
import { Route } from '../../database/entities/route.entity';
import { FarePricingProposal } from '../../database/entities/fare-pricing-proposal.entity';
import {
  CabinClass,
  FlightDefinitionStatus,
  PricingProposalStatus,
} from '../../database/enums';
import { ErrorCode } from '../../common/errors';
import type { Irr } from '../../common/money';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuditService } from '../audit/audit.service';
import {
  calculateChargesForCabin,
  serializeChargeRule,
  type CalculatedChargeBreakdown,
} from './charge-rules';
import { normalizeChargeRuleInputs } from './charge-rule-validation';
import type {
  ChargeRuleDto,
  CreateFlightDefinitionDto,
  UpdateFlightDefinitionDto,
} from './dto/flight-definition.dto';
import {
  assertValidFlightNo,
  arrivalFromDuration,
  normalizeCabinCapacities,
  serializeCabinCapacities,
  type NormalizedCabinCapacity,
} from './flight-definition.util';
import { resolveAircraftType } from './aircraft-type.util';
import {
  countSeatsByCabin,
  type AircraftSeatMapLike,
} from '../reservation/seat-layout';

const SOLD_STATUSES = ['PAID', 'TICKETED'] as const;

export type DefinitionSnapshot = {
  flightNo: string;
  originCode: string;
  destCode: string;
  departureAt: string;
  durationMinutes: number;
  aircraftType: string;
  capacity: number;
  charterSeats: number;
  cabinCapacities: NormalizedCabinCapacity[];
  basePriceIrr: string | null;
  competitorPriceIrr: string | null;
  chargeRules: ReturnType<typeof serializeChargeRule>[];
};

@Injectable()
export class FlightDefinitionService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(FlightInstance)
    private readonly instanceRepo: Repository<FlightInstance>,
    @InjectRepository(Flight)
    private readonly flightRepo: Repository<Flight>,
    @InjectRepository(Route)
    private readonly routeRepo: Repository<Route>,
    @InjectRepository(Airport)
    private readonly airportRepo: Repository<Airport>,
    @InjectRepository(AircraftSeatMap)
    private readonly seatMapRepo: Repository<AircraftSeatMap>,
    @InjectRepository(FlightChargeRule)
    private readonly chargeRuleRepo: Repository<FlightChargeRule>,
    @InjectRepository(FarePricingProposal)
    private readonly proposalRepo: Repository<FarePricingProposal>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly audit: AuditService,
  ) {}

  private async findOrCreateRoute(
    originCode: string,
    destCode: string,
    durationMinutes: number,
    manager?: EntityManager,
  ) {
    const routeRepo = manager ? manager.getRepository(Route) : this.routeRepo;
    const existing = await routeRepo.findOneBy({ originCode, destCode });
    if (existing) {
      if (existing.durationMin !== durationMinutes) {
        existing.durationMin = durationMinutes;
        await routeRepo.save(existing);
      }
      return existing;
    }
    return routeRepo.save(
      routeRepo.create({
        originCode,
        destCode,
        durationMin: durationMinutes,
      }),
    );
  }

  private validateCabinCapacitiesAgainstSeatMap(
    map: AircraftSeatMapLike,
    cabinCapacities: NormalizedCabinCapacity[],
  ) {
    const physical = countSeatsByCabin(map);
    for (const row of cabinCapacities) {
      const configured = row.seats;
      const phys = physical[row.cabin];
      if (configured > 0 && phys === 0) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: `کلاس ${row.cabin} در نقشه صندلی این هواپیما تعریف نشده است.`,
        });
      }
      if (phys < configured) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: `ظرفیت ${row.cabin} از تعداد صندلی فیزیکی (${phys}) بیشتر است.`,
        });
      }
    }
  }

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

  private async countSold(flightInstanceId: string): Promise<number> {
    return this.bookingRepo.count({
      where: {
        flightInstanceId,
        status: In([...SOLD_STATUSES]),
      },
    });
  }

  private async findOrCreateFlight(
    flightNo: string,
    routeId: string,
    aircraftType: string,
  ): Promise<Flight> {
    const existingFlight = await this.flightRepo.findOneBy({ flightNo });
    if (existingFlight && existingFlight.routeId !== routeId) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این شماره پرواز قبلاً برای مسیر دیگری ثبت شده است.',
      });
    }
    if (existingFlight) return existingFlight;
    return this.flightRepo.save(
      this.flightRepo.create({
        flightNo,
        routeId,
        aircraftType,
      }),
    );
  }

  private validateChargeRules(rules: ChargeRuleDto[] | undefined) {
    return normalizeChargeRuleInputs(rules);
  }

  private buildSnapshot(input: {
    flightNo: string;
    originCode: string;
    destCode: string;
    departureAt: Date;
    durationMinutes: number;
    aircraftType: string;
    capacity: number;
    charterSeats: number;
    cabinCapacities: NormalizedCabinCapacity[];
    basePriceIrr: Irr | null;
    competitorPriceIrr: Irr | null;
    chargeRules: ReturnType<typeof serializeChargeRule>[];
  }): DefinitionSnapshot {
    return {
      flightNo: input.flightNo,
      originCode: input.originCode,
      destCode: input.destCode,
      departureAt: input.departureAt.toISOString(),
      durationMinutes: input.durationMinutes,
      aircraftType: input.aircraftType,
      capacity: input.capacity,
      charterSeats: input.charterSeats,
      cabinCapacities: input.cabinCapacities,
      basePriceIrr:
        input.basePriceIrr == null ? null : String(input.basePriceIrr),
      competitorPriceIrr:
        input.competitorPriceIrr == null
          ? null
          : String(input.competitorPriceIrr),
      chargeRules: input.chargeRules,
    };
  }

  private async replaceChargeRules(
    manager: DataSource['manager'],
    flightInstanceId: string,
    rules: ReturnType<typeof normalizeChargeRuleInputs>,
    isPendingRevision: boolean,
  ) {
    await manager.delete(FlightChargeRule, {
      flightInstanceId,
      isPendingRevision,
    });
    if (rules.length === 0) return [];
    const entities = rules.map((r) =>
      manager.create(FlightChargeRule, {
        flightInstanceId,
        title: r.title,
        kind: r.kind,
        calculationMode: r.calculationMode,
        fixedAmountIrr: r.fixedAmountIrr,
        percentageBasisPoints: r.percentageBasisPoints,
        cabin: r.cabin,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        isActive: r.isActive,
        isPendingRevision,
      }),
    );
    return manager.save(entities);
  }

  private calculatedBreakdown(
    base: Irr,
    rules: FlightChargeRule[],
    departureAt: Date,
  ): CalculatedChargeBreakdown | null {
    // Preview uses ECONOMY as the default display cabin; per-cabin
    // totals are available via calculateChargesForCabin for each cabin.
    return calculateChargesForCabin(
      base,
      rules,
      CabinClass.ECONOMY,
      departureAt,
    );
  }

  private async loadInstanceOrThrow(id: string) {
    const instance = await this.instanceRepo
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.flight', 'flight')
      .leftJoinAndSelect('flight.route', 'route')
      .where('fi.id = :id', { id })
      .getOne();
    if (!instance) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد.',
      });
    }
    return instance;
  }

  async toDefinitionDetail(instance: FlightInstance) {
    const activeRules = await this.chargeRuleRepo.find({
      where: { flightInstanceId: instance.id, isPendingRevision: false },
      order: { createdAt: 'ASC' },
    });
    const pendingRules = await this.chargeRuleRepo.find({
      where: { flightInstanceId: instance.id, isPendingRevision: true },
      order: { createdAt: 'ASC' },
    });
    const sold = await this.countSold(instance.id);
    const derivedStatus = this.derivedStatus(
      instance.status,
      sold,
      instance.capacity,
    );

    const liveDurationMinutes =
      instance.durationMinutes ??
      Math.max(
        1,
        Math.round(
          (instance.arrivalAt.getTime() - instance.departureAt.getTime()) /
            60_000,
        ),
      );

    const approvalStatus = instance.definitionStatus;
    const pendingRevision =
      approvalStatus === FlightDefinitionStatus.PENDING_REVISION;
    const pendingSnap =
      pendingRevision && instance.pendingRevisionSnapshot
        ? (instance.pendingRevisionSnapshot as DefinitionSnapshot)
        : null;

    const formFlightNo = pendingSnap?.flightNo ?? instance.flight.flightNo;
    const formOriginCode =
      pendingSnap?.originCode ?? instance.flight.route.originCode;
    const formDestCode =
      pendingSnap?.destCode ?? instance.flight.route.destCode;
    const formDepartureAt = pendingSnap
      ? new Date(pendingSnap.departureAt)
      : instance.departureAt;
    const formDurationMinutes =
      pendingSnap?.durationMinutes ?? liveDurationMinutes;
    const formArrivalAt = pendingSnap
      ? arrivalFromDuration(formDepartureAt, formDurationMinutes)
      : instance.arrivalAt;
    const formCapacity = pendingSnap?.capacity ?? instance.capacity;
    const formCharterSeats = pendingSnap?.charterSeats ?? instance.charterSeats;
    const formCabinCapacities = pendingSnap
      ? pendingSnap.cabinCapacities
      : serializeCabinCapacities(instance.cabinCapacities);
    const formBasePriceIrr =
      pendingSnap?.basePriceIrr != null
        ? BigInt(pendingSnap.basePriceIrr)
        : instance.basePriceIrr;
    const formCompetitorPriceIrr =
      pendingSnap?.competitorPriceIrr != null
        ? BigInt(pendingSnap.competitorPriceIrr)
        : instance.competitorPriceIrr;
    const formAircraftType =
      pendingSnap?.aircraftType ?? resolveAircraftType(instance);

    const chargeRulesForResponse =
      pendingRevision && pendingRules.length > 0
        ? pendingRules.map(serializeChargeRule)
        : pendingSnap?.chargeRules?.length
          ? pendingSnap.chargeRules
          : activeRules.map(serializeChargeRule);
    const rulesForPreview =
      pendingRevision && pendingRules.length > 0 ? pendingRules : activeRules;

    const base = formBasePriceIrr ?? 0n;
    const calculatedChargeBreakdown = this.calculatedBreakdown(
      base,
      rulesForPreview.filter((r) => r.isActive),
      formDepartureAt,
    );

    // Definition edits are allowed except while the first submission sits
    // with the CEO (PENDING_CEO). PENDING_REVISION keeps the live snapshot
    // and stages a new draft the commercial team can still adjust.
    const canEdit = approvalStatus !== FlightDefinitionStatus.PENDING_CEO;
    const editBlockedReason = canEdit
      ? null
      : 'این تعریف در انتظار تأیید مدیرعامل است.';

    return {
      id: instance.id,
      flightNo: formFlightNo,
      originCode: formOriginCode,
      destCode: formDestCode,
      departureAt: formDepartureAt.toISOString(),
      arrivalAt: formArrivalAt.toISOString(),
      capacity: formCapacity,
      charterSeats: formCharterSeats,
      sold,
      basePriceIrr: formBasePriceIrr,
      competitorPriceIrr: formCompetitorPriceIrr,
      derivedStatus,
      aircraftType: formAircraftType,
      durationMinutes: formDurationMinutes,
      cabinCapacities: formCabinCapacities,
      chargeRules: chargeRulesForResponse,
      calculatedChargeBreakdown,
      approvalStatus,
      rejectionReason: instance.rejectionReason,
      canEdit: Boolean(canEdit),
      editBlockedReason,
      pendingRevision,
      approvedSnapshot: instance.approvedSnapshot,
      pendingRevisionSnapshot: instance.pendingRevisionSnapshot,
      definitionStatus: instance.definitionStatus,
    };
  }

  async getDefinition(id: string) {
    const instance = await this.loadInstanceOrThrow(id);
    return this.toDefinitionDetail(instance);
  }

  async createDefinition(
    actor: AuthenticatedUser,
    dto: CreateFlightDefinitionDto,
  ) {
    assertValidFlightNo(dto.flightNo);
    if (dto.originCode === dto.destCode) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'مبدأ و مقصد نمی‌توانند یکسان باشند.',
      });
    }
    const airports = await this.airportRepo.find({
      where: { code: In([dto.originCode, dto.destCode]), active: true },
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
    const durationMinutes = dto.durationMinutes;
    const arrivalAt = arrivalFromDuration(departureAt, durationMinutes);
    if (arrivalAt <= departureAt) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'زمان ورود باید بعد از زمان خروج باشد.',
      });
    }

    const charterSeats = dto.charterSeats ?? 0;
    if (charterSeats >= dto.capacity) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'تعهد چارتری باید کمتر از تعداد صندلی موجود باشد.',
      });
    }

    const cabinCapacities = normalizeCabinCapacities(
      dto.cabinCapacities,
      dto.capacity,
    );
    const chargeInputs = this.validateChargeRules(dto.chargeRules);

    const aircraftType =
      (dto.aircraftType ?? 'Airbus A320').trim() || 'Airbus A320';
    const map = await this.seatMapRepo.findOneBy({ aircraftType });
    if (!map) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'نوع هواپیمای انتخاب‌شده در کاتالوگ نیست.',
      });
    }
    this.validateCabinCapacitiesAgainstSeatMap(map, cabinCapacities);

    const createdId = await this.dataSource.transaction(async (manager) => {
      let route = await manager.findOneBy(Route, {
        originCode: dto.originCode,
        destCode: dto.destCode,
      });
      if (!route) {
        route = await manager.save(
          manager.create(Route, {
            originCode: dto.originCode,
            destCode: dto.destCode,
            durationMin: durationMinutes,
          }),
        );
      } else if (route.durationMin !== durationMinutes) {
        route.durationMin = durationMinutes;
        await manager.save(route);
      }

      const existingFlight = await manager.findOneBy(Flight, {
        flightNo: dto.flightNo,
      });
      let flight = existingFlight;
      if (!flight) {
        flight = await manager.save(
          manager.create(Flight, {
            flightNo: dto.flightNo,
            routeId: route.id,
            aircraftType,
          }),
        );
      } else if (flight.routeId !== route.id) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این شماره پرواز قبلاً برای مسیر دیگری ثبت شده است.',
        });
      }

      const instance = await manager.save(
        manager.create(FlightInstance, {
          flightId: flight.id,
          departureAt,
          arrivalAt,
          capacity: dto.capacity,
          charterSeats,
          status: 'SCHEDULED',
          basePriceIrr: dto.basePriceIrr,
          durationMinutes,
          competitorPriceIrr: dto.competitorPriceIrr ?? null,
          cabinCapacities,
          definitionStatus: FlightDefinitionStatus.PENDING_CEO,
          rejectionReason: null,
          approvedSnapshot: null,
          pendingRevisionSnapshot: null,
          ...(existingFlight && dto.aircraftType
            ? { aircraftTypeOverride: aircraftType }
            : {}),
        }),
      );

      await this.replaceChargeRules(manager, instance.id, chargeInputs, false);
      await manager.save(
        manager.create(FarePricingProposal, {
          flightInstanceId: instance.id,
          basePriceIrr: dto.basePriceIrr,
          competitorPriceIrr: dto.competitorPriceIrr ?? null,
          proposedPriceIrr: dto.basePriceIrr,
          legalRateIrr: null,
          note: null,
          proposedById: actor.id,
          status: PricingProposalStatus.PENDING,
          updatedAt: new Date(),
        }),
      );
      return instance.id;
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'افزودن و ارسال تعریف پرواز',
      detail: `تعریف پرواز ${dto.flightNo} (${dto.originCode} ← ${dto.destCode}) توسط ${actor.fullName} ایجاد و برای تأیید مدیرعامل ارسال شد.`,
      entityType: 'FlightInstance',
      entityId: createdId,
      metadata: {
        durationMinutes,
        cabinCapacities,
        chargeRuleCount: chargeInputs.length,
        definitionStatus: FlightDefinitionStatus.PENDING_CEO,
      },
    });

    return this.getDefinition(createdId);
  }

  async updateDefinition(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateFlightDefinitionDto,
  ) {
    assertValidFlightNo(dto.flightNo);
    const instance = await this.loadInstanceOrThrow(id);

    if (dto.originCode === dto.destCode) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'مبدأ و مقصد نمی‌توانند یکسان باشند.',
      });
    }
    const airports = await this.airportRepo.find({
      where: { code: In([dto.originCode, dto.destCode]), active: true },
    });
    if (airports.length !== 2) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'فرودگاه انتخاب‌شده معتبر نیست.',
      });
    }

    const departureAt = new Date(dto.departureAt);
    if (Number.isNaN(departureAt.getTime())) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'تاریخ و ساعت پرواز نامعتبر است.',
      });
    }
    const durationMinutes = dto.durationMinutes;
    const arrivalAt = arrivalFromDuration(departureAt, durationMinutes);
    const cabinCapacities = normalizeCabinCapacities(
      dto.cabinCapacities,
      dto.capacity,
    );
    const chargeInputs = this.validateChargeRules(dto.chargeRules);
    const charterSeats = dto.charterSeats ?? instance.charterSeats;
    if (charterSeats >= dto.capacity) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'تعهد چارتری باید کمتر از تعداد صندلی موجود باشد.',
      });
    }

    const aircraftType =
      (dto.aircraftType ?? resolveAircraftType(instance)).trim() ||
      'Airbus A320';
    const map = await this.seatMapRepo.findOneBy({ aircraftType });
    if (!map) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'نوع هواپیمای انتخاب‌شده در کاتالوگ نیست.',
      });
    }
    this.validateCabinCapacitiesAgainstSeatMap(map, cabinCapacities);

    const status = instance.definitionStatus;

    if (status === FlightDefinitionStatus.PENDING_CEO) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          'این تعریف در انتظار تأیید مدیرعامل است و فعلاً قابل ویرایش نیست.',
      });
    }

    const isApprovedLive =
      status === FlightDefinitionStatus.APPROVED ||
      (status === FlightDefinitionStatus.PENDING_REVISION &&
        instance.approvedSnapshot != null);

    await this.dataSource.transaction(async (manager) => {
      const route = await this.findOrCreateRoute(
        dto.originCode,
        dto.destCode,
        durationMinutes,
        manager,
      );
      const flight = await manager.findOneByOrFail(Flight, {
        id: instance.flightId,
      });
      if (flight.flightNo !== dto.flightNo) {
        const clash = await manager.findOneBy(Flight, {
          flightNo: dto.flightNo,
        });
        if (clash && clash.id !== flight.id) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'این شماره پرواز قبلاً ثبت شده است.',
          });
        }
        // Do not mutate active flightNo on APPROVED — goes into revision.
        if (!isApprovedLive) {
          flight.flightNo = dto.flightNo;
          flight.routeId = route.id;
          flight.aircraftType = aircraftType;
          await manager.save(flight);
        }
      } else if (!isApprovedLive) {
        flight.routeId = route.id;
        flight.aircraftType = aircraftType;
        await manager.save(flight);
      }

      const serializedRules = chargeInputs.map((r) => ({
        title: r.title,
        kind: r.kind,
        calculationMode: r.calculationMode,
        fixedAmountIrr:
          r.fixedAmountIrr == null ? null : String(r.fixedAmountIrr),
        percentageBasisPoints: r.percentageBasisPoints,
        cabin: r.cabin,
        validFrom: r.effectiveFrom?.toISOString() ?? null,
        validUntil: r.effectiveTo?.toISOString() ?? null,
        active: r.isActive,
        effectiveFrom: r.effectiveFrom?.toISOString() ?? null,
        effectiveTo: r.effectiveTo?.toISOString() ?? null,
        isActive: r.isActive,
      }));

      const snapshot = this.buildSnapshot({
        flightNo: dto.flightNo,
        originCode: dto.originCode,
        destCode: dto.destCode,
        departureAt,
        durationMinutes,
        aircraftType,
        capacity: dto.capacity,
        charterSeats,
        cabinCapacities,
        basePriceIrr: dto.basePriceIrr,
        competitorPriceIrr: dto.competitorPriceIrr ?? null,
        chargeRules: serializedRules,
      });

      if (isApprovedLive) {
        // Keep live columns + active charge rules intact; stage revision.
        instance.pendingRevisionSnapshot = snapshot;
        instance.definitionStatus = FlightDefinitionStatus.PENDING_REVISION;
        instance.rejectionReason = null;
        await manager.save(instance);
        await this.replaceChargeRules(manager, instance.id, chargeInputs, true);

        // Re-open pricing proposal for CEO review of revision (if registered).
        const proposal = await manager
          .createQueryBuilder(FarePricingProposal, 'p')
          .where('p.flightInstanceId = :id', { id: instance.id })
          .getOne();
        if (proposal && proposal.status === 'REGISTERED') {
          proposal.status = 'PENDING';
          proposal.registeredPriceIrr = null;
          proposal.approvedAt = null;
          proposal.approvedById = null;
          proposal.rejectionReason = null;
          proposal.rejectedAt = null;
          proposal.rejectedById = null;
          proposal.proposedPriceIrr = dto.basePriceIrr;
          if (dto.competitorPriceIrr != null) {
            proposal.competitorPriceIrr = dto.competitorPriceIrr;
          }
          proposal.updatedAt = new Date();
          await manager.save(proposal);
        } else if (proposal && proposal.status === 'REJECTED') {
          proposal.status = 'PENDING';
          proposal.proposedPriceIrr = dto.basePriceIrr;
          proposal.rejectionReason = null;
          proposal.rejectedAt = null;
          proposal.rejectedById = null;
          proposal.updatedAt = new Date();
          await manager.save(proposal);
        }
      } else {
        // Direct mutate for DRAFT / REJECTED / first PENDING_REVISION without snapshot.
        instance.departureAt = departureAt;
        instance.arrivalAt = arrivalAt;
        instance.durationMinutes = durationMinutes;
        instance.capacity = dto.capacity;
        instance.charterSeats = charterSeats;
        instance.basePriceIrr = dto.basePriceIrr;
        instance.competitorPriceIrr = dto.competitorPriceIrr ?? null;
        instance.cabinCapacities = cabinCapacities;
        instance.definitionStatus =
          status === FlightDefinitionStatus.REJECTED
            ? FlightDefinitionStatus.DRAFT
            : status === FlightDefinitionStatus.DRAFT
              ? FlightDefinitionStatus.DRAFT
              : FlightDefinitionStatus.DRAFT;
        instance.rejectionReason = null;
        instance.pendingRevisionSnapshot = null;
        if (dto.aircraftType) {
          instance.aircraftTypeOverride = aircraftType;
        }
        await manager.save(instance);
        await this.replaceChargeRules(
          manager,
          instance.id,
          chargeInputs,
          false,
        );
      }
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: isApprovedLive ? 'ثبت بازنگری تعریف پرواز' : 'ویرایش تعریف پرواز',
      detail: `تعریف پرواز ${dto.flightNo} توسط ${actor.fullName} ${
        isApprovedLive ? 'برای تأیید مجدد ارسال شد' : 'ویرایش شد'
      }.`,
      entityType: 'FlightInstance',
      entityId: id,
      metadata: {
        previousStatus: status,
        nextStatus: isApprovedLive
          ? FlightDefinitionStatus.PENDING_REVISION
          : FlightDefinitionStatus.DRAFT,
      },
    });

    return this.getDefinition(id);
  }

  /**
   * Promote pending revision (or first approval) onto the live instance.
   * Called from pricing.register after CEO step-up.
   */
  async applyCeoApprovalInTx(
    manager: EntityManager,
    flightInstanceId: string,
  ): Promise<void> {
    const instance = await manager.findOne(FlightInstance, {
      where: { id: flightInstanceId },
      relations: { flight: { route: true } },
    });
    if (!instance?.flight?.route) return;

    if (
      instance.definitionStatus === FlightDefinitionStatus.PENDING_REVISION &&
      instance.pendingRevisionSnapshot
    ) {
      const snap = instance.pendingRevisionSnapshot as DefinitionSnapshot;
      const departureAt = new Date(snap.departureAt);
      const arrivalAt = arrivalFromDuration(departureAt, snap.durationMinutes);
      instance.departureAt = departureAt;
      instance.arrivalAt = arrivalAt;
      instance.durationMinutes = snap.durationMinutes;
      instance.capacity = snap.capacity;
      instance.charterSeats = snap.charterSeats;
      instance.basePriceIrr =
        snap.basePriceIrr != null ? BigInt(snap.basePriceIrr) : null;
      instance.competitorPriceIrr =
        snap.competitorPriceIrr != null
          ? BigInt(snap.competitorPriceIrr)
          : null;
      instance.cabinCapacities = snap.cabinCapacities;
      instance.approvedSnapshot = snap;
      instance.pendingRevisionSnapshot = null;
      instance.definitionStatus = FlightDefinitionStatus.APPROVED;
      instance.rejectionReason = null;

      const flight = await manager.findOneByOrFail(Flight, {
        id: instance.flightId,
      });
      flight.flightNo = snap.flightNo;
      flight.aircraftType = snap.aircraftType;
      const route = await this.findOrCreateRoute(
        snap.originCode,
        snap.destCode,
        snap.durationMinutes,
        manager,
      );
      flight.routeId = route.id;
      await manager.save(flight);

      // Promote pending rules → active.
      await manager.delete(FlightChargeRule, {
        flightInstanceId: instance.id,
        isPendingRevision: false,
      });
      await manager
        .createQueryBuilder()
        .update(FlightChargeRule)
        .set({ isPendingRevision: false })
        .where('"flightInstanceId" = :id AND "isPendingRevision" = true', {
          id: instance.id,
        })
        .execute();

      await manager.save(instance);
      return;
    }

    // First-time approval of DRAFT / PENDING_CEO / REJECTED→pending path.
    const activeRules = await manager.find(FlightChargeRule, {
      where: {
        flightInstanceId: instance.id,
        isPendingRevision: false,
      },
    });
    const cabinCapacities = serializeCabinCapacities(instance.cabinCapacities);
    const durationMinutes =
      instance.durationMinutes ??
      Math.max(
        1,
        Math.round(
          (instance.arrivalAt.getTime() - instance.departureAt.getTime()) /
            60_000,
        ),
      );
    const snapshot = this.buildSnapshot({
      flightNo: instance.flight.flightNo,
      originCode: instance.flight.route.originCode,
      destCode: instance.flight.route.destCode,
      departureAt: instance.departureAt,
      durationMinutes,
      aircraftType: resolveAircraftType(instance),
      capacity: instance.capacity,
      charterSeats: instance.charterSeats,
      cabinCapacities,
      basePriceIrr: instance.basePriceIrr,
      competitorPriceIrr: instance.competitorPriceIrr,
      chargeRules: activeRules.map(serializeChargeRule),
    });
    instance.approvedSnapshot = snapshot;
    instance.pendingRevisionSnapshot = null;
    instance.definitionStatus = FlightDefinitionStatus.APPROVED;
    instance.rejectionReason = null;
    await manager.save(instance);
  }

  async applyCeoApproval(flightInstanceId: string): Promise<void> {
    await this.dataSource.transaction((manager) =>
      this.applyCeoApprovalInTx(manager, flightInstanceId),
    );
  }

  async applyCeoRejectionInTx(
    manager: EntityManager,
    flightInstanceId: string,
    reason: string,
  ): Promise<void> {
    const instance = await manager.findOne(FlightInstance, {
      where: { id: flightInstanceId },
    });
    if (!instance) return;

    if (instance.definitionStatus === FlightDefinitionStatus.PENDING_REVISION) {
      // Discard pending revision; keep approved live version.
      await manager.delete(FlightChargeRule, {
        flightInstanceId,
        isPendingRevision: true,
      });
      instance.pendingRevisionSnapshot = null;
      instance.definitionStatus = FlightDefinitionStatus.APPROVED;
      instance.rejectionReason = reason;
    } else if (
      instance.definitionStatus === FlightDefinitionStatus.DRAFT ||
      instance.definitionStatus === FlightDefinitionStatus.PENDING_CEO
    ) {
      instance.definitionStatus = FlightDefinitionStatus.REJECTED;
      instance.rejectionReason = reason;
    } else {
      instance.rejectionReason = reason;
    }
    await manager.save(instance);
  }

  async applyCeoRejection(
    flightInstanceId: string,
    reason: string,
  ): Promise<void> {
    await this.dataSource.transaction((manager) =>
      this.applyCeoRejectionInTx(manager, flightInstanceId, reason),
    );
  }

  /** Mark definition awaiting CEO when a pricing proposal is submitted. */
  async markPendingCeoInTx(
    manager: EntityManager,
    flightInstanceId: string,
  ): Promise<void> {
    const instance = await manager.findOne(FlightInstance, {
      where: { id: flightInstanceId },
    });
    if (!instance) return;
    if (
      instance.definitionStatus === FlightDefinitionStatus.DRAFT ||
      instance.definitionStatus === FlightDefinitionStatus.REJECTED
    ) {
      instance.definitionStatus = FlightDefinitionStatus.PENDING_CEO;
      instance.rejectionReason = null;
      await manager.save(instance);
    }
  }

  async markPendingCeo(flightInstanceId: string): Promise<void> {
    await this.dataSource.transaction((manager) =>
      this.markPendingCeoInTx(manager, flightInstanceId),
    );
  }
}

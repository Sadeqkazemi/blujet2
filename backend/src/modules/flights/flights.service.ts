import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { RRule } from 'rrule';
import { FlightInstance } from '../../database/entities/flight-instance.entity';
import { Flight } from '../../database/entities/flight.entity';
import { Route } from '../../database/entities/route.entity';
import { Airport } from '../../database/entities/airport.entity';
import { AircraftSeatMap } from '../../database/entities/aircraft-seat-map.entity';
import { Schedule } from '../../database/entities/schedule.entity';
import { FareRule } from '../../database/entities/fare-rule.entity';
import { AgencyAllotment } from '../../database/entities/agency-allotment.entity';
import { AgencyProfile } from '../../database/entities/agency-profile.entity';
import { Booking } from '../../database/entities/booking.entity';
import { Passenger } from '../../database/entities/passenger.entity';
import { SeatLock } from '../../database/entities/seat-lock.entity';
import { FarePricingProposal } from '../../database/entities/fare-pricing-proposal.entity';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import { enumerateSeats } from '../reservation/seat-layout';
import { resolveAircraftType } from './aircraft-type.util';
import { serializeCabinCapacities } from './flight-definition.util';
import { materializeDepartedInstances } from './flight-lifecycle.util';
import {
  PRICE_SUGGESTION_PROVIDER,
  type PriceSuggestionProvider,
} from '../ai/price-suggestion.provider';
import { StepUpService } from '../auth/step-up.service';
import type { PersistedAiSuggestion } from '../pricing/pricing.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  ZERO_IRR,
  addIrr,
  divRoundBigInt,
  maxIrr,
  subIrr,
} from '../../common/money';
import type { Irr } from '../../common/money';
import { RedisService } from '../../redis/redis.service';
import {
  FlightDefinitionStatus,
  FlightInstanceStatus,
  type CabinClass,
} from '../../database/enums';

/** SCHEDULED instances departing beyond this window belong to the
 * پروازهای آینده sub-tab; the rest are پروازهای فعال. */
const FUTURE_WINDOW_DAYS = 7;

/** Statuses that count as a sold seat (design: «صندلی فروخته‌شده»). */
const SOLD_STATUSES = ['PAID', 'TICKETED'] as const;

@Injectable()
export class FlightsService {
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
    @InjectRepository(Schedule)
    private readonly scheduleRepo: Repository<Schedule>,
    @InjectRepository(FareRule)
    private readonly fareRuleRepo: Repository<FareRule>,
    @InjectRepository(AgencyAllotment)
    private readonly allotmentRepo: Repository<AgencyAllotment>,
    @InjectRepository(AgencyProfile)
    private readonly agencyProfileRepo: Repository<AgencyProfile>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Passenger)
    private readonly passengerRepo: Repository<Passenger>,
    @InjectRepository(SeatLock)
    private readonly seatLockRepo: Repository<SeatLock>,
    @InjectRepository(FarePricingProposal)
    private readonly proposalRepo: Repository<FarePricingProposal>,
    private readonly audit: AuditService,
    @Inject(PRICE_SUGGESTION_PROVIDER)
    private readonly priceSuggestions: PriceSuggestionProvider,
    private readonly stepUp: StepUpService,
    private readonly redis: RedisService,
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

  private baseRow(i: FlightInstance, sold: number) {
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
    const instances = await this.instanceRepo
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.flight', 'flight')
      .leftJoinAndSelect('flight.route', 'route')
      .orderBy('fi.departureAt', 'ASC')
      .getMany();
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
        aiSuggestion: i.aiSuggestion as unknown as PersistedAiSuggestion | null,
        competitorPriceIrr: i.competitorPriceIrr,
      };
    });

    const future = futureRows.map((i) => ({
      ...this.baseRow(i, sold.get(i.id) ?? 0),
      agencySeatsAllocated: i.agencySeatsAllocated,
      aiSuggestion: i.aiSuggestion as unknown as PersistedAiSuggestion | null,
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
    await materializeDepartedInstances(this.dataSource);
    const departed = await this.instanceRepo
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.flight', 'flight')
      .leftJoinAndSelect('flight.route', 'route')
      .where('fi.status = :status', { status: 'DEPARTED' })
      .orderBy('fi.departureAt', 'DESC')
      .take(30)
      .getMany();

    const byChannel = departed.length
      ? await this.bookingRepo
          .createQueryBuilder('b')
          .select('b.flightInstanceId', 'flightInstanceId')
          .addSelect('b.channel', 'channel')
          .addSelect('COUNT(*)', 'count')
          .addSelect('SUM(b.priceIrr)', 'sumPriceIrr')
          .where('b.flightInstanceId IN (:...ids)', {
            ids: departed.map((d) => d.id),
          })
          .andWhere('b.status IN (:...statuses)', {
            statuses: [...SOLD_STATUSES],
          })
          .groupBy('b.flightInstanceId')
          .addGroupBy('b.channel')
          .getRawMany<{
            flightInstanceId: string;
            channel: 'SYSTEM' | 'CHARTER' | 'AGENCY';
            count: string;
            sumPriceIrr: string | null;
          }>()
      : [];

    const rows = departed.map((i) => {
      const channels = {
        SYSTEM: ZERO_IRR,
        CHARTER: ZERO_IRR,
        AGENCY: ZERO_IRR,
      } as Record<'SYSTEM' | 'CHARTER' | 'AGENCY', Irr>;
      let tickets = 0;
      let revenueIrr: Irr = ZERO_IRR;
      for (const c of byChannel.filter((b) => b.flightInstanceId === i.id)) {
        const sum = BigInt(c.sumPriceIrr ?? '0');
        channels[c.channel] = sum;
        tickets += Number(c.count);
        revenueIrr = addIrr(revenueIrr, sum);
      }
      const base = i.basePriceIrr ?? ZERO_IRR;
      const avgIrr: Irr =
        tickets > 0 ? divRoundBigInt(revenueIrr, BigInt(tickets)) : ZERO_IRR;
      const delta: Irr = subIrr(avgIrr, base) * BigInt(tickets);
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
        profitIrr: maxIrr(delta, ZERO_IRR),
        lossIrr: maxIrr(-delta, ZERO_IRR),
      };
    });

    return {
      rows,
      kpis: {
        totalSalesIrr: rows.reduce((a, r) => addIrr(a, r.revenueIrr), ZERO_IRR),
        totalProfitIrr: rows.reduce((a, r) => addIrr(a, r.profitIrr), ZERO_IRR),
        totalTickets: rows.reduce((a, r) => a + r.tickets, 0),
        flightCount: rows.length,
      },
    };
  }

  async airports() {
    return this.airportRepo.find({
      where: { active: true },
      order: { cityFa: 'ASC', code: 'ASC' },
    });
  }

  async createAirport(
    actor: AuthenticatedUser,
    dto: {
      code: string;
      cityFa: string;
      airportNameFa?: string;
      tz?: string;
    },
  ) {
    const code = dto.code.trim().toUpperCase();
    const cityFa = dto.cityFa.trim();
    const airportNameFa = dto.airportNameFa?.trim() || null;
    if (!cityFa) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'نام شهر الزامی است.',
      });
    }
    const existing = await this.airportRepo.findOneBy({ code });
    if (existing) {
      if (!existing.active) {
        existing.cityFa = cityFa;
        existing.airportNameFa = airportNameFa;
        existing.tz = dto.tz?.trim() || existing.tz || 'Asia/Tehran';
        existing.active = true;
        const restored = await this.airportRepo.save(existing);
        await this.redis.del('search:airports');
        await this.audit.record({
          actorId: actor.id,
          actorRole: actor.role,
          category: 'SYSTEM',
          action: 'بازگردانی شهر پروازی',
          detail: `شهر «${cityFa}» (${code}) توسط ${actor.fullName} دوباره فعال شد.`,
          entityType: 'Airport',
          entityId: restored.id,
        });
        return restored;
      }
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'فرودگاهی با این کد قبلاً ثبت شده است.',
      });
    }
    // A city may legitimately have more than one airport (THR/IKA,
    // DXB/DWC, IST/SAW); uniqueness belongs to the IATA code, not city name.
    const created = await this.airportRepo.save(
      this.airportRepo.create({
        code,
        cityFa,
        airportNameFa,
        tz: dto.tz?.trim() || 'Asia/Tehran',
        active: true,
      }),
    );
    await this.redis.del('search:airports');
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'افزودن شهر پروازی',
      detail: `شهر «${cityFa}» (${code}) توسط ${actor.fullName} ثبت شد.`,
      entityType: 'Airport',
      entityId: created.id,
    });
    return created;
  }

  async removeAirport(actor: AuthenticatedUser, id: string) {
    const airport = await this.airportRepo.findOneBy({ id });
    if (!airport) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'فرودگاه یافت نشد.',
      });
    }
    // Soft-delete keeps historical route/ticket/report labels resolvable while
    // immediately removing the city from every new-flight/search selector.
    airport.active = false;
    await this.airportRepo.save(airport);
    await this.redis.del('search:airports');
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'حذف شهر پروازی',
      detail: `شهر «${airport.cityFa}» (${airport.code}) توسط ${actor.fullName} حذف شد.`,
      entityType: 'Airport',
      entityId: id,
    });
    return { id };
  }

  /** Reference data for the aircraft-type-change form — no such listing
   * existed anywhere; every other caller of `AircraftSeatMap` already
   * knows the exact type string it wants (e.g. from `Flight.aircraftType`
   * or a `changeAircraftType` override), so this is the first place that
   * needs the full catalog. */
  async aircraftTypes() {
    const maps = await this.seatMapRepo.find({
      order: { aircraftType: 'ASC' },
    });
    return maps.map((m) => ({
      aircraftType: m.aircraftType,
      capacity: enumerateSeats(m).length,
    }));
  }

  private async findOrCreateRoute(originCode: string, destCode: string) {
    const existing = await this.routeRepo.findOneBy({ originCode, destCode });
    if (existing) return existing;
    return this.routeRepo.save(this.routeRepo.create({ originCode, destCode }));
  }

  private async findOrCreateFlight(
    flightNo: string,
    routeId: string,
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
        aircraftType: 'Airbus A320',
      }),
    );
  }

  async create(
    actor: AuthenticatedUser,
    dto: {
      originCode: string;
      destCode: string;
      flightNo: string;
      departureAt: string;
      capacity: number;
      basePriceIrr: Irr;
      aircraftType?: string;
      charterSeats?: number;
    },
  ) {
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

    const charterSeats = dto.charterSeats ?? 0;
    if (charterSeats >= dto.capacity) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'تعهد چارتری باید کمتر از تعداد صندلی موجود باشد.',
      });
    }

    const aircraftType =
      (dto.aircraftType ?? 'Airbus A320').trim() || 'Airbus A320';
    if (dto.aircraftType) {
      const map = await this.seatMapRepo.findOneBy({ aircraftType });
      if (!map) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'نوع هواپیمای انتخاب‌شده در کاتالوگ نیست.',
        });
      }
    }

    const route = await this.findOrCreateRoute(dto.originCode, dto.destCode);
    const existingFlight = await this.flightRepo.findOneBy({
      flightNo: dto.flightNo,
    });
    const flight = await this.findOrCreateFlight(dto.flightNo, route.id);
    if (dto.aircraftType && !existingFlight) {
      flight.aircraftType = aircraftType;
      await this.flightRepo.save(flight);
    }

    const created = await this.instanceRepo.save(
      this.instanceRepo.create({
        flightId: flight.id,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + route.durationMin * 60_000),
        capacity: dto.capacity,
        charterSeats,
        status: 'SCHEDULED',
        definitionStatus: FlightDefinitionStatus.DRAFT,
        basePriceIrr: dto.basePriceIrr,
        ...(existingFlight && dto.aircraftType
          ? { aircraftTypeOverride: aircraftType }
          : {}),
      }),
    );
    const instance = await this.instanceRepo
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.flight', 'flight')
      .leftJoinAndSelect('flight.route', 'route')
      .where('fi.id = :id', { id: created.id })
      .getOneOrFail();

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
    const byChannel = await this.bookingRepo
      .createQueryBuilder('b')
      .select('b.channel', 'channel')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(b.priceIrr)', 'sumPriceIrr')
      .where('b.flightInstanceId = :id', { id })
      .andWhere('b.status IN (:...statuses)', {
        statuses: [...SOLD_STATUSES],
      })
      .groupBy('b.channel')
      .getRawMany<{
        channel: 'SYSTEM' | 'CHARTER' | 'AGENCY';
        count: string;
        sumPriceIrr: string | null;
      }>();
    const channels = (['SYSTEM', 'CHARTER', 'AGENCY'] as const).map((ch) => {
      const row = byChannel.find((b) => b.channel === ch);
      return {
        channel: ch,
        seats: row ? Number(row.count) : 0,
        revenueIrr: row ? BigInt(row.sumPriceIrr ?? '0') : ZERO_IRR,
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
      totalRevenueIrr: channels.reduce(
        (a, c) => addIrr(a, c.revenueIrr),
        ZERO_IRR,
      ),
      occupancyPct:
        instance.capacity > 0
          ? Math.round((sold / instance.capacity) * 100)
          : 0,
      aircraftType: resolveAircraftType(instance),
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
      priceIrr: Irr;
      agencySeats: number;
      saleStartsAt?: string;
      saleEndsAt?: string;
    },
  ) {
    const instance = await this.instanceRepo
      .createQueryBuilder('fi')
      .where('fi.id = :id', { id })
      .getOne();
    if (!instance || instance.status !== 'SCHEDULED') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز برنامه‌ریزی‌شده یافت نشد.',
      });
    }
    const pricing = await this.proposalRepo
      .createQueryBuilder('p')
      .where('p.flightInstanceId = :id', { id })
      .getOne();
    if (pricing?.status === 'REGISTERED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          'پیشنهاد اولیه تأیید شده است؛ برای اصلاح نرخ از عملیات تغییر قیمت فروش استفاده کنید.',
      });
    }
    const agencyMax = instance.capacity - instance.charterSeats;
    if (dto.agencySeats > agencyMax) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `تخصیص آژانس نمی‌تواند از ${agencyMax} صندلی بیشتر باشد.`,
      });
    }

    instance.basePriceIrr = dto.priceIrr;
    instance.agencySeatsAllocated = dto.agencySeats;
    if (dto.saleStartsAt !== undefined) {
      instance.saleStartsAt = dto.saleStartsAt
        ? new Date(dto.saleStartsAt)
        : null;
    }
    if (dto.saleEndsAt !== undefined) {
      instance.saleEndsAt = dto.saleEndsAt ? new Date(dto.saleEndsAt) : null;
    }
    const updated = await this.instanceRepo.save(instance);

    if (actor.role === 'COMMERCIAL_MANAGER') {
      if (pricing) {
        pricing.proposedPriceIrr = dto.priceIrr;
        pricing.updatedAt = new Date();
        await this.proposalRepo.save(pricing);
      } else {
        await this.proposalRepo.save(
          this.proposalRepo.create({
            flightInstanceId: id,
            basePriceIrr: dto.priceIrr,
            competitorPriceIrr: dto.priceIrr,
            proposedPriceIrr: dto.priceIrr,
            proposedById: actor.id,
            updatedAt: new Date(),
          }),
        );
      }
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
    stepUpChallengeId: string,
    stepUpCode: string,
  ) {
    await this.stepUp.verify(
      actor,
      stepUpChallengeId,
      stepUpCode,
      'PRICE_CAPACITY_CHANGE',
    );
    const instance = await this.instanceRepo
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.flight', 'flight')
      .where('fi.id = :id', { id })
      .getOne();
    if (!instance) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد.',
      });
    }
    const newMap = await this.seatMapRepo.findOneBy({
      aircraftType: newAircraftType,
    });
    if (!newMap) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `نقشهٔ صندلی برای «${newAircraftType}» تعریف نشده است.`,
      });
    }
    const newCapacity = enumerateSeats(newMap).length;

    const [confirmedCount, lockCount] = await Promise.all([
      this.passengerRepo
        .createQueryBuilder('p')
        .leftJoin('p.booking', 'booking')
        .where('p.seatCode IS NOT NULL')
        .andWhere('booking.flightInstanceId = :id', { id })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: ['PAID', 'TICKETED'],
        })
        .getCount(),
      this.seatLockRepo.count({
        where: {
          flightInstanceId: id,
          releasedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
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

    const previousAircraftType = resolveAircraftType(instance);
    instance.aircraftTypeOverride = newAircraftType;
    instance.capacity = newCapacity;
    const updated = await this.instanceRepo.save(instance);

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'تغییر نوع هواپیمای پرواز',
      detail: `نوع هواپیمای پرواز ${instance.flight.flightNo} از «${previousAircraftType}» به «${newAircraftType}» توسط ${actor.fullName} تغییر کرد.`,
      entityType: 'FlightInstance',
      entityId: id,
      metadata: {
        previousAircraftType,
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

  /** Advisory ML analysis over future planning and weak-selling flights.
   * Suggestions are persisted but never applied automatically. */
  async runAiAnalysis(actor: AuthenticatedUser, requestId?: string) {
    const now = new Date();
    const futureCutoff = new Date(
      now.getTime() + FUTURE_WINDOW_DAYS * 24 * 3_600_000,
    );
    const lowSalesWindowEnd = new Date(now.getTime() + 72 * 3_600_000);
    const upcoming = await this.instanceRepo
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.flight', 'flight')
      .leftJoinAndSelect('flight.route', 'route')
      .where('fi.status = :status', { status: 'SCHEDULED' })
      .andWhere('fi.departureAt > :now', { now })
      .getMany();
    const sold = await this.soldByInstance(upcoming.map((item) => item.id));
    const analyzable = upcoming.filter((item) => {
      if (item.basePriceIrr == null) return false;
      if (item.departureAt > futureCutoff) return true;
      const occupancy =
        item.capacity > 0 ? (sold.get(item.id) ?? 0) / item.capacity : 0;
      return item.departureAt <= lowSalesWindowEnd && occupancy < 0.6;
    });
    if (analyzable.length === 0) return { analyzed: 0, available: true };

    const result = await this.priceSuggestions.suggest(
      analyzable.map((i) => {
        // ADVISORY-ONLY ML boundary (CLAUDE.md ML Service Rules): the
        // FastAPI service expects plain JSON numbers, and this payload is
        // a one-way outbound signal for a suggestion — never round-tripped
        // back into a stored/authoritative field without going through
        // NestJS's own re-pricing logic. Individual fare amounts are far
        // below 2^53, so Number() loses no precision here.
        const basePriceIrr = Number(i.basePriceIrr);
        return {
          proposal_id: i.id,
          origin_code: i.flight.route.originCode,
          dest_code: i.flight.route.destCode,
          departure_at: i.departureAt.toISOString(),
          base_price_irr: basePriceIrr,
          competitor_price_irr: Number(i.competitorPriceIrr ?? i.basePriceIrr),
          proposed_price_irr: basePriceIrr,
          capacity: i.capacity,
          charter_seats: i.charterSeats,
        };
      }),
      requestId,
    );
    if (!result) return { analyzed: 0, available: false };

    const generatedAt = new Date().toISOString();
    const futureById = new Map(analyzable.map((i) => [i.id, i]));
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
      const target = futureById.get(s.proposal_id);
      if (!target) continue;
      target.aiSuggestion = suggestion as unknown as typeof target.aiSuggestion;
      await this.instanceRepo.save(target);
    }

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'PRICING',
      action: 'تحلیل قیمت‌گذاری و فروش پروازها با هوش مصنوعی',
      detail: `تحلیل هوش مصنوعی برای ${result.suggestions.length} پرواز آینده یا کم‌فروش توسط ${actor.fullName} اجرا شد.`,
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
    const airports = await this.airportRepo.find({
      where: { code: In([dto.originCode, dto.destCode]), active: true },
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

    const route = await this.findOrCreateRoute(dto.originCode, dto.destCode);
    const flight = await this.findOrCreateFlight(dto.flightNo, route.id);

    const schedule = await this.scheduleRepo.save(
      this.scheduleRepo.create({
        flightId: flight.id,
        rrule: dto.rrule,
        depHour,
        depMinute,
        durationMin: route.durationMin,
        capacity: dto.capacity,
      }),
    );
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
   * ON CONFLICT DO NOTHING means re-running never doubles instances.
   * depHour/depMinute are UTC (storage is UTC per CLAUDE.md; rendering
   * converts to the airport's IANA tz at the edge). Bulk `.insert()`
   * bypasses entity `@BeforeInsert()` listeners, so `id` is generated
   * here explicitly per row.
   */
  async materializeSchedule(scheduleId: string, daysAhead: number) {
    const schedule = await this.scheduleRepo
      .createQueryBuilder('s')
      .where('s.id = :id', { id: scheduleId })
      .getOneOrFail();
    if (!schedule.active) return 0;

    const parsed = RRule.parseString(schedule.rrule);
    const start = new Date();
    const until = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    const rule = new RRule({ ...parsed, dtstart: start });
    const dates = rule.between(start, until, true);
    if (dates.length === 0) return 0;

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
        id: randomUUID(),
        flightId: schedule.flightId,
        scheduleId: schedule.id,
        departureAt,
        arrivalAt: new Date(
          departureAt.getTime() + schedule.durationMin * 60_000,
        ),
        capacity: schedule.capacity,
        charterSeats: 0,
        status: 'SCHEDULED' as const,
        definitionStatus: FlightDefinitionStatus.DRAFT,
      };
    });

    const result = await this.instanceRepo
      .createQueryBuilder()
      .insert()
      .into(FlightInstance)
      .values(rows)
      .orIgnore()
      .execute();
    return (result.raw as unknown[]).length;
  }

  async listSchedules() {
    const schedules = await this.scheduleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.flight', 'flight')
      .leftJoinAndSelect('flight.route', 'route')
      .orderBy('s.createdAt', 'DESC')
      .getMany();

    const counts = schedules.length
      ? await this.instanceRepo
          .createQueryBuilder('fi')
          .select('fi.scheduleId', 'scheduleId')
          .addSelect('COUNT(*)', 'count')
          .where('fi.scheduleId IN (:...ids)', {
            ids: schedules.map((s) => s.id),
          })
          .groupBy('fi.scheduleId')
          .getRawMany<{ scheduleId: string; count: string }>()
      : [];
    const countById = new Map(
      counts.map((c) => [c.scheduleId, Number(c.count)]),
    );

    return schedules.map((s) => ({
      id: s.id,
      flightNo: s.flight.flightNo,
      originCode: s.flight.route.originCode,
      destCode: s.flight.route.destCode,
      rrule: s.rrule,
      depTime: `${String(s.depHour).padStart(2, '0')}:${String(s.depMinute).padStart(2, '0')}`,
      capacity: s.capacity,
      active: s.active,
      instanceCount: countById.get(s.id) ?? 0,
    }));
  }

  // ── Phase 13 Part B: manageable fare classes ──────────────────────────

  async listFareRules(instanceId: string) {
    return this.fareRuleRepo.find({
      where: { flightInstanceId: instanceId },
      order: { cabin: 'ASC', priceIrr: 'ASC' },
    });
  }

  /** Physical seat count for one cabin — prefers flight-definition
   * cabinCapacities when present; otherwise counts seats on the map. */
  private async cabinSeatCount(
    instance: {
      flight: { aircraftType: string };
      aircraftTypeOverride: string | null;
      cabinCapacities?: unknown;
    },
    cabin: CabinClass,
  ): Promise<number> {
    const capacities = serializeCabinCapacities(instance.cabinCapacities);
    if (capacities.length > 0) {
      return capacities.find((row) => row.cabin === cabin)?.seats ?? 0;
    }
    const map = await this.seatMapRepo.findOneBy({
      aircraftType: resolveAircraftType(instance),
    });
    if (!map) return 0;
    return enumerateSeats(map).filter((s) => s.cabin === cabin).length;
  }

  private cabinLabelFa(cabin: CabinClass): string {
    switch (cabin) {
      case 'FIRST':
        return 'درجه یک';
      case 'BUSINESS':
        return 'بیزینس';
      case 'COMFORT':
        return 'کامفورت';
      case 'ECONOMY':
        return 'اکونومی';
      default:
        return cabin;
    }
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
      cabin: CabinClass;
      classCode: string;
      priceIrr: Irr;
      seatsAllocated: number;
      taxIrr?: Irr;
      refundable?: boolean;
      changeable?: boolean;
      baggageAllowanceKg?: number;
      validFrom?: string;
      validUntil?: string;
      allowedChannels?: ('SYSTEM' | 'CHARTER' | 'AGENCY')[];
    },
  ) {
    const instance = await this.instanceRepo
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.flight', 'flight')
      .where('fi.id = :id', { id: instanceId })
      .getOne();
    if (!instance) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد.',
      });
    }
    this.validateFareRuleWindow(dto);

    const cabinSeats = await this.cabinSeatCount(instance, dto.cabin);
    const existing = await this.fareRuleRepo.find({
      where: { flightInstanceId: instanceId, cabin: dto.cabin },
    });
    const existingTotal = existing.reduce((a, r) => a + r.seatsAllocated, 0);
    if (existingTotal + dto.seatsAllocated > cabinSeats) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `مجموع صندلی تخصیص‌یافته کلاس‌های نرخی (${existingTotal + dto.seatsAllocated}) از ظرفیت کابین ${this.cabinLabelFa(dto.cabin)} (${cabinSeats}) بیشتر است.`,
      });
    }

    const created = await this.fareRuleRepo.save(
      this.fareRuleRepo.create({
        flightInstanceId: instanceId,
        cabin: dto.cabin,
        classCode: dto.classCode,
        priceIrr: dto.priceIrr,
        seatsAllocated: dto.seatsAllocated,
        taxIrr: dto.taxIrr ?? ZERO_IRR,
        refundable: dto.refundable ?? true,
        changeable: dto.changeable ?? true,
        baggageAllowanceKg: dto.baggageAllowanceKg,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        allowedChannels: dto.allowedChannels ?? [],
      }),
    );

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
      priceIrr?: Irr;
      seatsAllocated?: number;
      taxIrr?: Irr;
      refundable?: boolean;
      changeable?: boolean;
      baggageAllowanceKg?: number;
      validFrom?: string;
      validUntil?: string;
      allowedChannels?: ('SYSTEM' | 'CHARTER' | 'AGENCY')[];
    },
  ) {
    const rule = await this.fareRuleRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.flightInstance', 'flightInstance')
      .leftJoinAndSelect('flightInstance.flight', 'flight')
      .where('r.id = :id', { id: ruleId })
      .getOne();
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
      const others = await this.fareRuleRepo.find({
        where: {
          flightInstanceId: instanceId,
          cabin: rule.cabin,
          id: Not(ruleId),
        },
      });
      const othersTotal = others.reduce((a, r) => a + r.seatsAllocated, 0);
      if (othersTotal + dto.seatsAllocated > cabinSeats) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: `مجموع صندلی تخصیص‌یافته کلاس‌های نرخی (${othersTotal + dto.seatsAllocated}) از ظرفیت کابین ${this.cabinLabelFa(rule.cabin)} (${cabinSeats}) بیشتر است.`,
        });
      }
    }

    if (dto.priceIrr !== undefined) rule.priceIrr = dto.priceIrr;
    if (dto.seatsAllocated !== undefined)
      rule.seatsAllocated = dto.seatsAllocated;
    if (dto.taxIrr !== undefined) rule.taxIrr = dto.taxIrr;
    if (dto.refundable !== undefined) rule.refundable = dto.refundable;
    if (dto.changeable !== undefined) rule.changeable = dto.changeable;
    if (dto.baggageAllowanceKg !== undefined)
      rule.baggageAllowanceKg = dto.baggageAllowanceKg;
    if (dto.validFrom !== undefined)
      rule.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validUntil !== undefined)
      rule.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (dto.allowedChannels !== undefined)
      rule.allowedChannels = dto.allowedChannels;
    const updated = await this.fareRuleRepo.save(rule);

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
    const rule = await this.fareRuleRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.flightInstance', 'flightInstance')
      .leftJoinAndSelect('flightInstance.flight', 'flight')
      .where('r.id = :id', { id: ruleId })
      .getOne();
    if (!rule || rule.flightInstanceId !== instanceId) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'کلاس نرخی یافت نشد.',
      });
    }
    const activeBooking = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.flightInstanceId = :instanceId', { instanceId })
      .andWhere('b.cabin = :cabin', { cabin: rule.cabin })
      .andWhere('b.fareClassCode = :classCode', { classCode: rule.classCode })
      .andWhere('b.status IN (:...statuses)', {
        statuses: ['DRAFT', 'HELD', 'PAID', 'TICKETED'],
      })
      .getOne();
    if (activeBooking) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این کلاس نرخی توسط رزروهای فعال استفاده شده و قابل حذف نیست.',
      });
    }

    await this.fareRuleRepo.delete({ id: ruleId });

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
    const rows = await this.allotmentRepo
      .createQueryBuilder('a')
      .leftJoin('a.agency', 'agency')
      .leftJoin('agency.user', 'user')
      .addSelect(['agency.userId', 'user.id', 'user.fullName'])
      .where('a.flightInstanceId = :instanceId', { instanceId })
      .orderBy('a.createdAt', 'DESC')
      .getMany();
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

  async allotmentSummary(instanceId: string) {
    const instance = await this.instanceRepo.findOne({
      where: { id: instanceId },
    });
    if (!instance) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد.',
      });
    }

    const agencies = (await this.listAllotments(instanceId)).filter(
      (row) => row.active,
    );
    const directReserved = await this.passengerRepo
      .createQueryBuilder('passenger')
      .innerJoin('passenger.booking', 'booking')
      .where('booking.flightInstanceId = :instanceId', { instanceId })
      .andWhere('booking.agencyId IS NULL')
      .andWhere('booking.deletedAt IS NULL')
      .andWhere('passenger.deletedAt IS NULL')
      .andWhere('passenger.occupiesSeat = true')
      .andWhere('booking.status IN (:...statuses)', {
        statuses: ['DRAFT', 'HELD', 'PAID', 'TICKETED'],
      })
      .getCount();

    const agencySeats = agencies.reduce(
      (sum, row) => sum + row.seatsAllocated,
      0,
    );
    const agencyRevenueIrr = agencies.reduce(
      (sum, row) =>
        sum + BigInt(row.contractPriceIrr ?? 0) * BigInt(row.seatsAllocated),
      0n,
    );
    const charterSeats = Math.max(instance.charterSeats ?? 0, 0);
    const freeSeats = Math.max(
      instance.capacity - charterSeats - agencySeats - directReserved,
      0,
    );

    return {
      flightInstanceId: instanceId,
      totalCapacity: instance.capacity,
      charterSeats,
      directReserved,
      agencySeats,
      freeSeats,
      agencyRevenueIrr: agencyRevenueIrr.toString(),
      agencies: agencies.map((row) => ({
        ...row,
        contractPriceIrr: row.contractPriceIrr?.toString() ?? null,
        revenueIrr: (
          BigInt(row.contractPriceIrr ?? 0) * BigInt(row.seatsAllocated)
        ).toString(),
      })),
    };
  }

  /** Active = counts toward the agencySeatsAllocated cap right now: HARD
   * always counts; SOFT counts only until its releaseAt passes (lazy,
   * same pattern as Booking's HELD→EXPIRED — no cron job). */
  private async activeAllotmentsTotal(
    instanceId: string,
    excludeId?: string,
  ): Promise<number> {
    const now = new Date();
    const qb = this.allotmentRepo
      .createQueryBuilder('a')
      .where('a.flightInstanceId = :instanceId', { instanceId })
      .andWhere(
        '(a.type = :hard OR a.releaseAt IS NULL OR a.releaseAt > :now)',
        { hard: 'HARD', now },
      );
    if (excludeId) qb.andWhere('a.id != :excludeId', { excludeId });
    const rows = await qb.getMany();
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
      contractPriceIrr?: Irr;
    },
  ) {
    const agency = await this.agencyProfileRepo.findOneBy({
      userId: dto.agencyId,
    });
    if (!agency) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'آژانس یافت نشد.',
      });
    }

    const created = await this.dataSource.transaction(async (manager) => {
      // Shared lock with schedule-template deactivate.
      const instance = await manager
        .createQueryBuilder(FlightInstance, 'fi')
        .setLock('pessimistic_write')
        .where('fi.id = :id', { id: instanceId })
        .getOne();
      if (!instance) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'پرواز یافت نشد.',
        });
      }
      if (instance.status === FlightInstanceStatus.CANCELLED) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'پرواز لغو شده و قابل تخصیص سهمیه نیست.',
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

      return manager.save(
        manager.create(AgencyAllotment, {
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
        }),
      );
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
    const allotment = await this.allotmentRepo.findOneBy({ id: allotmentId });
    if (!allotment || allotment.flightInstanceId !== instanceId) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'سهمیه یافت نشد.',
      });
    }
    const activeBooking = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.flightInstanceId = :instanceId', { instanceId })
      .andWhere('b.agencyId = :agencyId', { agencyId: allotment.agencyId })
      .andWhere('b.status IN (:...statuses)', {
        statuses: ['DRAFT', 'HELD', 'PAID', 'TICKETED'],
      })
      .getOne();
    if (activeBooking) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          'این آژانس رزرو فعالی روی این پرواز دارد و سهمیه قابل حذف نیست.',
      });
    }

    await this.allotmentRepo.delete({ id: allotmentId });

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

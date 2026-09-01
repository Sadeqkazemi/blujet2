import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ErrorCode } from '../../common/errors';
import { AircraftSeatMap } from '../../database/entities/aircraft-seat-map.entity';
import { AircraftSeat } from '../../database/entities/aircraft-seat.entity';
import { BaggageItem } from '../../database/entities/baggage-item.entity';
import { Booking } from '../../database/entities/booking.entity';
import { DcsPassengerOperation } from '../../database/entities/dcs-passenger-operation.entity';
import { FlightCoupon } from '../../database/entities/flight-coupon.entity';
import { FlightInstance } from '../../database/entities/flight-instance.entity';
import { Passenger } from '../../database/entities/passenger.entity';
import {
  BaggageStatus,
  BookingStatus,
  CabinClass,
  FlightCouponStatus,
  FlightInstanceStatus,
} from '../../database/enums';
import { AuditService } from '../audit/audit.service';
import { resolveAircraftType } from '../flights/aircraft-type.util';
import { enumerateSeats } from '../reservation/seat-layout';
import {
  AcceptBaggageDto,
  BoardCouponDto,
  CheckInCouponDto,
} from './dto/dcs.dto';

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.TICKETED,
  BookingStatus.PAID,
];
const CHECKED_IN_OR_BOARDED = new Set<FlightCouponStatus>([
  FlightCouponStatus.CHECKED_IN,
  FlightCouponStatus.BOARDED,
]);
const CHECK_IN_OPENS_MS = 24 * 60 * 60 * 1000;
const CHECK_IN_CLOSES_MS = 30 * 60 * 1000;
const STANDARD_PASSENGER_WEIGHT_KG: Record<string, number> = {
  ADULT: 84,
  CHILD: 35,
  INFANT: 0,
};

type CouponContext = FlightCoupon & {
  ticketDocument: FlightCoupon['ticketDocument'] & {
    passenger: Passenger;
    booking: Booking & {
      flightInstance: FlightInstance & {
        flight: FlightInstance['flight'] & {
          route: FlightInstance['flight']['route'];
        };
      };
    };
  };
};

@Injectable()
export class DcsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AircraftSeat)
    private readonly aircraftSeatRepo: Repository<AircraftSeat>,
    @InjectRepository(AircraftSeatMap)
    private readonly seatMapRepo: Repository<AircraftSeatMap>,
    private readonly audit: AuditService,
  ) {}

  private couponQuery(manager: EntityManager, couponId: string, lock = false) {
    const qb = manager
      .getRepository(FlightCoupon)
      .createQueryBuilder('coupon')
      .innerJoinAndSelect('coupon.ticketDocument', 'document')
      .innerJoinAndSelect('document.passenger', 'passenger')
      .innerJoinAndSelect('document.booking', 'booking')
      .innerJoinAndSelect('booking.flightInstance', 'instance')
      .innerJoinAndSelect('instance.flight', 'flight')
      .innerJoinAndSelect('flight.route', 'route')
      .where('coupon.id = :couponId', { couponId });
    if (lock) qb.setLock('pessimistic_write', undefined, ['coupon']);
    return qb;
  }

  private async couponContext(
    manager: EntityManager,
    couponId: string,
    lock = false,
  ): Promise<CouponContext> {
    const coupon = await this.couponQuery(manager, couponId, lock).getOne();
    if (!coupon) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'کوپن پرواز یافت نشد.',
      });
    }
    return coupon;
  }

  private assertActiveCoupon(coupon: CouponContext) {
    const booking = coupon.ticketDocument.booking;
    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'رزرو این کوپن برای عملیات فرودگاهی فعال نیست.',
      });
    }
    if (
      booking.flightInstance.status === FlightInstanceStatus.CANCELLED ||
      coupon.ticketDocument.status !== 'ISSUED'
    ) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'بلیط یا پرواز برای عملیات فرودگاهی معتبر نیست.',
      });
    }
  }

  private assertCheckInWindow(departureAt: Date) {
    const untilDeparture = departureAt.getTime() - Date.now();
    if (
      untilDeparture > CHECK_IN_OPENS_MS ||
      untilDeparture < CHECK_IN_CLOSES_MS
    ) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'چک‌این فقط از ۲۴ ساعت تا ۳۰ دقیقه مانده به پرواز فعال است.',
      });
    }
  }

  private async validateSeat(
    context: CouponContext,
    seatCode: string,
    manager: EntityManager,
  ) {
    const { booking, passenger } = context.ticketDocument;
    const instance = booking.flightInstance;
    let valid = false;

    if (instance.aircraftDefinitionId) {
      valid = Boolean(
        await manager.findOne(AircraftSeat, {
          where: {
            aircraftDefinitionId: instance.aircraftDefinitionId,
            label: seatCode,
            cabinType: booking.cabin,
            isBlocked: false,
          },
          select: { id: true },
        }),
      );
    } else {
      const aircraftType = resolveAircraftType(instance);
      const map = await manager.findOneBy(AircraftSeatMap, { aircraftType });
      valid = Boolean(
        map &&
        enumerateSeats(map).some(
          (seat) => seat.seatCode === seatCode && seat.cabin === booking.cabin,
        ),
      );
    }

    if (!valid) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `صندلی ${seatCode} در کابین ${booking.cabin} این هواپیما معتبر نیست.`,
      });
    }

    const occupied = await manager
      .getRepository(Passenger)
      .createQueryBuilder('passenger')
      .innerJoin('passenger.booking', 'booking')
      .where('booking.flightInstanceId = :flightInstanceId', {
        flightInstanceId: booking.flightInstanceId,
      })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: ACTIVE_BOOKING_STATUSES,
      })
      .andWhere('passenger.id <> :passengerId', { passengerId: passenger.id })
      .andWhere(
        '(passenger.seatCode = :seatCode OR passenger.extraSeatCode = :seatCode)',
        { seatCode },
      )
      .andWhere('passenger.deletedAt IS NULL')
      .getExists();
    if (occupied) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: `صندلی ${seatCode} قبلاً به مسافر دیگری اختصاص یافته است.`,
      });
    }
  }

  private operationView(
    operation: DcsPassengerOperation,
    coupon: CouponContext,
    baggage: BaggageItem[] = [],
  ) {
    return {
      couponId: coupon.id,
      couponStatus: coupon.status,
      documentNo: coupon.ticketDocument.documentNo,
      pnr: coupon.ticketDocument.booking.pnr,
      passengerId: coupon.ticketDocument.passenger.id,
      passengerName: coupon.ticketDocument.passenger.fullName,
      boardingPassNo: operation.boardingPassNo,
      seatCode: operation.seatCode,
      gate: operation.gate,
      checkedInAt: operation.checkedInAt.toISOString(),
      boardedAt: operation.boardedAt?.toISOString() ?? null,
      baggage: baggage.map((bag) => ({
        id: bag.id,
        tagNo: bag.tagNo,
        weightGrams: bag.weightGrams,
        status: bag.status,
      })),
    };
  }

  async checkIn(
    couponId: string,
    dto: CheckInCouponDto,
    actor: AuthenticatedUser,
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const coupon = await this.couponContext(manager, couponId, true);
      const operation = await manager.findOneBy(DcsPassengerOperation, {
        flightCouponId: coupon.id,
      });
      if (operation && CHECKED_IN_OR_BOARDED.has(coupon.status)) {
        return { view: this.operationView(operation, coupon), changed: false };
      }

      this.assertActiveCoupon(coupon);
      this.assertCheckInWindow(coupon.departureAt);
      if (coupon.status !== FlightCouponStatus.OPEN) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: `کوپن با وضعیت ${coupon.status} قابل چک‌این نیست.`,
        });
      }

      const passenger = coupon.ticketDocument.passenger;
      const seatCode = dto.seatCode ?? passenger.seatCode;
      if (!seatCode) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'برای چک‌این باید صندلی معتبر انتخاب شود.',
        });
      }
      await this.validateSeat(coupon, seatCode, manager);
      if (passenger.seatCode !== seatCode) {
        passenger.seatCode = seatCode;
        await manager.save(Passenger, passenger);
      }

      const [{ nextval }] = await manager.query<{ nextval: string }[]>(
        `SELECT nextval('boarding_pass_number_seq')::text AS nextval`,
      );
      const now = new Date();
      const created = await manager.save(
        manager.create(DcsPassengerOperation, {
          flightCouponId: coupon.id,
          boardingPassNo: `BP${nextval.padStart(10, '0')}`,
          seatCode,
          gate: dto.gate?.trim() || null,
          checkedInAt: now,
          checkedInById: actor.id,
          boardedAt: null,
          boardedById: null,
        }),
      );
      coupon.status = FlightCouponStatus.CHECKED_IN;
      await manager.save(FlightCoupon, coupon);
      return { view: this.operationView(created, coupon), changed: true };
    });

    if (result.changed) {
      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        category: 'RESERVATION',
        action: 'DCS_CHECK_IN',
        detail: `کوپن ${couponId} چک‌این و کارت پرواز صادر شد.`,
        entityType: 'FlightCoupon',
        entityId: couponId,
        metadata: { boardingPassNo: result.view.boardingPassNo },
      });
    }
    return result.view;
  }

  async acceptBaggage(
    couponId: string,
    dto: AcceptBaggageDto,
    actor: AuthenticatedUser,
  ) {
    const bag = await this.dataSource.transaction(async (manager) => {
      const coupon = await this.couponContext(manager, couponId, true);
      this.assertActiveCoupon(coupon);
      if (coupon.status !== FlightCouponStatus.CHECKED_IN) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message:
            'بار فقط برای کوپن چک‌این‌شده و قبل از بردینگ پذیرفته می‌شود.',
        });
      }

      let tagNo = dto.tagNo?.trim().toUpperCase();
      if (tagNo) {
        const duplicate = await manager.findOneBy(BaggageItem, { tagNo });
        if (duplicate) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'این شماره تگ بار قبلاً ثبت شده است.',
          });
        }
      } else {
        const [{ nextval }] = await manager.query<{ nextval: string }[]>(
          `SELECT nextval('baggage_tag_number_seq')::text AS nextval`,
        );
        tagNo = `BJ${nextval.padStart(10, '0')}`;
      }
      return manager.save(
        manager.create(BaggageItem, {
          flightCouponId: coupon.id,
          tagNo,
          weightGrams: dto.weightGrams,
          status: BaggageStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedById: actor.id,
        }),
      );
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'RESERVATION',
      action: 'DCS_BAGGAGE_ACCEPTED',
      detail: `بار ${bag.tagNo} برای کوپن ${couponId} پذیرفته شد.`,
      entityType: 'FlightCoupon',
      entityId: couponId,
      metadata: { tagNo: bag.tagNo, weightGrams: bag.weightGrams },
    });
    return {
      id: bag.id,
      couponId,
      tagNo: bag.tagNo,
      weightGrams: bag.weightGrams,
      status: bag.status,
      acceptedAt: bag.acceptedAt.toISOString(),
    };
  }

  async board(couponId: string, dto: BoardCouponDto, actor: AuthenticatedUser) {
    const result = await this.dataSource.transaction(async (manager) => {
      const coupon = await this.couponContext(manager, couponId, true);
      const operation = await manager.findOneBy(DcsPassengerOperation, {
        flightCouponId: coupon.id,
      });
      if (!operation) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این مسافر هنوز چک‌این نشده است.',
        });
      }
      if (coupon.status === FlightCouponStatus.BOARDED) {
        const baggage = await manager.findBy(BaggageItem, {
          flightCouponId: coupon.id,
        });
        return {
          view: this.operationView(operation, coupon, baggage),
          changed: false,
        };
      }
      this.assertActiveCoupon(coupon);
      if (coupon.status !== FlightCouponStatus.CHECKED_IN) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: `کوپن با وضعیت ${coupon.status} قابل بردینگ نیست.`,
        });
      }
      operation.boardedAt = new Date();
      operation.boardedById = actor.id;
      operation.gate = dto.gate?.trim() || operation.gate;
      await manager.save(DcsPassengerOperation, operation);
      coupon.status = FlightCouponStatus.BOARDED;
      await manager.save(FlightCoupon, coupon);
      const baggage = await manager.findBy(BaggageItem, {
        flightCouponId: coupon.id,
      });
      return {
        view: this.operationView(operation, coupon, baggage),
        changed: true,
      };
    });

    if (result.changed) {
      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        category: 'RESERVATION',
        action: 'DCS_BOARDED',
        detail: `بردینگ کوپن ${couponId} ثبت شد.`,
        entityType: 'FlightCoupon',
        entityId: couponId,
        metadata: { gate: result.view.gate },
      });
    }
    return result.view;
  }

  private async instanceOrFail(id: string) {
    const instance = await this.dataSource
      .getRepository(FlightInstance)
      .createQueryBuilder('instance')
      .innerJoinAndSelect('instance.flight', 'flight')
      .innerJoinAndSelect('flight.route', 'route')
      .where('instance.id = :id', { id })
      .getOne();
    if (!instance || instance.status === FlightInstanceStatus.CANCELLED) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز عملیاتی یافت نشد.',
      });
    }
    return instance;
  }

  private async manifestRows(flightInstanceId: string) {
    const coupons = (await this.dataSource
      .getRepository(FlightCoupon)
      .createQueryBuilder('coupon')
      .innerJoinAndSelect('coupon.ticketDocument', 'document')
      .innerJoinAndSelect('document.passenger', 'passenger')
      .innerJoinAndSelect('document.booking', 'booking')
      .leftJoinAndMapOne(
        'coupon.operation',
        DcsPassengerOperation,
        'operation',
        'operation.flightCouponId = coupon.id',
      )
      .leftJoinAndMapMany(
        'coupon.baggage',
        BaggageItem,
        'baggage',
        'baggage.flightCouponId = coupon.id',
      )
      .where('coupon.flightInstanceId = :flightInstanceId', {
        flightInstanceId,
      })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: ACTIVE_BOOKING_STATUSES,
      })
      .andWhere('passenger.deletedAt IS NULL')
      .orderBy('passenger.seatCode', 'ASC', 'NULLS LAST')
      .getMany()) as Array<
      FlightCoupon & {
        operation?: DcsPassengerOperation;
        baggage?: BaggageItem[];
      }
    >;
    return coupons;
  }

  private flightTotals(
    coupons: Array<
      FlightCoupon & {
        baggage?: BaggageItem[];
      }
    >,
  ) {
    const baggage = coupons.flatMap((coupon) => coupon.baggage ?? []);
    return {
      booked: coupons.length,
      checkedIn: coupons.filter((coupon) =>
        CHECKED_IN_OR_BOARDED.has(coupon.status),
      ).length,
      boarded: coupons.filter(
        (coupon) => coupon.status === FlightCouponStatus.BOARDED,
      ).length,
      baggagePieces: baggage.length,
      baggageWeightGrams: baggage.reduce(
        (total, item) => total + item.weightGrams,
        0,
      ),
    };
  }

  async flights() {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const instances = await this.dataSource
      .getRepository(FlightInstance)
      .createQueryBuilder('instance')
      .innerJoinAndSelect('instance.flight', 'flight')
      .innerJoinAndSelect('flight.route', 'route')
      .where('instance.status <> :cancelled', {
        cancelled: FlightInstanceStatus.CANCELLED,
      })
      .andWhere('instance.departureAt >= :from', { from })
      .orderBy('instance.departureAt', 'ASC')
      .take(100)
      .getMany();
    return Promise.all(
      instances.map(async (instance) => ({
        id: instance.id,
        flightNo: instance.flight.flightNo,
        originCode: instance.flight.route.originCode,
        destCode: instance.flight.route.destCode,
        departureAt: instance.departureAt.toISOString(),
        arrivalAt: instance.arrivalAt.toISOString(),
        status: instance.status,
        ...this.flightTotals(await this.manifestRows(instance.id)),
      })),
    );
  }

  async flight(id: string) {
    const instance = await this.instanceOrFail(id);
    const coupons = await this.manifestRows(id);
    return {
      id: instance.id,
      flightNo: instance.flight.flightNo,
      originCode: instance.flight.route.originCode,
      destCode: instance.flight.route.destCode,
      departureAt: instance.departureAt.toISOString(),
      arrivalAt: instance.arrivalAt.toISOString(),
      status: instance.status,
      totals: this.flightTotals(coupons),
      manifest: coupons.map((coupon) => ({
        couponId: coupon.id,
        couponStatus: coupon.status,
        documentNo: coupon.ticketDocument.documentNo,
        pnr: coupon.ticketDocument.booking.pnr,
        passengerId: coupon.ticketDocument.passenger.id,
        passengerName: coupon.ticketDocument.passenger.fullName,
        passengerType: coupon.ticketDocument.passenger.passengerType,
        cabin: coupon.cabin,
        seatCode:
          coupon.operation?.seatCode ??
          coupon.ticketDocument.passenger.seatCode,
        boardingPassNo: coupon.operation?.boardingPassNo ?? null,
        gate: coupon.operation?.gate ?? null,
        checkedInAt: coupon.operation?.checkedInAt?.toISOString() ?? null,
        boardedAt: coupon.operation?.boardedAt?.toISOString() ?? null,
        baggage: (coupon.baggage ?? []).map((bag) => ({
          id: bag.id,
          tagNo: bag.tagNo,
          weightGrams: bag.weightGrams,
          status: bag.status,
        })),
      })),
    };
  }

  async loadSummary(id: string) {
    const detail = await this.flight(id);
    const byCabin = Object.fromEntries(
      Object.values(CabinClass).map((cabin) => [cabin, 0]),
    ) as Record<CabinClass, number>;
    let standardPassengerWeightKg = 0;
    for (const row of detail.manifest) {
      byCabin[row.cabin] += 1;
      standardPassengerWeightKg +=
        STANDARD_PASSENGER_WEIGHT_KG[row.passengerType] ?? 0;
    }
    const baggageWeightKg = detail.totals.baggageWeightGrams / 1000;
    return {
      flightInstanceId: id,
      passengerCountByCabin: byCabin,
      passengerStandardWeightKg: standardPassengerWeightKg,
      baggagePieces: detail.totals.baggagePieces,
      baggageWeightKg,
      cargoWeightKg: 0,
      trafficLoadKg: standardPassengerWeightKg + baggageWeightKg,
      standardWeightMethod: 'CONFIGURABLE_DCS_ESTIMATE',
      aircraftZoneBreakdown: null,
      dryOperatingWeightKg: null,
      takeoffWeightKg: null,
      landingWeightKg: null,
      structuralLimits: null,
      balanceStatus: 'CONFIGURATION_REQUIRED',
      releaseStatus: 'NOT_RELEASED',
      reasons: [
        'داده‌های تأییدشده Datum، Arm، MAC، Envelope و حدود سازه‌ای این هواپیما پیکربندی نشده است.',
      ],
    };
  }
}

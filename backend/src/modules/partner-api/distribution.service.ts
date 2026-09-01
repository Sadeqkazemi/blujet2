import * as crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ErrorCode } from '../../common/errors';
import type { CabinClass } from '../../database/enums';
import { DataSource } from 'typeorm';
import { AgencyPortalService } from '../agency-portal/agency-portal.service';
import { BookingService } from '../booking-engine/booking.service';
import { getCabinPrice } from '../booking-engine/pricing';
import {
  DistributionAirShoppingDto,
  DistributionOrderCreateDto,
} from './dto/partner-api.dto';

const OFFER_TTL_MS = 5 * 60 * 1000;
const OFFER_VERSION = 1;

interface DistributionOfferPayload {
  v: number;
  agencyId: string;
  allotmentId: string;
  flightInstanceId: string;
  cabin: CabinClass;
  passengerCount: number;
  pricePerPassengerIrr: string;
  expiresAt: number;
}

function isDistributionOfferPayload(
  value: unknown,
): value is DistributionOfferPayload {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.v === 'number' &&
    typeof row.agencyId === 'string' &&
    typeof row.allotmentId === 'string' &&
    typeof row.flightInstanceId === 'string' &&
    typeof row.cabin === 'string' &&
    ['ECONOMY', 'COMFORT', 'BUSINESS', 'FIRST'].includes(row.cabin) &&
    typeof row.passengerCount === 'number' &&
    Number.isInteger(row.passengerCount) &&
    typeof row.pricePerPassengerIrr === 'string' &&
    typeof row.expiresAt === 'number'
  );
}

interface AgencyAllotmentView {
  id: string;
  flightInstanceId: string;
  flightNo: string;
  originCode: string;
  destinationCode: string;
  departureAt: Date;
  aircraftType: string;
  cabin: CabinClass | null;
  fareClassCode: string | null;
  seatsAllocated: number;
  seatsUsed: number;
  contractPriceIrr: bigint | null;
  active: boolean;
}

@Injectable()
export class DistributionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly portal: AgencyPortalService,
    private readonly bookings: BookingService,
  ) {}

  capabilities() {
    return {
      standard: 'BLUJET_DIRECT_CONNECT',
      alignment: 'NDC_WORKFLOW_ALIGNED',
      version: '2.0',
      certification: {
        externalGdsCertified: false,
        note: 'اتصال به GDS نام‌برده نیازمند قرارداد و گواهی همان ارائه‌دهنده است.',
      },
      authentication: 'X-API-Key',
      currency: 'IRR',
      workflows: [
        'AIR_SHOPPING',
        'OFFER_PRICE',
        'ORDER_CREATE',
        'ORDER_RETRIEVE',
        'TICKET_DOCUMENT_RETRIEVE',
      ],
      offerTtlSeconds: OFFER_TTL_MS / 1000,
    };
  }

  private signingKey(): Buffer {
    const hex = process.env.PII_ENCRYPTION_KEY ?? '';
    if (!/^[0-9a-f]{64}$/i.test(hex)) {
      throw new Error('PII_ENCRYPTION_KEY must be configured for offers');
    }
    return Buffer.from(hex, 'hex');
  }

  private sign(payload: DistributionOfferPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.signingKey())
      .update(`blujet:distribution-offer:v1:${encoded}`)
      .digest('base64url');
    return `${encoded}.${signature}`;
  }

  private verify(offerId: string, actor: AuthenticatedUser) {
    const [encoded, signature, extra] = offerId.split('.');
    if (!encoded || !signature || extra) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'شناسه پیشنهاد نامعتبر است.',
      });
    }
    const expected = crypto
      .createHmac('sha256', this.signingKey())
      .update(`blujet:distribution-offer:v1:${encoded}`)
      .digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(signature, 'base64url');
    } catch {
      supplied = Buffer.alloc(0);
    }
    if (
      supplied.length !== expected.length ||
      !crypto.timingSafeEqual(supplied, expected)
    ) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'امضای پیشنهاد معتبر نیست.',
      });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as unknown;
    } catch {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'محتوای پیشنهاد معتبر نیست.',
      });
    }
    if (!isDistributionOfferPayload(parsed)) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'ساختار پیشنهاد معتبر نیست.',
      });
    }
    const payload = parsed;
    if (
      payload.v !== OFFER_VERSION ||
      payload.agencyId !== actor.id ||
      payload.expiresAt <= Date.now()
    ) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'پیشنهاد منقضی شده یا متعلق به این آژانس نیست.',
      });
    }
    return payload;
  }

  private async activeAllotment(
    actor: AuthenticatedUser,
    allotmentId: string,
  ): Promise<AgencyAllotmentView> {
    const rows = (await this.portal.allotments(actor)) as AgencyAllotmentView[];
    const row = rows.find((item) => item.id === allotmentId);
    if (
      !row ||
      !row.active ||
      !row.cabin ||
      row.seatsAllocated <= row.seatsUsed
    ) {
      throw new ConflictException({
        code: ErrorCode.POOL_EXHAUSTED,
        message: 'سهمیه این پیشنهاد دیگر فعال یا قابل فروش نیست.',
      });
    }
    return row;
  }

  private async currentUnitPrice(allotment: AgencyAllotmentView) {
    return (
      allotment.contractPriceIrr ??
      (await getCabinPrice(
        this.dataSource.manager,
        allotment.flightInstanceId,
        allotment.cabin!,
        'AGENCY',
      ))
    );
  }

  private async createOffer(
    actor: AuthenticatedUser,
    allotment: AgencyAllotmentView,
    passengerCount: number,
  ) {
    const availableSeats = allotment.seatsAllocated - allotment.seatsUsed;
    if (availableSeats < passengerCount) {
      throw new ConflictException({
        code: ErrorCode.POOL_EXHAUSTED,
        message: 'ظرفیت سهمیه برای تعداد مسافر درخواستی کافی نیست.',
      });
    }
    const unitPrice = await this.currentUnitPrice(allotment);
    const payload: DistributionOfferPayload = {
      v: OFFER_VERSION,
      agencyId: actor.id,
      allotmentId: allotment.id,
      flightInstanceId: allotment.flightInstanceId,
      cabin: allotment.cabin!,
      passengerCount,
      pricePerPassengerIrr: unitPrice.toString(),
      expiresAt: Date.now() + OFFER_TTL_MS,
    };
    return {
      offerId: this.sign(payload),
      expiresAt: new Date(payload.expiresAt).toISOString(),
      allotmentId: allotment.id,
      flightInstanceId: allotment.flightInstanceId,
      flightNo: allotment.flightNo,
      originCode: allotment.originCode,
      destinationCode: allotment.destinationCode,
      departureAt: allotment.departureAt,
      aircraftType: allotment.aircraftType,
      cabin: allotment.cabin,
      fareClassCode: allotment.fareClassCode,
      availableSeats,
      passengerCount,
      pricePerPassengerIrr: payload.pricePerPassengerIrr,
      totalBasePriceIrr: (unitPrice * BigInt(passengerCount)).toString(),
      currency: 'IRR',
    };
  }

  async airShopping(actor: AuthenticatedUser, dto: DistributionAirShoppingDto) {
    const date = dto.date.slice(0, 10);
    const rows = (await this.portal.allotments(actor)) as AgencyAllotmentView[];
    const matching = rows.filter(
      (row) =>
        row.active &&
        row.cabin &&
        row.originCode.toUpperCase() === dto.origin.toUpperCase() &&
        row.destinationCode.toUpperCase() === dto.destination.toUpperCase() &&
        new Date(row.departureAt).toISOString().slice(0, 10) === date &&
        (!dto.cabin || row.cabin === dto.cabin) &&
        row.seatsAllocated - row.seatsUsed >= dto.passengerCount,
    );
    return Promise.all(
      matching.map((row) => this.createOffer(actor, row, dto.passengerCount)),
    );
  }

  async offerPrice(actor: AuthenticatedUser, offerId: string) {
    const payload = this.verify(offerId, actor);
    const allotment = await this.activeAllotment(actor, payload.allotmentId);
    if (
      allotment.flightInstanceId !== payload.flightInstanceId ||
      allotment.cabin !== payload.cabin
    ) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'موجودی سهمیه با پیشنهاد اولیه همخوانی ندارد.',
      });
    }
    return this.createOffer(actor, allotment, payload.passengerCount);
  }

  async createOrder(
    actor: AuthenticatedUser,
    dto: DistributionOrderCreateDto,
    idempotencyKey: string,
  ) {
    const payload = this.verify(dto.offerId, actor);
    if (
      payload.allotmentId !== dto.allotmentId ||
      payload.cabin !== dto.cabin ||
      payload.passengerCount !== dto.passengers.length
    ) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'مسافران، کابین یا سهمیه با پیشنهاد امضاشده همخوانی ندارد.',
      });
    }
    const allotment = await this.activeAllotment(actor, payload.allotmentId);
    if (
      allotment.flightInstanceId !== payload.flightInstanceId ||
      allotment.cabin !== payload.cabin ||
      allotment.seatsAllocated - allotment.seatsUsed < payload.passengerCount
    ) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          'پرواز، کابین یا ظرفیت سهمیه پس از صدور پیشنهاد تغییر کرده است.',
      });
    }
    const currentPrice = await this.currentUnitPrice(allotment);
    if (currentPrice.toString() !== payload.pricePerPassengerIrr) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          'قیمت پیشنهاد تغییر کرده است؛ ابتدا OfferPrice را دوباره فراخوانی کنید.',
      });
    }
    return this.bookings.createAgencyAllotmentBooking(
      actor,
      dto.allotmentId,
      { cabin: dto.cabin, passengers: dto.passengers },
      idempotencyKey,
    );
  }
}

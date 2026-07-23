import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/errors';
import { resolveAircraftType } from '../flights/aircraft-type.util';

const STATUS_LABEL_FA: Record<string, string> = {
  SCHEDULED: 'برنامه‌ریزی‌شده',
  CANCELLED: 'لغو شد',
};

@Injectable()
export class FlightStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async lookup(params: {
    flightNo?: string;
    origin?: string;
    dest?: string;
    date: string;
  }) {
    if (!params.flightNo && !(params.origin && params.dest)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'شماره پرواز یا مبدأ و مقصد لازم است.',
      });
    }

    const dayStart = new Date(params.date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const instance = await this.prisma.flightInstance.findFirst({
      where: {
        departureAt: { gte: dayStart, lt: dayEnd },
        flight: params.flightNo
          ? { flightNo: { equals: params.flightNo, mode: 'insensitive' } }
          : {
              route: {
                originCode: { equals: params.origin, mode: 'insensitive' },
                destCode: { equals: params.dest, mode: 'insensitive' },
              },
            },
      },
      include: { flight: { include: { route: true } } },
      orderBy: { departureAt: 'asc' },
    });

    if (!instance) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پروازی یافت نشد.',
      });
    }

    const [originAirport, destAirport] = await Promise.all([
      this.prisma.airport.findUnique({
        where: { code: instance.flight.route.originCode },
      }),
      this.prisma.airport.findUnique({
        where: { code: instance.flight.route.destCode },
      }),
    ]);

    const now = new Date();
    const statusLabelFa =
      instance.status === 'DEPARTED'
        ? instance.arrivalAt <= now
          ? 'فرود آمد'
          : 'در حال پرواز'
        : (STATUS_LABEL_FA[instance.status] ?? instance.status);

    return {
      flightInstanceId: instance.id,
      flightNo: instance.flight.flightNo,
      aircraftType: resolveAircraftType(instance),
      originCode: instance.flight.route.originCode,
      originCityFa: originAirport?.cityFa ?? instance.flight.route.originCode,
      destCode: instance.flight.route.destCode,
      destCityFa: destAirport?.cityFa ?? instance.flight.route.destCode,
      departureAt: instance.departureAt,
      arrivalAt: instance.arrivalAt,
      status: instance.status,
      statusLabelFa,
    };
  }
}

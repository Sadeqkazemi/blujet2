import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { ErrorCode } from '../../common/errors';
import { getCabinPrice } from './pricing';
import { ZERO_IRR, isPositiveIrr } from '../../common/money';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { CabinClass } from '../../../generated/typeorm/enums';

const MAX_SAVED = 20;

@Injectable()
export class SavedFlightsService {
  constructor(private readonly typeorm: TypeORMService) {}

  async listMine(user: AuthenticatedUser) {
    const rows = await this.typeorm.savedFlight.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        flightInstance: {
          include: {
            flight: { include: { route: true } },
          },
        },
      },
    });

    const airportCodes = new Set<string>();
    for (const row of rows) {
      airportCodes.add(row.flightInstance.flight.route.originCode);
      airportCodes.add(row.flightInstance.flight.route.destCode);
    }
    const airports = airportCodes.size
      ? await this.typeorm.airport.findMany({
          where: { code: { in: [...airportCodes] } },
        })
      : [];
    const cityByCode = new Map(airports.map((a) => [a.code, a.cityFa]));

    const now = new Date();
    return Promise.all(
      rows.map(async (row) => {
        const inst = row.flightInstance;
        const originCode = inst.flight.route.originCode;
        const destCode = inst.flight.route.destCode;
        let priceIrr = ZERO_IRR;
        let bookable = false;
        if (inst.status === 'SCHEDULED' && inst.departureAt > now) {
          try {
            priceIrr = await getCabinPrice(
              this.typeorm,
              row.flightInstanceId,
              row.cabin,
            );
            bookable = isPositiveIrr(priceIrr);
          } catch {
            bookable = false;
          }
        }

        return {
          id: row.id,
          flightInstanceId: row.flightInstanceId,
          cabin: row.cabin,
          flightNo: inst.flight.flightNo,
          originCode,
          destCode,
          originCityFa: cityByCode.get(originCode) ?? originCode,
          destCityFa: cityByCode.get(destCode) ?? destCode,
          departureAt: inst.departureAt,
          arrivalAt: inst.arrivalAt,
          priceIrr,
          bookable,
          createdAt: row.createdAt,
        };
      }),
    );
  }

  async save(
    user: AuthenticatedUser,
    dto: { flightInstanceId: string; cabin: CabinClass },
  ) {
    const instance = await this.typeorm.flightInstance.findUnique({
      where: { id: dto.flightInstanceId },
    });
    if (!instance || instance.status !== 'SCHEDULED') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد یا دیگر قابل ذخیره نیست.',
      });
    }
    if (instance.departureAt <= new Date()) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد یا دیگر قابل ذخیره نیست.',
      });
    }

    await getCabinPrice(this.typeorm, dto.flightInstanceId, dto.cabin);

    const count = await this.typeorm.savedFlight.count({
      where: { userId: user.id },
    });
    if (count >= MAX_SAVED) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: `حداکثر ${MAX_SAVED} پرواز را می‌توانید ذخیره کنید.`,
      });
    }

    const existing = await this.typeorm.savedFlight.findUnique({
      where: {
        userId_flightInstanceId_cabin: {
          userId: user.id,
          flightInstanceId: dto.flightInstanceId,
          cabin: dto.cabin,
        },
      },
    });
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این پرواز قبلاً ذخیره شده است.',
      });
    }

    return this.typeorm.savedFlight.create({
      data: {
        userId: user.id,
        flightInstanceId: dto.flightInstanceId,
        cabin: dto.cabin,
      },
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    const row = await this.typeorm.savedFlight.findUnique({ where: { id } });
    if (!row || row.userId !== user.id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز ذخیره‌شده یافت نشد.',
      });
    }
    await this.typeorm.savedFlight.delete({ where: { id } });
    return { removed: true };
  }
}

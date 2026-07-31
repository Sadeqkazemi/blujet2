import { BadRequestException, Injectable } from '@nestjs/common';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import {
  DEFAULT_WEBSERVICE_PLAN_PRICES_IRR,
  parseWebservicePlanPrices,
  type WebservicePlanPrices,
} from '../../common/webservice-pricing.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

const SETTING_KEY = 'webservicePlanPrices';

@Injectable()
export class WebservicePricingService {
  constructor(
    private readonly typeorm: TypeORMService,
    private readonly audit: AuditService,
  ) {}

  async getPlanPrices(): Promise<WebservicePlanPrices> {
    const row = await this.typeorm.systemSetting.findUnique({
      where: { key: SETTING_KEY },
    });
    if (!row) return { ...DEFAULT_WEBSERVICE_PLAN_PRICES_IRR };
    try {
      return parseWebservicePlanPrices(row.value);
    } catch {
      return { ...DEFAULT_WEBSERVICE_PLAN_PRICES_IRR };
    }
  }

  async updatePlanPrices(
    actor: AuthenticatedUser,
    patch: WebservicePlanPrices,
  ): Promise<WebservicePlanPrices> {
    let parsed: WebservicePlanPrices;
    try {
      parsed = parseWebservicePlanPrices(patch);
    } catch {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'قیمت‌های پلن وب‌سرویس نامعتبر است.',
      });
    }

    await this.typeorm.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: parsed as object, updatedById: actor.id },
      create: { key: SETTING_KEY, value: parsed as object, updatedById: actor.id },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'تغییر قیمت‌گذاری وب‌سرویس',
      detail: `قیمت پلن‌های ۱/۳/۱۲ ماهه وب‌سرویس توسط ${actor.fullName} به‌روزرسانی شد.`,
      entityType: 'SystemSetting',
      entityId: SETTING_KEY,
    });

    return parsed;
  }
}

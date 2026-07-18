import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

/** Every storable key with its server-side default. Unknown keys are
 * rejected — the settings table never becomes a free-form dumping ground. */
export const SETTING_DEFAULTS: Record<string, unknown> = {
  companyName: 'هواپیمایی blujet',
  supportEmail: 'support@blujet.example',
  supportPhone: '021-48000',
  gatewayMellat: true,
  gatewaySaman: true,
  gatewayZarin: false,
  maintenance: false,
  registration: true,
  charterSale: true,
  apiPublic: false,
  sandbox: true,
  brandColor: '#1668c4',
  // Site content (مدیریت محتوا) — plain text/HTML blocks the public-site
  // track reads at render time; editable here so content never needs a
  // deploy. Kept in the same generic SystemSetting KV store as the rest of
  // this tab rather than a dedicated table, matching Phase 12's design.
  homeHeroTitle: 'پرواز به هر کجا که دوست دارید',
  homeHeroSubtitle: 'بهترین قیمت بلیط هواپیما را با blujet پیدا کنید',
  aboutUsText: 'blujet یک پلتفرم آنلاین رزرو بلیط هواپیما است.',
  contactAddress: 'تهران، ایران',
  termsText: 'قوانین و مقررات استفاده از خدمات blujet.',
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getAll() {
    const [stored, refundRules] = await Promise.all([
      this.prisma.systemSetting.findMany(),
      this.prisma.refundPenaltyRule.findMany({
        orderBy: { minHoursBeforeDeparture: 'desc' },
      }),
    ]);
    const byKey = new Map(stored.map((s) => [s.key, s.value]));

    const settings: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(SETTING_DEFAULTS)) {
      settings[key] = byKey.has(key) ? byKey.get(key) : def;
    }

    return {
      settings,
      refundRules: refundRules.map((r) => ({
        id: r.id,
        minHoursBeforeDeparture: r.minHoursBeforeDeparture,
        penaltyPct: r.penaltyPct,
        labelFa: r.labelFa,
      })),
    };
  }

  async update(actor: AuthenticatedUser, patch: Record<string, unknown>) {
    const keys = Object.keys(patch);
    const unknown = keys.filter((k) => !(k in SETTING_DEFAULTS));
    if (keys.length === 0 || unknown.length > 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message:
          unknown.length > 0
            ? `کلید نامعتبر: ${unknown.join(', ')}`
            : 'هیچ تنظیمی ارسال نشده است.',
      });
    }
    for (const key of keys) {
      const expected = typeof SETTING_DEFAULTS[key];
      if (typeof patch[key] !== expected) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: `مقدار «${key}» نامعتبر است.`,
        });
      }
    }

    for (const key of keys) {
      await this.prisma.systemSetting.upsert({
        where: { key },
        update: { value: patch[key] as object, updatedById: actor.id },
        create: {
          key,
          value: patch[key] as object,
          updatedById: actor.id,
        },
      });
    }

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'تغییر تنظیمات سامانه',
      detail: `تنظیمات (${keys.join('، ')}) توسط ${actor.fullName} به‌روزرسانی شد.`,
      entityType: 'SystemSetting',
    });

    return this.getAll();
  }

  /** ⚑ Writes the REAL Phase 7 refund engine rows — the settings screen and
   * the penalty engine can never disagree because they read the same table. */
  async updateRefundRules(
    actor: AuthenticatedUser,
    rules: { id: string; penaltyPct: number }[],
  ) {
    for (const rule of rules) {
      if (
        !Number.isInteger(rule.penaltyPct) ||
        rule.penaltyPct < 0 ||
        rule.penaltyPct > 100
      ) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'درصد جریمه باید عددی بین ۰ تا ۱۰۰ باشد.',
        });
      }
    }

    const existing = await this.prisma.refundPenaltyRule.findMany({
      where: { id: { in: rules.map((r) => r.id) } },
    });
    if (existing.length !== rules.length) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'قاعدهٔ استرداد نامعتبر است.',
      });
    }

    for (const rule of rules) {
      await this.prisma.refundPenaltyRule.update({
        where: { id: rule.id },
        data: { penaltyPct: rule.penaltyPct },
      });
    }

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'تغییر قوانین استرداد',
      detail: `درصد جریمهٔ ${rules.length} بازهٔ استرداد توسط ${actor.fullName} به‌روزرسانی شد.`,
      entityType: 'RefundPenaltyRule',
    });

    return this.getAll();
  }
}

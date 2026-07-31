import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import {
  DEFAULT_SOCIAL_LINKS,
  parseSocialLinks,
  publicSocialLinks,
} from '../../common/social-links.util';
import {
  DEFAULT_APP_DOWNLOAD_LINKS,
  parseAppDownloadLinks,
  publicAppDownloadLinks,
} from '../../common/app-download-links.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

const SITE_ADMIN_PATCH_KEYS = new Set([
  'socialLinks',
  'supportEmail',
  'supportPhone',
  'appDownloadLinks',
]);

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
  // IT Manager / SITE_ADMIN settings tab — footer social links.
  socialLinks: DEFAULT_SOCIAL_LINKS,
  // SITE_ADMIN settings tab — app download buttons on the home page.
  appDownloadLinks: DEFAULT_APP_DOWNLOAD_LINKS,
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly typeorm: TypeORMService,
    private readonly audit: AuditService,
  ) {}

  async getAll() {
    const [stored, refundRules] = await Promise.all([
      this.typeorm.systemSetting.findMany(),
      this.typeorm.refundPenaltyRule.findMany({
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
    if (actor.role === 'SITE_ADMIN') {
      const forbidden = keys.filter((k) => !SITE_ADMIN_PATCH_KEYS.has(k));
      if (forbidden.length > 0) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message:
            'ادمین سایت فقط می‌تواند لینک‌های اجتماعی، تماس پشتیبانی و لینک اپلیکیشن را ویرایش کند.',
        });
      }
    }
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
      if (key === 'socialLinks') {
        try {
          patch[key] = parseSocialLinks(patch[key]);
        } catch {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'فرمت لینک‌های شبکه‌های اجتماعی نامعتبر است.',
          });
        }
        continue;
      }
      if (key === 'appDownloadLinks') {
        try {
          patch[key] = parseAppDownloadLinks(patch[key]);
        } catch {
          throw new BadRequestException({
            code: ErrorCode.VALIDATION_FAILED,
            message: 'فرمت لینک‌های دانلود اپلیکیشن نامعتبر است.',
          });
        }
        continue;
      }
      const expected = typeof SETTING_DEFAULTS[key];
      if (typeof patch[key] !== expected) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: `مقدار «${key}» نامعتبر است.`,
        });
      }
    }

    for (const key of keys) {
      await this.typeorm.systemSetting.upsert({
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

    const existing = await this.typeorm.refundPenaltyRule.findMany({
      where: { id: { in: rules.map((r) => r.id) } },
    });
    if (existing.length !== rules.length) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'قاعدهٔ استرداد نامعتبر است.',
      });
    }

    for (const rule of rules) {
      await this.typeorm.refundPenaltyRule.update({
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

  /** Public footer — enabled social links only, no auth required. */
  async getPublicSocialLinks() {
    const all = await this.getAll();
    const links = parseSocialLinks(all.settings.socialLinks);
    return { links: publicSocialLinks(links) };
  }

  /** Public home page — configured app store links with non-empty URLs. */
  async getPublicAppLinks() {
    const all = await this.getAll();
    const links = parseAppDownloadLinks(all.settings.appDownloadLinks);
    return { links: publicAppDownloadLinks(links) };
  }

  /** Public site chrome — support phone and email shown on contact/home. */
  async getPublicSupportContact() {
    const all = await this.getAll();
    return {
      phone: String(all.settings.supportPhone ?? SETTING_DEFAULTS.supportPhone),
      email: String(all.settings.supportEmail ?? SETTING_DEFAULTS.supportEmail),
    };
  }
}

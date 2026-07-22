import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import { encryptPii } from '../../common/pii-crypto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type {
  CreateExternalServiceDto,
  UpdateExternalServiceDto,
} from './dto/services.dtos';
import type { ExternalServiceConfig } from '../../../generated/prisma/client';

function toExternalView(s: ExternalServiceConfig) {
  const { apiKeyEncrypted, ...rest } = s;
  return { ...rest, hasApiKey: !!apiKeyEncrypted };
}

/** «0912***5678»-style mask — this surface never returns a full phone. */
function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.length < 7) return '*'.repeat(phone.length);
  return `${phone.slice(0, 4)}***${phone.slice(-4)}`;
}

@Injectable()
export class ItServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const [internal, external] = await Promise.all([
      this.prisma.internalService.findMany({ orderBy: { nameFa: 'asc' } }),
      this.prisma.externalServiceConfig.findMany({
        orderBy: { nameFa: 'asc' },
      }),
    ]);
    return { internal, external: external.map(toExternalView) };
  }

  async toggleInternal(
    actor: AuthenticatedUser,
    key: string,
    enabled: boolean,
  ) {
    const service = await this.prisma.internalService.findUnique({
      where: { key },
    });
    if (!service) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'سرویس یافت نشد.',
      });
    }
    const updated = await this.prisma.internalService.update({
      where: { key },
      data: { enabled },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: enabled ? 'فعال‌سازی سرویس داخلی' : 'غیرفعال‌سازی سرویس داخلی',
      detail: `سرویس «${service.nameFa}» توسط ${actor.fullName} ${enabled ? 'فعال' : 'غیرفعال'} شد.`,
      entityType: 'InternalService',
      entityId: key,
    });

    return updated;
  }

  async createExternal(
    actor: AuthenticatedUser,
    dto: CreateExternalServiceDto,
  ) {
    const created = await this.prisma.externalServiceConfig.create({
      data: {
        key: `ext_${Date.now().toString(36)}`,
        nameFa: dto.nameFa,
        provider: dto.provider,
        endpoint: dto.endpoint,
        method: dto.method ?? 'POST',
        timeoutMs: dto.timeoutMs ?? 30000,
        apiKeyEncrypted: dto.apiKey ? encryptPii(dto.apiKey) : null,
        sandbox: dto.sandbox ?? false,
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'تعریف سرویس خارجی جدید',
      detail: `سرویس خارجی «${dto.nameFa}» توسط ${actor.fullName} تعریف شد.`,
      entityType: 'ExternalServiceConfig',
      entityId: created.id,
    });

    return toExternalView(created);
  }

  private async getExternalOrThrow(id: string) {
    const service = await this.prisma.externalServiceConfig.findUnique({
      where: { id },
    });
    if (!service) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'سرویس خارجی یافت نشد.',
      });
    }
    return service;
  }

  async updateExternal(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateExternalServiceDto,
  ) {
    const service = await this.getExternalOrThrow(id);
    const { apiKey, ...rest } = dto;
    const updated = await this.prisma.externalServiceConfig.update({
      where: { id },
      data: {
        ...rest,
        ...(apiKey ? { apiKeyEncrypted: encryptPii(apiKey) } : {}),
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'به‌روزرسانی سرویس خارجی',
      detail: `سرویس خارجی «${service.nameFa}» توسط ${actor.fullName} به‌روزرسانی شد.`,
      entityType: 'ExternalServiceConfig',
      entityId: id,
    });

    return toExternalView(updated);
  }

  async removeExternal(actor: AuthenticatedUser, id: string) {
    const service = await this.getExternalOrThrow(id);
    await this.prisma.externalServiceConfig.delete({ where: { id } });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'حذف سرویس خارجی',
      detail: `سرویس خارجی «${service.nameFa}» توسط ${actor.fullName} حذف شد.`,
      entityType: 'ExternalServiceConfig',
      entityId: id,
    });

    return { id };
  }

  /** Real connectivity check — never a fabricated success. */
  async testExternal(actor: AuthenticatedUser, id: string) {
    const service = await this.getExternalOrThrow(id);
    const started = Date.now();
    let ok = false;
    let message: string;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), service.timeoutMs);
      try {
        const res = await fetch(service.endpoint, {
          method: service.method,
          signal: controller.signal,
        });
        ok = res.status < 500;
        message = `پاسخ HTTP ${res.status} در ${Date.now() - started}ms`;
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      ok = false;
      message =
        err instanceof Error && err.name === 'AbortError'
          ? `مهلت اتصال (${service.timeoutMs}ms) به پایان رسید`
          : `اتصال ناموفق: ${err instanceof Error ? err.message : 'خطای نامشخص'}`;
    }

    const updated = await this.prisma.externalServiceConfig.update({
      where: { id },
      data: {
        lastTestAt: new Date(),
        lastTestOk: ok,
        lastTestMessage: message,
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'تست اتصال سرویس خارجی',
      detail: `تست اتصال «${service.nameFa}» توسط ${actor.fullName}: ${message}`,
      entityType: 'ExternalServiceConfig',
      entityId: id,
    });

    return { ok, message, service: toExternalView(updated) };
  }

  /** Phase 14: real send counters + recent-log rows — no fabricated
   * uptime figure anywhere in this response (see docs/DB_SCHEMA.md). */
  async smsLog() {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const [service, todaySuccessCount, todayFailedCount, recent] =
      await Promise.all([
        this.prisma.internalService.findUnique({ where: { key: 'sms' } }),
        this.prisma.smsLog.count({
          where: { status: 'SUCCESS', createdAt: { gte: dayStart } },
        }),
        this.prisma.smsLog.count({
          where: { status: 'FAILED', createdAt: { gte: dayStart } },
        }),
        this.prisma.smsLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

    return {
      enabled: service?.enabled ?? false,
      todaySuccessCount,
      todayFailedCount,
      recent: recent.map((r) => ({
        id: r.id,
        phoneMasked: maskPhone(r.phone),
        messageType: r.messageType,
        status: r.status,
        failureReason: r.failureReason,
        createdAt: r.createdAt,
      })),
    };
  }
}

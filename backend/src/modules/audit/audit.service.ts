import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditCategory, Role } from '../../../generated/prisma/enums';
import type { Prisma } from '../../../generated/prisma/client';

export interface RecordAuditEntryInput {
  actorId: string;
  actorRole: Role;
  category: AuditCategory;
  action: string;
  detail: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEntryInput) {
    return this.prisma.auditLog.create({
      data: {
        ...input,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /**
   * CEO's "گزارش مدیران" excludes CEO/SENIOR_MANAGER/BOARD_CHAIR as actor —
   * "CEO oversees operational managers only" (confirmed in the design's own
   * code comment). Board Chair and Senior Manager see every role.
   */
  async managerReports(
    viewerRole: Role,
    filters: { category?: AuditCategory; actorRole?: Role; q?: string },
  ) {
    const excludedForCeo: Role[] = ['CEO', 'SENIOR_MANAGER', 'BOARD_CHAIR'];

    return this.prisma.auditLog.findMany({
      where: {
        ...(viewerRole === 'CEO'
          ? { actorRole: { notIn: excludedForCeo } }
          : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.actorRole ? { actorRole: filters.actorRole } : {}),
        ...(filters.q
          ? {
              OR: [
                { action: { contains: filters.q, mode: 'insensitive' } },
                { detail: { contains: filters.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** IT Manager's "لاگ و رویدادها" — system-category + account-management entries. */
  async systemLogs() {
    const rows = await this.prisma.auditLog.findMany({
      where: { OR: [{ category: 'SYSTEM' }, { category: 'ACCOUNT' }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        actor: { select: { fullName: true, dept: true, role: true } },
      },
    });

    const unitLabel = (dept: string | null | undefined, role: Role) => {
      if (dept === 'commercial') return 'بازرگانی';
      if (dept === 'finance') return 'مالی';
      if (dept === 'it') return 'IT';
      if (dept === 'sales') return 'فروش';
      if (role === 'IT_MANAGER') return 'IT';
      return '—';
    };

    const levelOf = (category: AuditCategory): 'info' | 'warn' | 'error' => {
      if (category === 'SECURITY') return 'warn';
      return 'info';
    };

    return rows.map((r) => ({
      id: r.id,
      actorRole: r.actorRole,
      category: r.category,
      action: r.action,
      detail: r.detail,
      createdAt: r.createdAt,
      actorName: r.actor.fullName,
      unit: unitLabel(r.actor.dept, r.actor.role),
      level: levelOf(r.category),
    }));
  }

  /** Lightweight count for the IT sidebar badge on «لاگ و رویدادها». */
  async systemLogsBadgeCount() {
    return this.prisma.auditLog.count({
      where: {
        OR: [{ category: 'SYSTEM' }, { category: 'ACCOUNT' }],
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
  }

  /** CEO's «لاگ‌ها و رویدادهای سامانه» — real rows across every actor
   * (unlike managerReports' exclusions). The level chip is a presentational
   * mapping only: SECURITY→WARN, financial categories→OK, else INFO. */
  async ceoSystemEvents() {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { actor: { select: { fullName: true } } },
    });

    const OK_CATEGORIES = new Set(['FINANCE', 'REFUND', 'PRICING', 'AGENCY']);
    return rows.map((r) => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      user: r.actor?.fullName ?? '—',
      actorRole: r.actorRole,
      action: r.action,
      detail: r.detail,
      level:
        r.category === 'SECURITY'
          ? 'WARN'
          : OK_CATEGORIES.has(r.category)
            ? 'OK'
            : 'INFO',
    }));
  }
}

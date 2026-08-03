import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsWhere,
  ILike,
  In,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';
import type { AuditCategory, Role } from '../../database/enums';
import type { JsonValue } from '../../database/json-types';

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
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async record(input: RecordAuditEntryInput) {
    return this.auditRepo.save(
      this.auditRepo.create({
        ...input,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: (input.metadata as JsonValue | undefined) ?? null,
        requestId: input.requestId ?? null,
      }),
    );
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

    const base: FindOptionsWhere<AuditLog> = {};
    if (viewerRole === 'CEO') base.actorRole = Not(In(excludedForCeo));
    if (filters.category) base.category = filters.category;
    if (filters.actorRole) base.actorRole = filters.actorRole;

    const where: FindOptionsWhere<AuditLog> | FindOptionsWhere<AuditLog>[] =
      filters.q
        ? [
            { ...base, action: ILike(`%${filters.q}%`) },
            { ...base, detail: ILike(`%${filters.q}%`) },
          ]
        : base;

    return this.auditRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  /** IT Manager's "لاگ و رویدادها" — system-category + account-management entries. */
  async systemLogs() {
    const rows = await this.auditRepo.find({
      where: [{ category: 'SYSTEM' }, { category: 'ACCOUNT' }],
      order: { createdAt: 'DESC' },
      take: 100,
      relations: { actor: true },
      select: {
        actor: { fullName: true, dept: true, role: true },
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
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.auditRepo.count({
      where: [
        { category: 'SYSTEM', createdAt: MoreThanOrEqual(since) },
        { category: 'ACCOUNT', createdAt: MoreThanOrEqual(since) },
      ],
    });
  }

  /** CEO's «لاگ‌ها و رویدادهای سامانه» — real rows across every actor
   * (unlike managerReports' exclusions). The level chip is a presentational
   * mapping only: SECURITY→WARN, financial categories→OK, else INFO. */
  async ceoSystemEvents() {
    const rows = await this.auditRepo.find({
      order: { createdAt: 'DESC' },
      take: 100,
      relations: { actor: true },
      select: { actor: { fullName: true } },
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

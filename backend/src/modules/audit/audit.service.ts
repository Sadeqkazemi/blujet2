import { Injectable } from '@nestjs/common';
import { TypeORMService } from '../../typeorm/typeorm.service';
import type { AuditCategory, Role } from '../../../generated/typeorm/enums';
import type { TypeORM } from '../../../generated/typeorm/client';

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
  constructor(private readonly typeorm: TypeORMService) {}

  async record(input: RecordAuditEntryInput) {
    return this.typeorm.auditLog.create({
      data: {
        ...input,
        metadata: input.metadata as TypeORM.InputJsonValue | undefined,
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

    return this.typeorm.auditLog.findMany({
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
    return this.typeorm.auditLog.findMany({
      where: { OR: [{ category: 'SYSTEM' }, { category: 'ACCOUNT' }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

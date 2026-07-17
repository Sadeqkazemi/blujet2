import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

/** Which employee depts each manager's «گزارش کارمندان» tab covers — the
 * design shows finance staff to the Finance Manager and sales staff to the
 * Commercial Manager ("sales" is Commercial's sub-unit, per Phase 8). */
const DEPTS_BY_ROLE: Record<string, string[]> = {
  FINANCE_MANAGER: ['finance'],
  COMMERCIAL_MANAGER: ['commercial', 'sales'],
};

@Injectable()
export class StaffReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async reports(actor: AuthenticatedUser, staffId?: string) {
    const depts = DEPTS_BY_ROLE[actor.role] ?? [];

    const staff = await this.prisma.user.findMany({
      where: { role: 'EMPLOYEE', dept: { in: depts }, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        rank: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const staffIds = staff.map((s) => s.id);

    // Dept isolation is structural: a staffId outside the caller's dept
    // simply matches no rows (empty feed), never someone else's feed.
    const feedActorIds = staffId
      ? staffIds.filter((id) => id === staffId)
      : staffIds;

    const [reports, newEmployeeEvents] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { actorId: { in: feedActorIds } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { actor: { select: { fullName: true } } },
      }),
      // The «کارمند جدید توسط مدیر IT اضافه شد» banner — real ACCOUNT
      // audit events for this dept's employees, newest first.
      this.prisma.auditLog.findMany({
        where: {
          category: 'ACCOUNT',
          entityType: 'User',
          entityId: { in: staffIds },
          action: { contains: 'ایجاد' },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      staff,
      reports: reports.map((r) => ({
        id: r.id,
        action: r.action,
        category: r.category,
        detail: r.detail,
        staffId: r.actorId,
        staffName: r.actor?.fullName ?? '—',
        at: r.createdAt.toISOString(),
      })),
      newEmployeeEvents: newEmployeeEvents.map((e) => ({
        id: e.id,
        detail: e.detail,
        at: e.createdAt.toISOString(),
      })),
    };
  }
}

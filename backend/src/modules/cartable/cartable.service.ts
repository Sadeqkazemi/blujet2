import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import { STAFF_ROLES } from '../../common/exec-roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type {
  CartableCategory,
  CartableStatus,
  Role,
} from '../../../generated/prisma/enums';
import type { CartableTask } from '../../../generated/prisma/client';

@Injectable()
export class CartableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async getOwnOpenTaskOrThrow(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<CartableTask> {
    const task = await this.prisma.cartableTask.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'مورد کارتابل یافت نشد.',
      });
    }
    // Ownership before state: someone else's task is a 403/404 concern, not 409.
    if (task.assigneeId !== actor.id) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'این مورد در کارتابل شما نیست.',
      });
    }
    if (task.status !== 'OPEN') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این مورد قبلاً بررسی شده است.',
      });
    }
    return task;
  }

  async list(
    actor: AuthenticatedUser,
    query: {
      category?: CartableCategory;
      date?: string;
      status?: CartableStatus;
    },
  ) {
    const status = query.status ?? 'OPEN';
    const dateFilter = query.date
      ? {
          createdAt: {
            gte: new Date(query.date),
            lt: new Date(new Date(query.date).getTime() + 24 * 60 * 60 * 1000),
          },
        }
      : {};

    const [tasks, countRows] = await Promise.all([
      this.prisma.cartableTask.findMany({
        where: {
          assigneeId: actor.id,
          status,
          ...(query.category ? { category: query.category } : {}),
          ...dateFilter,
        },
        include: { sender: { select: { fullName: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      // KPI cards always show OPEN counts per category, unfiltered by the
      // table's own category/date selection (matches the design).
      this.prisma.cartableTask.groupBy({
        by: ['category'],
        where: { assigneeId: actor.id, status: 'OPEN' },
        _count: { _all: true },
      }),
    ]);

    const counts = { ADMIN: 0, AGENCY: 0, MANAGER: 0 };
    for (const row of countRows) counts[row.category] = row._count._all;

    return {
      tasks,
      counts,
      totalOpen: counts.ADMIN + counts.AGENCY + counts.MANAGER,
    };
  }

  /** Side effects of resolving a task, keyed by its source link. */
  private async applySourceEffects(
    actor: AuthenticatedUser,
    task: CartableTask,
    decision: 'APPROVED' | 'REJECTED',
    note: string,
  ) {
    if (task.sourceType === 'CHAIR_PERMISSION' && task.sourceId) {
      await this.prisma.chairReportPermission.update({
        where: { id: task.sourceId },
        data: {
          status: decision,
          decidedById: actor.id,
          decidedAt: new Date(),
        },
      });
    }

    // The recipient's review of a referral task doubles as the report
    // submission surface (⚑ in docs/DB_SCHEMA.md): approving submits the
    // note as the report; rejecting resolves the task without one.
    if (
      task.sourceType === 'MANAGER_REFERRAL' &&
      task.sourceId &&
      decision === 'APPROVED'
    ) {
      const referral = await this.prisma.managerReferral.findUnique({
        where: { id: task.sourceId },
      });
      if (referral && referral.status !== 'CLOSED') {
        await this.prisma.managerReferralReport.create({
          data: { referralId: referral.id, fromId: actor.id, body: note },
        });
        await this.prisma.managerReferral.update({
          where: { id: referral.id },
          data: { status: 'REPORTED' },
        });
      }
    }
  }

  private async resolve(
    actor: AuthenticatedUser,
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    note: string,
  ) {
    const task = await this.getOwnOpenTaskOrThrow(actor, id);

    // Conditional update guards against two concurrent resolutions.
    const updated = await this.prisma.cartableTask.updateMany({
      where: { id, status: 'OPEN' },
      data: { status: decision, resolutionNote: note, resolvedAt: new Date() },
    });
    if (updated.count === 0) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این مورد قبلاً بررسی شده است.',
      });
    }

    await this.applySourceEffects(actor, task, decision, note);

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action:
        decision === 'APPROVED' ? 'تأیید مورد کارتابل' : 'رد مورد کارتابل',
      detail: `«${task.title}» توسط ${actor.fullName} ${decision === 'APPROVED' ? 'تأیید' : 'رد'} شد. نظر مدیر: ${note}`,
      entityType: 'CartableTask',
      entityId: id,
    });

    return this.prisma.cartableTask.findUniqueOrThrow({ where: { id } });
  }

  approve(actor: AuthenticatedUser, id: string, note: string) {
    return this.resolve(actor, id, 'APPROVED', note);
  }

  reject(actor: AuthenticatedUser, id: string, note: string) {
    return this.resolve(actor, id, 'REJECTED', note);
  }

  async transfer(
    actor: AuthenticatedUser,
    id: string,
    toId: string,
    note: string,
  ) {
    const task = await this.getOwnOpenTaskOrThrow(actor, id);

    const target = await this.prisma.user.findUnique({ where: { id: toId } });
    if (
      !target ||
      !target.isActive ||
      !STAFF_ROLES.includes(target.role as (typeof STAFF_ROLES)[number]) ||
      target.id === actor.id
    ) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'مدیر مقصد انتقال معتبر نیست.',
      });
    }

    const newTask = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cartableTask.updateMany({
        where: { id, status: 'OPEN' },
        data: {
          status: 'TRANSFERRED',
          resolutionNote: note,
          transferredToId: toId,
          resolvedAt: new Date(),
        },
      });
      if (updated.count === 0) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این مورد قبلاً بررسی شده است.',
        });
      }
      // The mocks toast and drop the item; the real system routes it (⚑).
      return tx.cartableTask.create({
        data: {
          assigneeId: toId,
          category: task.category,
          title: task.title,
          description: task.description,
          senderId: task.senderId,
          senderLabelFa: task.senderLabelFa,
          sourceType: task.sourceType,
          sourceId: task.sourceId,
        },
      });
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'انتقال مورد کارتابل',
      detail: `«${task.title}» توسط ${actor.fullName} به ${target.fullName} منتقل شد. نظر مدیر: ${note}`,
      entityType: 'CartableTask',
      entityId: id,
      metadata: { transferredToId: toId, newTaskId: newTask.id },
    });

    return newTask;
  }

  // ── Chairman permission gate (Finance/Commercial only) ─────────────────

  async requestChairPermission(actor: AuthenticatedUser) {
    const existing = await this.prisma.chairReportPermission.findFirst({
      where: { requesterId: actor.id, status: { in: ['PENDING', 'APPROVED'] } },
    });
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          existing.status === 'PENDING'
            ? 'درخواست قبلی شما هنوز در انتظار تأیید است.'
            : 'مجوز شما قبلاً تأیید شده است.',
      });
    }

    const chair = await this.prisma.user.findFirst({
      where: { role: 'BOARD_CHAIR', isActive: true },
    });
    if (!chair) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'حساب رئیس هیئت مدیره در دسترس نیست.',
      });
    }

    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.chairReportPermission.create({
        data: { requesterId: actor.id },
      });
      await tx.cartableTask.create({
        data: {
          assigneeId: chair.id,
          category: 'MANAGER',
          title: 'درخواست مجوز ارسال گزارش به رئیس هیئت مدیره',
          description: `${actor.fullName} درخواست مجوز ارسال گزارش مستقیم به رئیس هیئت مدیره را دارد.`,
          senderId: actor.id,
          sourceType: 'CHAIR_PERMISSION',
          sourceId: created.id,
        },
      });
      return created;
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'ACCESS',
      action: 'درخواست مجوز از رئیس هیئت مدیره',
      detail: `${actor.fullName} درخواست مجوز ارسال گزارش به رئیس هیئت مدیره را ثبت کرد.`,
      entityType: 'ChairReportPermission',
      entityId: request.id,
    });

    return request;
  }

  async getChairPermission(actor: AuthenticatedUser) {
    const latest = await this.prisma.chairReportPermission.findFirst({
      where: { requesterId: actor.id },
      orderBy: { createdAt: 'desc' },
    });
    // Wrapped: the shared response envelope treats a bare null data as an
    // error, and "no request yet" is a perfectly valid state.
    return { latest };
  }

  // ── Internal API for sibling modules (referrals/messages/agencies) ─────

  async createTask(input: {
    assigneeId: string;
    category: CartableCategory;
    title: string;
    description: string;
    senderId?: string;
    senderLabelFa?: string;
    sourceType?:
      | 'MANAGER_MESSAGE'
      | 'MANAGER_REFERRAL'
      | 'AGENCY_REQUEST'
      | 'CHAIR_PERMISSION';
    sourceId?: string;
  }) {
    return this.prisma.cartableTask.create({ data: input });
  }

  /** Fans a task out to every active user holding one of the given roles. */
  async createTasksForRoles(
    roles: Role[],
    input: Omit<Parameters<CartableService['createTask']>[0], 'assigneeId'>,
    excludeUserId?: string,
  ) {
    const recipients = await this.prisma.user.findMany({
      where: {
        role: { in: roles },
        isActive: true,
        id: { not: excludeUserId },
      },
      select: { id: true },
    });
    for (const r of recipients) {
      await this.createTask({ ...input, assigneeId: r.id });
    }
    return recipients.length;
  }
}

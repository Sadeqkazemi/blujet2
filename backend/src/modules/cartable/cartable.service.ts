import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Not, Raw, Repository } from 'typeorm';
import { CartableTask } from '../../database/entities/cartable-task.entity';
import { ChairReportPermission } from '../../database/entities/chair-report-permission.entity';
import { ManagerReferral } from '../../database/entities/manager-referral.entity';
import { ManagerReferralReport } from '../../database/entities/manager-referral-report.entity';
import { User } from '../../database/entities/user.entity';
import { findOneOrThrow } from '../../database/utils/find-one-or-throw';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import {
  EXEC_ROLES,
  ROLE_LABELS_FA,
  STAFF_ROLES,
} from '../../common/exec-roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type {
  CartableCategory,
  CartableStatus,
  Role,
} from '../../database/enums';

@Injectable()
export class CartableService {
  constructor(
    @InjectRepository(CartableTask)
    private readonly taskRepo: Repository<CartableTask>,
    @InjectRepository(ChairReportPermission)
    private readonly chairPermissionRepo: Repository<ChairReportPermission>,
    @InjectRepository(ManagerReferral)
    private readonly managerReferralRepo: Repository<ManagerReferral>,
    @InjectRepository(ManagerReferralReport)
    private readonly managerReferralReportRepo: Repository<ManagerReferralReport>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  private async getOwnOpenTaskOrThrow(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<CartableTask> {
    const task = await this.taskRepo.findOneBy({ id });
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
    const where: FindOptionsWhere<CartableTask> = {
      assigneeId: actor.id,
      status,
    };
    if (query.category) where.category = query.category;
    if (query.date) {
      const start = new Date(query.date);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      where.createdAt = Raw(
        (alias) => `${alias} >= :start AND ${alias} < :end`,
        {
          start,
          end,
        },
      );
    }

    const [tasks, countRows] = await Promise.all([
      this.taskRepo.find({
        where,
        relations: { sender: true },
        select: { sender: { fullName: true, role: true } },
        order: { createdAt: 'DESC' },
      }),
      // KPI cards always show OPEN counts per category, unfiltered by the
      // table's own category/date selection (matches the design).
      this.taskRepo
        .createQueryBuilder('t')
        .select('t.category', 'category')
        .addSelect('COUNT(*)', 'count')
        .where('t.assigneeId = :assigneeId', { assigneeId: actor.id })
        .andWhere('t.status = :status', { status: 'OPEN' })
        .groupBy('t.category')
        .getRawMany<{
          category: 'ADMIN' | 'AGENCY' | 'MANAGER';
          count: string;
        }>(),
    ]);

    const counts = { ADMIN: 0, AGENCY: 0, MANAGER: 0 };
    for (const row of countRows) counts[row.category] = parseInt(row.count, 10);

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
      await this.chairPermissionRepo.update(
        { id: task.sourceId },
        {
          status: decision,
          decidedById: actor.id,
          decidedAt: new Date(),
        },
      );
    }

    // The recipient's review of a referral task doubles as the report
    // submission surface (⚑ in docs/DB_SCHEMA.md): approving submits the
    // note as the report; rejecting resolves the task without one.
    if (
      task.sourceType === 'MANAGER_REFERRAL' &&
      task.sourceId &&
      decision === 'APPROVED'
    ) {
      const referral = await this.managerReferralRepo
        .createQueryBuilder('r')
        .where('r.id = :id', { id: task.sourceId })
        .getOne();
      if (referral && referral.status !== 'CLOSED') {
        await this.managerReferralReportRepo.save(
          this.managerReferralReportRepo.create({
            referralId: referral.id,
            fromId: actor.id,
            body: note,
          }),
        );
        await this.managerReferralRepo.update(
          { id: referral.id },
          { status: 'REPORTED' },
        );
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
    const updated = await this.taskRepo.update(
      { id, status: 'OPEN' },
      { status: decision, resolutionNote: note, resolvedAt: new Date() },
    );
    if (!updated.affected) {
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

    return findOneOrThrow(this.taskRepo, { where: { id } });
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

    const target = await this.userRepo.findOneBy({ id: toId });
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

    const newTask = await this.taskRepo.manager.transaction(async (tx) => {
      const updated = await tx.update(
        CartableTask,
        { id, status: 'OPEN' },
        {
          status: 'TRANSFERRED',
          resolutionNote: note,
          transferredToId: toId,
          resolvedAt: new Date(),
        },
      );
      if (!updated.affected) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این مورد قبلاً بررسی شده است.',
        });
      }
      // The mocks toast and drop the item; the real system routes it (⚑).
      return tx.save(
        tx.create(CartableTask, {
          assigneeId: toId,
          category: task.category,
          title: task.title,
          description: task.description,
          senderId: task.senderId,
          senderLabelFa: task.senderLabelFa,
          sourceType: task.sourceType,
          sourceId: task.sourceId,
        }),
      );
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
    const existing = await this.chairPermissionRepo.findOneBy({
      requesterId: actor.id,
      status: In(['PENDING', 'APPROVED']),
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

    const chair = await this.userRepo.findOneBy({
      role: 'BOARD_CHAIR',
      isActive: true,
    });
    if (!chair) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'حساب رئیس هیئت مدیره در دسترس نیست.',
      });
    }

    const request = await this.chairPermissionRepo.manager.transaction(
      async (tx) => {
        const created = await tx.save(
          tx.create(ChairReportPermission, { requesterId: actor.id }),
        );
        await tx.save(
          tx.create(CartableTask, {
            assigneeId: chair.id,
            category: 'MANAGER',
            title: 'درخواست مجوز ارسال گزارش به رئیس هیئت مدیره',
            description: `${actor.fullName} درخواست مجوز ارسال گزارش مستقیم به رئیس هیئت مدیره را دارد.`,
            senderId: actor.id,
            sourceType: 'CHAIR_PERMISSION',
            sourceId: created.id,
          }),
        );
        return created;
      },
    );

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
    const latest = await this.chairPermissionRepo.findOne({
      where: { requesterId: actor.id },
      order: { createdAt: 'DESC' },
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
      | 'CHAIR_PERMISSION'
      | 'EMPLOYEE_MESSAGE';
    sourceId?: string;
  }) {
    return this.taskRepo.save(this.taskRepo.create(input));
  }

  /** Fans a task out to every active user holding one of the given roles. */
  async createTasksForRoles(
    roles: Role[],
    input: Omit<Parameters<CartableService['createTask']>[0], 'assigneeId'>,
    excludeUserId?: string,
  ) {
    const recipients = await this.userRepo.find({
      where: {
        role: In(roles),
        isActive: true,
        ...(excludeUserId ? { id: Not(excludeUserId) } : {}),
      },
      select: { id: true },
    });
    for (const r of recipients) {
      await this.createTask({ ...input, assigneeId: r.id });
    }
    return recipients.length;
  }

  /** Dept → the exec manager role that owns the employee's unit. */
  private deptManagerRole(dept: string | null | undefined): Role | null {
    if (dept === 'commercial' || dept === 'sales') return 'COMMERCIAL_MANAGER';
    if (dept === 'finance') return 'FINANCE_MANAGER';
    if (dept === 'it') return 'IT_MANAGER';
    return null;
  }

  async listManagerRecipients(actor: AuthenticatedUser) {
    const employee = await findOneOrThrow(this.userRepo, {
      where: { id: actor.id },
      select: { dept: true },
    });
    const ownRole = this.deptManagerRole(employee.dept);

    const managers = await this.userRepo.find({
      where: {
        role: In([...EXEC_ROLES, 'IT_MANAGER', 'SITE_ADMIN']),
        isActive: true,
      },
      select: { id: true, fullName: true, role: true },
      order: { fullName: 'ASC' },
    });

    return managers.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      role: m.role,
      roleLabelFa: ROLE_LABELS_FA[m.role],
      isOwnManager: ownRole !== null && m.role === ownRole,
    }));
  }

  async sendEmployeeManagerMessage(
    actor: AuthenticatedUser,
    dto: { toId: string; body: string },
  ) {
    const target = await this.userRepo.findOneBy({ id: dto.toId });
    if (
      !target ||
      !target.isActive ||
      ![...EXEC_ROLES, 'IT_MANAGER', 'SITE_ADMIN'].includes(target.role)
    ) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'گیرندهٔ پیام معتبر نیست.',
      });
    }

    const task = await this.createTask({
      assigneeId: target.id,
      category: 'MANAGER',
      title: `پیام از ${actor.fullName}`,
      description: dto.body,
      senderId: actor.id,
      senderLabelFa: `${actor.fullName} · کارمند`,
      sourceType: 'EMPLOYEE_MESSAGE',
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'ارسال پیام کارمند به مدیر',
      detail: `${actor.fullName} پیامی به ${target.fullName} ارسال کرد.`,
      entityType: 'CartableTask',
      entityId: task.id,
    });

    return {
      id: task.id,
      to: { id: target.id, fullName: target.fullName },
      body: dto.body,
      createdAt: task.createdAt,
    };
  }

  async listSentEmployeeManagerMessages(actor: AuthenticatedUser) {
    const rows = await this.taskRepo.find({
      where: { senderId: actor.id, sourceType: 'EMPLOYEE_MESSAGE' },
      relations: { assignee: true },
      select: { assignee: { fullName: true } },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return rows.map((r) => ({
      id: r.id,
      toName: r.assignee.fullName,
      body: r.description,
      createdAt: r.createdAt,
    }));
  }
}

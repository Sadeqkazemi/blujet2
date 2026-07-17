import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CartableService } from '../cartable/cartable.service';
import { ErrorCode } from '../../common/errors';
import { STAFF_ROLES } from '../../common/exec-roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { ReferralPriority } from '../../../generated/prisma/enums';

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cartable: CartableService,
  ) {}

  private async getOwnOrThrow(actor: AuthenticatedUser, id: string) {
    const referral = await this.prisma.managerReferral.findUnique({
      where: { id },
      include: {
        recipients: {
          include: {
            recipient: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    });
    if (!referral) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'ارجاع یافت نشد.',
      });
    }
    if (referral.fromId !== actor.id) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'فقط ایجادکننده ارجاع می‌تواند این اقدام را انجام دهد.',
      });
    }
    return referral;
  }

  private async assertOwnedAttachments(
    actor: AuthenticatedUser,
    attachmentIds?: string[],
  ) {
    if (!attachmentIds || attachmentIds.length === 0) return;
    const owned = await this.prisma.storedFile.count({
      where: { id: { in: attachmentIds }, ownerId: actor.id },
    });
    if (owned !== attachmentIds.length) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'فایل پیوست معتبر نیست.',
      });
    }
  }

  async list(actor: AuthenticatedUser) {
    const referrals = await this.prisma.managerReferral.findMany({
      where: { fromId: actor.id },
      include: {
        recipients: {
          include: {
            recipient: { select: { id: true, fullName: true, role: true } },
          },
        },
        _count: { select: { reports: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const counts = {
      total: referrals.length,
      sent: 0,
      reviewing: 0,
      reported: 0,
      closed: 0,
    };
    for (const r of referrals) {
      if (r.status === 'SENT') counts.sent += 1;
      else if (r.status === 'REVIEWING') counts.reviewing += 1;
      else if (r.status === 'REPORTED') counts.reported += 1;
      else counts.closed += 1;
    }
    // The design's «در انتظار گزارش» card counts both sent and reviewing.
    return {
      referrals,
      kpis: {
        total: counts.total,
        awaitingReport: counts.sent + counts.reviewing,
        reported: counts.reported,
        closed: counts.closed,
      },
    };
  }

  async create(
    actor: AuthenticatedUser,
    dto: {
      title: string;
      body: string;
      recipientIds: string[];
      priority?: ReferralPriority;
      dueAt?: string;
      attachmentIds?: string[];
    },
  ) {
    const recipients = await this.prisma.user.findMany({
      where: {
        id: { in: dto.recipientIds },
        isActive: true,
        role: { in: [...STAFF_ROLES] },
      },
    });
    if (recipients.length !== new Set(dto.recipientIds).size) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'مدیر(ان) مقصد معتبر نیستند.',
      });
    }
    if (dto.recipientIds.includes(actor.id)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'ارجاع به خودتان ممکن نیست.',
      });
    }
    await this.assertOwnedAttachments(actor, dto.attachmentIds);

    const referral = await this.prisma.managerReferral.create({
      data: {
        fromId: actor.id,
        title: dto.title,
        body: dto.body,
        priority: dto.priority ?? 'MEDIUM',
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        attachments: dto.attachmentIds ?? [],
        recipients: {
          create: dto.recipientIds.map((recipientId) => ({ recipientId })),
        },
      },
      include: {
        recipients: {
          include: {
            recipient: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    });

    // Delivery wiring (⚑): recipients have no referrals tab — they receive
    // and answer through their cartable.
    for (const recipientId of dto.recipientIds) {
      await this.cartable.createTask({
        assigneeId: recipientId,
        category: 'MANAGER',
        title: dto.title,
        description: dto.body,
        senderId: actor.id,
        sourceType: 'MANAGER_REFERRAL',
        sourceId: referral.id,
      });
    }

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'STRATEGY',
      action: 'ایجاد ارجاع به مدیران',
      detail: `ارجاع «${dto.title}» توسط ${actor.fullName} به ${recipients.map((r) => r.fullName).join('، ')} ارسال شد.`,
      entityType: 'ManagerReferral',
      entityId: referral.id,
    });

    return referral;
  }

  async detail(actor: AuthenticatedUser, id: string) {
    const referral = await this.prisma.managerReferral.findUnique({
      where: { id },
      include: {
        from: { select: { id: true, fullName: true, role: true } },
        recipients: {
          include: {
            recipient: { select: { id: true, fullName: true, role: true } },
          },
        },
        reports: {
          include: {
            from: { select: { id: true, fullName: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!referral) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'ارجاع یافت نشد.',
      });
    }
    const isSender = referral.fromId === actor.id;
    const isRecipient = referral.recipients.some(
      (r) => r.recipientId === actor.id,
    );
    if (!isSender && !isRecipient) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'دسترسی به این ارجاع برای شما مجاز نیست.',
      });
    }
    return referral;
  }

  async submitReport(
    actor: AuthenticatedUser,
    id: string,
    dto: { body: string; attachmentIds?: string[] },
  ) {
    const referral = await this.prisma.managerReferral.findUnique({
      where: { id },
      include: { recipients: true },
    });
    if (!referral) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'ارجاع یافت نشد.',
      });
    }
    if (!referral.recipients.some((r) => r.recipientId === actor.id)) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'فقط مدیر(ان) مقصد می‌توانند گزارش ثبت کنند.',
      });
    }
    if (referral.status === 'CLOSED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این ارجاع پس از تأیید گزارش بسته شده است.',
      });
    }
    await this.assertOwnedAttachments(actor, dto.attachmentIds);

    const report = await this.prisma.managerReferralReport.create({
      data: {
        referralId: id,
        fromId: actor.id,
        body: dto.body,
        attachments: dto.attachmentIds ?? [],
      },
    });
    await this.prisma.managerReferral.update({
      where: { id },
      data: { status: 'REPORTED' },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'STRATEGY',
      action: 'ثبت گزارش ارجاع',
      detail: `گزارش ارجاع «${referral.title}» توسط ${actor.fullName} ثبت شد.`,
      entityType: 'ManagerReferral',
      entityId: id,
    });

    return report;
  }

  async close(actor: AuthenticatedUser, id: string) {
    const referral = await this.getOwnOrThrow(actor, id);
    if (referral.status !== 'REPORTED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'فقط ارجاع دارای گزارش دریافت‌شده قابل بستن است.',
      });
    }
    const updated = await this.prisma.managerReferral.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'STRATEGY',
      action: 'تأیید گزارش و بستن ارجاع',
      detail: `ارجاع «${referral.title}» توسط ${actor.fullName} بسته شد.`,
      entityType: 'ManagerReferral',
      entityId: id,
    });
    return updated;
  }

  async requestRevision(actor: AuthenticatedUser, id: string) {
    const referral = await this.getOwnOrThrow(actor, id);
    if (referral.status !== 'REPORTED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'درخواست اصلاح فقط برای گزارش دریافت‌شده ممکن است.',
      });
    }
    const updated = await this.prisma.managerReferral.update({
      where: { id },
      data: { status: 'REVIEWING' },
    });
    // Ask recipients again through their cartable.
    for (const r of referral.recipients) {
      await this.cartable.createTask({
        assigneeId: r.recipientId,
        category: 'MANAGER',
        title: `درخواست اصلاح گزارش: ${referral.title}`,
        description: 'گزارش ارسالی نیازمند اصلاح و تکمیل است.',
        senderId: actor.id,
        sourceType: 'MANAGER_REFERRAL',
        sourceId: referral.id,
      });
    }
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'STRATEGY',
      action: 'درخواست اصلاح گزارش ارجاع',
      detail: `درخواست اصلاح گزارش «${referral.title}» توسط ${actor.fullName} ارسال شد.`,
      entityType: 'ManagerReferral',
      entityId: id,
    });
    return updated;
  }

  async remind(actor: AuthenticatedUser, id: string) {
    const referral = await this.getOwnOrThrow(actor, id);
    if (referral.status !== 'SENT' && referral.status !== 'REVIEWING') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'یادآوری فقط برای ارجاع در انتظار گزارش ممکن است.',
      });
    }
    const updated = await this.prisma.managerReferral.update({
      where: { id },
      data: { status: 'REVIEWING' },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'STRATEGY',
      action: 'یادآوری دریافت گزارش ارجاع',
      detail: `یادآوری دریافت گزارش «${referral.title}» توسط ${actor.fullName} ارسال شد.`,
      entityType: 'ManagerReferral',
      entityId: id,
    });
    return updated;
  }
}

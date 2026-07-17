import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CartableService } from '../cartable/cartable.service';
import { ErrorCode } from '../../common/errors';
import { EXEC_ROLES } from '../../common/exec-roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { ManagerMessageDept, Role } from '../../../generated/prisma/enums';

/** Dept option → recipient role(s). SUPPORT/AGENCIES have no backing staff
 * role until Phase 8's employee/department model — accepted but flagged. */
const DEPT_ROLES: Record<ManagerMessageDept, Role[]> = {
  FINANCE: ['FINANCE_MANAGER'],
  COMMERCIAL: ['COMMERCIAL_MANAGER'],
  CEO: ['CEO'],
  ALL_MANAGERS: [...EXEC_ROLES],
  SUPPORT: [],
  AGENCIES: [],
};

export const DEPT_LABELS_FA: Record<ManagerMessageDept, string> = {
  FINANCE: 'واحد مالی',
  COMMERCIAL: 'واحد بازرگانی',
  SUPPORT: 'واحد پشتیبانی',
  AGENCIES: 'واحد آژانس‌ها',
  CEO: 'مدیر عامل سامانه',
  ALL_MANAGERS: 'همه مدیران (اعلان عمومی)',
};

@Injectable()
export class ManagerMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cartable: CartableService,
  ) {}

  async send(
    actor: AuthenticatedUser,
    dto: {
      toDept: ManagerMessageDept;
      subject: string;
      body: string;
      attachmentIds?: string[];
    },
  ) {
    if (dto.attachmentIds && dto.attachmentIds.length > 0) {
      const owned = await this.prisma.storedFile.count({
        where: { id: { in: dto.attachmentIds }, ownerId: actor.id },
      });
      if (owned !== dto.attachmentIds.length) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'فایل پیوست معتبر نیست.',
        });
      }
    }

    const message = await this.prisma.managerMessage.create({
      data: {
        fromId: actor.id,
        toDept: dto.toDept,
        subject: dto.subject,
        body: dto.body,
        attachments: dto.attachmentIds ?? [],
      },
    });

    // Delivery wiring (⚑): the design has no inbox — recipients get the
    // message as a cartable item.
    const roles = DEPT_ROLES[dto.toDept];
    const deliveredCount =
      roles.length > 0
        ? await this.cartable.createTasksForRoles(
            roles,
            {
              category: 'ADMIN',
              title: dto.subject,
              description: dto.body,
              senderId: actor.id,
              sourceType: 'MANAGER_MESSAGE',
              sourceId: message.id,
            },
            actor.id,
          )
        : 0;

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'ارسال پیام سازمانی',
      detail: `پیام «${dto.subject}» توسط ${actor.fullName} به ${DEPT_LABELS_FA[dto.toDept]} ارسال شد.`,
      entityType: 'ManagerMessage',
      entityId: message.id,
      metadata: { deliveredCount },
    });

    return {
      message,
      deliveredCount,
      // Documented PARTIAL_DELIVERY: dept accepted but no backing role yet.
      ...(roles.length === 0 ? { warning: 'PARTIAL_DELIVERY' as const } : {}),
    };
  }

  async sent(actor: AuthenticatedUser) {
    const messages = await this.prisma.managerMessage.findMany({
      where: { fromId: actor.id },
      orderBy: { createdAt: 'desc' },
    });
    return messages.map((m) => ({
      ...m,
      toDeptLabelFa: DEPT_LABELS_FA[m.toDept],
    }));
  }
}

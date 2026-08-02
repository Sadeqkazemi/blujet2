import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { AuditService } from '../audit/audit.service';
import { StaffDirectoryService } from '../staff-directory/staff-directory.module';
import { ErrorCode } from '../../common/errors';
import { normalizeIranPhone } from '../../common/normalize-iran-phone';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type {
  TypeORM,
  SupportTicketStatus,
} from '../../../generated/typeorm/client';
import type { SubmitSupportTicketDto } from './dto/support-ticket.dtos';

function generateTrackingCode(): string {
  return `TK${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

const CUSTOMER_TICKET_SELECT = {
  id: true,
  trackingCode: true,
  subject: true,
  body: true,
  status: true,
  history: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class SupportTicketsService {
  constructor(
    private readonly typeorm: TypeORMService,
    private readonly audit: AuditService,
    private readonly staffDirectory: StaffDirectoryService,
  ) {}

  async submit(dto: SubmitSupportTicketDto) {
    const ticket = await this.typeorm.supportTicket.create({
      data: {
        trackingCode: generateTrackingCode(),
        requesterName: dto.requesterName,
        requesterPhone: normalizeIranPhone(dto.requesterPhone),
        subject: dto.subject,
        body: dto.body,
        history: [
          {
            step: 'submitted',
            labelFa: 'ثبت تیکت توسط کاربر',
            at: new Date().toISOString(),
          },
        ],
      },
    });
    return { id: ticket.id, trackingCode: ticket.trackingCode };
  }

  async submitForUser(actor: AuthenticatedUser, dto: SubmitSupportTicketDto) {
    const ticket = await this.typeorm.supportTicket.create({
      data: {
        userId: actor.id,
        trackingCode: generateTrackingCode(),
        requesterName: dto.requesterName,
        requesterPhone: normalizeIranPhone(dto.requesterPhone),
        subject: dto.subject,
        body: dto.body,
        history: [
          {
            step: 'submitted',
            labelFa: 'ثبت تیکت توسط کاربر',
            at: new Date().toISOString(),
          },
        ],
      },
      select: CUSTOMER_TICKET_SELECT,
    });
    return { id: ticket.id, trackingCode: ticket.trackingCode };
  }

  private async callerPhone(userId: string): Promise<string | null> {
    const user = await this.typeorm.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    return user?.phone ?? null;
  }

  private customerTicketWhere(
    userId: string,
    phone: string | null,
  ): TypeORM.SupportTicketWhereInput {
    const or: TypeORM.SupportTicketWhereInput[] = [{ userId }];
    if (phone) {
      or.push({ userId: null, requesterPhone: phone });
    }
    return { OR: or };
  }

  async listMine(actor: AuthenticatedUser) {
    const phone = await this.callerPhone(actor.id);
    return this.typeorm.supportTicket.findMany({
      where: this.customerTicketWhere(actor.id, phone),
      select: CUSTOMER_TICKET_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMine(actor: AuthenticatedUser, id: string) {
    const phone = await this.callerPhone(actor.id);
    const ticket = await this.typeorm.supportTicket.findFirst({
      where: { id, ...this.customerTicketWhere(actor.id, phone) },
      select: CUSTOMER_TICKET_SELECT,
    });
    if (!ticket) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'تیکت یافت نشد.',
      });
    }
    return ticket;
  }

  async list(filters: {
    status?: SupportTicketStatus;
    dept?: 'SITE' | 'AGENCY';
  }) {
    return this.typeorm.supportTicket.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.dept ? { dept: filters.dept } : {}),
      },
      include: {
        forwardedTo: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getOrThrow(id: string) {
    const ticket = await this.typeorm.supportTicket.findUnique({
      where: { id },
      include: {
        forwardedTo: { select: { id: true, fullName: true, role: true } },
      },
    });
    if (!ticket) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'تیکت یافت نشد.',
      });
    }
    return ticket;
  }

  async detail(id: string) {
    return this.getOrThrow(id);
  }

  /** Forwarding-target picker, scoped to this ticket system rather than
   * widening StaffDirectoryController's own EXEC_ROLES-only endpoint (see
   * docs/API.md's Phase 20 note). */
  async forwardTargets(actor: AuthenticatedUser) {
    return this.staffDirectory.list(actor.id);
  }

  async forward(actor: AuthenticatedUser, id: string, targetUserId: string) {
    const ticket = await this.getOrThrow(id);
    const targets = await this.staffDirectory.list(actor.id);
    const target = targets.find((t) => t.id === targetUserId);
    if (!target) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'کارمند مقصد ارجاع معتبر نیست.',
      });
    }

    const history = Array.isArray(ticket.history)
      ? [...(ticket.history as unknown[])]
      : [];
    history.push({
      step: 'forwarded',
      labelFa: `ارجاع به ${target.fullName} (${target.roleLabelFa}) توسط ${actor.fullName}`,
      at: new Date().toISOString(),
    });

    const updated = await this.typeorm.supportTicket.update({
      where: { id },
      data: {
        forwardedToId: targetUserId,
        status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
        history: history as TypeORM.InputJsonValue,
      },
      include: {
        forwardedTo: { select: { id: true, fullName: true, role: true } },
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'ارجاع تیکت پشتیبانی',
      detail: `تیکت «${ticket.subject}» توسط ${actor.fullName} به ${target.fullName} ارجاع شد.`,
      entityType: 'SupportTicket',
      entityId: id,
    });

    return updated;
  }

  async updateStatus(
    actor: AuthenticatedUser,
    id: string,
    status: SupportTicketStatus,
  ) {
    const ticket = await this.getOrThrow(id);

    const history = Array.isArray(ticket.history)
      ? [...(ticket.history as unknown[])]
      : [];
    history.push({
      step: status.toLowerCase(),
      labelFa: `تغییر وضعیت به «${status}» توسط ${actor.fullName}`,
      at: new Date().toISOString(),
    });

    const updated = await this.typeorm.supportTicket.update({
      where: { id },
      data: { status, history: history as TypeORM.InputJsonValue },
      include: {
        forwardedTo: { select: { id: true, fullName: true, role: true } },
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'تغییر وضعیت تیکت پشتیبانی',
      detail: `وضعیت تیکت «${ticket.subject}» توسط ${actor.fullName} به «${status}» تغییر کرد.`,
      entityType: 'SupportTicket',
      entityId: id,
    });

    return updated;
  }
}

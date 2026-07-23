import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StaffDirectoryService } from '../staff-directory/staff-directory.module';
import { ErrorCode } from '../../common/errors';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type {
  Prisma,
  SupportTicketStatus,
} from '../../../generated/prisma/client';
import type { SubmitSupportTicketDto } from './dto/support-ticket.dtos';

function generateTrackingCode(): string {
  return `TK${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

@Injectable()
export class SupportTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly staffDirectory: StaffDirectoryService,
  ) {}

  async submit(dto: SubmitSupportTicketDto) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        trackingCode: generateTrackingCode(),
        requesterName: dto.requesterName,
        requesterPhone: dto.requesterPhone,
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

  async list(filters: {
    status?: SupportTicketStatus;
    dept?: 'SITE' | 'AGENCY';
  }) {
    return this.prisma.supportTicket.findMany({
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
    const ticket = await this.prisma.supportTicket.findUnique({
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

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        forwardedToId: targetUserId,
        status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
        history: history as Prisma.InputJsonValue,
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

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: { status, history: history as Prisma.InputJsonValue },
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

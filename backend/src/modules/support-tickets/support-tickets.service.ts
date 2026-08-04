import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'node:crypto';
import { Repository } from 'typeorm';
import { SupportTicket } from '../../database/entities/support-ticket.entity';
import { User } from '../../database/entities/user.entity';
import type { JsonValue } from '../../database/json-types';
import { AuditService } from '../audit/audit.service';
import { StaffDirectoryService } from '../staff-directory/staff-directory.module';
import { ErrorCode } from '../../common/errors';
import { normalizeIranPhone } from '../../common/normalize-iran-phone';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SupportTicketStatus } from '../../database/enums';
import type {
  AdminCreateSupportTicketDto,
  SubmitSupportTicketDto,
} from './dto/support-ticket.dtos';

function generateTrackingCode(): string {
  return `TK${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}
const STAFF_TICKET_PHONE_SENTINEL = '09000000000';

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
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly audit: AuditService,
    private readonly staffDirectory: StaffDirectoryService,
  ) {}

  async submit(dto: SubmitSupportTicketDto) {
    const ticket = await this.ticketRepo.save(
      this.ticketRepo.create({
        trackingCode: generateTrackingCode(),
        requesterName: dto.requesterName,
        requesterPhone: normalizeIranPhone(dto.requesterPhone),
        subject: dto.subject,
        body: dto.body,
        updatedAt: new Date(),
        history: [
          {
            step: 'submitted',
            labelFa: 'ثبت تیکت توسط کاربر',
            at: new Date().toISOString(),
          },
        ],
      }),
    );
    return { id: ticket.id, trackingCode: ticket.trackingCode };
  }

  async createAsAdmin(actor: AuthenticatedUser, dto: AdminCreateSupportTicketDto) {
    const phoneRaw = dto.requesterPhone?.trim();
    const phone = phoneRaw
      ? normalizeIranPhone(phoneRaw)
      : STAFF_TICKET_PHONE_SENTINEL;
    const ticket = await this.ticketRepo.save(
      this.ticketRepo.create({
        trackingCode: generateTrackingCode(),
        requesterName: dto.requesterName,
        requesterPhone: phone,
        subject: dto.subject,
        body: dto.body,
        dept: dto.dept,
        priority: dto.priority,
        updatedAt: new Date(),
        history: [
          {
            step: 'submitted',
            labelFa: `ثبت تیکت توسط ${actor.fullName} (ادمین سایت)`,
            at: new Date().toISOString(),
          },
        ],
      }),
    );
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SYSTEM',
      action: 'ثبت تیکت پشتیبانی توسط ادمین',
      detail: `تیکت ${ticket.trackingCode} («${ticket.subject}») توسط ${actor.fullName} ثبت شد.`,
      entityType: 'SupportTicket',
      entityId: ticket.id,
    });
    return ticket;
  }

  async submitForUser(actor: AuthenticatedUser, dto: SubmitSupportTicketDto) {
    const ticket = await this.ticketRepo.save(
      this.ticketRepo.create({
        userId: actor.id,
        trackingCode: generateTrackingCode(),
        requesterName: dto.requesterName,
        requesterPhone: normalizeIranPhone(dto.requesterPhone),
        subject: dto.subject,
        body: dto.body,
        updatedAt: new Date(),
        history: [
          {
            step: 'submitted',
            labelFa: 'ثبت تیکت توسط کاربر',
            at: new Date().toISOString(),
          },
        ],
      }),
    );
    return { id: ticket.id, trackingCode: ticket.trackingCode };
  }

  private async callerPhone(userId: string): Promise<string | null> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: { phone: true },
    });
    return user?.phone ?? null;
  }

  private customerTicketQuery(userId: string, phone: string | null) {
    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .select(Object.keys(CUSTOMER_TICKET_SELECT).map((k) => `t.${k}`));
    if (phone) {
      qb.where(
        '(t."userId" = :userId OR (t."userId" IS NULL AND t."requesterPhone" = :phone))',
        { userId, phone },
      );
    } else {
      qb.where('t."userId" = :userId', { userId });
    }
    return qb;
  }

  async listMine(actor: AuthenticatedUser) {
    const phone = await this.callerPhone(actor.id);
    return this.customerTicketQuery(actor.id, phone)
      .orderBy('t.createdAt', 'DESC')
      .getMany();
  }

  async getMine(actor: AuthenticatedUser, id: string) {
    const phone = await this.callerPhone(actor.id);
    const ticket = await this.customerTicketQuery(actor.id, phone)
      .andWhere('t.id = :id', { id })
      .getOne();
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
    return this.ticketRepo.find({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.dept ? { dept: filters.dept } : {}),
      },
      relations: { forwardedTo: true },
      order: { createdAt: 'DESC' },
    });
  }

  private async getOrThrow(id: string) {
    const ticket = await this.ticketRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.forwardedTo', 'forwardedTo')
      .where('t.id = :id', { id })
      .getOne();
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

    ticket.forwardedToId = targetUserId;
    ticket.status =
      ticket.status === SupportTicketStatus.OPEN
        ? SupportTicketStatus.IN_PROGRESS
        : ticket.status;
    ticket.history = history as JsonValue;
    ticket.updatedAt = new Date();
    await this.ticketRepo.save(ticket);
    const updated = await this.getOrThrow(id);

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

    ticket.status = status;
    ticket.history = history as JsonValue;
    ticket.updatedAt = new Date();
    await this.ticketRepo.save(ticket);
    const updated = await this.getOrThrow(id);

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

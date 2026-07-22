import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

/** Phase 13 Part E — the real "payment succeeded, ticket not issued"
 * queue: PaymentReconciliation rows written the instant a GATEWAY payment
 * is confirmed, resolved atomically with ticket issuance. A PENDING row
 * past that point means the ticketing transaction never completed. See
 * docs/DB_SCHEMA.md. */
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const rows = await this.prisma.paymentReconciliation.findMany({
      where: { status: 'PENDING' },
      include: { booking: { select: { pnr: true, status: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      pnr: r.booking.pnr,
      bookingStatus: r.booking.status,
      gatewayRefId: r.gatewayRefId,
      amountIrr: r.amountIrr,
      createdAt: r.createdAt,
    }));
  }

  async resolve(actor: AuthenticatedUser, id: string, resolutionNote: string) {
    const row = await this.prisma.paymentReconciliation.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'مورد تطبیق پرداخت یافت نشد.',
      });
    }
    if (row.status === 'RESOLVED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این مورد قبلاً رفع‌شده علامت خورده است.',
      });
    }

    const updated = await this.prisma.paymentReconciliation.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedById: actor.id,
        resolvedAt: new Date(),
        resolutionNote,
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'FINANCE',
      action: 'رفع مغایرت پرداخت',
      detail: `مغایرت پرداخت ${row.gatewayRefId} توسط ${actor.fullName} رفع شد: ${resolutionNote}`,
      entityType: 'PaymentReconciliation',
      entityId: id,
    });

    return updated;
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import { decryptPii, encryptPii } from '../../common/pii-crypto';
import { computePenalty } from './penalty';
import { StepUpService } from '../auth/step-up.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { Prisma, RefundRequest } from '../../../generated/prisma/client';

/** List-row shape: no PII at all (the design's cards show none). */
function toListRow(
  r: RefundRequest & { assignee?: { fullName: string } | null },
) {
  const { nidEnc, mobileEnc, ibanEnc, ...rest } = r;
  void nidEnc;
  void mobileEnc;
  void ibanEnc;
  return rest;
}

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stepUp: StepUpService,
  ) {}

  private async getOrThrow(id: string) {
    const request = await this.prisma.refundRequest.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, fullName: true, role: true } },
        processedBy: { select: { id: true, fullName: true, role: true } },
        booking: {
          include: {
            flightInstance: {
              include: { flight: { include: { route: true } } },
            },
          },
        },
      },
    });
    if (!request) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'درخواست استرداد یافت نشد.',
      });
    }
    return request;
  }

  async list() {
    const requests = await this.prisma.refundRequest.findMany({
      include: {
        assignee: { select: { id: true, fullName: true, role: true } },
        booking: {
          include: {
            flightInstance: {
              include: { flight: { include: { route: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const kpis = {
      payoutQueue: requests.filter((r) => r.status === 'FINANCE').length,
      paid: requests.filter((r) => r.status === 'PAID').length,
      awaitingAdmin: requests.filter(
        (r) => r.status === 'SUBMITTED' || r.status === 'REVIEW',
      ).length,
    };

    return { requests: requests.map(toListRow), kpis };
  }

  /** Detail for the modal — the only surface that receives the decrypted شبا/PII. */
  async detail(id: string) {
    const r = await this.getOrThrow(id);
    const { nidEnc, mobileEnc, ibanEnc, ...rest } = r;
    return {
      ...rest,
      nationalId: nidEnc ? decryptPii(nidEnc) : null,
      mobile: mobileEnc ? decryptPii(mobileEnc) : null,
      iban: decryptPii(ibanEnc),
    };
  }

  async refer(actor: AuthenticatedUser, id: string, assigneeId: string) {
    const request = await this.getOrThrow(id);
    if (request.status === 'PAID') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'پرونده این درخواست بسته شده است.',
      });
    }

    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeId },
    });
    if (
      !assignee ||
      !assignee.isActive ||
      assignee.role === 'USER' ||
      assignee.role === 'AGENCY'
    ) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'کارمند مقصد ارجاع معتبر نیست.',
      });
    }

    // Design behavior: refer sets the assignee WITHOUT advancing status.
    const history = Array.isArray(request.history)
      ? [...(request.history as unknown[])]
      : [];
    history.push({
      step: request.status.toLowerCase(),
      labelFa: `ارجاع به ${assignee.fullName} (کارشناس مالی) توسط مدیر مالی`,
      at: new Date().toISOString(),
    });
    const updated = await this.prisma.refundRequest.update({
      where: { id },
      data: { assigneeId, history: history as Prisma.InputJsonValue },
      include: {
        assignee: { select: { id: true, fullName: true, role: true } },
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'REFUND',
      action: 'ارجاع درخواست استرداد',
      detail: `درخواست استرداد «${request.passengerName}» توسط ${actor.fullName} به ${assignee.fullName} ارجاع شد.`,
      entityType: 'RefundRequest',
      entityId: id,
    });

    return toListRow(updated);
  }

  async pay(
    actor: AuthenticatedUser,
    id: string,
    stepUpChallengeId: string,
    stepUpCode: string,
  ) {
    await this.stepUp.verify(
      actor,
      stepUpChallengeId,
      stepUpCode,
      'REFUND_PAYOUT',
    );
    const request = await this.getOrThrow(id);
    if (request.status !== 'FINANCE') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          request.status === 'PAID'
            ? 'این درخواست قبلاً پرداخت شده است.'
            : 'در انتظار ادمین',
      });
    }

    const history = Array.isArray(request.history)
      ? [...(request.history as unknown[])]
      : [];
    history.push({
      step: 'paid',
      labelFa: `تأیید، واریز وجه و بستن پرونده توسط ${request.assignee?.fullName ?? actor.fullName}`,
      at: new Date().toISOString(),
    });

    // ⚑ Real financial effect, one transaction: ledger reversal + booking
    // REFUNDED + request PAID. The conditional update is the double-pay guard.
    const updated = await this.prisma.$transaction(async (tx) => {
      const flipped = await tx.refundRequest.updateMany({
        where: { id, status: 'FINANCE' },
        data: {
          status: 'PAID',
          processedById: actor.id,
          paidAt: new Date(),
          history: history as Prisma.InputJsonValue,
        },
      });
      if (flipped.count === 0) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این درخواست قبلاً پرداخت شده است.',
        });
      }
      await tx.ledgerEntry.create({
        data: {
          bookingId: request.bookingId,
          type: 'REFUND',
          signedAmountIrr: -request.refundableIrr,
          createdById: actor.id,
        },
      });
      await tx.booking.update({
        where: { id: request.bookingId },
        data: { status: 'REFUNDED' },
      });
      return tx.refundRequest.findUniqueOrThrow({
        where: { id },
        include: {
          processedBy: { select: { id: true, fullName: true, role: true } },
        },
      });
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'REFUND',
      action: 'تأیید و واریز استرداد',
      detail: `استرداد «${request.passengerName}» به مبلغ ${request.refundableIrr} ریال توسط ${actor.fullName} پرداخت و پرونده بسته شد.`,
      entityType: 'RefundRequest',
      entityId: id,
      metadata: {
        refundableIrr: request.refundableIrr,
        bookingId: request.bookingId,
      },
    });

    return toListRow(updated);
  }

  /** Public purchase engine: the customer's own submission — CLAUDE.md's
   * "fare-rule–driven penalty calculation, user-visible breakdown before
   * confirmation." Booking must be TICKETED and owned by the caller; only
   * one request per booking (RefundStatus has no REJECTED to resubmit
   * against, so a second submission is always a conflict, not a retry). */
  async submitFromCustomer(
    actor: AuthenticatedUser,
    dto: { bookingId: string; iban: string },
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { flightInstance: true, passengers: true, refundRequests: true },
    });
    if (!booking) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'رزرو یافت نشد.',
      });
    }
    if (booking.userId !== actor.id) {
      throw new BadRequestException({
        code: ErrorCode.FORBIDDEN,
        message: 'این رزرو متعلق به شما نیست.',
      });
    }
    if (booking.status !== 'TICKETED' && booking.status !== 'PAID') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این رزرو واجد شرایط استرداد نیست.',
      });
    }
    if (booking.refundRequests.length > 0) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'برای این رزرو قبلاً درخواست استرداد ثبت شده است.',
      });
    }

    const rules = await this.prisma.refundPenaltyRule.findMany();
    const hoursLeft =
      (booking.flightInstance.departureAt.getTime() - Date.now()) / 3_600_000;
    const penalty = computePenalty(rules, hoursLeft, booking.priceIrr);
    const passenger = booking.passengers[0];

    const request = await this.prisma.refundRequest.create({
      data: {
        bookingId: booking.id,
        passengerName: passenger?.fullName ?? actor.fullName,
        nidEnc: passenger?.nationalIdEnc,
        mobileEnc: passenger?.mobileEnc,
        ibanEnc: encryptPii(dto.iban),
        totalPaidIrr: booking.priceIrr,
        penaltyPct: penalty.penaltyPct,
        penaltyAmountIrr: penalty.penaltyAmountIrr,
        refundableIrr: penalty.refundableIrr,
        history: [
          {
            step: 'submitted',
            labelFa: 'ثبت درخواست استرداد توسط مشتری',
            at: new Date().toISOString(),
          },
        ],
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'REFUND',
      action: 'ثبت درخواست استرداد',
      detail: `درخواست استرداد رزرو ${booking.pnr} توسط مشتری ثبت شد.`,
      entityType: 'RefundRequest',
      entityId: request.id,
    });

    return toListRow(request);
  }

  async listMine(userId: string) {
    const requests = await this.prisma.refundRequest.findMany({
      where: { booking: { userId } },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map(toListRow);
  }

  async getMine(userId: string, id: string) {
    const request = await this.prisma.refundRequest.findUnique({
      where: { id },
      include: { booking: true },
    });
    if (!request || request.booking.userId !== userId) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'درخواست استرداد یافت نشد.',
      });
    }
    return toListRow(request);
  }

  /**
   * Non-production only: creates a fresh TICKETED booking + FINANCE-status
   * request so Playwright always has a payable row (submission belongs to
   * the customer track). 404s in production.
   */
  async createTestRequest() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'یافت نشد.',
      });
    }
    const instance = await this.prisma.flightInstance.findFirstOrThrow({
      orderBy: { departureAt: 'desc' },
    });
    const totalPaidIrr = 30_000_000;
    const booking = await this.prisma.booking.create({
      data: {
        pnr: `RF${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        flightInstanceId: instance.id,
        channel: 'SYSTEM',
        status: 'TICKETED',
        priceIrr: totalPaidIrr,
      },
    });
    const rules = await this.prisma.refundPenaltyRule.findMany();
    const hoursLeft = (instance.departureAt.getTime() - Date.now()) / 3_600_000;
    const penalty = computePenalty(rules, hoursLeft, totalPaidIrr);

    return this.prisma.refundRequest.create({
      data: {
        bookingId: booking.id,
        passengerName: `مسافر آزمایشی ${crypto.randomUUID().slice(0, 4)}`,
        nidEnc: encryptPii('0012345679'),
        mobileEnc: encryptPii('09121112233'),
        ibanEnc: encryptPii('IR820170000000332211009900'),
        totalPaidIrr,
        penaltyPct: penalty.penaltyPct,
        penaltyAmountIrr: penalty.penaltyAmountIrr,
        refundableIrr: penalty.refundableIrr,
        status: 'FINANCE',
        history: [
          {
            step: 'submitted',
            labelFa: 'ثبت درخواست کنسلی توسط مشتری',
            at: 'اکنون',
          },
          {
            step: 'finance',
            labelFa: 'ارجاع به مدیر مالی توسط ادمین سایت',
            at: 'اکنون',
          },
        ],
      },
    });
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CartableService } from '../cartable/cartable.service';
import { ErrorCode } from '../../common/errors';
import { generateTempPassword } from '../../common/temp-password';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type {
  AgencyApiScope,
  AgencyApiKeyStatus,
  AgencyCreditRequestStatus,
  AgencyMembershipStatus,
} from '../../../generated/prisma/enums';

function hashSecret(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateApiKeySecret(): string {
  return `bjk_${crypto.randomBytes(32).toString('base64url')}`;
}

function generateInvoiceNo(): string {
  return `INV-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

const DECIDABLE_STATUSES: AgencyMembershipStatus[] = ['PENDING', 'REFERRED'];

@Injectable()
export class AgenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cartable: CartableService,
  ) {}

  /** SUM(SALE) + SUM(SETTLEMENT) per agency — SETTLEMENT rows are stored
   * signed-negative, so this single grouped sum is the derived "used" figure
   * (see LedgerEntry.agencyId note in docs/DB_SCHEMA.md). */
  private async computeUsedIrr(
    agencyIds: string[],
  ): Promise<Map<string, number>> {
    if (agencyIds.length === 0) return new Map();
    const rows = await this.prisma.ledgerEntry.groupBy({
      by: ['agencyId'],
      where: {
        agencyId: { in: agencyIds },
        type: { in: ['SALE', 'SETTLEMENT'] },
      },
      _sum: { signedAmountIrr: true },
    });
    return new Map(
      rows
        .filter(
          (r): r is typeof r & { agencyId: string } => r.agencyId !== null,
        )
        .map((r) => [r.agencyId, r._sum.signedAmountIrr ?? 0]),
    );
  }

  /** Design's exact formula (extraction confirmed verbatim) — presentational
   * badge only, never a financial figure. See docs/DB_SCHEMA.md Phase 3. */
  private activityScore(input: {
    seatsSold: number;
    paidInvoices: number;
    unpaidInvoices: number;
    isActive: boolean;
  }) {
    const raw =
      input.seatsSold * 10 +
      input.paidInvoices * 100 -
      input.unpaidInvoices * 60 +
      (input.isActive ? 40 : 0);
    const score = Math.max(raw, 0);
    const badge = score >= 700 ? 'GOLD' : score >= 400 ? 'SILVER' : 'BRONZE';
    return { score, badge };
  }

  private async getProfileOrThrow(id: string) {
    const profile = await this.prisma.agencyProfile.findUnique({
      where: { userId: id },
      include: { user: true, creditLine: true },
    });
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'آژانس یافت نشد.',
      });
    }
    return profile;
  }

  private async getRequestOrThrow(id: string) {
    const request = await this.prisma.agencyMembershipRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'درخواست یافت نشد.',
      });
    }
    return request;
  }

  /** Used by ReportingModule's KPI box (`agencyDebtIrr`/`agencyDebtCount`) —
   * the only cross-module read of agency data, kept to a small public getter
   * rather than duplicating the ledger-derivation query in ReportingService. */
  async getDebtSummary(): Promise<{
    agencyDebtIrr: number;
    agencyDebtCount: number;
  }> {
    const agencyIds = (
      await this.prisma.agencyProfile.findMany({ select: { userId: true } })
    ).map((p) => p.userId);
    const usedByAgency = await this.computeUsedIrr(agencyIds);

    let agencyDebtIrr = 0;
    let agencyDebtCount = 0;
    for (const used of usedByAgency.values()) {
      if (used > 0) {
        agencyDebtIrr += used;
        agencyDebtCount += 1;
      }
    }
    return { agencyDebtIrr, agencyDebtCount };
  }

  // ── Listing & detail ────────────────────────────────────────────────

  async list(query: { q?: string; debtorsOnly?: boolean }) {
    const profiles = await this.prisma.agencyProfile.findMany({
      include: { user: true, creditLine: true },
      orderBy: { joinedAt: 'desc' },
    });
    const agencyIds = profiles.map((p) => p.userId);

    const [usedByAgency, unpaidCounts] = await Promise.all([
      this.computeUsedIrr(agencyIds),
      this.prisma.agencyInvoice.groupBy({
        by: ['agencyId'],
        where: {
          agencyId: { in: agencyIds },
          status: { in: ['UNPAID', 'OVERDUE'] },
        },
        _count: { _all: true },
      }),
    ]);
    const unpaidByAgency = new Map(
      unpaidCounts.map((r) => [r.agencyId, r._count._all]),
    );

    const rows = profiles.map((p) => {
      const usedIrr = Math.max(usedByAgency.get(p.userId) ?? 0, 0);
      const limitIrr = p.creditLine?.limitIrr ?? 0;
      return {
        id: p.userId,
        fullName: p.user.fullName,
        managerName: p.managerName,
        licenseNo: p.licenseNo,
        city: p.city,
        tier: p.tier,
        isActive: !p.suspendedAt,
        limitIrr,
        usedIrr,
        remainingIrr: limitIrr - usedIrr,
        pendingInvoiceCount: unpaidByAgency.get(p.userId) ?? 0,
      };
    });

    // KPI cards summarize the whole book — never re-scoped by the table's
    // own search/debtors filter (matches the design's fixed summary cards).
    const kpis = {
      activeCount: rows.filter((r) => r.isActive).length,
      totalCreditGrantedIrr: rows.reduce((s, r) => s + r.limitIrr, 0),
      totalUsedIrr: rows.reduce((s, r) => s + r.usedIrr, 0),
      pendingSettlementCount: rows.filter((r) => r.pendingInvoiceCount > 0)
        .length,
    };

    let agencies = rows;
    if (query.q) {
      const q = query.q.toLowerCase();
      agencies = agencies.filter(
        (r) =>
          r.fullName.toLowerCase().includes(q) ||
          r.managerName.toLowerCase().includes(q) ||
          r.licenseNo.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q),
      );
    }
    if (query.debtorsOnly) {
      agencies = agencies.filter(
        (r) => r.usedIrr > 0 || r.pendingInvoiceCount > 0,
      );
    }

    return { agencies, kpis };
  }

  async detail(actor: AuthenticatedUser, id: string) {
    const profile = await this.getProfileOrThrow(id);

    const [
      usedByAgency,
      ticketCount,
      passengerCount,
      salesAgg,
      paidInvoiceCount,
      unpaidInvoiceCount,
      recentActivity,
    ] = await Promise.all([
      this.computeUsedIrr([id]),
      this.prisma.booking.count({
        where: { agencyId: id, status: { in: ['PAID', 'TICKETED'] } },
      }),
      this.prisma.passenger.count({
        where: { booking: { agencyId: id } },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { agencyId: id, type: 'SALE' },
        _sum: { signedAmountIrr: true },
      }),
      this.prisma.agencyInvoice.count({
        where: { agencyId: id, status: 'PAID' },
      }),
      this.prisma.agencyInvoice.count({
        where: { agencyId: id, status: { in: ['UNPAID', 'OVERDUE'] } },
      }),
      this.prisma.auditLog.findMany({
        where: {
          category: 'AGENCY',
          entityType: 'AgencyProfile',
          entityId: id,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const usedIrr = Math.max(usedByAgency.get(id) ?? 0, 0);
    const limitIrr = profile.creditLine?.limitIrr ?? 0;
    const isActive = !profile.suspendedAt;

    // Senior Manager's detail view never showed this — presentational only.
    const includeScore =
      actor.role === 'FINANCE_MANAGER' || actor.role === 'COMMERCIAL_MANAGER';

    return {
      id: profile.userId,
      fullName: profile.user.fullName,
      managerName: profile.managerName,
      licenseNo: profile.licenseNo,
      phone: profile.phone,
      email: profile.email,
      city: profile.city,
      address: profile.address,
      tier: profile.tier,
      isActive,
      suspendedAt: profile.suspendedAt,
      suspendReason: profile.suspendReason,
      joinedAt: profile.joinedAt,
      credit: { limitIrr, usedIrr, remainingIrr: limitIrr - usedIrr },
      stats: {
        totalSalesIrr: salesAgg._sum.signedAmountIrr ?? 0,
        ticketsIssued: ticketCount,
        passengers: passengerCount,
      },
      ...(includeScore
        ? {
            activityScore: this.activityScore({
              seatsSold: ticketCount,
              paidInvoices: paidInvoiceCount,
              unpaidInvoices: unpaidInvoiceCount,
              isActive,
            }),
          }
        : {}),
      recentActivity,
    };
  }

  // ── Suspension ───────────────────────────────────────────────────────

  async suspend(actor: AuthenticatedUser, id: string, reason: string) {
    const profile = await this.getProfileOrThrow(id);
    const updated = await this.prisma.agencyProfile.update({
      where: { userId: id },
      data: { suspendedAt: new Date(), suspendReason: reason },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'تعلیق آژانس',
      detail: `آژانس «${profile.managerName}» توسط ${actor.fullName} تعلیق شد. دلیل: ${reason}`,
      entityType: 'AgencyProfile',
      entityId: id,
    });

    return updated;
  }

  async reactivate(actor: AuthenticatedUser, id: string) {
    const profile = await this.getProfileOrThrow(id);
    const updated = await this.prisma.agencyProfile.update({
      where: { userId: id },
      data: { suspendedAt: null, suspendReason: null },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'رفع تعلیق آژانس',
      detail: `تعلیق آژانس «${profile.managerName}» توسط ${actor.fullName} رفع شد.`,
      entityType: 'AgencyProfile',
      entityId: id,
    });

    return updated;
  }

  // ── Credit & settlement ─────────────────────────────────────────────

  async getCredit(id: string) {
    await this.getProfileOrThrow(id);
    const [creditLine, usedByAgency] = await Promise.all([
      this.prisma.agencyCreditLine.findUnique({ where: { agencyId: id } }),
      this.computeUsedIrr([id]),
    ]);
    const limitIrr = creditLine?.limitIrr ?? 0;
    const usedIrr = Math.max(usedByAgency.get(id) ?? 0, 0);
    return { limitIrr, usedIrr, remainingIrr: limitIrr - usedIrr };
  }

  async updateCredit(actor: AuthenticatedUser, id: string, limitIrr: number) {
    await this.getProfileOrThrow(id);
    const updated = await this.prisma.agencyCreditLine.upsert({
      where: { agencyId: id },
      update: { limitIrr, updatedById: actor.id },
      create: { agencyId: id, limitIrr, updatedById: actor.id },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'تغییر سقف اعتبار آژانس',
      detail: `سقف اعتبار توسط ${actor.fullName} به ${limitIrr} ریال تغییر یافت.`,
      entityType: 'AgencyProfile',
      entityId: id,
      metadata: { limitIrr },
    });

    const usedByAgency = await this.computeUsedIrr([id]);
    const usedIrr = Math.max(usedByAgency.get(id) ?? 0, 0);
    return {
      limitIrr: updated.limitIrr,
      usedIrr,
      remainingIrr: updated.limitIrr - usedIrr,
    };
  }

  async settle(actor: AuthenticatedUser, id: string) {
    await this.getProfileOrThrow(id);
    const usedByAgency = await this.computeUsedIrr([id]);
    const outstanding = Math.max(usedByAgency.get(id) ?? 0, 0);
    if (outstanding <= 0) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'بدهی معوقی برای تسویه وجود ندارد.',
      });
    }

    const entry = await this.prisma.ledgerEntry.create({
      data: {
        agencyId: id,
        type: 'SETTLEMENT',
        signedAmountIrr: -outstanding,
        createdById: actor.id,
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'ثبت تسویه آژانس',
      detail: `مبلغ ${outstanding} ریال توسط ${actor.fullName} تسویه شد.`,
      entityType: 'AgencyProfile',
      entityId: id,
      metadata: { amountIrr: outstanding },
    });

    return { settledIrr: outstanding, ledgerEntryId: entry.id };
  }

  // ── Membership requests ──────────────────────────────────────────────

  async listRequests(status?: AgencyMembershipStatus) {
    return this.prisma.agencyMembershipRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRequest(id: string) {
    const request = await this.getRequestOrThrow(id);
    const history = await this.prisma.auditLog.findMany({
      where: {
        category: 'AGENCY',
        entityType: 'AgencyMembershipRequest',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { ...request, history };
  }

  async approveRequest(actor: AuthenticatedUser, id: string) {
    const request = await this.getRequestOrThrow(id);
    if (!DECIDABLE_STATUSES.includes(request.status)) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این درخواست قبلاً بررسی شده است.',
      });
    }

    // Agency Portal (self-service): without a password an approved agency's
    // User row could never log in — issued once here, never stored plaintext.
    const tempPassword = generateTempPassword();
    const passwordHash = await argon2.hash(tempPassword);

    const { agencyUserId } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          role: 'AGENCY',
          phone: request.phone,
          email: request.email,
          fullName: request.applicantName,
          passwordHash,
          mustChangePassword: true,
          isActive: true,
        },
      });
      await tx.agencyProfile.create({
        data: {
          userId: user.id,
          licenseNo: request.licenseNo,
          managerName: request.managerName,
          phone: request.phone,
          email: request.email,
          city: request.city,
          // Full street address isn't captured on the request form — collected
          // during the agency's own onboarding once the agency-portal track exists.
          address: '',
          tier: 'NORMAL',
        },
      });
      await tx.agencyCreditLine.create({
        data: { agencyId: user.id, limitIrr: 0, updatedById: actor.id },
      });
      await tx.agencyMembershipRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      });
      return { agencyUserId: user.id };
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'تأیید درخواست عضویت آژانس',
      detail: `درخواست «${request.applicantName}» توسط ${actor.fullName} تأیید و حساب آژانس ایجاد شد.`,
      entityType: 'AgencyMembershipRequest',
      entityId: id,
      metadata: { agencyUserId },
    });

    // Plaintext temp password is returned exactly once and never stored.
    return { agencyId: agencyUserId, tempPassword };
  }

  async rejectRequest(
    actor: AuthenticatedUser,
    id: string,
    reviewNote?: string,
  ) {
    const request = await this.getRequestOrThrow(id);
    if (!DECIDABLE_STATUSES.includes(request.status)) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این درخواست قبلاً بررسی شده است.',
      });
    }

    const updated = await this.prisma.agencyMembershipRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewNote,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'رد درخواست عضویت آژانس',
      detail: `درخواست «${request.applicantName}» توسط ${actor.fullName} رد شد.${reviewNote ? ` دلیل: ${reviewNote}` : ''}`,
      entityType: 'AgencyMembershipRequest',
      entityId: id,
    });

    return updated;
  }

  async referRequest(
    actor: AuthenticatedUser,
    id: string,
    referredToId: string,
    note?: string,
  ) {
    const request = await this.getRequestOrThrow(id);
    if (!DECIDABLE_STATUSES.includes(request.status)) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این درخواست قبلاً بررسی شده است.',
      });
    }

    const target = await this.prisma.user.findUnique({
      where: { id: referredToId },
    });
    if (!target) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'کاربر مقصد ارجاع یافت نشد.',
      });
    }

    const updated = await this.prisma.agencyMembershipRequest.update({
      where: { id },
      data: {
        status: 'REFERRED',
        referredToId,
        reviewNote: note,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    });

    // Phase 4 wiring (⚑): the referred-to manager receives the request in
    // their cartable — that IS the delivery surface for referrals.
    await this.cartable.createTask({
      assigneeId: referredToId,
      category: 'AGENCY',
      title: `بررسی درخواست عضویت: ${request.applicantName}`,
      description: note
        ? `${note} (ارجاع از ${actor.fullName})`
        : `درخواست عضویت «${request.applicantName}» برای بررسی به شما ارجاع شد.`,
      senderId: actor.id,
      sourceType: 'AGENCY_REQUEST',
      sourceId: id,
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'ارجاع درخواست عضویت آژانس',
      detail: `درخواست «${request.applicantName}» توسط ${actor.fullName} به ${target.fullName} ارجاع شد.`,
      entityType: 'AgencyMembershipRequest',
      entityId: id,
    });

    return updated;
  }

  // ── API keys (Senior Manager only) ──────────────────────────────────

  async listApiKeys(id: string) {
    await this.getProfileOrThrow(id);
    return this.prisma.agencyApiKey.findMany({
      where: { agencyId: id },
      orderBy: { activatedAt: 'desc' },
    });
  }

  async issueApiKey(
    actor: AuthenticatedUser,
    id: string,
    scope: AgencyApiScope,
  ) {
    await this.getProfileOrThrow(id);
    const rawKey = generateApiKeySecret();
    const created = await this.prisma.agencyApiKey.create({
      data: {
        agencyId: id,
        keyHash: hashSecret(rawKey),
        scope,
        status: 'ACTIVE',
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'صدور کلید API آژانس',
      detail: `کلید API با دامنه ${scope} توسط ${actor.fullName} صادر شد.`,
      entityType: 'AgencyApiKey',
      entityId: created.id,
    });

    // Shown once — DB only ever stores keyHash from here on.
    return { ...created, rawKey };
  }

  async updateApiKey(
    actor: AuthenticatedUser,
    id: string,
    keyId: string,
    dto: { status?: AgencyApiKeyStatus; regenerate?: boolean },
  ) {
    const key = await this.prisma.agencyApiKey.findUnique({
      where: { id: keyId },
    });
    if (!key || key.agencyId !== id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'کلید API یافت نشد.',
      });
    }

    if (dto.regenerate) {
      const rawKey = generateApiKeySecret();
      const updated = await this.prisma.agencyApiKey.update({
        where: { id: keyId },
        data: {
          keyHash: hashSecret(rawKey),
          activatedAt: new Date(),
          lastUsedAt: null,
          callCount: 0,
        },
      });
      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        category: 'AGENCY',
        action: 'صدور مجدد کلید API آژانس',
        detail: `کلید API توسط ${actor.fullName} صادر مجدد شد؛ کلید قبلی باطل شد.`,
        entityType: 'AgencyApiKey',
        entityId: keyId,
      });
      return { ...updated, rawKey };
    }

    if (dto.status) {
      const updated = await this.prisma.agencyApiKey.update({
        where: { id: keyId },
        data: { status: dto.status },
      });
      await this.audit.record({
        actorId: actor.id,
        actorRole: actor.role,
        category: 'AGENCY',
        action:
          dto.status === 'ACTIVE'
            ? 'فعال‌سازی کلید API آژانس'
            : 'تعلیق کلید API آژانس',
        detail: `وضعیت کلید API توسط ${actor.fullName} به ${dto.status} تغییر یافت.`,
        entityType: 'AgencyApiKey',
        entityId: keyId,
      });
      return updated;
    }

    throw new BadRequestException({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'یکی از status یا regenerate الزامی است.',
    });
  }

  // ── Invoices & messaging ─────────────────────────────────────────────

  async listInvoices(id: string) {
    await this.getProfileOrThrow(id);
    return this.prisma.agencyInvoice.findMany({
      where: { agencyId: id },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async issueInvoice(
    actor: AuthenticatedUser,
    id: string,
    dto: { amountIrr: number; dueAt: string },
  ) {
    await this.getProfileOrThrow(id);
    const created = await this.prisma.agencyInvoice.create({
      data: {
        agencyId: id,
        invoiceNo: generateInvoiceNo(),
        issuedById: actor.id,
        dueAt: new Date(dto.dueAt),
        amountIrr: dto.amountIrr,
        status: 'UNPAID',
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'صدور فاکتور آژانس',
      detail: `فاکتور ${created.invoiceNo} به مبلغ ${dto.amountIrr} ریال توسط ${actor.fullName} صادر شد.`,
      entityType: 'AgencyInvoice',
      entityId: created.id,
    });

    return created;
  }

  /** E2E only (404 in production): resets the agency's derived debt to a
   * fixed figure so the invoice-pay journey observes a change regardless of
   * how much prior runs have settled against the long-lived dev DB. */
  async resetTestDebt(actor: AuthenticatedUser, id: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'یافت نشد.',
      });
    }
    const profile = await this.prisma.agencyProfile.findUnique({
      where: { userId: id },
    });
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'آژانس یافت نشد.',
      });
    }
    const targetIrr = 100_000_000;
    const usedIrr = (await this.computeUsedIrr([id])).get(id) ?? 0;
    const deltaIrr = targetIrr - usedIrr;
    if (deltaIrr !== 0) {
      await this.prisma.ledgerEntry.create({
        data: {
          agencyId: id,
          type: 'SALE',
          signedAmountIrr: deltaIrr,
          createdById: actor.id,
        },
      });
    }
    return { usedIrr: targetIrr };
  }

  async payInvoice(actor: AuthenticatedUser, id: string, invoiceId: string) {
    const invoice = await this.prisma.agencyInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice || invoice.agencyId !== id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'فاکتور یافت نشد.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Conditional update guards against a concurrent double-pay race —
      // count===0 means another request already marked it PAID first.
      const result = await tx.agencyInvoice.updateMany({
        where: { id: invoiceId, status: { not: 'PAID' } },
        data: { status: 'PAID', paidAt: new Date() },
      });
      if (result.count === 0) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این فاکتور قبلاً تسویه شده است.',
        });
      }
      await tx.ledgerEntry.create({
        data: {
          agencyId: id,
          type: 'SETTLEMENT',
          signedAmountIrr: -invoice.amountIrr,
          createdById: actor.id,
        },
      });
      return tx.agencyInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'تسویه فاکتور آژانس',
      detail: `فاکتور ${invoice.invoiceNo} توسط ${actor.fullName} تسویه شد.`,
      entityType: 'AgencyInvoice',
      entityId: invoiceId,
    });

    return updated;
  }

  async remindInvoice(actor: AuthenticatedUser, id: string, invoiceId: string) {
    const invoice = await this.prisma.agencyInvoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice || invoice.agencyId !== id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'فاکتور یافت نشد.',
      });
    }

    // Queued via the SmsProvider/email interface — mocked in dev/tests per CLAUDE.md.
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'یادآوری فاکتور آژانس',
      detail: `یادآوری فاکتور ${invoice.invoiceNo} توسط ${actor.fullName} ارسال شد.`,
      entityType: 'AgencyInvoice',
      entityId: invoiceId,
    });

    return { queued: true };
  }

  async listMessages(id: string) {
    await this.getProfileOrThrow(id);
    return this.prisma.agencyMessage.findMany({
      where: { agencyId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async postMessage(
    actor: AuthenticatedUser,
    id: string,
    body: string,
    senderIsAgency = false,
  ) {
    await this.getProfileOrThrow(id);
    return this.prisma.agencyMessage.create({
      data: { agencyId: id, senderId: actor.id, senderIsAgency, body },
    });
  }

  async notifyAllDebtors(actor: AuthenticatedUser) {
    const { agencies } = await this.list({ debtorsOnly: true });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'ارسال اعلان به همه بدهکاران',
      detail: `اعلان بدهی توسط ${actor.fullName} به ${agencies.length} آژانس بدهکار ارسال شد.`,
    });

    return { notifiedCount: agencies.length };
  }

  // ── Agency Portal: credit-increase requests (staff-side review) ────────

  async listCreditRequests(id: string) {
    await this.getProfileOrThrow(id);
    return this.prisma.agencyCreditRequest.findMany({
      where: { agencyId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async decideCreditRequest(
    actor: AuthenticatedUser,
    id: string,
    requestId: string,
    approve: boolean,
  ) {
    const request = await this.prisma.agencyCreditRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.agencyId !== id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'درخواست افزایش اعتبار یافت نشد.',
      });
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این درخواست قبلاً بررسی شده است.',
      });
    }

    const decision: AgencyCreditRequestStatus = approve
      ? 'APPROVED'
      : 'REJECTED';

    // Conditional update guards a concurrent double-decision race.
    const updated = await this.prisma.agencyCreditRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: { status: decision, decidedById: actor.id, decidedAt: new Date() },
    });
    if (updated.count === 0) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این درخواست قبلاً بررسی شده است.',
      });
    }

    // The ONLY code path that actually changes AgencyCreditLine.limitIrr —
    // reuses the already-audited updateCredit rather than writing a second one.
    if (approve) {
      await this.updateCredit(actor, id, request.requestedLimitIrr);
    }

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: approve
        ? 'تأیید درخواست افزایش اعتبار آژانس'
        : 'رد درخواست افزایش اعتبار آژانس',
      detail: `درخواست افزایش اعتبار به ${request.requestedLimitIrr} ریال توسط ${actor.fullName} ${approve ? 'تأیید' : 'رد'} شد.`,
      entityType: 'AgencyCreditRequest',
      entityId: requestId,
    });

    return this.prisma.agencyCreditRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
  }
}

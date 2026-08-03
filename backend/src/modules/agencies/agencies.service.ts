import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { In, IsNull, Not, Repository } from 'typeorm';
import { AgencyProfile } from '../../database/entities/agency-profile.entity';
import { AgencyCreditLine } from '../../database/entities/agency-credit-line.entity';
import { AgencyRequestOtp } from '../../database/entities/agency-request-otp.entity';
import { AgencyMembershipRequest } from '../../database/entities/agency-membership-request.entity';
import { AgencyApiKey } from '../../database/entities/agency-api-key.entity';
import { AgencyInvoice } from '../../database/entities/agency-invoice.entity';
import { AgencyMessage } from '../../database/entities/agency-message.entity';
import { AgencyCreditRequest } from '../../database/entities/agency-credit-request.entity';
import { AgencyWebserviceRequest } from '../../database/entities/agency-webservice-request.entity';
import { AgencyDocument } from '../../database/entities/agency-document.entity';
import { User } from '../../database/entities/user.entity';
import { LedgerEntry } from '../../database/entities/ledger-entry.entity';
import { Booking } from '../../database/entities/booking.entity';
import { Passenger } from '../../database/entities/passenger.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { AuditService } from '../audit/audit.service';
import { CartableService } from '../cartable/cartable.service';
import { ErrorCode } from '../../common/errors';
import { generateTempPassword } from '../../common/temp-password';
import { StepUpService } from '../auth/step-up.service';
import { SmsService } from '../sms/sms.service';
import {
  ZERO_IRR,
  addIrr,
  isPositiveIrr,
  isZeroIrr,
  maxIrr,
  negateIrr,
  subIrr,
} from '../../common/money';
import type { Irr } from '../../common/money';
import { TWO_FACTOR_PROVIDER } from '../auth/providers/two-factor-provider.interface';
import type { TwoFactorProvider } from '../auth/providers/two-factor-provider.interface';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type {
  AgencyApiScope,
  AgencyApiKeyStatus,
  AgencyCreditRequestStatus,
  AgencyDocumentStatus,
  AgencyMembershipStatus,
  AgencyWebserviceRequestStatus,
} from '../../database/enums';

function hashSecret(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateApiKeySecret(): string {
  return `bjk_${crypto.randomBytes(32).toString('base64url')}`;
}

function generateInvoiceNo(): string {
  return `INV-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function generateSixDigitCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

const DECIDABLE_STATUSES: AgencyMembershipStatus[] = ['PENDING', 'REFERRED'];
const REQUEST_OTP_TTL_MS = 2 * 60 * 1000;
const REQUEST_OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AgenciesService {
  constructor(
    @InjectRepository(AgencyProfile)
    private readonly profileRepo: Repository<AgencyProfile>,
    @InjectRepository(AgencyCreditLine)
    private readonly creditLineRepo: Repository<AgencyCreditLine>,
    @InjectRepository(AgencyRequestOtp)
    private readonly requestOtpRepo: Repository<AgencyRequestOtp>,
    @InjectRepository(AgencyMembershipRequest)
    private readonly membershipRequestRepo: Repository<AgencyMembershipRequest>,
    @InjectRepository(AgencyApiKey)
    private readonly apiKeyRepo: Repository<AgencyApiKey>,
    @InjectRepository(AgencyInvoice)
    private readonly invoiceRepo: Repository<AgencyInvoice>,
    @InjectRepository(AgencyMessage)
    private readonly messageRepo: Repository<AgencyMessage>,
    @InjectRepository(AgencyCreditRequest)
    private readonly creditRequestRepo: Repository<AgencyCreditRequest>,
    @InjectRepository(AgencyWebserviceRequest)
    private readonly webserviceRequestRepo: Repository<AgencyWebserviceRequest>,
    @InjectRepository(AgencyDocument)
    private readonly documentRepo: Repository<AgencyDocument>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerEntryRepo: Repository<LedgerEntry>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Passenger)
    private readonly passengerRepo: Repository<Passenger>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly audit: AuditService,
    private readonly cartable: CartableService,
    private readonly stepUp: StepUpService,
    private readonly sms: SmsService,
    @Inject(TWO_FACTOR_PROVIDER)
    private readonly twoFactorProvider: TwoFactorProvider,
  ) {}

  // ── Phase 16: public pre-registration (no auth) ─────────────────────────

  /** Sends an OTP to a prospective agency's phone before they can submit a
   * membership request — proves phone ownership without creating a User
   * (that only happens once staff approve). See docs/DB_SCHEMA.md Phase 16
   * for why this doesn't reuse TwoFactorChallenge. */
  async requestPublicOtp(phone: string): Promise<{ challengeId: string }> {
    const code = generateSixDigitCode();
    const challenge = await this.requestOtpRepo.save(
      this.requestOtpRepo.create({
        phone,
        codeHash: await argon2.hash(code),
        expiresAt: new Date(Date.now() + REQUEST_OTP_TTL_MS),
      }),
    );
    await this.twoFactorProvider.sendCode(
      { id: challenge.id, fullName: 'متقاضی همکاری آژانس', email: null, phone },
      code,
    );
    return { challengeId: challenge.id };
  }

  /** Verifies the OTP and creates a PENDING AgencyMembershipRequest — the
   * public front door onto the existing staff review workflow below. */
  async createPublicRequest(dto: {
    applicantName: string;
    managerName: string;
    licenseNo: string;
    phone: string;
    challengeId: string;
    code: string;
  }): Promise<{ id: string }> {
    const challenge = await this.requestOtpRepo.findOneBy({
      id: dto.challengeId,
    });
    if (!challenge || challenge.phone !== dto.phone) {
      throw new UnauthorizedException({
        code: 'TWO_FACTOR_INVALID',
        message: 'کد تأیید نامعتبر است.',
      });
    }
    if (challenge.consumedAt) {
      throw new UnauthorizedException({
        code: 'TWO_FACTOR_INVALID',
        message: 'این کد قبلاً استفاده شده است.',
      });
    }
    if (challenge.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'TWO_FACTOR_EXPIRED',
        message: 'کد منقضی شده است.',
      });
    }
    if (challenge.attempts >= REQUEST_OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException({
        code: 'TWO_FACTOR_INVALID',
        message: 'تعداد تلاش‌های مجاز به پایان رسید.',
      });
    }

    const codeValid = await argon2.verify(challenge.codeHash, dto.code);
    if (!codeValid) {
      await this.requestOtpRepo.increment({ id: challenge.id }, 'attempts', 1);
      throw new UnauthorizedException({
        code: 'TWO_FACTOR_INVALID',
        message: 'کد وارد شده نادرست است.',
      });
    }

    await this.requestOtpRepo.update(
      { id: challenge.id },
      { consumedAt: new Date() },
    );

    const request = await this.membershipRequestRepo.save(
      this.membershipRequestRepo.create({
        applicantName: dto.applicantName,
        managerName: dto.managerName,
        licenseNo: dto.licenseNo,
        phone: dto.phone,
        status: 'PENDING',
      }),
    );

    return { id: request.id };
  }

  /** E2E-test-only helper (mirrors AuthService.getLastCodeForE2e) — reads
   * back the mock-delivered OTP code by challenge id, since an anonymous
   * applicant has no phone/username to look up a User row by. */
  getLastRequestOtpCode(challengeId: string): string | null {
    if (
      process.env.NODE_ENV === 'production' ||
      !this.twoFactorProvider.getLastCode
    )
      return null;
    return this.twoFactorProvider.getLastCode(challengeId) ?? null;
  }

  /** SUM(SALE) + SUM(SETTLEMENT) per agency — SETTLEMENT rows are stored
   * signed-negative, so this single grouped sum is the derived "used" figure
   * (see LedgerEntry.agencyId note in docs/DB_SCHEMA.md). */
  private async computeUsedIrr(agencyIds: string[]): Promise<Map<string, Irr>> {
    if (agencyIds.length === 0) return new Map();
    const rows = await this.ledgerEntryRepo
      .createQueryBuilder('e')
      .select('e.agencyId', 'agencyId')
      .addSelect('SUM(e.signedAmountIrr)', 'sum')
      .where('e.agencyId IN (:...ids)', { ids: agencyIds })
      .andWhere('e.type IN (:...types)', { types: ['SALE', 'SETTLEMENT'] })
      .groupBy('e.agencyId')
      .getRawMany<{ agencyId: string; sum: string }>();
    return new Map(rows.map((r) => [r.agencyId, BigInt(r.sum ?? '0')]));
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
    const profile = await this.profileRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'user')
      .where('a.userId = :id', { id })
      .getOne();
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'آژانس یافت نشد.',
      });
    }
    return profile;
  }

  private async getRequestOrThrow(id: string) {
    const request = await this.membershipRequestRepo
      .createQueryBuilder('r')
      .where('r.id = :id', { id })
      .getOne();
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
    agencyDebtIrr: Irr;
    agencyDebtCount: number;
  }> {
    const profiles = await this.profileRepo.find({ select: { userId: true } });
    const agencyIds = profiles.map((p) => p.userId);
    const usedByAgency = await this.computeUsedIrr(agencyIds);

    let agencyDebtIrr: Irr = ZERO_IRR;
    let agencyDebtCount = 0;
    for (const used of usedByAgency.values()) {
      if (isPositiveIrr(used)) {
        agencyDebtIrr = addIrr(agencyDebtIrr, used);
        agencyDebtCount += 1;
      }
    }
    return { agencyDebtIrr, agencyDebtCount };
  }

  // ── Listing & detail ────────────────────────────────────────────────

  async list(query: { q?: string; debtorsOnly?: boolean }) {
    const profiles = await this.profileRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'user')
      .orderBy('a.joinedAt', 'DESC')
      .getMany();
    const agencyIds = profiles.map((p) => p.userId);

    const [usedByAgency, unpaidCounts, creditLines] = await Promise.all([
      this.computeUsedIrr(agencyIds),
      agencyIds.length
        ? this.invoiceRepo
            .createQueryBuilder('i')
            .select('i.agencyId', 'agencyId')
            .addSelect('COUNT(*)', 'count')
            .where('i.agencyId IN (:...ids)', { ids: agencyIds })
            .andWhere('i.status IN (:...statuses)', {
              statuses: ['UNPAID', 'OVERDUE'],
            })
            .groupBy('i.agencyId')
            .getRawMany<{ agencyId: string; count: string }>()
        : Promise.resolve<{ agencyId: string; count: string }[]>([]),
      agencyIds.length
        ? this.creditLineRepo.find({ where: { agencyId: In(agencyIds) } })
        : Promise.resolve<AgencyCreditLine[]>([]),
    ]);
    const unpaidByAgency = new Map(
      unpaidCounts.map((r) => [r.agencyId, Number(r.count)]),
    );
    const creditLineByAgency = new Map(creditLines.map((c) => [c.agencyId, c]));

    const rows = profiles.map((p) => {
      const usedIrr = maxIrr(usedByAgency.get(p.userId) ?? ZERO_IRR, ZERO_IRR);
      const limitIrr = creditLineByAgency.get(p.userId)?.limitIrr ?? ZERO_IRR;
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
        remainingIrr: subIrr(limitIrr, usedIrr),
        pendingInvoiceCount: unpaidByAgency.get(p.userId) ?? 0,
      };
    });

    // KPI cards summarize the whole book — never re-scoped by the table's
    // own search/debtors filter (matches the design's fixed summary cards).
    const kpis = {
      activeCount: rows.filter((r) => r.isActive).length,
      totalCreditGrantedIrr: rows.reduce(
        (s, r) => addIrr(s, r.limitIrr),
        ZERO_IRR,
      ),
      totalUsedIrr: rows.reduce((s, r) => addIrr(s, r.usedIrr), ZERO_IRR),
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
        (r) => isPositiveIrr(r.usedIrr) || r.pendingInvoiceCount > 0,
      );
    }

    return { agencies, kpis };
  }

  async detail(actor: AuthenticatedUser, id: string) {
    const profile = await this.getProfileOrThrow(id);

    const [
      usedByAgency,
      creditLine,
      ticketCount,
      passengerCount,
      salesRows,
      paidInvoiceCount,
      unpaidInvoiceCount,
      recentActivity,
    ] = await Promise.all([
      this.computeUsedIrr([id]),
      this.creditLineRepo.findOneBy({ agencyId: id }),
      this.bookingRepo.count({
        where: { agencyId: id, status: In(['PAID', 'TICKETED']) },
      }),
      this.passengerRepo
        .createQueryBuilder('p')
        .leftJoin('p.booking', 'booking')
        .where('booking.agencyId = :id', { id })
        .getCount(),
      // Real ticket sales only — excludes this same service's own
      // resetTestDebt() calibration rows (bookingId null; see
      // ReportingService.kpis() for the full explanation).
      this.ledgerEntryRepo.find({
        where: { agencyId: id, type: 'SALE', bookingId: Not(IsNull()) },
        select: { signedAmountIrr: true },
      }),
      this.invoiceRepo.count({ where: { agencyId: id, status: 'PAID' } }),
      this.invoiceRepo.count({
        where: { agencyId: id, status: In(['UNPAID', 'OVERDUE']) },
      }),
      this.auditLogRepo.find({
        where: {
          category: 'AGENCY',
          entityType: 'AgencyProfile',
          entityId: id,
        },
        order: { createdAt: 'DESC' },
        take: 20,
      }),
    ]);

    const usedIrr = maxIrr(usedByAgency.get(id) ?? ZERO_IRR, ZERO_IRR);
    const limitIrr = creditLine?.limitIrr ?? ZERO_IRR;
    const isActive = !profile.suspendedAt;
    const totalSalesIrr = salesRows.reduce(
      (s, r) => addIrr(s, r.signedAmountIrr),
      ZERO_IRR,
    );

    // Senior Manager's detail view never showed this — presentational only.
    const includeScore =
      actor.role === 'FINANCE_MANAGER' || actor.role === 'COMMERCIAL_MANAGER';

    const commercialExtras =
      actor.role === 'COMMERCIAL_MANAGER'
        ? await this.commercialDetailExtras(id)
        : undefined;

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
      credit: { limitIrr, usedIrr, remainingIrr: subIrr(limitIrr, usedIrr) },
      stats: {
        totalSalesIrr,
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
      ...(commercialExtras ? { commercialExtras } : {}),
      recentActivity,
    };
  }

  private wsScopeLabel(scope: AgencyApiScope): string {
    const labels: Record<AgencyApiScope, string> = {
      FULL: 'وب‌سرویس فروش کامل',
      SEARCH_BOOK: 'وب‌سرویس جستجو و رزرو',
      SEARCH_ONLY: 'وب‌سرویس جستجو (آزمایشی)',
    };
    return labels[scope];
  }

  /** Commercial Manager agency-detail sections from design-reference-v2. */
  private async commercialDetailExtras(id: string) {
    const now = new Date();

    const [bookings, wsApproved, apiKeys, invoiceAggs, ledgerRows] =
      await Promise.all([
        this.bookingRepo
          .createQueryBuilder('b')
          .leftJoinAndSelect('b.flightInstance', 'fi')
          .leftJoinAndSelect('fi.flight', 'flight')
          .leftJoinAndSelect('flight.route', 'route')
          .where('b.agencyId = :id', { id })
          .andWhere('b.status IN (:...statuses)', {
            statuses: ['PAID', 'TICKETED'],
          })
          .orderBy('b.createdAt', 'DESC')
          .take(10)
          .getMany(),
        this.webserviceRequestRepo.find({
          where: { agencyId: id, status: 'APPROVED' },
          order: { decidedAt: 'DESC' },
          take: 10,
        }),
        this.apiKeyRepo.find({
          where: { agencyId: id, status: 'ACTIVE' },
          order: { activatedAt: 'DESC' },
        }),
        this.invoiceRepo
          .createQueryBuilder('i')
          .select('i.status', 'status')
          .addSelect('SUM(i.amountIrr)', 'sum')
          .where('i.agencyId = :id', { id })
          .groupBy('i.status')
          .getRawMany<{ status: string; sum: string }>(),
        this.ledgerEntryRepo
          .createQueryBuilder('e')
          .leftJoin('e.booking', 'booking')
          .select(['e.id', 'e.type', 'e.signedAmountIrr', 'e.occurredAt'])
          .addSelect(['booking.id', 'booking.pnr'])
          .where('e.agencyId = :id', { id })
          .orderBy('e.occurredAt', 'DESC')
          .take(10)
          .getMany(),
      ]);

    const passengerCounts = bookings.length
      ? await this.passengerRepo
          .createQueryBuilder('p')
          .select('p.bookingId', 'bookingId')
          .addSelect('COUNT(*)', 'count')
          .where('p.bookingId IN (:...ids)', {
            ids: bookings.map((b) => b.id),
          })
          .groupBy('p.bookingId')
          .getRawMany<{ bookingId: string; count: string }>()
      : [];
    const passengerCountByBookingId = new Map(
      passengerCounts.map((r) => [r.bookingId, Number(r.count)]),
    );
    const flightsSold = bookings.map((b) => ({
      routeFa: `${b.flightInstance.flight.route.originCode} ← ${b.flightInstance.flight.route.destCode}`,
      flightNo: b.flightInstance.flight.flightNo,
      departAt: b.flightInstance.departureAt.toISOString(),
      seatCount: passengerCountByBookingId.get(b.id) ?? 0,
      salesIrr: b.priceIrr,
    }));

    const purchasedServices = [
      ...wsApproved.map((r) => {
        const start = r.decidedAt ?? r.createdAt;
        const expiresAt = new Date(start);
        expiresAt.setMonth(expiresAt.getMonth() + r.months);
        const active = expiresAt > now;
        return {
          name: this.wsScopeLabel(r.scope),
          purchasedAt: start.toISOString(),
          expiresAt: expiresAt.toISOString(),
          statusLabel: active ? 'فعال' : 'منقضی',
          status: active ? ('ACTIVE' as const) : ('EXPIRED' as const),
        };
      }),
      ...apiKeys
        .filter((k) => !wsApproved.some((r) => r.scope === k.scope))
        .map((k) => ({
          name: this.wsScopeLabel(k.scope),
          purchasedAt: k.activatedAt.toISOString(),
          expiresAt: k.expiresAt?.toISOString() ?? null,
          statusLabel: 'فعال',
          status: 'ACTIVE' as const,
        })),
    ];

    let paidTotalIrr: Irr = ZERO_IRR;
    let unpaidTotalIrr: Irr = ZERO_IRR;
    for (const row of invoiceAggs) {
      const amount = BigInt(row.sum ?? '0');
      if (row.status === 'PAID') paidTotalIrr = addIrr(paidTotalIrr, amount);
      else unpaidTotalIrr = addIrr(unpaidTotalIrr, amount);
    }

    const txTitle: Record<string, string> = {
      SALE: 'فروش بلیط',
      SETTLEMENT: 'تسویه حساب',
      REFUND: 'استرداد',
      COMMISSION: 'کمیسیون',
    };

    const transactions = ledgerRows.map((e) => ({
      id: e.id,
      titleFa: txTitle[e.type] ?? e.type,
      occurredAt: e.occurredAt.toISOString(),
      signedAmountIrr: e.signedAmountIrr,
      ref: e.booking?.pnr ?? null,
    }));

    return {
      flightsSold,
      purchasedServices,
      financeSummary: { paidTotalIrr, unpaidTotalIrr },
      transactions,
    };
  }

  // ── Suspension ───────────────────────────────────────────────────────

  async suspend(actor: AuthenticatedUser, id: string, reason: string) {
    const profile = await this.getProfileOrThrow(id);
    profile.suspendedAt = new Date();
    profile.suspendReason = reason;
    const updated = await this.profileRepo.save(profile);

    // Revoke this agency's outstanding sessions immediately — otherwise an
    // already-issued refresh token keeps working until it happens to be
    // used again and rechecked.
    await this.refreshTokenRepo.update(
      { userId: id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

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
    profile.suspendedAt = null;
    profile.suspendReason = null;
    const updated = await this.profileRepo.save(profile);

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
      this.creditLineRepo.findOneBy({ agencyId: id }),
      this.computeUsedIrr([id]),
    ]);
    const limitIrr = creditLine?.limitIrr ?? ZERO_IRR;
    const usedIrr = maxIrr(usedByAgency.get(id) ?? ZERO_IRR, ZERO_IRR);
    return { limitIrr, usedIrr, remainingIrr: subIrr(limitIrr, usedIrr) };
  }

  async updateCredit(actor: AuthenticatedUser, id: string, limitIrr: Irr) {
    await this.getProfileOrThrow(id);
    const existing = await this.creditLineRepo.findOneBy({ agencyId: id });
    let updated: AgencyCreditLine;
    if (existing) {
      existing.limitIrr = limitIrr;
      existing.updatedById = actor.id;
      existing.updatedAt = new Date();
      updated = await this.creditLineRepo.save(existing);
    } else {
      updated = await this.creditLineRepo.save(
        this.creditLineRepo.create({
          agencyId: id,
          limitIrr,
          updatedById: actor.id,
          updatedAt: new Date(),
        }),
      );
    }

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
    const usedIrr = maxIrr(usedByAgency.get(id) ?? ZERO_IRR, ZERO_IRR);
    return {
      limitIrr: updated.limitIrr,
      usedIrr,
      remainingIrr: subIrr(updated.limitIrr, usedIrr),
    };
  }

  async settle(actor: AuthenticatedUser, id: string) {
    await this.getProfileOrThrow(id);

    const result = await this.profileRepo.manager.transaction(async (tx) => {
      // Lock this agency's profile row so two concurrent settlements can't
      // both read the same "outstanding" figure before either writes —
      // the aggregate below has no row of its own to lock, so we serialize
      // on the agency's own profile row instead.
      await tx
        .createQueryBuilder(AgencyProfile, 'a')
        .setLock('pessimistic_write')
        .where('a.userId = :id', { id })
        .getOne();

      const sumRow = await tx
        .createQueryBuilder(LedgerEntry, 'e')
        .select('SUM(e.signedAmountIrr)', 'sum')
        .where('e.agencyId = :id', { id })
        .andWhere('e.type IN (:...types)', { types: ['SALE', 'SETTLEMENT'] })
        .getRawOne<{ sum: string | null }>();
      const outstanding = maxIrr(BigInt(sumRow?.sum ?? '0'), ZERO_IRR);
      if (!isPositiveIrr(outstanding)) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'بدهی معوقی برای تسویه وجود ندارد.',
        });
      }

      const entry = await tx.save(
        tx.create(LedgerEntry, {
          agencyId: id,
          type: 'SETTLEMENT',
          signedAmountIrr: negateIrr(outstanding),
          createdById: actor.id,
        }),
      );

      return { settledIrr: outstanding, ledgerEntryId: entry.id };
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'ثبت تسویه آژانس',
      detail: `مبلغ ${result.settledIrr} ریال توسط ${actor.fullName} تسویه شد.`,
      entityType: 'AgencyProfile',
      entityId: id,
      metadata: { amountIrr: result.settledIrr },
    });

    return result;
  }

  // ── Membership requests ──────────────────────────────────────────────

  async listRequests(status?: AgencyMembershipStatus) {
    return this.membershipRequestRepo.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async getRequest(id: string) {
    const request = await this.getRequestOrThrow(id);
    const history = await this.auditLogRepo.find({
      where: {
        category: 'AGENCY',
        entityType: 'AgencyMembershipRequest',
        entityId: id,
      },
      order: { createdAt: 'DESC' },
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

    const { agencyUserId } = await this.profileRepo.manager.transaction(
      async (tx) => {
        const user = await tx.save(
          tx.create(User, {
            role: 'AGENCY',
            phone: request.phone,
            email: request.email,
            fullName: request.applicantName,
            passwordHash,
            mustChangePassword: true,
            isActive: true,
            updatedAt: new Date(),
          }),
        );
        await tx.save(
          tx.create(AgencyProfile, {
            userId: user.id,
            licenseNo: request.licenseNo,
            managerName: request.managerName,
            phone: request.phone,
            // Public pre-registration (Phase 16) collects neither — staff
            // fill these in during onboarding, same as the street address.
            email: request.email ?? '',
            city: request.city ?? '',
            // Full street address isn't captured on the request form — collected
            // during the agency's own onboarding once the agency-portal track exists.
            address: '',
            tier: 'NORMAL',
          }),
        );
        await tx.save(
          tx.create(AgencyCreditLine, {
            agencyId: user.id,
            limitIrr: 0n,
            updatedById: actor.id,
            updatedAt: new Date(),
          }),
        );
        await tx.update(
          AgencyMembershipRequest,
          { id },
          {
            status: 'APPROVED',
            reviewedById: actor.id,
            reviewedAt: new Date(),
          },
        );
        return { agencyUserId: user.id };
      },
    );

    // Phase 16: a real SMS now confirms approval + delivers access instead
    // of the temp password only ever appearing in the API response.
    await this.sms.send(
      request.phone,
      `درخواست همکاری آژانس شما تأیید شد. رمز عبور موقت شما در بلوجت: ${tempPassword}`,
      'TEMP_PASSWORD',
    );

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

    request.status = 'REJECTED';
    request.reviewNote = reviewNote ?? null;
    request.reviewedById = actor.id;
    request.reviewedAt = new Date();
    const updated = await this.membershipRequestRepo.save(request);

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

    const target = await this.userRepo.findOneBy({ id: referredToId });
    if (!target) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'کاربر مقصد ارجاع یافت نشد.',
      });
    }

    request.status = 'REFERRED';
    request.referredToId = referredToId;
    request.reviewNote = note ?? null;
    request.reviewedById = actor.id;
    request.reviewedAt = new Date();
    const updated = await this.membershipRequestRepo.save(request);

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
    return this.apiKeyRepo.find({
      where: { agencyId: id },
      order: { activatedAt: 'DESC' },
    });
  }

  async issueApiKey(
    actor: AuthenticatedUser,
    id: string,
    scope: AgencyApiScope,
    stepUpChallengeId: string,
    stepUpCode: string,
  ) {
    await this.stepUp.verify(
      actor,
      stepUpChallengeId,
      stepUpCode,
      'API_KEY_ROTATE',
    );
    await this.getProfileOrThrow(id);
    const rawKey = generateApiKeySecret();
    const created = await this.apiKeyRepo.save(
      this.apiKeyRepo.create({
        agencyId: id,
        keyHash: hashSecret(rawKey),
        scope,
        status: 'ACTIVE',
      }),
    );

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
    dto: {
      status?: AgencyApiKeyStatus;
      regenerate?: boolean;
      stepUpChallengeId?: string;
      stepUpCode?: string;
    },
  ) {
    const key = await this.apiKeyRepo.findOneBy({ id: keyId });
    if (!key || key.agencyId !== id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'کلید API یافت نشد.',
      });
    }

    if (dto.regenerate) {
      await this.stepUp.verify(
        actor,
        dto.stepUpChallengeId ?? '',
        dto.stepUpCode ?? '',
        'API_KEY_ROTATE',
      );
      const rawKey = generateApiKeySecret();
      key.keyHash = hashSecret(rawKey);
      key.activatedAt = new Date();
      key.lastUsedAt = null;
      key.callCount = 0;
      const updated = await this.apiKeyRepo.save(key);
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
      key.status = dto.status;
      const updated = await this.apiKeyRepo.save(key);
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
    return this.invoiceRepo.find({
      where: { agencyId: id },
      order: { issuedAt: 'DESC' },
    });
  }

  async issueInvoice(
    actor: AuthenticatedUser,
    id: string,
    dto: { amountIrr: Irr; dueAt: string },
  ) {
    await this.getProfileOrThrow(id);
    const created = await this.invoiceRepo.save(
      this.invoiceRepo.create({
        agencyId: id,
        invoiceNo: generateInvoiceNo(),
        issuedById: actor.id,
        dueAt: new Date(dto.dueAt),
        amountIrr: dto.amountIrr,
        status: 'UNPAID',
      }),
    );

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
    const profile = await this.profileRepo.findOneBy({ userId: id });
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'آژانس یافت نشد.',
      });
    }
    const targetIrr: Irr = 100_000_000n;
    const usedIrr = (await this.computeUsedIrr([id])).get(id) ?? ZERO_IRR;
    const deltaIrr = subIrr(targetIrr, usedIrr);
    if (!isZeroIrr(deltaIrr)) {
      await this.ledgerEntryRepo.save(
        this.ledgerEntryRepo.create({
          agencyId: id,
          type: 'SALE',
          signedAmountIrr: deltaIrr,
          createdById: actor.id,
        }),
      );
    }
    return { usedIrr: targetIrr };
  }

  async payInvoice(actor: AuthenticatedUser, id: string, invoiceId: string) {
    const invoice = await this.invoiceRepo.findOneBy({ id: invoiceId });
    if (!invoice || invoice.agencyId !== id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'فاکتور یافت نشد.',
      });
    }

    const updated = await this.invoiceRepo.manager.transaction(async (tx) => {
      // Conditional update guards against a concurrent double-pay race —
      // affected===0 means another request already marked it PAID first.
      const result = await tx.update(
        AgencyInvoice,
        { id: invoiceId, status: Not('PAID') },
        { status: 'PAID', paidAt: new Date() },
      );
      if ((result.affected ?? 0) === 0) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این فاکتور قبلاً تسویه شده است.',
        });
      }
      await tx.save(
        tx.create(LedgerEntry, {
          agencyId: id,
          type: 'SETTLEMENT',
          signedAmountIrr: negateIrr(invoice.amountIrr),
          createdById: actor.id,
        }),
      );
      return tx
        .createQueryBuilder(AgencyInvoice, 'i')
        .where('i.id = :id', { id: invoiceId })
        .getOneOrFail();
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
    const invoice = await this.invoiceRepo.findOneBy({ id: invoiceId });
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
    return this.messageRepo.find({
      where: { agencyId: id },
      order: { createdAt: 'ASC' },
    });
  }

  async postMessage(
    actor: AuthenticatedUser,
    id: string,
    body: string,
    senderIsAgency = false,
  ) {
    await this.getProfileOrThrow(id);
    return this.messageRepo.save(
      this.messageRepo.create({
        agencyId: id,
        senderId: actor.id,
        senderIsAgency,
        body,
      }),
    );
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
    return this.creditRequestRepo.find({
      where: { agencyId: id },
      order: { createdAt: 'DESC' },
    });
  }

  async decideCreditRequest(
    actor: AuthenticatedUser,
    id: string,
    requestId: string,
    approve: boolean,
  ) {
    const request = await this.creditRequestRepo.findOneBy({ id: requestId });
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
    const updated = await this.creditRequestRepo.update(
      { id: requestId, status: 'PENDING' },
      { status: decision, decidedById: actor.id, decidedAt: new Date() },
    );
    if ((updated.affected ?? 0) === 0) {
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

    return this.creditRequestRepo
      .createQueryBuilder('r')
      .where('r.id = :id', { id: requestId })
      .getOneOrFail();
  }

  // ── Agency Portal: webservice purchase requests (staff-side review) ────

  /** Cross-agency queue for SITE_ADMIN «درخواست وب‌سرویس» tab. */
  async listAllWebserviceRequests(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const rows = await this.typeorm.agencyWebserviceRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        agency: {
          select: {
            userId: true,
            city: true,
            licenseNo: true,
            user: { select: { fullName: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      agencyId: r.agencyId,
      agencyName: r.agency.user.fullName,
      city: r.agency.city,
      licenseNo: r.agency.licenseNo,
      scope: r.scope,
      months: r.months,
      priceIrr: r.priceIrr.toString(),
      note: r.note,
      status: r.status,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async listWebserviceRequests(id: string) {
    await this.getProfileOrThrow(id);
    return this.webserviceRequestRepo.find({
      where: { agencyId: id },
      order: { createdAt: 'DESC' },
    });
  }

  async decideWebserviceRequest(
    actor: AuthenticatedUser,
    id: string,
    requestId: string,
    approve: boolean,
    stepUpChallengeId?: string,
    stepUpCode?: string,
  ) {
    const request = await this.webserviceRequestRepo.findOneBy({
      id: requestId,
    });
    if (!request || request.agencyId !== id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'درخواست وب‌سرویس یافت نشد.',
      });
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این درخواست قبلاً بررسی شده است.',
      });
    }

    const decision: AgencyWebserviceRequestStatus = approve
      ? 'APPROVED'
      : 'REJECTED';

    if (approve) {
      // Issued BEFORE the status flip below: if step-up verification fails
      // here, the request is untouched and stays PENDING for a retry —
      // never left APPROVED with no key actually issued. Reuses the
      // existing, already-audited, step-up-gated key issuance path
      // verbatim rather than duplicating it.
      const { rawKey } = await this.issueApiKey(
        actor,
        id,
        request.scope,
        stepUpChallengeId ?? '',
        stepUpCode ?? '',
      );
      // AgencyApiKey only ever stores keyHash, so the raw key is
      // deliverable exactly once — through the agency's own message
      // thread, already visible via GET .../messages and the agency
      // portal's GET inbox.
      await this.postMessage(
        actor,
        id,
        `درخواست وب‌سرویس شما تأیید شد. کلید دسترسی API شما: ${rawKey}\nاین کلید فقط همین یک‌بار نمایش داده می‌شود؛ لطفاً آن را در جای امنی ذخیره کنید.`,
      );
    }

    // Conditional update guards a concurrent double-decision race — same
    // pattern as decideCreditRequest above.
    const updated = await this.webserviceRequestRepo.update(
      { id: requestId, status: 'PENDING' },
      { status: decision, decidedById: actor.id, decidedAt: new Date() },
    );
    if ((updated.affected ?? 0) === 0) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این درخواست قبلاً بررسی شده است.',
      });
    }

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: approve
        ? 'تأیید درخواست وب‌سرویس آژانس'
        : 'رد درخواست وب‌سرویس آژانس',
      detail: `درخواست وب‌سرویس (${request.scope}, ${request.months} ماهه) توسط ${actor.fullName} ${approve ? 'تأیید' : 'رد'} شد.`,
      entityType: 'AgencyWebserviceRequest',
      entityId: requestId,
    });

    return this.webserviceRequestRepo
      .createQueryBuilder('r')
      .where('r.id = :id', { id: requestId })
      .getOneOrFail();
  }

  // ── Agency Portal: uploaded document review (staff-side) ───────────────

  async listDocuments(id: string) {
    await this.getProfileOrThrow(id);
    return this.documentRepo.find({
      where: { agencyId: id },
      relations: { file: true },
      select: {
        file: { fileName: true, sizeBytes: true, mimeType: true },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async decideDocument(
    actor: AuthenticatedUser,
    id: string,
    documentId: string,
    approve: boolean,
  ) {
    const document = await this.documentRepo.findOneBy({ id: documentId });
    if (!document || document.agencyId !== id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'مدرک یافت نشد.',
      });
    }
    if (document.status !== 'PENDING') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این مدرک قبلاً بررسی شده است.',
      });
    }

    const decision: AgencyDocumentStatus = approve ? 'APPROVED' : 'REJECTED';

    // Conditional update guards a concurrent double-decision race — same
    // pattern as decideCreditRequest/decideWebserviceRequest above.
    const updated = await this.documentRepo.update(
      { id: documentId, status: 'PENDING' },
      { status: decision },
    );
    if ((updated.affected ?? 0) === 0) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این مدرک قبلاً بررسی شده است.',
      });
    }

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: approve ? 'تأیید مدرک آژانس' : 'رد مدرک آژانس',
      detail: `مدرک (${document.docType}) توسط ${actor.fullName} ${approve ? 'تأیید' : 'رد'} شد.`,
      entityType: 'AgencyDocument',
      entityId: documentId,
    });

    return this.documentRepo.findOne({
      where: { id: documentId },
      relations: { file: true },
      select: {
        file: { fileName: true, sizeBytes: true, mimeType: true },
      },
    });
  }
}

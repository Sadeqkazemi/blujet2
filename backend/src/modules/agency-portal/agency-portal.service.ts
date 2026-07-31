import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { AuditService } from '../audit/audit.service';
import { CartableService } from '../cartable/cartable.service';
import { AgenciesService } from '../agencies/agencies.service';
import { FilesService } from '../files/files.service';
import { WebservicePricingService } from '../webservice-pricing/webservice-pricing.service';
import { ErrorCode } from '../../common/errors';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type {
  RequestWebserviceDto,
  UploadDocumentDto,
} from './dto/agency-portal.dtos';

const CREDIT_REVIEW_ROLES = [
  'SENIOR_MANAGER',
  'FINANCE_MANAGER',
  'COMMERCIAL_MANAGER',
] as const;

const SOLD_STATUSES = ['PAID', 'TICKETED'] as const;

// Phase 23: server-computed prices from the commercial-manager plan catalog
// (stored in SystemSetting, editable via PATCH /webservice/pricing).
// Never accept a client-supplied price.

@Injectable()
export class AgencyPortalService {
  constructor(
    private readonly typeorm: TypeORMService,
    private readonly audit: AuditService,
    private readonly cartable: CartableService,
    private readonly agencies: AgenciesService,
    private readonly files: FilesService,
    private readonly webservicePricing: WebservicePricingService,
  ) {}

  private async getOwnProfileOrThrow(actor: AuthenticatedUser) {
    const profile = await this.typeorm.agencyProfile.findUnique({
      where: { userId: actor.id },
      include: { user: true },
    });
    if (!profile) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پروفایل آژانس یافت نشد.',
      });
    }
    return profile;
  }

  // ── Dashboard ──────────────────────────────────────────────────────

  async dashboard(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
    const id = actor.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      credit,
      salesThisMonth,
      ticketsIssuedTotal,
      seatsSoldThisMonth,
      salesRows,
    ] = await Promise.all([
      this.agencies.getCredit(id),
      this.typeorm.ledgerEntry.aggregate({
        // Real ticket sales only — excludes AgenciesService.resetTestDebt's
        // bookingless debt-line calibration rows (see ReportingService's
        // kpis() for the full explanation).
        where: {
          agencyId: id,
          type: 'SALE',
          bookingId: { not: null },
          occurredAt: { gte: startOfMonth },
        },
        _sum: { signedAmountIrr: true },
      }),
      this.typeorm.booking.count({
        where: { agencyId: id, status: { in: [...SOLD_STATUSES] } },
      }),
      this.typeorm.passenger.count({
        where: {
          booking: {
            agencyId: id,
            status: { in: [...SOLD_STATUSES] },
            createdAt: { gte: startOfMonth },
          },
        },
      }),
      this.typeorm.ledgerEntry.findMany({
        where: {
          agencyId: id,
          type: 'SALE',
          bookingId: { not: null },
          occurredAt: { gte: sixMonthsAgo },
        },
        select: { signedAmountIrr: true, occurredAt: true },
      }),
    ]);

    const monthBuckets = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBuckets.set(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        0,
      );
    }
    for (const row of salesRows) {
      const key = `${row.occurredAt.getFullYear()}-${String(row.occurredAt.getMonth() + 1).padStart(2, '0')}`;
      if (monthBuckets.has(key)) {
        monthBuckets.set(
          key,
          (monthBuckets.get(key) ?? 0) + row.signedAmountIrr,
        );
      }
    }

    return {
      credit,
      kpis: {
        salesThisMonthIrr: salesThisMonth._sum.signedAmountIrr ?? 0,
        ticketsIssuedTotal,
        seatsSoldThisMonth,
      },
      monthlySales: Array.from(monthBuckets.entries()).map(
        ([month, salesIrr]) => ({
          month,
          salesIrr,
        }),
      ),
    };
  }

  async ledger(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
    return this.typeorm.ledgerEntry.findMany({
      where: { agencyId: actor.id },
      orderBy: { occurredAt: 'desc' },
      take: 20,
    });
  }

  // ── Credit & invoices ────────────────────────────────────────────────

  async credit(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
    return this.agencies.getCredit(actor.id);
  }

  async invoices(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
    return this.agencies.listInvoices(actor.id);
  }

  async payInvoice(actor: AuthenticatedUser, invoiceId: string) {
    await this.getOwnProfileOrThrow(actor);
    return this.agencies.payInvoice(actor, actor.id, invoiceId);
  }

  async requestCreditIncrease(
    actor: AuthenticatedUser,
    dto: { requestedLimitIrr: number; note?: string },
  ) {
    await this.getOwnProfileOrThrow(actor);
    const current = await this.agencies.getCredit(actor.id);
    if (dto.requestedLimitIrr <= current.limitIrr) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'سقف درخواستی باید بیشتر از سقف فعلی باشد.',
      });
    }

    const request = await this.typeorm.agencyCreditRequest.create({
      data: {
        agencyId: actor.id,
        requestedLimitIrr: dto.requestedLimitIrr,
        note: dto.note,
      },
    });

    await this.cartable.createTasksForRoles([...CREDIT_REVIEW_ROLES], {
      category: 'AGENCY',
      title: `درخواست افزایش اعتبار: ${actor.fullName}`,
      description: `آژانس «${actor.fullName}» درخواست افزایش سقف اعتبار به ${dto.requestedLimitIrr} ریال داده است.${dto.note ? ` یادداشت: ${dto.note}` : ''}`,
      senderId: actor.id,
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'درخواست افزایش اعتبار آژانس',
      detail: `آژانس «${actor.fullName}» درخواست افزایش سقف اعتبار به ${dto.requestedLimitIrr} ریال ثبت کرد.`,
      entityType: 'AgencyCreditRequest',
      entityId: request.id,
    });

    return request;
  }

  async myCreditRequests(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
    return this.typeorm.agencyCreditRequest.findMany({
      where: { agencyId: actor.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Sales & report ───────────────────────────────────────────────────

  async sales(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
    const id = actor.id;

    const bookings = await this.typeorm.booking.findMany({
      where: { agencyId: id },
      include: {
        passengers: { select: { id: true } },
        flightInstance: { include: { flight: { include: { route: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const tickets = bookings.map((b) => ({
      pnr: b.pnr,
      status: b.status,
      flightNo: b.flightInstance.flight.flightNo,
      route: `${b.flightInstance.flight.route.originCode} → ${b.flightInstance.flight.route.destCode}`,
      departureAt: b.flightInstance.departureAt,
      priceIrr: b.priceIrr,
      passengerCount: b.passengers.length,
    }));

    const perFlightMap = new Map<
      string,
      {
        flightNo: string;
        route: string;
        ticketsCount: number;
        salesIrr: number;
      }
    >();
    const soldBookings = bookings.filter((b) =>
      (SOLD_STATUSES as readonly string[]).includes(b.status),
    );
    for (const b of soldBookings) {
      const key = b.flightInstance.flight.flightNo;
      const existing = perFlightMap.get(key) ?? {
        flightNo: key,
        route: `${b.flightInstance.flight.route.originCode} → ${b.flightInstance.flight.route.destCode}`,
        ticketsCount: 0,
        salesIrr: 0,
      };
      existing.ticketsCount += 1;
      existing.salesIrr += b.priceIrr;
      perFlightMap.set(key, existing);
    }

    const totalSalesIrr = soldBookings.reduce((s, b) => s + b.priceIrr, 0);
    const ticketsIssued = soldBookings.length;
    const refundedCount = bookings.filter(
      (b) => b.status === 'REFUNDED',
    ).length;
    const avgFareIrr =
      ticketsIssued > 0 ? Math.round(totalSalesIrr / ticketsIssued) : 0;
    const refundRatePct =
      bookings.length > 0
        ? Math.round((refundedCount / bookings.length) * 1000) / 10
        : 0;

    return {
      tickets,
      perFlight: Array.from(perFlightMap.values()),
      summary: { totalSalesIrr, ticketsIssued, avgFareIrr, refundRatePct },
    };
  }

  // ── Inbox ────────────────────────────────────────────────────────────

  async inbox(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
    return this.agencies.listMessages(actor.id);
  }

  async postInboxMessage(actor: AuthenticatedUser, body: string) {
    await this.getOwnProfileOrThrow(actor);
    return this.agencies.postMessage(actor, actor.id, body, true);
  }

  // ── Profile & documents ──────────────────────────────────────────────

  async profile(actor: AuthenticatedUser) {
    const profile = await this.getOwnProfileOrThrow(actor);
    return {
      fullName: profile.user.fullName,
      managerName: profile.managerName,
      licenseNo: profile.licenseNo,
      phone: profile.phone,
      email: profile.email,
      city: profile.city,
      address: profile.address,
      tier: profile.tier,
      isActive: !profile.suspendedAt,
      suspendedAt: profile.suspendedAt,
      suspendReason: profile.suspendReason,
      joinedAt: profile.joinedAt,
    };
  }

  async documents(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
    return this.typeorm.agencyDocument.findMany({
      where: { agencyId: actor.id },
      include: {
        file: { select: { fileName: true, sizeBytes: true, mimeType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadDocument(
    actor: AuthenticatedUser,
    file: Express.Multer.File,
    dto: UploadDocumentDto,
  ) {
    await this.getOwnProfileOrThrow(actor);
    const stored = await this.files.store(actor, file);
    return this.typeorm.agencyDocument.create({
      data: { agencyId: actor.id, fileId: stored.id, docType: dto.docType },
      include: {
        file: { select: { fileName: true, sizeBytes: true, mimeType: true } },
      },
    });
  }

  // ── Phase 16: real seat allotments (replaces AgencySeatsPage mock) ─────

  async allotments(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
    const id = actor.id;

    const rows = await this.typeorm.agencyAllotment.findMany({
      where: { agencyId: id },
      include: {
        flightInstance: { include: { flight: { include: { route: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    return Promise.all(
      rows.map(async (r) => {
        // No allotmentId FK on Booking (see docs/DB_SCHEMA.md Phase 16 ⚑ —
        // "book against own allotment" isn't built yet) — consumed is
        // derived from this agency's real bookings on the same flight.
        const usedSeats = await this.typeorm.booking.count({
          where: {
            agencyId: id,
            flightInstanceId: r.flightInstanceId,
            status: { in: [...SOLD_STATUSES] },
          },
        });
        return {
          id: r.id,
          flightNo: r.flightInstance.flight.flightNo,
          route: `${r.flightInstance.flight.route.originCode} → ${r.flightInstance.flight.route.destCode}`,
          departureAt: r.flightInstance.departureAt,
          aircraftType: r.flightInstance.flight.aircraftType,
          seatsAllocated: r.seatsAllocated,
          seatsUsed: usedSeats,
          type: r.type,
          releaseAt: r.releaseAt,
          contractPriceIrr: r.contractPriceIrr,
          active: r.type === 'HARD' || !r.releaseAt || r.releaseAt > now,
        };
      }),
    );
  }

  // ── Phase 23: real webservice (B2B API) purchase requests ──────────────
  // (replaces AgencyWebservicePage mock's local-only "requested"/"keyShown")

  async assertAgency(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
  }

  async webservicePlans() {
    const prices = await this.webservicePricing.getPlanPrices();
    return {
      plans: ([1, 3, 12] as const).map((months) => ({
        months,
        priceIrr: prices[months],
      })),
    };
  }

  async requestWebservice(actor: AuthenticatedUser, dto: RequestWebserviceDto) {
    await this.getOwnProfileOrThrow(actor);
    const planPrices = await this.webservicePricing.getPlanPrices();
    const priceIrr = planPrices[dto.months];
    if (!priceIrr) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'مدت اشتراک نامعتبر است.',
      });
    }

    const request = await this.typeorm.agencyWebserviceRequest.create({
      data: {
        agencyId: actor.id,
        scope: dto.scope,
        months: dto.months,
        priceIrr,
        note: dto.note,
      },
    });

    const scopeFa =
      dto.scope === 'FULL' ? 'فروش کامل (صدور بلیط)' : 'جستجو و رزرو';
    await this.cartable.createTasksForRoles([...CREDIT_REVIEW_ROLES], {
      category: 'AGENCY',
      title: `درخواست خرید وب‌سرویس: ${actor.fullName}`,
      description: `آژانس «${actor.fullName}» درخواست خرید وب‌سرویس (${scopeFa}، ${dto.months} ماهه) داده است.${dto.note ? ` یادداشت: ${dto.note}` : ''}`,
      senderId: actor.id,
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'درخواست خرید وب‌سرویس آژانس',
      detail: `آژانس «${actor.fullName}» درخواست وب‌سرویس با دامنه ${dto.scope} به مدت ${dto.months} ماه به مبلغ ${priceIrr} ریال ثبت کرد.`,
      entityType: 'AgencyWebserviceRequest',
      entityId: request.id,
    });

    return request;
  }

  async myWebserviceRequests(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
    return this.typeorm.agencyWebserviceRequest.findMany({
      where: { agencyId: actor.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async apiKeys(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
    const keys = await this.agencies.listApiKeys(actor.id);
    // The raw key is retrievable exactly once, at approval time, and is
    // delivered via the agency's own message thread (see
    // AgenciesService.decideWebserviceRequest) — never re-exposed here.
    return keys.map((k) => ({
      id: k.id,
      scope: k.scope,
      status: k.status,
      activatedAt: k.activatedAt,
      expiresAt: k.expiresAt,
      lastUsedAt: k.lastUsedAt,
      callCount: k.callCount,
    }));
  }
}

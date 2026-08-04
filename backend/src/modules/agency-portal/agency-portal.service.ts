import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Not, IsNull, Repository } from 'typeorm';
import { AgencyProfile } from '../../database/entities/agency-profile.entity';
import { AgencyDocument } from '../../database/entities/agency-document.entity';
import { AgencyCreditRequest } from '../../database/entities/agency-credit-request.entity';
import { AgencyWebserviceRequest } from '../../database/entities/agency-webservice-request.entity';
import { AgencyAllotment } from '../../database/entities/agency-allotment.entity';
import { LedgerEntry } from '../../database/entities/ledger-entry.entity';
import { Booking } from '../../database/entities/booking.entity';
import { Passenger } from '../../database/entities/passenger.entity';
import { AuditService } from '../audit/audit.service';
import { CartableService } from '../cartable/cartable.service';
import { AgenciesService } from '../agencies/agencies.service';
import { FilesService } from '../files/files.service';
import { WebservicePricingService } from '../webservice-pricing/webservice-pricing.service';
import { ErrorCode } from '../../common/errors';
import { ZERO_IRR, addIrr, divRoundBigInt, toIrr } from '../../common/money';
import type { Irr } from '../../common/money';
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
    @InjectRepository(AgencyProfile)
    private readonly profileRepo: Repository<AgencyProfile>,
    @InjectRepository(AgencyDocument)
    private readonly documentRepo: Repository<AgencyDocument>,
    @InjectRepository(AgencyCreditRequest)
    private readonly creditRequestRepo: Repository<AgencyCreditRequest>,
    @InjectRepository(AgencyWebserviceRequest)
    private readonly webserviceRequestRepo: Repository<AgencyWebserviceRequest>,
    @InjectRepository(AgencyAllotment)
    private readonly allotmentRepo: Repository<AgencyAllotment>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Passenger)
    private readonly passengerRepo: Repository<Passenger>,
    private readonly audit: AuditService,
    private readonly cartable: CartableService,
    private readonly agencies: AgenciesService,
    private readonly files: FilesService,
    private readonly webservicePricing: WebservicePricingService,
  ) {}

  private async getOwnProfileOrThrow(actor: AuthenticatedUser) {
    const profile = await this.profileRepo.findOne({
      where: { userId: actor.id },
      relations: { user: true },
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
      salesThisMonthRow,
      ticketsIssuedTotal,
      seatsSoldThisMonth,
      salesRows,
    ] = await Promise.all([
      this.agencies.getCredit(id),
      this.ledgerRepo
        .createQueryBuilder('l')
        .select('SUM(l."signedAmountIrr")', 'sum')
        .where('l."agencyId" = :id', { id })
        .andWhere('l.type = :type', { type: 'SALE' })
        .andWhere('l."bookingId" IS NOT NULL')
        .andWhere('l."occurredAt" >= :startOfMonth', { startOfMonth })
        .getRawOne<{ sum: string | null }>(),
      this.bookingRepo.count({
        where: { agencyId: id, status: In([...SOLD_STATUSES]) },
      }),
      this.passengerRepo
        .createQueryBuilder('p')
        .innerJoin('p.booking', 'b')
        .where('b."agencyId" = :id', { id })
        .andWhere('b.status IN (:...statuses)', {
          statuses: [...SOLD_STATUSES],
        })
        .andWhere('b."createdAt" >= :startOfMonth', { startOfMonth })
        .getCount(),
      this.ledgerRepo.find({
        where: {
          agencyId: id,
          type: 'SALE' as never,
          bookingId: Not(IsNull()),
          occurredAt: MoreThanOrEqual(sixMonthsAgo),
        },
        select: { signedAmountIrr: true, occurredAt: true },
      }),
    ]);

    const monthBuckets = new Map<string, Irr>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBuckets.set(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        ZERO_IRR,
      );
    }
    for (const row of salesRows) {
      const key = `${row.occurredAt.getFullYear()}-${String(row.occurredAt.getMonth() + 1).padStart(2, '0')}`;
      if (monthBuckets.has(key)) {
        monthBuckets.set(
          key,
          addIrr(monthBuckets.get(key) ?? ZERO_IRR, row.signedAmountIrr),
        );
      }
    }

    return {
      credit,
      kpis: {
        salesThisMonthIrr: salesThisMonthRow?.sum
          ? BigInt(salesThisMonthRow.sum)
          : ZERO_IRR,
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
    return this.ledgerRepo.find({
      where: { agencyId: actor.id },
      order: { occurredAt: 'DESC' },
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
    dto: { requestedLimitIrr: Irr; note?: string },
  ) {
    await this.getOwnProfileOrThrow(actor);
    const current = await this.agencies.getCredit(actor.id);
    if (dto.requestedLimitIrr <= current.limitIrr) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'سقف درخواستی باید بیشتر از سقف فعلی باشد.',
      });
    }

    const request = await this.creditRequestRepo.save(
      this.creditRequestRepo.create({
        agencyId: actor.id,
        requestedLimitIrr: dto.requestedLimitIrr,
        note: dto.note ?? null,
      }),
    );

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
    return this.creditRequestRepo.find({
      where: { agencyId: actor.id },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Sales & report ───────────────────────────────────────────────────

  async sales(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
    const id = actor.id;

    const bookings = await this.bookingRepo.find({
      where: { agencyId: id },
      relations: {
        flightInstance: { flight: { route: true } },
      },
      order: { createdAt: 'DESC' },
    });

    const passengerCounts = bookings.length
      ? await this.passengerRepo
          .createQueryBuilder('p')
          .select('p."bookingId"', 'bookingId')
          .addSelect('COUNT(*)', 'count')
          .where('p."bookingId" IN (:...ids)', {
            ids: bookings.map((b) => b.id),
          })
          .groupBy('p."bookingId"')
          .getRawMany<{ bookingId: string; count: string }>()
      : [];
    const passengerCountByBooking = new Map<string, number>(
      passengerCounts.map((row) => [row.bookingId, Number(row.count)]),
    );

    const tickets = bookings.map((b) => ({
      pnr: b.pnr,
      status: b.status,
      flightNo: b.flightInstance.flight.flightNo,
      route: `${b.flightInstance.flight.route.originCode} → ${b.flightInstance.flight.route.destCode}`,
      departureAt: b.flightInstance.departureAt,
      priceIrr: b.priceIrr,
      passengerCount: passengerCountByBooking.get(b.id) ?? 0,
    }));

    const perFlightMap = new Map<
      string,
      {
        flightNo: string;
        route: string;
        ticketsCount: number;
        salesIrr: Irr;
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
        salesIrr: ZERO_IRR,
      };
      existing.ticketsCount += 1;
      existing.salesIrr = addIrr(existing.salesIrr, b.priceIrr);
      perFlightMap.set(key, existing);
    }

    const totalSalesIrr = soldBookings.reduce(
      (s, b) => addIrr(s, b.priceIrr),
      ZERO_IRR,
    );
    const ticketsIssued = soldBookings.length;
    const refundedCount = bookings.filter(
      (b) => b.status === 'REFUNDED',
    ).length;
    const avgFareIrr: Irr =
      ticketsIssued > 0
        ? divRoundBigInt(totalSalesIrr, BigInt(ticketsIssued))
        : ZERO_IRR;
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

  /** CSV export for agency sales — UTF-8 BOM for Excel Persian compatibility. */
  async salesCsv(actor: AuthenticatedUser): Promise<string> {
    const report = await this.sales(actor);
    const header = 'PNR,Flight,Route,Departure,Status,Passengers,AmountIRR';
    const rows = report.tickets.map((t) =>
      [
        t.pnr,
        t.flightNo,
        `"${t.route}"`,
        t.departureAt.toISOString(),
        t.status,
        t.passengerCount,
        String(t.priceIrr),
      ].join(','),
    );
    return `\uFEFF${header}\n${rows.join('\n')}\n`;
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
    const docs = await this.documentRepo.find({
      where: { agencyId: actor.id },
      relations: { file: true },
      order: { createdAt: 'DESC' },
    });
    return docs.map((d) => ({
      ...d,
      file: {
        fileName: d.file.fileName,
        sizeBytes: d.file.sizeBytes,
        mimeType: d.file.mimeType,
      },
    }));
  }

  async uploadDocument(
    actor: AuthenticatedUser,
    file: Express.Multer.File,
    dto: UploadDocumentDto,
  ) {
    await this.getOwnProfileOrThrow(actor);
    const stored = await this.files.store(actor, file);
    const saved = await this.documentRepo.save(
      this.documentRepo.create({
        agencyId: actor.id,
        fileId: stored.id,
        docType: dto.docType,
      }),
    );
    const doc = await this.documentRepo.findOne({
      where: { id: saved.id },
      relations: { file: true },
    });
    if (!doc) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'مدرک یافت نشد.',
      });
    }
    return {
      ...doc,
      file: {
        fileName: doc.file.fileName,
        sizeBytes: doc.file.sizeBytes,
        mimeType: doc.file.mimeType,
      },
    };
  }

  // ── Phase 16: real seat allotments (replaces AgencySeatsPage mock) ─────

  async allotments(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
    const id = actor.id;

    const rows = await this.allotmentRepo.find({
      where: { agencyId: id },
      relations: { flightInstance: { flight: { route: true } } },
      order: { createdAt: 'DESC' },
    });

    const now = new Date();
    return Promise.all(
      rows.map(async (r) => {
        // No allotmentId FK on Booking (see docs/DB_SCHEMA.md Phase 16 ⚑ —
        // "book against own allotment" isn't built yet) — consumed is
        // derived from this agency's real bookings on the same flight.
        const usedSeats = await this.bookingRepo.count({
          where: {
            agencyId: id,
            flightInstanceId: r.flightInstanceId,
            status: In([...SOLD_STATUSES]),
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
        // Wire format consistency: every *Irr field is a decimal string in
        // responses (see docs/API.md) — this one is JSON-stored (not a
        // TypeORM BigInt column) but still IRR money, so it goes through the
        // same Irr/bigint-string path as every other price field.
        priceIrr: toIrr(prices[months]),
      })),
    };
  }

  async requestWebservice(actor: AuthenticatedUser, dto: RequestWebserviceDto) {
    await this.getOwnProfileOrThrow(actor);
    const planPrices = await this.webservicePricing.getPlanPrices();
    const planPriceIrr = planPrices[dto.months];
    if (!planPriceIrr) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'مدت اشتراک نامعتبر است.',
      });
    }

    const request = await this.webserviceRequestRepo.save(
      this.webserviceRequestRepo.create({
        agencyId: actor.id,
        scope: dto.scope,
        months: dto.months,
        priceIrr: toIrr(planPriceIrr),
        note: dto.note ?? null,
      }),
    );

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
      detail: `آژانس «${actor.fullName}» درخواست وب‌سرویس با دامنه ${dto.scope} به مدت ${dto.months} ماه به مبلغ ${planPriceIrr} ریال ثبت کرد.`,
      entityType: 'AgencyWebserviceRequest',
      entityId: request.id,
    });

    return request;
  }

  async myWebserviceRequests(actor: AuthenticatedUser) {
    await this.getOwnProfileOrThrow(actor);
    return this.webserviceRequestRepo.find({
      where: { agencyId: actor.id },
      order: { createdAt: 'DESC' },
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

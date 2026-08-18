import {
  BadRequestException,
  ForbiddenException,
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
import { User } from '../../database/entities/user.entity';
import { FlightInstance } from '../../database/entities/flight-instance.entity';
import { AgencySeatCommitment } from '../../database/entities/agency-seat-commitment.entity';
import { CharterCommitment } from '../../database/entities/charter-commitment.entity';
import { CommitmentStatus, FlightInstanceStatus } from '../../database/enums';
import { randomUUID } from 'node:crypto';
import { isActiveUatSandboxAgency } from '../../database/temporary-panel-accounts';
import { AuditService } from '../audit/audit.service';
import { CartableService } from '../cartable/cartable.service';
import { AgenciesService } from '../agencies/agencies.service';
import { FilesService } from '../files/files.service';
import { WebservicePricingService } from '../webservice-pricing/webservice-pricing.service';
import { ErrorCode } from '../../common/errors';
import { AgencySeatRequest } from '../../database/entities/agency-seat-request.entity';
import { AgencySeatRequestFlight } from '../../database/entities/agency-seat-request-flight.entity';
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
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FlightInstance)
    private readonly flightInstanceRepo: Repository<FlightInstance>,
    @InjectRepository(AgencySeatCommitment)
    private readonly agencySeatCommitmentRepo: Repository<AgencySeatCommitment>,
    @InjectRepository(CharterCommitment)
    private readonly charterCommitmentRepo: Repository<CharterCommitment>,
    @InjectRepository(AgencySeatRequest)
    private readonly seatRequestRepo: Repository<AgencySeatRequest>,
    @InjectRepository(AgencySeatRequestFlight)
    private readonly seatRequestFlightRepo: Repository<AgencySeatRequestFlight>,
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

  // `uat.agency` is identity/access infrastructure only — no AgencyProfile
  // or AgencyCreditLine is ever created for it (see docs/features/
  // temporary-panel-password-access.md). These two guards let every read
  // endpoint below return a real, honest empty state instead of the normal
  // 404, and every mutating endpoint refuse instead of writing a business
  // row for an account with no real agency behind it.

  private async loadUatSandboxAgencyUser(
    actor: AuthenticatedUser,
  ): Promise<User | null> {
    const user = await this.userRepo.findOneBy({ id: actor.id });
    return user && isActiveUatSandboxAgency(user) ? user : null;
  }

  private async isUatSandboxAgencyActor(
    actor: AuthenticatedUser,
  ): Promise<boolean> {
    return (await this.loadUatSandboxAgencyUser(actor)) !== null;
  }

  private async assertAgencyPortalWritable(
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (await this.isUatSandboxAgencyActor(actor)) {
      throw new ForbiddenException({
        code: ErrorCode.UAT_TEMPORARY_ACCOUNT_READ_ONLY,
        message:
          'این حساب آزمایشی UAT فقط برای مشاهده است و امکان ثبت تغییر ندارد.',
      });
    }
  }

  async assertAgencyWritable(actor: AuthenticatedUser): Promise<void> {
    await this.assertAgencyPortalWritable(actor);
    await this.getOwnProfileOrThrow(actor);
  }

  // ── Dashboard ──────────────────────────────────────────────────────

  async dashboard(actor: AuthenticatedUser) {
    if (await this.isUatSandboxAgencyActor(actor)) {
      return {
        credit: {
          limitIrr: ZERO_IRR,
          usedIrr: ZERO_IRR,
          remainingIrr: ZERO_IRR,
        },
        kpis: {
          salesThisMonthIrr: ZERO_IRR,
          ticketsIssuedTotal: 0,
          seatsSoldThisMonth: 0,
        },
        monthlySales: [],
      };
    }
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
    if (await this.isUatSandboxAgencyActor(actor)) return [];
    await this.getOwnProfileOrThrow(actor);
    return this.ledgerRepo.find({
      where: { agencyId: actor.id },
      order: { occurredAt: 'DESC' },
      take: 20,
    });
  }

  // ── Credit & invoices ────────────────────────────────────────────────

  async credit(actor: AuthenticatedUser) {
    if (await this.isUatSandboxAgencyActor(actor)) {
      return { limitIrr: ZERO_IRR, usedIrr: ZERO_IRR, remainingIrr: ZERO_IRR };
    }
    await this.getOwnProfileOrThrow(actor);
    return this.agencies.getCredit(actor.id);
  }

  async invoices(actor: AuthenticatedUser) {
    if (await this.isUatSandboxAgencyActor(actor)) return [];
    await this.getOwnProfileOrThrow(actor);
    return this.agencies.listInvoices(actor.id);
  }

  async payInvoice(actor: AuthenticatedUser, invoiceId: string) {
    await this.assertAgencyPortalWritable(actor);
    await this.getOwnProfileOrThrow(actor);
    return this.agencies.payInvoice(actor, actor.id, invoiceId);
  }

  async requestCreditIncrease(
    actor: AuthenticatedUser,
    dto: { requestedLimitIrr: Irr; note?: string },
  ) {
    await this.assertAgencyPortalWritable(actor);
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
    if (await this.isUatSandboxAgencyActor(actor)) return [];
    await this.getOwnProfileOrThrow(actor);
    return this.creditRequestRepo.find({
      where: { agencyId: actor.id },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Sales & report ───────────────────────────────────────────────────

  async sales(actor: AuthenticatedUser) {
    if (await this.isUatSandboxAgencyActor(actor)) {
      return {
        tickets: [],
        perFlight: [],
        summary: {
          totalSalesIrr: ZERO_IRR,
          ticketsIssued: 0,
          avgFareIrr: ZERO_IRR,
          refundRatePct: 0,
        },
      };
    }
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
    if (await this.isUatSandboxAgencyActor(actor)) return [];
    await this.getOwnProfileOrThrow(actor);
    return this.agencies.listMessages(actor.id);
  }

  async postInboxMessage(actor: AuthenticatedUser, body: string) {
    await this.assertAgencyPortalWritable(actor);
    await this.getOwnProfileOrThrow(actor);
    return this.agencies.postMessage(actor, actor.id, body, true);
  }

  // ── Profile & documents ──────────────────────────────────────────────

  async profile(actor: AuthenticatedUser) {
    const uatUser = await this.loadUatSandboxAgencyUser(actor);
    if (uatUser) {
      return {
        fullName: uatUser.fullName,
        managerName: null,
        licenseNo: null,
        phone: uatUser.phone,
        email: uatUser.email,
        city: null,
        address: null,
        tier: null,
        isActive: true,
        suspendedAt: null,
        suspendReason: null,
        joinedAt: uatUser.createdAt,
        isTemporaryReadOnly: true,
      };
    }
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
      isTemporaryReadOnly: false,
    };
  }

  async documents(actor: AuthenticatedUser) {
    if (await this.isUatSandboxAgencyActor(actor)) return [];
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
    await this.assertAgencyPortalWritable(actor);
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
    if (await this.isUatSandboxAgencyActor(actor)) return [];
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
        const usedSeats = await this.passengerRepo
          .createQueryBuilder('passenger')
          .innerJoin('passenger.booking', 'booking')
          .where('booking.allotmentId = :allotmentId', { allotmentId: r.id })
          .andWhere('booking.status IN (:...statuses)', {
            statuses: [...SOLD_STATUSES],
          })
          .getCount();
        return {
          id: r.id,
          flightInstanceId: r.flightInstanceId,
          flightNo: r.flightInstance.flight.flightNo,
          route: `${r.flightInstance.flight.route.originCode} → ${r.flightInstance.flight.route.destCode}`,
          originCode: r.flightInstance.flight.route.originCode,
          destinationCode: r.flightInstance.flight.route.destCode,
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

  async seatRequestOptions(actor: AuthenticatedUser) {
    // The shared UAT agency has no business profile by design, but it still
    // needs the real published route/flight catalogue in order to exercise
    // the sandbox seat-request flow. Other agency accounts keep the normal
    // profile requirement.
    if (!(await this.isUatSandboxAgencyActor(actor))) {
      await this.getOwnProfileOrThrow(actor);
    }
    const instances = await this.flightInstanceRepo.find({
      where: {
        departureAt: MoreThanOrEqual(new Date()),
        status: FlightInstanceStatus.SCHEDULED,
      },
      relations: { flight: { route: true } },
      order: { departureAt: 'ASC' },
      take: 200,
    });

    const instanceIds = instances.map((instance) => instance.id);
    if (instanceIds.length === 0) return [];

    const [agencyRows, charterRows, soldRows] = await Promise.all([
      this.agencySeatCommitmentRepo
        .createQueryBuilder('commitment')
        .select('commitment."flightInstanceId"', 'flightInstanceId')
        .addSelect('COALESCE(SUM(commitment.seats), 0)', 'total')
        .addSelect(
          'COALESCE(SUM(CASE WHEN commitment."agencyId" = :agencyId THEN commitment.seats ELSE 0 END), 0)',
          'own',
        )
        .where('commitment."flightInstanceId" IN (:...instanceIds)', {
          instanceIds,
          agencyId: actor.id,
        })
        .andWhere('commitment.status = :status', {
          status: CommitmentStatus.ACTIVE,
        })
        .groupBy('commitment."flightInstanceId"')
        .getRawMany<{ flightInstanceId: string; total: string; own: string }>(),
      this.charterCommitmentRepo
        .createQueryBuilder('commitment')
        .select('commitment."flightInstanceId"', 'flightInstanceId')
        .addSelect('COALESCE(SUM(commitment.seats), 0)', 'total')
        .where('commitment."flightInstanceId" IN (:...instanceIds)', {
          instanceIds,
        })
        .andWhere('commitment.status = :status', {
          status: CommitmentStatus.ACTIVE,
        })
        .groupBy('commitment."flightInstanceId"')
        .getRawMany<{ flightInstanceId: string; total: string }>(),
      this.passengerRepo
        .createQueryBuilder('passenger')
        .innerJoin('passenger.booking', 'booking')
        .select('booking."flightInstanceId"', 'flightInstanceId')
        .addSelect('COUNT(passenger.id)', 'total')
        .where('booking."flightInstanceId" IN (:...instanceIds)', {
          instanceIds,
        })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: ['DRAFT', 'HELD', 'PAID', 'TICKETED'],
        })
        .andWhere('passenger."occupiesSeat" = TRUE')
        .groupBy('booking."flightInstanceId"')
        .getRawMany<{ flightInstanceId: string; total: string }>(),
    ]);

    const agencyByInstance = new Map(
      agencyRows.map((row) => [row.flightInstanceId, row]),
    );
    const charterByInstance = new Map(
      charterRows.map((row) => [row.flightInstanceId, Number(row.total)]),
    );
    const soldByInstance = new Map(
      soldRows.map((row) => [row.flightInstanceId, Number(row.total)]),
    );

    return instances.map((instance) => {
      const agency = agencyByInstance.get(instance.id);
      const allocated = Number(agency?.total ?? 0);
      const ownAllocated = Number(agency?.own ?? 0);
      const committed = allocated + (charterByInstance.get(instance.id) ?? 0);
      const sold = soldByInstance.get(instance.id) ?? 0;
      return {
        flightInstanceId: instance.id,
        flightNo: instance.flight.flightNo,
        originCode: instance.flight.route.originCode,
        destCode: instance.flight.route.destCode,
        departureAt: instance.departureAt,
        aircraftType:
          instance.aircraftTypeOverride ?? instance.flight.aircraftType,
        capacity: instance.capacity,
        agencyAllocated: allocated,
        ownAllocated,
        availableToRequest: Math.max(instance.capacity - committed - sold, 0),
        pricePerSeatIrr: instance.basePriceIrr,
        definitionStatus: instance.definitionStatus,
      };
    });
  }

  async requestSeats(
    actor: AuthenticatedUser,
    dto: {
      flightInstanceId: string;
      seats: number;
      preferredWeekdays?: number[];
      termMonths?: 1 | 3 | 6 | 12;
    },
  ) {
    const uatUser = await this.loadUatSandboxAgencyUser(actor);
    const profile = uatUser ? null : await this.getOwnProfileOrThrow(actor);
    const options = await this.seatRequestOptions(actor);
    const option = options.find(
      (row) => row.flightInstanceId === dto.flightInstanceId,
    );
    if (!option) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'مسیر یا پرواز فعال و قابل درخواست یافت نشد.',
      });
    }
    if (dto.seats < 1 || !Number.isInteger(dto.seats)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'تعداد صندلی باید عدد صحیح مثبت باشد.',
      });
    }
    if (dto.seats > option.availableToRequest) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'تعداد صندلی درخواستی بیشتر از ظرفیت آزاد این پرواز است.',
      });
    }

    const instance = await this.flightInstanceRepo.findOne({
      where: { id: dto.flightInstanceId },
      relations: { flight: { route: true } },
    });
    if (!instance?.flight.routeId) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'مسیر یا پرواز فعال و قابل درخواست یافت نشد.',
      });
    }

    const unitPriceIrr = toIrr(option.pricePerSeatIrr ?? 0n);
    if (unitPriceIrr < ZERO_IRR) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'قیمت صندلی نامعتبر است.',
      });
    }

    const requestId = randomUUID();
    await this.seatRequestRepo.manager.transaction(async (tx) => {
      await tx.save(
        tx.create(AgencySeatRequest, {
          id: requestId,
          agencyId: actor.id,
          routeId: instance.flight.routeId,
          aircraftType: option.aircraftType,
          seats: dto.seats,
          termMonths: dto.termMonths ?? null,
          unitPriceIrr,
          payMethod: 'INVOICE',
          status: 'PENDING',
        }),
      );
      await tx.save(
        tx.create(AgencySeatRequestFlight, {
          seatRequestId: requestId,
          flightInstanceId: dto.flightInstanceId,
        }),
      );
    });

    const weekdays = dto.preferredWeekdays?.join(', ') || 'بدون محدودیت';
    const term = dto.termMonths ? `${dto.termMonths} ماه` : 'تک‌پرواز';
    const senderLabel =
      profile?.managerName ?? uatUser?.fullName ?? actor.fullName;
    const description = `آژانس «${senderLabel}» برای پرواز ${option.flightNo} در مسیر ${option.originCode} ← ${option.destCode} درخواست ${dto.seats} صندلی ثبت کرد. روزهای ترجیحی: ${weekdays}. دوره: ${term}.`;

    const recipientCount = await this.cartable.createTasksForRoles(
      ['COMMERCIAL_MANAGER'],
      {
        category: 'AGENCY',
        title: `درخواست خرید ${dto.seats} صندلی · ${option.flightNo}`,
        description,
        senderId: actor.id,
        senderLabelFa: senderLabel,
        sourceType: 'AGENCY_REQUEST',
        sourceId: requestId,
      },
    );
    if (recipientCount === 0) {
      await this.seatRequestRepo.delete({ id: requestId });
      throw new BadRequestException({
        code: ErrorCode.NOT_FOUND,
        message: 'مدیر بازرگانی فعالی برای دریافت درخواست یافت نشد.',
      });
    }
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'AGENCY',
      action: 'ثبت درخواست خرید صندلی آژانس',
      detail: description,
      entityType: 'AgencySeatRequest',
      entityId: requestId,
      metadata: { ...dto, flightNo: option.flightNo },
    });
    return { id: requestId, status: 'SUBMITTED', recipientCount, ...dto };
  }

  // ── Phase 23: real webservice (B2B API) purchase requests ──────────────
  // (replaces AgencyWebservicePage mock's local-only "requested"/"keyShown")

  async assertAgency(actor: AuthenticatedUser) {
    if (await this.isUatSandboxAgencyActor(actor)) return;
    await this.getOwnProfileOrThrow(actor);
  }

  async webservicePlans() {
    const prices = await this.webservicePricing.getPlanPrices();
    return {
      plans: ([1, 3, 12] as const).map((months) => ({
        months,
        // Wire format consistency: every *Irr field is a decimal string in
        // responses (see docs/API.md) — this one is JSON-stored (not a
        // Prisma BigInt column) but still IRR money, so it goes through the
        // same Irr/bigint-string path as every other price field.
        priceIrr: toIrr(prices[months]),
      })),
    };
  }

  async requestWebservice(actor: AuthenticatedUser, dto: RequestWebserviceDto) {
    await this.assertAgencyPortalWritable(actor);
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
    if (await this.isUatSandboxAgencyActor(actor)) return [];
    await this.getOwnProfileOrThrow(actor);
    return this.webserviceRequestRepo.find({
      where: { agencyId: actor.id },
      order: { createdAt: 'DESC' },
    });
  }

  async apiKeys(actor: AuthenticatedUser) {
    if (await this.isUatSandboxAgencyActor(actor)) return [];
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

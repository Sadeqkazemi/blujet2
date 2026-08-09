import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { FarePricingProposal } from '../../database/entities/fare-pricing-proposal.entity';
import { FlightInstance } from '../../database/entities/flight-instance.entity';
import { Flight } from '../../database/entities/flight.entity';
import { Booking } from '../../database/entities/booking.entity';
import { PricingProposalStatus } from '../../database/enums';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ErrorCode } from '../../common/errors';
import {
  PRICE_SUGGESTION_PROVIDER,
  type PriceSuggestionProvider,
} from '../ai/price-suggestion.provider';
import { FlightDefinitionService } from '../flights/flight-definition.service';
import { SearchService } from '../booking-engine/search.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { compareIrr, toIrr } from '../../common/money';
import type { Irr } from '../../common/money';

const LOCKED_MESSAGE =
  'قیمت این پرواز توسط مدیر عامل تأیید و قفل شده است و دیگر قابل تغییر نیست.';

export interface PersistedAiSuggestion {
  priceIrr: number;
  reason: string;
  factors: string[];
  season: string;
  occasion: string;
  confidence: number;
  modelVersion: string;
  generatedAt: string;
}

@Injectable()
export class PricingService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(FarePricingProposal)
    private readonly proposalRepo: Repository<FarePricingProposal>,
    @InjectRepository(FlightInstance)
    private readonly instanceRepo: Repository<FlightInstance>,
    @InjectRepository(Flight)
    private readonly flightRepo: Repository<Flight>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(PRICE_SUGGESTION_PROVIDER)
    private readonly priceSuggestions: PriceSuggestionProvider,
    private readonly definitions: FlightDefinitionService,
    private readonly search: SearchService,
  ) {}

  private withProposalRelations(
    qb: SelectQueryBuilder<FarePricingProposal>,
    alias = 'p',
  ) {
    return qb
      .leftJoinAndSelect(`${alias}.flightInstance`, 'flightInstance')
      .leftJoinAndSelect('flightInstance.flight', 'flight')
      .leftJoinAndSelect('flight.route', 'route')
      .leftJoin(`${alias}.proposedBy`, 'proposedBy')
      .addSelect(['proposedBy.id', 'proposedBy.fullName', 'proposedBy.role'])
      .leftJoin(`${alias}.approvedBy`, 'approvedBy')
      .addSelect(['approvedBy.id', 'approvedBy.fullName', 'approvedBy.role']);
  }

  /** CEO view: pending + registered lists (+ pendingApprovalsCount). */
  async listForCeo() {
    const proposals = await this.withProposalRelations(
      this.proposalRepo.createQueryBuilder('p'),
    )
      .orderBy('p.createdAt', 'DESC')
      .getMany();
    const pending = proposals.filter(
      (p) => p.status === PricingProposalStatus.PENDING,
    );
    return {
      pending,
      registered: proposals.filter(
        (p) => p.status === PricingProposalStatus.REGISTERED,
      ),
      rejected: proposals.filter(
        (p) => p.status === PricingProposalStatus.REJECTED,
      ),
      pendingApprovalsCount: pending.length,
    };
  }

  async pendingApprovalsCount(): Promise<{ pendingApprovalsCount: number }> {
    const count = await this.proposalRepo.count({
      where: { status: PricingProposalStatus.PENDING },
    });
    return { pendingApprovalsCount: count };
  }

  /** Commercial view: upcoming SCHEDULED instances joined with their proposal. */
  async listForCommercial() {
    const instances = await this.instanceRepo
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.flight', 'flight')
      .leftJoinAndSelect('flight.route', 'route')
      .where('fi.status = :status', { status: 'SCHEDULED' })
      .orderBy('fi.departureAt', 'ASC')
      .getMany();

    const proposals = instances.length
      ? await this.withProposalRelations(
          this.proposalRepo.createQueryBuilder('p'),
        )
          .where('p.flightInstanceId IN (:...ids)', {
            ids: instances.map((i) => i.id),
          })
          .getMany()
      : [];
    const proposalByInstanceId = new Map(
      proposals.map((p) => [p.flightInstanceId, p]),
    );

    return {
      flights: instances.map((i) => ({
        ...i,
        pricing: proposalByInstanceId.get(i.id) ?? null,
      })),
    };
  }

  async upsertProposal(
    actor: AuthenticatedUser,
    flightInstanceId: string,
    dto: { proposedPriceIrr: Irr; legalRateIrr?: Irr; note?: string },
  ) {
    const existing = await this.proposalRepo
      .createQueryBuilder('p')
      .where('p.flightInstanceId = :id', { id: flightInstanceId })
      .getOne();
    if (existing?.status === PricingProposalStatus.REGISTERED) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: LOCKED_MESSAGE,
      });
    }

    const proposalId = await this.dataSource.transaction(async (manager) => {
      // Lock the instance row alone — FOR UPDATE + LEFT JOIN fails on Postgres
      // ("nullable side of an outer join"). Relations are not needed here.
      const instance = await manager
        .createQueryBuilder(FlightInstance, 'fi')
        .setLock('pessimistic_write')
        .where('fi.id = :id', { id: flightInstanceId })
        .getOne();
      if (!instance) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'پرواز یافت نشد.',
        });
      }

      const lockedExisting = await manager
        .createQueryBuilder(FarePricingProposal, 'p')
        .where('p.flightInstanceId = :id', { id: flightInstanceId })
        .getOne();

      let savedId: string;
      if (lockedExisting) {
        lockedExisting.proposedPriceIrr = dto.proposedPriceIrr;
        if (dto.legalRateIrr !== undefined) {
          lockedExisting.legalRateIrr = dto.legalRateIrr;
        }
        if (dto.note !== undefined) lockedExisting.note = dto.note;
        lockedExisting.proposedById = actor.id;
        lockedExisting.status = PricingProposalStatus.PENDING;
        lockedExisting.rejectionReason = null;
        lockedExisting.rejectedAt = null;
        lockedExisting.rejectedById = null;
        lockedExisting.aiSuggestion = null;
        if (instance.competitorPriceIrr != null) {
          lockedExisting.competitorPriceIrr = instance.competitorPriceIrr;
        }
        if (instance.basePriceIrr != null) {
          lockedExisting.basePriceIrr = instance.basePriceIrr;
        }
        lockedExisting.updatedAt = new Date();
        const saved = await manager.save(lockedExisting);
        savedId = saved.id;
      } else {
        const basePriceIrr = instance.basePriceIrr ?? dto.proposedPriceIrr;
        const created = await manager.save(
          manager.create(FarePricingProposal, {
            flightInstanceId,
            basePriceIrr,
            competitorPriceIrr: instance.competitorPriceIrr ?? null,
            proposedPriceIrr: dto.proposedPriceIrr,
            legalRateIrr: dto.legalRateIrr,
            note: dto.note,
            proposedById: actor.id,
            status: PricingProposalStatus.PENDING,
            updatedAt: new Date(),
          }),
        );
        savedId = created.id;
      }

      await this.definitions.markPendingCeoInTx(manager, flightInstanceId);
      return savedId;
    });

    const proposal = await this.withProposalRelations(
      this.proposalRepo.createQueryBuilder('p'),
    )
      .where('p.id = :id', { id: proposalId })
      .getOneOrFail();

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'PRICING',
      action: 'ارسال نرخ پیشنهادی پرواز',
      detail: `نرخ پیشنهادی پرواز ${proposal.flightInstance.flight.flightNo} توسط ${actor.fullName} برای تأیید مدیر عامل ارسال شد.`,
      entityType: 'FarePricingProposal',
      entityId: proposal.id,
      metadata: {
        proposedPriceIrr: dto.proposedPriceIrr,
        legalRateIrr: dto.legalRateIrr ?? null,
      },
    });

    return proposal;
  }

  async setLegalRate(actor: AuthenticatedUser, id: string, legalRateIrr: Irr) {
    const proposal = await this.withProposalRelations(
      this.proposalRepo.createQueryBuilder('p'),
    )
      .where('p.id = :id', { id })
      .getOne();
    if (!proposal) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پیشنهاد قیمت یافت نشد.',
      });
    }

    if (proposal.status !== PricingProposalStatus.PENDING) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: LOCKED_MESSAGE,
      });
    }

    const legalRateUpdate = await this.proposalRepo.update(
      { id, status: PricingProposalStatus.PENDING },
      { legalRateIrr, updatedAt: new Date() },
    );
    if ((legalRateUpdate.affected ?? 0) === 0) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: LOCKED_MESSAGE,
      });
    }
    const updated = await this.withProposalRelations(
      this.proposalRepo.createQueryBuilder('p'),
    )
      .where('p.id = :id', { id })
      .getOneOrFail();

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'PRICING',
      action: 'ثبت نرخ قانونی (مصوب)',
      detail: `نرخ قانونی پرواز ${proposal.flightInstance.flight.flightNo} توسط ${actor.fullName} ثبت شد.`,
      entityType: 'FarePricingProposal',
      entityId: id,
      metadata: { legalRateIrr },
    });

    return updated;
  }

  async register(
    actor: AuthenticatedUser,
    id: string,
    source: 'PROPOSED' | 'AI',
  ) {
    const proposal = await this.withProposalRelations(
      this.proposalRepo.createQueryBuilder('p'),
    )
      .where('p.id = :id', { id })
      .getOne();
    if (!proposal) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پیشنهاد قیمت یافت نشد.',
      });
    }
    // Idempotent: a second successful register call just returns the
    // already-registered row, without mutating the active definition again.
    if (proposal.status === PricingProposalStatus.REGISTERED) {
      return proposal;
    }
    if (proposal.status === PricingProposalStatus.REJECTED) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این پیشنهاد رد شده است؛ ابتدا پیشنهاد جدید ارسال کنید.',
      });
    }

    // Conditional update + definition approval in one transaction.
    const registered = await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder(FlightInstance, 'fi')
        .setLock('pessimistic_write')
        .where('fi.id = :id', { id: proposal.flightInstanceId })
        .getOne();

      const lockedProposal = await manager.findOne(FarePricingProposal, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedProposal) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'پیشنهاد قیمت یافت نشد.',
        });
      }
      if (lockedProposal.status === PricingProposalStatus.REGISTERED) {
        return {
          alreadyRegistered: true as const,
          price: lockedProposal.registeredPriceIrr,
        };
      }

      let price: Irr = lockedProposal.proposedPriceIrr;
      if (source === 'AI') {
        const suggestion =
          lockedProposal.aiSuggestion as unknown as PersistedAiSuggestion | null;
        if (!suggestion?.priceIrr) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: 'برای این پیشنهاد تحلیل هوش مصنوعی ثبت نشده است.',
          });
        }
        price = toIrr(suggestion.priceIrr);
        if (
          lockedProposal.legalRateIrr != null &&
          compareIrr(price, lockedProposal.legalRateIrr) > 0
        ) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message:
              'قیمت پیشنهادی هوش مصنوعی از نرخ قانونی (مصوب) بیشتر است و قابل ثبت نیست.',
          });
        }
      }
      if (lockedProposal.status === PricingProposalStatus.REJECTED) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'این پیشنهاد رد شده است؛ ابتدا پیشنهاد جدید ارسال کنید.',
        });
      }

      const updated = await manager.update(
        FarePricingProposal,
        { id, status: PricingProposalStatus.PENDING },
        {
          status: PricingProposalStatus.REGISTERED,
          registeredPriceIrr: price,
          approvedById: actor.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
          rejectionReason: null,
          rejectedAt: null,
          rejectedById: null,
        },
      );
      if ((updated.affected ?? 0) === 0) {
        const raced = await manager.findOne(FarePricingProposal, {
          where: { id },
        });
        if (raced?.status === PricingProposalStatus.REGISTERED) {
          return {
            alreadyRegistered: true as const,
            price: raced.registeredPriceIrr,
          };
        }
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: LOCKED_MESSAGE,
        });
      }

      const { previousLocation } = await this.definitions.applyCeoApprovalInTx(
        manager,
        lockedProposal.flightInstanceId,
        actor.id,
      );
      return { alreadyRegistered: false as const, price, previousLocation };
    });

    if (registered.alreadyRegistered) {
      return this.withProposalRelations(
        this.proposalRepo.createQueryBuilder('p'),
      )
        .where('p.id = :id', { id })
        .getOneOrFail();
    }

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'PRICING',
      action:
        source === 'AI'
          ? 'ثبت قیمت پرواز با پیشنهاد AI'
          : 'تأیید قیمت پیشنهادی بازرگانی',
      detail: `قیمت پرواز ${proposal.flightInstance.flight.flightNo} توسط ${actor.fullName} تأیید و ثبت شد.`,
      entityType: 'FarePricingProposal',
      entityId: id,
      metadata: { registeredPriceIrr: registered.price, source },
    });

    await this.notifications.notify({
      recipientId: proposal.proposedById,
      category: 'APPROVAL',
      action: 'APPROVED',
      title: 'پیشنهاد قیمت شما تأیید شد',
      body: `مدیرعامل قیمت پرواز ${proposal.flightInstance.flight.flightNo} را تأیید و منتشر کرد.`,
      entityType: 'FarePricingProposal',
      entityId: id,
      dedupeKey: `FarePricingProposal:${id}:APPROVED`,
    });

    // Newly APPROVED inventory must appear in search immediately.
    await this.search.invalidateForInstance(proposal.flightInstanceId);
    // A revision may have moved the flight to a different route/date — the
    // OLD listing's cache entry is a separate key and must be busted too,
    // or the flight keeps appearing under its stale former date/route for
    // the rest of the cache TTL.
    if (registered.previousLocation) {
      await this.search.invalidateForRouteDate(
        registered.previousLocation.originCode,
        registered.previousLocation.destCode,
        registered.previousLocation.departureAt,
      );
    }

    return this.withProposalRelations(this.proposalRepo.createQueryBuilder('p'))
      .where('p.id = :id', { id })
      .getOneOrFail();
  }

  async reject(
    actor: AuthenticatedUser,
    id: string,
    dto: {
      rejectionReason: string;
    },
  ) {
    const reason = (dto.rejectionReason ?? '').trim();
    if (!reason) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'دلیل رد الزامی است.',
      });
    }

    const proposal = await this.withProposalRelations(
      this.proposalRepo.createQueryBuilder('p'),
    )
      .where('p.id = :id', { id })
      .getOne();
    if (!proposal) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پیشنهاد قیمت یافت نشد.',
      });
    }
    if (proposal.status === PricingProposalStatus.REJECTED) {
      return proposal;
    }
    if (proposal.status === PricingProposalStatus.REGISTERED) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: LOCKED_MESSAGE,
      });
    }

    const rejected = await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder(FlightInstance, 'fi')
        .setLock('pessimistic_write')
        .where('fi.id = :id', { id: proposal.flightInstanceId })
        .getOne();

      const lockedProposal = await manager.findOne(FarePricingProposal, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedProposal) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'پیشنهاد قیمت یافت نشد.',
        });
      }
      if (lockedProposal.status === PricingProposalStatus.REJECTED) {
        return { alreadyRejected: true as const };
      }
      if (lockedProposal.status === PricingProposalStatus.REGISTERED) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: LOCKED_MESSAGE,
        });
      }

      const updated = await manager.update(
        FarePricingProposal,
        { id, status: PricingProposalStatus.PENDING },
        {
          status: PricingProposalStatus.REJECTED,
          rejectionReason: reason,
          rejectedById: actor.id,
          rejectedAt: new Date(),
          updatedAt: new Date(),
        },
      );
      if ((updated.affected ?? 0) === 0) {
        const raced = await manager.findOne(FarePricingProposal, {
          where: { id },
        });
        if (raced?.status === PricingProposalStatus.REJECTED) {
          return { alreadyRejected: true as const };
        }
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'وضعیت پیشنهاد قابل رد نیست.',
        });
      }

      await this.definitions.applyCeoRejectionInTx(
        manager,
        lockedProposal.flightInstanceId,
        reason,
      );
      return { alreadyRejected: false as const };
    });

    if (rejected.alreadyRejected) {
      return this.withProposalRelations(
        this.proposalRepo.createQueryBuilder('p'),
      )
        .where('p.id = :id', { id })
        .getOneOrFail();
    }

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'PRICING',
      action: 'رد پیشنهاد قیمت پرواز',
      detail: `پیشنهاد قیمت پرواز ${proposal.flightInstance.flight.flightNo} توسط ${actor.fullName} رد شد.`,
      entityType: 'FarePricingProposal',
      entityId: id,
      metadata: { rejectionReason: reason },
    });

    await this.notifications.notify({
      recipientId: proposal.proposedById,
      category: 'APPROVAL',
      action: 'REJECTED',
      title: 'پیشنهاد قیمت شما رد شد',
      body: `مدیرعامل پیشنهاد قیمت پرواز ${proposal.flightInstance.flight.flightNo} را رد کرد: ${reason}`,
      entityType: 'FarePricingProposal',
      entityId: id,
      dedupeKey: `FarePricingProposal:${id}:REJECTED`,
    });

    return this.withProposalRelations(this.proposalRepo.createQueryBuilder('p'))
      .where('p.id = :id', { id })
      .getOneOrFail();
  }

  /**
   * Non-production only: creates a fresh SCHEDULED flight instance so
   * Playwright runs always have an un-priced row to drive (real instance
   * creation belongs to Phase 10's flight management). 404s in production.
   */
  async createTestInstance() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'یافت نشد.',
      });
    }
    const flight = await this.flightRepo.createQueryBuilder('f').getOneOrFail();
    const departureAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
    const created = await this.instanceRepo.save(
      this.instanceRepo.create({
        flightId: flight.id,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 3 * 60 * 60 * 1000),
        capacity: 180,
        charterSeats: 60,
        status: 'SCHEDULED',
      }),
    );
    return this.instanceRepo
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.flight', 'flight')
      .leftJoinAndSelect('flight.route', 'route')
      .where('fi.id = :id', { id: created.id })
      .getOneOrFail();
  }

  /** Runs the advisory ML analysis for every PENDING proposal. Generation
   * never mutates prices/status — only the persisted aiSuggestion blob. */
  async runAiAnalysis(actor: AuthenticatedUser, requestId?: string) {
    const pending = await this.withProposalRelations(
      this.proposalRepo.createQueryBuilder('p'),
    )
      .where('p.status = :status', { status: 'PENDING' })
      .getMany();
    const analyzable = pending.filter((p) => p.competitorPriceIrr != null);
    if (analyzable.length === 0) {
      return { analyzed: 0, available: true };
    }

    const result = await this.priceSuggestions.suggest(
      // ADVISORY-ONLY ML boundary (CLAUDE.md ML Service Rules): the
      // FastAPI service expects plain JSON numbers, and this payload is a
      // one-way outbound signal for a suggestion — never round-tripped
      // back into a stored/authoritative field without going through
      // NestJS's own re-pricing/registration logic above. Individual fare
      // amounts are far below 2^53, so Number() loses no precision here.
      analyzable.map((p) => ({
        proposal_id: p.id,
        origin_code: p.flightInstance.flight.route.originCode,
        dest_code: p.flightInstance.flight.route.destCode,
        departure_at: p.flightInstance.departureAt.toISOString(),
        base_price_irr: Number(p.basePriceIrr),
        competitor_price_irr: Number(p.competitorPriceIrr),
        proposed_price_irr: Number(p.proposedPriceIrr),
        capacity: p.flightInstance.capacity,
        charter_seats: p.flightInstance.charterSeats,
      })),
      requestId,
    );

    // Graceful degradation: service down → documented empty result, no 500.
    if (!result) return { analyzed: 0, available: false };

    const generatedAt = new Date().toISOString();
    const pendingById = new Map(analyzable.map((p) => [p.id, p]));
    for (const s of result.suggestions) {
      const suggestion: PersistedAiSuggestion = {
        priceIrr: s.price_irr,
        reason: s.reason_fa,
        factors: s.factors_fa,
        season: s.season_fa,
        occasion: s.occasion_fa,
        confidence: s.confidence,
        modelVersion: result.model_version,
        generatedAt,
      };
      const target = pendingById.get(s.proposal_id);
      if (!target) continue;
      target.aiSuggestion = suggestion as unknown as typeof target.aiSuggestion;
      target.updatedAt = new Date();
      await this.proposalRepo.save(target);
    }

    // Usage logging per CLAUDE.md AI rules.
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'PRICING',
      action: 'اجرای تحلیل قیمت هوش مصنوعی',
      detail: `تحلیل هوش مصنوعی برای ${result.suggestions.length} پیشنهاد قیمت توسط ${actor.fullName} اجرا شد.`,
      metadata: {
        analyzed: result.suggestions.length,
        modelVersion: result.model_version,
      },
    });

    return { analyzed: result.suggestions.length, available: true };
  }
}

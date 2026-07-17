import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import {
  PRICE_SUGGESTION_PROVIDER,
  type PriceSuggestionProvider,
} from '../ai/price-suggestion.provider';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { Prisma } from '../../../generated/prisma/client';

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
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(PRICE_SUGGESTION_PROVIDER)
    private readonly priceSuggestions: PriceSuggestionProvider,
  ) {}

  private proposalInclude() {
    return {
      flightInstance: {
        include: { flight: { include: { route: true } } },
      },
      proposedBy: { select: { id: true, fullName: true, role: true } },
      approvedBy: { select: { id: true, fullName: true, role: true } },
    } satisfies Prisma.FarePricingProposalInclude;
  }

  /** CEO view: pending + registered lists. */
  async listForCeo() {
    const proposals = await this.prisma.farePricingProposal.findMany({
      include: this.proposalInclude(),
      orderBy: { createdAt: 'desc' },
    });
    return {
      pending: proposals.filter((p) => p.status === 'PENDING'),
      registered: proposals.filter((p) => p.status === 'REGISTERED'),
    };
  }

  /** Commercial view: upcoming SCHEDULED instances joined with their proposal. */
  async listForCommercial() {
    const instances = await this.prisma.flightInstance.findMany({
      where: { status: 'SCHEDULED' },
      include: {
        flight: { include: { route: true } },
        pricing: { include: this.proposalInclude() },
      },
      orderBy: { departureAt: 'asc' },
    });
    return { flights: instances };
  }

  async upsertProposal(
    actor: AuthenticatedUser,
    flightInstanceId: string,
    dto: { proposedPriceIrr: number; legalRateIrr?: number; note?: string },
  ) {
    const instance = await this.prisma.flightInstance.findUnique({
      where: { id: flightInstanceId },
      include: { pricing: true, flight: { include: { route: true } } },
    });
    if (!instance) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پرواز یافت نشد.',
      });
    }
    if (instance.pricing?.status === 'REGISTERED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: LOCKED_MESSAGE,
      });
    }

    // Competitor/base figures come from the flight context for now: base is
    // the design's «قیمت پایهٔ شرکت». Until Phase 10's flight management
    // stores real base/competitor rates, derive base from recent sale prices
    // and competitor from the proposal's own market observation (the design
    // shows both as read-only tiles fed by flight data).
    const recentSale = await this.prisma.booking.findFirst({
      where: { flightInstance: { flightId: instance.flightId } },
      orderBy: { createdAt: 'desc' },
      select: { priceIrr: true },
    });
    const basePriceIrr =
      instance.pricing?.basePriceIrr ??
      recentSale?.priceIrr ??
      dto.proposedPriceIrr;
    const competitorPriceIrr =
      instance.pricing?.competitorPriceIrr ??
      Math.round((basePriceIrr * 1.03) / 100_000) * 100_000;

    const proposal = await this.prisma.farePricingProposal.upsert({
      where: { flightInstanceId },
      create: {
        flightInstanceId,
        basePriceIrr,
        competitorPriceIrr,
        proposedPriceIrr: dto.proposedPriceIrr,
        legalRateIrr: dto.legalRateIrr,
        note: dto.note,
        proposedById: actor.id,
      },
      update: {
        proposedPriceIrr: dto.proposedPriceIrr,
        legalRateIrr: dto.legalRateIrr,
        note: dto.note,
        proposedById: actor.id,
      },
      include: this.proposalInclude(),
    });

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

  async setLegalRate(
    actor: AuthenticatedUser,
    id: string,
    legalRateIrr: number,
  ) {
    const proposal = await this.prisma.farePricingProposal.findUnique({
      where: { id },
      include: this.proposalInclude(),
    });
    if (!proposal) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پیشنهاد قیمت یافت نشد.',
      });
    }

    const updated = await this.prisma.farePricingProposal.update({
      where: { id },
      data: { legalRateIrr },
      include: this.proposalInclude(),
    });

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
    const proposal = await this.prisma.farePricingProposal.findUnique({
      where: { id },
      include: this.proposalInclude(),
    });
    if (!proposal) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'پیشنهاد قیمت یافت نشد.',
      });
    }
    if (proposal.status === 'REGISTERED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: LOCKED_MESSAGE,
      });
    }

    let price = proposal.proposedPriceIrr;
    if (source === 'AI') {
      const suggestion =
        proposal.aiSuggestion as unknown as PersistedAiSuggestion | null;
      if (!suggestion?.priceIrr) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'برای این پیشنهاد تحلیل هوش مصنوعی ثبت نشده است.',
        });
      }
      price = suggestion.priceIrr;
    }

    // Conditional update guards against a concurrent double-register.
    const updated = await this.prisma.farePricingProposal.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'REGISTERED',
        registeredPriceIrr: price,
        approvedById: actor.id,
        approvedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: LOCKED_MESSAGE,
      });
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
      metadata: { registeredPriceIrr: price, source },
    });

    return this.prisma.farePricingProposal.findUniqueOrThrow({
      where: { id },
      include: this.proposalInclude(),
    });
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
    const flight = await this.prisma.flight.findFirstOrThrow();
    const departureAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
    return this.prisma.flightInstance.create({
      data: {
        flightId: flight.id,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 3 * 60 * 60 * 1000),
        capacity: 180,
        charterSeats: 60,
        status: 'SCHEDULED',
      },
      include: { flight: { include: { route: true } } },
    });
  }

  /** Runs the advisory ML analysis for every PENDING proposal. Generation
   * never mutates prices/status — only the persisted aiSuggestion blob. */
  async runAiAnalysis(actor: AuthenticatedUser, requestId?: string) {
    const pending = await this.prisma.farePricingProposal.findMany({
      where: { status: 'PENDING' },
      include: {
        flightInstance: { include: { flight: { include: { route: true } } } },
      },
    });
    if (pending.length === 0) return { analyzed: 0, available: true };

    const result = await this.priceSuggestions.suggest(
      pending.map((p) => ({
        proposal_id: p.id,
        origin_code: p.flightInstance.flight.route.originCode,
        dest_code: p.flightInstance.flight.route.destCode,
        departure_at: p.flightInstance.departureAt.toISOString(),
        base_price_irr: p.basePriceIrr,
        competitor_price_irr: p.competitorPriceIrr,
        proposed_price_irr: p.proposedPriceIrr,
        capacity: p.flightInstance.capacity,
        charter_seats: p.flightInstance.charterSeats,
      })),
      requestId,
    );

    // Graceful degradation: service down → documented empty result, no 500.
    if (!result) return { analyzed: 0, available: false };

    const generatedAt = new Date().toISOString();
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
      await this.prisma.farePricingProposal.update({
        where: { id: s.proposal_id },
        data: { aiSuggestion: suggestion as unknown as Prisma.InputJsonValue },
      });
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

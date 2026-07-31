import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import { materializeSurveyInvites } from './survey-lifecycle.util';
import {
  SURVEY_SUMMARY_PROVIDER,
  type SurveySummaryProvider,
} from '../ai/survey-summary.provider';
import type {
  CreateSurveyQuestionDto,
  SubmitSurveyResponseDto,
  UpdateSurveySettingsDto,
} from './dto/survey.dtos';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

const FALLBACK_SUMMARY = 'خلاصه‌ای از نظرات این پرواز در دسترس نیست.';

@Injectable()
export class SurveyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly audit: AuditService,
    @Inject(SURVEY_SUMMARY_PROVIDER)
    private readonly summaryProvider: SurveySummaryProvider,
  ) {}

  // ── IT_MANAGER configuration ────────────────────────────────────────
  private async getOrCreateSettings() {
    const existing = await this.prisma.surveySettings.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { updatedBy: { select: { fullName: true } } },
    });
    if (existing) return existing;
    return this.prisma.surveySettings.create({
      data: {},
      include: { updatedBy: { select: { fullName: true } } },
    });
  }

  async getSettings() {
    const s = await this.getOrCreateSettings();
    return {
      enabled: s.enabled,
      title: s.title,
      updatedAt: s.updatedAt,
      updatedByLabelFa: s.updatedBy?.fullName ?? null,
    };
  }

  async updateSettings(actor: AuthenticatedUser, dto: UpdateSurveySettingsDto) {
    const current = await this.getOrCreateSettings();
    const updated = await this.prisma.surveySettings.update({
      where: { id: current.id },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        updatedById: actor.id,
      },
      include: { updatedBy: { select: { fullName: true } } },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SURVEY',
      action: 'تغییر تنظیمات نظرسنجی مسافران',
      detail: `${actor.fullName} تنظیمات نظرسنجی را به‌روزرسانی کرد.`,
      entityType: 'SurveySettings',
      entityId: updated.id,
    });
    return {
      enabled: updated.enabled,
      title: updated.title,
      updatedAt: updated.updatedAt,
      updatedByLabelFa: updated.updatedBy?.fullName ?? null,
    };
  }

  async listQuestions() {
    const rows = await this.prisma.surveyQuestion.findMany({
      orderBy: { order: 'asc' },
    });
    return rows.map((q) => ({ id: q.id, label: q.label, order: q.order }));
  }

  async addQuestion(actor: AuthenticatedUser, dto: CreateSurveyQuestionDto) {
    const last = await this.prisma.surveyQuestion.findFirst({
      orderBy: { order: 'desc' },
    });
    const question = await this.prisma.surveyQuestion.create({
      data: { label: dto.label, order: (last?.order ?? -1) + 1 },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SURVEY',
      action: 'افزودن سؤال نظرسنجی',
      detail: `${actor.fullName} سؤال «${dto.label}» را افزود.`,
      entityType: 'SurveyQuestion',
      entityId: question.id,
    });
    return { id: question.id, label: question.label, order: question.order };
  }

  async removeQuestion(actor: AuthenticatedUser, id: string) {
    const question = await this.prisma.surveyQuestion.findUnique({
      where: { id },
    });
    if (!question) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'سؤال یافت نشد.',
      });
    }
    await this.prisma.surveyQuestion.delete({ where: { id } });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SURVEY',
      action: 'حذف سؤال نظرسنجی',
      detail: `${actor.fullName} سؤال «${question.label}» را حذف کرد.`,
      entityType: 'SurveyQuestion',
      entityId: id,
    });
    return { id };
  }

  async getStats() {
    await materializeSurveyInvites(this.prisma, this.sms);

    const [flightsWithSurvey, totalResponses, ratingAgg, recent] =
      await Promise.all([
        this.prisma.surveyInvite
          .findMany({
            where: { response: { isNot: null } },
            select: { flightInstanceId: true },
            distinct: ['flightInstanceId'],
          })
          .then((rows) => rows.length),
        this.prisma.surveyResponse.count(),
        this.prisma.surveyResponse.aggregate({ _avg: { rating: true } }),
        this.prisma.surveyResponse.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            invite: {
              include: {
                flightInstance: {
                  include: { flight: { include: { route: true } } },
                },
              },
            },
          },
        }),
      ]);

    return {
      flightsWithSurvey,
      totalResponses,
      avgRating: ratingAgg._avg.rating
        ? Math.round(ratingAgg._avg.rating * 10) / 10
        : 0,
      recentResponses: recent.map((r) => ({
        id: r.id,
        flightNo: r.invite.flightInstance.flight.flightNo,
        route: `${r.invite.flightInstance.flight.route.originCityFa} — ${r.invite.flightInstance.flight.route.destCityFa}`,
        rating: r.rating,
        comment: r.comment,
        at: r.createdAt,
      })),
    };
  }

  // ── Public token-based submission ───────────────────────────────────
  private async findInviteByToken(token: string) {
    const invite = await this.prisma.surveyInvite.findUnique({
      where: { token },
      include: {
        response: true,
        flightInstance: { include: { flight: { include: { route: true } } } },
        booking: { select: { status: true } },
      },
    });
    // A booking later marked NO_SHOW never actually flew — its invite is
    // treated exactly like an unknown token (same generic message, no
    // oracle on the booking's internal status) rather than a distinct
    // error, so a no-show passenger (or anyone holding the link) can no
    // longer submit — or even see — a rating for a flight they didn't
    // take.
    if (!invite || invite.booking.status === 'NO_SHOW') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'لینک نظرسنجی معتبر نیست.',
      });
    }
    return invite;
  }

  async getPublicInvite(token: string) {
    const invite = await this.findInviteByToken(token);
    const settings = await this.getOrCreateSettings();
    if (!settings.enabled) {
      throw new ConflictException({
        code: ErrorCode.SURVEY_DISABLED,
        message: 'نظرسنجی در حال حاضر غیرفعال است.',
      });
    }
    if (invite.response) {
      throw new ConflictException({
        code: ErrorCode.SURVEY_ALREADY_SUBMITTED,
        message: 'شما قبلاً به این نظرسنجی پاسخ داده‌اید.',
      });
    }
    const [questions, originAirport, destAirport] = await Promise.all([
      this.listQuestions(),
      this.prisma.airport.findUnique({
        where: { code: invite.flightInstance.flight.route.originCode },
      }),
      this.prisma.airport.findUnique({
        where: { code: invite.flightInstance.flight.route.destCode },
      }),
    ]);
    return {
      title: settings.title,
      questions,
      flightNo: invite.flightInstance.flight.flightNo,
      originCityFa:
        originAirport?.cityFa ?? invite.flightInstance.flight.route.originCode,
      destCityFa:
        destAirport?.cityFa ?? invite.flightInstance.flight.route.destCode,
      departureAt: invite.flightInstance.departureAt,
    };
  }

  async submitResponse(token: string, dto: SubmitSurveyResponseDto) {
    const invite = await this.findInviteByToken(token);
    const settings = await this.getOrCreateSettings();
    if (!settings.enabled) {
      throw new ConflictException({
        code: ErrorCode.SURVEY_DISABLED,
        message: 'نظرسنجی در حال حاضر غیرفعال است.',
      });
    }
    if (invite.response) {
      throw new ConflictException({
        code: ErrorCode.SURVEY_ALREADY_SUBMITTED,
        message: 'شما قبلاً به این نظرسنجی پاسخ داده‌اید.',
      });
    }
    await this.prisma.$transaction([
      this.prisma.surveyResponse.create({
        data: {
          inviteId: invite.id,
          rating: dto.rating,
          comment: dto.comment,
        },
      }),
      this.prisma.surveyInvite.update({
        where: { id: invite.id },
        data: { respondedAt: new Date() },
      }),
    ]);
    return { submitted: true };
  }

  // ── Exec read-only results + AI summary ─────────────────────────────
  async getResults() {
    await materializeSurveyInvites(this.prisma, this.sms);
    const settings = await this.getOrCreateSettings();
    if (!settings.enabled) {
      return { disabled: true as const, flights: [] };
    }

    // Real DB-level aggregation (count/avg computed by Postgres, not by
    // loading every historical response into Node) — this endpoint is
    // hit on every load of three different exec panels, so it must stay
    // bounded by the number of *surveyed flights*, not the number of
    // responses ever submitted.
    const grouped = await this.prisma.$queryRaw<
      { flightInstanceId: string; count: number; avgRating: number }[]
    >`
      SELECT si."flightInstanceId" AS "flightInstanceId",
             COUNT(*)::int AS "count",
             AVG(sr.rating)::float8 AS "avgRating"
      FROM survey_invites si
      JOIN survey_responses sr ON sr."inviteId" = si.id
      GROUP BY si."flightInstanceId"
    `;
    if (grouped.length === 0) {
      return { disabled: false as const, flights: [] };
    }

    const instances = await this.prisma.flightInstance.findMany({
      where: { id: { in: grouped.map((g) => g.flightInstanceId) } },
      include: { flight: { include: { route: true } } },
    });
    const instanceById = new Map(instances.map((i) => [i.id, i]));

    const airportCodes = new Set<string>();
    for (const i of instances) {
      airportCodes.add(i.flight.route.originCode);
      airportCodes.add(i.flight.route.destCode);
    }
    const airports = await this.prisma.airport.findMany({
      where: { code: { in: [...airportCodes] } },
    });
    const cityFa = new Map(airports.map((a) => [a.code, a.cityFa]));

    const flights = grouped
      .map((g) => {
        const instance = instanceById.get(g.flightInstanceId);
        if (!instance) return null;
        return {
          flightInstanceId: g.flightInstanceId,
          flightNo: instance.flight.flightNo,
          originCityFa:
            cityFa.get(instance.flight.route.originCode) ??
            instance.flight.route.originCode,
          destCityFa:
            cityFa.get(instance.flight.route.destCode) ??
            instance.flight.route.destCode,
          departureAt: instance.departureAt,
          count: g.count,
          avgRating: Math.round(g.avgRating * 10) / 10,
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);
    flights.sort((a, b) => b.departureAt.getTime() - a.departureAt.getTime());

    return { disabled: false as const, flights };
  }

  async analyzeFlight(flightInstanceId: string, actor: AuthenticatedUser) {
    const invites = await this.prisma.surveyInvite.findMany({
      where: { flightInstanceId, response: { isNot: null } },
      include: { response: true },
    });
    const comments = invites
      .map((i) => i.response!.comment)
      .filter((c): c is string => !!c && c.trim().length > 0);

    const result = await this.summaryProvider.summarize(comments);
    if (!result) {
      return { summary: FALLBACK_SUMMARY };
    }

    await this.prisma.aiUsageLog.create({
      data: {
        provider: 'survey-summary',
        userId: actor.id,
        contextId: flightInstanceId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });

    return { summary: result.summary };
  }
}

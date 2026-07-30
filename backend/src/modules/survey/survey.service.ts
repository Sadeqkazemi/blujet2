import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TypeORMService } from '../../typeorm/typeorm.service';
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
    private readonly typeorm: TypeORMService,
    private readonly sms: SmsService,
    private readonly audit: AuditService,
    @Inject(SURVEY_SUMMARY_PROVIDER)
    private readonly summaryProvider: SurveySummaryProvider,
  ) {}

  // ── IT_MANAGER configuration ────────────────────────────────────────
  private async getOrCreateSettings() {
    const existing = await this.typeorm.surveySettings.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { updatedBy: { select: { fullName: true } } },
    });
    if (existing) return existing;
    return this.typeorm.surveySettings.create({
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
    const updated = await this.typeorm.surveySettings.update({
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
    const rows = await this.typeorm.surveyQuestion.findMany({
      orderBy: { order: 'asc' },
    });
    return rows.map((q) => ({ id: q.id, label: q.label, order: q.order }));
  }

  async addQuestion(actor: AuthenticatedUser, dto: CreateSurveyQuestionDto) {
    const last = await this.typeorm.surveyQuestion.findFirst({
      orderBy: { order: 'desc' },
    });
    const question = await this.typeorm.surveyQuestion.create({
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
    const question = await this.typeorm.surveyQuestion.findUnique({
      where: { id },
    });
    if (!question) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'سؤال یافت نشد.',
      });
    }
    await this.typeorm.surveyQuestion.delete({ where: { id } });
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
    await materializeSurveyInvites(this.typeorm, this.sms);

    const [flightsWithSurvey, totalResponses, ratingAgg, recent] =
      await Promise.all([
        this.typeorm.surveyInvite
          .findMany({
            where: { response: { isNot: null } },
            select: { flightInstanceId: true },
            distinct: ['flightInstanceId'],
          })
          .then((rows) => rows.length),
        this.typeorm.surveyResponse.count(),
        this.typeorm.surveyResponse.aggregate({ _avg: { rating: true } }),
        this.typeorm.surveyResponse.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            invite: {
              include: { flightInstance: { include: { flight: true } } },
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
        rating: r.rating,
        comment: r.comment,
        at: r.createdAt,
      })),
    };
  }

  // ── Public token-based submission ───────────────────────────────────
  private async findInviteByToken(token: string) {
    const invite = await this.typeorm.surveyInvite.findUnique({
      where: { token },
      include: {
        response: true,
        flightInstance: { include: { flight: { include: { route: true } } } },
      },
    });
    if (!invite) {
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
      this.typeorm.airport.findUnique({
        where: { code: invite.flightInstance.flight.route.originCode },
      }),
      this.typeorm.airport.findUnique({
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
    await this.typeorm.$transaction([
      this.typeorm.surveyResponse.create({
        data: {
          inviteId: invite.id,
          rating: dto.rating,
          comment: dto.comment,
        },
      }),
      this.typeorm.surveyInvite.update({
        where: { id: invite.id },
        data: { respondedAt: new Date() },
      }),
    ]);
    return { submitted: true };
  }

  // ── Exec read-only results + AI summary ─────────────────────────────
  async getResults() {
    await materializeSurveyInvites(this.typeorm, this.sms);
    const settings = await this.getOrCreateSettings();
    if (!settings.enabled) {
      return { disabled: true as const, flights: [] };
    }

    const invites = await this.typeorm.surveyInvite.findMany({
      where: { response: { isNot: null } },
      include: {
        response: true,
        flightInstance: { include: { flight: { include: { route: true } } } },
      },
    });

    const byInstance = new Map<string, typeof invites>();
    for (const invite of invites) {
      const list = byInstance.get(invite.flightInstanceId) ?? [];
      list.push(invite);
      byInstance.set(invite.flightInstanceId, list);
    }

    const airportCodes = new Set<string>();
    for (const list of byInstance.values()) {
      const route = list[0].flightInstance.flight.route;
      airportCodes.add(route.originCode);
      airportCodes.add(route.destCode);
    }
    const airports = await this.typeorm.airport.findMany({
      where: { code: { in: [...airportCodes] } },
    });
    const cityFa = new Map(airports.map((a) => [a.code, a.cityFa]));

    const flights = [...byInstance.entries()].map(
      ([flightInstanceId, list]) => {
        const first = list[0].flightInstance;
        const ratings = list.map((i) => i.response!.rating);
        const avgRating =
          Math.round(
            (ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10,
          ) / 10;
        return {
          flightInstanceId,
          flightNo: first.flight.flightNo,
          originCityFa:
            cityFa.get(first.flight.route.originCode) ??
            first.flight.route.originCode,
          destCityFa:
            cityFa.get(first.flight.route.destCode) ??
            first.flight.route.destCode,
          departureAt: first.departureAt,
          count: list.length,
          avgRating,
        };
      },
    );
    flights.sort((a, b) => b.departureAt.getTime() - a.departureAt.getTime());

    return { disabled: false as const, flights };
  }

  async analyzeFlight(flightInstanceId: string, actor: AuthenticatedUser) {
    const invites = await this.typeorm.surveyInvite.findMany({
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

    await this.typeorm.aiUsageLog.create({
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

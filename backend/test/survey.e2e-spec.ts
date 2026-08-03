import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import * as crypto from 'node:crypto';
import { TypeORMClient } from '../generated/typeorm/client';
import { TypeORMPg } from '@typeorm/adapter-pg';
import { createTestApp } from './helpers/app.helper';
import { loginAs } from './helpers/login.helper';

const typeorm = new TypeORMClient({
  adapter: new TypeORMPg({ connectionString: process.env.DATABASE_URL }),
});

/** Phase 66 — نظرسنجی مسافران: IT_MANAGER config, lazy invite creation +
 * SMS on FLOWN, public token submission, and CEO/SENIOR_MANAGER/
 * BOARD_CHAIR read-only results + AI summary. See docs/API.md. */
describe('Survey (e2e)', () => {
  let app: INestApplication<App>;
  const FLIGHT_NO = 'SVY-1';
  let flightId: string;
  const createdInstanceIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdQuestionIds: string[] = [];

  function auth(token: string | null | undefined) {
    return { Authorization: `Bearer ${token}` };
  }

  beforeAll(async () => {
    const route = await typeorm.route.upsert({
      where: { originCode_destCode: { originCode: 'THR', destCode: 'KIH' } },
      update: {},
      create: { originCode: 'THR', destCode: 'KIH', durationMin: 70 },
    });
    const flight = await typeorm.flight.upsert({
      where: { flightNo: FLIGHT_NO },
      update: {},
      create: {
        flightNo: FLIGHT_NO,
        routeId: route.id,
        aircraftType: 'SVY-Jet',
      },
    });
    flightId = flight.id;
  });

  // Fresh app per test — avoids leaking the shared login-route throttle
  // budget across tests (same reason club.e2e-spec.ts/panels.e2e-spec.ts
  // do this); this file logs in as many different staff users.
  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await typeorm.surveyResponse.deleteMany({
      where: { invite: { bookingId: { in: createdBookingIds } } },
    });
    await typeorm.surveyInvite.deleteMany({
      where: { bookingId: { in: createdBookingIds } },
    });
    await typeorm.surveyQuestion.deleteMany({
      where: { id: { in: createdQuestionIds } },
    });
    await typeorm.booking.deleteMany({
      where: { id: { in: createdBookingIds } },
    });
    await typeorm.flightInstance.deleteMany({
      where: { id: { in: createdInstanceIds } },
    });
    await typeorm.flight.deleteMany({ where: { id: flightId } });
    await typeorm.surveySettings.updateMany({ data: { enabled: true } });

    await typeorm.$disconnect();
  });

  async function makeFlownBooking(overrides?: {
    contactPhone?: string | null;
  }) {
    const departureAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const instance = await typeorm.flightInstance.create({
      data: {
        flightId,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 70 * 60 * 1000),
        capacity: 10,
        status: 'DEPARTED',
      },
    });
    createdInstanceIds.push(instance.id);

    const booking = await typeorm.booking.create({
      data: {
        pnr: `SVY${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        flightInstanceId: instance.id,
        channel: 'SYSTEM',
        status: 'FLOWN',
        priceIrr: 1_000_000,
        contactPhone:
          overrides?.contactPhone === undefined
            ? '09120000000'
            : overrides.contactPhone,
      },
    });
    createdBookingIds.push(booking.id);
    return { instance, booking };
  }

  describe('IT_MANAGER configuration', () => {
    it('GET/PATCH /survey/settings — IT_MANAGER only, others get 403', async () => {
      const it = await loginAs(app, 'itadmin');
      const getRes = await request(app.getHttpServer())
        .get('/survey/settings')
        .set(auth(it.accessToken));
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.enabled).toBe(true);

      const patchRes = await request(app.getHttpServer())
        .patch('/survey/settings')
        .set(auth(it.accessToken))
        .send({ title: 'نظرسنجی رضایت مسافران بلوجت' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.title).toBe('نظرسنجی رضایت مسافران بلوجت');
      expect(patchRes.body.data.updatedByLabelFa).toBeTruthy();

      const auditRow = await typeorm.auditLog.findFirst({
        where: { entityType: 'SurveySettings' },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditRow?.category).toBe('SURVEY');

      const ceo = await loginAs(app, 'ceo');
      const forbidden = await request(app.getHttpServer())
        .get('/survey/settings')
        .set(auth(ceo.accessToken));
      expect(forbidden.status).toBe(403);
    });

    it('POST/DELETE /survey/questions — add, list, remove, 404 for unknown id', async () => {
      const it = await loginAs(app, 'itadmin');
      const before = await request(app.getHttpServer())
        .get('/survey/questions')
        .set(auth(it.accessToken));
      expect(before.body.data.length).toBe(5);

      const created = await request(app.getHttpServer())
        .post('/survey/questions')
        .set(auth(it.accessToken))
        .send({ label: 'کیفیت اینترنت پرواز' });
      expect(created.status).toBe(201);
      createdQuestionIds.push(created.body.data.id as string);
      expect(created.body.data.order).toBe(5);

      const removed = await request(app.getHttpServer())
        .delete(`/survey/questions/${created.body.data.id}`)
        .set(auth(it.accessToken));
      expect(removed.status).toBe(200);

      const missing = await request(app.getHttpServer())
        .delete(`/survey/questions/${created.body.data.id}`)
        .set(auth(it.accessToken));
      expect(missing.status).toBe(404);
    });
  });

  describe('lazy invite creation + SMS', () => {
    it('a FLOWN booking gets exactly one SurveyInvite + SMS on the next stats read, idempotently', async () => {
      const { booking } = await makeFlownBooking();
      const it = await loginAs(app, 'itadmin');

      const first = await request(app.getHttpServer())
        .get('/survey/stats')
        .set(auth(it.accessToken));
      expect(first.status).toBe(200);

      const invite = await typeorm.surveyInvite.findUnique({
        where: { bookingId: booking.id },
      });
      expect(invite).not.toBeNull();
      expect(invite?.smsSentAt).not.toBeNull();

      await request(app.getHttpServer())
        .get('/survey/stats')
        .set(auth(it.accessToken));
      const count = await typeorm.surveyInvite.count({
        where: { bookingId: booking.id },
      });
      expect(count).toBe(1);
    });

    it('does not create an invite while the survey is disabled', async () => {
      const it = await loginAs(app, 'itadmin');
      await request(app.getHttpServer())
        .patch('/survey/settings')
        .set(auth(it.accessToken))
        .send({ enabled: false });

      const { booking } = await makeFlownBooking();
      await request(app.getHttpServer())
        .get('/survey/stats')
        .set(auth(it.accessToken));

      const invite = await typeorm.surveyInvite.findUnique({
        where: { bookingId: booking.id },
      });
      expect(invite).toBeNull();

      await request(app.getHttpServer())
        .patch('/survey/settings')
        .set(auth(it.accessToken))
        .send({ enabled: true });
    });

    it('a missing contact phone does not throw — invite is still created, just never sent', async () => {
      const { booking } = await makeFlownBooking({ contactPhone: null });
      const it = await loginAs(app, 'itadmin');

      const res = await request(app.getHttpServer())
        .get('/survey/stats')
        .set(auth(it.accessToken));
      expect(res.status).toBe(200);

      const invite = await typeorm.surveyInvite.findUnique({
        where: { bookingId: booking.id },
      });
      expect(invite).not.toBeNull();
      expect(invite?.smsSentAt).toBeNull();
    });

    it('retries the SMS on the next materialize() for an invite whose first send never confirmed', async () => {
      const { booking } = await makeFlownBooking();
      // Simulate a prior run where the invite row was created but the SMS
      // send itself failed/crashed before smsSentAt could be set.
      await typeorm.surveyInvite.create({
        data: {
          bookingId: booking.id,
          flightInstanceId: booking.flightInstanceId,
        },
      });
      const it = await loginAs(app, 'itadmin');

      await request(app.getHttpServer())
        .get('/survey/stats')
        .set(auth(it.accessToken));

      const invite = await typeorm.surveyInvite.findUniqueOrThrow({
        where: { bookingId: booking.id },
      });
      expect(invite.smsSentAt).not.toBeNull();
    });
  });

  describe('public token-based submission', () => {
    it('GET unknown token 404s', async () => {
      const res = await request(app.getHttpServer()).get(
        '/survey/00000000-0000-0000-0000-000000000000',
      );
      expect(res.status).toBe(404);
    });

    it('a booking later marked NO_SHOW revokes its already-issued invite (404, not answerable)', async () => {
      const { booking } = await makeFlownBooking();
      const it = await loginAs(app, 'itadmin');
      await request(app.getHttpServer())
        .get('/survey/stats')
        .set(auth(it.accessToken));
      const invite = await typeorm.surveyInvite.findUniqueOrThrow({
        where: { bookingId: booking.id },
      });

      await typeorm.booking.update({
        where: { id: booking.id },
        data: { status: 'NO_SHOW' },
      });

      const getRes = await request(app.getHttpServer()).get(
        `/survey/${invite.token}`,
      );
      expect(getRes.status).toBe(404);

      const postRes = await request(app.getHttpServer())
        .post(`/survey/${invite.token}`)
        .send({ rating: 5 });
      expect(postRes.status).toBe(404);
    });

    it('GET returns the question list + flight context; POST submits; a second POST 409s', async () => {
      const { booking } = await makeFlownBooking();
      const it = await loginAs(app, 'itadmin');
      await request(app.getHttpServer())
        .get('/survey/stats')
        .set(auth(it.accessToken));
      const invite = await typeorm.surveyInvite.findUniqueOrThrow({
        where: { bookingId: booking.id },
      });

      const getRes = await request(app.getHttpServer()).get(
        `/survey/${invite.token}`,
      );
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.flightNo).toBe(FLIGHT_NO);
      expect(getRes.body.data.questions.length).toBeGreaterThanOrEqual(5);

      const badRating = await request(app.getHttpServer())
        .post(`/survey/${invite.token}`)
        .send({ rating: 9 });
      expect(badRating.status).toBe(400);

      const submit = await request(app.getHttpServer())
        .post(`/survey/${invite.token}`)
        .send({ rating: 5, comment: 'پرواز خوبی بود' });
      expect(submit.status).toBe(201);

      const again = await request(app.getHttpServer())
        .post(`/survey/${invite.token}`)
        .send({ rating: 4 });
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('SURVEY_ALREADY_SUBMITTED');

      const getAfter = await request(app.getHttpServer()).get(
        `/survey/${invite.token}`,
      );
      expect(getAfter.status).toBe(409);
      expect(getAfter.body.error.code).toBe('SURVEY_ALREADY_SUBMITTED');
    });

    it('GET/POST 409 SURVEY_DISABLED while the survey is off', async () => {
      const { booking } = await makeFlownBooking();
      const it = await loginAs(app, 'itadmin');
      await request(app.getHttpServer())
        .get('/survey/stats')
        .set(auth(it.accessToken));
      const invite = await typeorm.surveyInvite.findUniqueOrThrow({
        where: { bookingId: booking.id },
      });

      await request(app.getHttpServer())
        .patch('/survey/settings')
        .set(auth(it.accessToken))
        .send({ enabled: false });

      const getRes = await request(app.getHttpServer()).get(
        `/survey/${invite.token}`,
      );
      expect(getRes.status).toBe(409);
      expect(getRes.body.error.code).toBe('SURVEY_DISABLED');

      const postRes = await request(app.getHttpServer())
        .post(`/survey/${invite.token}`)
        .send({ rating: 3 });
      expect(postRes.status).toBe(409);
      expect(postRes.body.error.code).toBe('SURVEY_DISABLED');

      await request(app.getHttpServer())
        .patch('/survey/settings')
        .set(auth(it.accessToken))
        .send({ enabled: true });
    });
  });

  describe('exec read-only results + AI summary', () => {
    it('GET /survey/results — 200 for CEO/SENIOR_MANAGER/BOARD_CHAIR with the real flight row', async () => {
      const { booking } = await makeFlownBooking();
      const it = await loginAs(app, 'itadmin');
      await request(app.getHttpServer())
        .get('/survey/stats')
        .set(auth(it.accessToken));
      const invite = await typeorm.surveyInvite.findUniqueOrThrow({
        where: { bookingId: booking.id },
      });
      await request(app.getHttpServer())
        .post(`/survey/${invite.token}`)
        .send({ rating: 5, comment: 'عالی بود' });

      for (const username of ['ceo', 'senior.rahimi', 'chair']) {
        const { accessToken } = await loginAs(app, username);
        const res = await request(app.getHttpServer())
          .get('/survey/results')
          .set(auth(accessToken));
        expect(res.status).toBe(200);
        expect(res.body.data.disabled).toBe(false);
        const row = res.body.data.flights.find(
          (f: { flightInstanceId: string }) =>
            f.flightInstanceId === invite.flightInstanceId,
        );
        expect(row).toBeTruthy();
        expect(row.flightNo).toBe(FLIGHT_NO);
      }
    });

    it('GET /survey/results — 403 for IT_MANAGER/FINANCE_MANAGER/COMMERCIAL_MANAGER', async () => {
      for (const username of ['itadmin', 'finance', 'comm.abbasi']) {
        const { accessToken } = await loginAs(app, username);
        const res = await request(app.getHttpServer())
          .get('/survey/results')
          .set(auth(accessToken));
        expect(res.status).toBe(403);
      }
    });

    it('GET /survey/results returns disabled:true + an empty list while the survey is off', async () => {
      const it = await loginAs(app, 'itadmin');
      await request(app.getHttpServer())
        .patch('/survey/settings')
        .set(auth(it.accessToken))
        .send({ enabled: false });

      const ceo = await loginAs(app, 'ceo');
      const res = await request(app.getHttpServer())
        .get('/survey/results')
        .set(auth(ceo.accessToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ disabled: true, flights: [] });

      await request(app.getHttpServer())
        .patch('/survey/settings')
        .set(auth(it.accessToken))
        .send({ enabled: true });
    });

    it('POST /survey/results/:flightInstanceId/analyze falls back gracefully when ANTHROPIC_API_KEY is unset, and writes no AiUsageLog row', async () => {
      const { booking } = await makeFlownBooking();
      const it = await loginAs(app, 'itadmin');
      await request(app.getHttpServer())
        .get('/survey/stats')
        .set(auth(it.accessToken));
      const invite = await typeorm.surveyInvite.findUniqueOrThrow({
        where: { bookingId: booking.id },
      });
      await request(app.getHttpServer())
        .post(`/survey/${invite.token}`)
        .send({ rating: 2, comment: 'صندلی راحت نبود' });

      const logsBefore = await typeorm.aiUsageLog.count({
        where: { provider: 'survey-summary' },
      });

      const ceo = await loginAs(app, 'ceo');
      const res = await request(app.getHttpServer())
        .post(`/survey/results/${invite.flightInstanceId}/analyze`)
        .set(auth(ceo.accessToken));
      expect(res.status).toBe(201);
      expect(res.body.data.summary).toBe(
        'خلاصه‌ای از نظرات این پرواز در دسترس نیست.',
      );

      const logsAfter = await typeorm.aiUsageLog.count({
        where: { provider: 'survey-summary' },
      });
      expect(logsAfter).toBe(logsBefore);

      const it2 = await loginAs(app, 'itadmin');
      const forbidden = await request(app.getHttpServer())
        .post(`/survey/results/${invite.flightInstanceId}/analyze`)
        .set(auth(it2.accessToken));
      expect(forbidden.status).toBe(403);
    });
  });
});

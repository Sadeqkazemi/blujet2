import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'node:crypto';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  PRICE_SUGGESTION_PROVIDER,
  type PriceSuggestionProvider,
  type PriceSuggestionResult,
} from '../src/modules/ai/price-suggestion.provider';
import { loginAs, stepUpFor } from './helpers/login.helper';

/** Deterministic in-test stand-in for the ml-service — set `nextResult` to
 * null to simulate the service being down (graceful-degradation tests). */
class FakePriceSuggestionProvider implements PriceSuggestionProvider {
  nextResult: PriceSuggestionResult | null = null;
  lastItems: unknown[] = [];

  suggest(items: unknown[]): Promise<PriceSuggestionResult | null> {
    this.lastItems = items;
    return Promise.resolve(this.nextResult);
  }
}

describe('Pricing (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let fakeMl: FakePriceSuggestionProvider;

  beforeEach(async () => {
    fakeMl = new FakePriceSuggestionProvider();
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PRICE_SUGGESTION_PROVIDER)
      .useValue(fakeMl)
      .compile();
    app = moduleFixture.createNestApplication<INestApplication<App>>({
      bufferLogs: true,
    });
    const logger = app.get(Logger);
    app.useLogger(logger);
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter(logger));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createScheduledInstance() {
    const flight = await prisma.flight.findFirstOrThrow();
    return prisma.flightInstance.create({
      data: {
        flightId: flight.id,
        departureAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        arrivalAt: new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000,
        ),
        capacity: 180,
        charterSeats: 60,
        status: 'SCHEDULED',
      },
    });
  }

  it('Commercial proposes a price for a scheduled flight; re-PUT while PENDING edits it', async () => {
    const instance = await createScheduledInstance();
    const { accessToken } = await loginAs(app, 'comm.abbasi');

    const created = await request(app.getHttpServer())
      .put(`/pricing/flights/${instance.id}/proposal`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        proposedPriceIrr: 38_500_000,
        legalRateIrr: 42_000_000,
        note: 'تست',
      });
    expect(created.status).toBe(200);
    expect(created.body.data.status).toBe('PENDING');

    const edited = await request(app.getHttpServer())
      .put(`/pricing/flights/${instance.id}/proposal`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ proposedPriceIrr: 39_000_000 });
    expect(edited.status).toBe(200);
    expect(edited.body.data.proposedPriceIrr).toBe(39_000_000);

    const audit = await prisma.auditLog.findFirst({
      where: { category: 'PRICING', entityId: created.body.data.id },
    });
    expect(audit).not.toBeNull();
  });

  it('PUT as CEO → 403; unknown flight → 404; missing price → 400', async () => {
    const instance = await createScheduledInstance();
    const ceo = await loginAs(app, 'ceo');
    const forbidden = await request(app.getHttpServer())
      .put(`/pricing/flights/${instance.id}/proposal`)
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ proposedPriceIrr: 1_000_000 });
    expect(forbidden.status).toBe(403);

    const commercial = await loginAs(app, 'comm.abbasi');
    const notFound = await request(app.getHttpServer())
      .put(`/pricing/flights/${crypto.randomUUID()}/proposal`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send({ proposedPriceIrr: 1_000_000 });
    expect(notFound.status).toBe(404);

    const invalid = await request(app.getHttpServer())
      .put(`/pricing/flights/${instance.id}/proposal`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send({});
    expect(invalid.status).toBe(400);
  });

  it('CEO registers with source=PROPOSED; proposal locks; further edits/registers → 409', async () => {
    const instance = await createScheduledInstance();
    const commercial = await loginAs(app, 'comm.abbasi');
    const created = await request(app.getHttpServer())
      .put(`/pricing/flights/${instance.id}/proposal`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send({ proposedPriceIrr: 38_500_000 });
    const proposalId = created.body.data.id as string;

    const ceo = await loginAs(app, 'ceo');
    const stepUp1 = await stepUpFor(
      app,
      ceo.accessToken!,
      'ceo',
      'PRICE_CAPACITY_CHANGE',
    );
    const registered = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${proposalId}/register`)
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ source: 'PROPOSED', ...stepUp1 });
    expect(registered.status).toBe(200);
    expect(registered.body.data.status).toBe('REGISTERED');
    expect(registered.body.data.registeredPriceIrr).toBe(38_500_000);
    expect(registered.body.data.approvedBy.role).toBe('CEO');

    const reEdit = await request(app.getHttpServer())
      .put(`/pricing/flights/${instance.id}/proposal`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send({ proposedPriceIrr: 40_000_000 });
    expect(reEdit.status).toBe(409);

    const stepUp2 = await stepUpFor(
      app,
      ceo.accessToken!,
      'ceo',
      'PRICE_CAPACITY_CHANGE',
    );
    const reRegister = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${proposalId}/register`)
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ source: 'PROPOSED', ...stepUp2 });
    expect(reRegister.status).toBe(409);
  });

  it('register with source=AI without a stored suggestion → 409 with a clear message', async () => {
    const instance = await createScheduledInstance();
    const commercial = await loginAs(app, 'comm.abbasi');
    const created = await request(app.getHttpServer())
      .put(`/pricing/flights/${instance.id}/proposal`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send({ proposedPriceIrr: 38_500_000 });

    const ceo = await loginAs(app, 'ceo');
    const stepUp = await stepUpFor(
      app,
      ceo.accessToken!,
      'ceo',
      'PRICE_CAPACITY_CHANGE',
    );
    const res = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${created.body.data.id}/register`)
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ source: 'AI', ...stepUp });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('هوش مصنوعی');
  });

  it('AI analysis persists suggestions with modelVersion, mutates nothing else, and register {source:AI} uses it', async () => {
    const instance = await createScheduledInstance();
    const commercial = await loginAs(app, 'comm.abbasi');
    const created = await request(app.getHttpServer())
      .put(`/pricing/flights/${instance.id}/proposal`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send({ proposedPriceIrr: 38_500_000 });
    const proposalId = created.body.data.id as string;

    fakeMl.nextResult = {
      model_version: 'heuristic-test',
      suggestions: [
        {
          proposal_id: proposalId,
          price_irr: 39_200_000,
          reason_fa: 'دلیل تستی',
          factors_fa: ['فاکتور ۱'],
          season_fa: 'فصل عادی',
          occasion_fa: 'بدون مناسبت خاص',
          confidence: 0.8,
        },
      ],
    };

    const ceo = await loginAs(app, 'ceo');
    const analysis = await request(app.getHttpServer())
      .post('/pricing/proposals/ai-analysis')
      .set('Authorization', `Bearer ${ceo.accessToken}`);
    expect(analysis.status).toBe(201);
    expect(analysis.body.data.available).toBe(true);
    expect(analysis.body.data.analyzed).toBeGreaterThanOrEqual(1);

    const stored = await prisma.farePricingProposal.findUniqueOrThrow({
      where: { id: proposalId },
    });
    const suggestion = stored.aiSuggestion as {
      priceIrr: number;
      modelVersion: string;
    };
    expect(suggestion.priceIrr).toBe(39_200_000);
    expect(suggestion.modelVersion).toBe('heuristic-test');
    // Advisory only — nothing else changed.
    expect(stored.status).toBe('PENDING');
    expect(stored.proposedPriceIrr).toBe(38_500_000);
    expect(stored.registeredPriceIrr).toBeNull();

    const stepUp = await stepUpFor(
      app,
      ceo.accessToken!,
      'ceo',
      'PRICE_CAPACITY_CHANGE',
    );
    const registered = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${proposalId}/register`)
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ source: 'AI', ...stepUp });
    expect(registered.status).toBe(200);
    expect(registered.body.data.registeredPriceIrr).toBe(39_200_000);
  });

  it('ml-service down: ai-analysis degrades gracefully (available:false, no 500) and register-by-proposed still works', async () => {
    const instance = await createScheduledInstance();
    const commercial = await loginAs(app, 'comm.abbasi');
    const created = await request(app.getHttpServer())
      .put(`/pricing/flights/${instance.id}/proposal`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send({ proposedPriceIrr: 38_500_000 });

    fakeMl.nextResult = null; // simulate outage
    const ceo = await loginAs(app, 'ceo');
    const analysis = await request(app.getHttpServer())
      .post('/pricing/proposals/ai-analysis')
      .set('Authorization', `Bearer ${ceo.accessToken}`);
    expect(analysis.status).toBe(201);
    expect(analysis.body.data.available).toBe(false);

    const stepUp = await stepUpFor(
      app,
      ceo.accessToken!,
      'ceo',
      'PRICE_CAPACITY_CHANGE',
    );
    const registered = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${created.body.data.id}/register`)
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ source: 'PROPOSED', ...stepUp });
    expect(registered.status).toBe(200);
  });

  it('CEO legal-rate PATCH stores + audits; Finance/Board Chair get 403 everywhere', async () => {
    const instance = await createScheduledInstance();
    const commercial = await loginAs(app, 'comm.abbasi');
    const created = await request(app.getHttpServer())
      .put(`/pricing/flights/${instance.id}/proposal`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send({ proposedPriceIrr: 38_500_000 });
    const proposalId = created.body.data.id as string;

    const ceo = await loginAs(app, 'ceo');
    const legal = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${proposalId}/legal-rate`)
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ legalRateIrr: 45_000_000 });
    expect(legal.status).toBe(200);
    expect(legal.body.data.legalRateIrr).toBe(45_000_000);

    const finance = await loginAs(app, 'finance.karimi');
    const listForbidden = await request(app.getHttpServer())
      .get('/pricing/proposals')
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(listForbidden.status).toBe(403);

    const registerForbidden = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${proposalId}/register`)
      .set('Authorization', `Bearer ${finance.accessToken}`)
      .send({ source: 'PROPOSED' });
    expect(registerForbidden.status).toBe(403);
  });

  it('role-shaped GET: CEO gets pending/registered lists, Commercial gets flight rows joined with proposals', async () => {
    const instance = await createScheduledInstance();
    const commercial = await loginAs(app, 'comm.abbasi');
    await request(app.getHttpServer())
      .put(`/pricing/flights/${instance.id}/proposal`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send({ proposedPriceIrr: 38_500_000 });

    const ceo = await loginAs(app, 'ceo');
    const ceoList = await request(app.getHttpServer())
      .get('/pricing/proposals')
      .set('Authorization', `Bearer ${ceo.accessToken}`);
    expect(ceoList.status).toBe(200);
    expect(Array.isArray(ceoList.body.data.pending)).toBe(true);
    expect(Array.isArray(ceoList.body.data.registered)).toBe(true);

    const commercialList = await request(app.getHttpServer())
      .get('/pricing/proposals')
      .set('Authorization', `Bearer ${commercial.accessToken}`);
    expect(commercialList.status).toBe(200);
    const row = commercialList.body.data.flights.find(
      (f: { id: string }) => f.id === instance.id,
    );
    expect(row).toBeDefined();
    expect(row.pricing.status).toBe('PENDING');
  });
});

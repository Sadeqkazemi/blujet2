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
import { loginAs } from './helpers/login.helper';

class FakePriceSuggestionProvider implements PriceSuggestionProvider {
  nextResult: PriceSuggestionResult | null = null;
  lastItems: Array<{ proposal_id: string }> = [];

  suggest(
    items: Array<{ proposal_id: string }>,
  ): Promise<PriceSuggestionResult | null> {
    this.lastItems = items;
    return Promise.resolve(this.nextResult);
  }
}

describe('Flights (e2e)', () => {
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

  function uniqueFlightNo() {
    return `TS-${(Date.now() % 9000) + 1000}`;
  }

  async function createInstance(
    over: Partial<{
      departureAt: Date;
      status: 'SCHEDULED' | 'DEPARTED' | 'CANCELLED';
      capacity: number;
      charterSeats: number;
      basePriceIrr: number;
    }> = {},
  ) {
    const flight = await prisma.flight.findFirstOrThrow();
    const departureAt =
      over.departureAt ?? new Date(Date.now() + 14 * 24 * 3_600_000);
    return prisma.flightInstance.create({
      data: {
        flightId: flight.id,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 3 * 3_600_000),
        capacity: over.capacity ?? 180,
        charterSeats: over.charterSeats ?? 60,
        status: over.status ?? 'SCHEDULED',
        basePriceIrr: over.basePriceIrr ?? 30_000_000,
      },
    });
  }

  async function addBooking(
    flightInstanceId: string,
    channel: 'SYSTEM' | 'CHARTER' | 'AGENCY',
    priceIrr: number,
  ) {
    return prisma.booking.create({
      data: {
        pnr: `FL${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        flightInstanceId,
        channel,
        status: 'TICKETED',
        priceIrr,
      },
    });
  }

  it('overview: KPI figures reconcile with the rows; statuses derived from real state; future rows split off', async () => {
    const near = await createInstance({
      departureAt: new Date(Date.now() + 2 * 24 * 3_600_000),
    });
    await addBooking(near.id, 'SYSTEM', 30_000_000);
    const cancelled = await createInstance({
      departureAt: new Date(Date.now() + 2 * 24 * 3_600_000),
      status: 'CANCELLED',
    });
    const future = await createInstance({
      departureAt: new Date(Date.now() + 20 * 24 * 3_600_000),
    });

    const { accessToken } = await loginAs(app, 'senior.rahimi');
    const res = await request(app.getHttpServer())
      .get('/flights/overview')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);

    const { kpis, active, future: futureRows } = res.body.data;
    const activeById = new Map(
      (active as { id: string; derivedStatus: string; sold: number }[]).map(
        (r) => [r.id, r],
      ),
    );
    expect(activeById.get(near.id)?.derivedStatus).toBe('SELLING');
    expect(activeById.get(cancelled.id)?.derivedStatus).toBe('CANCELLED');
    expect(activeById.has(future.id)).toBe(false);
    expect(
      (futureRows as { id: string }[]).some((r) => r.id === future.id),
    ).toBe(true);

    const nonCancelled = (
      active as { derivedStatus: string; sold: number; capacity: number }[]
    ).filter((r) => r.derivedStatus !== 'CANCELLED');
    expect(kpis.activeCount).toBe(nonCancelled.length);
    expect(kpis.soldSeats).toBe(nonCancelled.reduce((a, r) => a + r.sold, 0));
  });

  it('completed report aggregates REAL per-channel revenue; سود/ضرر vs the base rate; KPIs reconcile', async () => {
    const departed = await createInstance({
      departureAt: new Date(Date.now() - 3 * 24 * 3_600_000),
      status: 'DEPARTED',
      basePriceIrr: 30_000_000,
    });
    // 2 SYSTEM at 40M + 1 AGENCY at 20M → revenue 100M, avg ≈ 33.33M > base.
    await addBooking(departed.id, 'SYSTEM', 40_000_000);
    await addBooking(departed.id, 'SYSTEM', 40_000_000);
    await addBooking(departed.id, 'AGENCY', 20_000_000);

    const { accessToken } = await loginAs(app, 'comm.abbasi');
    const res = await request(app.getHttpServer())
      .get('/flights/overview')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);

    const row = (
      res.body.data.completed.rows as {
        id: string;
        tickets: number;
        revenueIrr: number;
        avgPriceIrr: number;
        channelRevenueIrr: Record<string, number>;
        profitIrr: number;
        lossIrr: number;
      }[]
    ).find((r) => r.id === departed.id)!;
    expect(row.tickets).toBe(3);
    expect(row.revenueIrr).toBe(100_000_000);
    expect(row.channelRevenueIrr.SYSTEM).toBe(80_000_000);
    expect(row.channelRevenueIrr.AGENCY).toBe(20_000_000);
    expect(row.channelRevenueIrr.CHARTER).toBe(0);
    expect(row.avgPriceIrr).toBe(Math.round(100_000_000 / 3));
    // avg > base → profit, no loss (real math, no fabricated 18٪ margin).
    expect(row.profitIrr).toBe((row.avgPriceIrr - 30_000_000) * 3);
    expect(row.lossIrr).toBe(0);

    const { kpis, rows } = res.body.data.completed as {
      kpis: { totalSalesIrr: number; totalTickets: number };
      rows: { revenueIrr: number; tickets: number }[];
    };
    expect(kpis.totalSalesIrr).toBe(rows.reduce((a, r) => a + r.revenueIrr, 0));
    expect(kpis.totalTickets).toBe(rows.reduce((a, r) => a + r.tickets, 0));
  });

  it('airports catalog is seeded (Iranian cities + DXB/IST/NJF); roles without the tab get 403', async () => {
    const { accessToken } = await loginAs(app, 'senior.rahimi');
    const res = await request(app.getHttpServer())
      .get('/flights/airports')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const codes = (res.body.data as { code: string }[]).map((a) => a.code);
    expect(codes).toEqual(expect.arrayContaining(['THR', 'DXB', 'IST', 'NJF']));
    expect(codes.length).toBeGreaterThanOrEqual(23);

    const finance = await loginAs(app, 'finance.karimi');
    const denied = await request(app.getHttpServer())
      .get('/flights/overview')
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(denied.status).toBe(403);
  });

  it('POST /flights: validations (same origin/dest, past date, duplicate flightNo on another route) then a clean create', async () => {
    const { accessToken } = await loginAs(app, 'senior.rahimi');
    const base = {
      originCode: 'THR',
      destCode: 'MHD',
      flightNo: uniqueFlightNo(),
      departureAt: new Date(Date.now() + 5 * 24 * 3_600_000).toISOString(),
      capacity: 160,
      basePriceIrr: 25_000_000,
    };

    const sameCity = await request(app.getHttpServer())
      .post('/flights')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...base, destCode: 'THR' });
    expect(sameCity.status).toBe(400);

    const pastDate = await request(app.getHttpServer())
      .post('/flights')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...base, departureAt: new Date(Date.now() - 3_600_000).toISOString() });
    expect(pastDate.status).toBe(400);

    // EP-821 belongs to the seeded THR→DXB route — reusing it on THR→MHD → 409.
    const dupNo = await request(app.getHttpServer())
      .post('/flights')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...base, flightNo: 'EP-821' });
    expect(dupNo.status).toBe(409);

    const ok = await request(app.getHttpServer())
      .post('/flights')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(base);
    expect(ok.status).toBe(201);
    expect(ok.body.data.derivedStatus).toBe('ACTIVE');
    expect(ok.body.data.sold).toBe(0);

    const instance = await prisma.flightInstance.findUniqueOrThrow({
      where: { id: ok.body.data.id },
      include: { flight: { include: { route: true } } },
    });
    expect(instance.flight.route.originCode).toBe('THR');
    expect(instance.flight.route.destCode).toBe('MHD');
    // arrivalAt = departure + the route's seeded duration (default 120min).
    expect(instance.arrivalAt.getTime() - instance.departureAt.getTime()).toBe(
      instance.flight.route.durationMin * 60_000,
    );

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'FlightInstance', entityId: instance.id },
    });
    expect(audit).not.toBeNull();
  });

  it('GET /flights/:id detail: channel breakdown + total revenue consistent with bookings', async () => {
    const instance = await createInstance({
      departureAt: new Date(Date.now() + 2 * 24 * 3_600_000),
    });
    await addBooking(instance.id, 'SYSTEM', 30_000_000);
    await addBooking(instance.id, 'CHARTER', 28_000_000);

    const { accessToken } = await loginAs(app, 'senior.rahimi');
    const res = await request(app.getHttpServer())
      .get(`/flights/${instance.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const { channels, totalRevenueIrr, sold } = res.body.data as {
      channels: { channel: string; seats: number; revenueIrr: number }[];
      totalRevenueIrr: number;
      sold: number;
    };
    expect(sold).toBe(2);
    expect(totalRevenueIrr).toBe(58_000_000);
    expect(channels.find((c) => c.channel === 'SYSTEM')?.seats).toBe(1);
    expect(channels.find((c) => c.channel === 'AGENCY')?.revenueIrr).toBe(0);
  });

  it('plan: agency-seat cap enforced; commercial save upserts a PENDING Phase 6 proposal; REGISTERED price → 409', async () => {
    const instance = await createInstance({
      departureAt: new Date(Date.now() + 20 * 24 * 3_600_000),
      capacity: 180,
      charterSeats: 60,
    });
    const commercial = await loginAs(app, 'comm.abbasi');

    const overCap = await request(app.getHttpServer())
      .patch(`/flights/${instance.id}/plan`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send({ priceIrr: 39_000_000, agencySeats: 121 }); // max = 180 − 60
    expect(overCap.status).toBe(400);

    const ok = await request(app.getHttpServer())
      .patch(`/flights/${instance.id}/plan`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send({ priceIrr: 39_000_000, agencySeats: 60 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.basePriceIrr).toBe(39_000_000);
    expect(ok.body.data.agencySeatsAllocated).toBe(60);
    expect(ok.body.data.directSeats).toBe(60);
    expect(ok.body.data.proposalPending).toBe(true);

    // ⚑ The plan never registers a bookable price — the proposal stays PENDING.
    const proposal = await prisma.farePricingProposal.findUniqueOrThrow({
      where: { flightInstanceId: instance.id },
    });
    expect(proposal.status).toBe('PENDING');
    expect(proposal.proposedPriceIrr).toBe(39_000_000);

    // Once the CEO registers it, re-planning is locked.
    await prisma.farePricingProposal.update({
      where: { flightInstanceId: instance.id },
      data: { status: 'REGISTERED', registeredPriceIrr: 39_000_000 },
    });
    const locked = await request(app.getHttpServer())
      .patch(`/flights/${instance.id}/plan`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send({ priceIrr: 40_000_000, agencySeats: 60 });
    expect(locked.status).toBe(409);
  });

  it('plan by SENIOR stores figures WITHOUT creating a Phase 6 proposal', async () => {
    const instance = await createInstance({
      departureAt: new Date(Date.now() + 20 * 24 * 3_600_000),
    });
    const senior = await loginAs(app, 'senior.rahimi');
    const res = await request(app.getHttpServer())
      .patch(`/flights/${instance.id}/plan`)
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({ priceIrr: 33_000_000, agencySeats: 40 });
    expect(res.status).toBe(200);
    expect(res.body.data.proposalPending).toBe(false);

    const proposal = await prisma.farePricingProposal.findUnique({
      where: { flightInstanceId: instance.id },
    });
    expect(proposal).toBeNull();
  });

  it('ai-analysis persists suggestions with modelVersion on future instances; down service degrades gracefully', async () => {
    const future = await createInstance({
      departureAt: new Date(Date.now() + 20 * 24 * 3_600_000),
    });
    const { accessToken } = await loginAs(app, 'senior.rahimi');

    fakeMl.nextResult = null; // ml-service down
    const down = await request(app.getHttpServer())
      .post('/flights/ai-analysis')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(down.status).toBe(201);
    expect(down.body.data).toEqual({ analyzed: 0, available: false });

    fakeMl.nextResult = {
      model_version: 'heuristic-v1.0.0',
      suggestions: [
        {
          proposal_id: future.id,
          price_irr: 41_000_000,
          reason_fa: 'دلیل آزمایشی',
          factors_fa: ['عامل ۱'],
          season_fa: 'تابستان',
          occasion_fa: 'بدون مناسبت',
          confidence: 0.8,
        },
      ],
    };
    const ok = await request(app.getHttpServer())
      .post('/flights/ai-analysis')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(ok.status).toBe(201);
    expect(ok.body.data.available).toBe(true);
    expect(ok.body.data.analyzed).toBeGreaterThanOrEqual(1);

    const row = await prisma.flightInstance.findUniqueOrThrow({
      where: { id: future.id },
    });
    const suggestion = row.aiSuggestion as { priceIrr: number; modelVersion: string };
    expect(suggestion.priceIrr).toBe(41_000_000);
    expect(suggestion.modelVersion).toBe('heuristic-v1.0.0');
  });
});

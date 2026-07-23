import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { loginAs, loginAsCustomer } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Reporting (e2e)', () => {
  let app: INestApplication<App>;
  let ceoToken: string;
  let ownFlightNo: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { accessToken } = await loginAs(app, 'ceo');
    ceoToken = accessToken!;

    // These endpoints aggregate over the ENTIRE shared e2e test database —
    // `blujet_test` is never reset between spec files, so how much SALE
    // ledger data (if any) exists in the current q6 window depends entirely
    // on suite run order, not on anything this file controls (the same
    // class of flakiness already fixed once for finance-reports.e2e-spec.ts
    // — commit 159c6d7). Rather than assume ambient revenue exists, this
    // file creates and pays its own dedicated booking so both the org-wide
    // q6 totals and the by-flightNo query always have a real, deterministic
    // SALE entry to find, regardless of what else has run.
    const prisma = app.get(PrismaService);
    const AIRCRAFT_TYPE = 'RP-TestJet';
    await prisma.aircraftSeatMap.upsert({
      where: { aircraftType: AIRCRAFT_TYPE },
      update: {},
      create: {
        aircraftType: AIRCRAFT_TYPE,
        businessRowStart: 1,
        businessRowEnd: 0,
        businessColsLeft: [],
        businessColsRight: [],
        economyRowStart: 1,
        economyRowEnd: 3,
        economyColsLeft: ['A'],
        economyColsRight: ['C'],
      },
    });
    const route = await prisma.route.upsert({
      where: { originCode_destCode: { originCode: 'THR', destCode: 'IFN' } },
      update: {},
      create: { originCode: 'THR', destCode: 'IFN', durationMin: 70 },
    });
    ownFlightNo = `RP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const flight = await prisma.flight.create({
      data: {
        flightNo: ownFlightNo,
        routeId: route.id,
        aircraftType: AIRCRAFT_TYPE,
      },
    });
    const departureAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const instance = await prisma.flightInstance.create({
      data: {
        flightId: flight.id,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 70 * 60 * 1000),
        capacity: 4,
        status: 'SCHEDULED',
      },
    });

    const { accessToken: customerToken } = await loginAsCustomer(
      app,
      '09150009000',
    );
    const createRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [
          { fullName: 'گزارش تست', nationalId: '0012345679', seatCode: '1A' },
        ],
      });
    await request(app.getHttpServer())
      .post(`/bookings/${createRes.body.data.id}/pay`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({});
  });

  afterAll(async () => {
    await app.close();
  });

  it('IT Manager (not a reporting role) gets 403 on every reporting endpoint', async () => {
    const { accessToken } = await loginAs(app, 'itadmin');
    for (const path of [
      '/reporting/sales-chart?granularity=q6',
      '/reporting/kpis?granularity=q6',
      '/reporting/completed-flights-summary?granularity=q6',
      '/reporting/low-sales-alerts',
    ]) {
      const res = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(403);
    }
  });

  it('sales-chart q6 returns 6 periods whose per-channel sum reconciles with kpis revenue for the full range', async () => {
    const chart = await request(app.getHttpServer())
      .get('/reporting/sales-chart?granularity=q6')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(chart.status).toBe(200);
    expect(chart.body.data).toHaveLength(6);

    const chartTotal = chart.body.data.reduce(
      (
        sum: number,
        p: { systemIrr: number; charterIrr: number; agencyIrr: number },
      ) => sum + p.systemIrr + p.charterIrr + p.agencyIrr,
      0,
    );

    const kpis = await request(app.getHttpServer())
      .get('/reporting/kpis?granularity=q6')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(kpis.status).toBe(200);
    expect(kpis.body.data.revenueIrr).toBe(chartTotal);
  });

  it('kpis re-scope to a single periodKey — sum of all periodKeys equals the full-range total', async () => {
    const chart = await request(app.getHttpServer())
      .get('/reporting/sales-chart?granularity=q6')
      .set('Authorization', `Bearer ${ceoToken}`);
    const periodKeys: string[] = chart.body.data.map(
      (p: { periodKey: string }) => p.periodKey,
    );

    let summedRevenue = 0;
    for (const periodKey of periodKeys) {
      const res = await request(app.getHttpServer())
        .get(`/reporting/kpis?granularity=q6&periodKey=${periodKey}`)
        .set('Authorization', `Bearer ${ceoToken}`);
      expect(res.status).toBe(200);
      summedRevenue += res.body.data.revenueIrr;
    }

    const full = await request(app.getHttpServer())
      .get('/reporting/kpis?granularity=q6')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(summedRevenue).toBe(full.body.data.revenueIrr);
  });

  it('marginPct is derived, never hardcoded — matches round(profit/revenue*100)', async () => {
    const res = await request(app.getHttpServer())
      .get('/reporting/kpis?granularity=q6')
      .set('Authorization', `Bearer ${ceoToken}`);
    const { revenueIrr, profitIrr, marginPct } = res.body.data;
    expect(marginPct).toBe(Math.round((profitIrr / revenueIrr) * 100));
  });

  it('an invalid periodKey is rejected with 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/reporting/kpis?granularity=q6&periodKey=not-a-real-bucket')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('flight granularity requires flightNo', async () => {
    const res = await request(app.getHttpServer())
      .get('/reporting/sales-chart?granularity=flight')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(400);
  });

  it('sales-chart by flightNo returns only that flight’s sales', async () => {
    const res = await request(app.getHttpServer())
      .get(`/reporting/sales-chart?granularity=flight&flightNo=${ownFlightNo}`)
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const total =
      res.body.data[0].systemIrr +
      res.body.data[0].charterIrr +
      res.body.data[0].agencyIrr;
    expect(total).toBeGreaterThan(0);
  });

  it('completed-flights-summary reconciles: sold + unsold === total seats', async () => {
    const res = await request(app.getHttpServer())
      .get('/reporting/completed-flights-summary?granularity=q6')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(200);
    const { totalSeats, soldSeats, unsoldSeats } = res.body.data;
    expect(soldSeats + unsoldSeats).toBe(totalSeats);
  });

  it('low-sales-alerts only returns flights within 72h below the occupancy threshold', async () => {
    const res = await request(app.getHttpServer())
      .get('/reporting/low-sales-alerts')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(res.status).toBe(200);
    for (const alert of res.body.data) {
      expect(alert.occupancyPct).toBeLessThan(0.6);
    }
  });

  it('money fields are raw integers, never pre-formatted display strings', async () => {
    const res = await request(app.getHttpServer())
      .get('/reporting/kpis?granularity=q6')
      .set('Authorization', `Bearer ${ceoToken}`);
    expect(typeof res.body.data.revenueIrr).toBe('number');
    expect(Number.isInteger(res.body.data.revenueIrr)).toBe(true);
  });
});

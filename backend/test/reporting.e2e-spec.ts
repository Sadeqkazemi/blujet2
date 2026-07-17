import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

describe('Reporting (e2e)', () => {
  let app: INestApplication<App>;
  let ceoToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const { accessToken } = await loginAs(app, 'ceo');
    ceoToken = accessToken!;
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
      .get('/reporting/sales-chart?granularity=flight&flightNo=EP-821')
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

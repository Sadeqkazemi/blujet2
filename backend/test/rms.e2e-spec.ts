import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { FareRule } from '../src/database/entities/fare-rule.entity';
import { FlightInstance } from '../src/database/entities/flight-instance.entity';
import { createTestApp } from './helpers/app.helper';
import { loginAs } from './helpers/login.helper';

describe('RMS boundary (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => app.close());

  it('exposes real controls and an advisory-only recommendation to commercial', async () => {
    const commercial = await loginAs(app, 'comm');
    const auth = { Authorization: `Bearer ${commercial.accessToken}` };
    const instance = await dataSource
      .getRepository(FlightInstance)
      .createQueryBuilder('instance')
      .where('instance.status = :status', { status: 'SCHEDULED' })
      .andWhere('instance.definitionStatus IN (:...statuses)', {
        statuses: ['PUBLISHED', 'PENDING_REVISION'],
      })
      .andWhere('instance.departureAt > :now', { now: new Date() })
      .orderBy('instance.departureAt', 'ASC')
      .getOneOrFail();

    const portfolio = await request(app.getHttpServer())
      .get('/rms/portfolio')
      .set(auth);
    expect(portfolio.status).toBe(200);
    expect(portfolio.body.data).toHaveProperty('active');

    const control = await request(app.getHttpServer())
      .get(`/rms/flights/${instance.id}/control`)
      .set(auth);
    expect(control.status).toBe(200);
    expect(control.body.data.flightInstanceId).toBe(instance.id);
    expect(control.body.data.fareClasses.length).toBeGreaterThan(0);

    const ruleId = control.body.data.fareClasses[0].ruleId as string;
    const ruleBefore = await dataSource
      .getRepository(FareRule)
      .findOneByOrFail({ id: ruleId });
    const snapshot = {
      priceIrr: ruleBefore.priceIrr,
      sitePriceIrr: ruleBefore.sitePriceIrr,
      siteSeatsReleased: ruleBefore.siteSeatsReleased,
      agencySeatsReleased: ruleBefore.agencySeatsReleased,
    };

    const recommendation = await request(app.getHttpServer())
      .post(`/rms/flights/${instance.id}/fare-rules/${ruleId}/recommendation`)
      .set(auth)
      .send({ channel: 'SYSTEM' });
    expect(recommendation.status).toBe(201);
    expect(recommendation.body.data).toMatchObject({
      ruleId,
      channel: 'SYSTEM',
      advisoryOnly: true,
    });
    expect(['ML', 'HEURISTIC']).toContain(recommendation.body.data.source);

    const ruleAfter = await dataSource
      .getRepository(FareRule)
      .findOneByOrFail({ id: ruleId });
    expect({
      priceIrr: ruleAfter.priceIrr,
      sitePriceIrr: ruleAfter.sitePriceIrr,
      siteSeatsReleased: ruleAfter.siteSeatsReleased,
      agencySeatsReleased: ruleAfter.agencySeatsReleased,
    }).toEqual(snapshot);
  });

  it('rejects finance from RMS controls', async () => {
    const finance = await loginAs(app, 'finance');
    const response = await request(app.getHttpServer())
      .get('/rms/portfolio')
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(response.status).toBe(403);
  });
});

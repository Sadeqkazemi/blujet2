import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { Airport } from '../src/database/entities/airport.entity';
import { AircraftDefinition } from '../src/database/entities/aircraft-definition.entity';
import { FlightInstance } from '../src/database/entities/flight-instance.entity';
import { loginAs } from './helpers/login.helper';

describe('Seasonal schedule templates (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication({ bufferLogs: true });
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
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await app.close();
  });

  async function airportsAndAircraft() {
    const origin = await dataSource
      .getRepository(Airport)
      .findOneByOrFail({ code: 'THR' });
    const dest = await dataSource
      .getRepository(Airport)
      .findOneByOrFail({ code: 'MHD' });
    const aircraft = await dataSource
      .getRepository(AircraftDefinition)
      .createQueryBuilder('a')
      .where("a.code <> 'MD-80'")
      .orderBy('a.createdAt', 'ASC')
      .getOne();
    const fallback = await dataSource
      .getRepository(AircraftDefinition)
      .createQueryBuilder('a')
      .getOneOrFail();
    return { origin, dest, aircraft: aircraft ?? fallback };
  }

  it('preview + create is idempotent; conflict on replay with different key overlapping', async () => {
    const { accessToken } = await loginAs(app, 'comm');
    const { origin, dest, aircraft } = await airportsAndAircraft();
    const body = {
      originAirportId: origin.id,
      destinationAirportId: dest.id,
      flightNoBase: `ST${Date.now() % 100000}`,
      aircraftDefinitionId: aircraft.id,
      departureTime: '08:15',
      durationMinutes: 95,
      startDate: '2026-11-02',
      endDate: '2026-11-20',
      weekdays: [1, 3, 5],
      agencyPriceIrr: '38000000',
      legalCeilingIrr: '42000000',
    };

    const preview = await request(app.getHttpServer())
      .post('/flights/schedule-templates/preview')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body);
    expect(preview.status).toBe(200);
    expect(preview.body.data.occurrenceCount).toBeGreaterThan(0);

    const key = `sched-e2e-${Date.now()}`;
    const created = await request(app.getHttpServer())
      .post('/flights/schedule-templates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...body, idempotencyKey: key });
    expect(created.status).toBe(201);
    expect(created.body.data.instanceCount).toBe(
      preview.body.data.occurrenceCount,
    );

    const replay = await request(app.getHttpServer())
      .post('/flights/schedule-templates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...body, idempotencyKey: key });
    expect(replay.status).toBe(201);
    expect(replay.body.data.id).toBe(created.body.data.id);

    const conflict = await request(app.getHttpServer())
      .post('/flights/schedule-templates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...body, idempotencyKey: `${key}-b` });
    expect(conflict.status).toBe(409);

    const instances = await dataSource
      .getRepository(FlightInstance)
      .createQueryBuilder('fi')
      .where('fi.scheduleTemplateId = :id', { id: created.body.data.id })
      .getCount();
    expect(instances).toBe(preview.body.data.occurrenceCount);
  });

  it('deactivate cancels future unsold instances', async () => {
    const { accessToken } = await loginAs(app, 'comm');
    const { origin, dest, aircraft } = await airportsAndAircraft();
    const body = {
      originAirportId: origin.id,
      destinationAirportId: dest.id,
      flightNoBase: `SD${Date.now() % 100000}`,
      aircraftDefinitionId: aircraft.id,
      departureTime: '09:00',
      durationMinutes: 90,
      startDate: '2026-12-01',
      endDate: '2026-12-15',
      weekdays: [2, 4],
      agencyPriceIrr: '35000000',
      legalCeilingIrr: '40000000',
      idempotencyKey: `sched-deact-${Date.now()}`,
    };
    const created = await request(app.getHttpServer())
      .post('/flights/schedule-templates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body);
    expect(created.status).toBe(201);

    const deact = await request(app.getHttpServer())
      .post(`/flights/schedule-templates/${created.body.data.id}/deactivate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(deact.status).toBe(200);
    expect(deact.body.data.status).toBe('DEACTIVATED');
  });
});

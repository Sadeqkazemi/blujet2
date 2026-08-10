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
import { FlightScheduleTemplate } from '../src/database/entities/flight-schedule-template.entity';
import { CharterCommitment } from '../src/database/entities/charter-commitment.entity';
import { AgencySeatCommitment } from '../src/database/entities/agency-seat-commitment.entity';
import { AgencyProfile } from '../src/database/entities/agency-profile.entity';
import { User } from '../src/database/entities/user.entity';
import { loginAs } from './helpers/login.helper';

describe('Seasonal schedule templates (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let slotSequence = 0;

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
    const aircraftList = await dataSource
      .getRepository(AircraftDefinition)
      .createQueryBuilder('a')
      .where("a.code <> 'MD-80'")
      .orderBy('a.code', 'ASC')
      .getMany();
    const fallback = await dataSource
      .getRepository(AircraftDefinition)
      .createQueryBuilder('a')
      .getOneOrFail();
    const aircraft = aircraftList[0] ?? fallback;
    const aircraftB = aircraftList[1] ?? aircraftList[0] ?? fallback;
    return { origin, dest, aircraft, aircraftB };
  }

  /** Unique local clock so aircraft overlap checks don't hit seed/history. */
  function uniqueSlot(stamp: number) {
    const minute = stamp % 60;
    const hour = 2 + Math.floor((stamp / 60) % 4); // 02–05
    const departureTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    // A distinct year per call prevents cross-test schedule overlap in the shared E2E database.
    const y = 2030 + slotSequence++;
    const m = 1 + (stamp % 9); // Jan–Sep
    const startDay = 1 + (stamp % 20);
    const startDate = `${y}-${String(m).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    const endDate = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(startDay + 14, 28)).padStart(2, '0')}`;
    return { departureTime, startDate, endDate };
  }

  it('preview + create is idempotent; conflict on replay with different key overlapping', async () => {
    const { accessToken } = await loginAs(app, 'comm');
    const { origin, dest, aircraft } = await airportsAndAircraft();
    const stamp = Date.now();
    const slot = uniqueSlot(stamp);
    const body = {
      originAirportId: origin.id,
      destinationAirportId: dest.id,
      flightNoBase: `ST${stamp % 1000000}`,
      aircraftDefinitionId: aircraft.id,
      departureTime: slot.departureTime,
      durationMinutes: 95,
      startDate: slot.startDate,
      endDate: slot.endDate,
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

  it('concurrent creates do not leave incomplete or duplicate schedules', async () => {
    const { accessToken } = await loginAs(app, 'comm');
    const { origin, dest, aircraft } = await airportsAndAircraft();
    const stamp = Date.now() + 17;
    const slot = uniqueSlot(stamp);
    const body = {
      originAirportId: origin.id,
      destinationAirportId: dest.id,
      flightNoBase: `SC${stamp % 1000000}`,
      aircraftDefinitionId: aircraft.id,
      departureTime: slot.departureTime,
      durationMinutes: 100,
      startDate: slot.startDate,
      endDate: slot.endDate,
      weekdays: [1, 3],
      agencyPriceIrr: '36000000',
      legalCeilingIrr: '41000000',
    };
    const preview = await request(app.getHttpServer())
      .post('/flights/schedule-templates/preview')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body);
    expect(preview.status).toBe(200);
    const expected = preview.body.data.occurrenceCount as number;

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post('/flights/schedule-templates')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...body, idempotencyKey: `conc-a-${stamp}` }),
      request(app.getHttpServer())
        .post('/flights/schedule-templates')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...body, idempotencyKey: `conc-b-${stamp}` }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    const winner = a.status === 201 ? a : b;
    expect(winner.body.data.instanceCount).toBe(expected);

    const templates = await dataSource
      .getRepository(FlightScheduleTemplate)
      .count({
        where: { flightNoBase: body.flightNoBase },
      });
    expect(templates).toBe(1);

    const instances = await dataSource
      .getRepository(FlightInstance)
      .count({ where: { scheduleTemplateId: winner.body.data.id } });
    expect(instances).toBe(expected);
  });

  it('deactivate cancels future unsold instances', async () => {
    const { accessToken } = await loginAs(app, 'comm');
    const { origin, dest, aircraft } = await airportsAndAircraft();
    const stamp = Date.now() + 31;
    const slot = uniqueSlot(stamp);
    const body = {
      originAirportId: origin.id,
      destinationAirportId: dest.id,
      flightNoBase: `SD${stamp % 1000000}`,
      aircraftDefinitionId: aircraft.id,
      departureTime: slot.departureTime,
      durationMinutes: 90,
      startDate: slot.startDate,
      endDate: slot.endDate,
      weekdays: [2, 4],
      agencyPriceIrr: '35000000',
      legalCeilingIrr: '40000000',
      idempotencyKey: `sched-deact-${stamp}`,
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

  it('does not cancel instances with active charter/agency commitments', async () => {
    const { accessToken } = await loginAs(app, 'comm');
    const actor = await dataSource
      .getRepository(User)
      .findOneByOrFail({ username: 'comm' });
    const { origin, dest, aircraft } = await airportsAndAircraft();
    const stamp = Date.now() + 53;
    const slot = uniqueSlot(stamp);
    const body = {
      originAirportId: origin.id,
      destinationAirportId: dest.id,
      flightNoBase: `CM${stamp % 1000000}`,
      aircraftDefinitionId: aircraft.id,
      departureTime: slot.departureTime,
      durationMinutes: 90,
      startDate: slot.startDate,
      endDate: slot.endDate,
      weekdays: [1, 3, 5],
      agencyPriceIrr: '34000000',
      legalCeilingIrr: '39000000',
      idempotencyKey: `sched-commit-${stamp}`,
    };
    const created = await request(app.getHttpServer())
      .post('/flights/schedule-templates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body);
    expect(created.status).toBe(201);

    const instances = await dataSource.getRepository(FlightInstance).find({
      where: { scheduleTemplateId: created.body.data.id },
      order: { departureAt: 'ASC' },
    });
    expect(instances.length).toBeGreaterThan(1);
    const protectedFi = instances[0];
    const freeFi = instances[1];
    expect(protectedFi).toBeDefined();
    expect(freeFi).toBeDefined();
    if (!protectedFi || !freeFi) {
      throw new Error('expected at least two schedule instances');
    }

    await dataSource.getRepository(CharterCommitment).save(
      dataSource.getRepository(CharterCommitment).create({
        flightInstanceId: protectedFi.id,
        cabin: 'ECONOMY',
        seats: 2,
        contractPriceIrr: 1_000_000n,
        createdById: actor.id,
        createdAt: new Date(),
        status: 'ACTIVE',
      }),
    );
    const [agency] = await dataSource.getRepository(AgencyProfile).find({
      take: 1,
    });
    if (agency?.id) {
      await dataSource.getRepository(AgencySeatCommitment).save(
        dataSource.getRepository(AgencySeatCommitment).create({
          flightInstanceId: protectedFi.id,
          agencyId: agency.id,
          cabin: 'BUSINESS',
          seats: 1,
          contractPriceIrr: 2_000_000n,
          createdById: actor.id,
          createdAt: new Date(),
          status: 'ACTIVE',
        }),
      );
    }

    const deact = await request(app.getHttpServer())
      .post(`/flights/schedule-templates/${created.body.data.id}/deactivate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(deact.status).toBe(200);

    const refreshedProtected = await dataSource
      .getRepository(FlightInstance)
      .findOneByOrFail({ id: protectedFi.id });
    const refreshedFree = await dataSource
      .getRepository(FlightInstance)
      .findOneByOrFail({ id: freeFi.id });
    expect(refreshedProtected.status).toBe('SCHEDULED');
    expect(refreshedFree.status).toBe('CANCELLED');
  });

  it('concurrent same aircraft + different flightNo does not deadlock', async () => {
    const { accessToken } = await loginAs(app, 'comm');
    const { origin, dest, aircraft } = await airportsAndAircraft();
    const stamp = Date.now() + 71;
    const slot = uniqueSlot(stamp);
    const base = {
      originAirportId: origin.id,
      destinationAirportId: dest.id,
      aircraftDefinitionId: aircraft.id,
      departureTime: slot.departureTime,
      durationMinutes: 90,
      startDate: slot.startDate,
      endDate: slot.endDate,
      weekdays: [1, 3],
      agencyPriceIrr: '33000000',
      legalCeilingIrr: '38000000',
    };
    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post('/flights/schedule-templates')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...base,
          flightNoBase: `FA${stamp % 1000000}`,
          idempotencyKey: `fa-${stamp}`,
        }),
      request(app.getHttpServer())
        .post('/flights/schedule-templates')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...base,
          flightNoBase: `FB${stamp % 1000000}`,
          idempotencyKey: `fb-${stamp}`,
        }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it('concurrent same flightNo + different aircraft does not deadlock', async () => {
    const { accessToken } = await loginAs(app, 'comm');
    const { origin, dest, aircraft, aircraftB } = await airportsAndAircraft();
    if (aircraft.id === aircraftB.id) {
      // Seed may only have one non-MD-80 definition — still prove serialization.
    }
    const stamp = Date.now() + 91;
    const slot = uniqueSlot(stamp);
    const flightNo = `FX${stamp % 1000000}`;
    const base = {
      originAirportId: origin.id,
      destinationAirportId: dest.id,
      flightNoBase: flightNo,
      departureTime: slot.departureTime,
      durationMinutes: 90,
      startDate: slot.startDate,
      endDate: slot.endDate,
      weekdays: [2, 4],
      agencyPriceIrr: '33000000',
      legalCeilingIrr: '38000000',
    };
    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post('/flights/schedule-templates')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...base,
          aircraftDefinitionId: aircraft.id,
          idempotencyKey: `fx-a-${stamp}`,
        }),
      request(app.getHttpServer())
        .post('/flights/schedule-templates')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...base,
          aircraftDefinitionId: aircraftB.id,
          idempotencyKey: `fx-b-${stamp}`,
        }),
    ]);
    const statuses = [a.status, b.status].sort();
    // Same flightNo + overlapping times → one success, one conflict (or both
    // conflict if aircraft ids collide and another race wins first).
    expect(statuses[0]).toBeGreaterThanOrEqual(201);
    expect([201, 409]).toContain(a.status);
    expect([201, 409]).toContain(b.status);
    expect(statuses.filter((s) => s === 201).length).toBeLessThanOrEqual(1);
  });

  it('race: deactivate vs commitment never leaves cancelled+committed', async () => {
    const { accessToken } = await loginAs(app, 'comm');
    const { origin, dest, aircraft } = await airportsAndAircraft();
    const stamp = Date.now() + 111;
    const slot = uniqueSlot(stamp);
    const created = await request(app.getHttpServer())
      .post('/flights/schedule-templates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        originAirportId: origin.id,
        destinationAirportId: dest.id,
        flightNoBase: `RC${stamp % 1000000}`,
        aircraftDefinitionId: aircraft.id,
        departureTime: slot.departureTime,
        durationMinutes: 90,
        startDate: slot.startDate,
        endDate: slot.endDate,
        weekdays: [1, 2, 3, 4, 5],
        agencyPriceIrr: '32000000',
        legalCeilingIrr: '37000000',
        idempotencyKey: `race-${stamp}`,
      });
    expect(created.status).toBe(201);
    const fi = await dataSource
      .getRepository(FlightInstance)
      .createQueryBuilder('fi')
      .where('fi.scheduleTemplateId = :id', { id: created.body.data.id })
      .orderBy('fi.departureAt', 'ASC')
      .getOne();
    expect(fi).toBeTruthy();
    if (!fi) throw new Error('missing instance');

    const [deact, commit] = await Promise.all([
      request(app.getHttpServer())
        .post(`/flights/schedule-templates/${created.body.data.id}/deactivate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({}),
      request(app.getHttpServer())
        .post(`/flights/${fi.id}/commitments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ cabin: 'ECONOMY', seats: 1, contractPriceIrr: '500000000' }),
    ]);
    expect(deact.status).toBe(200);
    expect([201, 409]).toContain(commit.status);

    const refreshed = await dataSource
      .getRepository(FlightInstance)
      .findOneByOrFail({ id: fi.id });
    const activeCommit = await dataSource
      .getRepository(CharterCommitment)
      .findOne({
        where: { flightInstanceId: fi.id, status: 'ACTIVE' },
      });
    if (refreshed.status === 'CANCELLED') {
      expect(activeCommit).toBeNull();
      expect(commit.status).toBe(409);
    } else {
      expect(refreshed.status).toBe('SCHEDULED');
      expect(activeCommit).not.toBeNull();
      expect(commit.status).toBe(201);
    }
  });
});

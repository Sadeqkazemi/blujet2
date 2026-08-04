import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, In } from 'typeorm';
import { dataSourceOptions } from '../src/database/data-source.options';
import { AircraftSeatMap } from '../src/database/entities/aircraft-seat-map.entity';
import { Booking } from '../src/database/entities/booking.entity';
import { Flight } from '../src/database/entities/flight.entity';
import { FlightInstance } from '../src/database/entities/flight-instance.entity';
import { LedgerEntry } from '../src/database/entities/ledger-entry.entity';
import { Passenger } from '../src/database/entities/passenger.entity';
import { PaymentReconciliation } from '../src/database/entities/payment-reconciliation.entity';
import { Route } from '../src/database/entities/route.entity';
import { loginAsCustomer } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

async function upsertSeatMap(
  ds: DataSource,
  aircraftType: string,
  fields: {
    businessRowStart: number;
    businessRowEnd: number;
    businessColsLeft: string[];
    businessColsRight: string[];
    economyRowStart: number;
    economyRowEnd: number;
    economyColsLeft: string[];
    economyColsRight: string[];
  },
) {
  const repo = ds.getRepository(AircraftSeatMap);
  const existing = await repo.findOneBy({ aircraftType });
  if (existing) return existing;
  return repo.save(
    repo.create({ aircraftType, ...fields, updatedAt: new Date() }),
  );
}

async function upsertRoute(
  ds: DataSource,
  originCode: string,
  destCode: string,
  durationMin: number,
) {
  const repo = ds.getRepository(Route);
  const existing = await repo.findOneBy({ originCode, destCode });
  if (existing) return existing;
  return repo.save(repo.create({ originCode, destCode, durationMin }));
}

async function upsertFlight(
  ds: DataSource,
  flightNo: string,
  routeId: string,
  aircraftType: string,
) {
  const repo = ds.getRepository(Flight);
  const existing = await repo.findOneBy({ flightNo });
  if (existing) return existing;
  return repo.save(repo.create({ flightNo, routeId, aircraftType }));
}

describe('Booking engine (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  let routeId: string;
  let flightId: string;
  const AIRCRAFT_TYPE = 'BE2E-TestJet';

  beforeAll(async () => {
    const setupDataSource = new DataSource(dataSourceOptions);
    await setupDataSource.initialize();

    await upsertSeatMap(setupDataSource, AIRCRAFT_TYPE, {
      businessRowStart: 1,
      businessRowEnd: 1,
      businessColsLeft: ['A'],
      businessColsRight: ['C'],
      economyRowStart: 2,
      economyRowEnd: 3,
      economyColsLeft: ['A', 'B'],
      economyColsRight: ['C'],
    });

    const route = await upsertRoute(setupDataSource, 'THR', 'KIH', 90);
    routeId = route.id;

    const flight = await upsertFlight(
      setupDataSource,
      'BE-100',
      routeId,
      AIRCRAFT_TYPE,
    );
    flightId = flight.id;

    await setupDataSource.destroy();
  });

  beforeEach(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await app.close();
  });

  async function freshInstance(daysAhead = 40) {
    const departureAt = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    const repo = dataSource.getRepository(FlightInstance);
    return repo.save(
      repo.create({
        flightId,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 90 * 60 * 1000),
        capacity: 6,
        status: 'SCHEDULED',
      }),
    );
  }

  it('GET /search/airports excludes e2e fixture city names', async () => {
    await typeorm.airport.create({
      data: { code: 'QZZ', cityFa: 'شهر آزمایش الف', tz: 'Asia/Tehran' },
    });

    const res = await request(app.getHttpServer()).get('/search/airports');
    expect(res.status).toBe(200);
    const cities = (res.body.data as { cityFa: string; code: string }[]).map(
      (a) => a.cityFa,
    );
    expect(cities).not.toContain('شهر آزمایش الف');
    expect(cities).not.toEqual(expect.arrayContaining([expect.stringMatching(/^شهر تست/)]));
    expect(cities).toContain('تهران');

    await typeorm.airport.deleteMany({ where: { code: 'QZZ' } });
  });

  it('search returns the flight with both cabins priced and seatsLeft', async () => {
    const instance = await freshInstance();
    const date = instance.departureAt.toISOString().slice(0, 10);

    const res = await request(app.getHttpServer())
      .get('/search/flights')
      .query({ origin: 'THR', dest: 'KIH', date });

    expect(res.status).toBe(200);
    const row = res.body.data.find(
      (r: { flightInstanceId: string }) => r.flightInstanceId === instance.id,
    );
    expect(row).toBeDefined();
    expect(
      row.cabins.find((c: { cabin: string }) => c.cabin === 'ECONOMY')
        .seatsLeft,
    ).toBe(6);
    expect(
      row.cabins.find((c: { cabin: string }) => c.cabin === 'BUSINESS')
        .seatsLeft,
    ).toBe(2);
  });

  it('rejects booking creation without login', async () => {
    const instance = await freshInstance();
    const res = await request(app.getHttpServer())
      .post('/bookings')
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مسافر تست', seatCode: '2A' }],
      });
    expect(res.status).toBe(401);
  });

  it('creates a HELD booking, then pays and issues a ticket with a SALE ledger entry', async () => {
    const instance = await freshInstance();
    const { accessToken } = await loginAsCustomer(app, '09130000001');

    const createRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [
          { fullName: 'سارا احمدی', nationalId: '0012345679', seatCode: '2A' },
        ],
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('HELD');
    expect(createRes.body.data.holdExpiresAt).toBeDefined();
    const bookingId = createRes.body.data.id;

    const payRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(payRes.status).toBe(201);
    expect(payRes.body.data.priceChanged).toBe(false);
    expect(payRes.body.data.booking.status).toBe('TICKETED');

    const ledger = await dataSource
      .getRepository(LedgerEntry)
      .findOneBy({ bookingId, type: 'SALE' });
    expect(ledger).toBeTruthy();
    // ledger is a direct TypeORM read (native bigint); the JSON response
    // field is a decimal string (BigInt.prototype.toJSON) — compare same-type.
    expect(ledger!.signedAmountIrr).toBe(
      BigInt(String(payRes.body.data.booking.priceIrr)),
    );
  });

  it('a booking cannot be paid twice', async () => {
    const instance = await freshInstance();
    const { accessToken } = await loginAsCustomer(app, '09130000002');

    const createRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'رضا محمدی', seatCode: '2B' }],
      });
    const bookingId = createRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    const secondPay = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(secondPay.status).toBe(409);
  });

  it('another customer cannot see or pay someone else’s booking', async () => {
    const instance = await freshInstance();
    const owner = await loginAsCustomer(app, '09130000003');
    const stranger = await loginAsCustomer(app, '09130000004');

    const createRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مالک رزرو', seatCode: '2C' }],
      });
    const bookingId = createRes.body.data.id;

    const getRes = await request(app.getHttpServer())
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(getRes.status).toBe(403);

    const payRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .send({});
    expect(payRes.status).toBe(403);
  });

  it('rejects booking the same seat twice on the same flight', async () => {
    const instance = await freshInstance();
    const first = await loginAsCustomer(app, '09130000005');
    const second = await loginAsCustomer(app, '09130000006');

    const firstRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'نفر اول', seatCode: '3A' }],
      });
    expect(firstRes.status).toBe(201);

    const secondRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${second.accessToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'نفر دوم', seatCode: '3A' }],
      });
    expect(secondRes.status).toBe(409);
  });

  it('an idempotency-key retry on booking creation returns the same booking, not a duplicate', async () => {
    const instance = await freshInstance();
    const { accessToken } = await loginAsCustomer(app, '09130000007');
    const key = `idem-${instance.id}`;

    const payload = {
      flightInstanceId: instance.id,
      cabin: 'ECONOMY',
      passengers: [{ fullName: 'تکرار درخواست', seatCode: '3B' }],
    };

    const first = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', key)
      .send(payload);
    const second = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', key)
      .send(payload);

    expect(first.body.data.id).toBe(second.body.data.id);
    // Booking has no reverse `passengers` relation declared, so a
    // nested-relation filter needs an explicit join rather than
    // repo.countBy/find with a nested `where`.
    const count = await dataSource
      .getRepository(Booking)
      .createQueryBuilder('b')
      .innerJoin(Passenger, 'p', 'p."bookingId" = b.id')
      .where('b."flightInstanceId" = :fid', { fid: instance.id })
      .andWhere('p."seatCode" = :seat', { seat: '3B' })
      .getCount();
    expect(count).toBe(1);
  });

  it('an expired HELD booking cannot be paid and its seat becomes available again', async () => {
    const instance = await freshInstance();
    const { accessToken } = await loginAsCustomer(app, '09130000008');

    const createRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'رزرو منقضی', seatCode: '3C' }],
      });
    const bookingId = createRes.body.data.id;

    await dataSource
      .getRepository(Booking)
      .update(
        { id: bookingId },
        { holdExpiresAt: new Date(Date.now() - 1000) },
      );

    const payRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(payRes.status).toBe(409);

    const updated = await dataSource
      .getRepository(Booking)
      .findOneByOrFail({ id: bookingId });
    expect(updated.status).toBe('EXPIRED');

    const seatmapRes = await request(app.getHttpServer()).get(
      `/search/flights/${instance.id}/seatmap`,
    );
    const seat = seatmapRes.body.data.seats.find(
      (s: { seatCode: string }) => s.seatCode === '3C',
    );
    expect(seat.status).toBe('FREE');
  });

  it('an idempotency-key retry on payment returns the same ticketed booking, not a double charge', async () => {
    const instance = await freshInstance();
    const { accessToken } = await loginAsCustomer(app, '09130000011');
    const key = `pay-idem-${instance.id}`;

    const createRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'پرداخت تکراری', seatCode: '3A' }],
      });
    expect(createRes.status).toBe(201);
    const bookingId = createRes.body.data.id;

    const first = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', key)
      .send({});
    expect(first.status).toBe(201);
    expect(first.body.data.booking.status).toBe('TICKETED');

    const second = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', key)
      .send({});
    expect(second.status).toBe(201);
    expect(second.body.data.booking.id).toBe(first.body.data.booking.id);

    const reconCount = await dataSource
      .getRepository(PaymentReconciliation)
      .countBy({ bookingId });
    expect(reconCount).toBe(1);
  });

  // ── Mandatory concurrency test (CLAUDE.md) ───────────────────────────

  it('two concurrent buyers of the LAST seat — exactly one succeeds, inventory never goes negative', async () => {
    const oneSeatType = `${AIRCRAFT_TYPE}-1SEAT`;
    await upsertSeatMap(dataSource, oneSeatType, {
      businessRowStart: 1,
      businessRowEnd: 0,
      businessColsLeft: [],
      businessColsRight: [],
      economyRowStart: 1,
      economyRowEnd: 1,
      economyColsLeft: ['A'],
      economyColsRight: [],
    });
    const oneSeatFlight = await upsertFlight(
      dataSource,
      'BE-101',
      routeId,
      oneSeatType,
    );
    const departureAt = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
    const instanceRepo = dataSource.getRepository(FlightInstance);
    const instance = await instanceRepo.save(
      instanceRepo.create({
        flightId: oneSeatFlight.id,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 90 * 60 * 1000),
        capacity: 1,
        status: 'SCHEDULED',
      }),
    );

    const buyerA = await loginAsCustomer(app, '09130000009');
    const buyerB = await loginAsCustomer(app, '09130000010');

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${buyerA.accessToken}`)
        .send({
          flightInstanceId: instance.id,
          cabin: 'ECONOMY',
          passengers: [{ fullName: 'خریدار الف', seatCode: '1A' }],
        }),
      request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${buyerB.accessToken}`)
        .send({
          flightInstanceId: instance.id,
          cabin: 'ECONOMY',
          passengers: [{ fullName: 'خریدار ب', seatCode: '1A' }],
        }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const activeBookings = await dataSource.getRepository(Booking).countBy({
      flightInstanceId: instance.id,
      status: In(['HELD', 'PAID', 'TICKETED']),
    });
    expect(activeBookings).toBe(1);
  });
});

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAsCustomer } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

describe('Booking engine (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let routeId: string;
  let flightId: string;
  const AIRCRAFT_TYPE = 'BE2E-TestJet';

  beforeAll(async () => {
    const setupApp = await createTestApp();
    prisma = setupApp.get(PrismaService);

    await prisma.aircraftSeatMap.upsert({
      where: { aircraftType: AIRCRAFT_TYPE },
      update: {},
      create: {
        aircraftType: AIRCRAFT_TYPE,
        businessRowStart: 1,
        businessRowEnd: 1,
        businessColsLeft: ['A'],
        businessColsRight: ['C'],
        economyRowStart: 2,
        economyRowEnd: 3,
        economyColsLeft: ['A', 'B'],
        economyColsRight: ['C'],
      },
    });

    const route = await prisma.route.upsert({
      where: { originCode_destCode: { originCode: 'THR', destCode: 'KIH' } },
      update: {},
      create: { originCode: 'THR', destCode: 'KIH', durationMin: 90 },
    });
    routeId = route.id;

    const flight = await prisma.flight.upsert({
      where: { flightNo: 'BE-100' },
      update: {},
      create: {
        flightNo: 'BE-100',
        routeId,
        aircraftType: AIRCRAFT_TYPE,
      },
    });
    flightId = flight.id;

    await setupApp.close();
  });

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function freshInstance(daysAhead = 40) {
    const departureAt = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    return prisma.flightInstance.create({
      data: {
        flightId,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 90 * 60 * 1000),
        capacity: 6,
        status: 'SCHEDULED',
      },
    });
  }

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

    const ledger = await prisma.ledgerEntry.findFirst({
      where: { bookingId, type: 'SALE' },
    });
    expect(ledger).toBeTruthy();
    expect(ledger!.signedAmountIrr).toBe(payRes.body.data.booking.priceIrr);
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
    const count = await prisma.booking.count({
      where: {
        flightInstanceId: instance.id,
        passengers: { some: { seatCode: '3B' } },
      },
    });
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

    await prisma.booking.update({
      where: { id: bookingId },
      data: { holdExpiresAt: new Date(Date.now() - 1000) },
    });

    const payRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(payRes.status).toBe(409);

    const updated = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    expect(updated.status).toBe('EXPIRED');

    const seatmapRes = await request(app.getHttpServer()).get(
      `/search/flights/${instance.id}/seatmap`,
    );
    const seat = seatmapRes.body.data.seats.find(
      (s: { seatCode: string }) => s.seatCode === '3C',
    );
    expect(seat.status).toBe('FREE');
  });

  // ── Mandatory concurrency test (CLAUDE.md) ───────────────────────────

  it('two concurrent buyers of the LAST seat — exactly one succeeds, inventory never goes negative', async () => {
    const oneSeatType = `${AIRCRAFT_TYPE}-1SEAT`;
    await prisma.aircraftSeatMap.upsert({
      where: { aircraftType: oneSeatType },
      update: {},
      create: {
        aircraftType: oneSeatType,
        businessRowStart: 1,
        businessRowEnd: 0,
        businessColsLeft: [],
        businessColsRight: [],
        economyRowStart: 1,
        economyRowEnd: 1,
        economyColsLeft: ['A'],
        economyColsRight: [],
      },
    });
    const oneSeatFlight = await prisma.flight.upsert({
      where: { flightNo: 'BE-101' },
      update: {},
      create: { flightNo: 'BE-101', routeId, aircraftType: oneSeatType },
    });
    const departureAt = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
    const instance = await prisma.flightInstance.create({
      data: {
        flightId: oneSeatFlight.id,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 90 * 60 * 1000),
        capacity: 1,
        status: 'SCHEDULED',
      },
    });

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

    const activeBookings = await prisma.booking.count({
      where: {
        flightInstanceId: instance.id,
        status: { in: ['HELD', 'PAID', 'TICKETED'] },
      },
    });
    expect(activeBookings).toBe(1);
  });
});

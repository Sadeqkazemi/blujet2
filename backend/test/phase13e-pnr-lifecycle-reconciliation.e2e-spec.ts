import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createTestApp } from './helpers/app.helper';
import { loginAs, loginAsCustomer } from './helpers/login.helper';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Phase 13 Part E — real DEPARTED materialization, FLOWN/NO_SHOW booking
 * lifecycle, and the payment-reconciliation queue for a GATEWAY payment
 * that succeeds but whose ticketing transaction then fails. See
 * docs/DB_SCHEMA.md Phase 13 Part E. */
describe('Phase 13 Part E — PNR lifecycle + payment reconciliation', () => {
  let app: INestApplication<App>;
  const AIRCRAFT_TYPE = 'P13E-Jet';
  let flightId: string;
  const createdInstanceIds: string[] = [];
  const createdBookingIds: string[] = [];

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  beforeAll(async () => {
    app = await createTestApp();

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
        economyRowEnd: 5,
        economyColsLeft: ['A'],
        economyColsRight: ['C'],
      },
    });
    const route = await prisma.route.upsert({
      where: { originCode_destCode: { originCode: 'THR', destCode: 'BND' } },
      update: {},
      create: { originCode: 'THR', destCode: 'BND', durationMin: 80 },
    });
    const flight = await prisma.flight.upsert({
      where: { flightNo: 'P13E-1' },
      update: {},
      create: {
        flightNo: 'P13E-1',
        routeId: route.id,
        aircraftType: AIRCRAFT_TYPE,
      },
    });
    flightId = flight.id;
  });

  afterAll(async () => {
    await prisma.paymentReconciliation.deleteMany({
      where: { bookingId: { in: createdBookingIds } },
    });
    await prisma.passenger.deleteMany({
      where: { bookingId: { in: createdBookingIds } },
    });
    await prisma.ledgerEntry.deleteMany({
      where: { bookingId: { in: createdBookingIds } },
    });
    await prisma.booking.deleteMany({
      where: { id: { in: createdBookingIds } },
    });
    await prisma.flightInstance.deleteMany({
      where: { id: { in: createdInstanceIds } },
    });
    await prisma.flight.deleteMany({ where: { id: flightId } });
    await prisma.aircraftSeatMap.deleteMany({
      where: { aircraftType: AIRCRAFT_TYPE },
    });

    await app.close();
    await prisma.$disconnect();
  });

  async function makeInstance(daysOffset: number) {
    const departureAt = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000);
    const instance = await prisma.flightInstance.create({
      data: {
        flightId,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 80 * 60 * 1000),
        capacity: 10,
        status: 'SCHEDULED',
      },
    });
    createdInstanceIds.push(instance.id);
    return instance;
  }

  it('GET /flights/overview materializes a past-departure SCHEDULED instance to DEPARTED', async () => {
    const instance = await makeInstance(-2);
    const { accessToken } = await loginAs(app, 'senior.rahimi');

    const res = await request(app.getHttpServer())
      .get('/flights/overview')
      .set(auth(accessToken!));
    expect(res.status).toBe(200);

    const refreshed = await prisma.flightInstance.findUniqueOrThrow({
      where: { id: instance.id },
    });
    expect(refreshed.status).toBe('DEPARTED');
  });

  it('a TICKETED booking on a departed flight defaults to FLOWN; staff can override to NO_SHOW; illegal transitions rejected', async () => {
    const instance = await makeInstance(-1);
    const ceo = await loginAs(app, 'ceo');

    const issued = await request(app.getHttpServer())
      .post('/reservation/pnr')
      .set(auth(ceo.accessToken!))
      .send({
        flightInstanceId: instance.id,
        seatCode: '1A',
        passengerName: 'مسافر آزمون عدم حضور',
      });
    expect(issued.status).toBe(201);
    createdBookingIds.push(
      (
        await prisma.booking.findUniqueOrThrow({
          where: { pnr: issued.body.data.pnr },
        })
      ).id,
    );
    const pnr = issued.body.data.pnr as string;

    // Reading detail lazily flips TICKETED -> FLOWN once the flight has departed.
    const detail = await request(app.getHttpServer())
      .get(`/reservation/pnr/${pnr}`)
      .set(auth(ceo.accessToken!));
    expect(detail.body.data.status).toBe('FLOWN');

    const noShow = await request(app.getHttpServer())
      .patch(`/reservation/pnr/${pnr}/no-show`)
      .set(auth(ceo.accessToken!));
    expect(noShow.status).toBe(200);
    expect(noShow.body.data.status).toBe('NO_SHOW');

    const again = await request(app.getHttpServer())
      .patch(`/reservation/pnr/${pnr}/no-show`)
      .set(auth(ceo.accessToken!));
    expect(again.status).toBe(409);
  });

  it('marking no-show on a not-yet-departed flight is rejected (FLIGHT_NOT_DEPARTED)', async () => {
    const instance = await makeInstance(30);
    const ceo = await loginAs(app, 'ceo');

    const issued = await request(app.getHttpServer())
      .post('/reservation/pnr')
      .set(auth(ceo.accessToken!))
      .send({
        flightInstanceId: instance.id,
        seatCode: '2A',
        passengerName: 'مسافر آینده',
      });
    expect(issued.status).toBe(201);
    createdBookingIds.push(
      (
        await prisma.booking.findUniqueOrThrow({
          where: { pnr: issued.body.data.pnr },
        })
      ).id,
    );

    const noShow = await request(app.getHttpServer())
      .patch(`/reservation/pnr/${issued.body.data.pnr}/no-show`)
      .set(auth(ceo.accessToken!));
    expect(noShow.status).toBe(409);
    expect(noShow.body.error.code).toBe('FLIGHT_NOT_DEPARTED');
  });

  it('a successful GATEWAY payment resolves its PaymentReconciliation row', async () => {
    const instance = await makeInstance(45);
    const phone = `0913${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
    const { accessToken } = await loginAsCustomer(app, phone);

    const created = await request(app.getHttpServer())
      .post('/bookings')
      .set(auth(accessToken!))
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مسافر تطبیق موفق', seatCode: '3A' }],
      });
    expect(created.status).toBe(201);
    const bookingId = created.body.data.id as string;
    createdBookingIds.push(bookingId);

    const paid = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set(auth(accessToken!))
      .send({});
    expect(paid.status).toBe(201);
    expect(paid.body.data.booking.status).toBe('TICKETED');

    const reconciliation = await prisma.paymentReconciliation.findFirst({
      where: { bookingId },
    });
    expect(reconciliation).not.toBeNull();
    expect(reconciliation!.status).toBe('RESOLVED');
    expect(reconciliation!.amountIrr).toBe(paid.body.data.booking.priceIrr);
  });

  it('a GATEWAY payment whose ticketing transaction fails (bad promo) leaves a PENDING reconciliation row — the real mismatch queue', async () => {
    const instance = await makeInstance(46);
    const phone = `0914${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
    const { accessToken } = await loginAsCustomer(app, phone);

    const created = await request(app.getHttpServer())
      .post('/bookings')
      .set(auth(accessToken!))
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مسافر مغایرت', seatCode: '4A' }],
      });
    expect(created.status).toBe(201);
    const bookingId = created.body.data.id as string;
    createdBookingIds.push(bookingId);

    // The gateway is asked for and confirms payment before this promo code
    // is validated inside the ticketing transaction — a real ordering bug
    // this phase fixes the tracking for, not something contrived for the test.
    const paid = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set(auth(accessToken!))
      .send({ promoCode: 'THIS-CODE-DOES-NOT-EXIST' });
    expect(paid.status).toBe(400);

    const stillHeld = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    expect(stillHeld.status).toBe('HELD');

    const reconciliation = await prisma.paymentReconciliation.findFirst({
      where: { bookingId },
    });
    expect(reconciliation).not.toBeNull();
    expect(reconciliation!.status).toBe('PENDING');

    const finance = await loginAs(app, 'finance.karimi');
    const queue = await request(app.getHttpServer())
      .get('/reconciliation')
      .set(auth(finance.accessToken!));
    expect(queue.status).toBe(200);
    const entry = queue.body.data.find(
      (r: { id: string }) => r.id === reconciliation!.id,
    );
    expect(entry).toBeDefined();
    expect(entry.bookingStatus).toBe('HELD');

    const senior = await loginAs(app, 'senior.rahimi');
    const forbidden = await request(app.getHttpServer())
      .get('/reconciliation')
      .set(auth(senior.accessToken!));
    expect(forbidden.status).toBe(403);

    const resolved = await request(app.getHttpServer())
      .patch(`/reconciliation/${reconciliation!.id}/resolve`)
      .set(auth(finance.accessToken!))
      .send({ resolutionNote: 'بلیط به‌صورت دستی صادر و بررسی شد.' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.status).toBe('RESOLVED');

    const resolvedAgain = await request(app.getHttpServer())
      .patch(`/reconciliation/${reconciliation!.id}/resolve`)
      .set(auth(finance.accessToken!))
      .send({ resolutionNote: 'دوباره' });
    expect(resolvedAgain.status).toBe(409);

    const queueAfter = await request(app.getHttpServer())
      .get('/reconciliation')
      .set(auth(finance.accessToken!));
    expect(
      queueAfter.body.data.some(
        (r: { id: string }) => r.id === reconciliation!.id,
      ),
    ).toBe(false);
  });
});

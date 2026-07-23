import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createTestApp } from './helpers/app.helper';
import { loginAs, loginAsCustomer, stepUpFor } from './helpers/login.helper';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Phase 13 — reservation engine completion Part A: sale window, real
 * inventory pools (agency/charter/public), and aircraft-type change. */
describe('Phase 13 — reservation engine completion', () => {
  let app: INestApplication<App>;
  const AIRCRAFT_SMALL = 'P13-SmallJet'; // 4 economy seats, no business
  const AIRCRAFT_LARGE = 'P13-LargeJet'; // 8 economy seats, no business
  let routeId: string;
  let flightId: string;
  // One shared customer login for the whole file — the OTP endpoint is
  // strictly rate-limited (5/60s) and a booking's channel/pool doesn't
  // depend on which customer places it, so there's no reason to burn a
  // fresh OTP login per test.
  let customerToken: string;
  let staffToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    customerToken = (await loginAsCustomer(app, '09901119901')).accessToken!;
    staffToken = (await loginAs(app, 'senior.rahimi')).accessToken!;

    await prisma.aircraftSeatMap.upsert({
      where: { aircraftType: AIRCRAFT_SMALL },
      update: {},
      create: {
        aircraftType: AIRCRAFT_SMALL,
        businessRowStart: 1,
        businessRowEnd: 0,
        businessColsLeft: [],
        businessColsRight: [],
        economyRowStart: 1,
        economyRowEnd: 2,
        economyColsLeft: ['A'],
        economyColsRight: ['C'],
      },
    });
    await prisma.aircraftSeatMap.upsert({
      where: { aircraftType: AIRCRAFT_LARGE },
      update: {},
      create: {
        aircraftType: AIRCRAFT_LARGE,
        businessRowStart: 1,
        businessRowEnd: 0,
        businessColsLeft: [],
        businessColsRight: [],
        economyRowStart: 1,
        economyRowEnd: 4,
        economyColsLeft: ['A'],
        economyColsRight: ['C'],
      },
    });

    const route = await prisma.route.upsert({
      where: { originCode_destCode: { originCode: 'THR', destCode: 'ASR' } },
      update: {},
      create: { originCode: 'THR', destCode: 'ASR', durationMin: 70 },
    });
    routeId = route.id;

    const flight = await prisma.flight.upsert({
      where: { flightNo: 'P13-1' },
      update: {},
      create: { flightNo: 'P13-1', routeId, aircraftType: AIRCRAFT_SMALL },
    });
    flightId = flight.id;
  });

  afterAll(async () => {
    const instances = await prisma.flightInstance.findMany({
      where: { flightId },
    });
    const iids = instances.map((i) => i.id);
    const bookings = await prisma.booking.findMany({
      where: { flightInstanceId: { in: iids } },
    });
    const bids = bookings.map((b) => b.id);
    // Paying a booking creates LedgerEntry/ClubPointsEntry/WalletEntry rows
    // — must be cleaned up too, or their revenue lingers in reporting's
    // aggregates (which sum LedgerEntry directly) even after the Booking
    // row itself is gone.
    await prisma.paymentReconciliation.deleteMany({
      where: { bookingId: { in: bids } },
    });
    await prisma.ledgerEntry.deleteMany({ where: { bookingId: { in: bids } } });
    await prisma.clubPointsEntry.deleteMany({
      where: { bookingId: { in: bids } },
    });
    await prisma.walletEntry.deleteMany({ where: { bookingId: { in: bids } } });
    await prisma.passenger.deleteMany({ where: { bookingId: { in: bids } } });
    await prisma.booking.deleteMany({ where: { id: { in: bids } } });
    await prisma.flightInstance.deleteMany({ where: { id: { in: iids } } });
    await prisma.flight.deleteMany({ where: { id: flightId } });
    await prisma.route.deleteMany({ where: { id: routeId } });
    await prisma.aircraftSeatMap.deleteMany({
      where: { aircraftType: { in: [AIRCRAFT_SMALL, AIRCRAFT_LARGE] } },
    });

    await app.close();
    await prisma.$disconnect();
  });

  function freshInstance(overrides: {
    capacity?: number;
    charterSeats?: number;
    agencySeatsAllocated?: number;
    saleStartsAt?: Date | null;
    saleEndsAt?: Date | null;
    daysAhead?: number;
  }) {
    const departureAt = new Date(
      Date.now() + (overrides.daysAhead ?? 60) * 24 * 60 * 60 * 1000,
    );
    return prisma.flightInstance.create({
      data: {
        flightId,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 70 * 60 * 1000),
        capacity: overrides.capacity ?? 4,
        charterSeats: overrides.charterSeats ?? 0,
        agencySeatsAllocated: overrides.agencySeatsAllocated ?? 0,
        saleStartsAt: overrides.saleStartsAt ?? null,
        saleEndsAt: overrides.saleEndsAt ?? null,
        status: 'SCHEDULED',
      },
    });
  }

  it('excludes an instance whose sale window has ended from search, and rejects booking it', async () => {
    const instance = await freshInstance({
      saleEndsAt: new Date(Date.now() - 60 * 60 * 1000), // ended an hour ago
    });
    const date = instance.departureAt.toISOString().slice(0, 10);

    const search = await request(app.getHttpServer())
      .get('/search/flights')
      .query({ origin: 'THR', dest: 'ASR', date });
    expect(
      search.body.data.some(
        (r: { flightInstanceId: string }) => r.flightInstanceId === instance.id,
      ),
    ).toBe(false);

    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مسافر تست پنجره فروش', seatCode: '1A' }],
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SALE_WINDOW_CLOSED');
  });

  it('allows booking an instance whose sale window has not started yet, once inside it', async () => {
    const instance = await freshInstance({
      saleStartsAt: new Date(Date.now() - 60 * 60 * 1000),
      saleEndsAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مسافر داخل بازه', seatCode: '1A' }],
      });
    expect(res.status).toBe(201);
  });

  it('rejects a public booking once the public pool (capacity minus agency/charter quotas) is exhausted, even with physical seats free', async () => {
    // capacity 4, agency 2, charter 1 → public pool = 1
    const instance = await freshInstance({
      capacity: 4,
      charterSeats: 1,
      agencySeatsAllocated: 2,
    });

    const firstBooking = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مسافر اول', seatCode: '1A' }],
      });
    expect(firstBooking.status).toBe(201);

    // Second SYSTEM-channel booking must be rejected: public pool (1) is
    // now full, even though 3 physical seats remain unsold overall.
    const secondBooking = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مسافر دوم', seatCode: '1C' }],
      });
    expect(secondBooking.status).toBe(409);
    expect(secondBooking.body.error.code).toBe('POOL_EXHAUSTED');
  });

  it('rejects an aircraft-type change that would drop capacity below confirmed bookings, and accepts one that fits', async () => {
    const instance = await freshInstance({ capacity: 4 });
    // Two full booking+pay flows plus two step-up request/verify round
    // trips (each hashing a code with argon2) push this past Jest's
    // default 5s test timeout.

    const booking = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مسافر قطعی', seatCode: '1A' }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/bookings/${booking.body.data.id}/pay`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({})
      .expect(201);

    // A larger-capacity type always fits the 1 confirmed passenger.
    const stepUp1 = await stepUpFor(
      app,
      staffToken,
      'senior.rahimi',
      'PRICE_CAPACITY_CHANGE',
    );
    const okChange = await request(app.getHttpServer())
      .patch(`/flights/${instance.id}/aircraft`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ aircraftType: AIRCRAFT_LARGE, ...stepUp1 });
    expect(okChange.status).toBe(200);
    expect(okChange.body.data.capacity).toBe(8);

    // Now exercise the rejection branch directly: a fresh instance with
    // its own confirmed booking, then a change to a 0-seat aircraft type
    // (enumerateSeats returns [] → capacity 0 < the 1 confirmed passenger).
    const tinyInstance = await freshInstance({ capacity: 1 });
    const tinyBooking = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        flightInstanceId: tinyInstance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مسافر تنها', seatCode: '1A' }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/bookings/${tinyBooking.body.data.id}/pay`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({})
      .expect(201);

    await prisma.aircraftSeatMap.upsert({
      where: { aircraftType: 'P13-EmptyJet' },
      update: {},
      create: {
        aircraftType: 'P13-EmptyJet',
        businessRowStart: 1,
        businessRowEnd: 0,
        businessColsLeft: [],
        businessColsRight: [],
        economyRowStart: 1,
        economyRowEnd: 0,
        economyColsLeft: [],
        economyColsRight: [],
      },
    });
    const stepUp2 = await stepUpFor(
      app,
      staffToken,
      'senior.rahimi',
      'PRICE_CAPACITY_CHANGE',
    );
    const rejectedChange = await request(app.getHttpServer())
      .patch(`/flights/${tinyInstance.id}/aircraft`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ aircraftType: 'P13-EmptyJet', ...stepUp2 });
    expect(rejectedChange.status).toBe(409);
    expect(rejectedChange.body.error.code).toBe('CAPACITY_BELOW_CONFIRMED');

    await prisma.aircraftSeatMap.delete({
      where: { aircraftType: 'P13-EmptyJet' },
    });
  }, 15000);
});

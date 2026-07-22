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

/** Phase 13 Part B — manageable fare classes: capacity-sum validation,
 * validity window, channel eligibility, tax breakout, and delete-blocked
 * when an active booking already uses the class. */
describe('Phase 13 Part B — fare-class management', () => {
  let app: INestApplication<App>;
  const AIRCRAFT_TYPE = 'P13B-Jet'; // 4 economy seats, no business
  let routeId: string;
  let flightId: string;
  let staffToken: string;
  let customerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    staffToken = (await loginAs(app, 'senior.rahimi')).accessToken!;
    customerToken = (await loginAsCustomer(app, '09901119920')).accessToken!;

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
        economyRowEnd: 2,
        economyColsLeft: ['A'],
        economyColsRight: ['C'],
      },
    });

    const route = await prisma.route.upsert({
      where: { originCode_destCode: { originCode: 'THR', destCode: 'BND' } },
      update: {},
      create: { originCode: 'THR', destCode: 'BND', durationMin: 80 },
    });
    routeId = route.id;

    const flight = await prisma.flight.upsert({
      where: { flightNo: 'P13B-1' },
      update: {},
      create: { flightNo: 'P13B-1', routeId, aircraftType: AIRCRAFT_TYPE },
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
    await prisma.fareRule.deleteMany({
      where: { flightInstanceId: { in: iids } },
    });
    await prisma.flightInstance.deleteMany({ where: { id: { in: iids } } });
    await prisma.flight.deleteMany({ where: { id: flightId } });
    await prisma.route.deleteMany({ where: { id: routeId } });
    await prisma.aircraftSeatMap.deleteMany({
      where: { aircraftType: AIRCRAFT_TYPE },
    });

    await app.close();
    await prisma.$disconnect();
  });

  function freshInstance(daysAhead = 90) {
    const departureAt = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    return prisma.flightInstance.create({
      data: {
        flightId,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 80 * 60 * 1000),
        capacity: 4,
        status: 'SCHEDULED',
      },
    });
  }

  it('rejects a fare rule whose seatsAllocated would push the cabin total past its physical seat count', async () => {
    const instance = await freshInstance();
    await request(app.getHttpServer())
      .post(`/flights/${instance.id}/fare-rules`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        cabin: 'ECONOMY',
        classCode: 'Y',
        priceIrr: 30_000_000,
        seatsAllocated: 3,
      })
      .expect(201);

    // Economy cabin only has 4 physical seats; 3 already allocated to Y.
    const res = await request(app.getHttpServer())
      .post(`/flights/${instance.id}/fare-rules`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        cabin: 'ECONOMY',
        classCode: 'B',
        priceIrr: 40_000_000,
        seatsAllocated: 2,
      });
    expect(res.status).toBe(400);
  });

  it('rejects validUntil <= validFrom', async () => {
    const instance = await freshInstance();
    const res = await request(app.getHttpServer())
      .post(`/flights/${instance.id}/fare-rules`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        cabin: 'ECONOMY',
        classCode: 'Y',
        priceIrr: 30_000_000,
        seatsAllocated: 1,
        validFrom: '2026-08-01T00:00:00.000Z',
        validUntil: '2026-07-01T00:00:00.000Z',
      });
    expect(res.status).toBe(400);
  });

  it('a fare rule outside its validity window is invisible to pricing, and tax is included in the booking total', async () => {
    const instance = await freshInstance();
    await request(app.getHttpServer())
      .post(`/flights/${instance.id}/fare-rules`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        cabin: 'ECONOMY',
        classCode: 'EXPIRED',
        priceIrr: 10_000_000,
        seatsAllocated: 2,
        validUntil: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/flights/${instance.id}/fare-rules`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        cabin: 'ECONOMY',
        classCode: 'Y',
        priceIrr: 25_000_000,
        seatsAllocated: 2,
        taxIrr: 1_000_000,
      })
      .expect(201);

    const booking = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مسافر تست کلاس نرخی', seatCode: '1A' }],
      });
    expect(booking.status).toBe(201);
    // The EXPIRED (cheaper) class must be skipped — Y's price + tax used.
    expect(booking.body.data.priceIrr).toBe(25_000_000 + 1_000_000);
    expect(booking.body.data.taxIrr).toBe(1_000_000);
  });

  it('a fare rule scoped to a different channel is invisible to a SYSTEM-channel booking', async () => {
    const instance = await freshInstance();
    await request(app.getHttpServer())
      .post(`/flights/${instance.id}/fare-rules`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        cabin: 'ECONOMY',
        classCode: 'AGY',
        priceIrr: 5_000_000,
        seatsAllocated: 4,
        allowedChannels: ['AGENCY'],
      })
      .expect(201);

    const search = await request(app.getHttpServer())
      .get('/search/flights')
      .query({
        origin: 'THR',
        dest: 'BND',
        date: instance.departureAt.toISOString().slice(0, 10),
      });
    const row = search.body.data.find(
      (r: { flightInstanceId: string }) => r.flightInstanceId === instance.id,
    );
    const eco = row.cabins.find(
      (c: { cabin: string }) => c.cabin === 'ECONOMY',
    );
    // AGY-only rule invisible to public search → falls back to flat pricing,
    // not the 5,000,000 AGENCY-only rate.
    expect(eco.priceIrr).not.toBe(5_000_000);
  });

  it('rejects deleting a fare rule that an active booking is already stamped with', async () => {
    const instance = await freshInstance();
    const rule = await request(app.getHttpServer())
      .post(`/flights/${instance.id}/fare-rules`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        cabin: 'ECONOMY',
        classCode: 'Y',
        priceIrr: 20_000_000,
        seatsAllocated: 4,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مسافر کلاس فعال', seatCode: '1A' }],
      })
      .expect(201);

    const del = await request(app.getHttpServer())
      .delete(`/flights/${instance.id}/fare-rules/${rule.body.data.id}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(del.status).toBe(409);
  });
});

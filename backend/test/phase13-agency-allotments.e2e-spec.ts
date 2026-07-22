import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createTestApp } from './helpers/app.helper';
import { loginAs } from './helpers/login.helper';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Phase 13 Part C — per-agency allotments: capacity-sum validation
 * against the instance's coarse agencySeatsAllocated cap, SOFT release
 * lazily excluding a rule from that sum, and delete-blocked-by-active-
 * booking (a no-op guard today since nothing creates AGENCY bookings yet
 * — see docs/DB_SCHEMA.md). */
describe('Phase 13 Part C — agency allotments', () => {
  let app: INestApplication<App>;
  const AIRCRAFT_TYPE = 'P13C-Jet';
  let routeId: string;
  let flightId: string;
  let staffToken: string;
  let agencyUserId: string;

  beforeAll(async () => {
    app = await createTestApp();
    staffToken = (await loginAs(app, 'senior.rahimi')).accessToken!;

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
      where: { originCode_destCode: { originCode: 'THR', destCode: 'AWZ' } },
      update: {},
      create: { originCode: 'THR', destCode: 'AWZ', durationMin: 75 },
    });
    routeId = route.id;

    const flight = await prisma.flight.upsert({
      where: { flightNo: 'P13C-1' },
      update: {},
      create: { flightNo: 'P13C-1', routeId, aircraftType: AIRCRAFT_TYPE },
    });
    flightId = flight.id;

    const agencyUser = await prisma.user.upsert({
      where: { phone: '+989121190001' },
      update: {},
      create: {
        role: 'AGENCY',
        phone: '+989121190001',
        fullName: 'آژانس تست فاز سیزده',
        isActive: true,
      },
    });
    agencyUserId = agencyUser.id;
    await prisma.agencyProfile.upsert({
      where: { userId: agencyUser.id },
      update: {},
      create: {
        userId: agencyUser.id,
        licenseNo: 'P13C-LIC-1',
        managerName: 'مدیر تست',
        phone: '+989121190001',
        email: 'p13c-agency@example.com',
        city: 'تهران',
        address: 'تست',
      },
    });
  });

  afterAll(async () => {
    const instances = await prisma.flightInstance.findMany({
      where: { flightId },
    });
    const iids = instances.map((i) => i.id);
    await prisma.agencyAllotment.deleteMany({
      where: { flightInstanceId: { in: iids } },
    });
    await prisma.flightInstance.deleteMany({ where: { id: { in: iids } } });
    await prisma.flight.deleteMany({ where: { id: flightId } });
    await prisma.route.deleteMany({ where: { id: routeId } });
    await prisma.agencyProfile.deleteMany({ where: { userId: agencyUserId } });
    await prisma.user.deleteMany({ where: { id: agencyUserId } });
    await prisma.aircraftSeatMap.deleteMany({
      where: { aircraftType: AIRCRAFT_TYPE },
    });

    await app.close();
    await prisma.$disconnect();
  });

  function freshInstance(agencySeatsAllocated: number | null, daysAhead = 90) {
    const departureAt = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    return prisma.flightInstance.create({
      data: {
        flightId,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 75 * 60 * 1000),
        capacity: 10,
        agencySeatsAllocated: agencySeatsAllocated ?? undefined,
        status: 'SCHEDULED',
      },
    });
  }

  it('rejects creating an allotment when the instance has no agencySeatsAllocated quota set', async () => {
    const instance = await freshInstance(null);
    const res = await request(app.getHttpServer())
      .post(`/flights/${instance.id}/allotments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ agencyId: agencyUserId, seatsAllocated: 5 });
    expect(res.status).toBe(400);
  });

  it('rejects an allotment that would push the total past agencySeatsAllocated', async () => {
    const instance = await freshInstance(5);
    await request(app.getHttpServer())
      .post(`/flights/${instance.id}/allotments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ agencyId: agencyUserId, seatsAllocated: 4 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/flights/${instance.id}/allotments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ agencyId: agencyUserId, seatsAllocated: 2 });
    expect(res.status).toBe(400);
  });

  it('a SOFT allotment past its releaseAt is excluded from the active sum, freeing room for a new one', async () => {
    const instance = await freshInstance(5);
    await request(app.getHttpServer())
      .post(`/flights/${instance.id}/allotments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        agencyId: agencyUserId,
        seatsAllocated: 5,
        type: 'SOFT',
        releaseAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      })
      .expect(201);

    // Without the lazy SOFT-release exclusion this would 400 (5 + 3 > 5).
    const res = await request(app.getHttpServer())
      .post(`/flights/${instance.id}/allotments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ agencyId: agencyUserId, seatsAllocated: 3 });
    expect(res.status).toBe(201);

    const list = await request(app.getHttpServer())
      .get(`/flights/${instance.id}/allotments`)
      .set('Authorization', `Bearer ${staffToken}`);
    const expired = list.body.data.find(
      (r: { seatsAllocated: number }) => r.seatsAllocated === 5,
    );
    expect(expired.active).toBe(false);
  });

  it('deletes an allotment with no active booking', async () => {
    const instance = await freshInstance(5);
    const created = await request(app.getHttpServer())
      .post(`/flights/${instance.id}/allotments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ agencyId: agencyUserId, seatsAllocated: 3 })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/flights/${instance.id}/allotments/${created.body.data.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
  });
});

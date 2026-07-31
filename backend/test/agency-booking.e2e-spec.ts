import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import * as crypto from 'node:crypto';
import * as argon2 from 'argon2';
import { TypeORMClient } from '../generated/typeorm/client';
import { TypeORMPg } from '@typeorm/adapter-pg';
import { createTestApp } from './helpers/app.helper';
import { loginAs } from './helpers/login.helper';
import { hashApiKey } from '../src/modules/agency-api/agency-api-key.util';

const typeorm = new TypeORMClient({
  adapter: new TypeORMPg({ connectionString: process.env.DATABASE_URL }),
});

const AGENCY_PASSWORD = 'AgencyTest@123';
const AIRCRAFT_TYPE = 'ABK-Jet';

describe('Agency booking + B2B API (e2e)', () => {
  let app: INestApplication<App>;
  let agencyUserId: string;
  let agencyPhone: string;
  let agencyToken: string;
  let apiKeyRaw: string;
  let staffToken: string;
  let routeId: string;
  let flightId: string;

  beforeAll(async () => {
    app = await createTestApp();
    staffToken = (await loginAs(app, 'senior.rahimi')).accessToken!;

    await typeorm.aircraftSeatMap.upsert({
      where: { aircraftType: AIRCRAFT_TYPE },
      update: {},
      create: {
        aircraftType: AIRCRAFT_TYPE,
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

    const route = await typeorm.route.upsert({
      where: { originCode_destCode: { originCode: 'THR', destCode: 'MHD' } },
      update: {},
      create: { originCode: 'THR', destCode: 'MHD', durationMin: 80 },
    });
    routeId = route.id;

    const flight = await typeorm.flight.upsert({
      where: { flightNo: 'ABK-1' },
      update: {},
      create: { flightNo: 'ABK-1', routeId, aircraftType: AIRCRAFT_TYPE },
    });
    flightId = flight.id;

    agencyPhone = `+9891${crypto.randomInt(10_000_000, 100_000_000)}`;
    const passwordHash = await argon2.hash(AGENCY_PASSWORD);
    const agencyUser = await typeorm.user.create({
      data: {
        role: 'AGENCY',
        phone: agencyPhone,
        fullName: 'آژانس رزرو E2E',
        passwordHash,
        isActive: true,
      },
    });
    agencyUserId = agencyUser.id;

    await typeorm.agencyProfile.create({
      data: {
        userId: agencyUserId,
        licenseNo: 'ABK-LIC',
        managerName: 'مدیر E2E',
        phone: agencyPhone,
        email: 'abk@example.com',
        city: 'تهران',
        address: 'تست',
      },
    });

    await typeorm.agencyCreditLine.create({
      data: { agencyId: agencyUserId, limitIrr: 2_000_000_000 },
    });

    apiKeyRaw = `bjk_${crypto.randomBytes(16).toString('base64url')}`;
    await typeorm.agencyApiKey.create({
      data: {
        agencyId: agencyUserId,
        keyHash: hashApiKey(apiKeyRaw),
        scope: 'SEARCH_BOOK',
        status: 'ACTIVE',
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/agency/login')
      .send({ phone: agencyPhone, password: AGENCY_PASSWORD });
    agencyToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await typeorm.agencyApiKey.deleteMany({ where: { agencyId: agencyUserId } });
    await typeorm.ledgerEntry.deleteMany({ where: { agencyId: agencyUserId } });
    await typeorm.passenger.deleteMany({
      where: { booking: { agencyId: agencyUserId } },
    });
    await typeorm.booking.deleteMany({ where: { agencyId: agencyUserId } });
    await typeorm.agencyAllotment.deleteMany({ where: { agencyId: agencyUserId } });
    await typeorm.agencyCreditLine.deleteMany({ where: { agencyId: agencyUserId } });
    await typeorm.agencyProfile.deleteMany({ where: { userId: agencyUserId } });
    await typeorm.auditLog.deleteMany({ where: { actorId: agencyUserId } });
    await typeorm.user.deleteMany({ where: { id: agencyUserId } });
    await typeorm.flightInstance.deleteMany({ where: { flightId } });
    await typeorm.flight.deleteMany({ where: { id: flightId } });
    await typeorm.route.deleteMany({ where: { id: routeId } });
    await typeorm.aircraftSeatMap.deleteMany({ where: { aircraftType: AIRCRAFT_TYPE } });

    await app.close();
    await typeorm.$disconnect();
  });

  async function freshInstance(agencySeatsAllocated = 4) {
    const departureAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const instance = await typeorm.flightInstance.create({
      data: {
        flightId,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 80 * 60 * 1000),
        capacity: 8,
        agencySeatsAllocated,
        status: 'SCHEDULED',
      },
    });

    await request(app.getHttpServer())
      .post(`/flights/${instance.id}/allotments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        agencyId: agencyUserId,
        seatsAllocated: agencySeatsAllocated,
        contractPriceIrr: 35_000_000,
      })
      .expect(201);

    return instance;
  }

  it('portal: create HELD agency booking and issue on credit', async () => {
    const instance = await freshInstance();

    const createRes = await request(app.getHttpServer())
      .post('/agency-portal/bookings')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مسافر آژانس', seatCode: '1A' }],
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('HELD');
    expect(createRes.body.data.priceIrr).toBe(35_000_000);

    const bookingId = createRes.body.data.id;
    const issueRes = await request(app.getHttpServer())
      .post(`/agency-portal/bookings/${bookingId}/issue`)
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({});
    expect(issueRes.status).toBe(201);
    expect(issueRes.body.data.booking.status).toBe('TICKETED');

    const credit = await request(app.getHttpServer())
      .get('/agency-portal/credit')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(credit.body.data.usedIrr).toBeGreaterThanOrEqual(35_000_000);
  });

  it('B2B API: search, book, and issue with X-Api-Key', async () => {
    const instance = await freshInstance();
    const date = instance.departureAt.toISOString().slice(0, 10);

    const searchRes = await request(app.getHttpServer())
      .get('/agency-api/v1/flights')
      .set('X-Api-Key', apiKeyRaw)
      .query({ origin: 'THR', dest: 'MHD', date });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBeGreaterThan(0);

    const seatRes = await request(app.getHttpServer())
      .get(`/agency-api/v1/flights/${instance.id}/seats`)
      .set('X-Api-Key', apiKeyRaw);
    expect(seatRes.status).toBe(200);

    const createRes = await request(app.getHttpServer())
      .post('/agency-api/v1/bookings')
      .set('X-Api-Key', apiKeyRaw)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'B2B مسافر', seatCode: '2A' }],
      });
    expect(createRes.status).toBe(201);

    const issueRes = await request(app.getHttpServer())
      .post(`/agency-api/v1/bookings/${createRes.body.data.id}/issue`)
      .set('X-Api-Key', apiKeyRaw)
      .send({});
    expect(issueRes.status).toBe(201);
    expect(issueRes.body.data.booking.status).toBe('TICKETED');
  });

  it('rejects B2B booking when scope is SEARCH_ONLY', async () => {
    const readOnlyKey = `bjk_${crypto.randomBytes(16).toString('base64url')}`;
    await typeorm.agencyApiKey.create({
      data: {
        agencyId: agencyUserId,
        keyHash: hashApiKey(readOnlyKey),
        scope: 'SEARCH_ONLY',
        status: 'ACTIVE',
      },
    });

    const instance = await freshInstance();
    const res = await request(app.getHttpServer())
      .post('/agency-api/v1/bookings')
      .set('X-Api-Key', readOnlyKey)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'X', seatCode: '3A' }],
      });
    expect(res.status).toBe(403);
  });
});

import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { TypeORMClient } from '../generated/typeorm/client';
import { TypeORMPg } from '@typeorm/adapter-pg';
import { createTestApp } from './helpers/app.helper';
import { loginAsCustomer } from './helpers/login.helper';

const typeorm = new TypeORMClient({
  adapter: new TypeORMPg({ connectionString: process.env.DATABASE_URL }),
});

describe('Connection booking (e2e)', () => {
  let app: INestApplication<App>;
  const AIRCRAFT_TYPE = 'CONN-Jet';
  let routeAbId: string;
  let routeBcId: string;
  let flightAbId: string;
  let flightBcId: string;
  let customerToken: string;
  let customerPhone: string;

  beforeAll(async () => {
    app = await createTestApp();
    customerPhone = '09130000011';

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
        economyRowEnd: 3,
        economyColsLeft: ['A'],
        economyColsRight: ['C'],
      },
    });

    const routeAb = await typeorm.route.upsert({
      where: { originCode_destCode: { originCode: 'THR', destCode: 'IFN' } },
      update: {},
      create: { originCode: 'THR', destCode: 'IFN', durationMin: 70 },
    });
    routeAbId = routeAb.id;

    const routeBc = await typeorm.route.upsert({
      where: { originCode_destCode: { originCode: 'IFN', destCode: 'MHD' } },
      update: {},
      create: { originCode: 'IFN', destCode: 'MHD', durationMin: 70 },
    });
    routeBcId = routeBc.id;

    const flightAb = await typeorm.flight.upsert({
      where: { flightNo: 'CONN-AB' },
      update: {},
      create: { flightNo: 'CONN-AB', routeId: routeAbId, aircraftType: AIRCRAFT_TYPE },
    });
    flightAbId = flightAb.id;

    const flightBc = await typeorm.flight.upsert({
      where: { flightNo: 'CONN-BC' },
      update: {},
      create: { flightNo: 'CONN-BC', routeId: routeBcId, aircraftType: AIRCRAFT_TYPE },
    });
    flightBcId = flightBc.id;

    const login = await loginAsCustomer(app, customerPhone);
    customerToken = login.accessToken!;
  });

  afterAll(async () => {
    const instances = await typeorm.flightInstance.findMany({
      where: { flightId: { in: [flightAbId, flightBcId] } },
      select: { id: true },
    });
    const instanceIds = instances.map((i) => i.id);
    await typeorm.ledgerEntry.deleteMany({
      where: { booking: { flightInstanceId: { in: instanceIds } } },
    });
    await typeorm.paymentReconciliation.deleteMany({
      where: { booking: { flightInstanceId: { in: instanceIds } } },
    });
    await typeorm.passenger.deleteMany({
      where: { booking: { flightInstanceId: { in: instanceIds } } },
    });
    await typeorm.booking.deleteMany({
      where: { flightInstanceId: { in: instanceIds } },
    });
    await typeorm.itinerary.deleteMany({});
    await typeorm.flightInstance.deleteMany({ where: { id: { in: instanceIds } } });
    await typeorm.flight.deleteMany({ where: { id: { in: [flightAbId, flightBcId] } } });
    await typeorm.route.deleteMany({ where: { id: { in: [routeAbId, routeBcId] } } });
    await typeorm.aircraftSeatMap.deleteMany({ where: { aircraftType: AIRCRAFT_TYPE } });

    await app.close();
    await typeorm.$disconnect();
  });

  it('creates a 2-leg HELD connection and pays to TICKETED', async () => {
    const day = new Date(Date.now() + 50 * 24 * 60 * 60 * 1000);
    day.setUTCHours(8, 0, 0, 0);

    const leg1Dep = new Date(day);
    const leg1Arr = new Date(leg1Dep.getTime() + 70 * 60 * 1000);
    const leg2Dep = new Date(leg1Arr.getTime() + 90 * 60 * 1000);
    const leg2Arr = new Date(leg2Dep.getTime() + 70 * 60 * 1000);

    const leg1 = await typeorm.flightInstance.create({
      data: {
        flightId: flightAbId,
        departureAt: leg1Dep,
        arrivalAt: leg1Arr,
        capacity: 6,
        status: 'SCHEDULED',
      },
    });
    const leg2 = await typeorm.flightInstance.create({
      data: {
        flightId: flightBcId,
        departureAt: leg2Dep,
        arrivalAt: leg2Arr,
        capacity: 6,
        status: 'SCHEDULED',
      },
    });

    const createRes = await request(app.getHttpServer())
      .post('/bookings/connection')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        cabin: 'ECONOMY',
        legs: [
          {
            flightInstanceId: leg1.id,
            passengers: [{ fullName: 'اتصال تست', seatCode: '1A' }],
          },
          {
            flightInstanceId: leg2.id,
            passengers: [{ fullName: 'اتصال تست', seatCode: '1A' }],
          },
        ],
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.pnr).toMatch(/^BJ/);
    expect(createRes.body.data.legs).toHaveLength(2);
    expect(createRes.body.data.legs[0].status).toBe('HELD');

    const payRes = await request(app.getHttpServer())
      .post(`/bookings/itinerary/${createRes.body.data.itineraryId}/pay`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ paymentMethod: 'GATEWAY' });
    expect(payRes.status).toBe(201);
    expect(payRes.body.data.itinerary.legs.every((l: { status: string }) => l.status === 'TICKETED')).toBe(true);
  });
});

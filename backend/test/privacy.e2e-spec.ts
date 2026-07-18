import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAsCustomer } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

const RUN = Date.now().toString().slice(-6);
function phoneFor(n: number): string {
  return `09${RUN}${String(n).padStart(3, '0')}`;
}

describe('Privacy / GDPR export & delete (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let flightId: string;
  const AIRCRAFT_TYPE = 'PR2E-TestJet';

  beforeAll(async () => {
    const setupApp = await createTestApp();
    prisma = setupApp.get(PrismaService);

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
        economyColsLeft: ['A', 'B'],
        economyColsRight: ['C'],
      },
    });
    const route = await prisma.route.upsert({
      where: { originCode_destCode: { originCode: 'THR', destCode: 'TBZ' } },
      update: {},
      create: { originCode: 'THR', destCode: 'TBZ', durationMin: 65 },
    });
    const flight = await prisma.flight.upsert({
      where: { flightNo: 'PR-400' },
      update: {},
      create: {
        flightNo: 'PR-400',
        routeId: route.id,
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
        arrivalAt: new Date(departureAt.getTime() + 65 * 60 * 1000),
        capacity: 20,
        status: 'SCHEDULED',
      },
    });
  }

  it('exports the customer’s own bookings, passengers, and account info', async () => {
    const { accessToken } = await loginAsCustomer(app, phoneFor(1));
    const instance = await freshInstance();
    const createRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [
          {
            fullName: 'مسافر خروجی داده',
            nationalId: '0012345679',
            seatCode: '1A',
          },
        ],
      });
    expect(createRes.status).toBe(201);

    const exportRes = await request(app.getHttpServer())
      .get('/my/privacy/export')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(exportRes.status).toBe(200);
    expect(exportRes.body.data.bookings).toHaveLength(1);
    expect(exportRes.body.data.bookings[0].passengers[0].fullName).toBe(
      'مسافر خروجی داده',
    );
    expect(exportRes.body.data.bookings[0].passengers[0].nationalId).toBe(
      '0012345679',
    );
    expect(exportRes.body.data.user.phone).toBe(phoneFor(1));
  });

  it('rejects export without login', async () => {
    const res = await request(app.getHttpServer()).get('/my/privacy/export');
    expect(res.status).toBe(401);
  });

  it('deletes the account: anonymizes passenger PII, revokes sessions, deactivates the user', async () => {
    const phone = phoneFor(2);
    const { accessToken, userId } = await loginAsCustomer(app, phone);
    const instance = await freshInstance();
    const createRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [
          {
            fullName: 'مسافر حذف‌شونده',
            nationalId: '0012345679',
            mobile: '09121112233',
            seatCode: '2A',
          },
        ],
      });
    const bookingId = createRes.body.data.id as string;

    const deleteRes = await request(app.getHttpServer())
      .delete('/my/privacy/account')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.deleted).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId! },
    });
    expect(user.isActive).toBe(false);
    expect(user.deletedAt).not.toBeNull();
    expect(user.phone).toBeNull();
    expect(user.fullName).toBe('کاربر حذف‌شده');

    const passenger = await prisma.passenger.findFirstOrThrow({
      where: { bookingId },
    });
    expect(passenger.fullName).toBe('کاربر حذف‌شده');
    expect(passenger.nationalIdEnc).toBeNull();
    expect(passenger.mobileEnc).toBeNull();

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    expect(booking.contactPhone).toBeNull();
    // The booking row itself (financial record) survives — never hard-deleted.
    expect(booking.priceIrr).toBeGreaterThan(0);

    const refreshTokens = await prisma.refreshToken.findMany({
      where: { userId: userId!, revokedAt: null },
    });
    expect(refreshTokens).toHaveLength(0);

    // The deleted account can no longer log in (find-or-create on phone
    // would otherwise reuse this dead account; phone is now null, so a
    // fresh OTP request for the same phone creates a brand-new account).
    const reLoginRes = await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ phone });
    expect(reLoginRes.status).toBe(200);
    const newUser = await prisma.user.findUniqueOrThrow({ where: { phone } });
    expect(newUser.id).not.toBe(userId);
  });
});

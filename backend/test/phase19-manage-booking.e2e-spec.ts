import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAsCustomer } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

/** Phase 19: مدیریت رزرو — anonymous PNR + last-name self-service (no
 * login). See docs/API.md's Phase 19 section for the full design/scope
 * reasoning. */
describe('Phase 19 — anonymous manage-booking self-service (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let flightId: string;
  const AIRCRAFT_TYPE = 'MB2E-TestJet';

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
        economyRowEnd: 3,
        economyColsLeft: ['A'],
        economyColsRight: ['C'],
      },
    });
    const route = await prisma.route.upsert({
      where: { originCode_destCode: { originCode: 'THR', destCode: 'MHD' } },
      update: {},
      create: { originCode: 'THR', destCode: 'MHD', durationMin: 85 },
    });
    const flight = await prisma.flight.upsert({
      where: { flightNo: 'MB-300' },
      update: {},
      create: {
        flightNo: 'MB-300',
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

  async function bookAndPay(
    phone: string,
    fullName: string,
    seatCode: string,
    daysAhead = 10,
  ) {
    const { accessToken } = await loginAsCustomer(app, phone);
    const departureAt = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    const instance = await prisma.flightInstance.create({
      data: {
        flightId,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 85 * 60 * 1000),
        capacity: 4,
        status: 'SCHEDULED',
      },
    });
    const createRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName, nationalId: '0012345679', seatCode }],
      });
    const bookingId = createRes.body.data.id as string;
    const payRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    return {
      pnr: payRes.body.data.booking.pnr as string,
      priceIrr: payRes.body.data.booking.priceIrr as number,
    };
  }

  describe('POST /manage-booking/lookup', () => {
    it('finds a booking by PNR + matching last name, exposing only fullName/seatCode per passenger', async () => {
      const { pnr } = await bookAndPay('09150000001', 'نگار رضایی', '1A');

      const res = await request(app.getHttpServer())
        .post('/manage-booking/lookup')
        .send({ pnr, lastName: 'رضایی' });

      expect(res.status).toBe(201);
      expect(res.body.data.pnr).toBe(pnr);
      expect(res.body.data.passengers).toEqual([
        { fullName: 'نگار رضایی', seatCode: '1A' },
      ]);
    });

    it('matches case/whitespace-insensitively via a lowercase pnr and trimmed last name', async () => {
      const { pnr } = await bookAndPay('09150000002', 'آرش کریمی', '1C');

      const res = await request(app.getHttpServer())
        .post('/manage-booking/lookup')
        .send({ pnr: pnr.toLowerCase(), lastName: '  کریمی  ' });

      expect(res.status).toBe(201);
      expect(res.body.data.pnr).toBe(pnr);
    });

    it('404s on a wrong last name — same generic message as a nonexistent PNR', async () => {
      const { pnr } = await bookAndPay('09150000003', 'سارا محمدی', '2A');

      const wrongName = await request(app.getHttpServer())
        .post('/manage-booking/lookup')
        .send({ pnr, lastName: 'رضایی' });
      const wrongPnr = await request(app.getHttpServer())
        .post('/manage-booking/lookup')
        .send({ pnr: 'BJZZZZZZ', lastName: 'رضایی' });

      expect(wrongName.status).toBe(404);
      expect(wrongPnr.status).toBe(404);
      expect(wrongName.body.error.code).toBe(wrongPnr.body.error.code);
      expect(wrongName.body.error.message).toBe(wrongPnr.body.error.message);
    });
  });

  describe('POST /manage-booking/refund', () => {
    it('submits a real refund with a real penalty breakdown, no login required', async () => {
      const { pnr, priceIrr } = await bookAndPay(
        '09150000004',
        'مریم احمدی',
        '2C',
        10,
      );

      const res = await request(app.getHttpServer())
        .post('/manage-booking/refund')
        .send({
          pnr,
          lastName: 'احمدی',
          iban: 'IR820170000000332211009900',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('SUBMITTED');
      expect(res.body.data.totalPaidIrr).toBe(priceIrr);
      expect(res.body.data.penaltyAmountIrr + res.body.data.refundableIrr).toBe(
        priceIrr,
      );
      expect(res.body.data.ibanEnc).toBeUndefined();
    });

    it('rejects a second anonymous refund submission for the same booking', async () => {
      const { pnr } = await bookAndPay('09150000005', 'حسین رضوی', '3A');
      const dto = { pnr, lastName: 'رضوی', iban: 'IR820170000000332211009900' };

      await request(app.getHttpServer())
        .post('/manage-booking/refund')
        .send(dto);
      const second = await request(app.getHttpServer())
        .post('/manage-booking/refund')
        .send(dto);

      expect(second.status).toBe(409);
    });

    it('404s when the last name does not match the booking', async () => {
      const { pnr } = await bookAndPay('09150000006', 'فرزاد نوری', '3C');

      const res = await request(app.getHttpServer())
        .post('/manage-booking/refund')
        .send({
          pnr,
          lastName: 'رضایی',
          iban: 'IR820170000000332211009900',
        });

      expect(res.status).toBe(404);
    });

    it('computes an identical penalty to the authenticated /my/refunds path for the same booking shape', async () => {
      const authed = await bookAndPay('09150000007', 'وحید تقوی', '1A', 10);
      const anon = await bookAndPay('09150000008', 'وحید تقوی', '1C', 10);

      const authRes = await request(app.getHttpServer())
        .post('/manage-booking/refund')
        .send({
          pnr: authed.pnr,
          lastName: 'تقوی',
          iban: 'IR820170000000332211009900',
        });
      const anonRes = await request(app.getHttpServer())
        .post('/manage-booking/refund')
        .send({
          pnr: anon.pnr,
          lastName: 'تقوی',
          iban: 'IR820170000000332211009900',
        });

      expect(authRes.body.data.penaltyPct).toBe(anonRes.body.data.penaltyPct);
    });
  });
});

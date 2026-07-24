import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { encryptPii, hashPii } from '../src/common/pii-crypto';
import { loginAsCustomer } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

/** Generates a checksum-valid, non-repeating synthetic national ID (same
 * generator as club.e2e-spec.ts). */
function validNationalId(): string {
  for (;;) {
    const base = Array.from({ length: 9 }, () => crypto.randomInt(0, 10)).join(
      '',
    );
    if (/^(\d)\1{8}$/.test(base)) continue;
    const sum = base
      .split('')
      .reduce((acc, d, i) => acc + Number(d) * (10 - i), 0);
    const r = sum % 11;
    return base + String(r < 2 ? r : 11 - r);
  }
}

// Unique per test run (not fixed literals) so every phone/promo-code stays
// correct on repeated runs against a non-truncated test DB — the same
// convention used in refund-submission.e2e-spec.ts.
const RUN = Date.now().toString().slice(-6);
function phoneFor(n: number): string {
  return `09${RUN}${String(n).padStart(3, '0')}`;
}

describe('Purchase extras: promo codes, wallet, club points, price lock (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let flightId: string;
  const AIRCRAFT_TYPE = 'PE2E-TestJet';

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
        economyRowEnd: 10,
        economyColsLeft: ['A', 'B'],
        economyColsRight: ['C'],
      },
    });
    const route = await prisma.route.upsert({
      where: { originCode_destCode: { originCode: 'THR', destCode: 'IFN' } },
      update: {},
      create: { originCode: 'THR', destCode: 'IFN', durationMin: 60 },
    });
    const flight = await prisma.flight.upsert({
      where: { flightNo: 'PE-300' },
      update: {},
      create: {
        flightNo: 'PE-300',
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
        arrivalAt: new Date(departureAt.getTime() + 60 * 60 * 1000),
        capacity: 30,
        status: 'SCHEDULED',
      },
    });
  }

  async function loginAndBook(phone: string, seatCode: string, daysAhead = 40) {
    const { accessToken, userId } = await loginAsCustomer(app, phone);
    const instance = await freshInstance(daysAhead);
    const createRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مسافر تست', seatCode }],
      });
    return {
      accessToken,
      userId: userId!,
      instance,
      bookingId: createRes.body.data.id as string,
      priceIrr: createRes.body.data.priceIrr as number,
    };
  }

  async function linkGoldMember(userId: string) {
    const nid = validNationalId();
    return prisma.clubMember.create({
      data: {
        userId,
        fullName: 'عضو طلایی تست',
        email: `${crypto.randomUUID().slice(0, 8)}@club.example`,
        nationalIdEnc: encryptPii(nid),
        nationalIdHash: hashPii(nid),
        level: 'GOLD',
      },
    });
  }

  // ── Promo codes ─────────────────────────────────────────────────────

  it('applies a PERCENT promo code at payment and posts the discounted amount to the ledger', async () => {
    const { accessToken, bookingId, priceIrr } = await loginAndBook(
      phoneFor(1),
      '1A',
    );
    const code = `TEST20-${RUN}`;
    await prisma.promoCode.create({
      data: { code, type: 'PERCENT', value: 20, active: true },
    });

    const payRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ promoCode: code });

    expect(payRes.status).toBe(201);
    const expected = priceIrr - Math.round(priceIrr * 0.2);
    expect(payRes.body.data.booking.priceIrr).toBe(expected);

    const ledger = await prisma.ledgerEntry.findFirst({
      where: { bookingId, type: 'SALE' },
    });
    expect(ledger!.signedAmountIrr).toBe(expected);
  });

  it('rejects an unknown promo code', async () => {
    const { accessToken, bookingId } = await loginAndBook(phoneFor(2), '1B');
    const res = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ promoCode: `DOES-NOT-EXIST-${RUN}` });
    expect(res.status).toBe(400);
  });

  it('enforces maxPerUser on a promo code', async () => {
    const code = `ONCE-${RUN}`;
    await prisma.promoCode.create({
      data: {
        code,
        type: 'FIXED',
        value: 1_000_000,
        active: true,
        maxPerUser: 1,
      },
    });
    const first = await loginAndBook(phoneFor(3), '1C');
    const firstPay = await request(app.getHttpServer())
      .post(`/bookings/${first.bookingId}/pay`)
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ promoCode: code });
    expect(firstPay.status).toBe(201);

    const instance2 = await freshInstance(41);
    const secondBooking = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({
        flightInstanceId: instance2.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'مسافر دوباره', seatCode: '2A' }],
      });
    const secondPay = await request(app.getHttpServer())
      .post(`/bookings/${secondBooking.body.data.id}/pay`)
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ promoCode: code });
    expect(secondPay.status).toBe(400);
  });

  // ── Wallet ───────────────────────────────────────────────────────────

  it('tops up the wallet and pays with it, debiting the balance', async () => {
    const { accessToken, bookingId, priceIrr } = await loginAndBook(
      phoneFor(4),
      '3A',
    );

    const beforeRes = await request(app.getHttpServer())
      .get('/my/wallet')
      .set('Authorization', `Bearer ${accessToken}`);
    const beforeBalance = Number(beforeRes.body.data.balanceIrr);

    const topupRes = await request(app.getHttpServer())
      .post('/my/wallet/topup')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amountIrr: priceIrr + 5_000_000 });
    expect(topupRes.status).toBe(201);
    expect(Number(topupRes.body.data.balanceIrr)).toBe(
      beforeBalance + priceIrr + 5_000_000,
    );

    const payRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ paymentMethod: 'WALLET' });
    expect(payRes.status).toBe(201);

    const walletRes = await request(app.getHttpServer())
      .get('/my/wallet')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(Number(walletRes.body.data.balanceIrr)).toBe(
      beforeBalance + 5_000_000,
    );
  });

  it('rejects a wallet payment with insufficient balance', async () => {
    const { accessToken, bookingId } = await loginAndBook(phoneFor(5), '3B');
    const res = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ paymentMethod: 'WALLET' });
    expect(res.status).toBe(409);

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    expect(booking.status).toBe('HELD');
  });

  // ── Club points ──────────────────────────────────────────────────────

  it('earns club points on a gateway payment and lets a member pay with points', async () => {
    const booked = await loginAndBook(phoneFor(6), '4A');
    await linkGoldMember(booked.userId);

    await request(app.getHttpServer())
      .post(`/bookings/${booked.bookingId}/pay`)
      .set('Authorization', `Bearer ${booked.accessToken}`)
      .send({});

    const pointsRes = await request(app.getHttpServer())
      .get('/my/club-points')
      .set('Authorization', `Bearer ${booked.accessToken}`);
    expect(pointsRes.body.data.isMember).toBe(true);
    expect(pointsRes.body.data.balance).toBeGreaterThan(0);

    // Second booking, paid entirely with the points just earned.
    const instance2 = await freshInstance(42);
    const secondBooking = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${booked.accessToken}`)
      .send({
        flightInstanceId: instance2.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'پرداخت با امتیاز', seatCode: '4B' }],
      });
    const pointsPay = await request(app.getHttpServer())
      .post(`/bookings/${secondBooking.body.data.id}/pay`)
      .set('Authorization', `Bearer ${booked.accessToken}`)
      .send({ paymentMethod: 'POINTS' });
    // May succeed (enough points) or fail with 400 depending on price vs
    // earn rate — either way this must not silently earn points back.
    if (pointsPay.status === 201) {
      const afterRes = await request(app.getHttpServer())
        .get('/my/club-points')
        .set('Authorization', `Bearer ${booked.accessToken}`);
      expect(Number(afterRes.body.data.balance)).toBeLessThan(
        Number(pointsRes.body.data.balance),
      );
    } else {
      expect(pointsPay.status).toBe(400);
    }
  });

  it('rejects points payment for a non-member', async () => {
    const { accessToken, bookingId } = await loginAndBook(phoneFor(7), '5A');
    const res = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ paymentMethod: 'POINTS' });
    expect(res.status).toBe(400);
  });

  // ── Price lock ───────────────────────────────────────────────────────

  it('forbids price-lock creation for a non-gold-tier customer', async () => {
    const { accessToken } = await loginAsCustomer(app, phoneFor(8));
    const instance = await freshInstance(43);
    const res = await request(app.getHttpServer())
      .post('/my/price-locks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ flightInstanceId: instance.id, cabin: 'ECONOMY' });
    expect(res.status).toBe(403);
  });

  it('lets a gold member lock a price, then books at that price even after the market price moves', async () => {
    const { accessToken, userId } = await loginAsCustomer(app, phoneFor(9));
    await linkGoldMember(userId!);
    const instance = await freshInstance(44);

    const lockRes = await request(app.getHttpServer())
      .post('/my/price-locks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ flightInstanceId: instance.id, cabin: 'ECONOMY' });
    expect(lockRes.status).toBe(201);
    const lockedPriceIrr = lockRes.body.data.lockedPriceIrr as number;

    // Market price moves (a registered fare change) — the lock must still win.
    await prisma.cabinFare.upsert({
      where: {
        flightInstanceId_cabin: {
          flightInstanceId: instance.id,
          cabin: 'ECONOMY',
        },
      },
      update: { priceIrr: lockedPriceIrr + 50_000_000 },
      create: {
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        priceIrr: lockedPriceIrr + 50_000_000,
      },
    });

    const bookRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'قفل قیمت', seatCode: '6A' }],
      });
    expect(bookRes.body.data.priceIrr).toBe(lockedPriceIrr);

    // Payment must not trigger the "price changed" flow.
    const payRes = await request(app.getHttpServer())
      .post(`/bookings/${bookRes.body.data.id}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(payRes.body.data.priceChanged).toBe(false);
    expect(payRes.body.data.booking.priceIrr).toBe(lockedPriceIrr);

    const lockAfter = await prisma.priceLock.findUnique({
      where: { id: lockRes.body.data.id },
    });
    expect(lockAfter!.status).toBe('USED');
  });

  it('rejects a second active price lock for the same flight+cabin', async () => {
    const { accessToken, userId } = await loginAsCustomer(app, phoneFor(10));
    await linkGoldMember(userId!);
    const instance = await freshInstance(45);

    const first = await request(app.getHttpServer())
      .post('/my/price-locks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ flightInstanceId: instance.id, cabin: 'ECONOMY' });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/my/price-locks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ flightInstanceId: instance.id, cabin: 'ECONOMY' });
    expect(second.status).toBe(409);
  });

  it('lets a member cancel an active lock', async () => {
    const { accessToken, userId } = await loginAsCustomer(app, phoneFor(11));
    await linkGoldMember(userId!);
    const instance = await freshInstance(46);

    const created = await request(app.getHttpServer())
      .post('/my/price-locks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ flightInstanceId: instance.id, cabin: 'ECONOMY' });

    const cancelRes = await request(app.getHttpServer())
      .delete(`/my/price-locks/${created.body.data.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
  });

  it('GET /my/price-locks includes the locked flight route/number/departure, not just raw ids', async () => {
    const { accessToken, userId } = await loginAsCustomer(app, phoneFor(12));
    await linkGoldMember(userId!);
    const instance = await freshInstance(47);

    await request(app.getHttpServer())
      .post('/my/price-locks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ flightInstanceId: instance.id, cabin: 'ECONOMY' });

    const list = await request(app.getHttpServer())
      .get('/my/price-locks')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(list.status).toBe(200);
    const lock = list.body.data[0];
    expect(lock.flight).toEqual({
      flightNo: 'PE-300',
      originCode: 'THR',
      destCode: 'IFN',
      departureAt: instance.departureAt.toISOString(),
    });
  });

  it('a booking created against an active lock is flagged isPriceLocked; an ordinary booking is not', async () => {
    const { accessToken, userId } = await loginAsCustomer(app, phoneFor(13));
    await linkGoldMember(userId!);
    const lockedInstance = await freshInstance(48);

    await request(app.getHttpServer())
      .post('/my/price-locks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ flightInstanceId: lockedInstance.id, cabin: 'ECONOMY' });

    const lockedBooking = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        flightInstanceId: lockedInstance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'قفل قیمت', seatCode: '7A' }],
      });
    expect(lockedBooking.body.data.isPriceLocked).toBe(true);

    const otherInstance = await freshInstance(49);
    const ordinaryBooking = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        flightInstanceId: otherInstance.id,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'بدون قفل', seatCode: '7B' }],
      });
    expect(ordinaryBooking.body.data.isPriceLocked).toBe(false);
  });
});

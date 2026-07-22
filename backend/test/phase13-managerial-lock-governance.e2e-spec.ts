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

/** Phase 13 Part D — managerial reservation governance layered onto
 * Phase 9's SeatLock: reason/classification on request, two-step
 * approval with self-approval blocked, per-requester cap, request/hold
 * TTLs with self-healing expiry, and finalize-into-a-priced-booking. */
describe('Phase 13 Part D — managerial lock governance', () => {
  let app: INestApplication<App>;
  const AIRCRAFT_TYPE = 'P13D-Jet';
  let instanceId: string;
  let ceoToken: string;
  let chairToken: string;
  let itToken: string;

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  beforeAll(async () => {
    app = await createTestApp();
    ceoToken = (await loginAs(app, 'ceo')).accessToken!;
    chairToken = (await loginAs(app, 'chair')).accessToken!;
    itToken = (await loginAs(app, 'itadmin')).accessToken!;

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
        economyRowEnd: 6,
        economyColsLeft: ['A'],
        economyColsRight: ['C'],
      },
    });
    const route = await prisma.route.upsert({
      where: { originCode_destCode: { originCode: 'THR', destCode: 'MHD' } },
      update: {},
      create: { originCode: 'THR', destCode: 'MHD', durationMin: 70 },
    });
    const flight = await prisma.flight.upsert({
      where: { flightNo: 'P13D-1' },
      update: {},
      create: {
        flightNo: 'P13D-1',
        routeId: route.id,
        aircraftType: AIRCRAFT_TYPE,
      },
    });
    const departureAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const instance = await prisma.flightInstance.create({
      data: {
        flightId: flight.id,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 70 * 60 * 1000),
        capacity: 12,
        status: 'SCHEDULED',
      },
    });
    instanceId = instance.id;
  });

  afterAll(async () => {
    await prisma.seatLock.deleteMany({
      where: { flightInstanceId: instanceId },
    });
    const passengers = await prisma.passenger.findMany({
      where: { booking: { flightInstanceId: instanceId } },
      select: { bookingId: true },
    });
    const bookingIds = passengers.map((p) => p.bookingId);
    await prisma.ledgerEntry.deleteMany({
      where: { bookingId: { in: bookingIds } },
    });
    await prisma.passenger.deleteMany({
      where: { bookingId: { in: bookingIds } },
    });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    await prisma.flightInstance.delete({ where: { id: instanceId } });
    await prisma.flight.deleteMany({ where: { flightNo: 'P13D-1' } });
    // Route THR-MHD is left in place — it may be shared with unrelated
    // seed/load-test flights (FK-restricted delete would 500 here).
    await prisma.aircraftSeatMap.deleteMany({
      where: { aircraftType: AIRCRAFT_TYPE },
    });

    await app.close();
    await prisma.$disconnect();
  });

  it('rejects a request missing reason/classification, and discountPct without DISCOUNTED', async () => {
    const missingReason = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instanceId}/lock`)
      .set(auth(ceoToken))
      .send({ seatCode: '1A', classification: 'PAYABLE' });
    expect(missingReason.status).toBe(400);

    const badDiscount = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instanceId}/lock`)
      .set(auth(ceoToken))
      .send({
        seatCode: '1A',
        reason: 'تست اعتبارسنجی',
        classification: 'PAYABLE',
        discountPct: 10,
      });
    expect(badDiscount.status).toBe(400);

    const missingDiscount = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instanceId}/lock`)
      .set(auth(ceoToken))
      .send({
        seatCode: '1A',
        reason: 'تست اعتبارسنجی',
        classification: 'DISCOUNTED',
      });
    expect(missingDiscount.status).toBe(400);

    const ok = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instanceId}/lock`)
      .set(auth(ceoToken))
      .send({
        seatCode: '1A',
        reason: 'تست اعتبارسنجی',
        classification: 'PAYABLE',
      });
    expect(ok.status).toBe(201);
    expect(ok.body.data.approvalStatus).toBe('PENDING_APPROVAL');
  });

  it('blocks self-approval, allows a different CAN_LOCK_ROLES member to approve and sets a ~48h hold deadline', async () => {
    const requested = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instanceId}/lock`)
      .set(auth(chairToken))
      .send({
        seatCode: '1C',
        reason: 'بازدید رسمی',
        classification: 'PAYABLE',
      });
    expect(requested.status).toBe(201);
    const lockId = requested.body.data.id;

    const selfApprove = await request(app.getHttpServer())
      .patch(`/reservation/seatmap/locks/${lockId}/approve`)
      .set(auth(chairToken));
    expect(selfApprove.status).toBe(409);

    const approved = await request(app.getHttpServer())
      .patch(`/reservation/seatmap/locks/${lockId}/approve`)
      .set(auth(ceoToken));
    expect(approved.status).toBe(200);
    expect(approved.body.data.approvalStatus).toBe('APPROVED');

    const expiresAt = approved.body.data.expiresAt as string;
    const hoursOut =
      (new Date(expiresAt).getTime() - Date.now()) / (60 * 60 * 1000);
    expect(hoursOut).toBeGreaterThan(47);
    expect(hoursOut).toBeLessThan(49);
  });

  it('rejection frees the seat immediately (self-rejection allowed)', async () => {
    const requested = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instanceId}/lock`)
      .set(auth(chairToken))
      .send({
        seatCode: '2A',
        reason: 'درخواست بازبینی‌شده',
        classification: 'PAYABLE',
      });
    const lockId = requested.body.data.id;

    const rejected = await request(app.getHttpServer())
      .patch(`/reservation/seatmap/locks/${lockId}/reject`)
      .set(auth(chairToken))
      .send({ rejectionReason: 'انصراف درخواست‌کننده' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.approvalStatus).toBe('REJECTED');
    expect(rejected.body.data.releasedAt).not.toBeNull();

    const relock = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instanceId}/lock`)
      .set(auth(itToken))
      .send({ seatCode: '2A', reason: 'رزرو مجدد', classification: 'PAYABLE' });
    expect(relock.status).toBe(201);
  });

  it('finalizes an APPROVED lock into a TICKETED booking priced per classification (FREE/DISCOUNTED/PAYABLE); a PENDING request cannot be finalized', async () => {
    async function requestApproveFinalize(
      seatCode: string,
      classification: 'FREE' | 'DISCOUNTED' | 'PAYABLE',
      discountPct?: number,
    ) {
      const requested = await request(app.getHttpServer())
        .post(`/reservation/seatmap/${instanceId}/lock`)
        .set(auth(ceoToken))
        .send({
          seatCode,
          reason: 'رزرو مدیریتی نمونه',
          classification,
          discountPct,
        });
      expect(requested.status).toBe(201);
      const lockId = requested.body.data.id;

      const pendingFinalize = await request(app.getHttpServer())
        .post(`/reservation/pnr/from-lock/${lockId}`)
        .set(auth(chairToken))
        .send({ passengerName: 'مسافر آزمایشی' });
      expect(pendingFinalize.status).toBe(409);

      await request(app.getHttpServer())
        .patch(`/reservation/seatmap/locks/${lockId}/approve`)
        .set(auth(chairToken))
        .expect(200);

      return request(app.getHttpServer())
        .post(`/reservation/pnr/from-lock/${lockId}`)
        .set(auth(chairToken))
        .send({ passengerName: 'مسافر آزمایشی' });
    }

    const free = await requestApproveFinalize('2C', 'FREE');
    expect(free.status).toBe(201);
    expect(free.body.data.priceIrr).toBe(0);

    const discounted = await requestApproveFinalize('3A', 'DISCOUNTED', 20);
    expect(discounted.status).toBe(201);
    expect(discounted.body.data.priceIrr).toBe(38_000_000 - 7_600_000);

    const payable = await requestApproveFinalize('3C', 'PAYABLE');
    expect(payable.status).toBe(201);
    expect(payable.body.data.priceIrr).toBe(38_000_000);

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { pnr: free.body.data.pnr },
    });
    const lock = await prisma.seatLock.findFirst({
      where: { bookingId: booking.id },
    });
    expect(lock).not.toBeNull();
    expect(lock!.releasedAt).not.toBeNull();
  });

  it('an expired-but-unreleased lock is excluded from the seat map and self-heals when someone requests that seat again', async () => {
    const requested = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instanceId}/lock`)
      .set(auth(ceoToken))
      .send({ seatCode: '4A', reason: 'تست انقضا', classification: 'PAYABLE' });
    const lockId = requested.body.data.id;

    // Simulate the request-decision TTL having already passed.
    await prisma.seatLock.update({
      where: { id: lockId },
      data: { expiresAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const seatmap = await request(app.getHttpServer())
      .get(`/reservation/seatmap/${instanceId}`)
      .set(auth(ceoToken));
    const row4 = seatmap.body.data.rows.find(
      (r: { row: number }) => r.row === 4,
    );
    const seat4A = row4.seats.find(
      (s: { seatCode: string }) => s.seatCode === '4A',
    );
    expect(seat4A.status).toBe('FREE');

    // The DB row is still releasedAt: null at this point — the new
    // request must self-heal it, not 409 on the partial unique index.
    const stale = await prisma.seatLock.findUniqueOrThrow({
      where: { id: lockId },
    });
    expect(stale.releasedAt).toBeNull();

    const relock = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instanceId}/lock`)
      .set(auth(itToken))
      .send({
        seatCode: '4A',
        reason: 'رزرو پس از انقضا',
        classification: 'PAYABLE',
      });
    expect(relock.status).toBe(201);
  });

  it('enforces the per-requester active-lock cap regardless of flight instance', async () => {
    const existing = await prisma.seatLock.count({
      where: {
        lockedById: (
          await prisma.user.findUniqueOrThrow({
            where: { username: 'itadmin' },
          })
        ).id,
        releasedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    const remainingBudget = 5 - existing;
    const seatCodes = ['5A', '5C', '6A', '6C', '4C'].slice(
      0,
      Math.max(remainingBudget, 0),
    );

    for (const seatCode of seatCodes) {
      const res = await request(app.getHttpServer())
        .post(`/reservation/seatmap/${instanceId}/lock`)
        .set(auth(itToken))
        .send({
          seatCode,
          reason: 'تست سقف درخواست',
          classification: 'PAYABLE',
        });
      expect(res.status).toBe(201);
    }

    // '1A' is still PENDING_APPROVAL from an earlier test (never sold), so
    // this attempt reaches the cap check regardless of which seats above
    // consumed the budget — the cap check runs before any seat-lock
    // conflict check.
    const overCap = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instanceId}/lock`)
      .set(auth(itToken))
      .send({
        seatCode: '1A',
        reason: 'باید رد شود',
        classification: 'PAYABLE',
      });
    expect(overCap.status).toBe(409);
    expect(overCap.body.error.code).toBe('LOCK_CAP_EXCEEDED');
  });
});

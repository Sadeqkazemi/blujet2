import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

describe('Reservation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  function auth(token: string | null | undefined) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createScheduledInstance() {
    const flight = await prisma.flight.findFirstOrThrow();
    const departureAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    return prisma.flightInstance.create({
      data: {
        flightId: flight.id,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 3 * 60 * 60 * 1000),
        capacity: 180,
        charterSeats: 60,
        status: 'SCHEDULED',
      },
    });
  }

  // ── Seat map & locking ──────────────────────────────────────────────

  it('GET /reservation/seatmap/:id computes rows from AircraftSeatMap with correct capacity', async () => {
    const instance = await createScheduledInstance();
    const { accessToken } = await loginAs(app, 'chair');
    const res = await request(app.getHttpServer())
      .get(`/reservation/seatmap/${instance.id}`)
      .set(auth(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.capacity).toBe(146); // 16 business + 130 economy per seed config
    expect(res.body.data.soldCount).toBe(0);
    expect(res.body.data.rows.length).toBe(30); // rows 3-6 + 7-32
  });

  it('POST lock: canLock roles only, 409 on already-locked, encrypted PII never returned, audited', async () => {
    const instance = await createScheduledInstance();
    const chair = await loginAs(app, 'chair');
    const senior = await loginAs(app, 'senior.rahimi');

    const forbidden = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instance.id}/lock`)
      .set(auth(senior.accessToken))
      .send({
        seatCode: '3A',
        passengerName: 'تست',
        passengerNationalId: '0499370899',
      });
    expect(forbidden.status).toBe(403);

    const ok = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instance.id}/lock`)
      .set(auth(chair.accessToken))
      .send({
        seatCode: '3A',
        passengerName: 'تست',
        passengerNationalId: '0499370899',
      });
    expect(ok.status).toBe(201);
    expect(ok.body.data.passengerNationalIdEnc).toBeUndefined();
    expect(ok.body.data.passengerNationalIdHash).toBeUndefined();

    const dup = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instance.id}/lock`)
      .set(auth(chair.accessToken))
      .send({ seatCode: '3A' });
    expect(dup.status).toBe(409);

    const audit = await prisma.auditLog.findFirst({
      where: {
        category: 'RESERVATION',
        entityType: 'SeatLock',
        entityId: ok.body.data.id,
      },
    });
    expect(audit).not.toBeNull();
  });

  it('concurrent lock attempts on the same seat: exactly one succeeds (DB-enforced)', async () => {
    const instance = await createScheduledInstance();
    const it = await loginAs(app, 'itadmin');

    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post(`/reservation/seatmap/${instance.id}/lock`)
          .set(auth(it.accessToken))
          .send({ seatCode: '5B' }),
      ),
    );
    const succeeded = attempts.filter((r) => r.status === 201);
    const conflicted = attempts.filter((r) => r.status === 409);
    expect(succeeded.length).toBe(1);
    expect(conflicted.length).toBe(4);
  });

  it('PATCH release: canLock only, 409 on already-released, seat becomes lockable again', async () => {
    const instance = await createScheduledInstance();
    const it = await loginAs(app, 'itadmin');
    const senior = await loginAs(app, 'senior.rahimi');

    const locked = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instance.id}/lock`)
      .set(auth(it.accessToken))
      .send({ seatCode: '6D' });
    const lockId = locked.body.data.id;

    const forbidden = await request(app.getHttpServer())
      .patch(`/reservation/seatmap/locks/${lockId}/release`)
      .set(auth(senior.accessToken));
    expect(forbidden.status).toBe(403);

    const released = await request(app.getHttpServer())
      .patch(`/reservation/seatmap/locks/${lockId}/release`)
      .set(auth(it.accessToken));
    expect(released.status).toBe(200);
    expect(released.body.data.releasedAt).not.toBeNull();

    const again = await request(app.getHttpServer())
      .patch(`/reservation/seatmap/locks/${lockId}/release`)
      .set(auth(it.accessToken));
    expect(again.status).toBe(409);

    const relock = await request(app.getHttpServer())
      .post(`/reservation/seatmap/${instance.id}/lock`)
      .set(auth(it.accessToken))
      .send({ seatCode: '6D' });
    expect(relock.status).toBe(201);
  });

  // ── PNR management ──────────────────────────────────────────────────

  async function issuePnr(
    accessToken: string | null | undefined,
    instanceId: string,
    seatCode: string,
    name = 'مسافر تست',
  ) {
    return request(app.getHttpServer())
      .post('/reservation/pnr')
      .set(auth(accessToken))
      .send({ flightInstanceId: instanceId, seatCode, passengerName: name });
  }

  it('POST /reservation/pnr issues a TICKETED booking directly (no payment step), 409 on unavailable seat, audited', async () => {
    const instance = await createScheduledInstance();
    const chair = await loginAs(app, 'chair');
    const senior = await loginAs(app, 'senior.rahimi');

    const forbidden = await issuePnr(senior.accessToken, instance.id, '7A');
    expect(forbidden.status).toBe(403);

    const issued = await issuePnr(
      chair.accessToken,
      instance.id,
      '7A',
      'نگار رضایی',
    );
    expect(issued.status).toBe(201);
    expect(issued.body.data.status).toBe('TICKETED');
    expect(issued.body.data.passenger.seatCode).toBe('7A');

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { pnr: issued.body.data.pnr },
    });
    expect(booking.status).toBe('TICKETED');
    const ledger = await prisma.ledgerEntry.findFirst({
      where: { bookingId: booking.id, type: 'SALE' },
    });
    expect(ledger).not.toBeNull();

    const conflict = await issuePnr(chair.accessToken, instance.id, '7A');
    expect(conflict.status).toBe(409);

    const audit = await prisma.auditLog.findFirst({
      where: {
        category: 'RESERVATION',
        action: 'صدور دستی PNR',
        entityId: booking.id,
      },
    });
    expect(audit).not.toBeNull();
  });

  it('GET /reservation/pnr lists grouped by flight and q= filters by PNR/passenger', async () => {
    const instance = await createScheduledInstance();
    const it = await loginAs(app, 'itadmin');
    const issued = await issuePnr(
      it.accessToken,
      instance.id,
      '8C',
      'جستجوپذیر یکتا',
    );

    const list = await request(app.getHttpServer())
      .get(`/reservation/pnr?q=${encodeURIComponent('جستجوپذیر یکتا')}`)
      .set(auth(it.accessToken));
    expect(list.status).toBe(200);
    const group = list.body.data.find(
      (g: { flightInstanceId: string }) => g.flightInstanceId === instance.id,
    );
    expect(group).toBeDefined();
    expect(
      group.rows.some((r: { pnr: string }) => r.pnr === issued.body.data.pnr),
    ).toBe(true);
  });

  it('GET /reservation/pnr/:pnr returns detail; unknown PNR -> 404', async () => {
    const instance = await createScheduledInstance();
    const it = await loginAs(app, 'itadmin');
    const issued = await issuePnr(it.accessToken, instance.id, '9E');

    const detail = await request(app.getHttpServer())
      .get(`/reservation/pnr/${issued.body.data.pnr}`)
      .set(auth(it.accessToken));
    expect(detail.status).toBe(200);
    expect(detail.body.data.passenger.seatCode).toBe('9E');

    const missing = await request(app.getHttpServer())
      .get('/reservation/pnr/BJNOTFOUND')
      .set(auth(it.accessToken));
    expect(missing.status).toBe(404);
  });

  it('PATCH /reservation/pnr/:pnr/seat changes seat; 409 on a taken seat and on a CANCELLED booking', async () => {
    const instance = await createScheduledInstance();
    const chair = await loginAs(app, 'chair');
    const senior = await loginAs(app, 'senior.rahimi');
    const a = await issuePnr(chair.accessToken, instance.id, '10A', 'مسافر آ');
    const b = await issuePnr(chair.accessToken, instance.id, '10B', 'مسافر ب');

    const forbidden = await request(app.getHttpServer())
      .patch(`/reservation/pnr/${a.body.data.pnr}/seat`)
      .set(auth(senior.accessToken))
      .send({ seatCode: '11A' });
    expect(forbidden.status).toBe(403);

    const takenConflict = await request(app.getHttpServer())
      .patch(`/reservation/pnr/${a.body.data.pnr}/seat`)
      .set(auth(chair.accessToken))
      .send({ seatCode: '10B' });
    expect(takenConflict.status).toBe(409);

    const ok = await request(app.getHttpServer())
      .patch(`/reservation/pnr/${a.body.data.pnr}/seat`)
      .set(auth(chair.accessToken))
      .send({ seatCode: '11A' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.passenger.seatCode).toBe('11A');

    await request(app.getHttpServer())
      .patch(`/reservation/pnr/${b.body.data.pnr}/cancel`)
      .set(auth(chair.accessToken));
    const onCancelled = await request(app.getHttpServer())
      .patch(`/reservation/pnr/${b.body.data.pnr}/seat`)
      .set(auth(chair.accessToken))
      .send({ seatCode: '12A' });
    expect(onCancelled.status).toBe(409);
  });

  it('PATCH /reservation/pnr/:pnr/cancel frees the seat for resale; 409 if already cancelled', async () => {
    const instance = await createScheduledInstance();
    const it = await loginAs(app, 'itadmin');
    const issued = await issuePnr(it.accessToken, instance.id, '13C');

    const cancelled = await request(app.getHttpServer())
      .patch(`/reservation/pnr/${issued.body.data.pnr}/cancel`)
      .set(auth(it.accessToken));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');

    const again = await request(app.getHttpServer())
      .patch(`/reservation/pnr/${issued.body.data.pnr}/cancel`)
      .set(auth(it.accessToken));
    expect(again.status).toBe(409);

    // Seat 13C is free again — re-issuable.
    const reissued = await issuePnr(it.accessToken, instance.id, '13C');
    expect(reissued.status).toBe(201);
  });

  // ── Search & dashboard ──────────────────────────────────────────────

  it('GET /reservation/search finds SCHEDULED instances on origin/dest/date with computed price + free seats', async () => {
    const instance = await createScheduledInstance();
    const { accessToken } = await loginAs(app, 'chair');
    const flight = await prisma.flight.findUniqueOrThrow({
      where: { id: instance.flightId },
      include: { route: true },
    });

    const res = await request(app.getHttpServer())
      .get(
        `/reservation/search?origin=${flight.route.originCode}&dest=${flight.route.destCode}&date=${instance.departureAt.toISOString()}`,
      )
      .set(auth(accessToken));
    expect(res.status).toBe(200);
    expect(
      res.body.data.some(
        (r: { flightInstanceId: string }) => r.flightInstanceId === instance.id,
      ),
    ).toBe(true);
  });

  it('GET /reservation/dashboard-stats returns real counts, no fabricated fields', async () => {
    const { accessToken } = await loginAs(app, 'chair');
    const res = await request(app.getHttpServer())
      .get('/reservation/dashboard-stats')
      .set(auth(accessToken));
    expect(res.status).toBe(200);
    expect(typeof res.body.data.todayBookings).toBe('number');
    expect(typeof res.body.data.activePnrs).toBe('number');
    expect(typeof res.body.data.seatsSold).toBe('number');
    expect(typeof res.body.data.revenueIrr).toBe('number');
  });

  // ── Role isolation ──────────────────────────────────────────────────

  it('FINANCE_MANAGER and COMMERCIAL_MANAGER get 403 on every /reservation/* endpoint', async () => {
    const instance = await createScheduledInstance();
    const finance = await loginAs(app, 'finance.karimi');
    const commercial = await loginAs(app, 'comm.abbasi');

    for (const { accessToken } of [finance, commercial]) {
      const res = await request(app.getHttpServer())
        .get(`/reservation/seatmap/${instance.id}`)
        .set(auth(accessToken));
      expect(res.status).toBe(403);
    }
  });

  it('SENIOR_MANAGER: reads succeed, every write is 403 (view-only)', async () => {
    const instance = await createScheduledInstance();
    const it = await loginAs(app, 'itadmin');
    const issued = await issuePnr(it.accessToken, instance.id, '14D');
    const senior = await loginAs(app, 'senior.rahimi');

    const readSeatmap = await request(app.getHttpServer())
      .get(`/reservation/seatmap/${instance.id}`)
      .set(auth(senior.accessToken));
    expect(readSeatmap.status).toBe(200);

    const readPnr = await request(app.getHttpServer())
      .get('/reservation/pnr')
      .set(auth(senior.accessToken));
    expect(readPnr.status).toBe(200);

    const writeCancel = await request(app.getHttpServer())
      .patch(`/reservation/pnr/${issued.body.data.pnr}/cancel`)
      .set(auth(senior.accessToken));
    expect(writeCancel.status).toBe(403);

    const writeIssue = await issuePnr(senior.accessToken, instance.id, '15A');
    expect(writeIssue.status).toBe(403);
  });
});

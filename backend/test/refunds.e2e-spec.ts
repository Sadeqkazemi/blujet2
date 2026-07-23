import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { encryptPii } from '../src/common/pii-crypto';
import { loginAs, stepUpFor } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';
import type { RefundStatus } from '../generated/prisma/enums';

describe('Refunds (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createRequest(
    status: RefundStatus,
    totalPaidIrr = 30_000_000,
  ) {
    const flight = await prisma.flight.findFirstOrThrow();
    const instance = await prisma.flightInstance.create({
      data: {
        flightId: flight.id,
        departureAt: new Date(Date.now() + 7 * 24 * 3_600_000),
        arrivalAt: new Date(Date.now() + 7 * 24 * 3_600_000 + 3 * 3_600_000),
        capacity: 180,
        charterSeats: 0,
        status: 'SCHEDULED',
      },
    });
    const booking = await prisma.booking.create({
      data: {
        pnr: `RT${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        flightInstanceId: instance.id,
        channel: 'SYSTEM',
        status: 'TICKETED',
        priceIrr: totalPaidIrr,
      },
    });
    const penaltyAmountIrr = Math.round(totalPaidIrr * 0.3);
    const req = await prisma.refundRequest.create({
      data: {
        bookingId: booking.id,
        passengerName: `مسافر ${crypto.randomUUID().slice(0, 4)}`,
        ibanEnc: encryptPii('IR820170000000332211009900'),
        nidEnc: encryptPii('0012345679'),
        totalPaidIrr,
        penaltyPct: 30,
        penaltyAmountIrr,
        refundableIrr: totalPaidIrr - penaltyAmountIrr,
        status,
        history: [{ step: 'submitted', labelFa: 'ثبت درخواست', at: 'اکنون' }],
      },
    });
    return { booking, req };
  }

  it('GET /refunds returns the cards + reconciling KPI counts; PII never in the list', async () => {
    await createRequest('FINANCE');
    await createRequest('SUBMITTED');
    const { accessToken } = await loginAs(app, 'finance.karimi');

    const res = await request(app.getHttpServer())
      .get('/refunds')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const { requests, kpis } = res.body.data as {
      requests: Record<string, unknown>[];
      kpis: { payoutQueue: number; paid: number; awaitingAdmin: number };
    };
    expect(kpis.payoutQueue).toBeGreaterThanOrEqual(1);
    expect(kpis.awaitingAdmin).toBeGreaterThanOrEqual(1);
    expect(kpis.payoutQueue + kpis.paid + kpis.awaitingAdmin).toBe(
      requests.length,
    );
    expect(
      requests.every(
        (r) => !('ibanEnc' in r) && !('nidEnc' in r) && !('iban' in r),
      ),
    ).toBe(true);
  });

  it('detail decrypts the شبا for the finance surface; the DB row stays encrypted', async () => {
    const { req } = await createRequest('FINANCE');
    const { accessToken } = await loginAs(app, 'finance.karimi');

    const res = await request(app.getHttpServer())
      .get(`/refunds/${req.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.iban).toBe('IR820170000000332211009900');
    expect(res.body.data.nationalId).toBe('0012345679');

    const row = await prisma.refundRequest.findUniqueOrThrow({
      where: { id: req.id },
    });
    expect(row.ibanEnc).not.toContain('IR8201');
  });

  it('every endpoint 403s for non-finance roles', async () => {
    const { req } = await createRequest('FINANCE');
    const ceo = await loginAs(app, 'ceo');

    const list = await request(app.getHttpServer())
      .get('/refunds')
      .set('Authorization', `Bearer ${ceo.accessToken}`);
    expect(list.status).toBe(403);

    const pay = await request(app.getHttpServer())
      .patch(`/refunds/${req.id}/pay`)
      .set('Authorization', `Bearer ${ceo.accessToken}`);
    expect(pay.status).toBe(403);
  });

  it('refer sets the assignee + history WITHOUT changing status; non-staff assignee → 400', async () => {
    const { req } = await createRequest('FINANCE');
    const { accessToken } = await loginAs(app, 'finance.karimi');
    const staffer = await prisma.user.findFirstOrThrow({
      where: { username: 'com.ahmadi' },
    });

    const res = await request(app.getHttpServer())
      .patch(`/refunds/${req.id}/refer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ assigneeId: staffer.id });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('FINANCE'); // unchanged, per design
    expect(res.body.data.assigneeId).toBe(staffer.id);
    const history = res.body.data.history as { labelFa: string }[];
    expect(history.some((h) => h.labelFa.includes('ارجاع به'))).toBe(true);

    const customer = await prisma.user.findFirstOrThrow({
      where: { role: 'USER' },
    });
    const invalid = await request(app.getHttpServer())
      .patch(`/refunds/${req.id}/refer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ assigneeId: customer.id });
    expect(invalid.status).toBe(400);
  });

  it('pay is transactional: ledger REFUND row + booking REFUNDED + PAID with processedBy; audited', async () => {
    const { booking, req } = await createRequest('FINANCE');
    const { accessToken } = await loginAs(app, 'finance.karimi');
    const stepUp = await stepUpFor(
      app,
      accessToken!,
      'finance.karimi',
      'REFUND_PAYOUT',
    );

    const res = await request(app.getHttpServer())
      .patch(`/refunds/${req.id}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(stepUp);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PAID');
    expect(res.body.data.processedBy.role).toBe('FINANCE_MANAGER');
    expect(res.body.data.paidAt).toBeTruthy();

    const ledger = await prisma.ledgerEntry.findMany({
      where: { bookingId: booking.id, type: 'REFUND' },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].signedAmountIrr).toBe(-req.refundableIrr);

    const updatedBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(updatedBooking.status).toBe('REFUNDED');

    const audit = await prisma.auditLog.findFirst({
      where: {
        category: 'REFUND',
        entityType: 'RefundRequest',
        entityId: req.id,
      },
    });
    expect(audit).not.toBeNull();
  });

  it('pay on SUBMITTED → 409 «در انتظار ادمین»; double-pay → 409 with exactly ONE ledger row', async () => {
    const submitted = await createRequest('SUBMITTED');
    const { accessToken } = await loginAs(app, 'finance.karimi');
    const stepUp1 = await stepUpFor(
      app,
      accessToken!,
      'finance.karimi',
      'REFUND_PAYOUT',
    );

    const early = await request(app.getHttpServer())
      .patch(`/refunds/${submitted.req.id}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(stepUp1);
    expect(early.status).toBe(409);
    expect(early.body.error.message).toBe('در انتظار ادمین');

    const payable = await createRequest('FINANCE');
    const stepUp2 = await stepUpFor(
      app,
      accessToken!,
      'finance.karimi',
      'REFUND_PAYOUT',
    );
    const first = await request(app.getHttpServer())
      .patch(`/refunds/${payable.req.id}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(stepUp2);
    expect(first.status).toBe(200);

    const stepUp3 = await stepUpFor(
      app,
      accessToken!,
      'finance.karimi',
      'REFUND_PAYOUT',
    );
    const replay = await request(app.getHttpServer())
      .patch(`/refunds/${payable.req.id}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(stepUp3);
    expect(replay.status).toBe(409);

    const ledger = await prisma.ledgerEntry.count({
      where: { bookingId: payable.booking.id, type: 'REFUND' },
    });
    expect(ledger).toBe(1);
  });

  it('the ledger reconciles: sum of REFUND entries equals the paid requests’ refundable totals', async () => {
    const a = await createRequest('FINANCE', 20_000_000);
    const b = await createRequest('FINANCE', 40_000_000);
    const { accessToken } = await loginAs(app, 'finance.karimi');

    for (const { req } of [a, b]) {
      const stepUp = await stepUpFor(
        app,
        accessToken!,
        'finance.karimi',
        'REFUND_PAYOUT',
      );
      const res = await request(app.getHttpServer())
        .patch(`/refunds/${req.id}/pay`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(stepUp);
      expect(res.status).toBe(200);
    }

    const ledgerSum = await prisma.ledgerEntry.aggregate({
      where: {
        bookingId: { in: [a.booking.id, b.booking.id] },
        type: 'REFUND',
      },
      _sum: { signedAmountIrr: true },
    });
    expect(ledgerSum._sum.signedAmountIrr).toBe(
      -(a.req.refundableIrr + b.req.refundableIrr),
    );
  });
});

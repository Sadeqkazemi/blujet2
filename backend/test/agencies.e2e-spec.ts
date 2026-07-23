import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAs, stepUpFor } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

describe('Agencies (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Fresh app per test — avoids leaking the shared login-route throttle budget
  // across tests (matches panels.e2e-spec.ts's convention for this module).
  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  /** A throwaway agency + credit line, independent of shared seed data, so
   * mutation-heavy tests never depend on execution order. */
  async function createFreshAgency(overrides?: { limitIrr?: number }) {
    const suffix = crypto.randomUUID().slice(0, 8);
    const user = await prisma.user.create({
      data: {
        role: 'AGENCY',
        // Hex→'0' mapping collided as test users accumulated (unique-phone flake) — use real random digits.
        phone: `+9891${crypto.randomInt(10_000_000, 100_000_000)}`,
        fullName: `آژانس تست ${suffix}`,
        isActive: true,
      },
    });
    await prisma.agencyProfile.create({
      data: {
        userId: user.id,
        licenseNo: `AG-TEST-${suffix}`,
        managerName: 'مدیر تست',
        phone: user.phone!,
        email: `${suffix}@test.example`,
        city: 'تهران',
        address: 'آدرس تست',
        tier: 'NORMAL',
      },
    });
    await prisma.agencyCreditLine.create({
      data: {
        agencyId: user.id,
        limitIrr: overrides?.limitIrr ?? 1_000_000_000,
      },
    });
    return user.id;
  }

  async function addAgencySale(agencyId: string, amountIrr: number) {
    const instance = await prisma.flightInstance.findFirst();
    if (!instance) throw new Error('seed flightInstance missing');
    const booking = await prisma.booking.create({
      data: {
        pnr: `TST${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        flightInstanceId: instance.id,
        channel: 'AGENCY',
        agencyId,
        status: 'TICKETED',
        priceIrr: amountIrr,
      },
    });
    await prisma.ledgerEntry.create({
      data: {
        bookingId: booking.id,
        agencyId,
        type: 'SALE',
        signedAmountIrr: amountIrr,
      },
    });
  }

  async function createFreshMembershipRequest(
    status: 'PENDING' | 'REFERRED' = 'PENDING',
  ) {
    const suffix = crypto.randomUUID().slice(0, 8);
    return prisma.agencyMembershipRequest.create({
      data: {
        applicantName: `متقاضی تست ${suffix}`,
        managerName: 'مدیر متقاضی',
        licenseNo: `AG-REQ-${suffix}`,
        city: 'شیراز',
        phone: `+9892${crypto.randomInt(10_000_000, 100_000_000)}`,
        email: `${suffix}@applicant.example`,
        status,
      },
    });
  }

  // ── Listing & detail ────────────────────────────────────────────────

  it('GET /agencies returns the same 4 KPI cards for all 3 agency-tab roles', async () => {
    for (const username of ['senior.rahimi', 'finance.karimi', 'comm.abbasi']) {
      const { accessToken } = await loginAs(app, username);
      const res = await request(app.getHttpServer())
        .get('/agencies')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      const kpis = res.body.data.kpis as Record<string, unknown>;
      expect(Object.keys(kpis).sort()).toEqual(
        [
          'activeCount',
          'pendingSettlementCount',
          'totalCreditGrantedIrr',
          'totalUsedIrr',
        ].sort(),
      );
    }
  });

  it('a non-agency-tab role (IT_MANAGER) gets 403 on the agencies list and detail endpoints', async () => {
    const { accessToken } = await loginAs(app, 'itadmin');
    const agencyId = await createFreshAgency();

    const list = await request(app.getHttpServer())
      .get('/agencies')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(list.status).toBe(403);

    const detail = await request(app.getHttpServer())
      .get(`/agencies/${agencyId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(detail.status).toBe(403);
  });

  it('GET /agencies?q= searches by manager name', async () => {
    const suffix = crypto.randomUUID().slice(0, 6);
    const agencyId = await createFreshAgency();
    await prisma.agencyProfile.update({
      where: { userId: agencyId },
      data: { managerName: `جستجوپذیر-${suffix}` },
    });

    const { accessToken } = await loginAs(app, 'senior.rahimi');
    const res = await request(app.getHttpServer())
      .get(`/agencies?q=${encodeURIComponent(`جستجوپذیر-${suffix}`)}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.agencies).toHaveLength(1);
    expect(res.body.data.agencies[0].id).toBe(agencyId);
  });

  it('debtorsOnly=true (Commercial) returns only agencies with usedIrr > 0 or a pending invoice', async () => {
    const debtor = await createFreshAgency();
    await addAgencySale(debtor, 500_000_000);
    const healthy = await createFreshAgency();

    const { accessToken } = await loginAs(app, 'comm.abbasi');
    const res = await request(app.getHttpServer())
      .get('/agencies?debtorsOnly=true')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.agencies.map((a: { id: string }) => a.id);
    expect(ids).toContain(debtor);
    expect(ids).not.toContain(healthy);
  });

  it('detail stats reconcile against Booking rows for that agency', async () => {
    const agencyId = await createFreshAgency();
    await addAgencySale(agencyId, 300_000_000);
    await addAgencySale(agencyId, 200_000_000);

    const { accessToken } = await loginAs(app, 'senior.rahimi');
    const res = await request(app.getHttpServer())
      .get(`/agencies/${agencyId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.stats.ticketsIssued).toBe(2);
    expect(res.body.data.stats.totalSalesIrr).toBe(500_000_000);
    expect(res.body.data.credit.usedIrr).toBe(500_000_000);
  });

  it('activityScore is included for Finance/Commercial but omitted for Senior Manager', async () => {
    const agencyId = await createFreshAgency();

    const senior = await loginAs(app, 'senior.rahimi');
    const seniorRes = await request(app.getHttpServer())
      .get(`/agencies/${agencyId}`)
      .set('Authorization', `Bearer ${senior.accessToken}`);
    expect(seniorRes.body.data.activityScore).toBeUndefined();

    const finance = await loginAs(app, 'finance.karimi');
    const financeRes = await request(app.getHttpServer())
      .get(`/agencies/${agencyId}`)
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(financeRes.body.data.activityScore).toEqual(
      expect.objectContaining({
        score: expect.any(Number),
        badge: expect.any(String),
      }),
    );
  });

  it('activityScore matches the confirmed formula exactly: seatsSold*10 + paidInvoices*100 - unpaidInvoices*60 + (isActive?40:0)', async () => {
    const agencyId = await createFreshAgency();
    const instance = await prisma.flightInstance.findFirstOrThrow();
    const commercial = await prisma.user.findFirstOrThrow({
      where: { username: 'comm.abbasi' },
    });

    // 2 ticketed bookings, 1 paid invoice, 1 unpaid invoice, agency active
    // -> 2*10 + 1*100 - 1*60 + 40 = 100 (BRONZE, since < 400).
    for (let i = 0; i < 2; i++) {
      await prisma.booking.create({
        data: {
          pnr: `SCR${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
          flightInstanceId: instance.id,
          channel: 'AGENCY',
          agencyId,
          status: 'TICKETED',
          priceIrr: 100_000_000,
        },
      });
    }
    await prisma.agencyInvoice.create({
      data: {
        agencyId,
        invoiceNo: `SCR-PAID-${crypto.randomUUID().slice(0, 8)}`,
        issuedById: commercial.id,
        dueAt: new Date(),
        amountIrr: 50_000_000,
        status: 'PAID',
        paidAt: new Date(),
      },
    });
    await prisma.agencyInvoice.create({
      data: {
        agencyId,
        invoiceNo: `SCR-UNPAID-${crypto.randomUUID().slice(0, 8)}`,
        issuedById: commercial.id,
        dueAt: new Date(),
        amountIrr: 50_000_000,
        status: 'UNPAID',
      },
    });

    const { accessToken } = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .get(`/agencies/${agencyId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.body.data.activityScore).toEqual({
      score: 100,
      badge: 'BRONZE',
    });
  });

  // ── Credit & settlement ──────────────────────────────────────────────

  it('PATCH credit updates only limitIrr — usedIrr in the response is always derived, never the submitted value', async () => {
    const agencyId = await createFreshAgency();
    await addAgencySale(agencyId, 400_000_000);

    const { accessToken } = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .patch(`/agencies/${agencyId}/credit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ limitIrr: 2_000_000_000 });

    expect(res.status).toBe(200);
    expect(res.body.data.limitIrr).toBe(2_000_000_000);
    expect(res.body.data.usedIrr).toBe(400_000_000);

    const auditRow = await prisma.auditLog.findFirst({
      where: {
        category: 'AGENCY',
        entityType: 'AgencyProfile',
        entityId: agencyId,
        action: 'تغییر سقف اعتبار آژانس',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditRow).not.toBeNull();
  });

  it('usedIrr decreases exactly by the settlement amount after POST /settle, verified against LedgerEntry sums', async () => {
    const agencyId = await createFreshAgency();
    await addAgencySale(agencyId, 700_000_000);

    const { accessToken } = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .post(`/agencies/${agencyId}/settle`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(201);
    expect(res.body.data.settledIrr).toBe(700_000_000);

    const sum = await prisma.ledgerEntry.aggregate({
      where: { agencyId, type: { in: ['SALE', 'SETTLEMENT'] } },
      _sum: { signedAmountIrr: true },
    });
    expect(sum._sum.signedAmountIrr).toBe(0);
  });

  it('PATCH credit rejects a limit beyond the Int32 rial ceiling with 400, not a DB 500', async () => {
    const agencyId = await createFreshAgency();
    const { accessToken } = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .patch(`/agencies/${agencyId}/credit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ limitIrr: 3_000_000_000 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('POST /settle is 403 for COMMERCIAL_MANAGER', async () => {
    const agencyId = await createFreshAgency();
    const { accessToken } = await loginAs(app, 'comm.abbasi');
    const res = await request(app.getHttpServer())
      .post(`/agencies/${agencyId}/settle`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });

  // ── Suspension ────────────────────────────────────────────────────────

  it('PATCH suspend without a reason -> 400', async () => {
    const agencyId = await createFreshAgency();
    const { accessToken } = await loginAs(app, 'senior.rahimi');
    const res = await request(app.getHttpServer())
      .patch(`/agencies/${agencyId}/suspend`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('PATCH reactivate clears suspendedAt/suspendReason', async () => {
    const agencyId = await createFreshAgency();
    const { accessToken } = await loginAs(app, 'senior.rahimi');

    await request(app.getHttpServer())
      .patch(`/agencies/${agencyId}/suspend`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'دلیل تست' });

    const res = await request(app.getHttpServer())
      .patch(`/agencies/${agencyId}/reactivate`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.suspendedAt).toBeNull();
    expect(res.body.data.suspendReason).toBeNull();
  });

  // ── Membership requests ───────────────────────────────────────────────

  it('approving a request creates both User(role=AGENCY) and AgencyProfile transactionally', async () => {
    const reqRow = await createFreshMembershipRequest('PENDING');
    const { accessToken } = await loginAs(app, 'comm.abbasi');

    const res = await request(app.getHttpServer())
      .patch(`/agencies/requests/${reqRow.id}/approve`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);

    const newAgencyId = res.body.data.agencyId as string;
    const user = await prisma.user.findUnique({ where: { id: newAgencyId } });
    const profile = await prisma.agencyProfile.findUnique({
      where: { userId: newAgencyId },
    });
    expect(user?.role).toBe('AGENCY');
    expect(profile).not.toBeNull();
  });

  it('rejecting a request sets status without creating any User/AgencyProfile', async () => {
    const reqRow = await createFreshMembershipRequest('PENDING');
    const { accessToken } = await loginAs(app, 'senior.rahimi');

    const res = await request(app.getHttpServer())
      .patch(`/agencies/requests/${reqRow.id}/reject`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reviewNote: 'رد شد' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');

    const usersWithThisPhone = await prisma.user.findMany({
      where: { phone: reqRow.phone },
    });
    expect(usersWithThisPhone).toHaveLength(0);
  });

  it('PATCH .../refer is 403 for FINANCE_MANAGER', async () => {
    const reqRow = await createFreshMembershipRequest('PENDING');
    const senior = await prisma.user.findFirstOrThrow({
      where: { username: 'senior.rahimi' },
    });
    const { accessToken } = await loginAs(app, 'finance.karimi');

    const res = await request(app.getHttpServer())
      .patch(`/agencies/requests/${reqRow.id}/refer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ referredToId: senior.id });
    expect(res.status).toBe(403);
  });

  it('approving an already-decided request -> 409, not a silent overwrite', async () => {
    const reqRow = await createFreshMembershipRequest('PENDING');
    const { accessToken } = await loginAs(app, 'comm.abbasi');

    const first = await request(app.getHttpServer())
      .patch(`/agencies/requests/${reqRow.id}/approve`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(first.status).toBe(200);

    const second = await request(app.getHttpServer())
      .patch(`/agencies/requests/${reqRow.id}/approve`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(second.status).toBe(409);
  });

  // ── API keys (Senior Manager only) ─────────────────────────────────────

  it('POST .../api-key for a non-Senior-Manager role -> 403', async () => {
    const agencyId = await createFreshAgency();
    const { accessToken } = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .post(`/agencies/${agencyId}/api-key`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ scope: 'FULL' });
    expect(res.status).toBe(403);
  });

  it('the raw API key is returned once at creation and the DB only stores a hash', async () => {
    const agencyId = await createFreshAgency();
    const { accessToken } = await loginAs(app, 'senior.rahimi');
    const stepUp = await stepUpFor(
      app,
      accessToken!,
      'senior.rahimi',
      'API_KEY_ROTATE',
    );
    const res = await request(app.getHttpServer())
      .post(`/agencies/${agencyId}/api-key`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ scope: 'FULL', ...stepUp });

    expect(res.status).toBe(201);
    expect(typeof res.body.data.rawKey).toBe('string');

    const row = await prisma.agencyApiKey.findUnique({
      where: { id: res.body.data.id },
    });
    expect(row?.keyHash).not.toBe(res.body.data.rawKey);
    expect(row).not.toHaveProperty('rawKey');
  });

  it('regenerating a key changes its stored hash (old key hash no longer matches)', async () => {
    const agencyId = await createFreshAgency();
    const { accessToken } = await loginAs(app, 'senior.rahimi');
    const stepUp1 = await stepUpFor(
      app,
      accessToken!,
      'senior.rahimi',
      'API_KEY_ROTATE',
    );
    const created = await request(app.getHttpServer())
      .post(`/agencies/${agencyId}/api-key`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ scope: 'FULL', ...stepUp1 });
    const originalHash = (
      await prisma.agencyApiKey.findUnique({
        where: { id: created.body.data.id },
      })
    )?.keyHash;

    const stepUp2 = await stepUpFor(
      app,
      accessToken!,
      'senior.rahimi',
      'API_KEY_ROTATE',
    );
    const regenerated = await request(app.getHttpServer())
      .patch(`/agencies/${agencyId}/api-key/${created.body.data.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ regenerate: true, ...stepUp2 });

    expect(regenerated.status).toBe(200);
    const newHash = (
      await prisma.agencyApiKey.findUnique({
        where: { id: created.body.data.id },
      })
    )?.keyHash;
    expect(newHash).not.toBe(originalHash);
  });

  // ── Invoices & messaging (Commercial only, Finance read-only) ──────────

  it('POST .../invoices is 403 for SENIOR_MANAGER and FINANCE_MANAGER, 200-range for COMMERCIAL_MANAGER', async () => {
    const agencyId = await createFreshAgency();
    const body = {
      amountIrr: 100_000_000,
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    };

    const senior = await loginAs(app, 'senior.rahimi');
    const seniorRes = await request(app.getHttpServer())
      .post(`/agencies/${agencyId}/invoices`)
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send(body);
    expect(seniorRes.status).toBe(403);

    const finance = await loginAs(app, 'finance.karimi');
    const financeRes = await request(app.getHttpServer())
      .post(`/agencies/${agencyId}/invoices`)
      .set('Authorization', `Bearer ${finance.accessToken}`)
      .send(body);
    expect(financeRes.status).toBe(403);

    const commercial = await loginAs(app, 'comm.abbasi');
    const commercialRes = await request(app.getHttpServer())
      .post(`/agencies/${agencyId}/invoices`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send(body);
    expect(commercialRes.status).toBe(201);
  });

  it('GET .../invoices is 200 (read) for all 3 roles', async () => {
    const agencyId = await createFreshAgency();
    for (const username of ['senior.rahimi', 'finance.karimi', 'comm.abbasi']) {
      const { accessToken } = await loginAs(app, username);
      const res = await request(app.getHttpServer())
        .get(`/agencies/${agencyId}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
    }
  });

  it('paying an invoice writes exactly one SETTLEMENT ledger entry and is idempotent (double pay -> 409)', async () => {
    const agencyId = await createFreshAgency();
    const commercial = await loginAs(app, 'comm.abbasi');
    const issued = await request(app.getHttpServer())
      .post(`/agencies/${agencyId}/invoices`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send({
        amountIrr: 150_000_000,
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
    const invoiceId = issued.body.data.id as string;

    const finance = await loginAs(app, 'finance.karimi');
    const pay1 = await request(app.getHttpServer())
      .patch(`/agencies/${agencyId}/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(pay1.status).toBe(200);

    const pay2 = await request(app.getHttpServer())
      .patch(`/agencies/${agencyId}/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(pay2.status).toBe(409);

    const settlementEntries = await prisma.ledgerEntry.count({
      where: { agencyId, type: 'SETTLEMENT', signedAmountIrr: -150_000_000 },
    });
    expect(settlementEntries).toBe(1);
  });

  it('GET/POST .../messages is 403 for SENIOR_MANAGER and FINANCE_MANAGER', async () => {
    const agencyId = await createFreshAgency();

    const senior = await loginAs(app, 'senior.rahimi');
    const seniorGet = await request(app.getHttpServer())
      .get(`/agencies/${agencyId}/messages`)
      .set('Authorization', `Bearer ${senior.accessToken}`);
    expect(seniorGet.status).toBe(403);

    const finance = await loginAs(app, 'finance.karimi');
    const financePost = await request(app.getHttpServer())
      .post(`/agencies/${agencyId}/messages`)
      .set('Authorization', `Bearer ${finance.accessToken}`)
      .send({ body: 'سلام' });
    expect(financePost.status).toBe(403);

    const commercial = await loginAs(app, 'comm.abbasi');
    const commercialRes = await request(app.getHttpServer())
      .post(`/agencies/${agencyId}/messages`)
      .set('Authorization', `Bearer ${commercial.accessToken}`)
      .send({ body: 'سلام' });
    expect(commercialRes.status).toBe(201);
  });

  // ── Concurrency ──────────────────────────────────────────────────────

  it('two simultaneous PATCH .../credit calls do not crash, last write wins, and both are audited', async () => {
    const agencyId = await createFreshAgency();
    const seniorA = await loginAs(app, 'senior.rahimi');
    const financeB = await loginAs(app, 'finance.karimi');

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/agencies/${agencyId}/credit`)
        .set('Authorization', `Bearer ${seniorA.accessToken}`)
        .send({ limitIrr: 1_100_000_000 }),
      request(app.getHttpServer())
        .patch(`/agencies/${agencyId}/credit`)
        .set('Authorization', `Bearer ${financeB.accessToken}`)
        .send({ limitIrr: 1_200_000_000 }),
    ]);

    expect([resA.status, resB.status]).toEqual([200, 200]);

    const finalLine = await prisma.agencyCreditLine.findUniqueOrThrow({
      where: { agencyId },
    });
    expect([1_100_000_000, 1_200_000_000]).toContain(finalLine.limitIrr);

    const auditRows = await prisma.auditLog.findMany({
      where: {
        category: 'AGENCY',
        entityType: 'AgencyProfile',
        entityId: agencyId,
        action: 'تغییر سقف اعتبار آژانس',
      },
    });
    expect(auditRows).toHaveLength(2);
  });
});

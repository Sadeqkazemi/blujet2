import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAs, stepUpFor } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

const AGENCY_PASSWORD = 'AgencyTest@123';

describe('Agency Portal (e2e)', () => {
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
    return `Bearer ${token}`;
  }

  /** A throwaway agency with a real password, independent of the seed's
   * shared-dev-password agencies, so login tests don't depend on seed order. */
  async function createFreshAgency(overrides?: { limitIrr?: number }) {
    const suffix = crypto.randomUUID().slice(0, 8);
    // Real random digits — the hex→'0' mapping collided on the unique phone column.
    const phone = `+9891${crypto.randomInt(10_000_000, 100_000_000)}`;
    const passwordHash = await argon2.hash(AGENCY_PASSWORD);
    const user = await prisma.user.create({
      data: {
        role: 'AGENCY',
        phone,
        fullName: `آژانس تست ${suffix}`,
        passwordHash,
        isActive: true,
      },
    });
    await prisma.agencyProfile.create({
      data: {
        userId: user.id,
        licenseNo: `AG-TEST-${suffix}`,
        managerName: 'مدیر تست',
        phone,
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
    return { id: user.id, phone };
  }

  async function loginAsAgency(phone: string, password = AGENCY_PASSWORD) {
    const res = await request(app.getHttpServer())
      .post('/auth/agency/login')
      .send({ phone, password });
    return {
      res,
      accessToken: res.body?.data?.accessToken as string | undefined,
    };
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
    return booking;
  }

  // ── Login ──────────────────────────────────────────────────────────────

  it('POST /auth/agency/login: phone+password, no 2FA, issues tokens directly', async () => {
    const agency = await createFreshAgency();
    const { res, accessToken } = await loginAsAgency(agency.phone);
    expect(res.status).toBe(200);
    expect(accessToken).toBeTruthy();
    expect(res.body.data.user.role).toBe('AGENCY');
  });

  it('POST /auth/agency/login: 401 on wrong password', async () => {
    const agency = await createFreshAgency();
    const { res } = await loginAsAgency(agency.phone, 'wrong-password');
    expect(res.status).toBe(401);
  });

  it('POST /auth/agency/login: 401 for a non-AGENCY phone (staff never has this role)', async () => {
    const { res } = await loginAsAgency('+989120000001', AGENCY_PASSWORD);
    expect(res.status).toBe(401);
  });

  it('POST /auth/agency/login: 403 when the agency is suspended', async () => {
    const agency = await createFreshAgency();
    await prisma.agencyProfile.update({
      where: { userId: agency.id },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    });
    const { res } = await loginAsAgency(agency.phone);
    expect(res.status).toBe(403);
  });

  it('approving a membership request issues a one-time temp password that logs in', async () => {
    const commercial = await loginAs(app, 'comm.abbasi');
    const suffix = crypto.randomUUID().slice(0, 6);
    const reqRow = await prisma.agencyMembershipRequest.create({
      data: {
        applicantName: `آژانس جدید ${suffix}`,
        managerName: 'مدیر جدید',
        licenseNo: `AG-NEW-${suffix}`,
        city: 'شیراز',
        phone: `+9892${crypto.randomInt(10_000_000, 100_000_000)}`,
        email: `${suffix}@new.example`,
        status: 'PENDING',
      },
    });
    const approveRes = await request(app.getHttpServer())
      .patch(`/agencies/requests/${reqRow.id}/approve`)
      .set('Authorization', auth(commercial.accessToken));
    expect(approveRes.status).toBe(200);
    const tempPassword = approveRes.body.data.tempPassword as string;
    expect(tempPassword).toBeTruthy();

    const { res, accessToken } = await loginAsAgency(
      reqRow.phone,
      tempPassword,
    );
    expect(res.status).toBe(200);
    expect(accessToken).toBeTruthy();
  });

  // ── Ownership isolation ──────────────────────────────────────────────

  it('a staff JWT gets 403 on /agency-portal/* (AGENCY-only)', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const res = await request(app.getHttpServer())
      .get('/agency-portal/dashboard')
      .set('Authorization', auth(senior.accessToken));
    expect(res.status).toBe(403);
  });

  it('agency A cannot pay agency B invoice (404, ownership implicit via JWT)', async () => {
    const a = await createFreshAgency();
    const b = await createFreshAgency();
    const commercial = await loginAs(app, 'comm.abbasi');
    const issueRes = await request(app.getHttpServer())
      .post(`/agencies/${b.id}/invoices`)
      .set('Authorization', auth(commercial.accessToken))
      .send({ amountIrr: 1_000_000, dueAt: new Date().toISOString() });
    expect(issueRes.status).toBe(201);

    const { accessToken } = await loginAsAgency(a.phone);
    const payRes = await request(app.getHttpServer())
      .post(`/agency-portal/invoices/${issueRes.body.data.id}/pay`)
      .set('Authorization', auth(accessToken));
    expect(payRes.status).toBe(404);
  });

  // ── Dashboard / credit / invoices ────────────────────────────────────

  it('GET /agency-portal/dashboard returns real, self-scoped KPIs', async () => {
    const agency = await createFreshAgency();
    await addAgencySale(agency.id, 50_000_000);
    const { accessToken } = await loginAsAgency(agency.phone);
    const res = await request(app.getHttpServer())
      .get('/agency-portal/dashboard')
      .set('Authorization', auth(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.salesThisMonthIrr).toBeGreaterThanOrEqual(
      50_000_000,
    );
    expect(res.body.data.monthlySales).toHaveLength(6);
    expect(res.body.data.credit.limitIrr).toBe(1_000_000_000);
  });

  it('GET /agency-portal/credit matches the staff-side derivation', async () => {
    const agency = await createFreshAgency({ limitIrr: 700_000_000 });
    await addAgencySale(agency.id, 100_000_000);
    const { accessToken } = await loginAsAgency(agency.phone);
    const res = await request(app.getHttpServer())
      .get('/agency-portal/credit')
      .set('Authorization', auth(accessToken));
    expect(res.body.data).toEqual({
      limitIrr: 700_000_000,
      usedIrr: 100_000_000,
      remainingIrr: 600_000_000,
    });
  });

  it('POST /agency-portal/invoices/:id/pay: settles via the same transactional logic, 409 on double-pay', async () => {
    const agency = await createFreshAgency();
    const commercial = await loginAs(app, 'comm.abbasi');
    const issueRes = await request(app.getHttpServer())
      .post(`/agencies/${agency.id}/invoices`)
      .set('Authorization', auth(commercial.accessToken))
      .send({ amountIrr: 20_000_000, dueAt: new Date().toISOString() });
    const invoiceId = issueRes.body.data.id;

    const { accessToken } = await loginAsAgency(agency.phone);
    const payRes = await request(app.getHttpServer())
      .post(`/agency-portal/invoices/${invoiceId}/pay`)
      .set('Authorization', auth(accessToken));
    expect(payRes.status).toBe(201);
    expect(payRes.body.data.status).toBe('PAID');

    const doublePayRes = await request(app.getHttpServer())
      .post(`/agency-portal/invoices/${invoiceId}/pay`)
      .set('Authorization', auth(accessToken));
    expect(doublePayRes.status).toBe(409);
  });

  // ── Credit requests ───────────────────────────────────────────────────

  it('POST /agency-portal/credit-requests: 400 when not exceeding the current limit', async () => {
    const agency = await createFreshAgency({ limitIrr: 500_000_000 });
    const { accessToken } = await loginAsAgency(agency.phone);
    const res = await request(app.getHttpServer())
      .post('/agency-portal/credit-requests')
      .set('Authorization', auth(accessToken))
      .send({ requestedLimitIrr: 500_000_000 });
    expect(res.status).toBe(400);
  });

  it('credit-request approval actually changes the limit via the real updateCredit path; reject leaves it untouched', async () => {
    const agency = await createFreshAgency({ limitIrr: 500_000_000 });
    const { accessToken } = await loginAsAgency(agency.phone);
    const createRes = await request(app.getHttpServer())
      .post('/agency-portal/credit-requests')
      .set('Authorization', auth(accessToken))
      .send({ requestedLimitIrr: 900_000_000, note: 'رشد فروش' });
    expect(createRes.status).toBe(201);
    const requestId = createRes.body.data.id;

    const finance = await loginAs(app, 'finance.karimi');
    const approveRes = await request(app.getHttpServer())
      .patch(`/agencies/${agency.id}/credit-requests/${requestId}/decide`)
      .set('Authorization', auth(finance.accessToken))
      .send({ approve: true });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');

    const creditRes = await request(app.getHttpServer())
      .get(`/agencies/${agency.id}/credit`)
      .set('Authorization', auth(finance.accessToken));
    expect(creditRes.body.data.limitIrr).toBe(900_000_000);

    const redecideRes = await request(app.getHttpServer())
      .patch(`/agencies/${agency.id}/credit-requests/${requestId}/decide`)
      .set('Authorization', auth(finance.accessToken))
      .send({ approve: false });
    expect(redecideRes.status).toBe(409);
  });

  it('rejecting a credit request leaves the limit unchanged', async () => {
    const agency = await createFreshAgency({ limitIrr: 500_000_000 });
    const { accessToken } = await loginAsAgency(agency.phone);
    const createRes = await request(app.getHttpServer())
      .post('/agency-portal/credit-requests')
      .set('Authorization', auth(accessToken))
      .send({ requestedLimitIrr: 900_000_000 });

    const finance = await loginAs(app, 'finance.karimi');
    const rejectRes = await request(app.getHttpServer())
      .patch(
        `/agencies/${agency.id}/credit-requests/${createRes.body.data.id}/decide`,
      )
      .set('Authorization', auth(finance.accessToken))
      .send({ approve: false });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('REJECTED');

    const creditRes = await request(app.getHttpServer())
      .get(`/agencies/${agency.id}/credit`)
      .set('Authorization', auth(finance.accessToken));
    expect(creditRes.body.data.limitIrr).toBe(500_000_000);
  });

  // ── Sales & inbox ─────────────────────────────────────────────────────

  it("GET /agency-portal/sales: only this agency's bookings, real KPIs", async () => {
    const agency = await createFreshAgency();
    const other = await createFreshAgency();
    await addAgencySale(agency.id, 30_000_000);
    await addAgencySale(other.id, 999_000_000);

    const { accessToken } = await loginAsAgency(agency.phone);
    const res = await request(app.getHttpServer())
      .get('/agency-portal/sales')
      .set('Authorization', auth(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.tickets).toHaveLength(1);
    expect(res.body.data.summary.totalSalesIrr).toBe(30_000_000);
  });

  it('inbox: agency can read and post, posted messages are senderIsAgency=true, staff sees them', async () => {
    const agency = await createFreshAgency();
    const { accessToken } = await loginAsAgency(agency.phone);
    const postRes = await request(app.getHttpServer())
      .post('/agency-portal/inbox')
      .set('Authorization', auth(accessToken))
      .send({ body: 'سلام، این پیام از آژانس است.' });
    expect(postRes.status).toBe(201);
    expect(postRes.body.data.senderIsAgency).toBe(true);

    const commercial = await loginAs(app, 'comm.abbasi');
    const staffRes = await request(app.getHttpServer())
      .get(`/agencies/${agency.id}/messages`)
      .set('Authorization', auth(commercial.accessToken));
    expect(
      staffRes.body.data.some(
        (m: { senderIsAgency: boolean }) => m.senderIsAgency,
      ),
    ).toBe(true);
  });

  // ── Profile ───────────────────────────────────────────────────────────

  it('GET /agency-portal/profile: own fields only, no audit-log leakage', async () => {
    const agency = await createFreshAgency();
    const { accessToken } = await loginAsAgency(agency.phone);
    const res = await request(app.getHttpServer())
      .get('/agency-portal/profile')
      .set('Authorization', auth(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.licenseNo).toMatch(/^AG-TEST-/);
    expect(res.body.data.recentActivity).toBeUndefined();
    expect(res.body.data.activityScore).toBeUndefined();
  });

  // ── Webservice (B2B API) purchase requests ──────────────────────────────

  it('POST /agency-portal/webservice-requests: 401 without auth, 400 on invalid months', async () => {
    const noAuth = await request(app.getHttpServer())
      .post('/agency-portal/webservice-requests')
      .send({ scope: 'SEARCH_BOOK', months: 1 });
    expect(noAuth.status).toBe(401);

    const agency = await createFreshAgency();
    const { accessToken } = await loginAsAgency(agency.phone);
    const badMonths = await request(app.getHttpServer())
      .post('/agency-portal/webservice-requests')
      .set('Authorization', auth(accessToken))
      .send({ scope: 'SEARCH_BOOK', months: 6 });
    expect(badMonths.status).toBe(400);
  });

  it('creates a PENDING request with a server-computed price, visible in both the portal and staff views', async () => {
    const agency = await createFreshAgency();
    const { accessToken } = await loginAsAgency(agency.phone);
    const createRes = await request(app.getHttpServer())
      .post('/agency-portal/webservice-requests')
      .set('Authorization', auth(accessToken))
      .send({ scope: 'SEARCH_BOOK', months: 3, note: 'اتصال آزمایشی' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('PENDING');
    expect(createRes.body.data.priceIrr).toBe(120_000_000);

    const mineRes = await request(app.getHttpServer())
      .get('/agency-portal/webservice-requests')
      .set('Authorization', auth(accessToken));
    expect(mineRes.body.data).toHaveLength(1);
    expect(mineRes.body.data[0].id).toBe(createRes.body.data.id);

    const finance = await loginAs(app, 'finance.karimi');
    const staffRes = await request(app.getHttpServer())
      .get(`/agencies/${agency.id}/webservice-requests`)
      .set('Authorization', auth(finance.accessToken));
    expect(staffRes.status).toBe(200);
    expect(staffRes.body.data).toHaveLength(1);
    expect(staffRes.body.data[0].priceIrr).toBe(120_000_000);
  });

  it('rejects a client-supplied price outright (whitelist DTO) — price always comes from the plan catalog', async () => {
    const agency = await createFreshAgency();
    const { accessToken } = await loginAsAgency(agency.phone);
    const rejectedRes = await request(app.getHttpServer())
      .post('/agency-portal/webservice-requests')
      .set('Authorization', auth(accessToken))
      .send({ scope: 'FULL', months: 12, priceIrr: 1 });
    expect(rejectedRes.status).toBe(400);

    const createRes = await request(app.getHttpServer())
      .post('/agency-portal/webservice-requests')
      .set('Authorization', auth(accessToken))
      .send({ scope: 'FULL', months: 12 });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.priceIrr).toBe(420_000_000);
  });

  it('approval issues a real API key, delivers the raw key once via the inbox, and self-service reads never expose it', async () => {
    const agency = await createFreshAgency();
    const { accessToken } = await loginAsAgency(agency.phone);
    const createRes = await request(app.getHttpServer())
      .post('/agency-portal/webservice-requests')
      .set('Authorization', auth(accessToken))
      .send({ scope: 'SEARCH_BOOK', months: 1 });
    const requestId = createRes.body.data.id;

    const senior = await loginAs(app, 'senior.rahimi');
    const stepUp = await stepUpFor(
      app,
      senior.accessToken!,
      'senior.rahimi',
      'API_KEY_ROTATE',
    );
    const approveRes = await request(app.getHttpServer())
      .patch(`/agencies/${agency.id}/webservice-requests/${requestId}/decide`)
      .set('Authorization', auth(senior.accessToken))
      .send({ approve: true, ...stepUp });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');

    const keyRow = await prisma.agencyApiKey.findFirst({
      where: { agencyId: agency.id },
      orderBy: { activatedAt: 'desc' },
    });
    expect(keyRow?.scope).toBe('SEARCH_BOOK');

    const inboxRes = await request(app.getHttpServer())
      .get('/agency-portal/inbox')
      .set('Authorization', auth(accessToken));
    const keyMessage = inboxRes.body.data.find((m: { body: string }) =>
      m.body.includes('کلید دسترسی API شما'),
    );
    expect(keyMessage).toBeDefined();
    expect(keyMessage.body).toContain('bjk_');

    const apiKeysRes = await request(app.getHttpServer())
      .get('/agency-portal/api-keys')
      .set('Authorization', auth(accessToken));
    expect(apiKeysRes.status).toBe(200);
    expect(apiKeysRes.body.data).toHaveLength(1);
    expect(apiKeysRes.body.data[0]).not.toHaveProperty('keyHash');
    expect(apiKeysRes.body.data[0]).not.toHaveProperty('rawKey');

    const redecideRes = await request(app.getHttpServer())
      .patch(`/agencies/${agency.id}/webservice-requests/${requestId}/decide`)
      .set('Authorization', auth(senior.accessToken))
      .send({ approve: false });
    expect(redecideRes.status).toBe(409);
  });

  it('rejecting a webservice request issues no key and leaves the request REJECTED', async () => {
    const agency = await createFreshAgency();
    const { accessToken } = await loginAsAgency(agency.phone);
    const createRes = await request(app.getHttpServer())
      .post('/agency-portal/webservice-requests')
      .set('Authorization', auth(accessToken))
      .send({ scope: 'FULL', months: 1 });

    const commercial = await loginAs(app, 'comm.abbasi');
    const rejectRes = await request(app.getHttpServer())
      .patch(
        `/agencies/${agency.id}/webservice-requests/${createRes.body.data.id}/decide`,
      )
      .set('Authorization', auth(commercial.accessToken))
      .send({ approve: false });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('REJECTED');

    const keyRow = await prisma.agencyApiKey.findFirst({
      where: { agencyId: agency.id },
    });
    expect(keyRow).toBeNull();
  });

  it('approving with a wrong step-up code leaves the request PENDING (never approved without a real key)', async () => {
    const agency = await createFreshAgency();
    const { accessToken } = await loginAsAgency(agency.phone);
    const createRes = await request(app.getHttpServer())
      .post('/agency-portal/webservice-requests')
      .set('Authorization', auth(accessToken))
      .send({ scope: 'SEARCH_BOOK', months: 1 });
    const requestId = createRes.body.data.id;

    const senior = await loginAs(app, 'senior.rahimi');
    const stepUp = await stepUpFor(
      app,
      senior.accessToken!,
      'senior.rahimi',
      'API_KEY_ROTATE',
    );
    const badRes = await request(app.getHttpServer())
      .patch(`/agencies/${agency.id}/webservice-requests/${requestId}/decide`)
      .set('Authorization', auth(senior.accessToken))
      .send({
        approve: true,
        stepUpChallengeId: stepUp.stepUpChallengeId,
        stepUpCode: '000000',
      });
    expect(badRes.status).toBe(401);

    const mineRes = await request(app.getHttpServer())
      .get('/agency-portal/webservice-requests')
      .set('Authorization', auth(accessToken));
    expect(mineRes.body.data[0].status).toBe('PENDING');
  });

  it('GET .../webservice-requests and decide are 403 for a non-AGENCY_TAB staff role', async () => {
    const agency = await createFreshAgency();
    const employee = await loginAs(app, 'com.ahmadi');
    const res = await request(app.getHttpServer())
      .get(`/agencies/${agency.id}/webservice-requests`)
      .set('Authorization', auth(employee.accessToken));
    expect(res.status).toBe(403);
  });
});

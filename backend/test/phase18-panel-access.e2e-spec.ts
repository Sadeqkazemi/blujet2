import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { encryptPii, hashPii } from '../src/common/pii-crypto';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

/**
 * Phase 18: SITE_ADMIN gets real (conservative, read/refer-only) backend
 * access matching پنل ادمین سایت.dc.html's roleDefs.siteAdmin.access, and
 * EMPLOYEE gets fine-grained access gated by real EmployeePermission
 * grants (EmployeePermissionGuard + @RequiresPermission), matching
 * پنل کارمند.dc.html's dynamic navKeys formula. See docs/DB_SCHEMA.md's
 * Phase 18 section for the full scope + deferrals.
 */
describe('Phase 18 — SITE_ADMIN + EMPLOYEE panel access (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createRefundRequest(
    status: 'SUBMITTED' | 'FINANCE' = 'SUBMITTED',
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
        pnr: `P18${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
        flightInstanceId: instance.id,
        channel: 'SYSTEM',
        status: 'TICKETED',
        priceIrr: 20_000_000,
      },
    });
    return prisma.refundRequest.create({
      data: {
        bookingId: booking.id,
        passengerName: `مسافر ${crypto.randomUUID().slice(0, 4)}`,
        ibanEnc: encryptPii('IR820170000000332211009900'),
        nidEnc: encryptPii('0012345679'),
        totalPaidIrr: 20_000_000,
        penaltyPct: 30,
        penaltyAmountIrr: 6_000_000,
        refundableIrr: 14_000_000,
        status,
        history: [{ step: 'submitted', labelFa: 'ثبت درخواست', at: 'اکنون' }],
      },
    });
  }

  async function createAgencyRequest() {
    return prisma.agencyMembershipRequest.create({
      data: {
        applicantName: 'آژانس تست فاز ۱۸',
        managerName: 'مدیر تست',
        licenseNo: `LC${crypto.randomUUID().slice(0, 6)}`,
        city: 'تهران',
        phone: `0912${Math.floor(1_000_000 + Math.random() * 8_000_000)}`,
        status: 'PENDING',
      },
    });
  }

  async function createClubMember() {
    return prisma.clubMember.create({
      data: {
        fullName: 'عضو تست فاز ۱۸',
        email: `member${crypto.randomUUID().slice(0, 6)}@example.com`,
        nationalIdEnc: encryptPii('0012345679'),
        nationalIdHash: hashPii('0012345679'),
        level: 'SILVER',
        cardStatus: 'NONE',
      },
    });
  }

  async function createEmployeeWithPermissions(
    dept: string,
    permissionKeys: string[],
  ) {
    const it = await loginAs(app, 'itadmin');
    const username = `e18.${crypto.randomUUID().slice(0, 8)}`;
    const res = await request(app.getHttpServer())
      .post('/it/employees')
      .set('Authorization', `Bearer ${it.accessToken}`)
      .send({
        fullName: 'کارمند تست فاز ۱۸',
        username,
        password: 'Blujet@1404',
        dept,
        permissionKeys,
      });
    expect(res.status).toBe(201);
    return { username, id: res.body.data.id as string };
  }

  // ── SITE_ADMIN ──────────────────────────────────────────────────────
  describe('SITE_ADMIN', () => {
    it('gets the confirmed real access: agencies list/detail, club members/issue-card, refunds list/detail/refer, passenger-reports search, cartable', async () => {
      const { accessToken } = await loginAs(app, 'site.admin');
      const agency = await prisma.agencyProfile.findFirstOrThrow();
      const refund = await createRefundRequest();
      const member = await createClubMember();
      const finance = await prisma.user.findUniqueOrThrow({
        where: { username: 'finance.karimi' },
      });

      const checks: Array<[string, () => Promise<request.Response>]> = [
        [
          'GET /agencies',
          () =>
            request(app.getHttpServer())
              .get('/agencies')
              .set('Authorization', `Bearer ${accessToken}`),
        ],
        [
          `GET /agencies/${agency.userId}`,
          () =>
            request(app.getHttpServer())
              .get(`/agencies/${agency.userId}`)
              .set('Authorization', `Bearer ${accessToken}`),
        ],
        [
          'GET /club/members',
          () =>
            request(app.getHttpServer())
              .get('/club/members')
              .set('Authorization', `Bearer ${accessToken}`),
        ],
        [
          `POST /club/members/${member.id}/issue-card`,
          () =>
            request(app.getHttpServer())
              .post(`/club/members/${member.id}/issue-card`)
              .set('Authorization', `Bearer ${accessToken}`),
        ],
        [
          'GET /refunds',
          () =>
            request(app.getHttpServer())
              .get('/refunds')
              .set('Authorization', `Bearer ${accessToken}`),
        ],
        [
          `GET /refunds/${refund.id}`,
          () =>
            request(app.getHttpServer())
              .get(`/refunds/${refund.id}`)
              .set('Authorization', `Bearer ${accessToken}`),
        ],
        [
          `PATCH /refunds/${refund.id}/refer`,
          () =>
            request(app.getHttpServer())
              .patch(`/refunds/${refund.id}/refer`)
              .set('Authorization', `Bearer ${accessToken}`)
              .send({ assigneeId: finance.id }),
        ],
        [
          'GET /passenger-reports/search',
          () =>
            request(app.getHttpServer())
              .get('/passenger-reports/search?q=نگار')
              .set('Authorization', `Bearer ${accessToken}`),
        ],
        [
          'GET /cartable',
          () =>
            request(app.getHttpServer())
              .get('/cartable')
              .set('Authorization', `Bearer ${accessToken}`),
        ],
      ];

      for (const [label, run] of checks) {
        const res = await run();
        if (res.status < 200 || res.status >= 300) {
          throw new Error(
            `${label} expected 2xx, got ${res.status}: ${JSON.stringify(res.body)}`,
          );
        }
      }
    });

    it('never gets agency write powers (suspend/credit) or club create/level or refund pay', async () => {
      const { accessToken } = await loginAs(app, 'site.admin');
      const agency = await prisma.agencyProfile.findFirstOrThrow();
      const refund = await createRefundRequest();
      const dummyId = '00000000-0000-0000-0000-000000000000';

      const forbidden: Array<() => Promise<request.Response>> = [
        () =>
          request(app.getHttpServer())
            .patch(`/agencies/${agency.userId}/suspend`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ reason: 'x' }),
        () =>
          request(app.getHttpServer())
            .patch(`/agencies/${agency.userId}/credit`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ limitIrr: 1 }),
        () =>
          request(app.getHttpServer())
            .post(`/agencies/${agency.userId}/settle`)
            .set('Authorization', `Bearer ${accessToken}`),
        () =>
          request(app.getHttpServer())
            .get(`/agencies/${agency.userId}/api-key`)
            .set('Authorization', `Bearer ${accessToken}`),
        () =>
          request(app.getHttpServer())
            .post('/club/members')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              fullName: 'x',
              email: 'x@x.com',
              nationalId: '0012345679',
            }),
        () =>
          request(app.getHttpServer())
            .patch(`/club/members/${dummyId}/level`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ level: 'GOLD' }),
        () =>
          request(app.getHttpServer())
            .patch(`/refunds/${refund.id}/pay`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ stepUpChallengeId: dummyId, stepUpCode: '000000' }),
      ];

      for (const run of forbidden) {
        const res = await run();
        expect(res.status).toBe(403);
      }
    });

    it('can refer an agency membership request', async () => {
      const { accessToken } = await loginAs(app, 'site.admin');
      const reqRow = await createAgencyRequest();
      const comm = await prisma.user.findUniqueOrThrow({
        where: { username: 'comm.abbasi' },
      });

      const res = await request(app.getHttpServer())
        .patch(`/agencies/requests/${reqRow.id}/refer`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ referredToId: comm.id });
      expect(res.status).toBe(200);
    });
  });

  // ── EMPLOYEE ────────────────────────────────────────────────────────
  describe('EMPLOYEE', () => {
    it('sales.moradi (seeded with ag_list + fl_view) can list agencies and flights overview, but not agency detail/requests (no ag_info/ag_requests)', async () => {
      const { accessToken } = await loginAs(app, 'sales.moradi');
      const agency = await prisma.agencyProfile.findFirstOrThrow();

      const listAgencies = await request(app.getHttpServer())
        .get('/agencies')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(listAgencies.status).toBe(200);

      const overview = await request(app.getHttpServer())
        .get('/flights/overview')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(overview.status).toBe(200);

      const detail = await request(app.getHttpServer())
        .get(`/agencies/${agency.userId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(detail.status).toBe(403);

      const requests = await request(app.getHttpServer())
        .get('/agencies/requests')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(requests.status).toBe(403);
    });

    it('sales.moradi cannot reach refunds (no rf_*) or pricing (no pr_propose) or passenger-reports (no rp_*)', async () => {
      const { accessToken } = await loginAs(app, 'sales.moradi');

      const refunds = await request(app.getHttpServer())
        .get('/refunds')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(refunds.status).toBe(403);

      const pricing = await request(app.getHttpServer())
        .get('/pricing/proposals')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(pricing.status).toBe(403);

      const reports = await request(app.getHttpServer())
        .get('/passenger-reports/search?q=نگار')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(reports.status).toBe(403);
    });

    it('an employee freshly granted rf_list+rf_details+rf_process can list/view/refer refunds but not pay', async () => {
      const { username } = await createEmployeeWithPermissions('finance', [
        'rf_list',
        'rf_details',
        'rf_process',
      ]);
      const { accessToken } = await loginAs(app, username);
      const refund = await createRefundRequest();
      const finance = await prisma.user.findUniqueOrThrow({
        where: { username: 'finance.karimi' },
      });

      const list = await request(app.getHttpServer())
        .get('/refunds')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(list.status).toBe(200);

      const detail = await request(app.getHttpServer())
        .get(`/refunds/${refund.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(detail.status).toBe(200);

      const refer = await request(app.getHttpServer())
        .patch(`/refunds/${refund.id}/refer`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ assigneeId: finance.id });
      expect(refer.status).toBe(200);

      const pay = await request(app.getHttpServer())
        .patch(`/refunds/${refund.id}/pay`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ stepUpChallengeId: 'x', stepUpCode: '000000' });
      expect(pay.status).toBe(403);
    });

    it('an employee freshly granted pr_propose can read + upsert a pricing proposal but not register it', async () => {
      const { username } = await createEmployeeWithPermissions('commercial', [
        'pr_propose',
      ]);
      const { accessToken } = await loginAs(app, username);
      const flight = await prisma.flight.findFirstOrThrow();
      const instance = await prisma.flightInstance.create({
        data: {
          flightId: flight.id,
          departureAt: new Date(Date.now() + 10 * 24 * 3_600_000),
          arrivalAt: new Date(Date.now() + 10 * 24 * 3_600_000 + 3 * 3_600_000),
          capacity: 180,
          charterSeats: 0,
          status: 'SCHEDULED',
        },
      });

      const list = await request(app.getHttpServer())
        .get('/pricing/proposals')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(list.status).toBe(200);

      const upsert = await request(app.getHttpServer())
        .put(`/pricing/flights/${instance.id}/proposal`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ proposedPriceIrr: 25_000_000, note: 'تست فاز ۱۸' });
      expect(upsert.status).toBe(200);

      const register = await request(app.getHttpServer())
        .patch(`/pricing/proposals/${upsert.body.data.id}/register`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ source: 'MANUAL' });
      expect(register.status).toBe(403);
    });

    it("doesn't affect non-EMPLOYEE roles: FINANCE_MANAGER still has full refunds access despite holding zero EmployeePermission rows", async () => {
      const { accessToken } = await loginAs(app, 'finance.karimi');
      const refund = await createRefundRequest();

      const res = await request(app.getHttpServer())
        .get(`/refunds/${refund.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
    });
  });
});

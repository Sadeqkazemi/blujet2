import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { TWO_FACTOR_PROVIDER } from '../src/modules/auth/providers/two-factor-provider.interface';
import { MockTwoFactorProvider } from '../src/modules/auth/providers/mock-two-factor.provider';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

/** Phase 16 — public agency pre-registration + corrected review-chain role
 * gates (site admin refers → commercial manager approves + SMS). See
 * docs/DB_SCHEMA.md Phase 16. */
describe('Phase 16 — agency self-registration (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let twoFactor: MockTwoFactorProvider;

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    twoFactor = app.get<MockTwoFactorProvider>(TWO_FACTOR_PROVIDER);
  });

  afterEach(async () => {
    // These phones are unique to this file, but the approve test really
    // creates a User+AgencyProfile+AgencyCreditLine — clean them up so a
    // re-run (or a combined suite run) doesn't hit the phone unique
    // constraint on a second approveRequest for the same number.
    const phonePrefix = '0912111000';
    const users = await prisma.user.findMany({
      where: { phone: { startsWith: phonePrefix } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.agencyCreditLine.deleteMany({
        where: { agencyId: { in: userIds } },
      });
      await prisma.agencyProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.agencyMembershipRequest.deleteMany({
      where: { phone: { startsWith: phonePrefix } },
    });
    await prisma.agencyRequestOtp.deleteMany({
      where: { phone: { startsWith: phonePrefix } },
    });
    await app.close();
  });

  function auth(token: string | null | undefined) {
    return `Bearer ${token}`;
  }

  async function submitFreshRequest(phone: string) {
    const otpRes = await request(app.getHttpServer())
      .post('/agencies/requests/otp')
      .send({ phone });
    expect(otpRes.status).toBe(200);
    const challengeId = otpRes.body.data.challengeId as string;
    const code = twoFactor.getLastCode(challengeId)!;
    expect(code).toBeTruthy();

    const createRes = await request(app.getHttpServer())
      .post('/agencies/requests')
      .send({
        applicantName: 'آژانس مسافرتی تست',
        managerName: 'نگار رضایی',
        licenseNo: `LIC-${phone.slice(-4)}`,
        phone,
        challengeId,
        code,
      });
    return createRes;
  }

  it('public OTP + submit creates a real PENDING request with no email/city/documents collected', async () => {
    const phone = '09121110001';
    const res = await submitFreshRequest(phone);
    expect(res.status).toBe(201);

    const row = await prisma.agencyMembershipRequest.findUniqueOrThrow({
      where: { id: res.body.data.id },
    });
    expect(row.status).toBe('PENDING');
    expect(row.phone).toBe(phone);
    expect(row.email).toBeNull();
    expect(row.city).toBeNull();
  });

  it('wrong OTP code is rejected, and a code cannot be reused', async () => {
    const phone = '09121110002';
    const otpRes = await request(app.getHttpServer())
      .post('/agencies/requests/otp')
      .send({ phone });
    const challengeId = otpRes.body.data.challengeId as string;

    const wrong = await request(app.getHttpServer())
      .post('/agencies/requests')
      .send({
        applicantName: 'آژانس',
        managerName: 'مدیر',
        licenseNo: 'LIC-0002',
        phone,
        challengeId,
        code: '000000',
      });
    expect(wrong.status).toBe(401);

    const code = twoFactor.getLastCode(challengeId)!;
    const first = await request(app.getHttpServer())
      .post('/agencies/requests')
      .send({
        applicantName: 'آژانس',
        managerName: 'مدیر',
        licenseNo: 'LIC-0002',
        phone,
        challengeId,
        code,
      });
    expect(first.status).toBe(201);

    const replay = await request(app.getHttpServer())
      .post('/agencies/requests')
      .send({
        applicantName: 'آژانس دوم',
        managerName: 'مدیر دوم',
        licenseNo: 'LIC-0003',
        phone,
        challengeId,
        code,
      });
    expect(replay.status).toBe(401);
  });

  it('review chain: SITE_ADMIN can list+refer, COMMERCIAL_MANAGER approves (SMS sent), other roles cannot approve', async () => {
    const phone = '09121110003';
    const created = await submitFreshRequest(phone);
    const requestId = created.body.data.id as string;

    const siteAdmin = await loginAs(app, 'site.admin');
    const list = await request(app.getHttpServer())
      .get('/agencies/requests?status=PENDING')
      .set('Authorization', auth(siteAdmin.accessToken));
    expect(list.status).toBe(200);
    expect(
      (list.body.data as { id: string }[]).some((r) => r.id === requestId),
    ).toBe(true);

    const senior = await loginAs(app, 'senior.rahimi');
    const seniorApprove = await request(app.getHttpServer())
      .patch(`/agencies/requests/${requestId}/approve`)
      .set('Authorization', auth(senior.accessToken));
    expect(seniorApprove.status).toBe(403);

    const commercial = await loginAs(app, 'comm.abbasi');
    const approve = await request(app.getHttpServer())
      .patch(`/agencies/requests/${requestId}/approve`)
      .set('Authorization', auth(commercial.accessToken));
    expect(approve.status).toBe(200);
    expect(approve.body.data.tempPassword).toBeTruthy();

    const agencyUser = await prisma.user.findUniqueOrThrow({
      where: { id: approve.body.data.agencyId },
    });
    expect(agencyUser.role).toBe('AGENCY');
    expect(agencyUser.phone).toBe(phone);

    const smsLog = await prisma.smsLog.findFirst({
      where: { phone, messageType: 'TEMP_PASSWORD' },
      orderBy: { createdAt: 'desc' },
    });
    expect(smsLog).not.toBeNull();
    expect(smsLog!.status).toBe('SUCCESS');
  });
});

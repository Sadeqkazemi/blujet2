import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { loginAs, loginAsCustomer } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';
import { PrismaService } from '../src/prisma/prisma.service';

/** Phase 21: فراموشی رمز — a customer proves phone ownership via the
 * existing OTP challenge, then sets a new password with no current-password
 * check (there may be none yet). Also doubles as first-time password setup,
 * and a new POST /auth/customer/login-password closes the loop so that
 * password is actually usable. See docs/API.md's Phase 21 section. */
describe('Phase 21 — forgot/set password + customer password login (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /auth/set-password', () => {
    it('401s without a token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/set-password')
        .send({ newPassword: 'NewPass1234' });
      expect(res.status).toBe(401);
    });

    it('403s a staff token — set-password is customer-only', async () => {
      const { accessToken } = await loginAs(app, 'finance.karimi');
      const res = await request(app.getHttpServer())
        .post('/auth/set-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPassword: 'NewPass1234' });
      expect(res.status).toBe(403);
    });

    it('400s a password shorter than 8 characters', async () => {
      const { accessToken } = await loginAsCustomer(app, '09130000001');
      const res = await request(app.getHttpServer())
        .post('/auth/set-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPassword: 'short1' });
      expect(res.status).toBe(400);
    });

    it('sets a real password with no current-password check, usable to log in afterward', async () => {
      const phone = '09130000002';
      const { accessToken } = await loginAsCustomer(app, phone);

      const setRes = await request(app.getHttpServer())
        .post('/auth/set-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPassword: 'FreshPass123' });
      expect(setRes.status).toBe(200);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/customer/login-password')
        .send({ phone, password: 'FreshPass123' });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.accessToken).toBeTruthy();
      expect(loginRes.body.data.user.role).toBe('USER');
    });

    it('audit-logs the password set under SECURITY', async () => {
      const phone = '09130000003';
      const { accessToken, userId } = await loginAsCustomer(app, phone);

      await request(app.getHttpServer())
        .post('/auth/set-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPassword: 'AuditedPass1' });

      const row = await prisma.auditLog.findFirst({
        where: { entityId: userId, category: 'SECURITY' },
        orderBy: { createdAt: 'desc' },
      });
      expect(row).not.toBeNull();
    });
  });

  describe('POST /auth/customer/login-password', () => {
    it('401s a wrong password', async () => {
      const phone = '09130000004';
      const { accessToken } = await loginAsCustomer(app, phone);
      await request(app.getHttpServer())
        .post('/auth/set-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPassword: 'CorrectPass1' });

      const res = await request(app.getHttpServer())
        .post('/auth/customer/login-password')
        .send({ phone, password: 'WrongPass999' });
      expect(res.status).toBe(401);
    });

    it('401s a phone that never set a password, with the same generic message as a wrong password', async () => {
      const phone = '09130000005';
      await loginAsCustomer(app, phone); // creates the USER row, no password set

      const res = await request(app.getHttpServer())
        .post('/auth/customer/login-password')
        .send({ phone, password: 'Anything123' });
      expect(res.status).toBe(401);

      const wrongPhone = await request(app.getHttpServer())
        .post('/auth/customer/login-password')
        .send({ phone: '09130000099', password: 'Anything123' });
      expect(wrongPhone.status).toBe(401);
      expect(wrongPhone.body.error.message).toBe(res.body.error.message);
    });

    it('403s a suspended account even with the correct password', async () => {
      const phone = '09130000006';
      const { accessToken, userId } = await loginAsCustomer(app, phone);
      await request(app.getHttpServer())
        .post('/auth/set-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPassword: 'SuspendedPw1' });
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/customer/login-password')
        .send({ phone, password: 'SuspendedPw1' });
      expect(res.status).toBe(403);

      // Cleanup — this phone number is shared, ambient fixture data in the
      // e2e test DB; other spec files reuse arbitrary customer phone
      // numbers and would otherwise inherit a permanently-suspended
      // account from this test.
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: true },
      });
    });

    it('400s a malformed phone number', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/customer/login-password')
        .send({ phone: '12345', password: 'Anything123' });
      expect(res.status).toBe(400);
    });
  });
});

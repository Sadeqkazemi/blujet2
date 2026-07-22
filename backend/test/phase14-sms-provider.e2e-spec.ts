import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createTestApp } from './helpers/app.helper';
import { loginAs, loginAsCustomer } from './helpers/login.helper';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Phase 14 — real SmsProvider + management log: OTP/temp-password sends
 * now write a genuine SmsLog row instead of only claiming delivery in an
 * audit-log sentence; the only fabricated-free failure mode is a missing
 * phone number. See docs/DB_SCHEMA.md Phase 14. */
describe('Phase 14 — SMS provider + management log', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'p14.' } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('customer OTP login writes a real SUCCESS SmsLog row for that phone', async () => {
    const phone = `0912${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
    const { accessToken } = await loginAsCustomer(app, phone);
    expect(accessToken).toBeDefined();

    const log = await prisma.smsLog.findFirst({
      where: { phone, messageType: 'OTP' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).not.toBeNull();
    expect(log!.status).toBe('SUCCESS');
  });

  it('POST /admins with delivery=sms logs a genuine FAILED row (create never collects a phone)', async () => {
    const ceo = await loginAs(app, 'ceo');
    const username = `p14.admin.${Date.now()}`;
    const created = await request(app.getHttpServer())
      .post('/admins')
      .set(auth(ceo.accessToken!))
      .send({
        fullName: 'مدیر تست فاز ۱۴',
        email: `${username}@blujet.example`,
        username,
        role: 'IT_MANAGER',
        password: 'Blujet@1404',
        delivery: 'sms',
      });
    expect(created.status).toBe(201);

    const log = await prisma.smsLog.findFirst({
      where: { messageType: 'TEMP_PASSWORD', phone: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).not.toBeNull();
    expect(log!.status).toBe('FAILED');
    expect(log!.failureReason).toContain('شماره موبایل');
  });

  it('POST /admins/:id/reset-password (default delivery) logs FAILED for a phoneless target', async () => {
    const ceo = await loginAs(app, 'ceo');
    // A dedicated throwaway target — never reuse a shared seeded fixture
    // account here, since reset-password actually changes its real
    // password (mustChangePassword: true), which would break every other
    // test/dev session relying on that account's known seed password.
    const username = `p14.target.${Date.now()}`;
    const target = await request(app.getHttpServer())
      .post('/admins')
      .set(auth(ceo.accessToken!))
      .send({
        fullName: 'هدف بازنشانی فاز ۱۴',
        email: `${username}@blujet.example`,
        username,
        role: 'IT_MANAGER',
        password: 'Blujet@1404',
        delivery: 'email',
      });
    expect(target.status).toBe(201);

    const before = await prisma.smsLog.count({
      where: { messageType: 'TEMP_PASSWORD', status: 'FAILED' },
    });

    const reset = await request(app.getHttpServer())
      .post(`/admins/${target.body.data.id}/reset-password`)
      .set(auth(ceo.accessToken!))
      .send({});
    expect(reset.status).toBe(201);
    expect(reset.body.data.tempPassword).toBeDefined();

    const after = await prisma.smsLog.count({
      where: { messageType: 'TEMP_PASSWORD', status: 'FAILED' },
    });
    expect(after).toBe(before + 1);
  });

  it('GET /it/services/sms-log returns real enabled/counters/recent — no uptime field', async () => {
    const { accessToken } = await loginAs(app, 'itadmin');
    const res = await request(app.getHttpServer())
      .get('/it/services/sms-log')
      .set(auth(accessToken!));
    expect(res.status).toBe(200);
    expect(typeof res.body.data.enabled).toBe('boolean');
    expect(typeof res.body.data.todaySuccessCount).toBe('number');
    expect(typeof res.body.data.todayFailedCount).toBe('number');
    expect(res.body.data.uptimePct).toBeUndefined();
    expect(Array.isArray(res.body.data.recent)).toBe(true);

    const withPhone = res.body.data.recent.find(
      (r: { phoneMasked: string | null }) => r.phoneMasked,
    );
    if (withPhone) {
      expect(withPhone.phoneMasked).not.toMatch(/^\+?\d{10,}$/);
    }
  });

  it('SENIOR_MANAGER cannot read the IT panel sms-log (role-gated)', async () => {
    const { accessToken } = await loginAs(app, 'senior.rahimi');
    const res = await request(app.getHttpServer())
      .get('/it/services/sms-log')
      .set(auth(accessToken!));
    expect(res.status).toBe(403);
  });
});

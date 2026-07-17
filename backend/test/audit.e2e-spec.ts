import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

describe('Audit (e2e)', () => {
  let app: INestApplication<App>;

  // Fresh app per test — avoids leaking the shared login-route throttle budget across tests.
  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  beforeAll(async () => {
    const setupApp = await createTestApp();
    const setupPrisma = setupApp.get(PrismaService);

    const users = await setupPrisma.user.findMany({
      where: { username: { in: ['finance.karimi', 'senior.rahimi', 'ceo'] } },
    });
    const byUsername = Object.fromEntries(users.map((u) => [u.username, u]));

    await setupPrisma.auditLog.createMany({
      data: [
        {
          actorId: byUsername['finance.karimi'].id,
          actorRole: 'FINANCE_MANAGER',
          category: 'REFUND',
          action: 'تأیید استرداد',
          detail: 'test entry from finance manager',
        },
        {
          actorId: byUsername['senior.rahimi'].id,
          actorRole: 'SENIOR_MANAGER',
          category: 'ACCESS',
          action: 'تغییر دسترسی',
          detail: 'test entry from senior manager',
        },
        {
          actorId: byUsername['ceo'].id,
          actorRole: 'CEO',
          category: 'PRICING',
          action: 'تأیید قیمت',
          detail: 'test entry from ceo',
        },
      ],
    });

    await setupApp.close();
  });

  it("CEO's manager-reports excludes CEO/SENIOR_MANAGER/BOARD_CHAIR as actor", async () => {
    const { accessToken } = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .get('/audit/manager-reports')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const roles = res.body.data.map((r: { actorRole: string }) => r.actorRole);
    expect(roles).not.toContain('CEO');
    expect(roles).not.toContain('SENIOR_MANAGER');
    expect(roles).not.toContain('BOARD_CHAIR');
    expect(roles).toContain('FINANCE_MANAGER');
  });

  it("Senior Manager's manager-reports includes every role, unfiltered", async () => {
    const { accessToken } = await loginAs(app, 'senior.rahimi');
    const res = await request(app.getHttpServer())
      .get('/audit/manager-reports')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const roles = res.body.data.map((r: { actorRole: string }) => r.actorRole);
    expect(roles).toContain('CEO');
    expect(roles).toContain('SENIOR_MANAGER');
    expect(roles).toContain('FINANCE_MANAGER');
  });

  it('a non-CEO/Chair/Senior role gets 403 on manager-reports', async () => {
    const { accessToken } = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .get('/audit/manager-reports')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });

  it("IT Manager's system logs only include SYSTEM/ACCOUNT categories", async () => {
    const { accessToken } = await loginAs(app, 'itadmin');
    const res = await request(app.getHttpServer())
      .get('/audit/logs')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    for (const row of res.body.data) {
      expect(['SYSTEM', 'ACCOUNT']).toContain(row.category);
    }
  });

  it('a non-IT role gets 403 on /audit/logs', async () => {
    const { accessToken } = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .get('/audit/logs')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });
});

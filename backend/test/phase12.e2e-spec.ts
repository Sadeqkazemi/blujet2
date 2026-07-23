import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAs, stepUpFor } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';
import type { Role } from '../generated/prisma/enums';

describe('Phase 12 — admins, security, settings, CEO logs, IT panels (e2e)', () => {
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

  async function createManagedAdmin(role: Role = 'IT_MANAGER') {
    const suffix = crypto.randomUUID().slice(0, 8);
    return prisma.user.create({
      data: {
        role,
        username: `p12.${suffix}`,
        email: `p12.${suffix}@test.example`,
        fullName: `مدیر تست ${suffix}`,
        passwordHash: await argon2.hash('Blujet@1404'),
        twoFactorEnabled: true,
        isActive: true,
      },
    });
  }

  // ── admins ────────────────────────────────────────────────────────────

  it('GET /admins: hierarchy scoping — Senior never gets a manageable SENIOR_MANAGER row; roles without the tab get 403', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const res = await request(app.getHttpServer())
      .get('/admins')
      .set('Authorization', auth(senior.accessToken));
    expect(res.status).toBe(200);
    const rows = res.body.data as {
      role: string;
      managedByCaller: boolean;
      online: boolean;
    }[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows.filter((r) => r.role === 'SENIOR_MANAGER')) {
      expect(row.managedByCaller).toBe(false);
    }
    // The senior manager itself just logged in — its own row must be online
    // (real refresh-token derivation).
    expect(rows.some((r) => r.online)).toBe(true);

    const finance = await loginAs(app, 'finance.karimi');
    const forbidden = await request(app.getHttpServer())
      .get('/admins')
      .set('Authorization', auth(finance.accessToken));
    expect(forbidden.status).toBe(403);
  });

  it('POST /admins creates a real staff account that can log in; duplicate username → 409', async () => {
    const ceo = await loginAs(app, 'ceo');
    const suffix = crypto.randomUUID().slice(0, 8);
    const stepUp1 = await stepUpFor(
      app,
      ceo.accessToken!,
      'ceo',
      'ADMIN_ROLE_CHANGE',
    );
    const createRes = await request(app.getHttpServer())
      .post('/admins')
      .set('Authorization', auth(ceo.accessToken))
      .send({
        fullName: `ادمین جدید ${suffix}`,
        email: `new.${suffix}@test.example`,
        username: `new.${suffix}`,
        role: 'SITE_ADMIN',
        password: 'Fresh@123456',
        delivery: 'sms',
        ...stepUp1,
      });
    expect(createRes.status).toBe(201);

    // The new account really works against the staff login.
    const loginRes = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ username: `new.${suffix}`, password: 'Fresh@123456' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.challengeId).toBeTruthy();

    const stepUp2 = await stepUpFor(
      app,
      ceo.accessToken!,
      'ceo',
      'ADMIN_ROLE_CHANGE',
    );
    const dupRes = await request(app.getHttpServer())
      .post('/admins')
      .set('Authorization', auth(ceo.accessToken))
      .send({
        fullName: 'تکراری',
        email: `dup.${suffix}@test.example`,
        username: `new.${suffix}`,
        role: 'SITE_ADMIN',
        password: 'Fresh@123456',
        delivery: 'email',
        ...stepUp2,
      });
    expect(dupRes.status).toBe(409);
  });

  it('block really disables staff login; unblock restores it; blocking a CEO/self is forbidden', async () => {
    const target = await createManagedAdmin();
    const ceo = await loginAs(app, 'ceo');

    const blockRes = await request(app.getHttpServer())
      .patch(`/admins/${target.id}/block`)
      .set('Authorization', auth(ceo.accessToken));
    expect(blockRes.status).toBe(200);
    expect(blockRes.body.data.isActive).toBe(false);

    const loginBlocked = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ username: target.username, password: 'Blujet@1404' });
    expect(loginBlocked.status).toBe(403);

    const unblockRes = await request(app.getHttpServer())
      .patch(`/admins/${target.id}/unblock`)
      .set('Authorization', auth(ceo.accessToken));
    expect(unblockRes.status).toBe(200);
    const loginOk = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ username: target.username, password: 'Blujet@1404' });
    expect(loginOk.status).toBe(200);

    // Never CEO/BOARD_CHAIR, never self.
    const ceoUser = await prisma.user.findFirstOrThrow({
      where: { username: 'ceo' },
    });
    const blockCeo = await request(app.getHttpServer())
      .patch(`/admins/${ceoUser.id}/block`)
      .set('Authorization', auth(ceo.accessToken));
    expect(blockCeo.status).toBe(403);
  });

  it('POST /admins/:id/reset-password returns a temp password once that actually logs in; Senior cannot reset a SENIOR_MANAGER', async () => {
    const target = await createManagedAdmin();
    const chair = await loginAs(app, 'chair');

    const resetRes = await request(app.getHttpServer())
      .post(`/admins/${target.id}/reset-password`)
      .set('Authorization', auth(chair.accessToken))
      .send({});
    expect(resetRes.status).toBe(201);
    const tempPassword = resetRes.body.data.tempPassword as string;
    expect(tempPassword).toBeTruthy();

    const loginRes = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ username: target.username, password: tempPassword });
    expect(loginRes.status).toBe(200);

    const seniorTarget = await prisma.user.findFirstOrThrow({
      where: { username: 'senior.rahimi' },
    });
    const senior2 = await loginAs(app, 'senior.rahimi');
    const forbidden = await request(app.getHttpServer())
      .post(`/admins/${seniorTarget.id}/reset-password`)
      .set('Authorization', auth(senior2.accessToken))
      .send({});
    expect(forbidden.status).toBe(403);
  });

  // ── own password ──────────────────────────────────────────────────────

  it('POST /auth/change-password: wrong current password → 401; success rotates the hash both ways', async () => {
    const user = await createManagedAdmin('SITE_ADMIN');
    const session = await loginAs(app, user.username!, 'Blujet@1404');
    const token = session.accessToken;

    const wrong = await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', auth(token))
      .send({ currentPassword: 'nope-nope', newPassword: 'Next@123456' });
    expect(wrong.status).toBe(401);

    const ok = await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', auth(token))
      .send({ currentPassword: 'Blujet@1404', newPassword: 'Next@123456' });
    expect(ok.status).toBe(200);

    const oldLogin = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ username: user.username, password: 'Blujet@1404' });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app.getHttpServer())
      .post('/auth/staff/login')
      .send({ username: user.username, password: 'Next@123456' });
    expect(newLogin.status).toBe(200);
  });

  // ── CEO logs ──────────────────────────────────────────────────────────

  it('GET /audit/system-events: CEO gets real rows with the level mapping; others 403', async () => {
    const ceo = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .get('/audit/system-events')
      .set('Authorization', auth(ceo.accessToken));
    expect(res.status).toBe(200);
    const rows = res.body.data as { level: string; user: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => ['WARN', 'OK', 'INFO'].includes(r.level))).toBe(
      true,
    );

    const senior = await loginAs(app, 'senior.rahimi');
    const forbidden = await request(app.getHttpServer())
      .get('/audit/system-events')
      .set('Authorization', auth(senior.accessToken));
    expect(forbidden.status).toBe(403);
  });

  // ── settings ──────────────────────────────────────────────────────────

  it('settings round-trip: defaults come back, a patch persists, unknown keys are rejected; finance 403', async () => {
    const chair = await loginAs(app, 'chair');
    const getRes = await request(app.getHttpServer())
      .get('/settings')
      .set('Authorization', auth(chair.accessToken));
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.settings).toHaveProperty('companyName');
    expect(getRes.body.data.refundRules.length).toBeGreaterThan(0);

    const patchRes = await request(app.getHttpServer())
      .patch('/settings')
      .set('Authorization', auth(chair.accessToken))
      .send({ patch: { maintenance: true, supportPhone: '021-99999' } });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.settings.maintenance).toBe(true);
    expect(patchRes.body.data.settings.supportPhone).toBe('021-99999');

    const badRes = await request(app.getHttpServer())
      .patch('/settings')
      .set('Authorization', auth(chair.accessToken))
      .send({ patch: { totallyUnknown: 1 } });
    expect(badRes.status).toBe(400);

    // Restore for repeatable runs.
    await request(app.getHttpServer())
      .patch('/settings')
      .set('Authorization', auth(chair.accessToken))
      .send({ patch: { maintenance: false } });

    const finance = await loginAs(app, 'finance.karimi');
    const forbidden = await request(app.getHttpServer())
      .get('/settings')
      .set('Authorization', auth(finance.accessToken));
    expect(forbidden.status).toBe(403);
  });

  it('PATCH /settings/refund-rules writes the REAL Phase 7 engine rows (chair only, IT 403)', async () => {
    const chair = await loginAs(app, 'chair');
    const getRes = await request(app.getHttpServer())
      .get('/settings')
      .set('Authorization', auth(chair.accessToken));
    const rule = getRes.body.data.refundRules[0] as {
      id: string;
      penaltyPct: number;
    };
    const newPct = rule.penaltyPct === 35 ? 34 : 35;

    const patchRes = await request(app.getHttpServer())
      .patch('/settings/refund-rules')
      .set('Authorization', auth(chair.accessToken))
      .send({ rules: [{ id: rule.id, penaltyPct: newPct }] });
    expect(patchRes.status).toBe(200);

    // The Phase 7 refunds engine reads this exact table — verify the row.
    const dbRow = await prisma.refundPenaltyRule.findUniqueOrThrow({
      where: { id: rule.id },
    });
    expect(dbRow.penaltyPct).toBe(newPct);

    // Restore the original percentage.
    await request(app.getHttpServer())
      .patch('/settings/refund-rules')
      .set('Authorization', auth(chair.accessToken))
      .send({ rules: [{ id: rule.id, penaltyPct: rule.penaltyPct }] });

    const it = await loginAs(app, 'itadmin');
    const forbidden = await request(app.getHttpServer())
      .patch('/settings/refund-rules')
      .set('Authorization', auth(it.accessToken))
      .send({ rules: [{ id: rule.id, penaltyPct: 50 }] });
    expect(forbidden.status).toBe(403);
  });

  // ── IT read-only panels access ────────────────────────────────────────

  it('IT_MANAGER can read /panels/access but PATCH stays 403', async () => {
    const it = await loginAs(app, 'itadmin');
    const getRes = await request(app.getHttpServer())
      .get('/panels/access')
      .set('Authorization', auth(it.accessToken));
    expect(getRes.status).toBe(200);
    expect((getRes.body.data as unknown[]).length).toBeGreaterThan(0);

    const patchRes = await request(app.getHttpServer())
      .patch('/panels/access/FINANCE')
      .set('Authorization', auth(it.accessToken))
      .send({ enabled: false });
    expect(patchRes.status).toBe(403);
  });
});

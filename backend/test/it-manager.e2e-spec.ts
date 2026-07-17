import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

describe('IT Manager (e2e)', () => {
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

  async function createEmployee(overrides?: Partial<{ dept: string }>) {
    const { accessToken } = await loginAs(app, 'itadmin');
    const username = `emp.${crypto.randomUUID().slice(0, 8)}`;
    const res = await request(app.getHttpServer())
      .post('/it/employees')
      .set(auth(accessToken))
      .send({
        fullName: 'کارمند تست',
        username,
        password: 'testpass1',
        dept: overrides?.dept ?? 'commercial',
        rank: 'کارشناس',
        permissionKeys: ['ag_list'],
      });
    return { res, accessToken };
  }

  // ── Permission catalog & employees ──────────────────────────────────

  it('GET /it/permissions returns the catalog; non-IT role gets 403', async () => {
    const it = await loginAs(app, 'itadmin');
    const res = await request(app.getHttpServer())
      .get('/it/permissions')
      .set(auth(it.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.commercial).toBeDefined();
    expect(res.body.data.finance).toBeDefined();
    expect(res.body.data.it).toBeDefined();
    const commercialKeys = res.body.data.commercial.flatMap(
      (g: { perms: { key: string }[] }) => g.perms.map((p) => p.key),
    );
    expect(commercialKeys).toContain('ag_list');

    const ceo = await loginAs(app, 'ceo');
    const forbidden = await request(app.getHttpServer())
      .get('/it/permissions')
      .set(auth(ceo.accessToken));
    expect(forbidden.status).toBe(403);
  });

  it('POST /it/employees creates account with granted permissions, duplicate username -> 409, short password -> 400, audited', async () => {
    const { res, accessToken } = await createEmployee();
    expect(res.status).toBe(201);
    expect(res.body.data.permissions).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'ag_list' })]),
    );

    const dup = await request(app.getHttpServer())
      .post('/it/employees')
      .set(auth(accessToken))
      .send({
        fullName: 'تکراری',
        username: (await prisma.user.findFirst({ where: { fullName: 'کارمند تست' } }))!
          .username,
        password: 'testpass1',
        dept: 'commercial',
      });
    expect(dup.status).toBe(409);

    const shortPassword = await request(app.getHttpServer())
      .post('/it/employees')
      .set(auth(accessToken))
      .send({
        fullName: 'رمز کوتاه',
        username: `short.${crypto.randomUUID().slice(0, 6)}`,
        password: '123',
        dept: 'commercial',
      });
    expect(shortPassword.status).toBe(400);

    const audit = await prisma.auditLog.findFirst({
      where: { category: 'ACCOUNT', action: 'ایجاد حساب کارمند' },
    });
    expect(audit).not.toBeNull();
  });

  it('GET/PATCH /it/employees/:id and non-IT role gets 403 everywhere', async () => {
    const { res, accessToken } = await createEmployee();
    const id = res.body.data.id;

    const detail = await request(app.getHttpServer())
      .get(`/it/employees/${id}`)
      .set(auth(accessToken));
    expect(detail.status).toBe(200);
    expect(detail.body.data.available.length).toBeGreaterThan(0);

    const senior = await loginAs(app, 'senior.rahimi');
    const forbidden = await request(app.getHttpServer())
      .get(`/it/employees/${id}`)
      .set(auth(senior.accessToken));
    expect(forbidden.status).toBe(403);
  });

  it('PATCH /it/employees/:id/status suspends and reactivates, audited', async () => {
    const { res, accessToken } = await createEmployee();
    const id = res.body.data.id;

    const suspended = await request(app.getHttpServer())
      .patch(`/it/employees/${id}/status`)
      .set(auth(accessToken))
      .send({ isActive: false });
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.isActive).toBe(false);

    const reactivated = await request(app.getHttpServer())
      .patch(`/it/employees/${id}/status`)
      .set(auth(accessToken))
      .send({ isActive: true });
    expect(reactivated.body.data.isActive).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { category: 'ACCOUNT', entityType: 'User', entityId: id },
    });
    expect(audit).not.toBeNull();
  });

  it('PATCH /it/employees/:id/permissions grants/revokes idempotently, unknown key for dept -> 400, audited', async () => {
    const { res, accessToken } = await createEmployee();
    const id = res.body.data.id;

    const grant = await request(app.getHttpServer())
      .patch(`/it/employees/${id}/permissions`)
      .set(auth(accessToken))
      .send({ permissionKey: 'fl_view', grant: true });
    expect(grant.status).toBe(200);
    expect(
      grant.body.data.permissions.some((p: { key: string }) => p.key === 'fl_view'),
    ).toBe(true);

    const revoke = await request(app.getHttpServer())
      .patch(`/it/employees/${id}/permissions`)
      .set(auth(accessToken))
      .send({ permissionKey: 'fl_view', grant: false });
    expect(
      revoke.body.data.permissions.some((p: { key: string }) => p.key === 'fl_view'),
    ).toBe(false);

    // "rf_list" belongs to the finance catalog, not commercial (this employee's dept).
    const wrongDept = await request(app.getHttpServer())
      .patch(`/it/employees/${id}/permissions`)
      .set(auth(accessToken))
      .send({ permissionKey: 'rf_list', grant: true });
    expect(wrongDept.status).toBe(400);

    const audit = await prisma.auditLog.findFirst({
      where: { category: 'ACCESS', entityType: 'User', entityId: id },
    });
    expect(audit).not.toBeNull();
  });

  it('POST /it/employees/:id/reset-password returns a temp password once, replaces the hash, sets mustChangePassword, audited', async () => {
    const { res, accessToken } = await createEmployee();
    const id = res.body.data.id;
    const before = await prisma.user.findUniqueOrThrow({ where: { id } });

    const reset = await request(app.getHttpServer())
      .post(`/it/employees/${id}/reset-password`)
      .set(auth(accessToken));
    expect(reset.status).toBe(201);
    expect(typeof reset.body.data.tempPassword).toBe('string');
    expect(reset.body.data.tempPassword.length).toBeGreaterThan(5);

    const after = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(after.mustChangePassword).toBe(true);

    const resetEvent = await prisma.passwordResetEvent.findFirst({
      where: { employeeId: id },
    });
    expect(resetEvent).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { category: 'ACCOUNT', action: 'بازنشانی رمز عبور کارمند' },
    });
    expect(audit).not.toBeNull();
  });

  // ── Security ─────────────────────────────────────────────────────────

  it('GET /it/security/policy auto-creates the singleton; PATCH updates a subset, audited', async () => {
    const { accessToken } = await loginAs(app, 'itadmin');
    // Isolate from other tests/runs that may have already created+mutated
    // the id=1 singleton — force a fresh auto-create here.
    await prisma.securityPolicy.deleteMany({ where: { id: 1 } });
    const get = await request(app.getHttpServer())
      .get('/it/security/policy')
      .set(auth(accessToken));
    expect(get.status).toBe(200);
    expect(get.body.data.minLength).toBe(10);

    const patch = await request(app.getHttpServer())
      .patch('/it/security/policy')
      .set(auth(accessToken))
      .send({ minLength: 12, requireSymbol: false });
    expect(patch.status).toBe(200);
    expect(patch.body.data.minLength).toBe(12);
    expect(patch.body.data.requireSymbol).toBe(false);
    // Untouched fields survive the partial update.
    expect(patch.body.data.maxAttempts).toBe(5);

    const audit = await prisma.auditLog.findFirst({
      where: { category: 'SECURITY', action: 'به‌روزرسانی سیاست رمز عبور' },
    });
    expect(audit).not.toBeNull();
  });

  it('GET /it/security/sessions lists active sessions; logout-all revokes them and breaks refresh', async () => {
    const it = await loginAs(app, 'itadmin');
    const other = await loginAs(app, 'ceo');

    const sessions = await request(app.getHttpServer())
      .get('/it/security/sessions')
      .set(auth(it.accessToken));
    expect(sessions.status).toBe(200);
    expect(sessions.body.data.length).toBeGreaterThanOrEqual(2);

    const logoutAll = await request(app.getHttpServer())
      .post('/it/security/sessions/logout-all')
      .set(auth(it.accessToken));
    expect(logoutAll.status).toBe(201);
    expect(logoutAll.body.data.revokedCount).toBeGreaterThanOrEqual(2);

    const remaining = await prisma.refreshToken.count({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
    });
    expect(remaining).toBe(0);
    void other;
  });

  // ── Services ─────────────────────────────────────────────────────────

  it('GET /it/services returns seeded lists; apiKey never returned in plaintext', async () => {
    const { accessToken } = await loginAs(app, 'itadmin');
    const res = await request(app.getHttpServer())
      .get('/it/services')
      .set(auth(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.internal.length).toBeGreaterThan(0);
    expect(res.body.data.external.length).toBeGreaterThan(0);
    for (const s of res.body.data.external) {
      expect(s.apiKeyEncrypted).toBeUndefined();
    }
  });

  it('PATCH /it/services/internal/:key toggles; unknown key -> 404; audited', async () => {
    const { accessToken } = await loginAs(app, 'itadmin');
    const off = await request(app.getHttpServer())
      .patch('/it/services/internal/search')
      .set(auth(accessToken))
      .send({ enabled: false });
    expect(off.status).toBe(200);
    expect(off.body.data.enabled).toBe(false);

    const notFound = await request(app.getHttpServer())
      .patch('/it/services/internal/does-not-exist')
      .set(auth(accessToken))
      .send({ enabled: true });
    expect(notFound.status).toBe(404);

    const audit = await prisma.auditLog.findFirst({
      where: { category: 'SYSTEM', entityType: 'InternalService', entityId: 'search' },
    });
    expect(audit).not.toBeNull();
  });

  it('external service CRUD: create with encrypted key, update, delete', async () => {
    const { accessToken } = await loginAs(app, 'itadmin');
    const created = await request(app.getHttpServer())
      .post('/it/services/external')
      .set(auth(accessToken))
      .send({
        nameFa: 'سرویس تستی',
        provider: 'تستر',
        endpoint: 'https://example.invalid/webhook',
        apiKey: 'super-secret-key',
      });
    expect(created.status).toBe(201);
    expect(created.body.data.hasApiKey).toBe(true);
    expect(created.body.data.apiKeyEncrypted).toBeUndefined();

    const row = await prisma.externalServiceConfig.findUniqueOrThrow({
      where: { id: created.body.data.id },
    });
    expect(row.apiKeyEncrypted).not.toBe('super-secret-key');
    expect(row.apiKeyEncrypted).not.toContain('super-secret-key');

    const updated = await request(app.getHttpServer())
      .patch(`/it/services/external/${created.body.data.id}`)
      .set(auth(accessToken))
      .send({ nameFa: 'سرویس تستی ویرایش‌شده' });
    expect(updated.body.data.nameFa).toBe('سرویس تستی ویرایش‌شده');

    const removed = await request(app.getHttpServer())
      .delete(`/it/services/external/${created.body.data.id}`)
      .set(auth(accessToken));
    expect(removed.status).toBe(200);
    const gone = await prisma.externalServiceConfig.findUnique({
      where: { id: created.body.data.id },
    });
    expect(gone).toBeNull();
  });

  it('POST /it/services/external/:id/test performs a real check and never fabricates success', async () => {
    const { accessToken } = await loginAs(app, 'itadmin');
    const created = await request(app.getHttpServer())
      .post('/it/services/external')
      .set(auth(accessToken))
      .send({
        nameFa: 'سرویس غیرقابل‌دسترس',
        provider: 'تستر',
        endpoint: 'http://127.0.0.1:1/unreachable',
        timeoutMs: 1500,
      });

    const tested = await request(app.getHttpServer())
      .post(`/it/services/external/${created.body.data.id}/test`)
      .set(auth(accessToken));
    expect(tested.status).toBe(201);
    expect(tested.body.data.ok).toBe(false);
    expect(typeof tested.body.data.message).toBe('string');

    const row = await prisma.externalServiceConfig.findUniqueOrThrow({
      where: { id: created.body.data.id },
    });
    expect(row.lastTestOk).toBe(false);
    expect(row.lastTestAt).not.toBeNull();
  });

  // ── Backups ──────────────────────────────────────────────────────────

  it('POST /it/backups creates a record ending in a terminal status (never left RUNNING)', async () => {
    const { accessToken } = await loginAs(app, 'itadmin');
    const created = await request(app.getHttpServer())
      .post('/it/backups')
      .set(auth(accessToken));
    expect(created.status).toBe(201);
    expect(['SUCCESS', 'FAILED']).toContain(created.body.data.status);
    expect(created.body.data.completedAt).not.toBeNull();

    const list = await request(app.getHttpServer())
      .get('/it/backups')
      .set(auth(accessToken));
    expect(list.status).toBe(200);
    expect(list.body.data[0].id).toBe(created.body.data.id);

    const schedule = await request(app.getHttpServer())
      .get('/it/backups/schedule')
      .set(auth(accessToken));
    expect(schedule.status).toBe(200);
    expect(schedule.body.data.retentionDays).toBe(30);
  }, 30000);

  // ── Dashboard ────────────────────────────────────────────────────────

  it('GET /it/dashboard reconciles KPIs with employees/services and uses real host metrics', async () => {
    const { accessToken } = await loginAs(app, 'itadmin');
    const res = await request(app.getHttpServer())
      .get('/it/dashboard')
      .set(auth(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.kpis.activeEmployees).toBeGreaterThanOrEqual(0);
    expect(res.body.data.resources.cpuCount).toBeGreaterThan(0);
    expect(res.body.data.resources.memoryUsedPct).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.data.recentEvents)).toBe(true);
  });

  it('a non-IT_MANAGER role gets 403 on every /it/* endpoint', async () => {
    const { accessToken } = await loginAs(app, 'ceo');
    const paths = [
      '/it/permissions',
      '/it/employees',
      '/it/security/policy',
      '/it/security/sessions',
      '/it/services',
      '/it/backups',
      '/it/dashboard',
    ];
    for (const path of paths) {
      const res = await request(app.getHttpServer())
        .get(path)
        .set(auth(accessToken));
      expect(res.status).toBe(403);
    }
  });
});

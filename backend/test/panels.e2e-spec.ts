import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { TypeORMService } from '../src/typeorm/typeorm.service';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

describe('Panels (e2e)', () => {
  let app: INestApplication<App>;
  let typeorm: TypeORMService;

  // Fresh app per test — avoids leaking the shared login-route throttle budget across tests.
  beforeEach(async () => {
    app = await createTestApp();
    typeorm = app.get(TypeORMService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the confirmed tab set for Finance Manager (flights/flightops/admins/settings excluded)', async () => {
    const { accessToken } = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .get('/panels/nav')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const keys = res.body.data.map((t: { key: string }) => t.key);
    expect(keys).toEqual([
      'dashboard',
      'agencies',
      'reports',
      'staff',
      'finance',
      'refund',
      'cartable',
    ]);
    expect(keys).not.toContain('flights');
    expect(keys).not.toContain('flightops');
    expect(keys).not.toContain('admins');
    expect(keys).not.toContain('settings');
  });

  it('returns the confirmed tab set for Commercial Manager (includes webservice + flights)', async () => {
    const { accessToken } = await loginAs(app, 'comm.abbasi');
    const res = await request(app.getHttpServer())
      .get('/panels/nav')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const keys = res.body.data.map((t: { key: string }) => t.key);
    expect(keys).toEqual([
      'dashboard',
      'agencies',
      'flights',
      'reports',
      'staff',
      'clubrules',
      'webservice',
      'finance',
      'cartable',
    ]);
    expect(keys).not.toContain('flightops');
  });

  it('returns the confirmed tab set for CEO', async () => {
    const { accessToken } = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .get('/panels/nav')
      .set('Authorization', `Bearer ${accessToken}`);
    const keys = res.body.data.map((t: { key: string }) => t.key);
    expect(keys).toEqual([
      'dashboard',
      'flightops',
      'admins',
      'finance',
      'cartable',
      'club',
      'mgrreports',
      'pricing',
      'clubrules',
      'panels',
      'security',
      'logs',
      'survey',
    ]);
  });

  it('returns the confirmed tab set for BOARD_CHAIR', async () => {
    const { accessToken } = await loginAs(app, 'chair');
    const res = await request(app.getHttpServer())
      .get('/panels/nav')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const keys = res.body.data.map((t: { key: string }) => t.key);
    expect(keys).toEqual([
      'dashboard',
      'admins',
      'finance',
      'cartable',
      'settings',
      'club',
      'reservation',
      'mgrreports',
      'survey',
    ]);
  });

  it('an EMPLOYEE with no granted permissions still gets dashboard + referrals, not an error', async () => {
    const { accessToken } = await loginAs(app, 'com.ahmadi');
    const res = await request(app.getHttpServer())
      .get('/panels/nav')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
      { key: 'referrals', labelFa: 'ارجاعات', implemented: true },
    ]);
  });

  it('EMPLOYEE nav is computed dynamically from real EmployeePermission grants (sales.moradi: ag_list + fl_view)', async () => {
    const { accessToken } = await loginAs(app, 'sales.moradi');
    const res = await request(app.getHttpServer())
      .get('/panels/nav')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const keys = res.body.data.map((t: { key: string }) => t.key);
    expect(keys).toEqual([
      'dashboard',
      'agencies',
      'flights',
      'cartable',
      'referrals',
    ]);
  });

  it('returns the confirmed tab set for SITE_ADMIN', async () => {
    const { accessToken } = await loginAs(app, 'site.admin');
    const res = await request(app.getHttpServer())
      .get('/panels/nav')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const keys = res.body.data.map((t: { key: string }) => t.key);
    expect(keys).toEqual([
      'dashboard',
      'agencies',
      'flightops',
      'reports',
      'cartable',
      'club',
      'refund',
      'tickets',
      'blog',
      'media',
      'jobapps',
      'kyc',
      'settings',
    ]);
  });

  it('non-CEO/Senior roles get 403 on /panels/access', async () => {
    const { accessToken } = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .get('/panels/access')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });

  it('CEO can toggle a sibling panel off, it audits the action, and the affected role is blocked server-side', async () => {
    const ceo = await loginAs(app, 'ceo');
    const finance = await loginAs(app, 'finance.karimi');

    const before = await request(app.getHttpServer())
      .get('/reporting/kpis?granularity=q6')
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(before.status).toBe(200);

    const toggle = await request(app.getHttpServer())
      .patch('/panels/access/FINANCE')
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ enabled: false });
    expect(toggle.status).toBe(200);
    expect(toggle.body.data.enabled).toBe(false);

    const auditRow = await typeorm.auditLog.findFirst({
      where: { category: 'ACCESS', entityId: 'FINANCE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow!.actorRole).toBe('CEO');

    const after = await request(app.getHttpServer())
      .get('/reporting/kpis?granularity=q6')
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(after.status).toBe(404);

    // Cleanup — re-enable so other tests/manual runs aren't affected.
    await request(app.getHttpServer())
      .patch('/panels/access/FINANCE')
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ enabled: true });
  });

  it('CEO cannot toggle a panel outside its allowed set (e.g. SITE_ADMIN)', async () => {
    const { accessToken } = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .patch('/panels/access/SITE_ADMIN')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ enabled: false });
    expect(res.status).toBe(403);
  });

  it('GET /panels/self-status: CEO sees enabled=true by default', async () => {
    const { accessToken } = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .get('/panels/self-status')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ panelKey: 'CEO', enabled: true });
  });

  it('GET /panels/self-status: BOARD_CHAIR is never gated by panel-access flags', async () => {
    await typeorm.panelAccessFlag.upsert({
      where: { panelKey: 'BOARD_CHAIR' },
      update: { enabled: false },
      create: { panelKey: 'BOARD_CHAIR', enabled: false },
    });

    const { accessToken } = await loginAs(app, 'chair');
    const res = await request(app.getHttpServer())
      .get('/panels/self-status')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ panelKey: null, enabled: true });

    const reporting = await request(app.getHttpServer())
      .get('/reporting/kpis?granularity=q6')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(reporting.status).toBe(200);

    await typeorm.panelAccessFlag.update({
      where: { panelKey: 'BOARD_CHAIR' },
      data: { enabled: true },
    });
  });

  it('when SENIOR_MANAGER disables CEO panel, CEO gets 404 on reporting and self-status shows disabled', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const ceo = await loginAs(app, 'ceo');

    await request(app.getHttpServer())
      .patch('/panels/access/CEO')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({ enabled: false })
      .expect(200);

    const status = await request(app.getHttpServer())
      .get('/panels/self-status')
      .set('Authorization', `Bearer ${ceo.accessToken}`);
    expect(status.status).toBe(200);
    expect(status.body.data.enabled).toBe(false);

    const blocked = await request(app.getHttpServer())
      .get('/reporting/kpis?granularity=q6')
      .set('Authorization', `Bearer ${ceo.accessToken}`);
    expect(blocked.status).toBe(404);

    await request(app.getHttpServer())
      .patch('/panels/access/CEO')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({ enabled: true });
  });

  it('two simultaneous toggles of the same panel from two CEO sessions do not crash and leave a consistent final state', async () => {
    const ceoA = await loginAs(app, 'ceo');
    const ceoB = await loginAs(app, 'ceo');

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .patch('/panels/access/COMMERCIAL')
        .set('Authorization', `Bearer ${ceoA.accessToken}`)
        .send({ enabled: false }),
      request(app.getHttpServer())
        .patch('/panels/access/COMMERCIAL')
        .set('Authorization', `Bearer ${ceoB.accessToken}`)
        .send({ enabled: true }),
    ]);

    expect([resA.status, resB.status]).toEqual([200, 200]);

    const finalFlag = await typeorm.panelAccessFlag.findUniqueOrThrow({
      where: { panelKey: 'COMMERCIAL' },
    });
    expect([true, false]).toContain(finalFlag.enabled);

    const auditRows = await typeorm.auditLog.findMany({
      where: { category: 'ACCESS', entityId: 'COMMERCIAL' },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });
    expect(auditRows).toHaveLength(2);

    // Cleanup.
    await request(app.getHttpServer())
      .patch('/panels/access/COMMERCIAL')
      .set('Authorization', `Bearer ${ceoA.accessToken}`)
      .send({ enabled: true });
  });
});

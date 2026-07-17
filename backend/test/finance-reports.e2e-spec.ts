import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { encryptPii, hashPii } from '../src/common/pii-crypto';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

describe('Finance tab + reports (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('finance summary KPIs reconcile with raw ledger sums; the donut percentages come from SALE channels', async () => {
    const { accessToken } = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .get('/finance/summary?granularity=q6')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);

    const { kpis, donut, seats } = res.body.data as {
      kpis: {
        revenueIrr: number;
        profitIrr: number;
        operatingCostIrr: number;
        marginPct: number;
      };
      donut: { SYSTEM: number; CHARTER: number; AGENCY: number };
      seats: { flightCount: number; totalSeats: number };
    };

    // KPI cost figure = OPERATING_COST ledger rows (⚑ no fabricated margins).
    expect(kpis.operatingCostIrr).toBeGreaterThan(0);
    expect(kpis.revenueIrr).toBeGreaterThan(0);
    expect(donut.SYSTEM + donut.CHARTER + donut.AGENCY).toBeLessThanOrEqual(
      kpis.revenueIrr,
    );
    expect(seats.totalSeats).toBeGreaterThanOrEqual(seats.flightCount);
  });

  it('KPI re-scoping: a single periodKey returns a subset of the full-range revenue and its own cost figure', async () => {
    const { accessToken } = await loginAs(app, 'senior.rahimi');
    const chart = await request(app.getHttpServer())
      .get('/reporting/sales-chart?granularity=q6')
      .set('Authorization', `Bearer ${accessToken}`);
    const periodKey = chart.body.data[chart.body.data.length - 1].periodKey as string;

    const full = await request(app.getHttpServer())
      .get('/finance/summary?granularity=q6')
      .set('Authorization', `Bearer ${accessToken}`);
    const scoped = await request(app.getHttpServer())
      .get(`/finance/summary?granularity=q6&periodKey=${periodKey}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(scoped.status).toBe(200);
    expect(scoped.body.data.kpis.revenueIrr).toBeLessThanOrEqual(
      full.body.data.kpis.revenueIrr,
    );
    expect(scoped.body.data.donut.SYSTEM).toBeLessThanOrEqual(
      full.body.data.donut.SYSTEM,
    );
  });

  it('transactions & settlements are finance-manager-only (403 for executives, per the design role rule)', async () => {
    const ceo = await loginAs(app, 'ceo');
    for (const path of ['/finance/transactions', '/finance/settlements']) {
      const res = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${ceo.accessToken}`);
      expect(res.status).toBe(403);
    }

    const finance = await loginAs(app, 'finance.karimi');
    const tx = await request(app.getHttpServer())
      .get('/finance/transactions')
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(tx.status).toBe(200);
    const rows = tx.body.data as { labelFa: string; direction: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => ['IN', 'OUT'].includes(r.direction))).toBe(true);
  });

  it('settlements map real invoice state (SETTLED/PENDING/OVERDUE) and the outstanding total reconciles', async () => {
    const finance = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .get('/finance/settlements')
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(res.status).toBe(200);
    const { rows, outstandingIrr } = res.body.data as {
      rows: { status: string; amountIrr: number; overdueDays: number; paidPct: number }[];
      outstandingIrr: number;
    };
    expect(
      rows.every((r) => ['SETTLED', 'PENDING', 'OVERDUE'].includes(r.status)),
    ).toBe(true);
    expect(rows.every((r) => (r.status === 'SETTLED') === (r.paidPct === 100))).toBe(true);
    expect(rows.every((r) => (r.status === 'OVERDUE') === (r.overdueDays > 0))).toBe(true);
    expect(outstandingIrr).toBe(
      rows.filter((r) => r.status !== 'SETTLED').reduce((a, r) => a + r.amountIrr, 0),
    );
  });

  it('remind: audited for a real invoice, 404 for an unknown one', async () => {
    const finance = await loginAs(app, 'finance.karimi');
    const invoice = await prisma.agencyInvoice.findFirstOrThrow();

    const ok = await request(app.getHttpServer())
      .post(`/finance/settlements/${invoice.id}/remind`)
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(ok.status).toBe(201);
    expect(ok.body.data.reminded).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: {
        category: 'FINANCE',
        entityType: 'AgencyInvoice',
        entityId: invoice.id,
      },
    });
    expect(audit).not.toBeNull();

    const missing = await request(app.getHttpServer())
      .post(`/finance/settlements/${crypto.randomUUID()}/remind`)
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(missing.status).toBe(404);
  });

  it('passenger report finds by name AND by exact national ID via the hash — without decrypting to search', async () => {
    const booking = await prisma.booking.findFirstOrThrow({
      where: { status: 'TICKETED' },
    });
    const name = `مسافر گزارش ${crypto.randomUUID().slice(0, 4)}`;
    await prisma.passenger.create({
      data: {
        bookingId: booking.id,
        fullName: name,
        nationalIdEnc: encryptPii('0499370899'),
        nationalIdHash: hashPii('0499370899'),
        seatCode: '12C',
      },
    });

    const { accessToken } = await loginAs(app, 'comm.abbasi');
    const byName = await request(app.getHttpServer())
      .get(`/reports/passengers?q=${encodeURIComponent(name)}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(byName.status).toBe(200);
    expect(byName.body.data.results[0].fullName).toBe(name);
    expect(byName.body.data.results[0].pnr).toBe(booking.pnr);

    const byNid = await request(app.getHttpServer())
      .get('/reports/passengers?q=0499370899')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(byNid.status).toBe(200);
    expect(
      (byNid.body.data.results as { fullName: string }[]).some(
        (r) => r.fullName === name,
      ),
    ).toBe(true);

    const none = await request(app.getHttpServer())
      .get('/reports/passengers?q=ناموجود-xyz')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(none.status).toBe(200);
    expect(none.body.data.results).toHaveLength(0);
  });

  it('report role isolation: CEO gets 403 on passengers; senior gets 403 on staff; IT gets 403 on مالی', async () => {
    const ceo = await loginAs(app, 'ceo');
    const p = await request(app.getHttpServer())
      .get('/reports/passengers?q=x')
      .set('Authorization', `Bearer ${ceo.accessToken}`);
    expect(p.status).toBe(403);

    const senior = await loginAs(app, 'senior.rahimi');
    const s = await request(app.getHttpServer())
      .get('/reports/staff')
      .set('Authorization', `Bearer ${senior.accessToken}`);
    expect(s.status).toBe(403);

    const it_ = await loginAs(app, 'itadmin');
    const f = await request(app.getHttpServer())
      .get('/finance/summary?granularity=q6')
      .set('Authorization', `Bearer ${it_.accessToken}`);
    expect(f.status).toBe(403);
  });

  it('staff report groups audit rows by EMPLOYEE actors and surfaces IT ACCOUNT notices', async () => {
    const employee = await prisma.user.findFirstOrThrow({
      where: { role: 'EMPLOYEE' },
    });
    await prisma.auditLog.create({
      data: {
        actorId: employee.id,
        actorRole: 'EMPLOYEE',
        category: 'AGENCY',
        action: 'بررسی پرونده آژانس',
        detail: 'پرونده آژانس نمونه توسط کارمند بررسی شد.',
      },
    });
    const itManager = await prisma.user.findFirstOrThrow({
      where: { role: 'IT_MANAGER' },
    });
    await prisma.auditLog.create({
      data: {
        actorId: itManager.id,
        actorRole: 'IT_MANAGER',
        category: 'ACCOUNT',
        action: 'افزودن کارمند',
        detail: 'کارمند جدید «کارمند تستی» توسط مدیر IT اضافه شد.',
      },
    });

    const finance = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .get('/reports/staff')
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(res.status).toBe(200);

    const { employees, reports, notices } = res.body.data as {
      employees: { id: string }[];
      reports: { employeeId: string; action: string }[];
      notices: { text: string }[];
    };
    expect(employees.some((e) => e.id === employee.id)).toBe(true);
    expect(
      reports.some(
        (r) => r.employeeId === employee.id && r.action === 'بررسی پرونده آژانس',
      ),
    ).toBe(true);
    expect(notices.some((n) => n.text.includes('کارمند تستی'))).toBe(true);
  });
});

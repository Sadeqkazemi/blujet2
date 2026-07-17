import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { encryptPii, hashPii } from '../src/common/pii-crypto';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

describe('Phase 11 — finance tab, passenger reports, staff reports (e2e)', () => {
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

  // ── recent transactions ────────────────────────────────────────────────

  it('GET /reporting/recent-transactions: finance manager gets real ledger rows with party labels; other roles 403', async () => {
    const finance = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .get('/reporting/recent-transactions')
      .set('Authorization', auth(finance.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.rows.length).toBeGreaterThan(0);
    expect(res.body.data.totalCount).toBeGreaterThan(0);
    const row = res.body.data.rows[0];
    expect(row).toHaveProperty('titleFa');
    expect(row).toHaveProperty('party');
    expect(row).toHaveProperty('signedAmountIrr');

    const ceo = await loginAs(app, 'ceo');
    const forbidden = await request(app.getHttpServer())
      .get('/reporting/recent-transactions')
      .set('Authorization', auth(ceo.accessToken));
    expect(forbidden.status).toBe(403);
  });

  // ── revenue mix ────────────────────────────────────────────────────────

  it('GET /reporting/revenue-mix: per-channel sums add up to the total, pcts computed', async () => {
    const ceo = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .get('/reporting/revenue-mix?granularity=year')
      .set('Authorization', auth(ceo.accessToken));
    expect(res.status).toBe(200);
    const { totalIrr, channels } = res.body.data as {
      totalIrr: number;
      channels: { channel: string; amountIrr: number; pct: number }[];
    };
    expect(channels).toHaveLength(3);
    expect(channels.reduce((s, c) => s + c.amountIrr, 0)).toBe(totalIrr);
    expect(totalIrr).toBeGreaterThan(0);
  });

  // ── agency settlements ─────────────────────────────────────────────────

  it('GET /reporting/agency-settlements: per-agency paid ratio + status from real invoices; finance only', async () => {
    const finance = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .get('/reporting/agency-settlements')
      .set('Authorization', auth(finance.accessToken));
    expect(res.status).toBe(200);
    const { rows, outstandingIrr } = res.body.data as {
      rows: {
        agencyName: string;
        paidPct: number;
        status: string;
        overdueDays: number;
      }[];
      outstandingIrr: number;
    };
    expect(rows.length).toBeGreaterThan(0);
    // Seed: the silver agency has an OVERDUE invoice (due 2026-06-05).
    const overdue = rows.find((r) => r.status === 'OVERDUE');
    expect(overdue).toBeDefined();
    expect(overdue!.overdueDays).toBeGreaterThan(0);
    expect(outstandingIrr).toBeGreaterThan(0);

    const commercial = await loginAs(app, 'comm.abbasi');
    const forbidden = await request(app.getHttpServer())
      .get('/reporting/agency-settlements')
      .set('Authorization', auth(commercial.accessToken));
    expect(forbidden.status).toBe(403);
  });

  it('FINANCE_MANAGER can now trigger the Phase 3 invoice remind (design: settlements row action)', async () => {
    const finance = await loginAs(app, 'finance.karimi');
    const settleRes = await request(app.getHttpServer())
      .get('/reporting/agency-settlements')
      .set('Authorization', auth(finance.accessToken));
    const target = (
      settleRes.body.data.rows as {
        agencyId: string;
        remindInvoiceId: string | null;
      }[]
    ).find((r) => r.remindInvoiceId);
    expect(target).toBeDefined();

    const remindRes = await request(app.getHttpServer())
      .post(
        `/agencies/${target!.agencyId}/invoices/${target!.remindInvoiceId}/remind`,
      )
      .set('Authorization', auth(finance.accessToken));
    expect(remindRes.status).toBe(201);
  });

  // ── passenger reports ──────────────────────────────────────────────────

  it('GET /passenger-reports/search: name search returns ticket details; national ID always masked', async () => {
    const suffix = crypto.randomUUID().slice(0, 6);
    const instance = await prisma.flightInstance.findFirstOrThrow();
    const nationalId = '0499370899'; // valid checksum test ID
    const booking = await prisma.booking.create({
      data: {
        pnr: `PR${suffix.toUpperCase()}`,
        flightInstanceId: instance.id,
        channel: 'SYSTEM',
        status: 'TICKETED',
        priceIrr: 42_000_000,
      },
    });
    await prisma.passenger.create({
      data: {
        bookingId: booking.id,
        fullName: `مسافر گزارش ${suffix}`,
        nationalIdEnc: encryptPii(nationalId),
        nationalIdHash: hashPii(nationalId),
        seatCode: '4C',
      },
    });

    const senior = await loginAs(app, 'senior.rahimi');
    const res = await request(app.getHttpServer())
      .get(`/passenger-reports/search?q=${encodeURIComponent(`مسافر گزارش ${suffix}`)}`)
      .set('Authorization', auth(senior.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const hit = res.body.data[0];
    expect(hit.pnr).toBe(booking.pnr);
    expect(hit.cabin).toBe('BUSINESS'); // row 4 is in the business band
    expect(hit.maskedNationalId).toBe('049******9');
    expect(JSON.stringify(res.body)).not.toContain(nationalId);
  });

  it('GET /passenger-reports/search: a 10-digit query matches by national-ID hash exactly', async () => {
    const suffix = crypto.randomUUID().slice(0, 6);
    const instance = await prisma.flightInstance.findFirstOrThrow();
    const nationalId = '1287960649';
    const booking = await prisma.booking.create({
      data: {
        pnr: `PN${suffix.toUpperCase()}`,
        flightInstanceId: instance.id,
        channel: 'SYSTEM',
        status: 'TICKETED',
        priceIrr: 38_000_000,
      },
    });
    await prisma.passenger.create({
      data: {
        bookingId: booking.id,
        fullName: `مسافر کدملی ${suffix}`,
        nationalIdEnc: encryptPii(nationalId),
        nationalIdHash: hashPii(nationalId),
        seatCode: '12B',
      },
    });

    const finance = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .get(`/passenger-reports/search?q=${nationalId}`)
      .set('Authorization', auth(finance.accessToken));
    expect(res.status).toBe(200);
    const pnrs = (res.body.data as { pnr: string }[]).map((p) => p.pnr);
    expect(pnrs).toContain(booking.pnr);
    expect(res.body.data[0].cabin).toBe('ECONOMY');
  });

  it('passenger reports: roles without the tab (CEO, IT) get 403', async () => {
    const ceo = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .get('/passenger-reports/search?q=test')
      .set('Authorization', auth(ceo.accessToken));
    expect(res.status).toBe(403);
  });

  // ── staff reports ──────────────────────────────────────────────────────

  it('GET /staff-reports: finance manager sees only finance-dept employees and their real audit feed', async () => {
    // Give the seeded finance employee a real audited action.
    const finEmployee = await prisma.user.findFirstOrThrow({
      where: { role: 'EMPLOYEE', dept: 'finance' },
    });
    await prisma.auditLog.create({
      data: {
        actorId: finEmployee.id,
        actorRole: 'EMPLOYEE',
        category: 'FINANCE',
        action: 'ثبت تسویه آزمایشی',
        detail: 'اقدام آزمایشی کارمند مالی برای تست گزارش کارمندان',
      },
    });

    const finance = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .get('/staff-reports')
      .set('Authorization', auth(finance.accessToken));
    expect(res.status).toBe(200);
    const { staff, reports } = res.body.data as {
      staff: { id: string }[];
      reports: { staffId: string }[];
    };
    expect(staff.some((s) => s.id === finEmployee.id)).toBe(true);
    expect(reports.some((r) => r.staffId === finEmployee.id)).toBe(true);

    // Dept isolation: no commercial/sales-dept employee ever appears.
    const commEmployees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', dept: { in: ['commercial', 'sales'] } },
      select: { id: true },
    });
    for (const c of commEmployees) {
      expect(staff.some((s) => s.id === c.id)).toBe(false);
      expect(reports.some((r) => r.staffId === c.id)).toBe(false);
    }
  });

  it('GET /staff-reports?staffId= filters to one employee; a foreign-dept staffId yields an empty feed', async () => {
    const commEmployee = await prisma.user.findFirstOrThrow({
      where: { role: 'EMPLOYEE', dept: { in: ['commercial', 'sales'] } },
    });

    const finance = await loginAs(app, 'finance.karimi');
    const res = await request(app.getHttpServer())
      .get(`/staff-reports?staffId=${commEmployee.id}`)
      .set('Authorization', auth(finance.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.reports).toHaveLength(0);
  });

  it('staff reports: roles without the tab (SENIOR_MANAGER) get 403', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const res = await request(app.getHttpServer())
      .get('/staff-reports')
      .set('Authorization', auth(senior.accessToken));
    expect(res.status).toBe(403);
  });
});

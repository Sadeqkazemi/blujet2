/**
 * Pre-launch verification — end-to-end golden path covering:
 * commercial flight create → CEO price register → customer OTP purchase
 * with seat occupancy on reservation map → refund to finance → agency
 * approve/reject + API + allotment → IT employee create.
 *
 * Acceptance checklist: docs/features/prelaunch-verify.md
 */
import { INestApplication } from '@nestjs/common';
import * as crypto from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { User } from '../src/database/entities/user.entity';
import { LedgerEntry } from '../src/database/entities/ledger-entry.entity';
import { TWO_FACTOR_PROVIDER } from '../src/modules/auth/providers/two-factor-provider.interface';
import { MockTwoFactorProvider } from '../src/modules/auth/providers/mock-two-factor.provider';
import { createTestApp } from './helpers/app.helper';
import { loginAs, loginAsCustomer, stepUpFor } from './helpers/login.helper';

describe('Prelaunch verification (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let twoFactor: MockTwoFactorProvider;
  let commercialToken: string;
  let ceoToken: string;
  let siteAdminToken: string;
  let financeToken: string;
  let seniorToken: string;
  let itToken: string;

  jest.setTimeout(120_000);

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    twoFactor = app.get<MockTwoFactorProvider>(TWO_FACTOR_PROVIDER);

    const commercial = await loginAs(app, 'comm');
    const ceo = await loginAs(app, 'ceo');
    const siteAdmin = await loginAs(app, 'site.admin');
    const finance = await loginAs(app, 'finance');
    const senior = await loginAs(app, 'senior');
    const it = await loginAs(app, 'itadmin');
    const tokens = {
      commercial: commercial.accessToken,
      ceo: ceo.accessToken,
      siteAdmin: siteAdmin.accessToken,
      finance: finance.accessToken,
      senior: senior.accessToken,
      it: it.accessToken,
    };
    for (const [name, token] of Object.entries(tokens)) {
      if (!token) throw new Error(`prelaunch: failed to login ${name}`);
    }
    commercialToken = tokens.commercial!;
    ceoToken = tokens.ceo!;
    siteAdminToken = tokens.siteAdmin!;
    financeToken = tokens.finance!;
    seniorToken = tokens.senior!;
    itToken = tokens.it!;
  });

  afterAll(async () => {
    await app.close();
  });

  function auth(token: string | null | undefined) {
    return `Bearer ${token}`;
  }

  function daysAheadIso(days: number, hourUtc = 8): string {
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    d.setUTCHours(hourUtc, 0, 0, 0);
    return d.toISOString();
  }

  function dateOnly(iso: string): string {
    return iso.slice(0, 10);
  }

  /** Unique flight no matching CreateFlightDto /^[A-Z0-9]{2}-\d{2,4}$/ */
  function uniqueFlightNo(): string {
    return `Z${crypto.randomInt(0, 10)}-${crypto.randomInt(1000, 9999)}`;
  }

  async function createAndPriceFlight(opts: {
    origin: string;
    dest: string;
    priceIrr: number;
    agencySeats: number;
    daysAhead: number;
  }) {
    let create: request.Response | null = null;
    let flightNo = uniqueFlightNo();
    for (let attempt = 0; attempt < 8; attempt++) {
      flightNo = uniqueFlightNo();
      create = await request(app.getHttpServer())
        .post('/flights')
        .set('Authorization', auth(commercialToken))
        .send({
          originCode: opts.origin,
          destCode: opts.dest,
          flightNo,
          departureAt: daysAheadIso(opts.daysAhead),
          capacity: 146,
          basePriceIrr: String(opts.priceIrr),
          aircraftType: 'MD-80',
          charterSeats: 10,
        });
      if (create.status === 201) break;
      if (create.status !== 409) {
        throw new Error(
          `create failed ${create.status} ${JSON.stringify(create.body)}`,
        );
      }
    }
    expect(create!.status).toBe(201);
    const instanceId = create!.body.data.id as string;

    const plan = await request(app.getHttpServer())
      .patch(`/flights/${instanceId}/plan`)
      .set('Authorization', auth(commercialToken))
      .send({
        priceIrr: String(opts.priceIrr),
        agencySeats: opts.agencySeats,
      });
    expect(plan.status).toBe(200);

    const proposalList = await request(app.getHttpServer())
      .get('/pricing/proposals')
      .set('Authorization', auth(commercialToken));
    expect(proposalList.status).toBe(200);
    const flightRow = (
      proposalList.body.data.flights as {
        id: string;
        pricing: { id: string; status: string } | null;
      }[]
    ).find((f) => f.id === instanceId);
    expect(flightRow?.pricing?.id).toBeTruthy();
    expect(flightRow!.pricing!.status).toBe('PENDING');
    const proposalId = flightRow!.pricing!.id;

    const stepUp = await stepUpFor(
      app,
      ceoToken,
      'ceo',
      'PRICE_CAPACITY_CHANGE',
    );
    const registered = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${proposalId}/register`)
      .set('Authorization', auth(ceoToken))
      .send({ source: 'PROPOSED', ...stepUp });
    expect(registered.status).toBe(200);
    expect(registered.body.data.status).toBe('REGISTERED');
    expect(registered.body.data.registeredPriceIrr).toBe(String(opts.priceIrr));

    return {
      instanceId,
      flightNo,
      origin: opts.origin,
      dest: opts.dest,
      departureAt: create!.body.data.departureAt as string,
      priceIrr: opts.priceIrr,
    };
  }

  async function submitAgencyRequest(phone: string, name: string) {
    const otpRes = await request(app.getHttpServer())
      .post('/agencies/requests/otp')
      .send({ phone });
    expect(otpRes.status).toBe(200);
    const challengeId = otpRes.body.data.challengeId as string;
    const code = twoFactor.getLastCode(challengeId)!;
    const createRes = await request(app.getHttpServer())
      .post('/agencies/requests')
      .send({
        applicantName: name,
        managerName: `مدیر ${name}`,
        licenseNo: `LIC-${phone.slice(-4)}`,
        phone,
        challengeId,
        code,
      });
    expect(createRes.status).toBe(201);
    return createRes.body.data.id as string;
  }

  it('runs the full commercial→CEO→customer→refund→agency→IT path', async () => {
    const suffix = Date.now().toString().slice(-6);
    const thrMhd = await createAndPriceFlight({
      origin: 'THR',
      dest: 'MHD',
      priceIrr: 42_000_000,
      agencySeats: 20,
      daysAhead: 40 + crypto.randomInt(0, 20),
    });
    const mhdThr = await createAndPriceFlight({
      origin: 'MHD',
      dest: 'THR',
      priceIrr: 41_000_000,
      agencySeats: 15,
      daysAhead: 61 + crypto.randomInt(0, 20),
    });
    const thrSyz = await createAndPriceFlight({
      origin: 'THR',
      dest: 'SYZ',
      priceIrr: 35_000_000,
      agencySeats: 10,
      daysAhead: 82 + crypto.randomInt(0, 20),
    });

    // ── Search: CEO-registered flights appear ───────────────────────────
    for (const f of [thrMhd, mhdThr, thrSyz]) {
      const search = await request(app.getHttpServer())
        .get('/search/flights')
        .query({
          origin: f.origin,
          dest: f.dest,
          date: dateOnly(f.departureAt),
        });
      expect(search.status).toBe(200);
      const row = (
        search.body.data as {
          flightInstanceId: string;
          cabins: { cabin: string; priceIrr: string }[];
        }[]
      ).find((r) => r.flightInstanceId === f.instanceId);
      expect(row).toBeDefined();
      expect(row!.cabins.find((c) => c.cabin === 'ECONOMY')?.priceIrr).toBe(
        String(f.priceIrr),
      );
    }

    // ── Customer register (mock OTP) + incomplete-profile signal ────────
    const phoneA = `0912${suffix}1`;
    const phoneB = `0913${suffix}2`;
    const customerA = await loginAsCustomer(app, phoneA);
    expect(customerA.accessToken).toBeTruthy();

    const profile = await request(app.getHttpServer())
      .get('/my/profile')
      .set('Authorization', auth(customerA.accessToken));
    expect(profile.status).toBe(200);
    expect(profile.body.data.completionPct).toBeLessThan(100);

    const incomplete = await request(app.getHttpServer())
      .get('/customers/incomplete-count')
      .set('Authorization', auth(siteAdminToken));
    expect(incomplete.status).toBe(200);
    expect(incomplete.body.data.count).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .patch('/my/profile')
      .set('Authorization', auth(customerA.accessToken))
      .send({ fullName: 'علی پیش‌لانچ' })
      .expect(200);

    // ── Purchase with explicit seat — must show SOLD on reservation map ─
    const seatmapPublic = await request(app.getHttpServer()).get(
      `/search/flights/${thrMhd.instanceId}/seatmap`,
    );
    expect(seatmapPublic.status).toBe(200);
    const freeEconomy = (
      seatmapPublic.body.data.seats as {
        seatCode: string;
        cabin: string;
        status: string;
      }[]
    ).find((s) => s.cabin === 'ECONOMY' && s.status === 'FREE');
    expect(freeEconomy).toBeDefined();

    const hold = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', auth(customerA.accessToken))
      .send({
        flightInstanceId: thrMhd.instanceId,
        cabin: 'ECONOMY',
        passengers: [
          {
            fullName: 'علی پیش‌لانچ',
            nationalId: '0012345679',
            seatCode: freeEconomy!.seatCode,
          },
        ],
      });
    expect(hold.status).toBe(201);
    expect(hold.body.data.status).toBe('HELD');
    expect(hold.body.data.passengers[0].seatCode).toBe(freeEconomy!.seatCode);
    const bookingIdA = hold.body.data.id as string;
    const pnrA = hold.body.data.pnr as string;
    const seatA = freeEconomy!.seatCode;

    const resMapHeld = await request(app.getHttpServer())
      .get(`/reservation/seatmap/${thrMhd.instanceId}`)
      .set('Authorization', auth(ceoToken));
    expect(resMapHeld.status).toBe(200);
    const heldSeat = (
      resMapHeld.body.data.rows as {
        seats: {
          seatCode: string;
          status: string;
          passenger?: { pnr: string; bookingStatus: string };
        }[];
      }[]
    )
      .flatMap((r) => r.seats)
      .find((s) => s.seatCode === seatA);
    expect(heldSeat?.status).toBe('SOLD');
    expect(heldSeat?.passenger?.pnr).toBe(pnrA);
    expect(heldSeat?.passenger?.bookingStatus).toBe('HELD');

    const payA = await request(app.getHttpServer())
      .post(`/bookings/${bookingIdA}/pay`)
      .set('Authorization', auth(customerA.accessToken))
      .send({});
    expect(payA.status).toBe(201);
    expect(payA.body.data.booking.status).toBe('TICKETED');

    const mine = await request(app.getHttpServer())
      .get('/bookings/me')
      .set('Authorization', auth(customerA.accessToken));
    expect(mine.status).toBe(200);
    expect(
      (mine.body.data as { id: string }[]).some((b) => b.id === bookingIdA),
    ).toBe(true);

    // ── Second customer: system auto-assigns seat ───────────────────────
    const customerB = await loginAsCustomer(app, phoneB);
    await request(app.getHttpServer())
      .patch('/my/profile')
      .set('Authorization', auth(customerB.accessToken))
      .send({ fullName: 'سارا پیش‌لانچ' });

    const holdB = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', auth(customerB.accessToken))
      .send({
        flightInstanceId: thrMhd.instanceId,
        cabin: 'ECONOMY',
        passengers: [{ fullName: 'سارا پیش‌لانچ', nationalId: '0012345679' }],
      });
    expect(holdB.status).toBe(201);
    const seatB = holdB.body.data.passengers[0].seatCode as string;
    expect(seatB).toBeTruthy();
    expect(seatB).not.toBe(seatA);

    const payB = await request(app.getHttpServer())
      .post(`/bookings/${holdB.body.data.id}/pay`)
      .set('Authorization', auth(customerB.accessToken))
      .send({});
    expect(payB.status).toBe(201);

    const resMapTicketed = await request(app.getHttpServer())
      .get(`/reservation/seatmap/${thrMhd.instanceId}`)
      .set('Authorization', auth(ceoToken));
    const soldCodes = (
      resMapTicketed.body.data.rows as {
        seats: { seatCode: string; status: string }[];
      }[]
    )
      .flatMap((r) => r.seats)
      .filter((s) => s.status === 'SOLD')
      .map((s) => s.seatCode);
    expect(soldCodes).toEqual(expect.arrayContaining([seatA, seatB]));

    // ── Panels: finance / passenger / customers see the sale ────────────
    const financeUser = await dataSource
      .getRepository(User)
      .findOneByOrFail({ username: 'finance' });

    const recent = await request(app.getHttpServer())
      .get('/reporting/recent-transactions')
      .set('Authorization', auth(financeToken));
    expect(recent.status).toBe(200);
    const recentRows = recent.body.data.rows as {
      party: string;
      type: string;
    }[];
    const saleVisible =
      recentRows.some((t) => t.type === 'SALE' && t.party.includes(pnrA)) ||
      recentRows.some(
        (t) => t.type === 'SALE' && t.party.includes('علی پیش‌لانچ'),
      );
    // Seed may push this SALE past the 20-row window — fall back to ledger.
    if (!saleVisible) {
      const sale = await dataSource.getRepository(LedgerEntry).findOne({
        where: { bookingId: bookingIdA, type: 'SALE' },
      });
      expect(sale).toBeTruthy();
    } else {
      expect(saleVisible).toBe(true);
    }

    const passengers = await request(app.getHttpServer())
      .get('/passenger-reports/search')
      .query({ q: 'علی پیش‌لانچ' })
      .set('Authorization', auth(financeToken));
    expect(passengers.status).toBe(200);
    expect(
      (passengers.body.data as { pnr: string }[]).some((r) => r.pnr === pnrA),
    ).toBe(true);

    const customerDetail = await request(app.getHttpServer())
      .get(`/customers/${customerA.userId}`)
      .set('Authorization', auth(siteAdminToken));
    expect(customerDetail.status).toBe(200);
    expect(
      (customerDetail.body.data.purchases as { pnr: string }[]).some(
        (p) => p.pnr === pnrA,
      ),
    ).toBe(true);

    // ── Refund: customer → site admin refer → finance pay → seat frees ──
    const refundSubmit = await request(app.getHttpServer())
      .post('/my/refunds')
      .set('Authorization', auth(customerA.accessToken))
      .send({
        bookingId: bookingIdA,
        iban: 'IR820170000000332211009900',
      });
    expect(refundSubmit.status).toBe(201);
    expect(refundSubmit.body.data.status).toBe('SUBMITTED');
    const refundId = refundSubmit.body.data.id as string;

    const refer = await request(app.getHttpServer())
      .patch(`/refunds/${refundId}/refer`)
      .set('Authorization', auth(siteAdminToken))
      .send({ assigneeId: financeUser.id });
    expect(refer.status).toBe(200);
    expect(refer.body.data.status).toBe('FINANCE');

    const stepUpPay = await stepUpFor(
      app,
      financeToken,
      'finance',
      'REFUND_PAYOUT',
    );
    const payRefund = await request(app.getHttpServer())
      .patch(`/refunds/${refundId}/pay`)
      .set('Authorization', auth(financeToken))
      .send(stepUpPay);
    expect(payRefund.status).toBe(200);
    expect(payRefund.body.data.status).toBe('PAID');

    const resMapAfterRefund = await request(app.getHttpServer())
      .get(`/reservation/seatmap/${thrMhd.instanceId}`)
      .set('Authorization', auth(ceoToken));
    const seatAfter = (
      resMapAfterRefund.body.data.rows as {
        seats: { seatCode: string; status: string }[];
      }[]
    )
      .flatMap((r) => r.seats)
      .find((s) => s.seatCode === seatA);
    expect(seatAfter?.status).toBe('FREE');

    // ── Agency: two requests — refer → approve one, reject one ──────────
    const phoneOk = `0914${suffix}3`;
    const phoneNo = `0915${suffix}4`;
    const reqOk = await submitAgencyRequest(phoneOk, `آژانس تأیید ${suffix}`);
    const reqNo = await submitAgencyRequest(phoneNo, `آژانس رد ${suffix}`);

    const commercialUser = await dataSource
      .getRepository(User)
      .findOneByOrFail({ username: 'comm' });

    for (const id of [reqOk, reqNo]) {
      const ref = await request(app.getHttpServer())
        .patch(`/agencies/requests/${id}/refer`)
        .set('Authorization', auth(siteAdminToken))
        .send({ referredToId: commercialUser.id });
      expect(ref.status).toBe(200);
      expect(ref.body.data.status).toBe('REFERRED');
    }

    const approve = await request(app.getHttpServer())
      .patch(`/agencies/requests/${reqOk}/approve`)
      .set('Authorization', auth(commercialToken));
    expect(approve.status).toBe(200);
    const agencyId = approve.body.data.agencyId as string;
    const tempPassword = approve.body.data.tempPassword as string;
    expect(tempPassword).toBeTruthy();

    const reject = await request(app.getHttpServer())
      .patch(`/agencies/requests/${reqNo}/reject`)
      .set('Authorization', auth(commercialToken))
      .send({ reviewNote: 'مدارک ناقص — تست پیش‌لانچ' });
    expect(reject.status).toBe(200);
    expect(reject.body.data.status).toBe('REJECTED');

    const agencyLogin = await request(app.getHttpServer())
      .post('/auth/agency/login')
      .send({ phone: phoneOk, password: tempPassword });
    expect(agencyLogin.status).toBe(200);
    const agencyToken = agencyLogin.body.data.accessToken as string;

    // Approved agencies are issued mustChangePassword=true — clear it via
    // the same change-password path the portal forces on first login.
    const changePw = await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', auth(agencyToken))
      .send({
        currentPassword: tempPassword,
        newPassword: 'BlujetAgency@1404',
      });
    expect(changePw.status).toBe(200);

    const dash = await request(app.getHttpServer())
      .get('/agency-portal/dashboard')
      .set('Authorization', auth(agencyToken));
    expect(dash.status).toBe(200);

    const wsReq = await request(app.getHttpServer())
      .post('/agency-portal/webservice-requests')
      .set('Authorization', auth(agencyToken))
      .send({ scope: 'SEARCH_BOOK', months: 1 });
    expect(wsReq.status).toBe(201);

    const stepUpApi = await stepUpFor(
      app,
      seniorToken,
      'senior',
      'API_KEY_ROTATE',
    );
    const decide = await request(app.getHttpServer())
      .patch(
        `/agencies/${agencyId}/webservice-requests/${wsReq.body.data.id}/decide`,
      )
      .set('Authorization', auth(seniorToken))
      .send({ approve: true, ...stepUpApi });
    expect(decide.status).toBe(200);
    expect(decide.body.data.status).toBe('APPROVED');

    const allot = await request(app.getHttpServer())
      .post(`/flights/${thrMhd.instanceId}/allotments`)
      .set('Authorization', auth(commercialToken))
      .send({ agencyId, seatsAllocated: 5 });
    expect(allot.status).toBe(201);

    const agencyAllotments = await request(app.getHttpServer())
      .get('/agency-portal/allotments')
      .set('Authorization', auth(agencyToken));
    expect(agencyAllotments.status).toBe(200);
    expect(
      (agencyAllotments.body.data as { flightNo: string }[]).some(
        (a) => a.flightNo === thrMhd.flightNo,
      ),
    ).toBe(true);

    // ── IT manager creates a named employee panel account ───────────────
    const empUsername = `emp.prelaunch.${suffix}`;
    const emp = await request(app.getHttpServer())
      .post('/it/employees')
      .set('Authorization', auth(itToken))
      .send({
        fullName: 'کارمند تست پیش‌لانچ',
        username: empUsername,
        password: 'Blujet@1404',
        dept: 'commercial',
        rank: 'کارشناس',
        permissionKeys: ['ag_list', 'fl_view'],
      });
    expect(emp.status).toBe(201);
    expect(emp.body.data.fullName).toBe('کارمند تست پیش‌لانچ');

    // Avoid another staff-login throttle hit — assert the account exists.
    const empUser = await dataSource
      .getRepository(User)
      .findOneByOrFail({ username: empUsername });
    expect(empUser.role).toBe('EMPLOYEE');
    expect(empUser.fullName).toBe('کارمند تست پیش‌لانچ');
  });
});

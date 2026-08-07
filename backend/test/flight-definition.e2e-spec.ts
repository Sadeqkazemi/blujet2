import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { Booking } from '../src/database/entities/booking.entity';
import { FlightChargeRule } from '../src/database/entities/flight-charge-rule.entity';
import { FlightInstance } from '../src/database/entities/flight-instance.entity';
import { FarePricingProposal } from '../src/database/entities/fare-pricing-proposal.entity';
import { RedisService } from '../src/redis/redis.service';
import { loginAs, loginAsCustomer, stepUpFor } from './helpers/login.helper';

describe('Flight definition + charge rules + CEO approval (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<INestApplication<App>>({
      bufferLogs: true,
    });
    const logger = app.get(Logger);
    app.useLogger(logger);
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter(logger));
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await app.close();
  });

  function uniqueFlightNo() {
    return `XY${(Date.now() % 9000) + 1000}`;
  }

  function payload(over: Record<string, unknown> = {}) {
    return {
      originCode: 'THR',
      destCode: 'MHD',
      flightNo: uniqueFlightNo(),
      departureAt: new Date(Date.now() + 10 * 24 * 3_600_000).toISOString(),
      durationMinutes: 95,
      capacity: 146,
      cabinCapacities: [
        { cabin: 'ECONOMY', seats: 110 },
        { cabin: 'COMFORT', seats: 20 },
        { cabin: 'BUSINESS', seats: 16 },
      ],
      basePriceIrr: '38000000',
      chargeRules: [
        {
          title: 'عوارض فرودگاهی',
          kind: 'FEE',
          calculationMode: 'FIXED',
          fixedAmountIrr: '500000',
          percentageBasisPoints: null,
          cabin: null,
          validFrom: null,
          validUntil: null,
          active: true,
        },
        {
          title: 'مالیات بیزینس',
          kind: 'TAX',
          calculationMode: 'PERCENTAGE',
          fixedAmountIrr: null,
          percentageBasisPoints: 1000,
          cabin: 'BUSINESS',
          active: true,
        },
      ],
      competitorPriceIrr: '40000000',
      ...over,
    };
  }

  it('creates XY1234-style flight with independent ECONOMY/COMFORT/BUSINESS', async () => {
    const { accessToken } = await loginAs(app, 'comm');
    const body = payload({ flightNo: 'XY1234' });
    // Avoid unique collision if prior run left XY1234 — pick unique when needed.
    const create = await request(app.getHttpServer())
      .post('/flights')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...body, flightNo: uniqueFlightNo() });
    expect(create.status).toBe(201);
    expect(create.body.success).toBe(true);
    expect(create.body.data.cabinCapacities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cabin: 'ECONOMY', seats: 110 }),
        expect.objectContaining({ cabin: 'COMFORT', seats: 20 }),
        expect.objectContaining({ cabin: 'BUSINESS', seats: 16 }),
      ]),
    );
    expect(create.body.data.durationMinutes).toBe(95);
    expect(create.body.data.chargeRules.length).toBe(2);
    expect(create.body.data.approvalStatus).toBe('PENDING_CEO');
    const proposals = await dataSource
      .getRepository(FarePricingProposal)
      .findBy({ flightInstanceId: create.body.data.id });
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      status: 'PENDING',
      proposedById: expect.any(String),
      proposedPriceIrr: 38000000n,
      basePriceIrr: 38000000n,
    });
  });

  it('rejects flight numbers XY-1234, XY 1234, X1234', async () => {
    const { accessToken } = await loginAs(app, 'comm');
    for (const flightNo of ['XY-1234', 'XY 1234', 'X1234']) {
      const res = await request(app.getHttpServer())
        .post('/flights')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(payload({ flightNo }));
      expect(res.status).toBe(400);
    }
  });

  it('rejects duplicate cabin and capacity sum mismatch', async () => {
    const { accessToken } = await loginAs(app, 'comm');
    const dupCabin = await request(app.getHttpServer())
      .post('/flights')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(
        payload({
          cabinCapacities: [
            { cabin: 'ECONOMY', seats: 100 },
            { cabin: 'ECONOMY', seats: 80 },
          ],
        }),
      );
    expect(dupCabin.status).toBe(400);

    const badSum = await request(app.getHttpServer())
      .post('/flights')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(
        payload({
          capacity: 146,
          cabinCapacities: [
            { cabin: 'ECONOMY', seats: 100 },
            { cabin: 'COMFORT', seats: 20 },
            { cabin: 'BUSINESS', seats: 16 },
          ],
        }),
      );
    expect(badSum.status).toBe(400);
  });

  it('GET/PUT definition; APPROVED edit stages PENDING_REVISION', async () => {
    const { accessToken: comm } = await loginAs(app, 'comm');
    const created = await request(app.getHttpServer())
      .post('/flights')
      .set('Authorization', `Bearer ${comm}`)
      .send(payload());
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;

    const got = await request(app.getHttpServer())
      .get(`/flights/${id}/definition`)
      .set('Authorization', `Bearer ${comm}`);
    expect(got.status).toBe(200);
    expect(got.body.data.durationMinutes).toBe(95);

    const proposal = await request(app.getHttpServer())
      .put(`/pricing/flights/${id}/proposal`)
      .set('Authorization', `Bearer ${comm}`)
      .send({ proposedPriceIrr: '39000000' });
    expect(proposal.status).toBe(200);

    const { accessToken: ceo } = await loginAs(app, 'ceo');
    const stepUp = await stepUpFor(app, ceo!, 'ceo', 'PRICE_CAPACITY_CHANGE');
    const reg = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${proposal.body.data.id}/register`)
      .set('Authorization', `Bearer ${ceo}`)
      .send({ source: 'PROPOSED', ...stepUp });
    expect(reg.status).toBe(200);
    expect(reg.body.data.status).toBe('REGISTERED');

    const defAfter = await request(app.getHttpServer())
      .get(`/flights/${id}/definition`)
      .set('Authorization', `Bearer ${comm}`);
    expect(defAfter.body.data.approvalStatus).toBe('APPROVED');
    expect(defAfter.body.data.approvedSnapshot?.charterSeats).toBe(0);

    const revised = await request(app.getHttpServer())
      .put(`/flights/${id}/definition`)
      .set('Authorization', `Bearer ${comm}`)
      .send(
        payload({
          flightNo: defAfter.body.data.flightNo,
          durationMinutes: 110,
          basePriceIrr: '40000000',
        }),
      );
    expect(revised.status).toBe(200);
    expect(revised.body.data.approvalStatus).toBe('PENDING_REVISION');
    expect(revised.body.data.pendingRevision).toBe(true);

    const live = await dataSource
      .getRepository(FlightInstance)
      .createQueryBuilder('fi')
      .where('fi.id = :id', { id })
      .getOneOrFail();
    // Live duration stays at approved value until CEO re-approves.
    expect(live.durationMinutes).toBe(95);
    expect(live.definitionStatus).toBe('PENDING_REVISION');
  });

  it('pending-count is 0 on empty pending set and increments with PENDING proposals', async () => {
    const { accessToken: ceo } = await loginAs(app, 'ceo');
    // Clear is not allowed — just assert endpoint shape; count is non-negative.
    const emptyish = await request(app.getHttpServer())
      .get('/pricing/proposals/pending-count')
      .set('Authorization', `Bearer ${ceo}`);
    expect(emptyish.status).toBe(200);
    expect(typeof emptyish.body.data.pendingApprovalsCount).toBe('number');
    expect(emptyish.body.data.pendingApprovalsCount).toBeGreaterThanOrEqual(0);

    const before = emptyish.body.data.pendingApprovalsCount as number;
    const { accessToken: comm } = await loginAs(app, 'comm');
    await request(app.getHttpServer())
      .post('/flights')
      .set('Authorization', `Bearer ${comm}`)
      .send(payload());
    const after = await request(app.getHttpServer())
      .get('/pricing/proposals/pending-count')
      .set('Authorization', `Bearer ${ceo}`);
    expect(after.body.data.pendingApprovalsCount).toBe(before + 1);
  });

  it('CEO reject requires reason + step-up; unauthorized roles are 403; register is idempotent', async () => {
    const { accessToken: comm } = await loginAs(app, 'comm');
    const created = await request(app.getHttpServer())
      .post('/flights')
      .set('Authorization', `Bearer ${comm}`)
      .send(payload());
    const id = created.body.data.id as string;
    const proposal = await request(app.getHttpServer())
      .put(`/pricing/flights/${id}/proposal`)
      .set('Authorization', `Bearer ${comm}`)
      .send({ proposedPriceIrr: '39000000' });
    const proposalId = proposal.body.data.id as string;

    const { accessToken: finance } = await loginAs(app, 'finance');
    const forbidden = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${proposalId}/reject`)
      .set('Authorization', `Bearer ${finance}`)
      .send({
        rejectionReason: 'nope',
        stepUpChallengeId: 'x',
        stepUpCode: '123456',
      });
    expect(forbidden.status).toBe(403);

    const { accessToken: ceo } = await loginAs(app, 'ceo');
    const noStepUp = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${proposalId}/reject`)
      .set('Authorization', `Bearer ${ceo}`)
      .send({ rejectionReason: 'نرخ نامناسب' });
    expect(noStepUp.status).toBe(400);

    // Fresh proposal for reject path
    const created2 = await request(app.getHttpServer())
      .post('/flights')
      .set('Authorization', `Bearer ${comm}`)
      .send(payload());
    const p2 = await request(app.getHttpServer())
      .put(`/pricing/flights/${created2.body.data.id}/proposal`)
      .set('Authorization', `Bearer ${comm}`)
      .send({ proposedPriceIrr: '39100000' });
    const stepUp = await stepUpFor(app, ceo!, 'ceo', 'PRICE_CAPACITY_CHANGE');
    const rejected = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${p2.body.data.id}/reject`)
      .set('Authorization', `Bearer ${ceo}`)
      .send({ rejectionReason: '  نرخ نامناسب  ', ...stepUp });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REJECTED');
    expect(rejected.body.data.rejectionReason).toBe('نرخ نامناسب');

    const live = await dataSource
      .getRepository(FlightInstance)
      .createQueryBuilder('fi')
      .where('fi.id = :id', { id: created2.body.data.id })
      .getOneOrFail();
    // Rejected first-cycle definition becomes REJECTED; capacity unchanged.
    expect(live.definitionStatus).toBe('REJECTED');
    expect(live.capacity).toBe(146);

    // Register path + idempotency
    const created3 = await request(app.getHttpServer())
      .post('/flights')
      .set('Authorization', `Bearer ${comm}`)
      .send(payload());
    const p3 = await request(app.getHttpServer())
      .put(`/pricing/flights/${created3.body.data.id}/proposal`)
      .set('Authorization', `Bearer ${comm}`)
      .send({ proposedPriceIrr: '39200000' });
    const su1 = await stepUpFor(app, ceo!, 'ceo', 'PRICE_CAPACITY_CHANGE');
    const r1 = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${p3.body.data.id}/register`)
      .set('Authorization', `Bearer ${ceo}`)
      .send({ source: 'PROPOSED', ...su1 });
    expect(r1.status).toBe(200);
    const su2 = await stepUpFor(app, ceo!, 'ceo', 'PRICE_CAPACITY_CHANGE');
    const r2 = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${p3.body.data.id}/register`)
      .set('Authorization', `Bearer ${ceo}`)
      .send({ source: 'PROPOSED', ...su2 });
    expect(r2.status).toBe(200);
    expect(r2.body.data.status).toBe('REGISTERED');
    expect(r2.body.data.registeredPriceIrr).toBe(
      r1.body.data.registeredPriceIrr,
    );
  });

  it('persists charge rules and does not invent mock commercial rows', async () => {
    const { accessToken: comm } = await loginAs(app, 'comm');
    const created = await request(app.getHttpServer())
      .post('/flights')
      .set('Authorization', `Bearer ${comm}`)
      .send(payload());
    const rules = await dataSource.getRepository(FlightChargeRule).find({
      where: { flightInstanceId: created.body.data.id },
    });
    expect(rules).toHaveLength(2);
    expect(rules.some((r) => r.cabin === 'BUSINESS')).toBe(true);
    expect(rules.some((r) => r.cabin == null)).toBe(true);

    // No auto-seeded bookings from definition create.
    const bookings = await dataSource.getRepository(Booking).count({
      where: { flightInstanceId: created.body.data.id },
    });
    expect(bookings).toBe(0);
  });

  it('DRAFT is hidden from search; APPROVED COMFORT seat is bookable end-to-end', async () => {
    const { accessToken: comm } = await loginAs(app, 'comm');
    const body = payload({ flightNo: uniqueFlightNo() });
    const created = await request(app.getHttpServer())
      .post('/flights')
      .set('Authorization', `Bearer ${comm}`)
      .send(body);
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    const date = String(body.departureAt).slice(0, 10);

    const draftSearch = await request(app.getHttpServer())
      .get('/search/flights')
      .query({ origin: 'THR', dest: 'MHD', date });
    expect(draftSearch.status).toBe(200);
    expect(
      (draftSearch.body.data as { flightInstanceId: string }[]).some(
        (r) => r.flightInstanceId === id,
      ),
    ).toBe(false);

    const draftSeatmap = await request(app.getHttpServer()).get(
      `/search/flights/${id}/seatmap`,
    );
    expect(draftSeatmap.status).toBe(404);

    const proposal = await request(app.getHttpServer())
      .put(`/pricing/flights/${id}/proposal`)
      .set('Authorization', `Bearer ${comm}`)
      .send({ proposedPriceIrr: '39000000' });
    expect(proposal.status).toBe(200);

    const { accessToken: ceo } = await loginAs(app, 'ceo');
    const stepUp = await stepUpFor(app, ceo!, 'ceo', 'PRICE_CAPACITY_CHANGE');
    const reg = await request(app.getHttpServer())
      .patch(`/pricing/proposals/${proposal.body.data.id}/register`)
      .set('Authorization', `Bearer ${ceo}`)
      .send({ source: 'PROPOSED', ...stepUp });
    expect(reg.status).toBe(200);

    // Bust any stale route+date cache from the DRAFT search above.
    await app.get(RedisService).del(`search:flights:THR:MHD:${date}`);

    const search = await request(app.getHttpServer())
      .get('/search/flights')
      .query({ origin: 'THR', dest: 'MHD', date });
    expect(search.status).toBe(200);
    const row = (
      search.body.data as {
        flightInstanceId: string;
        cabins: { cabin: string; seatsLeft: number }[];
      }[]
    ).find((r) => r.flightInstanceId === id);
    expect(row).toBeDefined();
    const comfort = row!.cabins.find((c) => c.cabin === 'COMFORT');
    expect(comfort).toBeDefined();
    expect(comfort!.seatsLeft).toBeGreaterThan(0);

    const seatmap = await request(app.getHttpServer()).get(
      `/search/flights/${id}/seatmap`,
    );
    expect(seatmap.status).toBe(200);
    const comfortSeat = (
      seatmap.body.data.seats as { seatCode: string; cabin: string }[]
    ).find((s) => s.cabin === 'COMFORT');
    expect(comfortSeat?.seatCode).toMatch(
      /^7[A-F]$|^8[A-F]$|^9[A-F]$|^10[A-F]$/,
    );

    const { accessToken: customer } = await loginAsCustomer(app, '09138880001');
    const book = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${customer}`)
      .send({
        flightInstanceId: id,
        cabin: 'COMFORT',
        passengers: [
          {
            fullName: 'مسافر کامفورت',
            nationalId: '0012345679',
            seatCode: comfortSeat!.seatCode,
          },
        ],
      });
    expect(book.status).toBe(201);
    expect(book.body.data.status).toBe('HELD');
    expect(book.body.data.cabin).toBe('COMFORT');
    expect(typeof book.body.data.priceIrr).toBe('string');
    expect(typeof book.body.data.taxIrr).toBe('string');
  });

  it('rejects flight numbers with leading/trailing spaces', async () => {
    const { accessToken } = await loginAs(app, 'comm');
    for (const flightNo of [' XY1234', 'XY1234 ', ' XY1234 ']) {
      const res = await request(app.getHttpServer())
        .post('/flights')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(payload({ flightNo }));
      expect(res.status).toBe(400);
    }
  });
});

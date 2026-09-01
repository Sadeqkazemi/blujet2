import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { hashAgencyApiKey } from '../src/common/agency-api-key';
import { AgencyAllotment } from '../src/database/entities/agency-allotment.entity';
import { AgencyApiKey } from '../src/database/entities/agency-api-key.entity';
import { AgencyCreditLine } from '../src/database/entities/agency-credit-line.entity';
import { AgencyProfile } from '../src/database/entities/agency-profile.entity';
import { AircraftSeatMap } from '../src/database/entities/aircraft-seat-map.entity';
import { AuditLog } from '../src/database/entities/audit-log.entity';
import { Booking } from '../src/database/entities/booking.entity';
import { FlightCoupon } from '../src/database/entities/flight-coupon.entity';
import { FlightInstance } from '../src/database/entities/flight-instance.entity';
import { Flight } from '../src/database/entities/flight.entity';
import { LedgerEntry } from '../src/database/entities/ledger-entry.entity';
import { Route } from '../src/database/entities/route.entity';
import { TicketDocument } from '../src/database/entities/ticket-document.entity';
import { User } from '../src/database/entities/user.entity';
import { createTestApp } from './helpers/app.helper';

describe('Distribution gateway (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let rawKey: string;
  let agencyId: string;
  let apiKeyId: string;
  let allotmentId: string;
  let instanceId: string;
  let flightId: string;
  let routeId: string;
  let aircraftType: string;
  let bookingId: string | undefined;
  let departureDate: string;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 8);
    const userRepo = dataSource.getRepository(User);
    const agency = await userRepo.save(
      userRepo.create({
        role: 'AGENCY',
        phone: `+9891${crypto.randomInt(10_000_000, 100_000_000)}`,
        fullName: `Distribution Agency ${suffix}`,
        passwordHash: await argon2.hash('Distribution@123'),
        isActive: true,
        updatedAt: new Date(),
      }),
    );
    agencyId = agency.id;
    await dataSource.getRepository(AgencyProfile).save({
      userId: agency.id,
      licenseNo: `DIST-${suffix}`,
      managerName: 'Distribution Test',
      phone: agency.phone!,
      email: `${suffix}@distribution.test`,
      city: 'Tehran',
      address: 'Test',
      tier: 'NORMAL',
    });
    await dataSource.getRepository(AgencyCreditLine).save({
      agencyId: agency.id,
      limitIrr: 10_000_000_000n,
      updatedById: null,
      updatedAt: new Date(),
    });

    rawKey = `bjk_${crypto.randomBytes(24).toString('base64url')}`;
    const keyRepo = dataSource.getRepository(AgencyApiKey);
    const key = await keyRepo.save(
      keyRepo.create({
        agencyId: agency.id,
        keyHash: hashAgencyApiKey(rawKey),
        scope: 'FULL',
        capabilities: ['AVAILABILITY', 'RESERVATION', 'TICKETING'],
        environment: 'SANDBOX',
        flightDomain: 'ALL',
        ipWhitelist: [],
        rateLimitPerMinute: null,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        lastUsedAt: null,
        callCount: 0,
      }),
    );
    apiKeyId = key.id;

    const origin = `D${suffix[0]}A`.toUpperCase();
    const destination = `D${suffix[1]}B`.toUpperCase();
    const routeRepo = dataSource.getRepository(Route);
    const route = await routeRepo.save(
      routeRepo.create({
        originCode: origin,
        destCode: destination,
        durationMin: 90,
      }),
    );
    routeId = route.id;
    aircraftType = `DIST-${suffix}`;
    const seatMapRepo = dataSource.getRepository(AircraftSeatMap);
    await seatMapRepo.save(
      seatMapRepo.create({
        aircraftType,
        businessRowStart: 1,
        businessRowEnd: 1,
        businessColsLeft: ['A'],
        businessColsRight: ['C'],
        economyRowStart: 2,
        economyRowEnd: 3,
        economyColsLeft: ['A', 'B'],
        economyColsRight: ['C'],
        updatedAt: new Date(),
      }),
    );
    const flightRepo = dataSource.getRepository(Flight);
    const flight = await flightRepo.save(
      flightRepo.create({
        flightNo: `DG-${suffix.slice(0, 4).toUpperCase()}`,
        routeId: route.id,
        aircraftType,
      }),
    );
    flightId = flight.id;
    const departureAt = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000);
    departureDate = departureAt.toISOString().slice(0, 10);
    const instanceRepo = dataSource.getRepository(FlightInstance);
    const instance = await instanceRepo.save(
      instanceRepo.create({
        flightId: flight.id,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 90 * 60 * 1000),
        capacity: 8,
        charterSeats: 0,
        status: 'SCHEDULED',
        agencySaleEnabled: true,
        publicSaleEnabled: false,
        basePriceIrr: 9_000_000n,
        definitionStatus: 'PUBLISHED',
      }),
    );
    instanceId = instance.id;
    const commercial = await userRepo.findOneByOrFail({ username: 'comm' });
    const allotmentRepo = dataSource.getRepository(AgencyAllotment);
    const allotment = await allotmentRepo.save(
      allotmentRepo.create({
        agencyId: agency.id,
        flightInstanceId: instance.id,
        cabin: 'ECONOMY',
        fareClassCode: null,
        seatRequestId: null,
        seatsAllocated: 3,
        type: 'HARD',
        releaseAt: null,
        contractPriceIrr: 8_500_000n,
        createdById: commercial.id,
      }),
    );
    allotmentId = allotment.id;
  });

  afterAll(async () => {
    if (bookingId) {
      await dataSource.getRepository(LedgerEntry).delete({ bookingId });
      await dataSource.getRepository(Booking).delete({ id: bookingId });
    }
    await dataSource.getRepository(AgencyAllotment).delete({ id: allotmentId });
    await dataSource.getRepository(FlightInstance).delete({ id: instanceId });
    await dataSource.getRepository(Flight).delete({ id: flightId });
    await dataSource.getRepository(Route).delete({ id: routeId });
    await dataSource.getRepository(AircraftSeatMap).delete({ aircraftType });
    await dataSource.getRepository(AgencyApiKey).delete({ id: apiKeyId });
    await dataSource.getRepository(AgencyCreditLine).delete({ agencyId });
    await dataSource.getRepository(AuditLog).delete({ actorId: agencyId });
    await dataSource.getRepository(AgencyProfile).delete({ userId: agencyId });
    await dataSource.getRepository(User).delete({ id: agencyId });
    await app.close();
  });

  const api = () => ({ 'X-API-Key': rawKey });

  it('shops, reprices and creates one central PNR with ETKT/coupon documents', async () => {
    const capabilities = await request(app.getHttpServer())
      .get('/api/v2/distribution/capabilities')
      .set(api());
    expect(capabilities.status).toBe(200);
    expect(capabilities.body.data.certification.externalGdsCertified).toBe(
      false,
    );

    const route = await dataSource
      .getRepository(Route)
      .findOneByOrFail({ id: routeId });
    const shopping = await request(app.getHttpServer())
      .post('/api/v2/distribution/air-shopping')
      .set(api())
      .send({
        origin: route.originCode,
        destination: route.destCode,
        date: departureDate,
        cabin: 'ECONOMY',
        passengerCount: 1,
      });
    expect(shopping.status).toBe(201);
    expect(shopping.body.data).toHaveLength(1);
    expect(shopping.body.data[0]).toMatchObject({
      allotmentId,
      flightInstanceId: instanceId,
      cabin: 'ECONOMY',
      availableSeats: 3,
      pricePerPassengerIrr: '8500000',
    });
    const offerId = shopping.body.data[0].offerId as string;

    const tampered = await request(app.getHttpServer())
      .post('/api/v2/distribution/offer-price')
      .set(api())
      .send({ offerId: `${offerId}x` });
    expect(tampered.status).toBe(401);

    const repriced = await request(app.getHttpServer())
      .post('/api/v2/distribution/offer-price')
      .set(api())
      .send({ offerId });
    expect(repriced.status).toBe(201);
    expect(repriced.body.data.pricePerPassengerIrr).toBe('8500000');

    const order = await request(app.getHttpServer())
      .post('/api/v2/distribution/orders')
      .set(api())
      .set('Idempotency-Key', `distribution-${crypto.randomUUID()}`)
      .send({
        offerId: repriced.body.data.offerId,
        allotmentId,
        cabin: 'ECONOMY',
        passengers: [
          {
            fullName: 'Distribution Passenger',
            passportNo: 'P1234567',
            passengerType: 'ADULT',
            birthDate: '1990-01-01',
            seatCode: '2A',
          },
        ],
      });
    expect(order.status).toBe(201);
    expect(order.body.data.status).toBe('TICKETED');
    bookingId = order.body.data.id;
    expect(order.body.data.passengers[0].ticketDocument).toMatchObject({
      status: 'ISSUED',
      coupons: [
        expect.objectContaining({
          status: 'OPEN',
          flightInstanceId: instanceId,
        }),
      ],
    });

    const retrieved = await request(app.getHttpServer())
      .get(`/api/v2/distribution/orders/${order.body.data.pnr}`)
      .set(api());
    expect(retrieved.status).toBe(200);
    expect(retrieved.body.data.id).toBe(bookingId);
    expect(retrieved.body.data.passengers[0].ticketNo).toMatch(/^780\d{10}$/);

    const documents = await dataSource
      .getRepository(TicketDocument)
      .findBy({ bookingId });
    expect(documents).toHaveLength(1);
    const coupons = await dataSource
      .getRepository(FlightCoupon)
      .findBy({ ticketDocumentId: documents[0].id });
    expect(coupons).toHaveLength(1);
  });
});

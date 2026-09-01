import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AuditLog } from '../src/database/entities/audit-log.entity';
import { AircraftSeatMap } from '../src/database/entities/aircraft-seat-map.entity';
import { Booking } from '../src/database/entities/booking.entity';
import { FlightCoupon } from '../src/database/entities/flight-coupon.entity';
import { Flight } from '../src/database/entities/flight.entity';
import { FlightInstance } from '../src/database/entities/flight-instance.entity';
import { Passenger } from '../src/database/entities/passenger.entity';
import {
  BookingChannel,
  BookingStatus,
  CabinClass,
} from '../src/database/enums';
import { TicketingService } from '../src/modules/ticketing/ticketing.service';
import { enumerateSeats } from '../src/modules/reservation/seat-layout';
import { createTestApp } from './helpers/app.helper';
import { loginAs } from './helpers/login.helper';

describe('DCS core (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let bookingId: string;
  let instanceId: string;
  let couponId: string;
  let seatCode: string;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);

    const flight = await dataSource.getRepository(Flight).findOneOrFail({
      where: {},
    });
    const seatMap = await dataSource
      .getRepository(AircraftSeatMap)
      .findOneByOrFail({ aircraftType: flight.aircraftType });
    seatCode = enumerateSeats(seatMap).find(
      (seat) => seat.cabin === CabinClass.ECONOMY,
    )!.seatCode;

    const departureAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const instanceRepo = dataSource.getRepository(FlightInstance);
    const instance = await instanceRepo.save(
      instanceRepo.create({
        flightId: flight.id,
        departureAt,
        arrivalAt: new Date(departureAt.getTime() + 2 * 60 * 60 * 1000),
        capacity: enumerateSeats(seatMap).length,
        charterSeats: 0,
        status: 'SCHEDULED',
        publicSaleEnabled: true,
        agencySaleEnabled: true,
      }),
    );
    instanceId = instance.id;

    const bookingRepo = dataSource.getRepository(Booking);
    const booking = await bookingRepo.save(
      bookingRepo.create({
        pnr: `DCS${Date.now().toString(36).slice(-5).toUpperCase()}`,
        flightInstanceId: instance.id,
        channel: BookingChannel.SYSTEM,
        agencyId: null,
        allotmentId: null,
        status: BookingStatus.TICKETED,
        priceIrr: 9_000_000n,
        cabin: CabinClass.ECONOMY,
        contactPhone: '09120000000',
        holdExpiresAt: null,
        idempotencyKey: `dcs-${Date.now()}`,
        userId: null,
        deletedAt: null,
        fareClassCode: 'Y',
        taxIrr: 900_000n,
        extrasSnapshot: [],
        extrasIrr: 0n,
        chargeSnapshot: null,
      }),
    );
    bookingId = booking.id;
    const passengerRepo = dataSource.getRepository(Passenger);
    await passengerRepo.save(
      passengerRepo.create({
        bookingId: booking.id,
        fullName: 'مسافر آزمون دی‌سی‌اس',
        nationalIdEnc: null,
        mobileEnc: null,
        nationalIdHash: null,
        passportNoEnc: null,
        gender: 'male',
        seatCode,
        extraSeatCode: null,
        ticketNo: null,
        ticketIssuedAt: null,
        extraSeatFareIrr: 0n,
        passengerType: 'ADULT',
        birthDate: '1990-01-01',
        occupiesSeat: true,
        fareIrr: 8_100_000n,
        taxIrr: 900_000n,
        deletedAt: null,
      }),
    );
    await dataSource.transaction((manager) =>
      app.get(TicketingService).issueBooking(manager, booking.id),
    );
    couponId = (
      await dataSource
        .getRepository(FlightCoupon)
        .findOneByOrFail({ flightInstanceId: instance.id })
    ).id;
  });

  afterAll(async () => {
    await dataSource.getRepository(AuditLog).delete({ entityId: couponId });
    await dataSource.getRepository(Booking).delete({ id: bookingId });
    await dataSource.getRepository(FlightInstance).delete({ id: instanceId });
    await app.close();
  });

  it('rejects finance role from the airport DCS surface', async () => {
    const finance = await loginAs(app, 'finance');
    const res = await request(app.getHttpServer())
      .get('/dcs/flights')
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('executes coupon check-in → baggage → boarding, idempotently', async () => {
    const ops = await loginAs(app, 'ops');
    const auth = { Authorization: `Bearer ${ops.accessToken}` };

    const checkedIn = await request(app.getHttpServer())
      .post(`/dcs/coupons/${couponId}/check-in`)
      .set(auth)
      .send({ seatCode, gate: 'A2' });
    expect(checkedIn.status).toBe(201);
    expect(checkedIn.body.data).toMatchObject({
      couponId,
      couponStatus: 'CHECKED_IN',
      seatCode,
      gate: 'A2',
    });
    expect(checkedIn.body.data.boardingPassNo).toMatch(/^BP\d{10}$/);

    const repeated = await request(app.getHttpServer())
      .post(`/dcs/coupons/${couponId}/check-in`)
      .set(auth)
      .send({ seatCode });
    expect(repeated.status).toBe(201);
    expect(repeated.body.data.boardingPassNo).toBe(
      checkedIn.body.data.boardingPassNo,
    );

    const baggage = await request(app.getHttpServer())
      .post(`/dcs/coupons/${couponId}/baggage`)
      .set(auth)
      .send({ weightGrams: 18_750 });
    expect(baggage.status).toBe(201);
    expect(baggage.body.data).toMatchObject({
      couponId,
      weightGrams: 18_750,
      status: 'ACCEPTED',
    });
    expect(baggage.body.data.tagNo).toMatch(/^BJ\d{10}$/);

    const boarded = await request(app.getHttpServer())
      .post(`/dcs/coupons/${couponId}/board`)
      .set(auth)
      .send({ gate: 'A2' });
    expect(boarded.status).toBe(201);
    expect(boarded.body.data.couponStatus).toBe('BOARDED');
    expect(boarded.body.data.boardedAt).toBeTruthy();

    const boardedAgain = await request(app.getHttpServer())
      .post(`/dcs/coupons/${couponId}/board`)
      .set(auth)
      .send({ gate: 'A2' });
    expect(boardedAgain.status).toBe(201);
    expect(boardedAgain.body.data.boardedAt).toBe(boarded.body.data.boardedAt);

    const manifest = await request(app.getHttpServer())
      .get(`/dcs/flights/${instanceId}`)
      .set(auth);
    expect(manifest.status).toBe(200);
    expect(manifest.body.data.totals).toMatchObject({
      booked: 1,
      checkedIn: 1,
      boarded: 1,
      baggagePieces: 1,
      baggageWeightGrams: 18_750,
    });
    expect(manifest.body.data.manifest[0].documentNo).toMatch(/^780\d{10}$/);

    const load = await request(app.getHttpServer())
      .get(`/dcs/flights/${instanceId}/load-summary`)
      .set(auth);
    expect(load.status).toBe(200);
    expect(load.body.data).toMatchObject({
      passengerStandardWeightKg: 84,
      baggageWeightKg: 18.75,
      trafficLoadKg: 102.75,
      balanceStatus: 'CONFIGURATION_REQUIRED',
      releaseStatus: 'NOT_RELEASED',
    });
  });
});

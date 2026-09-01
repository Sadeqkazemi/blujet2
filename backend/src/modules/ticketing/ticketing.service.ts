import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ErrorCode } from '../../common/errors';
import { Booking } from '../../database/entities/booking.entity';
import { FlightCoupon } from '../../database/entities/flight-coupon.entity';
import { Passenger } from '../../database/entities/passenger.entity';
import { TicketDocument } from '../../database/entities/ticket-document.entity';
import { FlightCouponStatus, TicketDocumentStatus } from '../../database/enums';

@Injectable()
export class TicketingService {
  private async nextTicketNo(manager: EntityManager): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const [row] = await manager.query<{ serial: string }[]>(
        `SELECT nextval('ticket_document_number_seq')::text AS serial`,
      );
      const ticketNo = `780${String(row.serial).padStart(10, '0')}`;
      const exists = await manager.exists(Passenger, { where: { ticketNo } });
      if (!exists) return ticketNo;
    }
    throw new InternalServerErrorException({
      code: ErrorCode.CONFLICT,
      message: 'تخصیص شماره بلیط یکتا انجام نشد.',
    });
  }

  async documentsForPassengers(
    manager: EntityManager,
    passengerIds: string[],
  ): Promise<Map<string, TicketDocument>> {
    if (passengerIds.length === 0) return new Map();
    const documents = await manager.find(TicketDocument, {
      where: { passengerId: In(passengerIds) },
      relations: { coupons: true },
      order: { coupons: { sequenceNo: 'ASC' } },
    });
    return new Map(
      documents.map((document) => [document.passengerId, document]),
    );
  }

  /**
   * Creates accountable ticket documents in the caller's existing transaction.
   * The passenger and segment unique constraints make retries idempotent.
   */
  async issueBooking(
    manager: EntityManager,
    bookingId: string,
    issuedAt = new Date(),
  ): Promise<TicketDocument[]> {
    const booking = await manager
      .createQueryBuilder(Booking, 'booking')
      .leftJoinAndSelect('booking.flightInstance', 'flightInstance')
      .leftJoinAndSelect('flightInstance.flight', 'flight')
      .leftJoinAndSelect('flight.route', 'route')
      .where('booking.id = :bookingId', { bookingId })
      .getOne();
    if (!booking) {
      throw new InternalServerErrorException({
        code: ErrorCode.NOT_FOUND,
        message: 'رزرو برای صدور سند بلیط یافت نشد.',
      });
    }

    const passengers = await manager.find(Passenger, {
      where: { bookingId },
      order: { id: 'ASC' },
    });
    if (passengers.length === 0) {
      throw new InternalServerErrorException({
        code: ErrorCode.CONFLICT,
        message: 'صدور بلیط بدون مسافر امکان‌پذیر نیست.',
      });
    }

    const existing = await this.documentsForPassengers(
      manager,
      passengers.map((passenger) => passenger.id),
    );
    const issued: TicketDocument[] = [];

    for (const passenger of passengers) {
      let document = existing.get(passenger.id);
      if (!passenger.ticketNo) {
        passenger.ticketNo = await this.nextTicketNo(manager);
        passenger.ticketIssuedAt = issuedAt;
        await manager.save(passenger);
      }
      if (!passenger.ticketIssuedAt) {
        passenger.ticketIssuedAt = issuedAt;
        await manager.save(passenger);
      }

      if (!document) {
        document = await manager.save(
          manager.create(TicketDocument, {
            documentNo: passenger.ticketNo,
            passengerId: passenger.id,
            bookingId,
            status: TicketDocumentStatus.ISSUED,
            issuedAt: passenger.ticketIssuedAt,
            originalIssueAt: passenger.ticketIssuedAt,
            currency: 'IRR',
            totalFareIrr: passenger.fareIrr,
            totalTaxIrr: passenger.taxIrr,
          }),
        );
        document.coupons = [];
      }

      const couponExists = document.coupons.some(
        (coupon) => coupon.flightInstanceId === booking.flightInstanceId,
      );
      if (!couponExists) {
        const coupon = await manager.save(
          manager.create(FlightCoupon, {
            ticketDocumentId: document.id,
            flightInstanceId: booking.flightInstanceId,
            sequenceNo: document.coupons.length + 1,
            status: FlightCouponStatus.OPEN,
            flightNo: booking.flightInstance.flight.flightNo,
            originCode: booking.flightInstance.flight.route.originCode,
            destCode: booking.flightInstance.flight.route.destCode,
            departureAt: booking.flightInstance.departureAt,
            cabin: booking.cabin,
            fareClassCode: booking.fareClassCode,
            fareIrr: passenger.fareIrr,
            taxIrr: passenger.taxIrr,
          }),
        );
        document.coupons.push(coupon);
      }
      issued.push(document);
    }

    return issued;
  }

  async refundBooking(
    manager: EntityManager,
    bookingId: string,
  ): Promise<void> {
    const documents = await manager.find(TicketDocument, {
      where: { bookingId },
      relations: { coupons: true },
    });
    if (documents.length === 0) return;
    await manager.update(
      TicketDocument,
      { bookingId, status: TicketDocumentStatus.ISSUED },
      { status: TicketDocumentStatus.REFUNDED },
    );
    await manager
      .createQueryBuilder()
      .update(FlightCoupon)
      .set({ status: FlightCouponStatus.REFUNDED })
      .where('"ticketDocumentId" IN (:...documentIds)', {
        documentIds: documents.map((document) => document.id),
      })
      .andWhere('status IN (:...statuses)', {
        statuses: [
          FlightCouponStatus.OPEN,
          FlightCouponStatus.CHECKED_IN,
          FlightCouponStatus.BOARDED,
        ],
      })
      .execute();
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../database/entities/booking.entity';
import { FlightCoupon } from '../../database/entities/flight-coupon.entity';
import { Passenger } from '../../database/entities/passenger.entity';
import { TicketDocument } from '../../database/entities/ticket-document.entity';
import { TicketingService } from './ticketing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      Passenger,
      TicketDocument,
      FlightCoupon,
    ]),
  ],
  providers: [TicketingService],
  exports: [TicketingService],
})
export class TicketingModule {}

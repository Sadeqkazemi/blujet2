import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlightInstance } from '../../database/entities/flight-instance.entity';
import { Passenger } from '../../database/entities/passenger.entity';
import { Booking } from '../../database/entities/booking.entity';
import { FlightopsService } from './flightops.service';
import { FlightopsController } from './flightops.controller';
import { NiraModule } from '../nira/nira.module';
import { PanelsModule } from '../panels/panels.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlightInstance, Passenger, Booking]),
    NiraModule,
    PanelsModule,
    AuthModule,
  ],
  controllers: [FlightopsController],
  providers: [FlightopsService],
})
export class FlightopsModule {}

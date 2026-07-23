import { Module } from '@nestjs/common';
import { FlightStatusController } from './flight-status.controller';
import { FlightStatusService } from './flight-status.service';

@Module({
  controllers: [FlightStatusController],
  providers: [FlightStatusService],
})
export class FlightStatusModule {}

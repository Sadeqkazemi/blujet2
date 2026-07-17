import { Module } from '@nestjs/common';
import { PassengerReportsController } from './passenger-reports.controller';
import { PassengerReportsService } from './passenger-reports.service';
import { PanelsModule } from '../panels/panels.module';

@Module({
  imports: [PanelsModule],
  controllers: [PassengerReportsController],
  providers: [PassengerReportsService],
})
export class PassengerReportsModule {}

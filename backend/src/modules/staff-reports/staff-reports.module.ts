import { Module } from '@nestjs/common';
import { StaffReportsController } from './staff-reports.controller';
import { StaffReportsService } from './staff-reports.service';
import { PanelsModule } from '../panels/panels.module';

@Module({
  imports: [PanelsModule],
  controllers: [StaffReportsController],
  providers: [StaffReportsService],
})
export class StaffReportsModule {}

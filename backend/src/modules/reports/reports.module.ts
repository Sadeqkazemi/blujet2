import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PanelsModule } from '../panels/panels.module';

@Module({
  imports: [PanelsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}

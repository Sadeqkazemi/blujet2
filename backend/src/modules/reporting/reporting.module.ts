import { Module } from '@nestjs/common';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { PanelsModule } from '../panels/panels.module';

@Module({
  imports: [PanelsModule],
  controllers: [ReportingController],
  providers: [ReportingService],
})
export class ReportingModule {}

import { Module } from '@nestjs/common';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { PanelsModule } from '../panels/panels.module';
import { AgenciesModule } from '../agencies/agencies.module';

@Module({
  imports: [PanelsModule, AgenciesModule],
  controllers: [ReportingController],
  providers: [ReportingService],
  exports: [ReportingService],
})
export class ReportingModule {}

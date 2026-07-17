import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { PanelsModule } from '../panels/panels.module';
import { AuditModule } from '../audit/audit.module';
import { ReportingModule } from '../reporting/reporting.module';

@Module({
  imports: [PanelsModule, AuditModule, ReportingModule],
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}

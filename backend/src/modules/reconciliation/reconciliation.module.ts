import { Module } from '@nestjs/common';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { AuditModule } from '../audit/audit.module';
import { PanelsModule } from '../panels/panels.module';

@Module({
  imports: [AuditModule, PanelsModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
})
export class ReconciliationModule {}

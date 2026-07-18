import { Module } from '@nestjs/common';
import { RefundsController } from './refunds.controller';
import { RefundsCustomerController } from './refunds-customer.controller';
import { RefundsService } from './refunds.service';
import { PanelsModule } from '../panels/panels.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PanelsModule, AuditModule],
  controllers: [RefundsController, RefundsCustomerController],
  providers: [RefundsService],
})
export class RefundsModule {}

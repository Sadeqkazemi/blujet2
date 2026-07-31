import { Module } from '@nestjs/common';
import { WebservicePricingController } from './webservice-pricing.controller';
import { WebservicePricingService } from './webservice-pricing.service';
import { AuditModule } from '../audit/audit.module';
import { PanelsModule } from '../panels/panels.module';

@Module({
  imports: [AuditModule, PanelsModule],
  controllers: [WebservicePricingController],
  providers: [WebservicePricingService],
  exports: [WebservicePricingService],
})
export class WebservicePricingModule {}

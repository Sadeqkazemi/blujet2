import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { AiModule } from '../ai/ai.module';
import { PanelsModule } from '../panels/panels.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AiModule, PanelsModule, AuditModule],
  controllers: [PricingController],
  providers: [PricingService],
})
export class PricingModule {}

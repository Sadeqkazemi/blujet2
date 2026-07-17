import { Module } from '@nestjs/common';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { CartableModule } from '../cartable/cartable.module';
import { PanelsModule } from '../panels/panels.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [CartableModule, PanelsModule, AuditModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
})
export class ReferralsModule {}

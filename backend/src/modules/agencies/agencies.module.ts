import { Module } from '@nestjs/common';
import { AgenciesController } from './agencies.controller';
import { AgencyRequestsPublicController } from './agency-requests-public.controller';
import { AgenciesService } from './agencies.service';
import { PanelsModule } from '../panels/panels.module';
import { AuditModule } from '../audit/audit.module';
import { CartableModule } from '../cartable/cartable.module';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [PanelsModule, AuditModule, CartableModule, AuthModule, SmsModule],
  controllers: [AgenciesController, AgencyRequestsPublicController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}

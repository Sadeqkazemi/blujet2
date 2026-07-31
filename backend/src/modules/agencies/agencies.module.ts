import { Module } from '@nestjs/common';
import { AgenciesController } from './agencies.controller';
import { AgencyRequestsPublicController } from './agency-requests-public.controller';
import { AgenciesService } from './agencies.service';
import { AgencyBookingService } from './agency-booking.service';
import { PanelsModule } from '../panels/panels.module';
import { AuditModule } from '../audit/audit.module';
import { CartableModule } from '../cartable/cartable.module';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';
import { BookingEngineModule } from '../booking-engine/booking-engine.module';

@Module({
  imports: [
    PanelsModule,
    AuditModule,
    CartableModule,
    AuthModule,
    SmsModule,
    BookingEngineModule,
  ],
  controllers: [AgenciesController, AgencyRequestsPublicController],
  providers: [AgenciesService, AgencyBookingService],
  exports: [AgenciesService, AgencyBookingService],
})
export class AgenciesModule {}

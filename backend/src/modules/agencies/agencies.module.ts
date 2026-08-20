import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgencyProfile } from '../../database/entities/agency-profile.entity';
import { AgencyCreditLine } from '../../database/entities/agency-credit-line.entity';
import { AgencyRequestOtp } from '../../database/entities/agency-request-otp.entity';
import { AgencyMembershipRequest } from '../../database/entities/agency-membership-request.entity';
import { AgencyApiKey } from '../../database/entities/agency-api-key.entity';
import { AgencyInvoice } from '../../database/entities/agency-invoice.entity';
import { AgencySeatRequest } from '../../database/entities/agency-seat-request.entity';
import { AgencySeatRequestFlight } from '../../database/entities/agency-seat-request-flight.entity';
import { Airport } from '../../database/entities/airport.entity';
import { AgencyMessage } from '../../database/entities/agency-message.entity';
import { AgencyCreditRequest } from '../../database/entities/agency-credit-request.entity';
import { AgencyWebserviceRequest } from '../../database/entities/agency-webservice-request.entity';
import { AgencyDocument } from '../../database/entities/agency-document.entity';
import { User } from '../../database/entities/user.entity';
import { LedgerEntry } from '../../database/entities/ledger-entry.entity';
import { Booking } from '../../database/entities/booking.entity';
import { Passenger } from '../../database/entities/passenger.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { AgenciesController } from './agencies.controller';
import { AgencyRequestsPublicController } from './agency-requests-public.controller';
import { AgenciesService } from './agencies.service';
import { PanelsModule } from '../panels/panels.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CartableModule } from '../cartable/cartable.module';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgencyProfile,
      AgencyCreditLine,
      AgencyRequestOtp,
      AgencyMembershipRequest,
      AgencyApiKey,
      AgencyInvoice,
      AgencySeatRequest,
      AgencySeatRequestFlight,
      Airport,
      AgencyMessage,
      AgencyCreditRequest,
      AgencyWebserviceRequest,
      AgencyDocument,
      User,
      LedgerEntry,
      Booking,
      Passenger,
      AuditLog,
      RefreshToken,
    ]),
    PanelsModule,
    AuditModule,
    NotificationsModule,
    CartableModule,
    AuthModule,
    SmsModule,
  ],
  controllers: [AgenciesController, AgencyRequestsPublicController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}

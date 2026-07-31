import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchAdvisoryService } from './search-advisory.service';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { WalletPointsLockController } from './wallet-points-lock.controller';
import { WalletService } from './wallet.service';
import { ClubPointsService } from './club-points.service';
import { PriceLockService } from './price-lock.service';
import { SavedFlightsService } from './saved-flights.service';
import { MySavedFlightsController } from './my-saved-flights.controller';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { AuditModule } from '../audit/audit.module';
import { CustomerReferralsModule } from '../customer-referrals/customer-referrals.module';
import { AiModule } from '../ai/ai.module';
import { PAYMENT_GATEWAY, SandboxPaymentGateway } from './payment-gateway';

@Module({
  imports: [AuditModule, CustomerReferralsModule, AiModule],
  controllers: [
    SearchController,
    BookingController,
    WalletPointsLockController,
    MySavedFlightsController,
    PrivacyController,
  ],
  providers: [
    SearchService,
    SearchAdvisoryService,
    BookingService,
    WalletService,
    ClubPointsService,
    PriceLockService,
    SavedFlightsService,
    PrivacyService,
    // PAYMENT_GATEWAY env var selects the driver; sandbox is the only one
    // until a real Shetab/PSP contract exists — the interface is final.
    { provide: PAYMENT_GATEWAY, useClass: SandboxPaymentGateway },
  ],
  exports: [SearchService, BookingService],
})
export class BookingEngineModule {}

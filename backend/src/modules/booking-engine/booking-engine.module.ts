import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { WalletPointsLockController } from './wallet-points-lock.controller';
import { WalletService } from './wallet.service';
import { ClubPointsService } from './club-points.service';
import { PriceLockService } from './price-lock.service';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { PriceAdvisoryService } from './price-advisory.service';
import { AuditModule } from '../audit/audit.module';
import { AiModule } from '../ai/ai.module';
import { PAYMENT_GATEWAY } from './payment-gateway';
import { createPaymentGateway } from './payment-gateway.provider';

@Module({
  imports: [AuditModule, AiModule],
  controllers: [
    SearchController,
    BookingController,
    WalletPointsLockController,
    PrivacyController,
  ],
  providers: [
    SearchService,
    BookingService,
    WalletService,
    ClubPointsService,
    PriceLockService,
    PrivacyService,
    PriceAdvisoryService,
    { provide: PAYMENT_GATEWAY, useFactory: createPaymentGateway },
  ],
  exports: [SearchService, BookingService],
})
export class BookingEngineModule {}

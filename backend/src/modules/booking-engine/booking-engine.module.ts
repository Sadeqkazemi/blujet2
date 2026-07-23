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
import { AuditModule } from '../audit/audit.module';
import { PAYMENT_GATEWAY, SandboxPaymentGateway } from './payment-gateway';

@Module({
  imports: [AuditModule],
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
    // PAYMENT_GATEWAY env var selects the driver; sandbox is the only one
    // until a real Shetab/PSP contract exists — the interface is final.
    { provide: PAYMENT_GATEWAY, useClass: SandboxPaymentGateway },
  ],
  exports: [SearchService, BookingService],
})
export class BookingEngineModule {}

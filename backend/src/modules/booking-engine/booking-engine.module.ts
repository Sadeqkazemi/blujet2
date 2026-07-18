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
  ],
  exports: [SearchService],
})
export class BookingEngineModule {}

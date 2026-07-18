import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [SearchController, BookingController],
  providers: [SearchService, BookingService],
  exports: [SearchService],
})
export class BookingEngineModule {}

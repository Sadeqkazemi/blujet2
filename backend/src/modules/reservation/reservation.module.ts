import { Module } from '@nestjs/common';
import { SeatmapController } from './seatmap.controller';
import { SeatmapService } from './seatmap.service';
import { PnrController } from './pnr.controller';
import { PnrService } from './pnr.service';
import { AuditModule } from '../audit/audit.module';
import { PanelsModule } from '../panels/panels.module';
import { BookingEngineModule } from '../booking-engine/booking-engine.module';

@Module({
  imports: [AuditModule, PanelsModule, BookingEngineModule],
  controllers: [SeatmapController, PnrController],
  providers: [SeatmapService, PnrService],
})
export class ReservationModule {}

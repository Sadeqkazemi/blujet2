import { Module } from '@nestjs/common';
import { AgencyApiController } from './agency-api.controller';
import { AgencyApiService } from './agency-api.service';
import { AgencyApiKeyGuard } from './agency-api-key.guard';
import { AgencyApiScopeGuard } from './agency-api-scope.guard';
import { AgenciesModule } from '../agencies/agencies.module';
import { BookingEngineModule } from '../booking-engine/booking-engine.module';

@Module({
  imports: [AgenciesModule, BookingEngineModule],
  controllers: [AgencyApiController],
  providers: [AgencyApiService, AgencyApiKeyGuard, AgencyApiScopeGuard],
})
export class AgencyApiModule {}

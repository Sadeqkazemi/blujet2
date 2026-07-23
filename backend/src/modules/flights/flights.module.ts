import { Module } from '@nestjs/common';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { PanelsModule } from '../panels/panels.module';
import { AuditModule } from '../audit/audit.module';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PanelsModule, AuditModule, AiModule, AuthModule],
  controllers: [FlightsController],
  providers: [FlightsService],
})
export class FlightsModule {}

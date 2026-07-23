import { Module } from '@nestjs/common';
import { FlightopsService } from './flightops.service';
import { FlightopsController } from './flightops.controller';
import { NiraModule } from '../nira/nira.module';
import { PanelsModule } from '../panels/panels.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [NiraModule, PanelsModule, AuthModule],
  controllers: [FlightopsController],
  providers: [FlightopsService],
})
export class FlightopsModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FlightsModule } from '../flights/flights.module';
import { RmsController } from './rms.controller';

@Module({
  imports: [FlightsModule, AuthModule],
  controllers: [RmsController],
})
export class RmsModule {}

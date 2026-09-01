import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AircraftSeat } from '../../database/entities/aircraft-seat.entity';
import { AircraftSeatMap } from '../../database/entities/aircraft-seat-map.entity';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DcsController } from './dcs.controller';
import { DcsService } from './dcs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AircraftSeat, AircraftSeatMap]),
    AuditModule,
    AuthModule,
  ],
  controllers: [DcsController],
  providers: [DcsService],
})
export class DcsModule {}

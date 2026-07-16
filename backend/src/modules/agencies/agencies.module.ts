import { Module } from '@nestjs/common';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';
import { PanelsModule } from '../panels/panels.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PanelsModule, AuditModule],
  controllers: [AgenciesController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}

import { Module } from '@nestjs/common';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';
import { AuditModule } from '../audit/audit.module';
import { PanelsModule } from '../panels/panels.module';

@Module({
  imports: [AuditModule, PanelsModule],
  controllers: [AdminsController],
  providers: [AdminsService],
})
export class AdminsModule {}

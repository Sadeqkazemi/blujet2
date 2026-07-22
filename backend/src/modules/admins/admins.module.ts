import { Module } from '@nestjs/common';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';
import { AuditModule } from '../audit/audit.module';
import { PanelsModule } from '../panels/panels.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [AuditModule, PanelsModule, SmsModule],
  controllers: [AdminsController],
  providers: [AdminsService],
})
export class AdminsModule {}

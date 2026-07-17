import { Module } from '@nestjs/common';
import { ManagerMessagesController } from './manager-messages.controller';
import { ManagerMessagesService } from './manager-messages.service';
import { CartableModule } from '../cartable/cartable.module';
import { PanelsModule } from '../panels/panels.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [CartableModule, PanelsModule, AuditModule],
  controllers: [ManagerMessagesController],
  providers: [ManagerMessagesService],
})
export class ManagerMessagesModule {}

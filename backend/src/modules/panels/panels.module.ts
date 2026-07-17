import { Module } from '@nestjs/common';
import { PanelsController } from './panels.controller';
import { PanelsService } from './panels.service';
import { PanelAccessGuard } from './panel-access.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PanelsController],
  providers: [PanelsService, PanelAccessGuard],
  exports: [PanelsService, PanelAccessGuard],
})
export class PanelsModule {}

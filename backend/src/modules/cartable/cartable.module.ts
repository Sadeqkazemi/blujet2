import { Module } from '@nestjs/common';
import { CartableController } from './cartable.controller';
import { CartableService } from './cartable.service';
import { PanelsModule } from '../panels/panels.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PanelsModule, AuditModule],
  controllers: [CartableController],
  providers: [CartableService],
  exports: [CartableService],
})
export class CartableModule {}

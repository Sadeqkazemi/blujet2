import { Module } from '@nestjs/common';
import { ClubController } from './club.controller';
import { ClubService } from './club.service';
import { PanelsModule } from '../panels/panels.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PanelsModule, AuditModule],
  controllers: [ClubController],
  providers: [ClubService],
})
export class ClubModule {}

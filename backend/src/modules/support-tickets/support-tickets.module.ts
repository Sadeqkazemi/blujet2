import { Module } from '@nestjs/common';
import { SupportTicketsController } from './support-tickets.controller';
import { SupportTicketsService } from './support-tickets.service';
import { AuditModule } from '../audit/audit.module';
import { StaffDirectoryModule } from '../staff-directory/staff-directory.module';

@Module({
  imports: [AuditModule, StaffDirectoryModule],
  controllers: [SupportTicketsController],
  providers: [SupportTicketsService],
  exports: [SupportTicketsService],
})
export class SupportTicketsModule {}

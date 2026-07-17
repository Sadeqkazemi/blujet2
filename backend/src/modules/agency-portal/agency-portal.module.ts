import { Module } from '@nestjs/common';
import { AgencyPortalController } from './agency-portal.controller';
import { AgencyPortalService } from './agency-portal.service';
import { AuditModule } from '../audit/audit.module';
import { CartableModule } from '../cartable/cartable.module';
import { AgenciesModule } from '../agencies/agencies.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [AuditModule, CartableModule, AgenciesModule, FilesModule],
  controllers: [AgencyPortalController],
  providers: [AgencyPortalService],
})
export class AgencyPortalModule {}

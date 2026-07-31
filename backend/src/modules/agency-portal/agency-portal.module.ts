import { Module } from '@nestjs/common';
import { AgencyPortalController } from './agency-portal.controller';
import { AgencyPortalService } from './agency-portal.service';
import { AuditModule } from '../audit/audit.module';
import { CartableModule } from '../cartable/cartable.module';
import { AgenciesModule } from '../agencies/agencies.module';
import { FilesModule } from '../files/files.module';
import { WebservicePricingModule } from '../webservice-pricing/webservice-pricing.module';

@Module({
  imports: [
    AuditModule,
    CartableModule,
    AgenciesModule,
    FilesModule,
    WebservicePricingModule,
  ],
  controllers: [AgencyPortalController],
  providers: [AgencyPortalService],
})
export class AgencyPortalModule {}

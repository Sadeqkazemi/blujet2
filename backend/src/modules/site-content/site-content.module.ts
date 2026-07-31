import { Module } from '@nestjs/common';
import { SiteContentAdminController } from './site-content-admin.controller';
import { SiteContentPublicController } from './site-content-public.controller';
import { SiteContentService } from './site-content.service';
import { AuditModule } from '../audit/audit.module';
import { PanelsModule } from '../panels/panels.module';

@Module({
  imports: [AuditModule, PanelsModule],
  controllers: [SiteContentAdminController, SiteContentPublicController],
  providers: [SiteContentService],
  exports: [SiteContentService],
})
export class SiteContentModule {}

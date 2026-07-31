import { Module } from '@nestjs/common';
import { BlogAdminController } from './blog-admin.controller';
import { BlogPublicController } from './blog-public.controller';
import { BlogService } from './blog.service';
import { AuditModule } from '../audit/audit.module';
import { PanelsModule } from '../panels/panels.module';

@Module({
  imports: [AuditModule, PanelsModule],
  controllers: [BlogAdminController, BlogPublicController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}

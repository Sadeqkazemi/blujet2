import { Module } from '@nestjs/common';
import { CareersController } from './careers.controller';
import { CareersPublicController } from './careers-public.controller';
import { CareersService } from './careers.service';
import { AuditModule } from '../audit/audit.module';
import { PanelsModule } from '../panels/panels.module';

@Module({
  // CareersController's static /careers/postings, /careers/settings and
  // /careers/applications routes must be registered before
  // CareersPublicController's /careers/jobs* routes — no overlap today,
  // but keeping the same order as SurveyModule for consistency/safety.
  imports: [AuditModule, PanelsModule],
  controllers: [CareersController, CareersPublicController],
  providers: [CareersService],
  exports: [CareersService],
})
export class CareersModule {}

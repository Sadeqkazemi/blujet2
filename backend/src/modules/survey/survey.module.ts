import { Module } from '@nestjs/common';
import { SurveyController } from './survey.controller';
import { SurveyPublicController } from './survey-public.controller';
import { SurveyService } from './survey.service';
import { SmsModule } from '../sms/sms.module';
import { AuditModule } from '../audit/audit.module';
import { AiModule } from '../ai/ai.module';
import { PanelsModule } from '../panels/panels.module';

@Module({
  // SurveyController's static routes (settings/questions/stats/results)
  // must be registered before SurveyPublicController's `/survey/:token`
  // wildcard, or Express would match the wildcard first.
  imports: [SmsModule, AuditModule, AiModule, PanelsModule],
  controllers: [SurveyController, SurveyPublicController],
  providers: [SurveyService],
  exports: [SurveyService],
})
export class SurveyModule {}

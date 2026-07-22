import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SMS_PROVIDER } from '../../common/sms/sms-provider.interface';
import { MockSmsProvider } from '../../common/sms/mock-sms.provider';

@Module({
  providers: [SmsService, { provide: SMS_PROVIDER, useClass: MockSmsProvider }],
  exports: [SmsService],
})
export class SmsModule {}

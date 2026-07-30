import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import {
  SMS_PROVIDER,
  type SmsProvider,
} from '../../common/sms/sms-provider.interface';
import { MockSmsProvider } from '../../common/sms/mock-sms.provider';
import { KavenegarSmsProvider } from '../../common/sms/kavenegar-sms.provider';

// SMS_PROVIDER=kavenegar + KAVENEGAR_API_KEY switches to the real vendor
// (see docs/DB_SCHEMA.md Phase 14 / ext_kavenegar); anything else — the
// dev/test default — keeps using MockSmsProvider, so the existing test
// suite never makes a real network call.
@Module({
  providers: [
    SmsService,
    {
      provide: SMS_PROVIDER,
      useFactory: (): SmsProvider =>
        process.env.SMS_PROVIDER === 'kavenegar'
          ? new KavenegarSmsProvider()
          : new MockSmsProvider(),
    },
  ],
  exports: [SmsService],
})
export class SmsModule {}

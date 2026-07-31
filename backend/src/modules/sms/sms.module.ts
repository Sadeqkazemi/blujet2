import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SMS_PROVIDER } from '../../common/sms/sms-provider.interface';
import { MockSmsProvider } from '../../common/sms/mock-sms.provider';
import { KavenegarSmsProvider } from '../../common/sms/kavenegar-sms.provider';

// KavenegarSmsProvider checks the ExternalServiceConfig(key:"ext_kavenegar")
// row (IT Manager panel, Phase 28) on every send and falls back to
// MockSmsProvider whenever it's disabled or has no key configured — see
// its own doc comment. The seed row ships with no key, so the existing
// test suite never makes a real network call without any env var needed.
@Module({
  providers: [
    SmsService,
    MockSmsProvider,
    { provide: SMS_PROVIDER, useClass: KavenegarSmsProvider },
  ],
  exports: [SmsService],
})
export class SmsModule {}

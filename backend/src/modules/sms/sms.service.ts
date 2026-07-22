import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SMS_PROVIDER,
  type SmsMessageType,
  type SmsProvider,
} from '../../common/sms/sms-provider.interface';

/** Wraps SmsProvider with the real send log (Phase 14) — see
 * docs/DB_SCHEMA.md. The only genuine (non-fabricated) failure this
 * introduces is a missing phone number; the provider itself is never
 * asked to simulate a failure rate. */
@Injectable()
export class SmsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly provider: SmsProvider,
  ) {}

  async send(
    phone: string | null | undefined,
    message: string,
    messageType: SmsMessageType,
  ) {
    if (!phone) {
      await this.prisma.smsLog.create({
        data: {
          phone: null,
          messageType,
          status: 'FAILED',
          failureReason: 'این حساب شماره موبایل ثبت‌شده ندارد.',
        },
      });
      return { success: false as const };
    }

    const result = await this.provider.send(phone, message, messageType);
    await this.prisma.smsLog.create({
      data: {
        phone,
        messageType,
        status: result.success ? 'SUCCESS' : 'FAILED',
        failureReason: result.failureReason,
      },
    });
    return result;
  }
}

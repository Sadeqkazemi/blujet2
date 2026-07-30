import { Injectable, Logger } from '@nestjs/common';
import type {
  SmsMessageType,
  SmsProvider,
  SmsSendResult,
} from './sms-provider.interface';

/** Real vendor per docs/DB_SCHEMA.md Phase 14's `ExternalServiceConfig
 * (key: "ext_kavenegar")` — https://kavenegar.com REST send API. Used
 * only when `SMS_PROVIDER=kavenegar` and `KAVENEGAR_API_KEY` are set
 * (see sms.module.ts); MockSmsProvider stays the dev/test default. */
@Injectable()
export class KavenegarSmsProvider implements SmsProvider {
  private readonly logger = new Logger(KavenegarSmsProvider.name);
  private readonly apiKey: string;
  private readonly sender?: string;

  constructor() {
    const apiKey = process.env.KAVENEGAR_API_KEY;
    if (!apiKey) {
      throw new Error(
        'KAVENEGAR_API_KEY is required when SMS_PROVIDER=kavenegar',
      );
    }
    this.apiKey = apiKey;
    this.sender = process.env.KAVENEGAR_SENDER_LINE || undefined;
  }

  async send(
    phone: string,
    message: string,
    messageType: SmsMessageType,
  ): Promise<SmsSendResult> {
    const url = `https://api.kavenegar.com/v1/${this.apiKey}/sms/send.json`;
    const params = new URLSearchParams({ receptor: phone, message });
    if (this.sender) params.set('sender', this.sender);

    try {
      const res = await fetch(`${url}?${params.toString()}`);
      const body = (await res.json()) as {
        return?: { status?: number; message?: string };
      };
      if (!res.ok || body.return?.status !== 200) {
        const failureReason =
          body.return?.message || `کاوه‌نگار خطای ${res.status} برگرداند.`;
        this.logger.warn(
          `SMS (${messageType}) to ${phone} failed: ${failureReason}`,
        );
        return { success: false, failureReason };
      }
      return { success: true };
    } catch (err) {
      const failureReason =
        err instanceof Error ? err.message : 'خطای ناشناخته در ارسال پیامک';
      this.logger.error(
        `SMS (${messageType}) to ${phone} failed: ${failureReason}`,
      );
      return { success: false, failureReason };
    }
  }
}

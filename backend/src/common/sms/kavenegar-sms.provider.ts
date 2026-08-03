import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalServiceConfig } from '../../database/entities/external-service-config.entity';
import { decryptPii } from '../pii-crypto';
import { MockSmsProvider } from './mock-sms.provider';
import type {
  SmsMessageType,
  SmsProvider,
  SmsSendResult,
} from './sms-provider.interface';

const KAVENEGAR_SERVICE_KEY = 'ext_kavenegar';

/** Real vendor per docs/DB_SCHEMA.md Phase 14's `ExternalServiceConfig
 * (key: "ext_kavenegar")` row — the SAME encrypted-at-rest, IT-Manager-
 * editable mechanism already used for the zarinpal/amadeus/neshan rows
 * (Phase 28's services tab), not a server env var. IT_MANAGER sets/
 * rotates the key live from the panel; no server access or restart
 * needed. Falls back to MockSmsProvider (log-only, always success)
 * whenever the row is disabled or has no key configured — the same
 * "vendor not connected yet" graceful-degradation posture already used
 * for the AI summary/ML pricing providers. */
@Injectable()
export class KavenegarSmsProvider implements SmsProvider {
  private readonly logger = new Logger(KavenegarSmsProvider.name);

  constructor(
    @InjectRepository(ExternalServiceConfig)
    private readonly configRepo: Repository<ExternalServiceConfig>,
    private readonly mock: MockSmsProvider,
  ) {}

  async send(
    phone: string,
    message: string,
    messageType: SmsMessageType,
  ): Promise<SmsSendResult> {
    const config = await this.configRepo.findOneBy({
      key: KAVENEGAR_SERVICE_KEY,
    });
    if (!config?.enabled || !config.apiKeyEncrypted) {
      return this.mock.send(phone, message, messageType);
    }

    const apiKey = decryptPii(config.apiKeyEncrypted);
    const url = `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`;
    const params = new URLSearchParams({ receptor: phone, message });
    const senderLine = process.env.KAVENEGAR_SENDER_LINE || undefined;
    if (senderLine) params.set('sender', senderLine);

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

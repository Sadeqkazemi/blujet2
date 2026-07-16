import { Injectable, Logger } from '@nestjs/common';
import { TwoFactorProvider } from './two-factor-provider.interface';

/** Dev/test provider — logs the code instead of sending SMS/email. Never used in production. */
@Injectable()
export class MockTwoFactorProvider implements TwoFactorProvider {
  private readonly logger = new Logger(MockTwoFactorProvider.name);
  private readonly lastCodeByUserId = new Map<string, string>();

  sendCode(
    user: { id: string; fullName: string },
    code: string,
  ): Promise<void> {
    this.lastCodeByUserId.set(user.id, code);
    this.logger.debug(`2FA code for ${user.fullName} (${user.id}): ${code}`);
    return Promise.resolve();
  }

  /** Test-only helper to read back the last code sent to a user. */
  getLastCode(userId: string): string | undefined {
    return this.lastCodeByUserId.get(userId);
  }
}

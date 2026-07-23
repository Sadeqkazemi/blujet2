import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TWO_FACTOR_PROVIDER } from './providers/two-factor-provider.interface';
import type { TwoFactorProvider } from './providers/two-factor-provider.interface';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { StepUpScope } from '../../../generated/prisma/enums';

const STEP_UP_TTL_MS = 2 * 60 * 1000;
const STEP_UP_MAX_ATTEMPTS = 5;

function generateSixDigitCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Phase 15 — a fresh re-authentication challenge required immediately
 * before a high-risk write, on top of (not instead of) the actor's
 * existing session JWT. Reuses TwoFactorChallenge and the same delivery
 * channel as staff 2FA login — see docs/DB_SCHEMA.md Phase 15. */
@Injectable()
export class StepUpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(TWO_FACTOR_PROVIDER)
    private readonly twoFactorProvider: TwoFactorProvider,
  ) {}

  async request(
    actor: AuthenticatedUser,
    scope: StepUpScope,
  ): Promise<{ challengeId: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
    });
    const code = generateSixDigitCode();
    const challenge = await this.prisma.twoFactorChallenge.create({
      data: {
        userId: actor.id,
        purpose: 'STEP_UP_VERIFICATION',
        scope,
        codeHash: await argon2.hash(code),
        expiresAt: new Date(Date.now() + STEP_UP_TTL_MS),
      },
    });

    await this.twoFactorProvider.sendCode(user, code);

    return { challengeId: challenge.id };
  }

  /** Verifies and consumes a step-up challenge. Throws on any mismatch —
   * wrong owner, wrong scope, expired, already used, too many attempts,
   * wrong code. Callers must call this BEFORE touching any other state. */
  async verify(
    actor: AuthenticatedUser,
    challengeId: string,
    code: string,
    scope: StepUpScope,
  ): Promise<void> {
    const challenge = await this.prisma.twoFactorChallenge.findUnique({
      where: { id: challengeId },
    });

    if (
      !challenge ||
      challenge.purpose !== 'STEP_UP_VERIFICATION' ||
      challenge.userId !== actor.id ||
      challenge.scope !== scope
    ) {
      throw new UnauthorizedException({
        code: 'TWO_FACTOR_INVALID',
        message: 'کد تأیید نامعتبر است.',
      });
    }
    if (challenge.consumedAt) {
      throw new UnauthorizedException({
        code: 'TWO_FACTOR_INVALID',
        message: 'این کد قبلاً استفاده شده است.',
      });
    }
    if (challenge.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'TWO_FACTOR_EXPIRED',
        message: 'کد منقضی شده است.',
      });
    }
    if (challenge.attempts >= STEP_UP_MAX_ATTEMPTS) {
      throw new UnauthorizedException({
        code: 'TWO_FACTOR_INVALID',
        message: 'تعداد تلاش‌های مجاز به پایان رسید.',
      });
    }

    const codeValid = await argon2.verify(challenge.codeHash, code);
    if (!codeValid) {
      await this.prisma.twoFactorChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException({
        code: 'TWO_FACTOR_INVALID',
        message: 'کد وارد شده نادرست است.',
      });
    }

    await this.prisma.twoFactorChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SECURITY',
      action: 'تأیید step-up برای عملیات حساس',
      detail: `${actor.fullName} با تأیید مجدد هویت، عملیات ${scope} را احراز کرد.`,
      entityType: 'TwoFactorChallenge',
      entityId: challenge.id,
    });
  }
}

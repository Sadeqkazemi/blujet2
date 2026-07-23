import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/errors';
import {
  decryptPii,
  encryptPii,
  hashPii,
  isValidIranianNationalId,
} from '../../common/pii-crypto';
import { TWO_FACTOR_PROVIDER } from '../auth/providers/two-factor-provider.interface';
import type { TwoFactorProvider } from '../auth/providers/two-factor-provider.interface';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { User } from '../../../generated/prisma/client';
import type { UpdateProfileDto } from './dto/profile.dtos';

function generateSixDigitCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

const EMAIL_VERIFY_TTL_MS = 2 * 60 * 1000;
const EMAIL_VERIFY_MAX_ATTEMPTS = 5;

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TWO_FACTOR_PROVIDER)
    private readonly twoFactorProvider: TwoFactorProvider,
  ) {}

  private shape(user: User) {
    const fields = [
      user.fullName,
      user.nationalIdEnc,
      user.birthDate,
      user.passportNoEnc,
      user.emailVerifiedAt,
    ];
    const completionPct = Math.round(
      (fields.filter((f) => f !== null && f !== undefined).length /
        fields.length) *
        100,
    );
    return {
      fullName: user.fullName,
      nationalId: user.nationalIdEnc ? decryptPii(user.nationalIdEnc) : null,
      birthDate: user.birthDate,
      passportNo: user.passportNoEnc ? decryptPii(user.passportNoEnc) : null,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      completionPct,
    };
  }

  async getProfile(actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
    });
    return this.shape(user);
  }

  async updateProfile(actor: AuthenticatedUser, dto: UpdateProfileDto) {
    const data: {
      fullName?: string;
      birthDate?: Date;
      nationalIdEnc?: string;
      nationalIdHash?: string;
      passportNoEnc?: string;
    } = {};

    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.birthDate !== undefined) data.birthDate = new Date(dto.birthDate);
    if (dto.nationalId !== undefined) {
      if (!isValidIranianNationalId(dto.nationalId)) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'کد ملی نامعتبر است.',
        });
      }
      data.nationalIdEnc = encryptPii(dto.nationalId);
      data.nationalIdHash = hashPii(dto.nationalId);
    }
    if (dto.passportNo !== undefined) {
      data.passportNoEnc = encryptPii(dto.passportNo);
    }

    const user = await this.prisma.user.update({
      where: { id: actor.id },
      data,
    });
    return this.shape(user);
  }

  async requestEmailVerify(
    actor: AuthenticatedUser,
  ): Promise<{ challengeId: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
    });
    if (!user.email) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'ابتدا ایمیل خود را ثبت کنید.',
      });
    }

    const code = generateSixDigitCode();
    const challenge = await this.prisma.twoFactorChallenge.create({
      data: {
        userId: actor.id,
        purpose: 'EMAIL_VERIFY',
        codeHash: await argon2.hash(code),
        expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
      },
    });
    await this.twoFactorProvider.sendCode(
      { id: user.id, fullName: user.fullName, email: user.email, phone: null },
      code,
    );
    return { challengeId: challenge.id };
  }

  async verifyEmail(
    actor: AuthenticatedUser,
    challengeId: string,
    code: string,
  ): Promise<{ verified: true }> {
    const challenge = await this.prisma.twoFactorChallenge.findUnique({
      where: { id: challengeId },
    });
    if (
      !challenge ||
      challenge.purpose !== 'EMAIL_VERIFY' ||
      challenge.userId !== actor.id
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
    if (challenge.attempts >= EMAIL_VERIFY_MAX_ATTEMPTS) {
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
    await this.prisma.user.update({
      where: { id: actor.id },
      data: { emailVerifiedAt: new Date() },
    });

    return { verified: true };
  }
}

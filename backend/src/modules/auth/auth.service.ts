import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/errors';
import { TWO_FACTOR_PROVIDER } from './providers/two-factor-provider.interface';
import type { TwoFactorProvider } from './providers/two-factor-provider.interface';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

const TWO_FACTOR_TTL_MS = 2 * 60 * 1000;
const TWO_FACTOR_MAX_ATTEMPTS = 5;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const STAFF_ROLES = [
  'EMPLOYEE',
  'IT_MANAGER',
  'COMMERCIAL_MANAGER',
  'FINANCE_MANAGER',
  'SENIOR_MANAGER',
  'CEO',
  'BOARD_CHAIR',
  'SITE_ADMIN',
] as const;

function generateSixDigitCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(TWO_FACTOR_PROVIDER)
    private readonly twoFactorProvider: TwoFactorProvider,
  ) {}

  async staffLogin(
    username: string,
    password: string,
  ): Promise<{ challengeId: string }> {
    const user = await this.prisma.user.findUnique({ where: { username } });

    if (
      !user ||
      !STAFF_ROLES.includes(user.role as (typeof STAFF_ROLES)[number]) ||
      !user.passwordHash
    ) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'نام کاربری یا رمز عبور نادرست است.',
      });
    }
    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'این حساب مسدود شده است.',
      });
    }

    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'نام کاربری یا رمز عبور نادرست است.',
      });
    }

    const code = generateSixDigitCode();
    const challenge = await this.prisma.twoFactorChallenge.create({
      data: {
        userId: user.id,
        purpose: 'STAFF_LOGIN_2FA',
        codeHash: await argon2.hash(code),
        expiresAt: new Date(Date.now() + TWO_FACTOR_TTL_MS),
      },
    });

    await this.twoFactorProvider.sendCode(user, code);

    return { challengeId: challenge.id };
  }

  async verifyTwoFactor(
    challengeId: string,
    code: string,
    context: { userAgent?: string; ip?: string },
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthenticatedUser;
  }> {
    const challenge = await this.prisma.twoFactorChallenge.findUnique({
      where: { id: challengeId },
      include: { user: true },
    });

    if (!challenge || challenge.purpose !== 'STAFF_LOGIN_2FA') {
      throw new UnauthorizedException({
        code: 'TWO_FACTOR_INVALID',
        message: 'کد نامعتبر است.',
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
    if (challenge.attempts >= TWO_FACTOR_MAX_ATTEMPTS) {
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
      where: { id: challenge.userId },
      data: { lastLoginAt: new Date() },
    });

    const user = challenge.user;
    const authUser: AuthenticatedUser = {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
    };
    const accessToken = this.signAccessToken(authUser);
    const refreshToken = await this.issueRefreshToken(user.id, context);

    return { accessToken, refreshToken, user: authUser };
  }

  async refresh(
    presentedToken: string,
    context: { userAgent?: string; ip?: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = hashToken(presentedToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'نشست شما منقضی شده است.',
      });
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const accessToken = this.signAccessToken({
      id: stored.user.id,
      role: stored.user.role,
      fullName: stored.user.fullName,
    });
    const refreshToken = await this.issueRefreshToken(stored.userId, context);

    return { accessToken, refreshToken };
  }

  async logout(presentedToken: string): Promise<void> {
    const tokenHash = hashToken(presentedToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Non-production only: lets Playwright E2E runs read back the mock 2FA
   * code instead of receiving a real SMS/email. Always 404s in production
   * (enforced here AND by the controller, belt-and-braces).
   */
  async getLastCodeForE2e(username: string): Promise<string | null> {
    if (
      process.env.NODE_ENV === 'production' ||
      !this.twoFactorProvider.getLastCode
    )
      return null;
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) return null;
    return this.twoFactorProvider.getLastCode(user.id) ?? null;
  }

  private signAccessToken(user: AuthenticatedUser): string {
    return this.jwt.sign(
      { sub: user.id, role: user.role, fullName: user.fullName },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TOKEN_TTL },
    );
  }

  private async issueRefreshToken(
    userId: string,
    context: { userAgent?: string; ip?: string },
  ): Promise<string> {
    const token = crypto.randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        userAgent: context.userAgent,
        ip: context.ip,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return token;
  }
}

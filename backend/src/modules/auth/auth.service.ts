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
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import { hashRefreshToken } from './auth-token.util';
import { TWO_FACTOR_PROVIDER } from './providers/two-factor-provider.interface';
import type { TwoFactorProvider } from './providers/two-factor-provider.interface';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CustomerReferralsService } from '../customer-referrals/customer-referrals.service';
import type { Locale, Role } from '../../../generated/prisma/enums';

export interface AuthUserView {
  id: string;
  fullName: string;
  role: Role;
  preferredLocale: Locale;
  mustChangePassword: boolean;
}

function toAuthUserView(user: {
  id: string;
  fullName: string;
  role: Role;
  preferredLocale: Locale;
  mustChangePassword: boolean;
}): AuthUserView {
  return {
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    preferredLocale: user.preferredLocale,
    mustChangePassword: user.mustChangePassword,
  };
}

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
  return hashRefreshToken(token);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    @Inject(TWO_FACTOR_PROVIDER)
    private readonly twoFactorProvider: TwoFactorProvider,
    private readonly customerReferrals: CustomerReferralsService,
  ) {}

  /** Phase 12 «تغییر رمز عبور من» — the current password must verify before
   * anything changes; no password material is ever logged. */
  async changeOwnPassword(
    actor: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
    });
    if (
      !user.passwordHash ||
      !(await argon2.verify(user.passwordHash, currentPassword))
    ) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'رمز عبور فعلی نادرست است.',
      });
    }

    await this.prisma.user.update({
      where: { id: actor.id },
      data: {
        passwordHash: await argon2.hash(newPassword),
        mustChangePassword: false,
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SECURITY',
      action: 'تغییر رمز عبور حساب خود',
      detail: `${actor.fullName} رمز عبور حساب خود را تغییر داد.`,
      entityType: 'User',
      entityId: actor.id,
    });
  }

  /** GET /auth/me does a fresh DB read (not a bare JWT-payload echo) so
   * `preferredLocale` — which the user can change far more often than a
   * short-lived access token gets refreshed — is never stale. */
  async getMe(actor: AuthenticatedUser): Promise<AuthUserView> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: {
        id: true,
        fullName: true,
        role: true,
        preferredLocale: true,
        mustChangePassword: true,
      },
    });
    return toAuthUserView(user);
  }

  /** Display-language preference — the DB row is only the cross-device sync
   * point for a logged-in USER/AGENCY; an anonymous visitor's choice lives
   * in localStorage until they log in (see docs/API.md). Meaningful for any
   * role technically, but only USER/AGENCY frontends expose the switcher —
   * staff panels stay Persian-only, per the design refresh's scope. Not
   * audited: a display preference isn't a security/financial/admin event. */
  async updateLocale(
    actor: AuthenticatedUser,
    locale: 'FA' | 'EN' | 'AR',
  ): Promise<{ preferredLocale: 'FA' | 'EN' | 'AR' }> {
    const updated = await this.prisma.user.update({
      where: { id: actor.id },
      data: { preferredLocale: locale },
      select: { preferredLocale: true },
    });
    return updated;
  }

  /** فراموشی رمز — the caller already proved phone ownership via
   * POST /auth/otp/verify (issuing the JWT this endpoint requires), so no
   * current-password check applies here, unlike changeOwnPassword above.
   * Also doubles as "set a password for the first time" for a customer who
   * only ever logged in via OTP — CLAUDE.md's email+password is optional,
   * bootstrapped through this same OTP-verified flow rather than a
   * separate signup step. `@Roles('USER')` at the controller keeps this
   * from ever being reachable for a staff/agency token. */
  async setOwnPassword(
    actor: AuthenticatedUser,
    newPassword: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: actor.id },
      data: { passwordHash: await argon2.hash(newPassword) },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SECURITY',
      action: 'تعیین/بازنشانی رمز عبور مشتری',
      detail: `${actor.fullName} رمز عبور حساب خود را از طریق تأیید OTP تعیین کرد.`,
      entityType: 'User',
      entityId: actor.id,
    });
  }

  /** ورود مشتری با موبایل+رمز — the optional secondary login method
   * alongside phone+OTP; no 2FA (customers aren't staff). */
  async customerPasswordLogin(
    phone: string,
    password: string,
    context: { userAgent?: string; ip?: string },
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUserView;
  }> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || user.role !== 'USER' || !user.passwordHash) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'شماره موبایل یا رمز عبور نادرست است.',
      });
    }
    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'این حساب مسدود شده است.',
      });
    }
    if (!(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'شماره موبایل یا رمز عبور نادرست است.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const jwtUser: AuthenticatedUser = {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
    };
    const accessToken = this.signAccessToken(jwtUser);
    const refreshToken = await this.issueRefreshToken(user.id, context);

    return { accessToken, refreshToken, user: toAuthUserView(user) };
  }

  /**
   * فراموشی رمز — email path (Phase 51). An alternative to phone+SMS OTP
   * for customers whose account has a VERIFIED email (Phase 17's
   * emailVerifiedAt) — real functionality, not gated by display locale,
   * since restricting a security recovery path by UI language would be an
   * arbitrary and fragile restriction; some fa-locale customers may also
   * lack a reachable Iranian phone at reset time and some en/ar-locale
   * customers may have one. Deliberately does NOT upsert/create an
   * account the way requestOtp does — inventing an account for an
   * arbitrary submitted email would let anyone probe/claim an address
   * that isn't theirs.
   */
  async requestPasswordResetEmail(
    email: string,
  ): Promise<{ challengeId: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email, role: 'USER', emailVerifiedAt: { not: null } },
    });
    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCode.NOT_FOUND,
        message: 'حساب کاربری با ایمیل تأییدشدهٔ داده‌شده یافت نشد.',
      });
    }
    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'این حساب مسدود شده است.',
      });
    }

    const code = generateSixDigitCode();
    const challenge = await this.prisma.twoFactorChallenge.create({
      data: {
        userId: user.id,
        purpose: 'PASSWORD_RESET_EMAIL',
        codeHash: await argon2.hash(code),
        expiresAt: new Date(Date.now() + TWO_FACTOR_TTL_MS),
      },
    });
    await this.twoFactorProvider.sendCode(
      { id: user.id, fullName: user.fullName, email: user.email, phone: null },
      code,
    );

    return { challengeId: challenge.id };
  }

  /** Verifies the emailed reset code and logs the customer in — same
   * trust handoff as verifyOtp, so the frontend can immediately call the
   * existing POST /auth/set-password with no current-password check. */
  async verifyPasswordResetEmail(
    challengeId: string,
    code: string,
    context: { userAgent?: string; ip?: string },
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUserView;
  }> {
    const challenge = await this.prisma.twoFactorChallenge.findUnique({
      where: { id: challengeId },
      include: { user: true },
    });

    if (!challenge || challenge.purpose !== 'PASSWORD_RESET_EMAIL') {
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
    const jwtUser: AuthenticatedUser = {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
    };
    const accessToken = this.signAccessToken(jwtUser);
    const refreshToken = await this.issueRefreshToken(user.id, context);

    return { accessToken, refreshToken, user: toAuthUserView(user) };
  }

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
    user: AuthUserView;
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
    const jwtUser: AuthenticatedUser = {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
    };
    const accessToken = this.signAccessToken(jwtUser);
    const refreshToken = await this.issueRefreshToken(user.id, context);

    return { accessToken, refreshToken, user: toAuthUserView(user) };
  }

  /** Agency Portal login: phone+password, no 2FA step (unlike staff login) —
   * the design's آژانس همکار tab shows no 2FA anywhere. See docs/API.md ⚑. */
  async agencyLogin(
    phone: string,
    password: string,
    context: { userAgent?: string; ip?: string },
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUserView;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { agencyProfile: true },
    });

    if (
      !user ||
      user.role !== 'AGENCY' ||
      !user.passwordHash ||
      !(await argon2.verify(user.passwordHash, password))
    ) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'شماره تماس یا رمز عبور نادرست است.',
      });
    }
    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'این حساب غیرفعال شده است.',
      });
    }
    if (user.agencyProfile?.suspendedAt) {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'حساب آژانس شما تعلیق شده است.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const jwtUser: AuthenticatedUser = {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
    };
    const accessToken = this.signAccessToken(jwtUser);
    const refreshToken = await this.issueRefreshToken(user.id, context);

    return { accessToken, refreshToken, user: toAuthUserView(user) };
  }

  /** Public purchase engine: customer phone+OTP login (design's ورود و
   * ثبت‌نام — primary auth, no password). Find-or-create keeps this a
   * single step for first-time buyers, matching the design's single phone
   * field with no separate registration form. */
  async requestOtp(
    phone: string,
    referralCode?: string,
  ): Promise<{ challengeId: string }> {
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { role: 'USER', phone, fullName: phone },
    });
    if (!existing) {
      await this.customerReferrals.applyOnSignup(user.id, referralCode);
    }
    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'این حساب مسدود شده است.',
      });
    }

    const code = generateSixDigitCode();
    const challenge = await this.prisma.twoFactorChallenge.create({
      data: {
        userId: user.id,
        purpose: 'CUSTOMER_OTP_LOGIN',
        codeHash: await argon2.hash(code),
        expiresAt: new Date(Date.now() + TWO_FACTOR_TTL_MS),
      },
    });

    await this.twoFactorProvider.sendCode(user, code);

    return { challengeId: challenge.id };
  }

  async verifyOtp(
    challengeId: string,
    code: string,
    context: { userAgent?: string; ip?: string },
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUserView;
  }> {
    const challenge = await this.prisma.twoFactorChallenge.findUnique({
      where: { id: challengeId },
      include: { user: true },
    });

    if (!challenge || challenge.purpose !== 'CUSTOMER_OTP_LOGIN') {
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
    const jwtUser: AuthenticatedUser = {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
    };
    const accessToken = this.signAccessToken(jwtUser);
    const refreshToken = await this.issueRefreshToken(user.id, context);

    return { accessToken, refreshToken, user: toAuthUserView(user) };
  }

  /** Agency forgot-password: SMS OTP to the agency account's registered phone. */
  async requestAgencyPasswordReset(
    phone: string,
  ): Promise<{ challengeId: string }> {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { agencyProfile: true },
    });
    if (
      !user ||
      user.role !== 'AGENCY' ||
      !user.isActive ||
      user.agencyProfile?.suspendedAt
    ) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'شماره تماس یافت نشد.',
      });
    }

    const code = generateSixDigitCode();
    const challenge = await this.prisma.twoFactorChallenge.create({
      data: {
        userId: user.id,
        purpose: 'AGENCY_PASSWORD_RESET',
        codeHash: await argon2.hash(code),
        expiresAt: new Date(Date.now() + TWO_FACTOR_TTL_MS),
      },
    });
    await this.twoFactorProvider.sendCode(user, code);
    return { challengeId: challenge.id };
  }

  async verifyAgencyPasswordResetOtp(
    challengeId: string,
    code: string,
    context: { userAgent?: string; ip?: string },
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUserView;
  }> {
    const challenge = await this.prisma.twoFactorChallenge.findUnique({
      where: { id: challengeId },
      include: { user: { include: { agencyProfile: true } } },
    });
    if (!challenge || challenge.purpose !== 'AGENCY_PASSWORD_RESET') {
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

    const user = challenge.user;
    const jwtUser: AuthenticatedUser = {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
    };
    const accessToken = this.signAccessToken(jwtUser);
    const refreshToken = await this.issueRefreshToken(user.id, context);
    return { accessToken, refreshToken, user: toAuthUserView(user) };
  }

  /**
   * Non-production only: reads back the mock password-reset-email code —
   * same escape hatch as getLastOtpForE2e, keyed by email. 404s in prod.
   */
  async getLastPasswordResetEmailCodeForE2e(
    email: string,
  ): Promise<string | null> {
    if (
      process.env.NODE_ENV === 'production' ||
      !this.twoFactorProvider.getLastCode
    )
      return null;
    const user = await this.prisma.user.findFirst({ where: { email } });
    if (!user) return null;
    return this.twoFactorProvider.getLastCode(user.id) ?? null;
  }

  /**
   * Non-production only: reads back the mock OTP code — same escape hatch
   * as staff 2FA's getLastCodeForE2e, keyed by phone instead of username.
   * Always 404s in production.
   */
  async getLastOtpForE2e(phone: string): Promise<string | null> {
    if (
      process.env.NODE_ENV === 'production' ||
      !this.twoFactorProvider.getLastCode
    )
      return null;
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) return null;
    return this.twoFactorProvider.getLastCode(user.id) ?? null;
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

    if (!stored) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'نشست شما منقضی شده است.',
      });
    }

    // A REVOKED token being presented again — as opposed to one that simply
    // expired — means the token was already rotated away by a legitimate
    // refresh (or logout) and is now being replayed by someone else who
    // captured it. That is a theft signal, not routine expiry: revoke the
    // user's entire refresh-token family so a stolen token can't keep
    // rotating forever, and force a real re-login everywhere.
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({
        actorId: stored.userId,
        actorRole: stored.user.role,
        category: 'SECURITY',
        action: 'شناسایی سرقت نشست (refresh token reuse)',
        detail: `یک refresh token باطل‌شده دوباره ارسال شد؛ همه نشست‌های فعال این کاربر باطل شدند.${context.ip ? ` IP: ${context.ip}` : ''}`,
        entityType: 'User',
        entityId: stored.userId,
      });
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'نشست شما به دلایل امنیتی باطل شد. دوباره وارد شوید.',
      });
    }

    if (stored.expiresAt < new Date()) {
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

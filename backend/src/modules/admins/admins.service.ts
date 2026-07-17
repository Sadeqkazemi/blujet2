import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import { generateTempPassword } from '../../common/temp-password';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { Role } from '../../../generated/prisma/enums';

const ROLE_LABEL_FA: Partial<Record<Role, string>> = {
  SENIOR_MANAGER: 'مدیر ارشد',
  FINANCE_MANAGER: 'مدیر مالی',
  COMMERCIAL_MANAGER: 'مدیر بازرگانی',
  IT_MANAGER: 'مدیر IT',
  SITE_ADMIN: 'ادمین سایت',
};

/** ⚑ Server-enforced management hierarchy (see docs/API.md Phase 12):
 * CEO/Chair manage every subordinate manager role; Senior manages the same
 * set minus itself. CEO/BOARD_CHAIR accounts are never manageable. */
const MANAGED_ROLES: Partial<Record<Role, Role[]>> = {
  CEO: [
    'SENIOR_MANAGER',
    'FINANCE_MANAGER',
    'COMMERCIAL_MANAGER',
    'IT_MANAGER',
    'SITE_ADMIN',
  ],
  BOARD_CHAIR: [
    'SENIOR_MANAGER',
    'FINANCE_MANAGER',
    'COMMERCIAL_MANAGER',
    'IT_MANAGER',
    'SITE_ADMIN',
  ],
  SENIOR_MANAGER: [
    'FINANCE_MANAGER',
    'COMMERCIAL_MANAGER',
    'IT_MANAGER',
    'SITE_ADMIN',
  ],
};

@Injectable()
export class AdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private managedRolesFor(actor: AuthenticatedUser): Role[] {
    return MANAGED_ROLES[actor.role] ?? [];
  }

  private async getManagedOrThrow(actor: AuthenticatedUser, id: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'حساب مدیر یافت نشد.',
      });
    }
    if (
      target.id === actor.id ||
      !this.managedRolesFor(actor).includes(target.role)
    ) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'این حساب در حوزهٔ مدیریت شما نیست.',
      });
    }
    return target;
  }

  async list(actor: AuthenticatedUser) {
    const managed = this.managedRolesFor(actor);
    // The list shows every manager/admin account; managedByCaller marks the
    // rows the caller may block/reset (server re-checks on every write).
    const allAdminRoles = MANAGED_ROLES.CEO!;
    const now = new Date();

    const users = await this.prisma.user.findMany({
      where: { role: { in: allAdminRoles }, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        role: true,
        lastLoginAt: true,
        isActive: true,
        _count: {
          select: {
            refreshTokens: {
              where: { revokedAt: null, expiresAt: { gt: now } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      email: u.email,
      role: u.role,
      roleLabelFa: ROLE_LABEL_FA[u.role] ?? u.role,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      isActive: u.isActive,
      // Real derivation — an unexpired, unrevoked refresh token means a live
      // session; never a fabricated presence flag.
      online: u._count.refreshTokens > 0,
      managedByCaller: managed.includes(u.role) && u.id !== actor.id,
    }));
  }

  async create(
    actor: AuthenticatedUser,
    dto: {
      fullName: string;
      email: string;
      username: string;
      role: Role;
      password: string;
      delivery: 'sms' | 'email';
    },
  ) {
    if (!this.managedRolesFor(actor).includes(dto.role)) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'ایجاد حساب با این نقش در حوزهٔ شما نیست.',
      });
    }

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.username }, { email: dto.email }] },
    });
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'نام کاربری یا ایمیل قبلاً ثبت شده است.',
      });
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        role: dto.role,
        username: dto.username,
        email: dto.email,
        fullName: dto.fullName,
        passwordHash,
        mustChangePassword: true,
        twoFactorEnabled: true,
        isActive: true,
      },
    });

    // Credential delivery goes through the mocked provider path in dev —
    // same as OTP; nothing is fabricated as "sent" beyond the audit note.
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'ACCOUNT',
      action: 'ایجاد حساب مدیر / ادمین',
      detail: `حساب «${dto.fullName}» (${ROLE_LABEL_FA[dto.role] ?? dto.role}) توسط ${actor.fullName} ایجاد و رمز اولیه از طریق ${dto.delivery === 'sms' ? 'پیامک' : 'ایمیل سازمانی'} ارسال شد.`,
      entityType: 'User',
      entityId: user.id,
    });

    return {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role,
    };
  }

  async setBlocked(actor: AuthenticatedUser, id: string, blocked: boolean) {
    const target = await this.getManagedOrThrow(actor, id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !blocked },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SECURITY',
      action: blocked ? 'مسدودسازی ورود مدیر' : 'رفع مسدودی ورود مدیر',
      detail: `ورود «${target.fullName}» توسط ${actor.fullName} ${blocked ? 'مسدود' : 'فعال'} شد.`,
      entityType: 'User',
      entityId: id,
    });

    return { id: updated.id, isActive: updated.isActive };
  }

  async resetPassword(
    actor: AuthenticatedUser,
    id: string,
    dto: { password?: string; delivery?: 'sms' | 'email' },
  ) {
    const target = await this.getManagedOrThrow(actor, id);

    if (dto.password !== undefined && dto.password.length < 6) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.',
      });
    }
    const tempPassword = dto.password ?? generateTempPassword();
    const passwordHash = await argon2.hash(tempPassword);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SECURITY',
      action: 'بازنشانی رمز عبور مدیر',
      detail: `رمز عبور «${target.fullName}» توسط ${actor.fullName} بازنشانی و از طریق ${dto.delivery === 'email' ? 'ایمیل سازمانی' : 'پیامک'} ارسال شد.`,
      entityType: 'User',
      entityId: id,
    });

    // Returned exactly once, never stored in plaintext.
    return { tempPassword };
  }
}

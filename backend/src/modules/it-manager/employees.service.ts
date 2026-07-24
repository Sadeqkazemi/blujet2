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
import {
  CATALOG_DEPTS,
  PERMISSION_CATALOG,
  catalogDeptFor,
} from './permission-catalog';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type {
  CreateEmployeeDto,
  ListEmployeesQueryDto,
} from './dto/employees.dtos';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Grouped by dept -> sections -> perms, matching site-data.js's shape. */
  async catalog() {
    const rows = await this.prisma.permission.findMany({
      orderBy: [{ dept: 'asc' }, { sectionKey: 'asc' }, { key: 'asc' }],
    });
    const byDept: Record<
      string,
      Record<
        string,
        {
          sectionKey: string;
          sectionLabelFa: string;
          perms: { key: string; labelFa: string }[];
        }
      >
    > = {};
    for (const r of rows) {
      byDept[r.dept] ??= {};
      byDept[r.dept][r.sectionKey] ??= {
        sectionKey: r.sectionKey,
        sectionLabelFa: r.sectionLabelFa,
        perms: [],
      };
      byDept[r.dept][r.sectionKey].perms.push({
        key: r.key,
        labelFa: r.labelFa,
      });
    }
    return Object.fromEntries(
      Object.entries(byDept).map(([dept, sections]) => [
        dept,
        Object.values(sections),
      ]),
    );
  }

  private async getEmployeeOrThrow(id: string) {
    const employee = await this.prisma.user.findFirst({
      where: { id, role: 'EMPLOYEE' },
    });
    if (!employee) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'کارمند یافت نشد.',
      });
    }
    return employee;
  }

  /** Phase 31: an EMPLOYEE holding `us_manage` only ever reaches this
   * module scoped to their own dept — never another dept's roster.
   * `AuthenticatedUser` doesn't carry `dept` (it's not on the JWT), so
   * it's looked up fresh here, same freshness guarantee as
   * EmployeePermissionGuard's own live grant check. Returns `null` for
   * every non-EMPLOYEE role (IT_MANAGER stays unscoped). */
  private async deptScopeForEmployee(
    actor: AuthenticatedUser,
  ): Promise<string | null> {
    if (actor.role !== 'EMPLOYEE') return null;
    const self = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { dept: true },
    });
    return self.dept;
  }

  async list(actor: AuthenticatedUser, query: ListEmployeesQueryDto) {
    const employeeDept = await this.deptScopeForEmployee(actor);
    const deptFilter = employeeDept ?? query.dept;
    const employees = await this.prisma.user.findMany({
      where: {
        role: 'EMPLOYEE',
        ...(deptFilter ? { dept: deptFilter } : {}),
        ...(query.q
          ? {
              OR: [
                { fullName: { contains: query.q, mode: 'insensitive' } },
                { username: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return employees.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      username: e.username,
      dept: e.dept,
      rank: e.rank,
      isActive: e.isActive,
      lastLoginAt: e.lastLoginAt,
      createdAt: e.createdAt,
    }));
  }

  async create(actor: AuthenticatedUser, dto: CreateEmployeeDto) {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این نام کاربری قبلاً استفاده شده است.',
      });
    }

    const catalogDept = catalogDeptFor(dto.dept);
    const isKnownCatalogDept = (CATALOG_DEPTS as readonly string[]).includes(
      catalogDept,
    );
    const grantable = isKnownCatalogDept
      ? await this.prisma.permission.findMany({
          where: { dept: catalogDept, key: { in: dto.permissionKeys ?? [] } },
        })
      : [];

    const passwordHash = await argon2.hash(dto.password);
    const employee = await this.prisma.user.create({
      data: {
        role: 'EMPLOYEE',
        fullName: dto.fullName,
        username: dto.username,
        passwordHash,
        dept: dto.dept,
        rank: dto.rank,
        referralScope: dto.referralScope ?? 'MANAGERS_ONLY',
        createdById: actor.id,
        employeePermissions: {
          create: grantable.map((p) => ({
            permissionId: p.id,
            grantedById: actor.id,
          })),
        },
      },
    });

    const deptLabel: Record<string, string> = {
      commercial: 'مدیر بازرگانی',
      sales: 'مدیر بازرگانی (واحد فروش)',
      finance: 'مدیر مالی',
      it: 'مدیر IT',
    };
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'ACCOUNT',
      action: 'ایجاد حساب کارمند',
      detail: `کارمند «${dto.fullName}» (${dto.username}) توسط ${actor.fullName} ایجاد و اعلان برای ${
        deptLabel[dto.dept] ?? 'واحد سازمانی'
      } ارسال شد.`,
      entityType: 'User',
      entityId: employee.id,
    });

    return this.get(actor, employee.id);
  }

  async get(actor: AuthenticatedUser, id: string) {
    const employeeDept = await this.deptScopeForEmployee(actor);
    const employee = await this.getEmployeeOrThrow(id);
    if (employeeDept && employee.dept !== employeeDept) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'دسترسی به کارمندان واحد دیگر برای شما مجاز نیست.',
      });
    }
    const granted = await this.prisma.employeePermission.findMany({
      where: { employeeId: id },
      include: { permission: true },
    });
    const grantedKeys = new Set(granted.map((g) => g.permission.key));
    const catalogDept = catalogDeptFor(employee.dept ?? '');
    const available = PERMISSION_CATALOG.filter(
      (p) => p.dept === catalogDept && !grantedKeys.has(p.key),
    );

    return {
      id: employee.id,
      fullName: employee.fullName,
      username: employee.username,
      dept: employee.dept,
      rank: employee.rank,
      referralScope: employee.referralScope,
      isActive: employee.isActive,
      lastLoginAt: employee.lastLoginAt,
      mustChangePassword: employee.mustChangePassword,
      createdAt: employee.createdAt,
      permissions: granted.map((g) => ({
        key: g.permission.key,
        labelFa: g.permission.labelFa,
        sectionLabelFa: g.permission.sectionLabelFa,
      })),
      available: available.map((p) => ({ key: p.key, labelFa: p.labelFa })),
    };
  }

  async setStatus(actor: AuthenticatedUser, id: string, isActive: boolean) {
    const employee = await this.getEmployeeOrThrow(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'ACCOUNT',
      action: isActive ? 'فعال‌سازی حساب کارمند' : 'مسدودسازی حساب کارمند',
      detail: `حساب «${employee.fullName}» توسط ${actor.fullName} ${
        isActive ? 'فعال' : 'مسدود'
      } شد.`,
      entityType: 'User',
      entityId: id,
    });

    return { id: updated.id, isActive: updated.isActive };
  }

  async setPermission(
    actor: AuthenticatedUser,
    id: string,
    permissionKey: string,
    grant: boolean,
  ) {
    const employee = await this.getEmployeeOrThrow(id);
    const catalogDept = catalogDeptFor(employee.dept ?? '');
    const permission = await this.prisma.permission.findUnique({
      where: { dept_key: { dept: catalogDept, key: permissionKey } },
    });
    if (!permission) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'این دسترسی برای واحد سازمانی این کارمند تعریف نشده است.',
      });
    }

    if (grant) {
      await this.prisma.employeePermission.upsert({
        where: {
          employeeId_permissionId: {
            employeeId: id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          employeeId: id,
          permissionId: permission.id,
          grantedById: actor.id,
        },
      });
    } else {
      await this.prisma.employeePermission.deleteMany({
        where: { employeeId: id, permissionId: permission.id },
      });
    }

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'ACCESS',
      action: grant ? 'افزودن دسترسی کارمند' : 'حذف دسترسی کارمند',
      detail: `دسترسی «${permission.labelFa}» برای «${employee.fullName}» توسط ${actor.fullName} ${
        grant ? 'افزوده' : 'حذف'
      } شد.`,
      entityType: 'User',
      entityId: id,
    });

    return this.get(actor, id);
  }

  async resetPassword(actor: AuthenticatedUser, id: string) {
    if (actor.role === 'EMPLOYEE' && actor.id === id) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'امکان بازنشانی رمز عبور خودتان از این مسیر وجود ندارد.',
      });
    }
    const employeeDept = await this.deptScopeForEmployee(actor);
    const employee = await this.getEmployeeOrThrow(id);
    if (employeeDept && employee.dept !== employeeDept) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'دسترسی به کارمندان واحد دیگر برای شما مجاز نیست.',
      });
    }
    const tempPassword = generateTempPassword();
    const passwordHash = await argon2.hash(tempPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
      }),
      this.prisma.passwordResetEvent.create({
        data: { employeeId: id, resetById: actor.id },
      }),
    ]);

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'ACCOUNT',
      action: 'بازنشانی رمز عبور کارمند',
      detail: `رمز عبور «${employee.fullName}» توسط ${actor.fullName} بازنشانی شد.`,
      entityType: 'User',
      entityId: id,
    });

    // Plaintext temp password is returned exactly once and never stored.
    return { tempPassword };
  }
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRES_PERMISSION_KEY } from '../decorators/requires-permission.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';
import { ErrorCode } from '../errors';

/**
 * Fine-grained backstop for the shared EMPLOYEE grant on @Roles(...): a
 * method that lists 'EMPLOYEE' alongside its usual manager roles is only
 * actually reachable by an EMPLOYEE who holds one of the @RequiresPermission
 * keys declared on that same handler (granted via IT_MANAGER's permission
 * catalog — see EmployeePermission). Every other role passes straight
 * through unaffected; a handler with no @RequiresPermission also passes
 * through (RolesGuard already fully gates it).
 */
@Injectable()
export class EmployeePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || user.role !== 'EMPLOYEE') return true;

    const keys = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRES_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!keys || keys.length === 0) return true;

    const grant = await this.prisma.employeePermission.findFirst({
      where: { employeeId: user.id, permission: { key: { in: keys } } },
    });
    if (!grant) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'دسترسی شما برای این بخش توسط مدیر IT فعال نشده است.',
      });
    }
    return true;
  }
}

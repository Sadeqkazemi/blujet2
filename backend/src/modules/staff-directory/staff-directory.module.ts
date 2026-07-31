import { Injectable } from '@nestjs/common';
import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EmployeePermissionGuard } from '../../common/guards/employee-permission.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import {
  EXEC_ROLES,
  ROLE_LABELS_FA,
  STAFF_ROLES,
} from '../../common/exec-roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { Role } from '../../../generated/typeorm/enums';

@Injectable()
export class StaffDirectoryService {
  constructor(private readonly typeorm: TypeORMService) {}

  /** Active staff accounts for the transfer/refer/recipient pickers — never
   * includes customers/agencies, never includes the caller themselves.
   * EMPLOYEE callers only see exec managers (message-to-manager picker). */
  async list(excludeUserId: string, actorRole?: AuthenticatedUser['role']) {
    const roleFilter =
      actorRole === 'EMPLOYEE'
        ? { in: [...EXEC_ROLES, 'IT_MANAGER', 'SITE_ADMIN'] as Role[] }
        : { in: [...STAFF_ROLES] as Role[] };

    const users = await this.typeorm.user.findMany({
      where: {
        role: roleFilter,
        isActive: true,
        id: { not: excludeUserId },
      },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    });
    return users.map((u) => ({ ...u, roleLabelFa: ROLE_LABELS_FA[u.role] }));
  }
}

@ApiTags('staff-directory')
@Controller('staff-directory')
@UseGuards(JwtAuthGuard, RolesGuard, EmployeePermissionGuard)
@Roles(...EXEC_ROLES, 'EMPLOYEE')
export class StaffDirectoryController {
  constructor(private readonly staffDirectory: StaffDirectoryService) {}

  @Get()
  @RequiresPermission('ct_process')
  @ApiOperation({ summary: 'فهرست کارکنان فعال برای انتخاب مقصد انتقال/ارجاع' })
  async list(@CurrentUser() actor: AuthenticatedUser) {
    const data = await this.staffDirectory.list(actor.id, actor.role);
    return { success: true, data };
  }
}

@Module({
  controllers: [StaffDirectoryController],
  providers: [StaffDirectoryService],
  exports: [StaffDirectoryService],
})
export class StaffDirectoryModule {}

import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  EXEC_ROLES,
  ROLE_LABELS_FA,
  STAFF_ROLES,
} from '../../common/exec-roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@Injectable()
export class StaffDirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active staff accounts for the transfer/refer/recipient pickers — never
   * includes customers/agencies, never includes the caller themselves. */
  async list(excludeUserId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: [...STAFF_ROLES] },
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
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...EXEC_ROLES)
export class StaffDirectoryController {
  constructor(private readonly staffDirectory: StaffDirectoryService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست کارکنان فعال برای انتخاب مقصد انتقال/ارجاع' })
  async list(@CurrentUser() actor: AuthenticatedUser) {
    const data = await this.staffDirectory.list(actor.id);
    return { success: true, data };
  }
}

@Module({
  controllers: [StaffDirectoryController],
  providers: [StaffDirectoryService],
  exports: [StaffDirectoryService],
})
export class StaffDirectoryModule {}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { AuditCategory, Role } from '../../../generated/prisma/enums';

@ApiTags('audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('manager-reports')
  @Roles('CEO', 'BOARD_CHAIR', 'SENIOR_MANAGER')
  @ApiOperation({
    summary:
      'Cross-manager oversight feed — role-scoped exclusions applied server-side',
  })
  async managerReports(
    @CurrentUser() user: AuthenticatedUser,
    @Query('category') category?: AuditCategory,
    @Query('actorRole') actorRole?: Role,
    @Query('q') q?: string,
  ) {
    const data = await this.audit.managerReports(user.role, {
      category,
      actorRole,
      q,
    });
    return { success: true, data };
  }

  @Get('logs')
  @Roles('IT_MANAGER')
  @ApiOperation({ summary: "IT Manager's system event log" })
  async systemLogs() {
    const data = await this.audit.systemLogs();
    return { success: true, data };
  }
}

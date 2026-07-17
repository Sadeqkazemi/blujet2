import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { StaffReportsService } from './staff-reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

export class StaffReportsQueryDto {
  @ApiPropertyOptional({ description: 'فیلتر تب هر کارمند' })
  @IsOptional()
  @IsString()
  staffId?: string;
}

@ApiTags('staff-reports')
@Controller('staff-reports')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard)
@Roles('FINANCE_MANAGER', 'COMMERCIAL_MANAGER')
export class StaffReportsController {
  constructor(private readonly staffReports: StaffReportsService) {}

  @Get()
  @ApiOperation({
    summary:
      'گزارش عملکرد کارمندان واحد خود مدیر — فید واقعی از AuditLog، ایزوله per-dept',
  })
  async reports(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: StaffReportsQueryDto,
  ) {
    const data = await this.staffReports.reports(actor, query.staffId);
    return { success: true, data };
  }
}

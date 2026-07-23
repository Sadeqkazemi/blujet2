import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PassengerReportsService } from './passenger-reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';
import { EmployeePermissionGuard } from '../../common/guards/employee-permission.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';

export class PassengerSearchQueryDto {
  @ApiProperty({ example: 'نگار رضایی', description: 'نام مسافر یا کد ملی' })
  @IsString()
  @MinLength(2)
  q: string;
}

@ApiTags('passenger-reports')
@Controller('passenger-reports')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard, EmployeePermissionGuard)
// SITE_ADMIN: پنل ادمین سایت.dc.html's "reports" tab ("گزارش مسافران").
// EMPLOYEE: PERMISSION_CATALOG's rp_sales (commercial) / rp_finance
// (finance) — same "reports" nav tab either way (see EMPLOYEE_SECTION_NAV).
@Roles(
  'SENIOR_MANAGER',
  'FINANCE_MANAGER',
  'COMMERCIAL_MANAGER',
  'SITE_ADMIN',
  'EMPLOYEE',
)
@RequiresPermission('rp_sales', 'rp_finance')
export class PassengerReportsController {
  constructor(private readonly reports: PassengerReportsService) {}

  @Get('search')
  @ApiOperation({
    summary:
      'گزارش مسافران — جستجو با نام یا کد ملی (کد ملی همیشه ماسک‌شده برمی‌گردد)',
  })
  async search(@Query() query: PassengerSearchQueryDto) {
    const data = await this.reports.search(query.q);
    return { success: true, data };
  }
}

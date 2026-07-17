import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('passengers')
  @Roles('SENIOR_MANAGER', 'FINANCE_MANAGER', 'COMMERCIAL_MANAGER')
  @ApiOperation({
    summary: 'جستجوی مسافر — نام یا کد ملی (فقط از طریق hash) → کارت بلیط',
  })
  async passengers(@Query('q') q?: string) {
    const data = await this.reports.passengers(q);
    return { success: true, data };
  }

  @Get('staff')
  @Roles('FINANCE_MANAGER', 'COMMERCIAL_MANAGER')
  @ApiOperation({
    summary: 'گزارش عملکرد کارمندان — از AuditLog واقعی + اعلان کارمند جدید IT',
  })
  async staff() {
    const data = await this.reports.staff();
    return { success: true, data };
  }
}

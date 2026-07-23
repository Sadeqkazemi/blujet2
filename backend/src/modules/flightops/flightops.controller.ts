import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FlightopsService } from './flightops.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';
import { EmployeePermissionGuard } from '../../common/guards/employee-permission.guard';

export const FLIGHTOPS_ROLES = [
  'CEO',
  'SITE_ADMIN',
  'FINANCE_MANAGER',
  'COMMERCIAL_MANAGER',
] as const;

@ApiTags('flightops')
@Controller('flightops')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard, EmployeePermissionGuard)
@Roles(...FLIGHTOPS_ROLES)
export class FlightopsController {
  constructor(private readonly flightops: FlightopsService) {}

  @Get()
  @ApiOperation({
    summary:
      'لیست پروازها + KPI — بستن خودکار فروش و بارگذاری نیرا هنگام مطالعه اعمال می‌شود',
  })
  async list() {
    return { success: true, data: await this.flightops.list() };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'جزئیات پرواز — وضعیت نیرا + لیست کامل مسافران',
  })
  async detail(@Param('id') id: string) {
    return { success: true, data: await this.flightops.detail(id) };
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import {
  CreateEmployeeDto,
  ListEmployeesQueryDto,
  SetEmployeePermissionDto,
  SetEmployeeStatusDto,
} from './dto/employees.dtos';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('it-manager')
@Controller('it')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard)
@Roles('IT_MANAGER')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get('permissions')
  @ApiOperation({ summary: 'کاتالوگ دسترسی‌ها بر اساس واحد سازمانی' })
  async catalog() {
    return { success: true, data: await this.employees.catalog() };
  }

  @Get('employees')
  @ApiOperation({ summary: 'فهرست کارمندان — فیلتر واحد/جستجو' })
  async list(@Query() query: ListEmployeesQueryDto) {
    return { success: true, data: await this.employees.list(query) };
  }

  @Post('employees')
  @ApiOperation({ summary: 'ایجاد کارمند جدید و اعطای دسترسی‌های اولیه' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateEmployeeDto,
  ) {
    return { success: true, data: await this.employees.create(actor, dto) };
  }

  @Get('employees/:id')
  @ApiOperation({ summary: 'جزئیات کارمند + دسترسی‌های اعطاشده/قابل‌افزودن' })
  async get(@Param('id') id: string) {
    return { success: true, data: await this.employees.get(id) };
  }

  @Patch('employees/:id/status')
  @ApiOperation({ summary: 'مسدودسازی/فعال‌سازی حساب کارمند' })
  async setStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetEmployeeStatusDto,
  ) {
    return {
      success: true,
      data: await this.employees.setStatus(actor, id, dto.isActive),
    };
  }

  @Patch('employees/:id/permissions')
  @ApiOperation({ summary: 'افزودن/حذف یک دسترسی مشخص' })
  async setPermission(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetEmployeePermissionDto,
  ) {
    return {
      success: true,
      data: await this.employees.setPermission(
        actor,
        id,
        dto.permissionKey,
        dto.grant,
      ),
    };
  }

  @Post('employees/:id/reset-password')
  @ApiOperation({
    summary: 'بازنشانی رمز عبور — رمز موقت فقط یک‌بار در پاسخ برگردانده می‌شود',
  })
  async resetPassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return {
      success: true,
      data: await this.employees.resetPassword(actor, id),
    };
  }
}

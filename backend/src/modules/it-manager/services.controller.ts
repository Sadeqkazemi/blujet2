import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ItServicesService } from './services.service';
import {
  CreateExternalServiceDto,
  ToggleInternalServiceDto,
  UpdateExternalServiceDto,
} from './dto/services.dtos';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';
import { EmployeePermissionGuard } from '../../common/guards/employee-permission.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('it-manager')
@Controller('it/services')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard, EmployeePermissionGuard)
@Roles('IT_MANAGER')
export class ItServicesController {
  constructor(private readonly services: ItServicesService) {}

  // Phase 31: EMPLOYEE holding sv_control gets read-only visibility only —
  // toggling/creating/deleting/testing services (site-wide kill switches
  // and provider credentials) stays IT_MANAGER-only.
  @Get()
  @Roles('IT_MANAGER', 'EMPLOYEE')
  @RequiresPermission('sv_control')
  @ApiOperation({ summary: 'فهرست سرویس‌های داخلی و خارجی' })
  async list() {
    return { success: true, data: await this.services.list() };
  }

  @Patch('internal/:key')
  @ApiOperation({ summary: 'روشن/خاموش کردن سرویس داخلی' })
  async toggleInternal(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: ToggleInternalServiceDto,
  ) {
    return {
      success: true,
      data: await this.services.toggleInternal(actor, key, dto.enabled),
    };
  }

  @Post('external')
  @ApiOperation({ summary: 'تعریف سرویس خارجی جدید' })
  async createExternal(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateExternalServiceDto,
  ) {
    return {
      success: true,
      data: await this.services.createExternal(actor, dto),
    };
  }

  @Patch('external/:id')
  @ApiOperation({ summary: 'به‌روزرسانی سرویس خارجی' })
  async updateExternal(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateExternalServiceDto,
  ) {
    return {
      success: true,
      data: await this.services.updateExternal(actor, id, dto),
    };
  }

  @Delete('external/:id')
  @ApiOperation({ summary: 'حذف سرویس خارجی' })
  async removeExternal(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return {
      success: true,
      data: await this.services.removeExternal(actor, id),
    };
  }

  @Post('external/:id/test')
  @ApiOperation({ summary: 'تست اتصال واقعی سرویس خارجی' })
  async testExternal(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return {
      success: true,
      data: await this.services.testExternal(actor, id),
    };
  }

  @Get('sms-log')
  @ApiOperation({
    summary: 'سامانه پیامک — وضعیت، شمارنده امروز و آخرین ارسال‌ها',
  })
  async smsLog() {
    return { success: true, data: await this.services.smsLog() };
  }
}

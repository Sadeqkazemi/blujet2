import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { EmployeePermissionGuard } from '../../common/guards/employee-permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { Role } from '../../database/enums';
import { DcsService } from './dcs.service';
import {
  AcceptBaggageDto,
  BoardCouponDto,
  CheckInCouponDto,
} from './dto/dcs.dto';

const DCS_ROLES = [
  Role.OPERATIONS_MANAGER,
  Role.SITE_ADMIN,
  Role.EMPLOYEE,
] as const;

@ApiTags('dcs')
@Controller('dcs')
@UseGuards(JwtAuthGuard, RolesGuard, EmployeePermissionGuard)
@Roles(...DCS_ROLES)
export class DcsController {
  constructor(private readonly dcs: DcsService) {}

  @Get('flights')
  @RequiresPermission('op_view')
  @ApiOperation({ summary: 'فهرست عملیاتی پروازها و آمار DCS' })
  async flights() {
    return { success: true, data: await this.dcs.flights() };
  }

  @Get('flights/:id')
  @RequiresPermission('op_view')
  @ApiOperation({ summary: 'مانیفست عملیاتی پرواز بر مبنای کوپن بلیط' })
  async flight(@Param('id') id: string) {
    return { success: true, data: await this.dcs.flight(id) };
  }

  @Get('flights/:id/load-summary')
  @RequiresPermission('op_view')
  @ApiOperation({ summary: 'خلاصه بار ایمن و وضعیت آمادگی Load Control' })
  async loadSummary(@Param('id') id: string) {
    return { success: true, data: await this.dcs.loadSummary(id) };
  }

  @Post('coupons/:id/check-in')
  @RequiresPermission('op_manage')
  @ApiOperation({ summary: 'چک‌این کوپن و صدور کارت پرواز' })
  async checkIn(
    @Param('id') id: string,
    @Body() dto: CheckInCouponDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return { success: true, data: await this.dcs.checkIn(id, dto, actor) };
  }

  @Post('coupons/:id/baggage')
  @RequiresPermission('op_manage')
  @ApiOperation({ summary: 'پذیرش یک قلم بار برای کوپن چک‌این‌شده' })
  async acceptBaggage(
    @Param('id') id: string,
    @Body() dto: AcceptBaggageDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return {
      success: true,
      data: await this.dcs.acceptBaggage(id, dto, actor),
    };
  }

  @Post('coupons/:id/board')
  @RequiresPermission('op_manage')
  @ApiOperation({ summary: 'ثبت سوارشدن مسافر' })
  async board(
    @Param('id') id: string,
    @Body() dto: BoardCouponDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return { success: true, data: await this.dcs.board(id, dto, actor) };
  }
}

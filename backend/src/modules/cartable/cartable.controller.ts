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
import { CartableService } from './cartable.service';
import { ListCartableQueryDto } from './dto/list-cartable-query.dto';
import { ResolveCartableDto } from './dto/resolve-cartable.dto';
import { TransferCartableDto } from './dto/transfer-cartable.dto';
import { SendEmployeeManagerMessageDto } from './dto/send-employee-manager-message.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';
import { EmployeePermissionGuard } from '../../common/guards/employee-permission.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import { EXEC_ROLES } from '../../common/exec-roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('cartable')
@Controller('cartable')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard, EmployeePermissionGuard)
// SITE_ADMIN added here directly (not into the shared EXEC_ROLES constant,
// which also backs manager-messages/staff-directory — widening those isn't
// part of this design's siteAdmin.access list). "کارتابل من" is
// self-scoped (actor.id-filtered), so this is a safe read/act-on-own-items
// grant. EMPLOYEE is method-scoped with @RequiresPermission(ct_*).
@Roles(...EXEC_ROLES, 'IT_MANAGER', 'SITE_ADMIN')
export class CartableController {
  constructor(private readonly cartable: CartableService) {}

  @Get()
  @Roles(...EXEC_ROLES, 'IT_MANAGER', 'SITE_ADMIN', 'EMPLOYEE')
  @RequiresPermission('ct_list')
  @ApiOperation({
    summary: 'کارتابل من — فقط موارد خود کاربر + شمارنده کارت‌ها',
  })
  async list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListCartableQueryDto,
  ) {
    const data = await this.cartable.list(actor, query);
    return { success: true, data };
  }

  @Get('unread-count')
  @Roles(...EXEC_ROLES, 'IT_MANAGER', 'SITE_ADMIN', 'EMPLOYEE')
  @RequiresPermission('ct_list')
  @ApiOperation({ summary: 'شمارندهٔ موارد دیده‌نشدهٔ کارتابل من' })
  async unreadCount(@CurrentUser() actor: AuthenticatedUser) {
    const data = await this.cartable.unreadCount(actor);
    return { success: true, data };
  }

  @Get('manager-recipients')
  @Roles('EMPLOYEE')
  @RequiresPermission('ct_process')
  @ApiOperation({ summary: 'فهرست مدیران برای ارسال پیام — کارمند' })
  async managerRecipients(@CurrentUser() actor: AuthenticatedUser) {
    const data = await this.cartable.listManagerRecipients(actor);
    return { success: true, data };
  }

  @Post('manager-message')
  @Roles('EMPLOYEE')
  @RequiresPermission('ct_process')
  @ApiOperation({
    summary: 'ارسال پیام مستقیم به مدیر — تحویل در کارتابل مدیر',
  })
  async sendManagerMessage(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: SendEmployeeManagerMessageDto,
  ) {
    const data = await this.cartable.sendEmployeeManagerMessage(actor, dto);
    return { success: true, data };
  }

  @Get('manager-message/sent')
  @Roles('EMPLOYEE')
  @RequiresPermission('ct_process')
  @ApiOperation({ summary: 'پیام‌های ارسالی کارمند به مدیران' })
  async sentManagerMessages(@CurrentUser() actor: AuthenticatedUser) {
    const data = await this.cartable.listSentEmployeeManagerMessages(actor);
    return { success: true, data };
  }

  @Post('chair-permission')
  @Roles('FINANCE_MANAGER', 'COMMERCIAL_MANAGER')
  @ApiOperation({
    summary: 'درخواست مجوز از رئیس هیئت مدیره — بنر مالی/بازرگانی',
  })
  async requestChairPermission(@CurrentUser() actor: AuthenticatedUser) {
    const data = await this.cartable.requestChairPermission(actor);
    return { success: true, data };
  }

  @Get('chair-permission')
  @Roles('FINANCE_MANAGER', 'COMMERCIAL_MANAGER')
  @ApiOperation({ summary: 'وضعیت آخرین درخواست مجوز کاربر' })
  async getChairPermission(@CurrentUser() actor: AuthenticatedUser) {
    const data = await this.cartable.getChairPermission(actor);
    return { success: true, data };
  }

  // :id must be declared after every literal-segment GET above — Nest
  // matches routes in declaration order, and a wildcard segment here would
  // otherwise swallow 'unread-count', 'manager-recipients', etc.
  @Get(':id')
  @Roles(...EXEC_ROLES, 'IT_MANAGER', 'SITE_ADMIN', 'EMPLOYEE')
  @RequiresPermission('ct_list')
  @ApiOperation({
    summary:
      'جزئیات یک مورد کارتابل + تاریخچه — اولین مشاهده آن را «خوانده‌شده» می‌کند',
  })
  async getById(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.cartable.getById(actor, id);
    return { success: true, data };
  }

  @Patch(':id/approve')
  @Roles(...EXEC_ROLES, 'IT_MANAGER', 'SITE_ADMIN', 'EMPLOYEE')
  @RequiresPermission('ct_process')
  @ApiOperation({ summary: 'تأیید — نظر مدیر الزامی' })
  async approve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveCartableDto,
  ) {
    const data = await this.cartable.approve(actor, id, dto.note);
    return { success: true, data };
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'رد (دکمه «انصراف» طراحی) — نظر مدیر الزامی' })
  async reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveCartableDto,
  ) {
    const data = await this.cartable.reject(actor, id, dto.note);
    return { success: true, data };
  }

  @Patch(':id/transfer')
  @ApiOperation({
    summary: 'انتقال به مدیر دیگر — مورد جدید برای مقصد ساخته می‌شود',
  })
  async transfer(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransferCartableDto,
  ) {
    const data = await this.cartable.transfer(actor, id, dto.toId, dto.note);
    return { success: true, data };
  }
}

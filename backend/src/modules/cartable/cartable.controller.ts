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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';
import { EXEC_ROLES } from '../../common/exec-roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('cartable')
@Controller('cartable')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard)
@Roles(...EXEC_ROLES)
export class CartableController {
  constructor(private readonly cartable: CartableService) {}

  @Get()
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

  @Patch(':id/approve')
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

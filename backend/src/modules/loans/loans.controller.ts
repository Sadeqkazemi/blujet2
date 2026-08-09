import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateLoanApplicationDto, ListLoansQueryDto } from './dto/loans.dto';
import { LoansService } from './loans.service';

@ApiTags('loans')
@Controller()
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Post('me/loan-applications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  @ApiOperation({ summary: 'ایجاد درخواست وام از طریق API بانک (idempotent)' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateLoanApplicationDto,
  ) {
    const data = await this.loans.create(actor, dto);
    return { success: true, data };
  }

  @Get('me/loan-applications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  @ApiOperation({ summary: 'فهرست درخواست‌های وام کاربر' })
  async listMine(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListLoansQueryDto,
  ) {
    const data = await this.loans.listMine(
      actor,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
    return { success: true, data };
  }

  @Get('me/loan-applications/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  @ApiOperation({ summary: 'جزئیات درخواست وام کاربر' })
  async getMine(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.loans.getMine(actor, id);
    return { success: true, data };
  }

  @Post('me/loan-applications/:id/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  @ApiOperation({ summary: 'استعلام وضعیت از بانک برای درخواست کاربر' })
  async syncMine(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.loans.syncMine(actor, id);
    return { success: true, data };
  }

  @Get('admin/loan-applications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SITE_ADMIN')
  @ApiOperation({ summary: 'فهرست فقط‌خواندنی درخواست‌های وام (ادمین سایت)' })
  async listAdmin(@Query() query: ListLoansQueryDto) {
    const data = await this.loans.listAdmin(
      query.page ?? 1,
      query.pageSize ?? 20,
    );
    return { success: true, data };
  }

  @Get('admin/loan-applications/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SITE_ADMIN')
  @ApiOperation({ summary: 'جزئیات فقط‌خواندنی درخواست وام' })
  async getAdmin(@Param('id') id: string) {
    const data = await this.loans.getAdmin(id);
    return { success: true, data };
  }
}

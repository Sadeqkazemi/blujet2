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
import { Throttle } from '@nestjs/throttler';
import { SupportTicketsService } from './support-tickets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ForwardTicketDto,
  SubmitSupportTicketDto,
  UpdateTicketStatusDto,
} from './dto/support-ticket.dtos';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { SupportTicketStatus } from '../../../generated/prisma/client';

/** پشتیبانی — public ticket submission (no login), SITE_ADMIN-gated
 * review/forward/status endpoints (see docs/API.md's Phase 20 for the
 * scoped-down fields vs. the design's fuller attachment/thread version). */
@ApiTags('support-tickets')
@Controller('support-tickets')
export class SupportTicketsController {
  constructor(private readonly tickets: SupportTicketsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'ثبت تیکت پشتیبانی (بدون ورود به حساب)' })
  async submit(@Body() dto: SubmitSupportTicketDto) {
    const data = await this.tickets.submit(dto);
    return { success: true, data };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SITE_ADMIN')
  @ApiOperation({ summary: 'فهرست تیکت‌های پشتیبانی' })
  async list(
    @Query('status') status?: SupportTicketStatus,
    @Query('dept') dept?: 'SITE' | 'AGENCY',
  ) {
    const data = await this.tickets.list({ status, dept });
    return { success: true, data };
  }

  @Get('forward-targets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SITE_ADMIN')
  @ApiOperation({ summary: 'فهرست کارکنان برای انتخاب مقصد ارجاع تیکت' })
  async forwardTargets(@CurrentUser() actor: AuthenticatedUser) {
    const data = await this.tickets.forwardTargets(actor);
    return { success: true, data };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SITE_ADMIN')
  @ApiOperation({ summary: 'جزئیات تیکت پشتیبانی' })
  async detail(@Param('id') id: string) {
    const data = await this.tickets.detail(id);
    return { success: true, data };
  }

  @Patch(':id/forward')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SITE_ADMIN')
  @ApiOperation({ summary: 'ارجاع تیکت به کارمند/مدیر' })
  async forward(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ForwardTicketDto,
  ) {
    const data = await this.tickets.forward(actor, id, dto.targetUserId);
    return { success: true, data };
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SITE_ADMIN')
  @ApiOperation({ summary: 'تغییر وضعیت تیکت' })
  async updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    const data = await this.tickets.updateStatus(actor, id, dto.status);
    return { success: true, data };
  }
}

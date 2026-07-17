import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SeatmapService } from './seatmap.service';
import { LockSeatDto } from './dto/reservation.dtos';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RESERVATION_ROLES, CAN_LOCK_ROLES } from './reservation-roles';
import { PanelAccessGuard } from '../panels/panel-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('reservation')
@Controller('reservation/seatmap')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard)
@Roles(...RESERVATION_ROLES)
export class SeatmapController {
  constructor(private readonly seatmap: SeatmapService) {}

  @Get(':flightInstanceId')
  @ApiOperation({ summary: 'نقشهٔ صندلی — آزاد/بیزینس/فروخته‌شده/لاک‌شده' })
  async get(@Param('flightInstanceId') flightInstanceId: string) {
    return {
      success: true,
      data: await this.seatmap.getSeatMap(flightInstanceId),
    };
  }

  @Post(':flightInstanceId/lock')
  @Roles(...CAN_LOCK_ROLES)
  @ApiOperation({ summary: 'لاک مدیریتی صندلی — فقط نقش‌های مجاز' })
  async lock(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('flightInstanceId') flightInstanceId: string,
    @Body() dto: LockSeatDto,
  ) {
    return {
      success: true,
      data: await this.seatmap.lockSeat(actor, flightInstanceId, dto),
    };
  }

  @Patch('locks/:id/release')
  @Roles(...CAN_LOCK_ROLES)
  @ApiOperation({ summary: 'آزادسازی لاک صندلی' })
  async release(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return { success: true, data: await this.seatmap.releaseLock(actor, id) };
  }
}

import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PayBookingDto } from './dto/pay-booking.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

/** Customer-only — an OTP-authenticated USER account, never a staff/agency
 * one. Requires login (see search.controller.ts for the unauthenticated
 * browse step before this point). */
@ApiTags('bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('USER')
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'رزرو صندلی و شروع نگهداری ۱۰ دقیقه‌ای (HELD)' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const data = await this.bookings.createBooking(user, dto, idempotencyKey);
    return { success: true, data };
  }

  @Get('me')
  @ApiOperation({ summary: 'فهرست رزروهای مشتری جاری' })
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.bookings.listMine(user) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات یک رزرو با شناسه' })
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return { success: true, data: await this.bookings.getById(id, user) };
  }

  @Get('pnr/:pnr')
  @ApiOperation({ summary: 'جزئیات یک رزرو با کد PNR' })
  async getByPnr(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pnr') pnr: string,
  ) {
    return { success: true, data: await this.bookings.getByPnr(pnr, user) };
  }

  @Post(':id/pay')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'پرداخت درگاه sandbox، صدور بلیط — قیمت بلافاصله پیش از پرداخت بازبینی می‌شود',
  })
  async pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PayBookingDto,
  ) {
    const result = await this.bookings.pay(id, user, dto.confirmedPriceIrr);
    return { success: true, data: result };
  }
}

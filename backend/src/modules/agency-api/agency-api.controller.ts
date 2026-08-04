import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AgencyApiService } from './agency-api.service';
import { AgencyApiKeyGuard } from './agency-api-key.guard';
import {
  AgencyApiScopeGuard,
  RequireAgencyApiScope,
} from './agency-api-scope.guard';
import { AgencyApiContext } from './agency-api-context.decorator';
import type { AgencyApiRequestContext } from './agency-api-key.guard';
import {
  CreateAgencyBookingDto,
  IssueAgencyBookingDto,
} from '../agencies/dto/create-agency-booking.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('agency-api')
@ApiHeader({ name: 'X-Api-Key', required: true })
@Controller('agency-api/v1')
@UseGuards(AgencyApiKeyGuard, AgencyApiScopeGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class AgencyApiController {
  constructor(private readonly api: AgencyApiService) {}

  private actor(ctx: AgencyApiRequestContext): AuthenticatedUser {
    return {
      id: ctx.agencyUser.id,
      role: 'AGENCY',
      fullName: ctx.agencyUser.fullName,
    };
  }

  @Get('flights')
  @RequireAgencyApiScope('SEARCH_ONLY', 'SEARCH_BOOK', 'FULL')
  @ApiOperation({ summary: 'جستجوی پرواز — B2B' })
  async searchFlights(
    @AgencyApiContext() ctx: AgencyApiRequestContext,
    @Query('origin') origin: string,
    @Query('dest') dest: string,
    @Query('date') date: string,
  ) {
    return {
      success: true,
      data: await this.api.searchFlights(ctx, origin, dest, date),
    };
  }

  @Get('flights/:flightInstanceId/seats')
  @RequireAgencyApiScope('SEARCH_ONLY', 'SEARCH_BOOK', 'FULL')
  @ApiOperation({ summary: 'نقشه صندلی — B2B' })
  async seatMap(
    @AgencyApiContext() _ctx: AgencyApiRequestContext,
    @Param('flightInstanceId') flightInstanceId: string,
  ) {
    return {
      success: true,
      data: await this.api.seatMap(flightInstanceId),
    };
  }

  @Post('bookings')
  @RequireAgencyApiScope('SEARCH_BOOK', 'FULL')
  @ApiOperation({ summary: 'رزرو HELD — B2B' })
  async createBooking(
    @AgencyApiContext() ctx: AgencyApiRequestContext,
    @Body() dto: CreateAgencyBookingDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return {
      success: true,
      data: await this.api.createBooking(this.actor(ctx), dto, idempotencyKey),
    };
  }

  @Get('bookings/:id')
  @RequireAgencyApiScope('SEARCH_BOOK', 'FULL')
  @ApiOperation({ summary: 'جزئیات رزرو — B2B' })
  async getBooking(
    @AgencyApiContext() ctx: AgencyApiRequestContext,
    @Param('id') id: string,
  ) {
    return {
      success: true,
      data: await this.api.getBooking(this.actor(ctx), id),
    };
  }

  @Post('bookings/:id/issue')
  @RequireAgencyApiScope('SEARCH_BOOK', 'FULL')
  @ApiOperation({ summary: 'صدور بلیط از اعتبار — B2B' })
  async issueBooking(
    @AgencyApiContext() ctx: AgencyApiRequestContext,
    @Param('id') id: string,
    @Body() dto: IssueAgencyBookingDto,
  ) {
    return {
      success: true,
      data: await this.api.issueBooking(this.actor(ctx), id, dto),
    };
  }
}

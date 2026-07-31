import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { SearchService } from './search.service';
import { PriceAdvisoryService } from './price-advisory.service';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { PriceAdvisoryDto } from './dto/price-advisory.dto';

/** Fully public — no login required to browse flights, matching every
 * airline site's golden path (login only becomes necessary at booking). */
@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly priceAdvisory: PriceAdvisoryService,
  ) {}

  @Get('airports')
  @ApiOperation({ summary: 'فهرست فرودگاه‌ها برای جعبه جستجو' })
  async airports() {
    return { success: true, data: await this.search.airports() };
  }

  @Get('flights')
  @ApiOperation({ summary: 'جستجوی پرواز بین دو فرودگاه در یک روز مشخص' })
  async flights(@Query() query: SearchFlightsDto) {
    const data = await this.search.search(query.origin, query.dest, query.date);
    return { success: true, data };
  }

  @Get('price-advisory')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'رادار هوشمند قیمت — buy-now-or-wait (advisory only)',
  })
  @ApiResponse({
    status: 200,
    description:
      'available=false when ML is not ready; never changes bookable prices',
  })
  async priceAdvisoryRoute(@Query() query: PriceAdvisoryDto, @Req() req: Request) {
    const requestId = req.headers['x-request-id'];
    const data = await this.priceAdvisory.advise(
      {
        origin: query.origin,
        dest: query.dest,
        date: query.date,
        cabin: query.cabin,
      },
      typeof requestId === 'string' ? requestId : undefined,
    );
    return { success: true, data };
  }

  @Get('flights/:id/seatmap')
  @ApiOperation({ summary: 'نقشه صندلی برای انتخاب صندلی هنگام خرید' })
  async seatMap(@Param('id') id: string) {
    return { success: true, data: await this.search.seatMap(id) };
  }
}

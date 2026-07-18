import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchFlightsDto } from './dto/search-flights.dto';

/** Fully public — no login required to browse flights, matching every
 * airline site's golden path (login only becomes necessary at booking). */
@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

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

  @Get('flights/:id/seatmap')
  @ApiOperation({ summary: 'نقشه صندلی برای انتخاب صندلی هنگام خرید' })
  async seatMap(@Param('id') id: string) {
    return { success: true, data: await this.search.seatMap(id) };
  }
}

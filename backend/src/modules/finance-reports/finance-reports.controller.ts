import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';
import { FinanceReportsService } from './finance-reports.service';
import {
  FinanceFlightSearchQueryDto,
  FinanceReportExportQueryDto,
  FinanceReportQueryDto,
} from './dto/finance-report-query.dto';

@ApiTags('finance-reports')
@ApiBearerAuth()
@Controller('reporting')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard)
@Roles('FINANCE_MANAGER')
export class FinanceReportsController {
  constructor(private readonly reports: FinanceReportsService) {}

  @Get('finance-reports')
  @ApiOperation({
    summary: 'گزارش واقعی آژانس، چارتر و مشتریان برای پنل مدیر مالی',
  })
  @ApiBadRequestResponse({ description: 'فیلتر تاریخ یا دوره نامعتبر است.' })
  async report(@Query() query: FinanceReportQueryDto) {
    return { success: true, data: await this.reports.report(query) };
  }

  @Get('finance-reports/export')
  @ApiOperation({ summary: 'دانلود CSV یا Excel از گزارش فیلترشده مدیر مالی' })
  @ApiProduces('text/csv', 'application/vnd.ms-excel')
  @ApiBadRequestResponse({ description: 'فرمت یا فیلتر گزارش نامعتبر است.' })
  async export(
    @Query() query: FinanceReportExportQueryDto,
    @Res() res: Response,
  ) {
    const file = await this.reports.export(query, query.format);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="finance-report.${file.extension}"`,
    );
    res.send(file.body);
  }

  @Get('finance-flight-search')
  @ApiOperation({ summary: 'جستجوی پروازهای انجام‌شده برای گزارش مالی' })
  @ApiBadRequestResponse({ description: 'فیلتر جستجو نامعتبر است.' })
  async searchFlights(@Query() query: FinanceFlightSearchQueryDto) {
    return { success: true, data: await this.reports.searchFlights(query) };
  }

  @Get('finance-flight-search/:flightInstanceId')
  @ApiOperation({ summary: 'جزئیات فروش و بدهی آژانس‌های یک پرواز' })
  @ApiNotFoundResponse({ description: 'پرواز یافت نشد.' })
  async flightDetail(@Param('flightInstanceId', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.reports.flightDetail(id) };
  }
}

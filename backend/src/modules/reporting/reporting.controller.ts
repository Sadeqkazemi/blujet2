import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportingService } from './reporting.service';
import { SalesChartQueryDto } from './dto/sales-chart-query.dto';
import { PeriodQueryDto } from './dto/period-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';

const REPORTING_ROLES = [
  'CEO',
  'BOARD_CHAIR',
  'SENIOR_MANAGER',
  'FINANCE_MANAGER',
  'COMMERCIAL_MANAGER',
] as const;

@ApiTags('reporting')
@Controller('reporting')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard)
@Roles(...REPORTING_ROLES)
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('sales-chart')
  @ApiOperation({
    summary:
      'Channel-split sales bars, shared identically by all 6 panels dashboards',
  })
  async salesChart(@Query() query: SalesChartQueryDto) {
    const data = await this.reporting.salesChart(query.granularity, query);
    return { success: true, data };
  }

  @Get('kpis')
  @ApiOperation({
    summary:
      'Revenue/profit/cost KPI boxes — re-scopes to periodKey when provided',
  })
  async kpis(@Query() query: PeriodQueryDto) {
    const data = await this.reporting.kpis(query.granularity, query);
    return { success: true, data };
  }

  @Get('completed-flights-summary')
  @ApiOperation({
    summary:
      'Completed-flight seat stats, synced to the same period as the sales chart',
  })
  async completedFlightsSummary(@Query() query: PeriodQueryDto) {
    const data = await this.reporting.completedFlightsSummary(
      query.granularity,
      query,
    );
    return { success: true, data };
  }

  @Get('low-sales-alerts')
  @ApiOperation({ summary: 'Flights <72h out with occupancy below threshold' })
  async lowSalesAlerts() {
    const data = await this.reporting.lowSalesAlerts();
    return { success: true, data };
  }

  @Get('recent-transactions')
  @Roles('FINANCE_MANAGER')
  @ApiOperation({
    summary: 'تراکنش‌های مالی اخیر — فقط پنل مدیر مالی (per design)',
  })
  async recentTransactions() {
    const data = await this.reporting.recentTransactions();
    return { success: true, data };
  }

  @Get('revenue-mix')
  @ApiOperation({ summary: 'ترکیب درآمد بر اساس کانال فروش' })
  async revenueMix(@Query() query: PeriodQueryDto) {
    const data = await this.reporting.revenueMix(query.granularity, query);
    return { success: true, data };
  }

  @Get('agency-settlements')
  @Roles('FINANCE_MANAGER')
  @ApiOperation({
    summary: 'تسویه‌حساب آژانس‌های همکار — فقط پنل مدیر مالی (per design)',
  })
  async agencySettlements() {
    const data = await this.reporting.agencySettlements();
    return { success: true, data };
  }
}

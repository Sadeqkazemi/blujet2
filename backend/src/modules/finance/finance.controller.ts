import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { PeriodQueryDto } from '../reporting/dto/period-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

const FINANCE_TAB_ROLES = [
  'CEO',
  'BOARD_CHAIR',
  'SENIOR_MANAGER',
  'FINANCE_MANAGER',
  'COMMERCIAL_MANAGER',
] as const;

@ApiTags('finance')
@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  @Roles(...FINANCE_TAB_ROLES)
  @ApiOperation({
    summary: 'تب مالی در یک فراخوانی: KPI + خلاصه صندلی + دونات ترکیب درآمد',
  })
  async summary(@Query() query: PeriodQueryDto) {
    const data = await this.finance.summary(query.granularity, query);
    return { success: true, data };
  }

  @Get('transactions')
  @Roles('FINANCE_MANAGER')
  @ApiOperation({
    summary: 'تراکنش‌های مالی اخیر — فقط پنل مدیر مالی (طبق طراحی)',
  })
  async transactions() {
    const data = await this.finance.transactions();
    return { success: true, data };
  }

  @Get('settlements')
  @Roles('FINANCE_MANAGER')
  @ApiOperation({
    summary: 'تسویه‌حساب آژانس‌های همکار — فقط پنل مدیر مالی',
  })
  async settlements() {
    const data = await this.finance.settlements();
    return { success: true, data };
  }

  @Post('settlements/:invoiceId/remind')
  @Roles('FINANCE_MANAGER')
  @ApiOperation({ summary: 'ارسال یادآوری تسویه — از مسیر SmsProvider، audited' })
  async remind(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('invoiceId') invoiceId: string,
  ) {
    const data = await this.finance.remind(actor, invoiceId);
    return { success: true, data };
  }
}

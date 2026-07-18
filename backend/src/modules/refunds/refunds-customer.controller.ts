import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RefundsService } from './refunds.service';
import { SubmitRefundDto } from './dto/submit-refund.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

/** Public purchase engine: the customer's own submit/list/detail — kept
 * separate from RefundsController (staff-only, PanelAccessGuard-gated) so
 * a USER account never touches the staff panel-access machinery. */
@ApiTags('refunds')
@Controller('my/refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('USER')
export class RefundsCustomerController {
  constructor(private readonly refunds: RefundsService) {}

  @Post()
  @ApiOperation({
    summary: 'ثبت درخواست استرداد بلیط با ریز جریمه/مبلغ قابل استرداد',
  })
  async submit(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: SubmitRefundDto,
  ) {
    const data = await this.refunds.submitFromCustomer(actor, dto);
    return { success: true, data };
  }

  @Get()
  @ApiOperation({ summary: 'فهرست درخواست‌های استرداد مشتری جاری' })
  async listMine(@CurrentUser() actor: AuthenticatedUser) {
    return { success: true, data: await this.refunds.listMine(actor.id) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات یک درخواست استرداد مشتری' })
  async getMine(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return { success: true, data: await this.refunds.getMine(actor.id, id) };
  }
}

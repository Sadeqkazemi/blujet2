import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { ClubPointsService } from './club-points.service';
import { PriceLockService } from './price-lock.service';
import { TopupWalletDto } from './dto/topup-wallet.dto';
import { CreatePriceLockDto } from './dto/create-price-lock.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('purchase-extras')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('USER')
export class WalletPointsLockController {
  constructor(
    private readonly wallet: WalletService,
    private readonly points: ClubPointsService,
    private readonly priceLocks: PriceLockService,
  ) {}

  @Get('my/wallet')
  @ApiOperation({ summary: 'موجودی کیف پول' })
  async getWallet(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      data: { balanceIrr: await this.wallet.getBalance(user.id) },
    };
  }

  @Post('my/wallet/topup')
  @ApiOperation({ summary: 'شارژ کیف پول (درگاه sandbox)' })
  async topup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TopupWalletDto,
  ) {
    const balanceIrr = await this.wallet.topup(user.id, dto.amountIrr);
    return { success: true, data: { balanceIrr } };
  }

  @Get('my/club-points')
  @ApiOperation({ summary: 'موجودی امتیاز باشگاه مشتریان' })
  async getPoints(@CurrentUser() user: AuthenticatedUser) {
    const member = await this.points.findMemberByUserId(user.id);
    const balance = member ? await this.points.getBalance(member.id) : 0;
    return {
      success: true,
      data: { isMember: !!member, level: member?.level ?? null, balance },
    };
  }

  @Post('my/price-locks')
  @ApiOperation({ summary: 'قفل قیمت هوشمند (فقط اعضای طلایی و بالاتر)' })
  async createPriceLock(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePriceLockDto,
  ) {
    return { success: true, data: await this.priceLocks.create(user, dto) };
  }

  @Get('my/price-locks')
  @ApiOperation({ summary: 'فهرست قفل‌های قیمت من' })
  async listPriceLocks(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.priceLocks.listMine(user) };
  }

  @Delete('my/price-locks/:id')
  @ApiOperation({ summary: 'لغو قفل قیمت فعال' })
  async cancelPriceLock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return { success: true, data: await this.priceLocks.cancel(user, id) };
  }
}

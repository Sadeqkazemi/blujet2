import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

export class UpdateSettingsDto {
  @ApiProperty({
    description: 'Partial key-value patch — unknown keys are rejected',
    example: { maintenance: true },
  })
  @IsObject()
  patch: Record<string, unknown>;
}

export class RefundRuleUpdate {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  penaltyPct: number;
}

export class UpdateRefundRulesDto {
  @ApiProperty({ type: [RefundRuleUpdate] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RefundRuleUpdate)
  rules: RefundRuleUpdate[];
}

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard)
@Roles('BOARD_CHAIR', 'IT_MANAGER')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'تنظیمات سامانه + بازه‌های واقعی جریمهٔ استرداد (فاز ۷)',
  })
  async getAll() {
    return { success: true, data: await this.settings.getAll() };
  }

  @Patch()
  @ApiOperation({
    summary: 'به‌روزرسانی تنظیمات — کلیدهای ناشناخته رد می‌شوند',
  })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return {
      success: true,
      data: await this.settings.update(actor, dto.patch),
    };
  }

  @Patch('refund-rules')
  @Roles('BOARD_CHAIR')
  @ApiOperation({
    summary:
      'تغییر درصد جریمهٔ بازه‌های واقعی استرداد — همان جدولی که موتور فاز ۷ می‌خواند',
  })
  async updateRefundRules(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateRefundRulesDto,
  ) {
    return {
      success: true,
      data: await this.settings.updateRefundRules(actor, dto.rules),
    };
  }
}

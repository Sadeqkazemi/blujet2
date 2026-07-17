import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsString, Matches, Max, Min } from 'class-validator';
import type { Request } from 'express';
import { FlightsService } from './flights.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

const MAX_INT32 = 2_147_483_647;

class CreateFlightDto {
  @ApiProperty({ description: 'کد فرودگاه مبدأ', example: 'THR' })
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  originCode: string;

  @ApiProperty({ description: 'کد فرودگاه مقصد', example: 'DXB' })
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  destCode: string;

  @ApiProperty({ description: 'شماره پرواز', example: 'EP-901' })
  @IsString()
  @Matches(/^[A-Z0-9]{2}-\d{2,4}$/)
  flightNo: string;

  @ApiProperty({ description: 'زمان پرواز (UTC ISO — تبدیل جلالی در فرانت)' })
  @IsISO8601()
  departureAt: string;

  @ApiProperty({ description: 'ظرفیت صندلی', example: 180 })
  @IsInt()
  @Min(1)
  @Max(1000)
  capacity: number;

  @ApiProperty({ description: 'قیمت پایه (ریال)', example: 38_000_000 })
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  basePriceIrr: number;
}

class PlanFlightDto {
  @ApiProperty({ description: 'نرخ برنامه‌ریزی (ریال)', example: 39_000_000 })
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  priceIrr: number;

  @ApiProperty({ description: 'تخصیص صندلی آژانس', example: 60 })
  @IsInt()
  @Min(0)
  @Max(1000)
  agencySeats: number;
}

@ApiTags('flights')
@Controller('flights')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard)
@Roles('SENIOR_MANAGER', 'COMMERCIAL_MANAGER')
export class FlightsController {
  constructor(private readonly flights: FlightsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'کل تب مدیریت پروازها: KPI + فعال/انجام‌شده/آینده',
  })
  async overview() {
    const data = await this.flights.overview();
    return { success: true, data };
  }

  @Get('airports')
  @ApiOperation({ summary: 'کاتالوگ فرودگاه‌ها برای فرم افزودن پرواز' })
  async airports() {
    const data = await this.flights.airports();
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'افزودن پرواز جدید (مودال طراحی)' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateFlightDto,
  ) {
    const data = await this.flights.create(actor, dto);
    return { success: true, data };
  }

  @Post('ai-analysis')
  @ApiOperation({
    summary:
      'تحلیل قیمت‌گذاری پروازهای آینده با هوش مصنوعی — advisory، با degrade امن',
  })
  async aiAnalysis(
    @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const data = await this.flights.runAiAnalysis(
      actor,
      req.headers['x-request-id'] as string | undefined,
    );
    return { success: true, data };
  }

  @Get(':instanceId')
  @ApiOperation({
    summary: 'مودال جزئیات پرواز: تفکیک واقعی کانال فروش + مجموع درآمد',
  })
  async detail(@Param('instanceId') instanceId: string) {
    const data = await this.flights.detail(instanceId);
    return { success: true, data };
  }

  @Patch(':instanceId/plan')
  @ApiOperation({
    summary:
      'نرخ‌گذاری و تخصیص پرواز آینده — نرخ قابل فروش همچنان با تأیید مدیر عامل (فاز ۶)',
  })
  async plan(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('instanceId') instanceId: string,
    @Body() dto: PlanFlightDto,
  ) {
    const data = await this.flights.plan(actor, instanceId, dto);
    return { success: true, data };
  }
}

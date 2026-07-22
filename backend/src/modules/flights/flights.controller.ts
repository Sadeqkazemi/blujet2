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
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
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

class CreateScheduleDto {
  @ApiProperty({ description: 'کد فرودگاه مبدأ', example: 'THR' })
  @IsString()
  originCode!: string;

  @ApiProperty({ description: 'کد فرودگاه مقصد', example: 'MHD' })
  @IsString()
  destCode!: string;

  @ApiProperty({ description: 'شماره پرواز', example: 'BJ-410' })
  @Matches(/^[A-Z]{2}-\d{2,4}$/)
  flightNo!: string;

  @ApiProperty({
    description: 'الگوی تکرار RRULE (RFC 5545)',
    example: 'FREQ=WEEKLY;BYDAY=SA,MO,WE',
  })
  @IsString()
  rrule!: string;

  @ApiProperty({ description: 'ساعت حرکت (UTC)', example: '07:30' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  depTime!: string;

  @ApiProperty({ description: 'ظرفیت هر پرواز', example: 146 })
  @IsInt()
  @Min(1)
  @Max(500)
  capacity!: number;

  @ApiProperty({
    description: 'چند روز آینده از حالا ساخته شود (پیش‌فرض ۳۰)',
    example: 30,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  daysAhead?: number;
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

  @ApiProperty({
    description: 'شروع بازه فروش (UTC ISO) — خالی/حذف یعنی بدون محدودیت',
    required: false,
  })
  @IsOptional()
  @IsISO8601()
  saleStartsAt?: string;

  @ApiProperty({
    description: 'پایان بازه فروش (UTC ISO) — خالی/حذف یعنی بدون محدودیت',
    required: false,
  })
  @IsOptional()
  @IsISO8601()
  saleEndsAt?: string;
}

class ChangeAircraftTypeDto {
  @ApiProperty({ description: 'نوع هواپیمای جدید', example: 'Boeing 737' })
  @IsString()
  aircraftType: string;
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

  @Post('schedules')
  @ApiOperation({
    summary: 'ثبت برنامه تکرارشونده پرواز (RRULE) و ساخت پروازهای آینده',
  })
  async createSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScheduleDto,
  ) {
    return {
      success: true,
      data: await this.flights.createSchedule(user, dto),
    };
  }

  @Get('schedules')
  @ApiOperation({ summary: 'فهرست برنامه‌های تکرارشونده پرواز' })
  async listSchedules() {
    return { success: true, data: await this.flights.listSchedules() };
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

  @Patch(':instanceId/aircraft')
  @ApiOperation({
    summary:
      'تغییر نوع هواپیمای پرواز — رد با ۴۰۹ اگر ظرفیت جدید کمتر از رزروهای قطعی/لاک‌شده باشد',
  })
  async changeAircraft(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('instanceId') instanceId: string,
    @Body() dto: ChangeAircraftTypeDto,
  ) {
    const data = await this.flights.changeAircraftType(
      actor,
      instanceId,
      dto.aircraftType,
    );
    return { success: true, data };
  }
}

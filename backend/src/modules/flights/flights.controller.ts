import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
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
import { EmployeePermissionGuard } from '../../common/guards/employee-permission.guard';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
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

  @ApiProperty({
    description: 'از POST /auth/step-up/request (scope: PRICE_CAPACITY_CHANGE)',
  })
  @IsString()
  stepUpChallengeId: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  stepUpCode: string;
}

class CreateFareRuleDto {
  @ApiProperty({ enum: ['ECONOMY', 'BUSINESS'] })
  @IsIn(['ECONOMY', 'BUSINESS'])
  cabin: 'ECONOMY' | 'BUSINESS';

  @ApiProperty({ description: 'کد کلاس نرخی', example: 'Y' })
  @IsString()
  classCode: string;

  @ApiProperty({ description: 'قیمت (ریال)', example: 30_000_000 })
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  priceIrr: number;

  @ApiProperty({ description: 'تعداد صندلی تخصیص‌یافته', example: 20 })
  @IsInt()
  @Min(1)
  @Max(1000)
  seatsAllocated: number;

  @ApiProperty({
    description: 'مالیات/عوارض (ریال)',
    required: false,
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT32)
  taxIrr?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  refundable?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  changeable?: boolean;

  @ApiProperty({ required: false, example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  baggageAllowanceKg?: number;

  @ApiProperty({ required: false, description: 'شروع بازه اعتبار (UTC ISO)' })
  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @ApiProperty({ required: false, description: 'پایان بازه اعتبار (UTC ISO)' })
  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @ApiProperty({
    required: false,
    description: 'کانال‌های مجاز — خالی یعنی همه کانال‌ها',
    isArray: true,
    enum: ['SYSTEM', 'CHARTER', 'AGENCY'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['SYSTEM', 'CHARTER', 'AGENCY'], { each: true })
  allowedChannels?: ('SYSTEM' | 'CHARTER' | 'AGENCY')[];
}

class UpdateFareRuleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  priceIrr?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  seatsAllocated?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT32)
  taxIrr?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  refundable?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  changeable?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  baggageAllowanceKg?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @ApiProperty({
    required: false,
    isArray: true,
    enum: ['SYSTEM', 'CHARTER', 'AGENCY'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['SYSTEM', 'CHARTER', 'AGENCY'], { each: true })
  allowedChannels?: ('SYSTEM' | 'CHARTER' | 'AGENCY')[];
}

class CreateAllotmentDto {
  @ApiProperty({ description: 'شناسه کاربری آژانس' })
  @IsString()
  agencyId: string;

  @ApiProperty({ description: 'تعداد صندلی تخصیص‌یافته', example: 10 })
  @IsInt()
  @Min(1)
  @Max(1000)
  seatsAllocated: number;

  @ApiProperty({ enum: ['SOFT', 'HARD'], required: false, default: 'HARD' })
  @IsOptional()
  @IsIn(['SOFT', 'HARD'])
  type?: 'SOFT' | 'HARD';

  @ApiProperty({
    required: false,
    description: 'موعد آزادسازی خودکار (فقط برای نوع SOFT، UTC ISO)',
  })
  @IsOptional()
  @IsISO8601()
  releaseAt?: string;

  @ApiProperty({
    required: false,
    description: 'نرخ قراردادی این آژانس (ریال)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  contractPriceIrr?: number;
}

@ApiTags('flights')
@Controller('flights')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard, EmployeePermissionGuard)
@Roles('SENIOR_MANAGER', 'COMMERCIAL_MANAGER')
export class FlightsController {
  constructor(private readonly flights: FlightsService) {}

  // EMPLOYEE: PERMISSION_CATALOG's fl_view only — read-only. fl_manage
  // (create/schedule/plan/aircraft/fare-rule/allotment writes below) is
  // deliberately deferred this phase; every write endpoint stays
  // SENIOR_MANAGER/COMMERCIAL_MANAGER-only. See Phase 18 notes in
  // docs/DB_SCHEMA.md.
  @Get('overview')
  @Roles('SENIOR_MANAGER', 'COMMERCIAL_MANAGER', 'EMPLOYEE')
  @RequiresPermission('fl_view')
  @ApiOperation({
    summary: 'کل تب مدیریت پروازها: KPI + فعال/انجام‌شده/آینده',
  })
  async overview() {
    const data = await this.flights.overview();
    return { success: true, data };
  }

  @Get('airports')
  @Roles('SENIOR_MANAGER', 'COMMERCIAL_MANAGER', 'EMPLOYEE')
  @RequiresPermission('fl_view')
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
  @Roles('SENIOR_MANAGER', 'COMMERCIAL_MANAGER', 'EMPLOYEE')
  @RequiresPermission('fl_view')
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
  @Roles('SENIOR_MANAGER', 'COMMERCIAL_MANAGER', 'EMPLOYEE')
  @RequiresPermission('fl_view')
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
      dto.stepUpChallengeId,
      dto.stepUpCode,
    );
    return { success: true, data };
  }

  @Get(':instanceId/fare-rules')
  @Roles('SENIOR_MANAGER', 'COMMERCIAL_MANAGER', 'EMPLOYEE')
  @RequiresPermission('fl_view')
  @ApiOperation({ summary: 'فهرست کلاس‌های نرخی این پرواز' })
  async listFareRules(@Param('instanceId') instanceId: string) {
    const data = await this.flights.listFareRules(instanceId);
    return { success: true, data };
  }

  @Post(':instanceId/fare-rules')
  @ApiOperation({
    summary:
      'ایجاد کلاس نرخی — رد با ۴۰۰ اگر مجموع صندلی تخصیص‌یافته از ظرفیت کابین بیشتر شود',
  })
  async createFareRule(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('instanceId') instanceId: string,
    @Body() dto: CreateFareRuleDto,
  ) {
    const data = await this.flights.createFareRule(actor, instanceId, dto);
    return { success: true, data };
  }

  @Patch(':instanceId/fare-rules/:ruleId')
  @ApiOperation({ summary: 'ویرایش کلاس نرخی' })
  async updateFareRule(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('instanceId') instanceId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateFareRuleDto,
  ) {
    const data = await this.flights.updateFareRule(
      actor,
      instanceId,
      ruleId,
      dto,
    );
    return { success: true, data };
  }

  @Delete(':instanceId/fare-rules/:ruleId')
  @ApiOperation({
    summary: 'حذف کلاس نرخی — رد با ۴۰۹ اگر رزرو فعالی از آن استفاده کند',
  })
  async deleteFareRule(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('instanceId') instanceId: string,
    @Param('ruleId') ruleId: string,
  ) {
    const data = await this.flights.deleteFareRule(actor, instanceId, ruleId);
    return { success: true, data };
  }

  @Get(':instanceId/allotments')
  @Roles('SENIOR_MANAGER', 'COMMERCIAL_MANAGER', 'EMPLOYEE')
  @RequiresPermission('fl_view')
  @ApiOperation({ summary: 'فهرست سهمیه‌های آژانس این پرواز' })
  async listAllotments(@Param('instanceId') instanceId: string) {
    const data = await this.flights.listAllotments(instanceId);
    return { success: true, data };
  }

  @Post(':instanceId/allotments')
  @ApiOperation({
    summary:
      'تخصیص سهمیه به آژانس — رد با ۴۰۰ اگر مجموع سهمیه‌ها از سقف کلی آژانس‌های پرواز بیشتر شود',
  })
  async createAllotment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('instanceId') instanceId: string,
    @Body() dto: CreateAllotmentDto,
  ) {
    const data = await this.flights.createAllotment(actor, instanceId, dto);
    return { success: true, data };
  }

  @Delete(':instanceId/allotments/:allotmentId')
  @ApiOperation({
    summary: 'حذف سهمیه آژانس — رد با ۴۰۹ اگر آژانس رزرو فعالی داشته باشد',
  })
  async deleteAllotment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('instanceId') instanceId: string,
    @Param('allotmentId') allotmentId: string,
  ) {
    const data = await this.flights.deleteAllotment(
      actor,
      instanceId,
      allotmentId,
    );
    return { success: true, data };
  }
}

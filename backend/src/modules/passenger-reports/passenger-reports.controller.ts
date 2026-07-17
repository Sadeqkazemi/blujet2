import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PassengerReportsService } from './passenger-reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';

export class PassengerSearchQueryDto {
  @ApiProperty({ example: 'نگار رضایی', description: 'نام مسافر یا کد ملی' })
  @IsString()
  @MinLength(2)
  q: string;
}

@ApiTags('passenger-reports')
@Controller('passenger-reports')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard)
@Roles('SENIOR_MANAGER', 'FINANCE_MANAGER', 'COMMERCIAL_MANAGER')
export class PassengerReportsController {
  constructor(private readonly reports: PassengerReportsService) {}

  @Get('search')
  @ApiOperation({
    summary:
      'گزارش مسافران — جستجو با نام یا کد ملی (کد ملی همیشه ماسک‌شده برمی‌گردد)',
  })
  async search(@Query() query: PassengerSearchQueryDto) {
    const data = await this.reports.search(query.q);
    return { success: true, data };
  }
}

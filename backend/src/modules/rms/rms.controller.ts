import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequiresPermission } from '../../common/decorators/requires-permission.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { EmployeePermissionGuard } from '../../common/guards/employee-permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { toIrr } from '../../common/money';
import { Role } from '../../database/enums';
import { FlightsService } from '../flights/flights.service';
import { RmsRecommendationDto } from './dto/rms.dto';

@ApiTags('rms')
@Controller('rms')
@UseGuards(JwtAuthGuard, RolesGuard, EmployeePermissionGuard)
export class RmsController {
  constructor(private readonly flights: FlightsService) {}

  @Get('portfolio')
  @Roles(Role.CEO, Role.SENIOR_MANAGER, Role.COMMERCIAL_MANAGER, Role.EMPLOYEE)
  @RequiresPermission('fl_view')
  @ApiOperation({ summary: 'پرتفوی واقعی ظرفیت، فروش و درآمد پروازها' })
  async portfolio() {
    return { success: true, data: await this.flights.overview() };
  }

  @Get('flights/:id/control')
  @Roles(Role.CEO, Role.SENIOR_MANAGER, Role.COMMERCIAL_MANAGER, Role.EMPLOYEE)
  @RequiresPermission('fl_view')
  @ApiOperation({ summary: 'کنترل موجودی و درآمد در سطح کلاس نرخی و کانال' })
  async control(@Param('id') id: string) {
    return { success: true, data: await this.flights.commercialControl(id) };
  }

  @Post('flights/:id/fare-rules/:ruleId/recommendation')
  @Roles(Role.COMMERCIAL_MANAGER, Role.EMPLOYEE)
  @RequiresPermission('fl_manage', 'fl_site_sales', 'fl_agency_sales')
  @ApiOperation({ summary: 'پیشنهاد نرخ RMS؛ صرفاً مشورتی و بدون انتشار' })
  async recommendation(
    @Param('id') id: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: RmsRecommendationDto,
    @Req() request: Request,
  ) {
    return {
      success: true,
      data: await this.flights.suggestFareClassPrice(
        id,
        ruleId,
        dto.channel,
        dto.competitorPriceIrr === undefined
          ? undefined
          : toIrr(dto.competitorPriceIrr),
        request.headers['x-request-id'] as string | undefined,
      ),
    };
  }
}

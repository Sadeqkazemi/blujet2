import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  CreateTravelCostDto,
  UpdateTravelCostDto,
} from './dto/travel-cost.dtos';
import { TravelCostsService } from './travel-costs.service';

@ApiTags('travel-costs')
@Controller('travel-costs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COMMERCIAL_MANAGER')
export class TravelCostsController {
  constructor(private readonly service: TravelCostsService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست کامل هزینه‌های سفر برای مدیر بازرگانی' })
  async list() {
    return { success: true, data: await this.service.listManager() };
  }

  @Post()
  @ApiOperation({ summary: 'ثبت هزینه سفر' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateTravelCostDto,
  ) {
    return { success: true, data: await this.service.create(actor, dto) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش یا فعال/غیرفعال کردن هزینه سفر' })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTravelCostDto,
  ) {
    return { success: true, data: await this.service.update(actor, id, dto) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف هزینه سفر' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return { success: true, data: await this.service.remove(actor, id) };
  }
}

@ApiTags('public-travel-costs')
@Controller('public/travel-costs')
export class PublicTravelCostsController {
  constructor(private readonly service: TravelCostsService) {}

  @Get()
  @ApiOperation({ summary: 'هزینه‌های سفر فعال برای نمایش در سایت' })
  async list() {
    return { success: true, data: await this.service.listPublic() };
  }
}

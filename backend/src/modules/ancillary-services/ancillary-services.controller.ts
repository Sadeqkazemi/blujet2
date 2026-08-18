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
import { PanelAccessGuard } from '../panels/panel-access.guard';
import { AncillaryServicesService } from './ancillary-services.service';
import {
  CreateAncillaryServiceDto,
  UpdateAncillaryEnabledDto,
  UpdateAncillaryPriceDto,
} from './dto/ancillary-services.dtos';

@ApiTags('ancillary-services')
@Controller('ancillary-services')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard)
@Roles('COMMERCIAL_MANAGER')
export class AncillaryServicesController {
  constructor(private readonly services: AncillaryServicesService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست قیمت خدمات صندلی و خدمات جانبی' })
  async list() {
    return { success: true, data: await this.services.listManager() };
  }

  @Patch(':key/price')
  @ApiOperation({ summary: 'ثبت قیمت یک خدمت' })
  async setPrice(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: UpdateAncillaryPriceDto,
  ) {
    return {
      success: true,
      data: await this.services.setPrice(actor, key, dto.priceIrr),
    };
  }

  @Patch(':key/enabled')
  @ApiOperation({ summary: 'فعال یا غیرفعال کردن خدمت' })
  async setEnabled(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: UpdateAncillaryEnabledDto,
  ) {
    return {
      success: true,
      data: await this.services.setEnabled(actor, key, dto.enabled),
    };
  }

  @Post()
  @ApiOperation({ summary: 'افزودن خدمت سفارشی (سایر خدمات)' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateAncillaryServiceDto,
  ) {
    return {
      success: true,
      data: await this.services.createCustom(actor, dto),
    };
  }

  @Delete(':key')
  @ApiOperation({ summary: 'حذف خدمت سفارشی' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('key') key: string,
  ) {
    return {
      success: true,
      data: await this.services.removeCustom(actor, key),
    };
  }
}

@ApiTags('public-ancillary-services')
@Controller('public/ancillary-services')
export class PublicAncillaryServicesController {
  constructor(private readonly services: AncillaryServicesService) {}

  @Get()
  @ApiOperation({
    summary: 'خدمات جانبی فعال قابل نمایش به مسافر (بدون فیلدهای مدیریتی)',
  })
  async list() {
    return { success: true, data: await this.services.listPublic() };
  }
}

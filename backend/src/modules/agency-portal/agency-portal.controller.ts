import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgencyPortalService } from './agency-portal.service';
import {
  PostInboxMessageDto,
  RequestCreditIncreaseDto,
  RequestWebserviceDto,
  UploadDocumentDto,
} from './dto/agency-portal.dtos';
import { MAX_FILE_BYTES } from '../files/files.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('agency-portal')
@Controller('agency-portal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('AGENCY')
export class AgencyPortalController {
  constructor(private readonly portal: AgencyPortalService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'داشبورد خودِ آژانس — KPI + نمودار ۶ماهه + اعتبار' })
  async dashboard(@CurrentUser() actor: AuthenticatedUser) {
    return { success: true, data: await this.portal.dashboard(actor) };
  }

  @Get('credit')
  @ApiOperation({ summary: 'سقف/مصرف/باقیمانده اعتبار خودِ آژانس' })
  async credit(@CurrentUser() actor: AuthenticatedUser) {
    return { success: true, data: await this.portal.credit(actor) };
  }

  @Get('ledger')
  @ApiOperation({ summary: 'گردش حساب اخیر' })
  async ledger(@CurrentUser() actor: AuthenticatedUser) {
    return { success: true, data: await this.portal.ledger(actor) };
  }

  @Get('invoices')
  @ApiOperation({ summary: 'فاکتورهای خودِ آژانس' })
  async invoices(@CurrentUser() actor: AuthenticatedUser) {
    return { success: true, data: await this.portal.invoices(actor) };
  }

  @Post('invoices/:invoiceId/pay')
  @ApiOperation({
    summary: 'پرداخت فاکتور از اعتبار — همان مسیر تراکنشی سمت کارمند',
  })
  async payInvoice(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('invoiceId') invoiceId: string,
  ) {
    return {
      success: true,
      data: await this.portal.payInvoice(actor, invoiceId),
    };
  }

  @Post('credit-requests')
  @ApiOperation({
    summary: 'درخواست افزایش اعتبار — مستقیماً سقف را تغییر نمی‌دهد',
  })
  async requestCreditIncrease(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RequestCreditIncreaseDto,
  ) {
    return {
      success: true,
      data: await this.portal.requestCreditIncrease(actor, dto),
    };
  }

  @Get('credit-requests')
  @ApiOperation({ summary: 'تاریخچه درخواست‌های افزایش اعتبار خودِ آژانس' })
  async myCreditRequests(@CurrentUser() actor: AuthenticatedUser) {
    return { success: true, data: await this.portal.myCreditRequests(actor) };
  }

  @Get('sales')
  @ApiOperation({ summary: 'فروش و گزارش خودِ آژانس' })
  async sales(@CurrentUser() actor: AuthenticatedUser) {
    return { success: true, data: await this.portal.sales(actor) };
  }

  @Get('inbox')
  @ApiOperation({ summary: 'کارتابل و پیام‌ها — خواندن' })
  async inbox(@CurrentUser() actor: AuthenticatedUser) {
    return { success: true, data: await this.portal.inbox(actor) };
  }

  @Post('inbox')
  @ApiOperation({ summary: 'ارسال پیام در کارتابل' })
  async postInboxMessage(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: PostInboxMessageDto,
  ) {
    return {
      success: true,
      data: await this.portal.postInboxMessage(actor, dto.body),
    };
  }

  @Get('profile')
  @ApiOperation({ summary: 'پروفایل خودِ آژانس' })
  async profile(@CurrentUser() actor: AuthenticatedUser) {
    return { success: true, data: await this.portal.profile(actor) };
  }

  @Get('allotments')
  @ApiOperation({ summary: 'سهمیه‌های صندلی تخصیص‌یافته به خودِ آژانس' })
  async allotments(@CurrentUser() actor: AuthenticatedUser) {
    return { success: true, data: await this.portal.allotments(actor) };
  }

  @Get('documents')
  @ApiOperation({ summary: 'مدارک آپلودشده خودِ آژانس' })
  async documents(@CurrentUser() actor: AuthenticatedUser) {
    return { success: true, data: await this.portal.documents(actor) };
  }

  @Post('documents')
  @ApiOperation({ summary: 'آپلود مدرک — فقط PDF/تصویر، حداکثر ۵MB' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES + 1024 } }),
  )
  async uploadDocument(
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return {
      success: true,
      data: await this.portal.uploadDocument(actor, file, dto),
    };
  }

  @Post('webservice-requests')
  @ApiOperation({
    summary: 'درخواست خرید وب‌سرویس B2B — مستقیماً کلید صادر نمی‌کند',
  })
  async requestWebservice(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RequestWebserviceDto,
  ) {
    return {
      success: true,
      data: await this.portal.requestWebservice(actor, dto),
    };
  }

  @Get('webservice-requests')
  @ApiOperation({ summary: 'تاریخچه درخواست‌های وب‌سرویس خودِ آژانس' })
  async myWebserviceRequests(@CurrentUser() actor: AuthenticatedUser) {
    return {
      success: true,
      data: await this.portal.myWebserviceRequests(actor),
    };
  }

  @Get('api-keys')
  @ApiOperation({
    summary:
      'کلیدهای API خودِ آژانس — فقط ابرداده؛ کلید خام فقط یک‌بار هنگام تأیید در پیام‌رسان ارسال می‌شود',
  })
  async apiKeys(@CurrentUser() actor: AuthenticatedUser) {
    return { success: true, data: await this.portal.apiKeys(actor) };
  }
}

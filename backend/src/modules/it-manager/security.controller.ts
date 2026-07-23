import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { SecurityService } from './security.service';
import { UpdateSecurityPolicyDto } from './dto/security.dtos';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

class LogoutAllDto {
  @ApiProperty({
    description: 'از POST /auth/step-up/request (scope: SESSION_REVOKE)',
  })
  @IsString()
  stepUpChallengeId: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  stepUpCode: string;
}

@ApiTags('it-manager')
@Controller('it/security')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard)
@Roles('IT_MANAGER')
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Get('policy')
  @ApiOperation({ summary: 'سیاست رمز عبور و امنیت فعلی' })
  async getPolicy() {
    return { success: true, data: await this.security.getPolicy() };
  }

  @Patch('policy')
  @ApiOperation({ summary: 'به‌روزرسانی سیاست رمز عبور و امنیت' })
  async updatePolicy(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateSecurityPolicyDto,
  ) {
    return {
      success: true,
      data: await this.security.updatePolicy(actor, dto),
    };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'نشست‌های فعال (کاربر، دستگاه، آی‌پی)' })
  async listSessions() {
    return { success: true, data: await this.security.listSessions() };
  }

  @Post('sessions/logout-all')
  @ApiOperation({ summary: 'خروج اجباری همه نشست‌های فعال سایت' })
  async logoutAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: LogoutAllDto,
  ) {
    return {
      success: true,
      data: await this.security.logoutAll(
        actor,
        dto.stepUpChallengeId,
        dto.stepUpCode,
      ),
    };
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { StaffLoginDto } from './dto/staff-login.dto';
import { AgencyLoginDto } from './dto/agency-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

const REFRESH_COOKIE = 'blujet_refresh';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/auth',
  });
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('staff/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Step 1 of staff login: verify username/password, issue a 2FA challenge',
  })
  @ApiResponse({ status: 200, description: 'Challenge issued' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account suspended' })
  async staffLogin(@Body() dto: StaffLoginDto) {
    const result = await this.auth.staffLogin(dto.username, dto.password);
    return { success: true, data: result };
  }

  @Post('staff/login/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Step 2 of staff login: verify the 2FA code, issue tokens',
  })
  @ApiResponse({ status: 200, description: 'Login complete' })
  @ApiResponse({ status: 401, description: 'Invalid/expired code' })
  async verifyTwoFactor(
    @Body() dto: VerifyTwoFactorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.verifyTwoFactor(
      dto.challengeId,
      dto.code,
      {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      },
    );
    setRefreshCookie(res, refreshToken);
    return { success: true, data: { accessToken, user } };
  }

  @Post('agency/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Agency Portal login: phone+password, issues tokens directly (no 2FA)',
  })
  @ApiResponse({ status: 200, description: 'Login complete' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account or agency suspended' })
  async agencyLogin(
    @Body() dto: AgencyLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.agencyLogin(
      dto.phone,
      dto.password,
      { userAgent: req.headers['user-agent'], ip: req.ip },
    );
    setRefreshCookie(res, refreshToken);
    return { success: true, data: { accessToken, user } };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the refresh token and issue a new access token',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE
    ];
    if (!presented) {
      return {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'نشست یافت نشد.' },
      };
    }
    const { accessToken, refreshToken } = await this.auth.refresh(presented, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setRefreshCookie(res, refreshToken);
    return { success: true, data: { accessToken } };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_COOKIE
    ];
    if (presented) await this.auth.logout(presented);
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Current authenticated user's identity and role" })
  me(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: user };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'تغییر رمز عبور خود — رمز فعلی باید تأیید شود',
  })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.auth.changeOwnPassword(
      user,
      dto.currentPassword,
      dto.newPassword,
    );
    return { success: true, data: { changed: true } };
  }

  @Get('_test/last-code/:username')
  @ApiOperation({
    summary: 'E2E-test only: reads back the mock 2FA code. 404s in production.',
  })
  async testLastCode(@Param('username') username: string) {
    const code = await this.auth.getLastCodeForE2e(username);
    if (code === null) throw new NotFoundException();
    return { success: true, data: { code } };
  }
}

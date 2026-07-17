import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClubService } from './club.service';
import {
  CreateMemberDto,
  ListMembersQueryDto,
  UpdateLevelDto,
} from './dto/club.dtos';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PanelAccessGuard } from '../panels/panel-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

const CLUB_ROLES = ['CEO', 'BOARD_CHAIR', 'SENIOR_MANAGER'] as const;

@ApiTags('club')
@Controller('club')
@UseGuards(JwtAuthGuard, RolesGuard, PanelAccessGuard)
@Roles(...CLUB_ROLES)
export class ClubController {
  constructor(private readonly club: ClubService) {}

  @Get('members')
  @ApiOperation({ summary: 'اعضای باشگاه + کارت‌های KPI (فیلتر سطح/جستجو)' })
  async listMembers(@Query() query: ListMembersQueryDto) {
    const data = await this.club.listMembers(query);
    return { success: true, data };
  }

  @Post('members')
  @Roles('CEO', 'BOARD_CHAIR')
  @ApiOperation({
    summary: 'تعریف مشتری VIP جدید — فقط مدیر عامل/رئیس هیئت مدیره',
  })
  async createMember(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateMemberDto,
  ) {
    const data = await this.club.createMember(actor, dto);
    return { success: true, data };
  }

  @Patch('members/:id/level')
  @Roles('SENIOR_MANAGER')
  @ApiOperation({ summary: 'تغییر سطح عضویت — فقط مدیر ارشد، با ممیزی' })
  async updateLevel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateLevelDto,
  ) {
    const data = await this.club.updateLevel(actor, id, dto.level);
    return { success: true, data };
  }

  @Post('members/:id/issue-card')
  @ApiOperation({ summary: 'صدور مستقیم کارت — بدون رکورد درخواست، با ممیزی' })
  async issueCard(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.club.issueCardDirect(actor, id);
    return { success: true, data };
  }

  @Get('card-requests')
  @ApiOperation({
    summary: 'صف درخواست‌های کارت (فقط ارجاع‌شده/تأیید/رد) + تایم‌لاین',
  })
  async listRequests() {
    const data = await this.club.listRequests();
    return { success: true, data };
  }

  @Post('_test/card-request')
  @ApiOperation({
    summary: 'E2E only — creates a fresh REFERRED request; 404 in production',
  })
  async createTestRequest(@Body() body: { assignedTo?: 'SENIOR' | 'CHAIR' }) {
    if (process.env.NODE_ENV === 'production') {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'یافت نشد.' },
      };
    }
    const data = await this.club.createTestRequest(
      body.assignedTo === 'CHAIR' ? 'CHAIR' : 'SENIOR',
    );
    return { success: true, data };
  }

  @Patch('card-requests/:id/approve')
  @ApiOperation({ summary: 'تأیید و صدور کارت — مدیر ارشد فقط ارجاع‌های خودش' })
  async approve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.club.decideRequest(actor, id, 'approve');
    return { success: true, data };
  }

  @Patch('card-requests/:id/reject')
  @ApiOperation({ summary: 'رد درخواست (دکمه «انصراف» طراحی)' })
  async reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const data = await this.club.decideRequest(actor, id, 'reject');
    return { success: true, data };
  }
}

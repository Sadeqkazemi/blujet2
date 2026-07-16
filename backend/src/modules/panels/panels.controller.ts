import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PanelsService } from './panels.service';
import { UpdatePanelAccessDto } from './dto/update-panel-access.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('panels')
@Controller('panels')
@UseGuards(JwtAuthGuard)
export class PanelsController {
  constructor(private readonly panels: PanelsService) {}

  @Get('nav')
  @ApiOperation({
    summary:
      "Caller's role-scoped sidebar — server-computed, never client-decided",
  })
  getNav(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: this.panels.getNav(user.role) };
  }

  @Get('access')
  @UseGuards(RolesGuard)
  @Roles('CEO', 'SENIOR_MANAGER')
  @ApiOperation({ summary: 'Sibling panels this role may enable/disable' })
  async getAccess(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.panels.getAccessFlags(user.role) };
  }

  @Patch('access/:panelKey')
  @UseGuards(RolesGuard)
  @Roles('CEO', 'SENIOR_MANAGER')
  @ApiOperation({ summary: 'Toggle a sibling panel on/off' })
  async setAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('panelKey') panelKey: string,
    @Body() dto: UpdatePanelAccessDto,
  ) {
    return {
      success: true,
      data: await this.panels.setAccessFlag(user, panelKey, dto.enabled),
    };
  }
}

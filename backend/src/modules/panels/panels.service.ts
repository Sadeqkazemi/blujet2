import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ALL_PANEL_KEYS,
  EMPLOYEE_SECTION_NAV,
  PANEL_ACCESS_TOGGLE_RIGHTS,
  PANEL_NAV,
  PanelNavItem,
} from './panel-nav.config';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ErrorCode } from '../../common/errors';

@Injectable()
export class PanelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getNav(user: AuthenticatedUser): Promise<PanelNavItem[]> {
    if (user.role !== 'EMPLOYEE') return PANEL_NAV[user.role] ?? [];

    const grants = await this.prisma.employeePermission.findMany({
      where: { employeeId: user.id },
      select: { permission: { select: { key: true } } },
    });
    const grantedKeys = new Set(grants.map((g) => g.permission.key));

    const items: PanelNavItem[] = [
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    ];
    for (const [sectionKey, section] of Object.entries(EMPLOYEE_SECTION_NAV)) {
      const hasAccess = section.wiredKeys.some((key) => grantedKeys.has(key));
      if (hasAccess) {
        items.push({
          key: sectionKey,
          labelFa: section.labelFa,
          implemented: true,
        });
      }
    }
    // پنل کارمند.dc.html's navKeys formula always appends "referrals" —
    // unconditional, not gated by any permission key (referrals are
    // personally addressed regardless of section grants). This was
    // deferred since Phase 18 (GET /referrals was sender-scoped, no
    // recipient-side listing existed — see docs/DB_SCHEMA.md's Phase 18
    // notes); GET /referrals/mine (Phase 26) closes that gap, so every
    // EMPLOYEE gets the tab now.
    items.push({ key: 'referrals', labelFa: 'ارجاعات', implemented: true });
    return items;
  }

  async getAccessFlags(role: AuthenticatedUser['role']) {
    // Phase 12: IT_MANAGER has no toggle rights but reads the full flag set
    // for its informational tab; the PATCH route never allows it to write.
    const togglable =
      role === 'IT_MANAGER'
        ? (PANEL_ACCESS_TOGGLE_RIGHTS.SENIOR_MANAGER ?? [])
        : (PANEL_ACCESS_TOGGLE_RIGHTS[role] ?? []);
    const rows = await this.prisma.panelAccessFlag.findMany({
      where: { panelKey: { in: togglable } },
    });
    const byKey = new Map(rows.map((r) => [r.panelKey, r]));

    return togglable.map((key) => ({
      panelKey: key,
      enabled: byKey.get(key)?.enabled ?? true,
      updatedAt: byKey.get(key)?.updatedAt ?? null,
    }));
  }

  async setAccessFlag(
    actor: AuthenticatedUser,
    panelKey: string,
    enabled: boolean,
  ) {
    const allowed = PANEL_ACCESS_TOGGLE_RIGHTS[actor.role] ?? [];
    if (!allowed.includes(panelKey) || !ALL_PANEL_KEYS.includes(panelKey)) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'اجازه تغییر دسترسی این پنل را ندارید.',
      });
    }

    const flag = await this.prisma.panelAccessFlag.upsert({
      where: { panelKey },
      update: { enabled, updatedById: actor.id },
      create: { panelKey, enabled, updatedById: actor.id },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'ACCESS',
      action: enabled ? 'فعال‌سازی دسترسی پنل' : 'مسدودسازی دسترسی پنل',
      detail: `پنل «${panelKey}» توسط ${actor.fullName} ${enabled ? 'فعال' : 'مسدود'} شد.`,
      entityType: 'PanelAccessFlag',
      entityId: panelKey,
    });

    return flag;
  }

  async assertPanelEnabledForSelf(role: AuthenticatedUser['role']) {
    const selfKeyByRole: Partial<Record<AuthenticatedUser['role'], string>> = {
      SITE_ADMIN: 'SITE_ADMIN',
      FINANCE_MANAGER: 'FINANCE',
      COMMERCIAL_MANAGER: 'COMMERCIAL',
      IT_MANAGER: 'IT',
    };
    const key = selfKeyByRole[role];
    if (!key) return;

    const flag = await this.prisma.panelAccessFlag.findUnique({
      where: { panelKey: key },
    });
    if (flag && !flag.enabled) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'این پنل موقتاً غیرفعال شده است.',
      });
    }
  }
}

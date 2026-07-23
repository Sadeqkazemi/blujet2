import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StepUpService } from '../auth/step-up.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { UpdateSecurityPolicyDto } from './dto/security.dtos';

@Injectable()
export class SecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stepUp: StepUpService,
  ) {}

  /** Auto-creates the id=1 singleton with the design's defaults on first read. */
  async getPolicy() {
    return this.prisma.securityPolicy.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  }

  async updatePolicy(actor: AuthenticatedUser, dto: UpdateSecurityPolicyDto) {
    await this.getPolicy();
    const updated = await this.prisma.securityPolicy.update({
      where: { id: 1 },
      data: { ...dto, updatedById: actor.id },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SECURITY',
      action: 'به‌روزرسانی سیاست رمز عبور',
      detail: `سیاست رمز عبور و امنیت توسط ${actor.fullName} به‌روزرسانی شد.`,
      entityType: 'SecurityPolicy',
      entityId: '1',
    });

    return updated;
  }

  async listSessions() {
    const sessions = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      include: {
        user: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      who: s.user.fullName,
      role: s.user.role,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  /** Revokes every active session site-wide. Only kills the refresh chain —
   * an already-issued 15-minute access token stays valid until it expires
   * naturally (stateless JWT; no blocklist), an accepted, documented limit. */
  async logoutAll(
    actor: AuthenticatedUser,
    stepUpChallengeId: string,
    stepUpCode: string,
  ) {
    await this.stepUp.verify(
      actor,
      stepUpChallengeId,
      stepUpCode,
      'SESSION_REVOKE',
    );
    const result = await this.prisma.refreshToken.updateMany({
      where: { revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'SECURITY',
      action: 'خروج اجباری همه نشست‌ها',
      detail: `${actor.fullName} همه نشست‌های فعال (${result.count} مورد) را خاتمه داد.`,
      entityType: 'RefreshToken',
    });

    return { revokedCount: result.count };
  }
}

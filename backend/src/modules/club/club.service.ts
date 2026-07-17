import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import {
  encryptPii,
  hashPii,
  isValidIranianNationalId,
  normalizeNationalId,
} from '../../common/pii-crypto';
import { ROLE_LABELS_FA } from '../../common/exec-roles';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { ClubTier } from '../../../generated/prisma/enums';
import type { ClubMember, Prisma } from '../../../generated/prisma/client';

const CARD_PREFIX: Record<ClubTier, string> = {
  SILVER: 'SILV',
  GOLD: 'GOLD',
  PLATINUM: 'PLAT',
};

function generateCardNo(tier: ClubTier): string {
  return `${CARD_PREFIX[tier]}-${crypto.randomInt(1000, 10000)}`;
}

/** Public shape — the encrypted/hash columns never leave the service. */
function toMemberView(m: ClubMember) {
  const { nationalIdEnc, nationalIdHash, ...rest } = m;
  void nationalIdEnc;
  void nationalIdHash;
  return rest;
}

@Injectable()
export class ClubService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async getMemberOrThrow(id: string): Promise<ClubMember> {
    const member = await this.prisma.clubMember.findUnique({ where: { id } });
    if (!member) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'عضو باشگاه یافت نشد.',
      });
    }
    return member;
  }

  async listMembers(query: { level?: ClubTier; q?: string }) {
    const filters: Prisma.ClubMemberWhereInput[] = [];
    if (query.level) filters.push({ level: query.level });
    if (query.q) {
      const q = query.q.trim();
      const or: Prisma.ClubMemberWhereInput[] = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { cardNo: { contains: q, mode: 'insensitive' } },
      ];
      // Exact national-ID match via the keyed hash — never a LIKE over PII.
      const normalized = normalizeNationalId(q);
      if (/^\d{10}$/.test(normalized))
        or.push({ nationalIdHash: hashPii(normalized) });
      filters.push({ OR: or });
    }

    const [members, all, pendingRequests] = await Promise.all([
      this.prisma.clubMember.findMany({
        where: { AND: filters },
        orderBy: { joinDate: 'desc' },
      }),
      this.prisma.clubMember.findMany({
        select: { level: true, cardStatus: true },
      }),
      this.prisma.clubCardRequest.count({ where: { status: 'REFERRED' } }),
    ]);

    // KPI cards always summarize the whole club, unfiltered (per design).
    const tierCounts = { SILVER: 0, GOLD: 0, PLATINUM: 0 };
    let issuedCards = 0;
    for (const m of all) {
      tierCounts[m.level] += 1;
      if (m.cardStatus === 'ISSUED') issuedCards += 1;
    }

    return {
      members: members.map(toMemberView),
      kpis: {
        totalMembers: all.length,
        issuedCards,
        pendingRequests,
        tierCounts,
      },
    };
  }

  async createMember(
    actor: AuthenticatedUser,
    dto: {
      fullName: string;
      email: string;
      birthDate?: string;
      nationalId: string;
      level: ClubTier;
      points?: number;
    },
  ) {
    const nationalId = normalizeNationalId(dto.nationalId);
    if (!isValidIranianNationalId(nationalId)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'کد ملی واردشده معتبر نیست.',
      });
    }
    const duplicate = await this.prisma.clubMember.findFirst({
      where: { nationalIdHash: hashPii(nationalId) },
    });
    if (duplicate) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'عضوی با این کد ملی قبلاً ثبت شده است.',
      });
    }

    const member = await this.prisma.clubMember.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        nationalIdEnc: encryptPii(nationalId),
        nationalIdHash: hashPii(nationalId),
        level: dto.level,
        points: dto.points ?? 0,
      },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CLUB',
      action: 'تعریف مشتری VIP جدید',
      detail: `عضو «${dto.fullName}» با سطح ${dto.level} توسط ${actor.fullName} به باشگاه افزوده شد.`,
      entityType: 'ClubMember',
      entityId: member.id,
    });

    return toMemberView(member);
  }

  async updateLevel(actor: AuthenticatedUser, id: string, level: ClubTier) {
    const member = await this.getMemberOrThrow(id);
    const updated = await this.prisma.clubMember.update({
      where: { id },
      data: { level },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CLUB',
      action: 'تغییر سطح عضویت',
      detail: `سطح عضویت «${member.fullName}» توسط ${actor.fullName} از ${member.level} به ${level} تغییر کرد.`,
      entityType: 'ClubMember',
      entityId: id,
    });

    return toMemberView(updated);
  }

  async issueCardDirect(actor: AuthenticatedUser, id: string) {
    const member = await this.getMemberOrThrow(id);
    if (member.cardStatus === 'ISSUED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'برای این عضو قبلاً کارت صادر شده است.',
      });
    }

    const roleLabel = ROLE_LABELS_FA[actor.role];
    const updated = await this.prisma.clubMember.update({
      where: { id },
      data: {
        cardStatus: 'ISSUED',
        cardNo: generateCardNo(member.level),
        issuedByLabelFa: `${roleLabel} (صدور مستقیم)`,
      },
    });

    // The mocks issue silently with no trail — the real system audits (⚑).
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CLUB',
      action: 'صدور مستقیم کارت عضویت',
      detail: `کارت ${updated.cardNo} برای «${member.fullName}» توسط ${actor.fullName} صادر شد (صدور مستقیم).`,
      entityType: 'ClubMember',
      entityId: id,
    });

    return toMemberView(updated);
  }

  /**
   * Non-production only: lets Playwright E2E runs create a fresh member +
   * REFERRED request (request creation belongs to the site-admin/public
   * tracks, so the exec panels have no real creation path to drive).
   * Always 404s in production — enforced here AND by the controller.
   */
  async createTestRequest(assignedTo: 'SENIOR' | 'CHAIR') {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'یافت نشد.',
      });
    }
    let nid = '';
    for (;;) {
      const base = Array.from({ length: 9 }, () =>
        crypto.randomInt(0, 10),
      ).join('');
      if (/^(\d)\1{8}$/.test(base)) continue;
      const sum = base
        .split('')
        .reduce((acc, d, i) => acc + Number(d) * (10 - i), 0);
      const r = sum % 11;
      nid = base + String(r < 2 ? r : 11 - r);
      break;
    }
    const member = await this.prisma.clubMember.create({
      data: {
        fullName: `عضو آزمایشی ${crypto.randomUUID().slice(0, 6)}`,
        email: `${crypto.randomUUID().slice(0, 8)}@e2e.example`,
        nationalIdEnc: encryptPii(nid),
        nationalIdHash: hashPii(nid),
        points: 6000,
        level: 'GOLD',
        cardStatus: 'REVIEW',
      },
    });
    return this.prisma.clubCardRequest.create({
      data: {
        memberId: member.id,
        level: 'GOLD',
        points: 6000,
        status: 'REFERRED',
        assignedTo,
        history: [
          {
            step: 'submitted',
            labelFa: 'رسیدن به حد امتیاز و ثبت درخواست صدور کارت',
            at: 'اکنون',
          },
          {
            step: 'referred',
            labelFa: `ارجاع به ${assignedTo === 'SENIOR' ? 'مدیر ارشد' : 'رئیس هیئت مدیره'} توسط ادمین سایت`,
            at: 'اکنون',
          },
        ],
      },
    });
  }

  // ── Card requests ─────────────────────────────────────────────────────

  async listRequests() {
    // SUBMITTED lives in the site-admin track — the exec panels only ever
    // see REFERRED/APPROVED/REJECTED (confirmed against all three designs).
    const requests = await this.prisma.clubCardRequest.findMany({
      where: { status: { in: ['REFERRED', 'APPROVED', 'REJECTED'] } },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            email: true,
            points: true,
            level: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return requests;
  }

  /** ⚑ Design authority rule: CEO/BOARD_CHAIR act on any REFERRED request;
   * SENIOR_MANAGER only on assignedTo=SENIOR. */
  private assertCanDecide(
    actor: AuthenticatedUser,
    assignedTo: 'SENIOR' | 'CHAIR' | null,
  ) {
    if (actor.role === 'CEO' || actor.role === 'BOARD_CHAIR') return;
    if (actor.role === 'SENIOR_MANAGER' && assignedTo === 'SENIOR') return;
    throw new ForbiddenException({
      code: ErrorCode.FORBIDDEN,
      message: 'این درخواست به شما ارجاع نشده است.',
    });
  }

  private nowJalaliLabel(): string {
    // Presentational timestamp for the history timeline (design shows
    // Jalali date-time strings); precise auditing lives in AuditLog.
    return new Date().toISOString();
  }

  async decideRequest(
    actor: AuthenticatedUser,
    id: string,
    decision: 'approve' | 'reject',
  ) {
    const request = await this.prisma.clubCardRequest.findUnique({
      where: { id },
      include: { member: true },
    });
    if (!request) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'درخواست یافت نشد.',
      });
    }
    if (request.status !== 'REFERRED') {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این درخواست قبلاً بررسی شده است.',
      });
    }
    this.assertCanDecide(actor, request.assignedTo);

    const roleLabel = ROLE_LABELS_FA[actor.role];
    const history = Array.isArray(request.history)
      ? [...(request.history as unknown[])]
      : [];

    const updated = await this.prisma.$transaction(async (tx) => {
      if (decision === 'approve') {
        const cardNo = generateCardNo(request.level);
        history.push({
          step: 'approved',
          labelFa: `تأیید و صدور کارت توسط ${roleLabel}`,
          at: this.nowJalaliLabel(),
        });
        const req = await tx.clubCardRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            cardNo,
            decidedById: actor.id,
            decidedAt: new Date(),
            history: history as Prisma.InputJsonValue,
          },
        });
        await tx.clubMember.update({
          where: { id: request.memberId },
          data: {
            cardStatus: 'ISSUED',
            cardNo,
            issuedByLabelFa: `${roleLabel} (تأیید درخواست)`,
          },
        });
        return req;
      }

      history.push({
        step: 'rejected',
        labelFa: `رد درخواست توسط ${roleLabel}`,
        at: this.nowJalaliLabel(),
      });
      const req = await tx.clubCardRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          decidedById: actor.id,
          decidedAt: new Date(),
          history: history as Prisma.InputJsonValue,
        },
      });
      await tx.clubMember.update({
        where: { id: request.memberId },
        data: { cardStatus: 'NONE' },
      });
      return req;
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CLUB',
      action:
        decision === 'approve'
          ? 'تأیید و صدور کارت عضویت'
          : 'رد درخواست کارت عضویت',
      detail: `درخواست کارت «${request.member.fullName}» توسط ${actor.fullName} ${
        decision === 'approve'
          ? `تأیید و کارت ${updated.cardNo} صادر شد`
          : 'رد شد'
      }.`,
      entityType: 'ClubCardRequest',
      entityId: id,
    });

    return updated;
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/errors';
import { resolveTierForPoints } from '../club/club.service';
import type { Prisma } from '../../../generated/prisma/client';
import type { Irr } from '../../common/money';

/** Server-side config (CLAUDE.md: "conversion rate is server-side config")
 * — documented constants rather than a SystemSetting key, since no other
 * Phase 13 rate lives there yet either. */
const IRR_PER_EARNED_POINT = 100_000;
const IRR_PER_REDEEMED_POINT = 10_000;

@Injectable()
export class ClubPointsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMemberByUserId(userId: string) {
    return this.prisma.clubMember.findUnique({ where: { userId } });
  }

  async getBalance(clubMemberId: string): Promise<number> {
    const sum = await this.prisma.clubPointsEntry.aggregate({
      where: { clubMemberId },
      _sum: { signedPoints: true },
    });
    return sum._sum.signedPoints ?? 0;
  }

  /** Only called for GATEWAY/WALLET payments (real money spent) — never
   * when the purchase itself was paid with points, to avoid a
   * redeem-to-earn loophole. */
  async earnForPurchase(
    tx: Prisma.TransactionClient,
    clubMemberId: string,
    paidIrr: Irr,
    bookingId: string,
  ) {
    // Whole-IRR BigInt division (truncates, same as the old Math.floor) —
    // never routes the amount through a float.
    const points = Number(paidIrr / BigInt(IRR_PER_EARNED_POINT));
    if (points <= 0) return;
    await tx.clubPointsEntry.create({
      data: { clubMemberId, type: 'EARN', signedPoints: points, bookingId },
    });
    await this.syncCache(tx, clubMemberId);
  }

  /** "Pay with points" — the design's payment method for club members
   * (CLAUDE.md). Redeems exactly enough points to cover priceIrr; throws
   * if the member doesn't have enough. */
  async redeemForPayment(
    tx: Prisma.TransactionClient,
    clubMemberId: string,
    priceIrr: Irr,
    bookingId: string,
  ): Promise<number> {
    // BigInt ceiling division — (a + b - 1) / b — same semantics as the old
    // Math.ceil, no float involved.
    const rate = BigInt(IRR_PER_REDEEMED_POINT);
    const pointsNeeded = Number((priceIrr + rate - 1n) / rate);
    const sum = await tx.clubPointsEntry.aggregate({
      where: { clubMemberId },
      _sum: { signedPoints: true },
    });
    const balance = sum._sum.signedPoints ?? 0;
    if (balance < pointsNeeded) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'امتیاز باشگاه کافی نیست.',
      });
    }
    await tx.clubPointsEntry.create({
      data: {
        clubMemberId,
        type: 'REDEEM',
        signedPoints: -pointsNeeded,
        bookingId,
      },
    });
    await this.syncCache(tx, clubMemberId);
    return pointsNeeded;
  }

  /** Keeps ClubMember.points (Phase 5's staff-facing display cache) in
   * sync — write-only from here, never read as the source of truth.
   * Phase 65: also recomputes ClubMember.level from the manager-configured
   * ClubTierRule thresholds every time points change, so tier promotion
   * (and demotion, on a redemption) is real rather than a manual-only
   * staff action. */
  private async syncCache(tx: Prisma.TransactionClient, clubMemberId: string) {
    const sum = await tx.clubPointsEntry.aggregate({
      where: { clubMemberId },
      _sum: { signedPoints: true },
    });
    const points = sum._sum.signedPoints ?? 0;
    const rule = await tx.clubTierRule.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    const level = rule ? resolveTierForPoints(points, rule) : undefined;
    await tx.clubMember.update({
      where: { id: clubMemberId },
      data: { points, ...(level ? { level } : {}) },
    });
  }
}

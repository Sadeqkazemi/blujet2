import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  generateReferralCode,
  normalizeReferralCode,
} from '../../common/referral-code.util';
import { resolveTierForPoints } from '../club/club.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { Prisma } from '../../../generated/prisma/client';

/** Server-side reward per referred friend's first ticketed booking — matches
 * design-reference-v2/پنل کاربر.dc.html copy («۵۰۰ امتیاز»). */
export const REFERRAL_REWARD_POINTS = 500;

@Injectable()
export class CustomerReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  private sharePath(code: string): string {
    return `/signin?ref=${encodeURIComponent(code)}`;
  }

  async ensureReferralCode(userId: string, fullName: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (user.referralCode) return user.referralCode;

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateReferralCode(fullName, userId);
      try {
        const updated = await this.prisma.user.update({
          where: { id: userId },
          data: { referralCode: code },
          select: { referralCode: true },
        });
        return updated.referralCode!;
      } catch {
        // unique collision — retry
      }
    }
    const fallback = `${userId.slice(0, 8).toUpperCase()}-${Date.now() % 10000}`;
    await this.prisma.user.update({
      where: { id: userId },
      data: { referralCode: fallback },
    });
    return fallback;
  }

  async getDashboard(user: AuthenticatedUser) {
    const code = await this.ensureReferralCode(user.id, user.fullName);
    const rows = await this.prisma.customerReferral.findMany({
      where: { referrerUserId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        referred: { select: { fullName: true, createdAt: true } },
      },
    });

    const invitedCount = rows.length;
    const successfulBookings = rows.filter(
      (r) => r.status === 'BOOKED' || r.status === 'REWARDED',
    ).length;
    const pointsEarned = rows.reduce((sum, r) => sum + r.pointsAwarded, 0);

    return {
      referralCode: code,
      sharePath: this.sharePath(code),
      stats: {
        invitedCount,
        pointsEarned,
        successfulBookings,
      },
      invites: rows.map((r) => ({
        id: r.id,
        fullName: r.referred.fullName,
        joinedAt: r.referred.createdAt,
        status: r.status,
        pointsAwarded: r.pointsAwarded,
      })),
    };
  }

  /** Called when a brand-new customer account is created via OTP. Invalid or
   * self-referral codes are ignored silently so signup never fails. */
  async applyOnSignup(referredUserId: string, rawCode?: string): Promise<void> {
    if (!rawCode?.trim()) return;
    const code = normalizeReferralCode(rawCode);
    const referrer = await this.prisma.user.findFirst({
      where: { referralCode: code, role: 'USER', isActive: true },
      select: { id: true },
    });
    if (!referrer || referrer.id === referredUserId) return;

    const already = await this.prisma.customerReferral.findUnique({
      where: { referredUserId },
    });
    if (already) return;

    await this.prisma.customerReferral.create({
      data: {
        referrerUserId: referrer.id,
        referredUserId,
        status: 'SIGNED_UP',
      },
    });
  }

  /** Award referrer when a referred user completes their first ticketed
   * booking. Idempotent — safe to call on every pay() for that user. */
  async processFirstTicketedBooking(
    tx: Prisma.TransactionClient,
    referredUserId: string,
    bookingId: string,
  ): Promise<void> {
    const referral = await tx.customerReferral.findUnique({
      where: { referredUserId },
    });
    if (!referral || referral.status !== 'SIGNED_UP') return;

    const referrerMember = await tx.clubMember.findUnique({
      where: { userId: referral.referrerUserId },
    });

    let pointsAwarded = 0;
    if (referrerMember) {
      pointsAwarded = REFERRAL_REWARD_POINTS;
      await tx.clubPointsEntry.create({
        data: {
          clubMemberId: referrerMember.id,
          type: 'EARN',
          signedPoints: pointsAwarded,
        },
      });
      const sum = await tx.clubPointsEntry.aggregate({
        where: { clubMemberId: referrerMember.id },
        _sum: { signedPoints: true },
      });
      const points = sum._sum.signedPoints ?? 0;
      const rule = await tx.clubTierRule.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      const level = rule ? resolveTierForPoints(points, rule) : undefined;
      await tx.clubMember.update({
        where: { id: referrerMember.id },
        data: { points, ...(level ? { level } : {}) },
      });
    }

    await tx.customerReferral.update({
      where: { id: referral.id },
      data: {
        status: 'REWARDED',
        firstBookingId: bookingId,
        pointsAwarded,
        rewardedAt: new Date(),
      },
    });
  }
}

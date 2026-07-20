import { Injectable } from '@nestjs/common';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { decryptPii } from '../../common/pii-crypto';

/**
 * GDPR-equivalent export/delete for the public purchase engine
 * (CLAUDE.md: "implement passenger data export and deletion flows").
 */
@Injectable()
export class PrivacyService {
  constructor(private readonly typeorm: TypeORMService) {}

  async exportMyData(userId: string) {
    const [user, bookings, refunds, walletEntries, priceLocks, member] =
      await Promise.all([
        this.typeorm.user.findUniqueOrThrow({
          where: { id: userId },
          select: {
            id: true,
            phone: true,
            fullName: true,
            email: true,
            createdAt: true,
          },
        }),
        this.typeorm.booking.findMany({
          where: { userId },
          include: {
            passengers: true,
            flightInstance: {
              include: { flight: { include: { route: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.typeorm.refundRequest.findMany({
          where: { booking: { userId } },
          orderBy: { createdAt: 'desc' },
        }),
        this.typeorm.walletEntry.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
        this.typeorm.priceLock.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
        this.typeorm.clubMember.findUnique({ where: { userId } }),
      ]);

    const pointsEntries = member
      ? await this.typeorm.clubPointsEntry.findMany({
          where: { clubMemberId: member.id },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    return {
      user,
      bookings: bookings.map((b) => ({
        id: b.id,
        pnr: b.pnr,
        status: b.status,
        cabin: b.cabin,
        priceIrr: b.priceIrr,
        contactPhone: b.contactPhone,
        flightNo: b.flightInstance.flight.flightNo,
        originCode: b.flightInstance.flight.route.originCode,
        destCode: b.flightInstance.flight.route.destCode,
        departureAt: b.flightInstance.departureAt,
        createdAt: b.createdAt,
        passengers: b.passengers.map((p) => ({
          fullName: p.fullName,
          seatCode: p.seatCode,
          nationalId: p.nationalIdEnc ? decryptPii(p.nationalIdEnc) : null,
          mobile: p.mobileEnc ? decryptPii(p.mobileEnc) : null,
        })),
      })),
      refunds: refunds.map((r) => ({
        id: r.id,
        bookingId: r.bookingId,
        status: r.status,
        penaltyPct: r.penaltyPct,
        refundableIrr: r.refundableIrr,
        createdAt: r.createdAt,
      })),
      walletEntries,
      clubPoints: member
        ? {
            level: member.level,
            balance: member.points,
            entries: pointsEntries,
          }
        : null,
      priceLocks,
    };
  }

  /**
   * Soft-deletes the account and anonymizes passenger PII on the customer's
   * own bookings. Booking/ledger rows themselves are kept (financial audit
   * trail — CLAUDE.md's booking rules require soft delete there, hard
   * deletes only through this GDPR flow, which we still don't apply to the
   * financial rows, only to the PII fields). All refresh tokens are
   * revoked so no session survives the deletion.
   */
  async deleteMyAccount(userId: string) {
    const bookings = await this.typeorm.booking.findMany({
      where: { userId },
      select: { id: true },
    });
    const bookingIds = bookings.map((b) => b.id);

    await this.typeorm.$transaction([
      this.typeorm.passenger.updateMany({
        where: { bookingId: { in: bookingIds } },
        data: {
          fullName: 'کاربر حذف‌شده',
          nationalIdEnc: null,
          nationalIdHash: null,
          mobileEnc: null,
          deletedAt: new Date(),
        },
      }),
      this.typeorm.booking.updateMany({
        where: { id: { in: bookingIds } },
        data: { contactPhone: null },
      }),
      this.typeorm.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.typeorm.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          deletedAt: new Date(),
          phone: null,
          email: null,
          fullName: 'کاربر حذف‌شده',
        },
      }),
    ]);
  }
}

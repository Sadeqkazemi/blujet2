import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/errors';
import type { Prisma } from '../../../generated/prisma/client';

/** Balance is ALWAYS SUM(signedAmountIrr) — never a mutable column
 * (CLAUDE.md). Top-up is a sandbox "always succeeds" gateway, matching the
 * rest of Phase 13's payment flow. */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string): Promise<number> {
    const sum = await this.prisma.walletEntry.aggregate({
      where: { userId },
      _sum: { signedAmountIrr: true },
    });
    return sum._sum.signedAmountIrr ?? 0;
  }

  async topup(userId: string, amountIrr: number) {
    await this.prisma.walletEntry.create({
      data: { userId, type: 'TOPUP', signedAmountIrr: amountIrr },
    });
    return this.getBalance(userId);
  }

  /** Debits the wallet inside an existing transaction — throws if the
   * balance (computed from committed rows only) can't cover the charge. */
  async charge(
    tx: Prisma.TransactionClient,
    userId: string,
    amountIrr: number,
    bookingId: string,
  ) {
    const sum = await tx.walletEntry.aggregate({
      where: { userId },
      _sum: { signedAmountIrr: true },
    });
    const balance = sum._sum.signedAmountIrr ?? 0;
    if (balance < amountIrr) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'موجودی کیف پول کافی نیست.',
      });
    }
    await tx.walletEntry.create({
      data: {
        userId,
        type: 'PURCHASE',
        signedAmountIrr: -amountIrr,
        bookingId,
      },
    });
  }
}

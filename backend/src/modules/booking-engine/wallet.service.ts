import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { WalletEntry } from '../../database/entities/wallet-entry.entity';
import { ErrorCode } from '../../common/errors';
import { type Irr, ZERO_IRR, negateIrr } from '../../common/money';

/** Balance is ALWAYS SUM(signedAmountIrr) — never a mutable column
 * (CLAUDE.md). Top-up is a sandbox "always succeeds" gateway, matching the
 * rest of Phase 13's payment flow. */
@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletEntry)
    private readonly walletRepo: Repository<WalletEntry>,
  ) {}

  private async sumBalance(
    manager: EntityManager,
    userId: string,
  ): Promise<Irr> {
    const row = await manager
      .createQueryBuilder(WalletEntry, 'w')
      .select('SUM(w."signedAmountIrr")', 'sum')
      .where('w."userId" = :userId', { userId })
      .getRawOne<{ sum: string | null }>();
    return row?.sum ? BigInt(row.sum) : ZERO_IRR;
  }

  async getBalance(userId: string): Promise<Irr> {
    return this.sumBalance(this.walletRepo.manager, userId);
  }

  async topup(userId: string, amountIrr: Irr) {
    await this.walletRepo.save(
      this.walletRepo.create({
        userId,
        type: 'TOPUP',
        signedAmountIrr: amountIrr,
      }),
    );
    return this.getBalance(userId);
  }

  /** Debits the wallet inside an existing transaction — throws if the
   * balance (computed from committed rows only) can't cover the charge. */
  async charge(
    manager: EntityManager,
    userId: string,
    amountIrr: Irr,
    bookingId: string,
  ) {
    const balance = await this.sumBalance(manager, userId);
    if (balance < amountIrr) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'موجودی کیف پول کافی نیست.',
      });
    }
    await manager.save(
      manager.create(WalletEntry, {
        userId,
        type: 'PURCHASE',
        signedAmountIrr: negateIrr(amountIrr),
        bookingId,
      }),
    );
  }
}

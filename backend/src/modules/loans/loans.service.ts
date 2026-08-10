import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import { BankLoanApplication } from '../../database/entities/bank-loan-application.entity';
import { BankLoanWalletCredit } from '../../database/entities/bank-loan-wallet-credit.entity';
import { WalletEntry } from '../../database/entities/wallet-entry.entity';
import { BankLoanStatus } from '../../database/enums';
import type { JsonValue } from '../../database/json-types';
import { ErrorCode } from '../../common/errors';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuditService } from '../audit/audit.service';
import { BANK_LOAN_PROVIDER } from './bank-loan.http.adapter';
import { Inject } from '@nestjs/common';
import {
  mapBankStatusToDisplay,
  parseBankStatus,
  type BankLoanProvider,
} from './bank-loan.types';
import { bankScopedIdempotencyKey } from './loan-idempotency';
import { canTransitionBankStatus } from './loan-status.transitions';
import { redactWebhookPayload } from './loan-webhook-redact';

function asJsonSummary(
  summary: Record<string, unknown> | null | undefined,
): JsonValue | null {
  if (summary == null) return null;
  return JSON.parse(JSON.stringify(summary)) as JsonValue;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class LoansService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @InjectRepository(BankLoanApplication)
    private readonly loanRepo: Repository<BankLoanApplication>,
    @Inject(BANK_LOAN_PROVIDER)
    private readonly bank: BankLoanProvider,
    private readonly audit: AuditService,
  ) {}

  private providerKey(): string {
    const fromEnv = this.config.get<string>('BANK_LOAN_PROVIDER')?.trim();
    if (fromEnv) return fromEnv;
    const base = (this.config.get<string>('BANK_LOAN_API_BASE_URL') ?? '')
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      ?.trim();
    return base || 'configured-bank';
  }

  private serialize(row: BankLoanApplication, admin = false) {
    const base = {
      id: row.id,
      requestedAmountIrr: row.requestedAmountIrr.toString(),
      bankStatus: row.bankStatus,
      displayStatus: mapBankStatusToDisplay(row.bankStatus),
      bankReferenceId: row.bankReferenceId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    };
    if (!admin) return base;
    return {
      ...base,
      userId: row.userId,
      statusSummary: row.statusSummary,
      walletCreditReference: row.walletCreditReference,
    };
  }

  /**
   * Atomically reserve (userId, idempotencyKey) before any bank call.
   * Returns the new row id when this caller won the reservation; null if
   * another request already holds the key.
   */
  private async reserveIdempotencySlot(
    userId: string,
    idempotencyKey: string,
    requestedAmountIrr: string,
  ): Promise<string | null> {
    const id = randomUUID();
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `
      INSERT INTO "bank_loan_applications"
        ("id", "userId", "idempotencyKey", "requestedAmountIrr", "bankStatus", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, 'SUBMITTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId", "idempotencyKey") DO NOTHING
      RETURNING "id"
      `,
      [id, userId, idempotencyKey, requestedAmountIrr],
    );
    return rows[0]?.id ?? null;
  }

  /** Wait until the winning request finishes the bank round-trip. */
  private async awaitReservedApplication(
    userId: string,
    idempotencyKey: string,
  ): Promise<BankLoanApplication> {
    for (let i = 0; i < 80; i++) {
      const row = await this.loanRepo.findOne({
        where: { userId, idempotencyKey },
      });
      if (!row || row.userId !== userId) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'درخواست یافت نشد.',
        });
      }
      if (row.bankReferenceId || row.bankStatus === 'FAILED') {
        return row;
      }
      await sleep(25);
    }
    const late = await this.loanRepo.findOneOrFail({
      where: { userId, idempotencyKey },
    });
    return late;
  }

  async create(
    actor: AuthenticatedUser,
    dto: {
      requestedAmountIrr: string;
      idempotencyKey: string;
    },
  ) {
    if (
      !/^\d+$/.test(dto.requestedAmountIrr) ||
      BigInt(dto.requestedAmountIrr) <= 0n
    ) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'مبلغ درخواستی نامعتبر است.',
      });
    }

    const reservedId = await this.reserveIdempotencySlot(
      actor.id,
      dto.idempotencyKey,
      dto.requestedAmountIrr,
    );

    if (!reservedId) {
      const existing = await this.awaitReservedApplication(
        actor.id,
        dto.idempotencyKey,
      );
      return this.serialize(existing);
    }

    const correlationId = randomUUID();
    const bankKey = bankScopedIdempotencyKey(actor.id, dto.idempotencyKey);

    let bankRes: Awaited<ReturnType<BankLoanProvider['createApplication']>>;
    try {
      bankRes = await this.bank.createApplication({
        correlationId,
        idempotencyKey: bankKey,
        requestedAmountIrr: dto.requestedAmountIrr,
        customerExternalId: actor.id,
      });
    } catch (err) {
      await this.loanRepo.update(
        { id: reservedId, userId: actor.id },
        { bankStatus: 'FAILED', lastSyncedAt: new Date() },
      );
      throw err;
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(BankLoanApplication, {
        where: { id: reservedId, userId: actor.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.userId !== actor.id) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: 'درخواست یافت نشد.',
        });
      }
      locked.bankReferenceId = bankRes.bankReferenceId;
      locked.bankStatus = bankRes.bankStatus;
      locked.statusSummary = asJsonSummary(bankRes.summary);
      locked.lastSyncedAt = new Date();
      await manager.save(locked);

      await this.maybeCreditWallet(
        manager,
        locked,
        bankRes.bankStatus,
        bankRes.walletCreditIrr,
        bankRes.walletCreditReference,
      );
      return locked;
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'FINANCE',
      action: 'ارسال درخواست وام به بانک',
      detail: 'درخواست وام باشگاه مشتریان به بانک ارسال شد.',
      entityType: 'BankLoanApplication',
      entityId: saved.id,
      metadata: {
        bankReferenceId: saved.bankReferenceId,
        bankStatus: saved.bankStatus,
        correlationId,
      },
    });

    return this.serialize(saved);
  }

  async listMine(actor: AuthenticatedUser, page = 1, pageSize = 20) {
    const [rows, total] = await this.loanRepo.findAndCount({
      where: { userId: actor.id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      items: rows.map((r) => this.serialize(r)),
      page,
      pageSize,
      total,
    };
  }

  async getMine(actor: AuthenticatedUser, id: string) {
    const row = await this.loanRepo.findOne({ where: { id } });
    if (!row || row.userId !== actor.id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'درخواست یافت نشد.',
      });
    }
    return this.serialize(row);
  }

  async syncMine(actor: AuthenticatedUser, id: string) {
    const row = await this.loanRepo.findOne({ where: { id } });
    if (!row || row.userId !== actor.id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'درخواست یافت نشد.',
      });
    }
    if (!row.bankReferenceId) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'شناسه بانک برای این درخواست موجود نیست.',
      });
    }
    const correlationId = randomUUID();
    const status = await this.bank.getStatus(
      row.bankReferenceId,
      correlationId,
    );
    await this.applyBankUpdate(row, status.bankStatus, status.summary, {
      walletCreditIrr: status.walletCreditIrr,
      walletCreditReference: status.walletCreditReference,
      eventId: `poll:${correlationId}`,
      occurredAt: new Date(),
      sourcePayload: {
        bankReferenceId: status.bankReferenceId,
        status: status.bankStatus,
        walletCreditIrr: status.walletCreditIrr ?? null,
        walletCreditReference: status.walletCreditReference ?? null,
      },
    });
    const fresh = await this.loanRepo
      .createQueryBuilder('l')
      .where('l.id = :id', { id })
      .getOneOrFail();
    return this.serialize(fresh);
  }

  async listAdmin(page = 1, pageSize = 20) {
    const [rows, total] = await this.loanRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      items: rows.map((r) => this.serialize(r, true)),
      page,
      pageSize,
      total,
    };
  }

  async getAdmin(id: string) {
    const row = await this.loanRepo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'درخواست یافت نشد.',
      });
    }
    return this.serialize(row, true);
  }

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined) {
    const secret = this.config.get<string>('BANK_LOAN_WEBHOOK_SECRET') ?? '';
    if (!secret) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'وب‌هوک پیکربندی نشده است.',
      });
    }
    if (!signatureHeader) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'امضای وب‌هوک نامعتبر است.',
      });
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signatureHeader.replace(/^sha256=/i, '').trim();
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'امضای وب‌هوک نامعتبر است.',
      });
    }
  }

  async handleWebhook(payload: {
    eventId: string;
    bankReferenceId: string;
    status: string;
    walletCreditIrr?: string;
    walletCreditReference?: string;
    occurredAt?: string;
    summary?: Record<string, unknown>;
  }) {
    if (!payload.eventId || !payload.bankReferenceId) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'بدنه وب‌هوک نامعتبر است.',
      });
    }

    const row = await this.loanRepo.findOne({
      where: { bankReferenceId: payload.bankReferenceId },
    });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'درخواست یافت نشد.',
      });
    }

    const occurredAt = payload.occurredAt
      ? new Date(payload.occurredAt)
      : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'زمان رویداد نامعتبر است.',
      });
    }

    const result = await this.applyBankUpdate(
      row,
      parseBankStatus(payload.status),
      payload.summary ?? { status: payload.status },
      {
        walletCreditIrr: payload.walletCreditIrr,
        walletCreditReference: payload.walletCreditReference,
        eventId: payload.eventId,
        occurredAt,
        sourcePayload: {
          eventId: payload.eventId,
          bankReferenceId: payload.bankReferenceId,
          status: payload.status,
          walletCreditIrr: payload.walletCreditIrr ?? null,
          walletCreditReference: payload.walletCreditReference ?? null,
          occurredAt: payload.occurredAt ?? null,
        },
      },
    );

    return {
      ok: true,
      duplicate: result === 'DUPLICATE',
      ignored: result.startsWith('IGNORED'),
      result,
    };
  }

  private async claimWebhookEvent(
    manager: EntityManager,
    args: {
      provider: string;
      eventId: string;
      bankReferenceId: string | null;
      loanApplicationId: string | null;
      bankStatus: string | null;
      occurredAt: Date | null;
      payload: Record<string, unknown>;
    },
  ): Promise<string | null> {
    const id = randomUUID();
    const redacted = redactWebhookPayload(args.payload);
    const rows: Array<{ id: string }> = await manager.query(
      `
      INSERT INTO "bank_loan_webhook_events"
        ("id", "provider", "eventId", "bankReferenceId", "loanApplicationId",
         "bankStatus", "occurredAt", "payloadRedacted", "processingResult", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'CLAIMED', CURRENT_TIMESTAMP)
      ON CONFLICT ("provider", "eventId") DO NOTHING
      RETURNING "id"
      `,
      [
        id,
        args.provider,
        args.eventId,
        args.bankReferenceId,
        args.loanApplicationId,
        args.bankStatus,
        args.occurredAt,
        redacted == null ? null : JSON.stringify(redacted),
      ],
    );
    return rows[0]?.id ?? null;
  }

  private async finalizeWebhookEvent(
    manager: EntityManager,
    eventRowId: string,
    processingResult: string,
  ) {
    await manager.query(
      `
      UPDATE "bank_loan_webhook_events"
      SET "processingResult" = $2
      WHERE "id" = $1
      `,
      [eventRowId, processingResult],
    );
  }

  private async applyBankUpdate(
    row: BankLoanApplication,
    bankStatus: BankLoanStatus,
    summary: Record<string, unknown> | null | undefined,
    opts: {
      walletCreditIrr?: string | null;
      walletCreditReference?: string | null;
      eventId: string;
      occurredAt: Date;
      sourcePayload: Record<string, unknown>;
    },
  ): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const provider = this.providerKey();
      const eventRowId = await this.claimWebhookEvent(manager, {
        provider,
        eventId: opts.eventId,
        bankReferenceId: row.bankReferenceId,
        loanApplicationId: row.id,
        bankStatus,
        occurredAt: opts.occurredAt,
        payload: opts.sourcePayload,
      });
      if (!eventRowId) {
        return 'DUPLICATE';
      }

      const locked = await manager.findOne(BankLoanApplication, {
        where: { id: row.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        await this.finalizeWebhookEvent(
          manager,
          eventRowId,
          'IGNORED_MISSING_LOAN',
        );
        return 'IGNORED_MISSING_LOAN';
      }

      if (
        locked.lastWebhookOccurredAt &&
        opts.occurredAt.getTime() < locked.lastWebhookOccurredAt.getTime() &&
        bankStatus !== locked.bankStatus
      ) {
        await this.finalizeWebhookEvent(manager, eventRowId, 'IGNORED_STALE');
        return 'IGNORED_STALE';
      }

      if (!canTransitionBankStatus(locked.bankStatus, bankStatus)) {
        await this.finalizeWebhookEvent(
          manager,
          eventRowId,
          'IGNORED_TRANSITION',
        );
        return 'IGNORED_TRANSITION';
      }

      locked.bankStatus = bankStatus;
      locked.statusSummary = asJsonSummary(summary) ?? locked.statusSummary;
      locked.lastSyncedAt = new Date();
      locked.lastWebhookEventId = opts.eventId;
      locked.lastWebhookOccurredAt = opts.occurredAt;
      await manager.save(locked);

      await this.maybeCreditWallet(
        manager,
        locked,
        bankStatus,
        opts.walletCreditIrr,
        opts.walletCreditReference,
      );

      await this.finalizeWebhookEvent(manager, eventRowId, 'APPLIED');
      return 'APPLIED';
    });
  }

  /**
   * Credits wallet only on exact DISBURSED with matching amount/ref.
   * Claims creditReference via INSERT ON CONFLICT DO NOTHING — never catches 23505.
   */
  private async maybeCreditWallet(
    manager: EntityManager,
    row: BankLoanApplication,
    bankStatus: BankLoanStatus,
    amountIrr: string | null | undefined,
    creditRef: string | null | undefined,
  ) {
    if (bankStatus !== 'DISBURSED') {
      return;
    }
    if (!amountIrr || !creditRef) return;
    if (!/^\d+$/.test(amountIrr) || BigInt(amountIrr) <= 0n) return;
    if (BigInt(amountIrr) !== row.requestedAmountIrr) return;
    if (row.walletCreditReference) return;

    const priorClaim = await manager.findOne(BankLoanWalletCredit, {
      where: { loanApplicationId: row.id },
    });
    if (priorClaim) {
      row.walletCreditReference = priorClaim.creditReference;
      return;
    }

    const claimed: Array<{ creditReference: string }> = await manager.query(
      `
      INSERT INTO "bank_loan_wallet_credits"
        ("creditReference", "loanApplicationId", "userId", "amountIrr", "createdAt")
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT ("creditReference") DO NOTHING
      RETURNING "creditReference"
      `,
      [creditRef, row.id, row.userId, amountIrr],
    );

    if (!claimed[0]) {
      // Another loan already claimed this bank credit reference.
      return;
    }

    const entry = await manager.save(
      manager.create(WalletEntry, {
        userId: row.userId,
        type: 'TOPUP',
        signedAmountIrr: BigInt(amountIrr),
      }),
    );

    await manager.query(
      `
      UPDATE "bank_loan_wallet_credits"
      SET "walletEntryId" = $2
      WHERE "creditReference" = $1
      `,
      [creditRef, entry.id],
    );

    await manager.query(
      `
      UPDATE "bank_loan_applications"
      SET "walletCreditReference" = $2, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1 AND "walletCreditReference" IS NULL
      `,
      [row.id, creditRef],
    );
    row.walletCreditReference = creditRef;
  }
}

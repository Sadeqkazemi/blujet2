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
import { BankLoanWebhookEvent } from '../../database/entities/bank-loan-webhook-event.entity';
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
import { canTransitionBankStatus } from './loan-status.transitions';
import { redactWebhookPayload } from './loan-webhook-redact';

function asJsonSummary(
  summary: Record<string, unknown> | null | undefined,
): JsonValue | null {
  if (summary == null) return null;
  return JSON.parse(JSON.stringify(summary)) as JsonValue;
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

    const existing = await this.loanRepo.findOne({
      where: { userId: actor.id, idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      return this.serialize(existing);
    }

    const correlationId = randomUUID();
    const bankRes = await this.bank.createApplication({
      correlationId,
      idempotencyKey: dto.idempotencyKey,
      requestedAmountIrr: dto.requestedAmountIrr,
      customerExternalId: actor.id,
    });

    const saved = await this.dataSource.transaction(async (manager) => {
      const raced = await manager.findOne(BankLoanApplication, {
        where: { userId: actor.id, idempotencyKey: dto.idempotencyKey },
        lock: { mode: 'pessimistic_write' },
      });
      if (raced) {
        if (raced.userId !== actor.id) {
          throw new BadRequestException({
            code: ErrorCode.CONFLICT,
            message: 'کلید تکراری متعلق به کاربر دیگری است.',
          });
        }
        return raced;
      }

      try {
        const row = await manager.save(
          manager.create(BankLoanApplication, {
            userId: actor.id,
            idempotencyKey: dto.idempotencyKey,
            bankReferenceId: bankRes.bankReferenceId,
            requestedAmountIrr: BigInt(dto.requestedAmountIrr),
            bankStatus: bankRes.bankStatus,
            statusSummary: asJsonSummary(bankRes.summary),
            lastSyncedAt: new Date(),
          }),
        );

        await this.maybeCreditWallet(
          manager,
          row,
          bankRes.bankStatus,
          bankRes.walletCreditIrr,
          bankRes.walletCreditReference,
        );
        return row;
      } catch (err: unknown) {
        const code =
          typeof err === 'object' && err && 'code' in err
            ? String((err as { code?: string }).code)
            : '';
        if (code !== '23505') throw err;
        const existingAfterRace = await manager.findOne(BankLoanApplication, {
          where: { userId: actor.id, idempotencyKey: dto.idempotencyKey },
        });
        if (!existingAfterRace || existingAfterRace.userId !== actor.id) {
          throw new BadRequestException({
            code: ErrorCode.CONFLICT,
            message: 'کلید تکراری قابل بازیابی نیست.',
          });
        }
        return existingAfterRace;
      }
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
      const existingEvent = await manager.findOne(BankLoanWebhookEvent, {
        where: { provider, eventId: opts.eventId },
      });
      if (existingEvent) {
        return 'DUPLICATE';
      }

      const locked = await manager.findOne(BankLoanApplication, {
        where: { id: row.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        await this.persistWebhookEvent(manager, {
          provider,
          eventId: opts.eventId,
          bankReferenceId: row.bankReferenceId,
          loanApplicationId: row.id,
          bankStatus,
          occurredAt: opts.occurredAt,
          payload: opts.sourcePayload,
          processingResult: 'IGNORED_MISSING_LOAN',
        });
        return 'IGNORED_MISSING_LOAN';
      }

      // Stale / replay: older event must not move status after a newer one.
      if (
        locked.lastWebhookOccurredAt &&
        opts.occurredAt.getTime() < locked.lastWebhookOccurredAt.getTime() &&
        bankStatus !== locked.bankStatus
      ) {
        await this.persistWebhookEvent(manager, {
          provider,
          eventId: opts.eventId,
          bankReferenceId: locked.bankReferenceId,
          loanApplicationId: locked.id,
          bankStatus,
          occurredAt: opts.occurredAt,
          payload: opts.sourcePayload,
          processingResult: 'IGNORED_STALE',
        });
        return 'IGNORED_STALE';
      }

      if (!canTransitionBankStatus(locked.bankStatus, bankStatus)) {
        await this.persistWebhookEvent(manager, {
          provider,
          eventId: opts.eventId,
          bankReferenceId: locked.bankReferenceId,
          loanApplicationId: locked.id,
          bankStatus,
          occurredAt: opts.occurredAt,
          payload: opts.sourcePayload,
          processingResult: 'IGNORED_TRANSITION',
        });
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

      await this.persistWebhookEvent(manager, {
        provider,
        eventId: opts.eventId,
        bankReferenceId: locked.bankReferenceId,
        loanApplicationId: locked.id,
        bankStatus,
        occurredAt: opts.occurredAt,
        payload: opts.sourcePayload,
        processingResult: 'APPLIED',
      });
      return 'APPLIED';
    });
  }

  private async persistWebhookEvent(
    manager: EntityManager,
    args: {
      provider: string;
      eventId: string;
      bankReferenceId: string | null;
      loanApplicationId: string | null;
      bankStatus: string | null;
      occurredAt: Date | null;
      payload: Record<string, unknown>;
      processingResult: string;
    },
  ) {
    try {
      await manager.save(
        manager.create(BankLoanWebhookEvent, {
          provider: args.provider,
          eventId: args.eventId,
          bankReferenceId: args.bankReferenceId,
          loanApplicationId: args.loanApplicationId,
          bankStatus: args.bankStatus,
          occurredAt: args.occurredAt,
          payloadRedacted: redactWebhookPayload(args.payload),
          processingResult: args.processingResult,
        }),
      );
    } catch (err: unknown) {
      // Concurrent insert of the same (provider, eventId) → treat as duplicate.
      const code =
        typeof err === 'object' && err && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code !== '23505') throw err;
    }
  }

  /**
   * Credits wallet only when bank status is exactly DISBURSED, amount matches
   * the original request, and a unique bank walletCreditReference is present.
   * Wallet insert + reference write are atomic under the loan row lock.
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

    const prior = await manager.findOne(BankLoanApplication, {
      where: { walletCreditReference: creditRef },
    });
    if (prior) return;

    try {
      await manager.save(
        manager.create(WalletEntry, {
          userId: row.userId,
          type: 'TOPUP',
          signedAmountIrr: BigInt(amountIrr),
        }),
      );
      row.walletCreditReference = creditRef;
      await manager.save(row);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === '23505') {
        // Concurrent DISBURSED race lost the unique walletCreditReference.
        const fresh = await manager.findOne(BankLoanApplication, {
          where: { id: row.id },
        });
        if (fresh?.walletCreditReference) {
          row.walletCreditReference = fresh.walletCreditReference;
        }
        return;
      }
      throw err;
    }
  }
}

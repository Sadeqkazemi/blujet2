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

  async create(actor: AuthenticatedUser, dto: {
    requestedAmountIrr: string;
    idempotencyKey: string;
  }) {
    if (!/^\d+$/.test(dto.requestedAmountIrr) || BigInt(dto.requestedAmountIrr) <= 0n) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'مبلغ درخواستی نامعتبر است.',
      });
    }

    const existing = await this.loanRepo.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      if (existing.userId !== actor.id) {
        throw new BadRequestException({
          code: ErrorCode.CONFLICT,
          message: 'کلید تکراری متعلق به کاربر دیگری است.',
        });
      }
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
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (raced) return raced;

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
        bankRes.walletCreditIrr,
        bankRes.walletCreditReference,
      );
      return row;
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
        // never log tokens / full payloads
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
    const status = await this.bank.getStatus(row.bankReferenceId, correlationId);
    await this.applyBankUpdate(row, status.bankStatus, status.summary, {
      walletCreditIrr: status.walletCreditIrr,
      walletCreditReference: status.walletCreditReference,
      eventId: `poll:${correlationId}`,
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
      // Ack without leaking existence details beyond not-found for ops logs.
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'درخواست یافت نشد.',
      });
    }

    if (row.lastWebhookEventId === payload.eventId) {
      return { ok: true, duplicate: true };
    }

    await this.applyBankUpdate(
      row,
      parseBankStatus(payload.status),
      payload.summary ?? { status: payload.status },
      {
        walletCreditIrr: payload.walletCreditIrr,
        walletCreditReference: payload.walletCreditReference,
        eventId: payload.eventId,
      },
    );

    // No AuditLog row: actorId is FK to users and webhooks are unauthenticated.
    // Provenance is lastWebhookEventId + statusSummary on the loan row.
    return { ok: true, duplicate: false };
  }

  private async applyBankUpdate(
    row: BankLoanApplication,
    bankStatus: BankLoanStatus,
    summary: Record<string, unknown> | null | undefined,
    opts: {
      walletCreditIrr?: string | null;
      walletCreditReference?: string | null;
      eventId: string;
    },
  ) {
    await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(BankLoanApplication, {
        where: { id: row.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) return;
      if (locked.lastWebhookEventId === opts.eventId) return;

      locked.bankStatus = bankStatus;
      locked.statusSummary =
        asJsonSummary(summary) ?? locked.statusSummary;
      locked.lastSyncedAt = new Date();
      locked.lastWebhookEventId = opts.eventId;
      await manager.save(locked);

      await this.maybeCreditWallet(
        manager,
        locked,
        opts.walletCreditIrr,
        opts.walletCreditReference,
      );
    });
  }

  private async maybeCreditWallet(
    manager: EntityManager,
    row: BankLoanApplication,
    amountIrr: string | null | undefined,
    creditRef: string | null | undefined,
  ) {
    if (!amountIrr || !creditRef) return;
    if (!/^\d+$/.test(amountIrr) || BigInt(amountIrr) <= 0n) return;
    if (row.walletCreditReference) return;

    // Unique bank disbursement reference — skip if already used.
    const prior = await manager.findOne(BankLoanApplication, {
      where: { walletCreditReference: creditRef },
    });
    if (prior) return;

    await manager.save(
      manager.create(WalletEntry, {
        userId: row.userId,
        type: 'TOPUP',
        signedAmountIrr: BigInt(amountIrr),
      }),
    );
    row.walletCreditReference = creditRef;
    await manager.save(row);
  }
}

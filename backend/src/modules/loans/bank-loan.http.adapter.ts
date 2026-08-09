import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '../../common/errors';
import { CircuitBreaker } from './circuit-breaker';
import {
  parseBankStatus,
  type BankCreateLoanRequest,
  type BankCreateLoanResponse,
  type BankLoanProvider,
  type BankLoanStatusResponse,
} from './bank-loan.types';

export const BANK_LOAN_PROVIDER = Symbol('BANK_LOAN_PROVIDER');

/**
 * Config-driven HTTP adapter. Bank name/URLs never hard-coded — all from env.
 * No local fabricated sandbox responses; tests mock fetch at the HTTP boundary.
 */
@Injectable()
export class BankLoanHttpAdapter implements BankLoanProvider {
  private readonly logger = new Logger(BankLoanHttpAdapter.name);
  private readonly breaker = new CircuitBreaker();

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return (this.config.get<string>('BANK_LOAN_API_BASE_URL') ?? '').replace(
      /\/$/,
      '',
    );
  }

  private apiKey(): string {
    return this.config.get<string>('BANK_LOAN_API_KEY') ?? '';
  }

  private timeoutMs(): number {
    const raw = this.config.get<string>('BANK_LOAN_TIMEOUT_MS') ?? '5000';
    const n = Number(raw);
    return Number.isFinite(n) && n >= 500 ? n : 5000;
  }

  private assertConfigured() {
    if (!this.baseUrl() || !this.apiKey()) {
      throw new ServiceUnavailableException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'سرویس وام بانکی در حال حاضر در دسترس نیست.',
      });
    }
  }

  private async requestJson(
    path: string,
    init: RequestInit & { correlationId: string },
    attempt = 1,
  ): Promise<unknown> {
    this.assertConfigured();
    try {
      this.breaker.assertClosed();
    } catch {
      throw new ServiceUnavailableException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'سرویس وام بانکی موقتاً در دسترس نیست.',
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      const res = await fetch(`${this.baseUrl()}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          authorization: `Bearer ${this.apiKey()}`,
          'x-correlation-id': init.correlationId,
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok) {
        this.breaker.recordFailure();
        // Never surface bank error bodies to callers.
        this.logger.warn({
          msg: 'bank_loan_http_error',
          status: res.status,
          correlationId: init.correlationId,
          attempt,
        });
        if (res.status >= 500 && attempt < 3) {
          await new Promise((r) => setTimeout(r, 200 * attempt * attempt));
          return this.requestJson(path, init, attempt + 1);
        }
        throw new ServiceUnavailableException({
          code: ErrorCode.INTERNAL_ERROR,
          message: 'ارتباط با بانک برقرار نشد. لطفاً بعداً تلاش کنید.',
        });
      }
      this.breaker.recordSuccess();
      return (await res.json()) as unknown;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.breaker.recordFailure();
      this.logger.warn({
        msg: 'bank_loan_http_transport_error',
        correlationId: init.correlationId,
        attempt,
      });
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 200 * attempt * attempt));
        return this.requestJson(path, init, attempt + 1);
      }
      throw new ServiceUnavailableException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'ارتباط با بانک برقرار نشد. لطفاً بعداً تلاش کنید.',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async createApplication(
    req: BankCreateLoanRequest,
  ): Promise<BankCreateLoanResponse> {
    const body = await this.requestJson('/v1/loan-applications', {
      method: 'POST',
      correlationId: req.correlationId,
      headers: { 'idempotency-key': req.idempotencyKey },
      body: JSON.stringify({
        amountIrr: req.requestedAmountIrr,
        customerId: req.customerExternalId,
        currency: 'IRR',
      }),
    });
    const o = body as Record<string, unknown>;
    const bankReferenceId = String(o.referenceId ?? o.bankReferenceId ?? '');
    if (!bankReferenceId) {
      throw new ServiceUnavailableException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'پاسخ بانک ناقص بود.',
      });
    }
    return {
      bankReferenceId,
      bankStatus: parseBankStatus(String(o.status ?? 'SUBMITTED')),
      walletCreditIrr:
        o.walletCreditIrr != null ? String(o.walletCreditIrr) : null,
      walletCreditReference:
        o.walletCreditReference != null
          ? String(o.walletCreditReference)
          : null,
      summary: {
        status: o.status,
        updatedAt: o.updatedAt,
      },
    };
  }

  async getStatus(
    bankReferenceId: string,
    correlationId: string,
  ): Promise<BankLoanStatusResponse> {
    const body = await this.requestJson(
      `/v1/loan-applications/${encodeURIComponent(bankReferenceId)}`,
      { method: 'GET', correlationId },
    );
    const o = body as Record<string, unknown>;
    return {
      bankReferenceId,
      bankStatus: parseBankStatus(String(o.status ?? 'UNKNOWN')),
      walletCreditIrr:
        o.walletCreditIrr != null ? String(o.walletCreditIrr) : null,
      walletCreditReference:
        o.walletCreditReference != null
          ? String(o.walletCreditReference)
          : null,
      summary: {
        status: o.status,
        updatedAt: o.updatedAt,
      },
    };
  }
}

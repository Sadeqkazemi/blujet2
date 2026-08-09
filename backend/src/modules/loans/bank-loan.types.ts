import type { BankLoanStatus } from '../../database/enums';

/** Display statuses for customer / admin UI — never invent bank decisions. */
export type LoanDisplayStatus =
  | 'awaiting_bank'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'cancelled'
  | 'failed'
  | 'unknown';

export function mapBankStatusToDisplay(
  status: BankLoanStatus,
): LoanDisplayStatus {
  switch (status) {
    case 'SUBMITTED':
    case 'PENDING':
      return 'awaiting_bank';
    case 'UNDER_REVIEW':
      return 'under_review';
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'DISBURSED':
      return 'disbursed';
    case 'CANCELLED':
      return 'cancelled';
    case 'FAILED':
      return 'failed';
    default:
      return 'unknown';
  }
}

export function parseBankStatus(raw: string | undefined | null): BankLoanStatus {
  const v = (raw ?? '').toUpperCase();
  const allowed = new Set([
    'SUBMITTED',
    'PENDING',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'DISBURSED',
    'CANCELLED',
    'FAILED',
  ]);
  if (allowed.has(v)) return v as BankLoanStatus;
  return 'UNKNOWN';
}

export interface BankCreateLoanRequest {
  correlationId: string;
  idempotencyKey: string;
  requestedAmountIrr: string;
  customerExternalId: string;
}

export interface BankCreateLoanResponse {
  bankReferenceId: string;
  bankStatus: BankLoanStatus;
  /** When bank explicitly instructs wallet credit. */
  walletCreditIrr?: string | null;
  walletCreditReference?: string | null;
  summary?: Record<string, unknown>;
}

export interface BankLoanStatusResponse {
  bankReferenceId: string;
  bankStatus: BankLoanStatus;
  walletCreditIrr?: string | null;
  walletCreditReference?: string | null;
  summary?: Record<string, unknown>;
}

export interface BankLoanProvider {
  createApplication(
    req: BankCreateLoanRequest,
  ): Promise<BankCreateLoanResponse>;
  getStatus(bankReferenceId: string, correlationId: string): Promise<BankLoanStatusResponse>;
}

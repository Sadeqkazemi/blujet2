/**
 * Stable, English error codes returned in the API envelope's `error.code`.
 * User-facing `error.message` text is always Persian; codes never change
 * once shipped (clients/tests may depend on them).
 */
export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED',
  TEMPORARY_ACCESS_EXPIRED = 'TEMPORARY_ACCESS_EXPIRED',
  // Phase 13 — reservation engine completion
  SALE_WINDOW_CLOSED = 'SALE_WINDOW_CLOSED',
  POOL_EXHAUSTED = 'POOL_EXHAUSTED',
  CAPACITY_BELOW_CONFIRMED = 'CAPACITY_BELOW_CONFIRMED',
  LOCK_CAP_EXCEEDED = 'LOCK_CAP_EXCEEDED',
  FLIGHT_NOT_DEPARTED = 'FLIGHT_NOT_DEPARTED',
  // Phase 66 — passenger survey
  SURVEY_ALREADY_SUBMITTED = 'SURVEY_ALREADY_SUBMITTED',
  SURVEY_DISABLED = 'SURVEY_DISABLED',
  // UAT shared-password addendum — identity-only sandbox agency account
  UAT_TEMPORARY_ACCOUNT_READ_ONLY = 'UAT_TEMPORARY_ACCOUNT_READ_ONLY',
}

export interface ApiErrorBody {
  code: ErrorCode | string;
  message: string;
}

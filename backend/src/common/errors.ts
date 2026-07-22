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
  // Phase 13 — reservation engine completion
  SALE_WINDOW_CLOSED = 'SALE_WINDOW_CLOSED',
  POOL_EXHAUSTED = 'POOL_EXHAUSTED',
  CAPACITY_BELOW_CONFIRMED = 'CAPACITY_BELOW_CONFIRMED',
  LOCK_CAP_EXCEEDED = 'LOCK_CAP_EXCEEDED',
}

export interface ApiErrorBody {
  code: ErrorCode | string;
  message: string;
}

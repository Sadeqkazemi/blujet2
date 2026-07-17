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
}

export interface ApiErrorBody {
  code: ErrorCode | string;
  message: string;
}

import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../api/envelope';
import { DEV_OTP_CODE, canDevOtpFallback, isDevOtpMockSend } from './dev-otp';

describe('isDevOtpMockSend', () => {
  it('is disabled under vitest', () => {
    expect(isDevOtpMockSend()).toBe(false);
  });

  it('exposes the shared dev OTP code', () => {
    expect(DEV_OTP_CODE).toBe('123456');
  });
});

describe('canDevOtpFallback', () => {
  it('allows fallback for network failures', () => {
    expect(canDevOtpFallback(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('blocks fallback for client auth errors from a live backend', () => {
    expect(canDevOtpFallback(new ApiRequestError('TWO_FACTOR_INVALID', 'کد نامعتبر است.', 401))).toBe(false);
  });

  it('allows fallback for server errors', () => {
    expect(canDevOtpFallback(new ApiRequestError('INTERNAL', 'خطا', 500))).toBe(true);
  });
});

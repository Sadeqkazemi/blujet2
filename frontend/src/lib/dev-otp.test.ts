import { describe, expect, it } from 'vitest';
import { DEV_OTP_CODE, isDevOtpMockSend } from './dev-otp';

describe('isDevOtpMockSend', () => {
  it('is disabled under vitest', () => {
    expect(isDevOtpMockSend()).toBe(false);
  });

  it('exposes the shared dev OTP code', () => {
    expect(DEV_OTP_CODE).toBe('123456');
  });
});

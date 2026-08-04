import { describe, expect, it } from 'vitest';
import {
  MOCK_CUSTOMER_OTP_CODE,
  mockRequestOtp,
  mockVerifyOtp,
  isMockOtpChallenge,
} from './mock-customer-otp';

describe('mock-customer-otp', () => {
  it('issues a mock challenge and accepts the fixed code', () => {
    const challengeId = mockRequestOtp('09121234567');
    expect(isMockOtpChallenge(challengeId)).toBe(true);

    const user = mockVerifyOtp(challengeId, MOCK_CUSTOMER_OTP_CODE);
    expect(user.role).toBe('USER');
    expect(user.fullName).toBe('09121234567');
  });

  it('normalizes Persian digits in the code', () => {
    const challengeId = mockRequestOtp('09120000001');
    const user = mockVerifyOtp(challengeId, '۱۲۳۴۵۶');
    expect(user.fullName).toBe('09120000001');
  });

  it('rejects wrong codes', () => {
    const challengeId = mockRequestOtp('09121234567');
    expect(() => mockVerifyOtp(challengeId, '000000')).toThrow('INVALID_MOCK_OTP');
  });
});

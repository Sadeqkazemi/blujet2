import { normalizeIranMobile } from './fa-format';
import type { AuthUser } from '../types/auth';

/** Fixed dev OTP — shown on screen; no SMS/backend required. */
export const MOCK_CUSTOMER_OTP_CODE = '123456';

const challenges = new Map<string, { phone: string; code: string }>();

/** Dev-only mock OTP. Enabled by default in Vite dev unless VITE_MOCK_OTP=false. */
export function isMockOtpEnabled(): boolean {
  if (import.meta.env.VITE_MOCK_OTP === 'true') return true;
  if (import.meta.env.VITE_MOCK_OTP === 'false') return false;
  return import.meta.env.DEV;
}

export function mockRequestOtp(phone: string): string {
  const normalized = normalizeIranMobile(phone);
  const challengeId = `mock-${crypto.randomUUID()}`;
  challenges.set(challengeId, { phone: normalized, code: MOCK_CUSTOMER_OTP_CODE });
  return challengeId;
}

export function mockVerifyOtp(challengeId: string, code: string): AuthUser {
  const entry = challenges.get(challengeId);
  const normalized = normalizeIranMobile(code);
  if (!entry || entry.code !== normalized) {
    throw new Error('INVALID_MOCK_OTP');
  }
  challenges.delete(challengeId);
  return {
    id: 'mock-customer',
    fullName: entry.phone,
    role: 'USER',
    preferredLocale: 'FA',
    mustChangePassword: false,
  };
}

export function isMockOtpChallenge(challengeId: string): boolean {
  return challengeId.startsWith('mock-');
}

import { apiGet, apiPatch, apiPost } from './http';
import { setAccessToken } from './token-store';
import { latinDigits } from '../lib/fa-format';
import type { AuthUser, Locale } from '../types/auth';

function normalizePhone(phone: string) {
  return latinDigits(phone).replace(/\s/g, '');
}

function normalizeOtpCode(code: string) {
  return latinDigits(code).replace(/\D/g, '');
}

export function staffLogin(username: string, password: string) {
  return apiPost<{ challengeId: string }>('/auth/staff/login', { username, password });
}

export async function agencyLogin(phone: string, password: string) {
  const result = await apiPost<{ accessToken: string; user: AuthUser }>('/auth/agency/login', {
    phone,
    password,
  });
  setAccessToken(result.accessToken);
  return result;
}

export async function verifyTwoFactor(challengeId: string, code: string) {
  const result = await apiPost<{ accessToken: string; user: AuthUser }>('/auth/staff/login/verify', {
    challengeId,
    code,
  });
  setAccessToken(result.accessToken);
  return result;
}

export async function refreshSession() {
  const result = await apiPost<{ accessToken: string }>('/auth/refresh');
  setAccessToken(result.accessToken);
  return result;
}

export async function logout() {
  try {
    await apiPost('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

export function fetchMe() {
  return apiGet<AuthUser>('/auth/me');
}

export function updateMyLocale(locale: Locale) {
  return apiPatch<{ preferredLocale: Locale }>('/auth/me/locale', { locale });
}

export function requestOtp(phone: string) {
  return apiPost<{ challengeId: string }>('/auth/otp/request', { phone: normalizePhone(phone) });
}

export type StepUpScope =
  | 'ADMIN_ROLE_CHANGE'
  | 'API_KEY_ROTATE'
  | 'REFUND_PAYOUT'
  | 'PRICE_CAPACITY_CHANGE'
  | 'SESSION_REVOKE';

export function requestStepUp(scope: StepUpScope) {
  return apiPost<{ challengeId: string }>('/auth/step-up/request', { scope });
}

export async function verifyOtp(challengeId: string, code: string) {
  const result = await apiPost<{ accessToken: string; user: AuthUser }>('/auth/otp/verify', {
    challengeId,
    code: normalizeOtpCode(code),
  });
  setAccessToken(result.accessToken);
  return result;
}

/** فراموشی رمز — sets a new password once the caller is already
 * authenticated via OTP; no current password required. */
export function setPassword(newPassword: string) {
  return apiPost<{ changed: boolean }>('/auth/set-password', { newPassword });
}

export function changeOwnPassword(currentPassword: string, newPassword: string) {
  return apiPost<{ changed: boolean }>('/auth/change-password', { currentPassword, newPassword });
}

/** فراموشی رمز — email path (Phase 51): an alternative to phone+SMS OTP for
 * customers whose account has a verified email. */
export function requestPasswordResetEmail(email: string) {
  return apiPost<{ challengeId: string }>('/auth/password-reset/email/request', { email });
}

export async function verifyPasswordResetEmail(challengeId: string, code: string) {
  const result = await apiPost<{ accessToken: string; user: AuthUser }>('/auth/password-reset/email/verify', {
    challengeId,
    code,
  });
  setAccessToken(result.accessToken);
  return result;
}

export async function customerPasswordLogin(phone: string, password: string) {
  const result = await apiPost<{ accessToken: string; user: AuthUser }>('/auth/customer/login-password', {
    phone: normalizePhone(phone),
    password,
  });
  setAccessToken(result.accessToken);
  return result;
}

/** Agency forgot-password — step 1: SMS OTP to the agency account phone. */
export function requestAgencyPasswordReset(phone: string) {
  return apiPost<{ challengeId: string }>('/auth/agency/password-reset/request', { phone });
}

/** Agency forgot-password — step 2: verify OTP and issue a short-lived token for set-password. */
export async function verifyAgencyPasswordReset(challengeId: string, code: string) {
  const result = await apiPost<{ accessToken: string; user: AuthUser }>(
    '/auth/agency/password-reset/verify',
    { challengeId, code },
  );
  setAccessToken(result.accessToken);
  return result;
}

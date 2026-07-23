import { apiGet, apiPost } from './http';
import { setAccessToken } from './token-store';
import type { AuthUser } from '../types/auth';

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

export function requestOtp(phone: string) {
  return apiPost<{ challengeId: string }>('/auth/otp/request', { phone });
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
    code,
  });
  setAccessToken(result.accessToken);
  return result;
}

import { ApiRequestError } from '../api/envelope';

/** Fixed OTP for local/dev login when SMS is mocked (matches backend DEV code). */
export const DEV_OTP_CODE = '123456';

/** Design-parity mock send: skip SMS/API on send, request OTP only on verify. */
export function isDevOtpMockSend(): boolean {
  return import.meta.env.DEV && import.meta.env.MODE !== 'test' && import.meta.env.VITE_MOCK_OTP_SEND !== 'false';
}

/** True when a dev mock login may bypass a unreachable backend (not for 4xx auth errors). */
export function canDevOtpFallback(err: unknown): boolean {
  if (err instanceof ApiRequestError) {
    return err.status >= 500;
  }
  return true;
}

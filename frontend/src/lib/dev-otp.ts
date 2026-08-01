/** Fixed OTP for local/dev login when SMS is mocked (matches backend DEV code). */
export const DEV_OTP_CODE = '123456';

/** Design-parity mock send: skip SMS/API on send, request OTP only on verify. */
export function isDevOtpMockSend(): boolean {
  return import.meta.env.DEV && import.meta.env.MODE !== 'test' && import.meta.env.VITE_MOCK_OTP_SEND !== 'false';
}

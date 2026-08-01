import * as crypto from 'crypto';

const DEFAULT_DEV_OTP = '123456';

/** Issue OTP codes. In non-production, returns a fixed dev code (123456 by
 * default, overridable via DEV_FIXED_OTP_CODE) so local login never needs
 * log scraping. Production always uses cryptographically random codes. */
export function generateOtpCode(): string {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.DEV_FIXED_OTP_CODE) {
      throw new Error('DEV_FIXED_OTP_CODE must not be set in production.');
    }
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  }
  const fixed = process.env.DEV_FIXED_OTP_CODE?.trim();
  if (fixed) {
    if (!/^\d{6}$/.test(fixed)) {
      throw new Error('DEV_FIXED_OTP_CODE must be exactly 6 digits.');
    }
    return fixed;
  }
  return DEFAULT_DEV_OTP;
}

import { generateOtpCode } from './generate-otp-code';

describe('generateOtpCode', () => {
  const prevEnv = process.env;

  beforeEach(() => {
    process.env = { ...prevEnv };
  });

  afterAll(() => {
    process.env = prevEnv;
  });

  it('returns 123456 in development by default', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DEV_FIXED_OTP_CODE;
    expect(generateOtpCode()).toBe('123456');
  });

  it('returns DEV_FIXED_OTP_CODE when set in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_FIXED_OTP_CODE = '654321';
    expect(generateOtpCode()).toBe('654321');
  });

  it('returns a random 6-digit code in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DEV_FIXED_OTP_CODE;
    expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it('throws if DEV_FIXED_OTP_CODE is set in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEV_FIXED_OTP_CODE = '123456';
    expect(() => generateOtpCode()).toThrow(/DEV_FIXED_OTP_CODE/);
  });
});

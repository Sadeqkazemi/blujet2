import { generateOtpCode } from './generate-otp-code';

describe('generateOtpCode', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env, NODE_ENV: 'development' };
    delete process.env.DEV_FIXED_OTP_CODE;
  });

  afterAll(() => {
    process.env = env;
  });

  it('returns 123456 in non-production by default', () => {
    expect(generateOtpCode()).toBe('123456');
  });

  it('honours DEV_FIXED_OTP_CODE in development', () => {
    process.env.DEV_FIXED_OTP_CODE = '654321';
    expect(generateOtpCode()).toBe('654321');
  });

  it('uses random codes in production', () => {
    process.env.NODE_ENV = 'production';
    const a = generateOtpCode();
    const b = generateOtpCode();
    expect(a).toMatch(/^\d{6}$/);
    expect(b).toMatch(/^\d{6}$/);
    expect(a === b && a === '123456').toBe(false);
  });

  it('rejects DEV_FIXED_OTP_CODE in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEV_FIXED_OTP_CODE = '123456';
    expect(() => generateOtpCode()).toThrow(/DEV_FIXED_OTP_CODE/);
  });

  it('rejects invalid DEV_FIXED_OTP_CODE', () => {
    process.env.DEV_FIXED_OTP_CODE = 'abc';
    expect(() => generateOtpCode()).toThrow(/6 digits/);
  });
});

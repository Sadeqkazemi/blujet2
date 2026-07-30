import { KavenegarSmsProvider } from './kavenegar-sms.provider';

describe('KavenegarSmsProvider (unit)', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.KAVENEGAR_API_KEY;
  const originalSender = process.env.KAVENEGAR_SENDER_LINE;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.KAVENEGAR_API_KEY = originalKey;
    process.env.KAVENEGAR_SENDER_LINE = originalSender;
  });

  it('throws at construction time when KAVENEGAR_API_KEY is unset', () => {
    delete process.env.KAVENEGAR_API_KEY;
    expect(() => new KavenegarSmsProvider()).toThrow(
      'KAVENEGAR_API_KEY is required when SMS_PROVIDER=kavenegar',
    );
  });

  it('sends via the Kavenegar REST API and reports success on status 200', async () => {
    process.env.KAVENEGAR_API_KEY = 'test-key';
    process.env.KAVENEGAR_SENDER_LINE = '10008663';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ return: { status: 200, message: 'تایید شد' } }),
    });
    global.fetch = fetchMock;

    const provider = new KavenegarSmsProvider();
    const result = await provider.send('09121234567', 'کد شما: 1234', 'OTP');

    expect(result).toEqual({ success: true });
    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    expect(calledUrl).toContain(
      'https://api.kavenegar.com/v1/test-key/sms/send.json',
    );
    expect(calledUrl).toContain('receptor=09121234567');
    expect(calledUrl).toContain('sender=10008663');
  });

  it('reports a real failure (never fabricated) when Kavenegar returns a non-200 status', async () => {
    process.env.KAVENEGAR_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          return: { status: 412, message: 'اعتبار حساب کافی نیست' },
        }),
    });

    const provider = new KavenegarSmsProvider();
    const result = await provider.send('09121234567', 'پیام', 'OTP');

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('اعتبار حساب کافی نیست');
  });

  it('catches a network error and reports it as a failure instead of throwing', async () => {
    process.env.KAVENEGAR_API_KEY = 'test-key';
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network unreachable'));

    const provider = new KavenegarSmsProvider();
    const result = await provider.send('09121234567', 'پیام', 'OTP');

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('network unreachable');
  });
});

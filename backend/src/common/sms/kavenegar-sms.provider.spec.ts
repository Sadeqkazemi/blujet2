import { Repository } from 'typeorm';
import { KavenegarSmsProvider } from './kavenegar-sms.provider';
import { MockSmsProvider } from './mock-sms.provider';
import { ExternalServiceConfig } from '../../database/entities/external-service-config.entity';
import { encryptPii } from '../pii-crypto';

describe('KavenegarSmsProvider (unit)', () => {
  const originalFetch = global.fetch;
  const originalSender = process.env.KAVENEGAR_SENDER_LINE;

  beforeAll(() => {
    process.env.PII_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.KAVENEGAR_SENDER_LINE = originalSender;
  });

  function makeConfigRepo(config: unknown) {
    return {
      findOneBy: jest.fn().mockResolvedValue(config),
    } as unknown as Repository<ExternalServiceConfig>;
  }

  it('falls back to the mock provider when no ExternalServiceConfig row exists (never a real network call)', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const mock = new MockSmsProvider();
    const mockSend = jest.spyOn(mock, 'send');

    const provider = new KavenegarSmsProvider(makeConfigRepo(null), mock);
    const result = await provider.send('09121234567', 'کد شما: 1234', 'OTP');

    expect(result).toEqual({ success: true });
    expect(mockSend).toHaveBeenCalledWith('09121234567', 'کد شما: 1234', 'OTP');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the mock provider when the IT panel row is disabled', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const mock = new MockSmsProvider();

    const provider = new KavenegarSmsProvider(
      makeConfigRepo({
        enabled: false,
        apiKeyEncrypted: encryptPii('real-key'),
      }),
      mock,
    );
    const result = await provider.send('09121234567', 'پیام', 'OTP');

    expect(result).toEqual({ success: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the mock provider when the row is enabled but has no key configured yet', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const mock = new MockSmsProvider();

    const provider = new KavenegarSmsProvider(
      makeConfigRepo({ enabled: true, apiKeyEncrypted: null }),
      mock,
    );
    const result = await provider.send('09121234567', 'پیام', 'OTP');

    expect(result).toEqual({ success: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends via the real Kavenegar REST API using the decrypted IT-panel key, and reports success on status 200', async () => {
    process.env.KAVENEGAR_SENDER_LINE = '10008663';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ return: { status: 200, message: 'تایید شد' } }),
    });
    global.fetch = fetchMock;

    const provider = new KavenegarSmsProvider(
      makeConfigRepo({
        enabled: true,
        apiKeyEncrypted: encryptPii('real-kavenegar-key'),
      }),
      new MockSmsProvider(),
    );
    const result = await provider.send('09121234567', 'کد شما: 1234', 'OTP');

    expect(result).toEqual({ success: true });
    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    expect(calledUrl).toContain(
      'https://api.kavenegar.com/v1/real-kavenegar-key/sms/send.json',
    );
    expect(calledUrl).toContain('receptor=09121234567');
    expect(calledUrl).toContain('sender=10008663');
  });

  it('reports a real failure (never fabricated) when Kavenegar returns a non-200 status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          return: { status: 412, message: 'اعتبار حساب کافی نیست' },
        }),
    });

    const provider = new KavenegarSmsProvider(
      makeConfigRepo({
        enabled: true,
        apiKeyEncrypted: encryptPii('real-key'),
      }),
      new MockSmsProvider(),
    );
    const result = await provider.send('09121234567', 'پیام', 'OTP');

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('اعتبار حساب کافی نیست');
  });

  it('catches a network error and reports it as a failure instead of throwing', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network unreachable'));

    const provider = new KavenegarSmsProvider(
      makeConfigRepo({
        enabled: true,
        apiKeyEncrypted: encryptPii('real-key'),
      }),
      new MockSmsProvider(),
    );
    const result = await provider.send('09121234567', 'پیام', 'OTP');

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('network unreachable');
  });
});

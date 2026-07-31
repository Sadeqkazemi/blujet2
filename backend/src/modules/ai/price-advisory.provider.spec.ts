import { MlPriceAdvisoryProvider } from './price-advisory.provider';

describe('MlPriceAdvisoryProvider (unit)', () => {
  const originalUrl = process.env.ML_SERVICE_URL;
  const originalToken = process.env.ML_SERVICE_INTERNAL_TOKEN;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.ML_SERVICE_URL = originalUrl;
    process.env.ML_SERVICE_INTERNAL_TOKEN = originalToken;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns ADVISORY_UNAVAILABLE when ML env vars are unset', async () => {
    delete process.env.ML_SERVICE_URL;
    delete process.env.ML_SERVICE_INTERNAL_TOKEN;
    const provider = new MlPriceAdvisoryProvider();
    await expect(
      provider.advise({ origin: 'THR', dest: 'MHD', date: '2026-08-01' }),
    ).resolves.toEqual({ available: false, reason: 'ADVISORY_UNAVAILABLE' });
  });

  it('returns ADVISORY_UNAVAILABLE when ml-service responds non-2xx', async () => {
    process.env.ML_SERVICE_URL = 'http://ml';
    process.env.ML_SERVICE_INTERNAL_TOKEN = 'tok';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const provider = new MlPriceAdvisoryProvider();
    await expect(
      provider.advise({ origin: 'THR', dest: 'MHD', date: '2026-08-01' }),
    ).resolves.toEqual({ available: false, reason: 'ADVISORY_UNAVAILABLE' });
  });

  it('returns ADVISORY_UNAVAILABLE when fetch throws', async () => {
    process.env.ML_SERVICE_URL = 'http://ml';
    process.env.ML_SERVICE_INTERNAL_TOKEN = 'tok';
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
    const provider = new MlPriceAdvisoryProvider();
    await expect(
      provider.advise({ origin: 'THR', dest: 'MHD', date: '2026-08-01' }),
    ).resolves.toEqual({ available: false, reason: 'ADVISORY_UNAVAILABLE' });
  });

  it('returns ADVISORY_UNAVAILABLE when recommendation enum is invalid', async () => {
    process.env.ML_SERVICE_URL = 'http://ml';
    process.env.ML_SERVICE_INTERNAL_TOKEN = 'tok';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          model_version: 'rec-v1',
          recommendation: 'MAYBE',
          explanation_fa: 'نامعتبر',
          confidence: 0.5,
        }),
    });
    const provider = new MlPriceAdvisoryProvider();
    await expect(
      provider.advise({ origin: 'THR', dest: 'MHD', date: '2026-08-01' }),
    ).resolves.toEqual({ available: false, reason: 'ADVISORY_UNAVAILABLE' });
  });

  it('returns an available advisory when ml-service responds with a valid payload', async () => {
    process.env.ML_SERVICE_URL = 'http://ml';
    process.env.ML_SERVICE_INTERNAL_TOKEN = 'tok';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          model_version: 'rec-v1',
          recommendation: 'BUY_NOW',
          explanation_fa: 'احتمال افزایش قیمت در ۴۸ ساعت آینده بالاست.',
          confidence: 0.82,
        }),
    });
    const provider = new MlPriceAdvisoryProvider();
    await expect(
      provider.advise(
        { origin: 'thr', dest: 'mhd', date: '2026-08-01', cabin: 'ECONOMY' },
        'req-1',
      ),
    ).resolves.toEqual({
      available: true,
      recommendation: 'BUY_NOW',
      explanationFa: 'احتمال افزایش قیمت در ۴۸ ساعت آینده بالاست.',
      modelVersion: 'rec-v1',
      confidence: 0.82,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://ml/internal/v1/recommendations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Internal-Token': 'tok',
          'X-Request-Id': 'req-1',
        }),
      }),
    );
  });
});

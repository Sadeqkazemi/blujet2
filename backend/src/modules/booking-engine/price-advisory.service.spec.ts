import { PriceAdvisoryService } from './price-advisory.service';
import type { PriceAdvisoryProvider } from '../ai/price-advisory.provider';

describe('PriceAdvisoryService (unit)', () => {
  it('delegates to the injected provider', async () => {
    const provider: PriceAdvisoryProvider = {
      advise: jest.fn().mockResolvedValue({
        available: false,
        reason: 'ADVISORY_UNAVAILABLE',
      }),
    };
    const service = new PriceAdvisoryService(provider);
    const input = { origin: 'THR', dest: 'MHD', date: '2026-08-01' };
    await expect(service.advise(input, 'rid')).resolves.toEqual({
      available: false,
      reason: 'ADVISORY_UNAVAILABLE',
    });
    expect(provider.advise).toHaveBeenCalledWith(input, 'rid');
  });
});

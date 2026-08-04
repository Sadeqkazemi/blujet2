import { describe, expect, it } from 'vitest';
import { GATEWAY_CHECKOUT_ENABLED } from './payment-config';

describe('payment-config', () => {
  it('defaults gateway checkout to disabled unless VITE_GATEWAY_CHECKOUT_ENABLED=true', () => {
    expect(GATEWAY_CHECKOUT_ENABLED).toBe(import.meta.env.VITE_GATEWAY_CHECKOUT_ENABLED === 'true');
  });
});

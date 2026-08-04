import { createPaymentGateway } from './payment-gateway.provider';
import { SandboxPaymentGateway } from './payment-gateway';

describe('createPaymentGateway (unit)', () => {
  const original = process.env.PAYMENT_GATEWAY_DRIVER;

  afterEach(() => {
    process.env.PAYMENT_GATEWAY_DRIVER = original;
  });

  it('defaults to SandboxPaymentGateway when env is unset', () => {
    delete process.env.PAYMENT_GATEWAY_DRIVER;
    const gateway = createPaymentGateway();
    expect(gateway).toBeInstanceOf(SandboxPaymentGateway);
  });

  it('returns SandboxPaymentGateway when driver is sandbox', () => {
    process.env.PAYMENT_GATEWAY_DRIVER = 'sandbox';
    expect(createPaymentGateway()).toBeInstanceOf(SandboxPaymentGateway);
  });

  it('throws for an unknown driver', () => {
    process.env.PAYMENT_GATEWAY_DRIVER = 'shetab';
    expect(() => createPaymentGateway()).toThrow(/Unknown PAYMENT_GATEWAY_DRIVER/);
  });
});

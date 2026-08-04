import { Logger } from '@nestjs/common';
import {
  PaymentGateway,
  SandboxPaymentGateway,
} from './payment-gateway';

const logger = new Logger('PaymentGatewayFactory');

/** Selects the payment driver from PAYMENT_GATEWAY_DRIVER (default: sandbox).
 * Add ShetabPaymentGateway here when the PSP contract is signed — the
 * PaymentGateway interface and BookingService.pay() flow stay unchanged. */
export function createPaymentGateway(): PaymentGateway {
  const driver = (process.env.PAYMENT_GATEWAY_DRIVER ?? 'sandbox').toLowerCase();
  switch (driver) {
    case 'sandbox':
      logger.log('Using SandboxPaymentGateway (dev/MVP)');
      return new SandboxPaymentGateway();
    default:
      throw new Error(
        `Unknown PAYMENT_GATEWAY_DRIVER "${driver}". Supported: sandbox`,
      );
  }
}

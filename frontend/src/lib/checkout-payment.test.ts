import { describe, expect, it } from 'vitest';
import {
  canPayWithMethod,
  canPayWithPoints,
  canPayWithWallet,
  pickDefaultPaymentMethod,
  pointsNeededForPrice,
} from './checkout-payment';

describe('checkout-payment', () => {
  it('computes points needed from price in rial', () => {
    expect(pointsNeededForPrice(38_000_000)).toBe(3800);
    expect(pointsNeededForPrice(1)).toBe(1);
  });

  it('picks gateway when enabled', () => {
    expect(
      pickDefaultPaymentMethod({
        gatewayEnabled: true,
        walletBalanceIrr: 0,
        isClubMember: false,
        clubPointsBalance: 0,
        priceIrr: 100,
      }),
    ).toBe('GATEWAY');
  });

  it('picks wallet when balance covers the price', () => {
    expect(
      pickDefaultPaymentMethod({
        gatewayEnabled: false,
        walletBalanceIrr: 500_000_000,
        isClubMember: false,
        clubPointsBalance: 0,
        priceIrr: 380_000_000,
      }),
    ).toBe('WALLET');
  });

  it('picks points when wallet is insufficient but points cover the price', () => {
    expect(
      pickDefaultPaymentMethod({
        gatewayEnabled: false,
        walletBalanceIrr: 0,
        isClubMember: true,
        clubPointsBalance: 5000,
        priceIrr: 38_000_000,
      }),
    ).toBe('POINTS');
  });

  it('falls back to wallet (top-up path) when nothing else works', () => {
    expect(
      pickDefaultPaymentMethod({
        gatewayEnabled: false,
        walletBalanceIrr: 0,
        isClubMember: false,
        clubPointsBalance: 0,
        priceIrr: 380_000_000,
      }),
    ).toBe('WALLET');
  });

  it('blocks wallet pay when balance is unknown or insufficient', () => {
    expect(canPayWithWallet(380_000_000, 380_000_000)).toBe(true);
    expect(canPayWithWallet(0, 380_000_000)).toBe(false);
    expect(
      canPayWithMethod('WALLET', {
        gatewayEnabled: false,
        walletBalanceIrr: null,
        isClubMember: false,
        clubPointsBalance: 0,
        priceIrr: 380_000_000,
      }),
    ).toBe(false);
  });

  it('allows points pay only for members with enough balance', () => {
    expect(canPayWithPoints(true, 4000, 38_000_000)).toBe(true);
    expect(canPayWithPoints(true, 100, 38_000_000)).toBe(false);
    expect(canPayWithPoints(false, 999_999, 38_000_000)).toBe(false);
  });
});

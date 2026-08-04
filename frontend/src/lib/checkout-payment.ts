/** Mirrors backend club-points.service.ts — keep in sync when rate changes. */
export const IRR_PER_REDEEMED_POINT = 10_000;

export type CheckoutPaymentMethod = 'GATEWAY' | 'WALLET' | 'POINTS';

export function pointsNeededForPrice(priceIrr: number): number {
  return Math.ceil(priceIrr / IRR_PER_REDEEMED_POINT);
}

export function canPayWithWallet(walletBalanceIrr: number, priceIrr: number): boolean {
  return walletBalanceIrr >= priceIrr;
}

export function canPayWithPoints(
  isMember: boolean,
  pointsBalance: number,
  priceIrr: number,
): boolean {
  return isMember && pointsBalance >= pointsNeededForPrice(priceIrr);
}

export function canPayWithMethod(
  method: CheckoutPaymentMethod,
  opts: {
    gatewayEnabled: boolean;
    walletBalanceIrr: number | null;
    isClubMember: boolean;
    clubPointsBalance: number;
    priceIrr: number;
  },
): boolean {
  switch (method) {
    case 'GATEWAY':
      return opts.gatewayEnabled;
    case 'WALLET':
      return opts.walletBalanceIrr !== null && canPayWithWallet(opts.walletBalanceIrr, opts.priceIrr);
    case 'POINTS':
      return canPayWithPoints(opts.isClubMember, opts.clubPointsBalance, opts.priceIrr);
  }
}

export function pickDefaultPaymentMethod(opts: {
  gatewayEnabled: boolean;
  walletBalanceIrr: number | null;
  isClubMember: boolean;
  clubPointsBalance: number;
  priceIrr: number;
}): CheckoutPaymentMethod {
  if (opts.gatewayEnabled) return 'GATEWAY';
  if (opts.walletBalanceIrr !== null && canPayWithWallet(opts.walletBalanceIrr, opts.priceIrr)) {
    return 'WALLET';
  }
  if (canPayWithPoints(opts.isClubMember, opts.clubPointsBalance, opts.priceIrr)) {
    return 'POINTS';
  }
  return 'WALLET';
}

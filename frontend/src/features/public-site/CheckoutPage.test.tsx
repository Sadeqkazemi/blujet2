import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import CheckoutPage from './CheckoutPage';
import * as publicSiteApi from '../../api/publicSite';
import * as useAuthModule from '../../hooks/useAuth';
import type { BookingDetail } from '../../types/public-site';

const BOOKING: BookingDetail = {
  id: 'b1',
  pnr: 'BJABC123',
  status: 'HELD',
  cabin: 'ECONOMY',
  priceIrr: 380_000_000,
  holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  flightInstanceId: 'fi-1',
  flightNo: 'BJ-100',
  originCode: 'THR',
  destCode: 'MHD',
  departureAt: '2026-08-01T05:00:00.000Z',
  arrivalAt: '2026-08-01T06:30:00.000Z',
  isPriceLocked: false,
  passengers: [{ fullName: 'علی رضایی', seatCode: '2A' }],
};

function mockWalletAndClub(
  walletBalanceIrr = 500_000_000,
  club = { isMember: false, level: null as string | null, balance: 0 },
) {
  vi.spyOn(publicSiteApi, 'fetchWallet').mockResolvedValue({ balanceIrr: walletBalanceIrr });
  vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue(club);
}

function renderPage() {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'unauthenticated',
    user: null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
  return render(
    <MemoryRouter initialEntries={['/checkout/b1']}>
      <Routes>
        <Route path="/checkout/:bookingId" element={<CheckoutPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CheckoutPage', () => {
  it('renders the booking summary and price', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue(BOOKING);
    mockWalletAndClub();
    renderPage();

    expect(await screen.findByText('BJ-100')).toBeInTheDocument();
    expect(screen.getByTestId('pay-submit')).toBeInTheDocument();
  });

  it('pays successfully when wallet balance covers the price', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue(BOOKING);
    mockWalletAndClub(500_000_000);
    const payBooking = vi.spyOn(publicSiteApi, 'payBooking').mockResolvedValue({
      priceChanged: false,
      booking: { ...BOOKING, status: 'TICKETED' },
    });
    renderPage();
    await screen.findByTestId('pay-submit');

    await userEvent.click(screen.getByTestId('pay-submit'));
    expect(payBooking).toHaveBeenCalledWith('b1', {
      confirmedPriceIrr: undefined,
      promoCode: undefined,
      paymentMethod: 'WALLET',
    });
  });

  it('sends the entered promo code and selected payment method', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue(BOOKING);
    mockWalletAndClub(1_000_000_000);
    const payBooking = vi.spyOn(publicSiteApi, 'payBooking').mockResolvedValue({
      priceChanged: false,
      booking: { ...BOOKING, status: 'TICKETED' },
    });
    renderPage();
    await screen.findByTestId('pay-submit');

    await userEvent.type(screen.getByTestId('promo-code-input'), 'BLUE20');
    await userEvent.click(screen.getByTestId('payment-method-WALLET'));
    await userEvent.click(screen.getByTestId('pay-submit'));

    expect(payBooking).toHaveBeenCalledWith('b1', {
      confirmedPriceIrr: undefined,
      promoCode: 'BLUE20',
      paymentMethod: 'WALLET',
    });
  });

  it('disables the gateway option when MVP checkout flag is off', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue(BOOKING);
    mockWalletAndClub();
    renderPage();
    await screen.findByTestId('pay-submit');

    expect(screen.getByTestId('payment-method-GATEWAY')).toBeDisabled();
    expect(screen.getByTestId('payment-method-WALLET')).toBeChecked();
  });

  it('blocks pay and shows inline top-up when wallet balance is insufficient', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue(BOOKING);
    mockWalletAndClub(0);
    renderPage();
    await screen.findByTestId('checkout-wallet-topup');

    expect(screen.getByTestId('pay-submit')).toBeDisabled();
    expect(screen.getByTestId('payment-method-WALLET')).toBeChecked();
    expect(screen.getByTestId('pay-blocked-hint')).toBeInTheDocument();
  });

  it('enables pay after a successful inline wallet top-up', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue(BOOKING);
    mockWalletAndClub(0);
    vi.spyOn(publicSiteApi, 'topupWallet').mockResolvedValue({ balanceIrr: 500_000_000 });
    const payBooking = vi.spyOn(publicSiteApi, 'payBooking').mockResolvedValue({
      priceChanged: false,
      booking: { ...BOOKING, status: 'TICKETED' },
    });
    renderPage();
    await screen.findByTestId('checkout-wallet-topup');

    await userEvent.type(screen.getByTestId('checkout-topup-amount'), '50000000');
    await userEvent.click(screen.getByTestId('checkout-topup-submit'));
    await screen.findByTestId('pay-submit');

    expect(screen.getByTestId('pay-submit')).not.toBeDisabled();
    await userEvent.click(screen.getByTestId('pay-submit'));
    expect(payBooking).toHaveBeenCalled();
  });

  it('defaults to points when wallet is empty but club points cover the price', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue(BOOKING);
    mockWalletAndClub(0, { isMember: true, level: 'GOLD', balance: 50_000 });
    renderPage();
    await screen.findByTestId('pay-submit');

    expect(screen.getByTestId('payment-method-POINTS')).toBeChecked();
    expect(screen.getByTestId('pay-submit')).not.toBeDisabled();
  });

  it('disables the pay-with-points option for a non-club-member', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue(BOOKING);
    mockWalletAndClub(500_000_000, { isMember: false, level: null, balance: 0 });
    renderPage();
    await screen.findByTestId('pay-submit');

    expect(screen.getByTestId('payment-method-POINTS')).toBeDisabled();
  });

  it('shows the re-price confirmation UI when the price changed', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue(BOOKING);
    mockWalletAndClub();
    vi.spyOn(publicSiteApi, 'payBooking').mockResolvedValueOnce({
      priceChanged: true,
      previousPriceIrr: 380_000_000,
      currentPriceIrr: 400_000_000,
    });
    renderPage();
    await screen.findByTestId('pay-submit');

    await userEvent.click(screen.getByTestId('pay-submit'));
    expect(await screen.findByTestId('confirm-new-price')).toBeInTheDocument();
    expect(screen.getByText('قیمت این پرواز تغییر کرده است.')).toBeInTheDocument();
  });

  it('keeps the checkout form visible when payment fails', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue(BOOKING);
    mockWalletAndClub();
    vi.spyOn(publicSiteApi, 'payBooking').mockRejectedValue(new Error('fail'));
    renderPage();
    await screen.findByTestId('pay-submit');

    await userEvent.click(screen.getByTestId('pay-submit'));

    expect(await screen.findByText('خطا در پرداخت.')).toBeInTheDocument();
    expect(screen.getByTestId('pay-submit')).toBeInTheDocument();
  });

  it('shows an expired-hold state without a pay button', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue({ ...BOOKING, status: 'EXPIRED' });
    renderPage();

    expect(await screen.findByText('مهلت نگهداری این رزرو به پایان رسیده است.')).toBeInTheDocument();
    expect(screen.queryByTestId('pay-submit')).not.toBeInTheDocument();
  });
});

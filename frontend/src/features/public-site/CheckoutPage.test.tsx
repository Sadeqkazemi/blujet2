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
  priceIrr: '380000000',
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
        <Route path="/payment/:bookingId" element={<div data-testid="payment-page">payment</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CheckoutPage', () => {
  it('renders the booking summary for review', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue(BOOKING);
    renderPage();

    expect(await screen.findByText('BJ-100')).toBeInTheDocument();
    expect(screen.getByText('علی رضایی')).toBeInTheDocument();
    expect(screen.getByTestId('continue-to-payment')).toBeInTheDocument();
    expect(screen.queryByTestId('pay-submit')).not.toBeInTheDocument();
  });

  it('navigates to the payment page when continue is clicked', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue(BOOKING);
    renderPage();
    await screen.findByTestId('continue-to-payment');

    await userEvent.click(screen.getByTestId('continue-to-payment'));
    expect(await screen.findByTestId('payment-page')).toBeInTheDocument();
  });

  it('shows an expired-hold state without a continue button', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue({ ...BOOKING, status: 'EXPIRED' });
    renderPage();

    expect(await screen.findByText('مهلت نگهداری این رزرو به پایان رسیده است.')).toBeInTheDocument();
    expect(screen.queryByTestId('continue-to-payment')).not.toBeInTheDocument();
  });
});

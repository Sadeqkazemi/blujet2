import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import CheckoutPage from './CheckoutPage';
import * as publicSiteApi from '../../api/publicSite';
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
  passengers: [{ fullName: 'علی رضایی', seatCode: '2A' }],
};

function renderPage() {
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
    renderPage();

    expect(await screen.findByText('BJ-100')).toBeInTheDocument();
    expect(screen.getByTestId('pay-submit')).toBeInTheDocument();
  });

  it('pays successfully and would navigate to the ticket page', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue(BOOKING);
    const payBooking = vi.spyOn(publicSiteApi, 'payBooking').mockResolvedValue({
      priceChanged: false,
      booking: { ...BOOKING, status: 'TICKETED' },
    });
    renderPage();
    await screen.findByTestId('pay-submit');

    await userEvent.click(screen.getByTestId('pay-submit'));
    expect(payBooking).toHaveBeenCalledWith('b1', undefined);
  });

  it('shows the re-price confirmation UI when the price changed', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue(BOOKING);
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

  it('shows an expired-hold state without a pay button', async () => {
    vi.spyOn(publicSiteApi, 'fetchMyBooking').mockResolvedValue({ ...BOOKING, status: 'EXPIRED' });
    renderPage();

    expect(await screen.findByText('مهلت نگهداری این رزرو به پایان رسیده است.')).toBeInTheDocument();
    expect(screen.queryByTestId('pay-submit')).not.toBeInTheDocument();
  });
});

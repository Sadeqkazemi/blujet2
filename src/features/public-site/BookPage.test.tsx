import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import BookPage from './BookPage';
import * as publicSiteApi from '../../api/publicSite';
import * as useAuthModule from '../../hooks/useAuth';
import type { SeatMapResult } from '../../types/public-site';

const SEATMAP: SeatMapResult = {
  flightInstanceId: 'fi-1',
  seats: [
    { seatCode: '2A', row: 2, cabin: 'ECONOMY', status: 'FREE' },
    { seatCode: '2C', row: 2, cabin: 'ECONOMY', status: 'TAKEN' },
    { seatCode: '1A', row: 1, cabin: 'BUSINESS', status: 'FREE' },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/book/fi-1?cabin=ECONOMY']}>
      <Routes>
        <Route path="/book/:flightInstanceId" element={<BookPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BookPage', () => {
  it('shows the OTP login form when unauthenticated', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'unauthenticated',
      user: null,
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
      requestOtp: vi.fn(),
      verifyOtp: vi.fn(),
    });
    renderPage();

    expect(await screen.findByTestId('otp-phone')).toBeInTheDocument();
  });

  it('drives request-code then verify-code once a phone is entered', async () => {
    const requestOtp = vi.fn().mockResolvedValue('challenge-1');
    const verifyOtp = vi.fn().mockResolvedValue({ id: 'u1', fullName: '09121234567', role: 'USER' });
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'unauthenticated',
      user: null,
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
      requestOtp,
      verifyOtp,
    });
    renderPage();

    await userEvent.type(await screen.findByTestId('otp-phone'), '09121234567');
    await userEvent.click(screen.getByRole('button', { name: 'دریافت کد' }));
    expect(requestOtp).toHaveBeenCalledWith('09121234567');

    await userEvent.type(await screen.findByTestId('otp-code'), '482913');
    await userEvent.click(screen.getByRole('button', { name: 'تأیید و ورود' }));
    expect(verifyOtp).toHaveBeenCalledWith('challenge-1', '482913');
  });

  it('lets an authenticated customer pick a free seat, fill passenger info, and submit', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', fullName: '09121234567', role: 'USER' },
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(publicSiteApi, 'fetchSeatMap').mockResolvedValue(SEATMAP);
    const createBooking = vi.spyOn(publicSiteApi, 'createBooking').mockResolvedValue({
      id: 'b1',
      pnr: 'BJABC123',
      status: 'HELD',
      cabin: 'ECONOMY',
      priceIrr: 380_000_000,
      holdExpiresAt: new Date().toISOString(),
      flightInstanceId: 'fi-1',
      flightNo: 'BJ-100',
      originCode: 'THR',
      destCode: 'MHD',
      departureAt: '2026-08-01T05:00:00.000Z',
      arrivalAt: '2026-08-01T06:30:00.000Z',
      passengers: [{ fullName: 'علی رضایی', seatCode: '2A' }],
    });
    renderPage();

    // Only the free economy seat is shown/enabled; the sold one and the
    // business-cabin one are excluded/disabled.
    const freeSeat = await screen.findByTestId('seat-2A');
    expect(freeSeat).not.toBeDisabled();
    expect(screen.getByTestId('seat-2C')).toBeDisabled();
    expect(screen.queryByTestId('seat-1A')).not.toBeInTheDocument();

    await userEvent.click(freeSeat);
    await userEvent.type(screen.getByTestId('pax-name-0'), 'علی رضایی');
    await userEvent.click(screen.getByTestId('book-submit'));

    expect(createBooking).toHaveBeenCalledWith({
      flightInstanceId: 'fi-1',
      cabin: 'ECONOMY',
      passengers: [{ fullName: 'علی رضایی', nationalId: undefined, mobile: undefined, seatCode: '2A' }],
    });
  });
});

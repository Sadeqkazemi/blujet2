import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import BookPage from './BookPage';
import * as publicSiteApi from '../../api/publicSite';
import * as useAuthModule from '../../hooks/useAuth';
import * as useLocaleModule from '../../hooks/useLocale';
import { mockAuthUser } from '../../test/mockAuthUser';
import type { SeatMapResult, SavedPassenger } from '../../types/public-site';

const SAVED: SavedPassenger = {
  id: 'sp-1',
  fullName: 'محمد رضایی',
  latinName: 'MOHAMMAD REZAEI',
  nationalId: '0012345679',
  passportNo: null,
  mobile: '09121234567',
  isChild: false,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

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
  beforeEach(() => {
    vi.spyOn(publicSiteApi, 'fetchSavedPassengers').mockResolvedValue([]);
    vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale: 'fa', setLocale: vi.fn() });
  });

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
      user: mockAuthUser({ id: 'u1', fullName: '09121234567', role: 'USER' }),
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
      priceIrr: '380000000',
      holdExpiresAt: new Date().toISOString(),
      flightInstanceId: 'fi-1',
      flightNo: 'BJ-100',
      originCode: 'THR',
      destCode: 'MHD',
      departureAt: '2026-08-01T05:00:00.000Z',
      arrivalAt: '2026-08-01T06:30:00.000Z',
      isPriceLocked: false,
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

  it('autofills passenger fields from saved-passenger chips', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: mockAuthUser({ id: 'u1', fullName: 'نگار رضایی', role: 'USER' }),
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(publicSiteApi, 'fetchSeatMap').mockResolvedValue(SEATMAP);
    vi.spyOn(publicSiteApi, 'fetchSavedPassengers').mockResolvedValue([SAVED]);
    const createBooking = vi.spyOn(publicSiteApi, 'createBooking').mockResolvedValue({
      id: 'b1',
      pnr: 'BJABC123',
      status: 'HELD',
      cabin: 'ECONOMY',
      priceIrr: '380000000',
      holdExpiresAt: new Date().toISOString(),
      flightInstanceId: 'fi-1',
      flightNo: 'BJ-100',
      originCode: 'THR',
      destCode: 'MHD',
      departureAt: '2026-08-01T05:00:00.000Z',
      arrivalAt: '2026-08-01T06:30:00.000Z',
      isPriceLocked: false,
      passengers: [{ fullName: SAVED.fullName, seatCode: '2A' }],
    });
    renderPage();

    await userEvent.click(await screen.findByTestId('seat-2A'));
    expect(await screen.findByTestId('saved-pax-autofill')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('saved-pax-chip-sp-1'));

    expect(screen.getByTestId('pax-name-0')).toHaveValue('محمد رضایی');
    expect(screen.getByTestId('pax-national-id-0')).toHaveValue('0012345679');
    expect(screen.getByTestId('pax-mobile-0')).toHaveValue('09121234567');

    await userEvent.click(screen.getByTestId('book-submit'));
    expect(createBooking).toHaveBeenCalledWith({
      flightInstanceId: 'fi-1',
      cabin: 'ECONOMY',
      passengers: [
        {
          fullName: 'محمد رضایی',
          nationalId: '0012345679',
          mobile: '09121234567',
          seatCode: '2A',
        },
      ],
    });
  });

  it('locks business-cabin seat selection below the 15,000-point club threshold', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: mockAuthUser({ id: 'u1', fullName: '09121234567', role: 'USER' }),
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(publicSiteApi, 'fetchSeatMap').mockResolvedValue(SEATMAP);
    vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({ isMember: true, level: 'GOLD', balance: 8000 });

    render(
      <MemoryRouter initialEntries={['/book/fi-1?cabin=BUSINESS']}>
        <Routes>
          <Route path="/book/:flightInstanceId" element={<BookPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('business-seat-lock')).toBeInTheDocument();
    expect(screen.getByTestId('seat-1A')).toBeDisabled();
  });

  it('renders English strings when locale is en', async () => {
    vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale: 'en', setLocale: vi.fn() });
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: mockAuthUser({ id: 'u1', fullName: '09121234567', role: 'USER' }),
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(publicSiteApi, 'fetchSeatMap').mockResolvedValue(SEATMAP);
    renderPage();

    expect(await screen.findByText('Seat selection & passenger details')).toBeInTheDocument();
  });
});

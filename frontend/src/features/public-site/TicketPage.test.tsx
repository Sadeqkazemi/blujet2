import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TicketPage from './TicketPage';
import * as publicSiteApi from '../../api/publicSite';
import * as useAuthModule from '../../hooks/useAuth';
import * as useLocaleModule from '../../hooks/useLocale';
import type { BookingDetail } from '../../types/public-site';

const TICKETED: BookingDetail = {
  id: 'b1',
  pnr: 'BJABC123',
  status: 'TICKETED',
  cabin: 'ECONOMY',
  priceIrr: '380000000',
  holdExpiresAt: null,
  flightInstanceId: 'fi-1',
  flightNo: 'BJ-100',
  originCode: 'THR',
  destCode: 'MHD',
  departureAt: '2026-08-01T05:00:00.000Z',
  arrivalAt: '2026-08-01T06:30:00.000Z',
  isPriceLocked: false,
  passengers: [{ fullName: 'علی رضایی', seatCode: '2A' }],
};

function renderPage(locale: 'fa' | 'en' | 'ar' = 'fa') {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'unauthenticated',
    user: null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
  return render(
    <MemoryRouter initialEntries={['/ticket/BJABC123']}>
      <Routes>
        <Route path="/ticket/:pnr" element={<TicketPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TicketPage', () => {
  it('renders the e-ticket with PNR and passenger/seat', async () => {
    vi.spyOn(publicSiteApi, 'fetchBookingByPnr').mockResolvedValue(TICKETED);
    renderPage();

    expect(await screen.findByText('BJABC123')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-barcode')).toBeInTheDocument();
    expect(screen.getByText('علی رضایی')).toBeInTheDocument();
    expect(screen.queryByTestId('open-refund-form')).not.toBeInTheDocument();
  });

  it('renders English strings when locale is en', async () => {
    vi.spyOn(publicSiteApi, 'fetchBookingByPnr').mockResolvedValue(TICKETED);
    renderPage('en');

    expect(await screen.findByText('E-ticket')).toBeInTheDocument();
    expect(screen.queryByText('Request ticket refund')).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(screen.getByTestId('open-refund-form')).toBeInTheDocument();
  });

  it('submits a refund request and shows the penalty breakdown', async () => {
    vi.spyOn(publicSiteApi, 'fetchBookingByPnr').mockResolvedValue(TICKETED);
    vi.spyOn(publicSiteApi, 'submitRefund').mockResolvedValue({
      id: 'r1',
      trackingCode: 'RF-A1B2C3D4',
      bookingId: 'b1',
      pnr: TICKETED.pnr,
      flightNo: TICKETED.flightNo,
      originCode: TICKETED.originCode,
      destCode: TICKETED.destCode,
      departureAt: TICKETED.departureAt,
      status: 'SUBMITTED',
      penaltyPct: 30,
      penaltyAmountIrr: '114000000',
      refundableIrr: '266000000',
      totalPaidIrr: '380000000',
      history: [{ step: 'submitted', labelFa: 'ثبت درخواست', at: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      paidAt: null,
    });
    renderPage();

    await userEvent.click(await screen.findByTestId('open-refund-form'));
    await userEvent.type(screen.getByTestId('refund-iban'), 'IR820170000000332211009900');
    await userEvent.click(screen.getByTestId('submit-refund'));

    expect(await screen.findByText(/درخواست استرداد ثبت شد/)).toBeInTheDocument();
  });

  it('renders English strings when locale is en', async () => {
    vi.spyOn(publicSiteApi, 'fetchBookingByPnr').mockResolvedValue(TICKETED);
    renderPage('en');

    expect(await screen.findByText('E-ticket')).toBeInTheDocument();
    expect(screen.getByText('Request ticket refund')).toBeInTheDocument();
  });
});

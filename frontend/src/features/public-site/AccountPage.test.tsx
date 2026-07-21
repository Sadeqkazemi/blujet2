import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountPage from './AccountPage';
import * as useAuthModule from '../../hooks/useAuth';
import * as publicSiteApi from '../../api/publicSite';
import type { BookingDetail, RefundRequestView } from '../../types/public-site';

const BOOKING: BookingDetail = {
  id: 'b1',
  pnr: 'BJ4X2K',
  status: 'TICKETED',
  cabin: 'ECONOMY',
  priceIrr: 16_000_000,
  holdExpiresAt: null,
  flightInstanceId: 'fi-1',
  flightNo: 'BJ-100',
  originCode: 'THR',
  destCode: 'MHD',
  departureAt: '2026-08-01T05:00:00.000Z',
  arrivalAt: '2026-08-01T06:30:00.000Z',
  passengers: [{ fullName: 'نگار رضایی', seatCode: '12A' }],
};

const REFUND: RefundRequestView = {
  id: 'r1',
  bookingId: 'b1',
  status: 'REVIEW',
  penaltyPct: 30,
  penaltyAmountIrr: 4_800_000,
  refundableIrr: 11_200_000,
  totalPaidIrr: 16_000_000,
  createdAt: '2026-07-01T00:00:00.000Z',
};

function mockAuth(status: 'authenticated' | 'unauthenticated') {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status,
    user: status === 'authenticated' ? { id: 'u1', fullName: 'نگار رضایی', role: 'USER' } : null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.spyOn(publicSiteApi, 'fetchMyBookings').mockResolvedValue([BOOKING]);
  vi.spyOn(publicSiteApi, 'fetchWallet').mockResolvedValue({ balanceIrr: 250_000_0 });
  vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({ isMember: true, level: 'GOLD', balance: 12450 });
  vi.spyOn(publicSiteApi, 'fetchMyRefunds').mockResolvedValue([REFUND]);
});

describe('AccountPage', () => {
  it('shows the trips tab by default with real booking data', async () => {
    mockAuth('authenticated');
    renderPage();
    expect(await screen.findByTestId('account-trip')).toBeInTheDocument();
    expect(screen.getByText('BJ-100', { exact: false })).toBeInTheDocument();
  });

  it('switches to the wallet tab and shows the real balance', async () => {
    mockAuth('authenticated');
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-wallet'));
    expect(await screen.findByTestId('wallet-balance')).toHaveTextContent('۲۵۰٬۰۰۰');
  });

  it('switches to the points tab and shows tier + balance', async () => {
    mockAuth('authenticated');
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-points'));
    expect(await screen.findByText('۱۲۴۵۰')).toBeInTheDocument();
    expect(screen.getByText('★ سطح طلایی')).toBeInTheDocument();
  });

  it('switches to the passengers tab and lists unique passengers', async () => {
    mockAuth('authenticated');
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-passengers'));
    expect(await screen.findByTestId('account-passenger')).toHaveTextContent('نگار رضایی');
  });

  it('switches to the refunds tab and shows the real refund', async () => {
    mockAuth('authenticated');
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-refunds'));
    expect(await screen.findByTestId('account-refund')).toHaveTextContent('در حال بررسی');
  });
});

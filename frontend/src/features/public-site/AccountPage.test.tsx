import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountPage from './AccountPage';
import * as useAuthModule from '../../hooks/useAuth';
import * as publicSiteApi from '../../api/publicSite';
import type { BookingDetail, RefundRequestView, UserProfile } from '../../types/public-site';

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

const PROFILE: UserProfile = {
  fullName: 'نگار رضایی',
  nationalId: null,
  birthDate: null,
  passportNo: null,
  email: null,
  emailVerifiedAt: null,
  completionPct: 20,
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
  vi.spyOn(publicSiteApi, 'fetchMyProfile').mockResolvedValue(PROFILE);
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

  it('shows an incomplete-profile banner and saves identity fields from the profile tab', async () => {
    mockAuth('authenticated');
    const update = vi.spyOn(publicSiteApi, 'updateMyProfile').mockResolvedValue({
      ...PROFILE,
      nationalId: '0012345679',
      completionPct: 40,
    });
    renderPage();

    expect(await screen.findByTestId('profile-incomplete-banner')).toHaveTextContent('۲۰٪');

    await userEvent.click(screen.getByTestId('account-tab-profile'));
    const nationalIdInput = await screen.findByLabelText('کد ملی');
    await userEvent.type(nationalIdInput, '0012345679');
    await userEvent.click(screen.getByRole('button', { name: 'ذخیره اطلاعات' }));

    await screen.findByText('اطلاعات پروفایل ذخیره شد ✓');
    expect(update).toHaveBeenCalledWith({
      fullName: 'نگار رضایی',
      nationalId: '0012345679',
      passportNo: undefined,
    });
  });
});

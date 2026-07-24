import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccountPage from './AccountPage';
import * as useAuthModule from '../../hooks/useAuth';
import * as publicSiteApi from '../../api/publicSite';
import type { BookingDetail, PriceLock, RefundRequestView, UserProfile } from '../../types/public-site';

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
  isPriceLocked: false,
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

const LOCK: PriceLock = {
  id: 'pl-1',
  flightInstanceId: 'fi-2',
  cabin: 'BUSINESS',
  lockedPriceIrr: 680_000_000,
  feeIrr: 2_040_000,
  status: 'ACTIVE',
  expiresAt: '2026-08-04T05:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
  bookingId: null,
  flight: { flightNo: 'BJ-200', originCode: 'THR', destCode: 'IFN', departureAt: '2026-08-01T09:00:00.000Z' },
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

function mockAuth(status: 'authenticated' | 'unauthenticated', signOut = vi.fn()) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status,
    user: status === 'authenticated' ? { id: 'u1', fullName: 'نگار رضایی', role: 'USER' } : null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut,
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
  vi.spyOn(publicSiteApi, 'fetchMyPriceLocks').mockResolvedValue([]);
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

  it('downloads a real data export as JSON', async () => {
    mockAuth('authenticated');
    const exportSpy = vi.spyOn(publicSiteApi, 'fetchPrivacyExport').mockResolvedValue({ user: PROFILE });
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-profile'));
    await userEvent.click(screen.getByTestId('privacy-export-button'));

    await vi.waitFor(() => expect(exportSpy).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    vi.unstubAllGlobals();
  });

  it('deletes the account only after explicit confirmation, then signs out', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    mockAuth('authenticated', signOut);
    const deleteSpy = vi.spyOn(publicSiteApi, 'deleteMyAccount').mockResolvedValue({ deleted: true });

    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-profile'));
    await userEvent.click(screen.getByTestId('privacy-delete-open'));

    expect(screen.getByTestId('privacy-delete-confirm')).toBeInTheDocument();
    expect(deleteSpy).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('privacy-delete-cancel'));
    expect(screen.queryByTestId('privacy-delete-confirm')).not.toBeInTheDocument();
    expect(deleteSpy).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('privacy-delete-open'));
    await userEvent.click(screen.getByTestId('privacy-delete-confirm'));

    await vi.waitFor(() => expect(deleteSpy).toHaveBeenCalled());
    expect(signOut).toHaveBeenCalled();
  });

  it('shows the price-locked badge on a trip whose booking used a lock', async () => {
    mockAuth('authenticated');
    vi.spyOn(publicSiteApi, 'fetchMyBookings').mockResolvedValue([{ ...BOOKING, isPriceLocked: true }]);
    renderPage();
    expect(await screen.findByTestId('trip-price-locked-badge')).toBeInTheDocument();
  });

  it('switches to the price-locks tab and lists a real lock with its route, price, fee, and cancel action', async () => {
    mockAuth('authenticated');
    vi.spyOn(publicSiteApi, 'fetchMyPriceLocks').mockResolvedValue([LOCK]);
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-price-locks'));

    const row = await screen.findByTestId('account-price-lock');
    expect(row).toHaveTextContent('THR');
    expect(row).toHaveTextContent('IFN');
    expect(row).toHaveTextContent('۶۸٬۰۰۰٬۰۰۰');
    expect(row).toHaveTextContent('۲۰۴٬۰۰۰');
    expect(screen.getByTestId('cancel-price-lock-pl-1')).toBeInTheDocument();
  });

  it('cancelling an active price lock updates its status in place', async () => {
    mockAuth('authenticated');
    vi.spyOn(publicSiteApi, 'fetchMyPriceLocks').mockResolvedValue([LOCK]);
    const cancel = vi.spyOn(publicSiteApi, 'cancelPriceLock').mockResolvedValue({ ...LOCK, status: 'CANCELLED' });
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-price-locks'));
    await screen.findByTestId('account-price-lock');

    await userEvent.click(screen.getByTestId('cancel-price-lock-pl-1'));

    expect(cancel).toHaveBeenCalledWith('pl-1');
    await vi.waitFor(() => expect(screen.getByTestId('account-price-lock')).toHaveTextContent('لغو شده'));
    expect(screen.queryByTestId('cancel-price-lock-pl-1')).not.toBeInTheDocument();
  });

  it('tops up the wallet using Persian-digit input, converting toman to rial correctly (regression: raw Number()*10 silently produced NaN)', async () => {
    mockAuth('authenticated');
    const topup = vi.spyOn(publicSiteApi, 'topupWallet').mockResolvedValue({ balanceIrr: 5_000_000 });
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-wallet'));

    await userEvent.type(screen.getByTestId('wallet-topup-amount'), '۵۰۰٬۰۰۰');
    await userEvent.click(screen.getByTestId('wallet-topup-submit'));

    await vi.waitFor(() => expect(topup).toHaveBeenCalledWith(5_000_000));
  });
});

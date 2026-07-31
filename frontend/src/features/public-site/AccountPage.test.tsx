import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccountPage from './AccountPage';
import * as useAuthModule from '../../hooks/useAuth';
import { mockAuthUser } from '../../test/mockAuthUser';
import * as useLocaleModule from '../../hooks/useLocale';
import * as publicSiteApi from '../../api/publicSite';
import * as supportTicketsApi from '../../api/support-tickets';
import * as authApi from '../../api/auth';
import type { BookingDetail, PriceLock, RefundRequestView, SavedFlight, UserProfile } from '../../types/public-site';
import type { ClubMembershipView } from '../../types/club-membership';
import type { MySupportTicketRow } from '../../types/support-tickets';

function mockLocale(locale: 'fa' | 'en' | 'ar') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

const CLUB_MEMBERSHIP: ClubMembershipView = {
  isMember: true,
  level: 'GOLD',
  balance: 12450,
  cardStatus: 'ISSUED',
  cardNo: 'GOLD-8842',
  tierRules: { goldMinPoints: 5000, platinumMinPoints: 15000, cardRequestMinPoints: 5000 },
  cardRequest: {
    id: 'cr-1',
    status: 'APPROVED',
    cardNo: 'GOLD-8842',
    createdAt: '2026-07-01T00:00:00.000Z',
    history: [
      { step: 'submitted', labelFa: 'ثبت درخواست', at: '۱۴۰۴/۰۳/۱۲' },
      { step: 'approved', labelFa: 'تأیید', at: '۱۴۰۴/۰۳/۱۳' },
    ],
  },
  canRequestCard: false,
  pointsNeededForCard: 0,
};

function mockAuth(status: 'authenticated' | 'unauthenticated', signOut = vi.fn()) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status,
    user: status === 'authenticated' ? mockAuthUser({ id: 'u1', fullName: 'نگار رضایی', role: 'USER' }) : null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut,
  });
}

const SAVED: SavedFlight = {
  id: 'sf-1',
  flightInstanceId: 'fi-3',
  cabin: 'ECONOMY',
  flightNo: 'BJ-300',
  originCode: 'THR',
  destCode: 'MHD',
  originCityFa: 'تهران',
  destCityFa: 'مشهد',
  departureAt: '2026-08-02T05:00:00.000Z',
  arrivalAt: '2026-08-02T06:30:00.000Z',
  priceIrr: 195_000_000,
  bookable: true,
  createdAt: '2026-07-01T00:00:00.000Z',
};

const TICKET: MySupportTicketRow = {
  id: 'tk-1',
  trackingCode: 'TKAABBCCDD',
  subject: 'مشکل در پرداخت',
  body: 'وجه کسر شد ولی بلیط صادر نشد.',
  status: 'IN_PROGRESS',
  history: [{ step: 'submitted', labelFa: 'ثبت تیکت توسط کاربر', at: '2026-07-01T00:00:00.000Z' }],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

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
  vi.spyOn(publicSiteApi, 'fetchClubMembership').mockResolvedValue(CLUB_MEMBERSHIP);
  vi.spyOn(publicSiteApi, 'fetchMyRefunds').mockResolvedValue([REFUND]);
  vi.spyOn(publicSiteApi, 'fetchMyProfile').mockResolvedValue(PROFILE);
  vi.spyOn(publicSiteApi, 'fetchMyPriceLocks').mockResolvedValue([]);
  vi.spyOn(publicSiteApi, 'fetchSavedFlights').mockResolvedValue([SAVED]);
  vi.spyOn(supportTicketsApi, 'fetchMySupportTickets').mockResolvedValue([]);
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

  it('switches to the club tab and shows tier banner + issued card', async () => {
    mockAuth('authenticated');
    renderPage();
    await screen.findByTestId('account-trip');
    await userEvent.click(screen.getByTestId('account-tab-club'));
    expect(await screen.findByTestId('club-card-tracker')).toBeInTheDocument();
    expect(screen.getByText('عضو طلایی')).toBeInTheDocument();
    expect(screen.getByText('GOLD-8842')).toBeInTheDocument();
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

  it('switches to the tickets tab and lists support tickets', async () => {
    mockAuth('authenticated');
    vi.spyOn(supportTicketsApi, 'fetchMySupportTickets').mockResolvedValue([TICKET]);
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-tickets'));
    expect(await screen.findByTestId('account-ticket')).toHaveTextContent('مشکل در پرداخت');
    expect(screen.getByText('TKAABBCCDD', { exact: false })).toBeInTheDocument();
  });

  it('switches to the security tab and sets password via OTP flow API', async () => {
    mockAuth('authenticated');
    const setPw = vi.spyOn(authApi, 'setPassword').mockResolvedValue({ changed: true });
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-security'));
    await userEvent.type(document.getElementById('acct-pw-new')!, 'secret12');
    await userEvent.type(document.getElementById('acct-pw-confirm')!, 'secret12');
    await userEvent.click(screen.getByTestId('account-save-password'));
    await screen.findByText('رمز عبور با موفقیت تغییر کرد ✓');
    expect(setPw).toHaveBeenCalledWith('secret12');
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

  it('switches to the saved tab and lists bookmarked flights with book action', async () => {
    mockAuth('authenticated');
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-saved'));
    expect(await screen.findByTestId('account-saved-flights')).toBeInTheDocument();
    expect(screen.getByText('تهران ← مشهد')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'رزرو' })).toBeInTheDocument();
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

  it('renders translated tab labels and the club tier in English', async () => {
    mockLocale('en');
    mockAuth('authenticated');
    renderPage();
    expect(screen.getByTestId('account-tab-club')).toHaveTextContent('Loyalty Club');
    expect(screen.getByTestId('account-tab-refunds')).toHaveTextContent('Refunds');
    await userEvent.click(screen.getByTestId('account-tab-club'));
    expect(await screen.findByText('Gold Member')).toBeInTheDocument();
  });

  it('renders translated tab labels and the club tier in Arabic', async () => {
    mockLocale('ar');
    mockAuth('authenticated');
    renderPage();
    expect(screen.getByTestId('account-tab-club')).toHaveTextContent('نادي الولاء');
    expect(screen.getByTestId('account-tab-wallet')).toHaveTextContent('المحفظة');
    await userEvent.click(screen.getByTestId('account-tab-club'));
    expect(await screen.findByText('عضو ذهبية')).toBeInTheDocument();
  });
});

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
import type { BookingDetail, PriceLock, RefundRequestView, SavedFlight, SavedPassenger, SavedBankAccount, CustomerReferralDashboard, CustomerIdentityView, ActiveSession, UserProfile } from '../../types/public-site';
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
  trackingCode: 'RF-A1B2C3D4',
  bookingId: 'b1',
  pnr: 'BJ4X2K',
  flightNo: 'BJ-100',
  originCode: 'THR',
  destCode: 'MHD',
  departureAt: '2026-08-01T05:00:00.000Z',
  status: 'REVIEW',
  penaltyPct: 30,
  penaltyAmountIrr: 4_800_000,
  refundableIrr: 11_200_000,
  totalPaidIrr: 16_000_000,
  history: [
    { step: 'submitted', labelFa: 'ثبت درخواست', at: '2026-07-01T00:00:00.000Z' },
    { step: 'review', labelFa: 'بررسی ادمین', at: '2026-07-01T01:00:00.000Z' },
  ],
  createdAt: '2026-07-01T00:00:00.000Z',
  paidAt: null,
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

const ACTIVE_SESSION: ActiveSession = {
  id: 'sess-1',
  deviceLabel: 'Chrome · Windows',
  ip: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  createdAt: '2026-07-01T00:00:00.000Z',
  expiresAt: '2026-08-01T00:00:00.000Z',
  isCurrent: true,
};

const OTHER_SESSION: ActiveSession = {
  id: 'sess-2',
  deviceLabel: 'اپلیکیشن blujet · اندروید',
  ip: '10.0.0.2',
  userAgent: 'blujet-android/1.0',
  createdAt: '2026-06-28T00:00:00.000Z',
  expiresAt: '2026-08-01T00:00:00.000Z',
  isCurrent: false,
};

const SAVED_PASSENGER: SavedPassenger = {
  id: 'sp-1',
  fullName: 'محمد رضایی',
  latinName: 'MOHAMMAD REZAEI',
  nationalId: null,
  passportNo: 'A22113344',
  mobile: null,
  isChild: false,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const BANK_ACCOUNT: SavedBankAccount = {
  id: 'ba-1',
  bankName: 'بانک ملت',
  bankShort: 'ملت',
  brandColor: '#d6336c',
  cardMasked: '6104 3371 •••• 4521',
  sheba: 'IR820540102680020817909002',
  shebaMasked: '820540•••9002',
  isDefault: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const IDENTITY_NOT_STARTED: CustomerIdentityView = {
  status: 'NOT_STARTED',
  isComplete: false,
  canSubmit: false,
  submittedAt: null,
  rejectReason: null,
  steps: [
    { key: 'profile', done: false },
    { key: 'id_card', done: false },
  ],
  idCardFile: null,
};

const IDENTITY_READY: CustomerIdentityView = {
  status: 'NOT_STARTED',
  isComplete: false,
  canSubmit: true,
  submittedAt: null,
  rejectReason: null,
  steps: [
    { key: 'profile', done: true },
    { key: 'id_card', done: true },
  ],
  idCardFile: { id: 'f1', fileName: 'کارت-ملی.png', sizeBytes: 1234 },
};

const REFERRAL_DASH: CustomerReferralDashboard = {
  referralCode: 'NEGAR-4152',
  sharePath: '/signin?ref=NEGAR-4152',
  stats: { invitedCount: 3, pointsEarned: 1000, successfulBookings: 2 },
  invites: [
    {
      id: 'cr-1',
      fullName: 'رضا مرادی',
      joinedAt: '2026-07-01T00:00:00.000Z',
      status: 'REWARDED',
      pointsAwarded: 500,
    },
    {
      id: 'cr-2',
      fullName: 'آرش هاشمی',
      joinedAt: '2026-07-02T00:00:00.000Z',
      status: 'SIGNED_UP',
      pointsAwarded: 0,
    },
  ],
};

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
  vi.spyOn(publicSiteApi, 'fetchEligibleRefundBookings').mockResolvedValue([]);
  vi.spyOn(publicSiteApi, 'fetchCustomerRefundRules').mockResolvedValue([]);
  vi.spyOn(publicSiteApi, 'fetchMyProfile').mockResolvedValue(PROFILE);
  vi.spyOn(publicSiteApi, 'fetchMyPriceLocks').mockResolvedValue([]);
  vi.spyOn(publicSiteApi, 'fetchSavedFlights').mockResolvedValue([SAVED]);
  vi.spyOn(publicSiteApi, 'fetchSavedPassengers').mockResolvedValue([SAVED_PASSENGER]);
  vi.spyOn(publicSiteApi, 'fetchBankAccounts').mockResolvedValue([BANK_ACCOUNT]);
  vi.spyOn(publicSiteApi, 'fetchMyReferral').mockResolvedValue(REFERRAL_DASH);
  vi.spyOn(publicSiteApi, 'fetchMyIdentity').mockResolvedValue(IDENTITY_NOT_STARTED);
  vi.spyOn(publicSiteApi, 'fetchMySessions').mockResolvedValue([ACTIVE_SESSION, OTHER_SESSION]);
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

  it('switches to the passengers tab and lists saved passengers with meta line', async () => {
    mockAuth('authenticated');
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-passengers'));
    const row = await screen.findByTestId('account-passenger');
    expect(row).toHaveTextContent('محمد رضایی');
    expect(row).toHaveTextContent('MOHAMMAD REZAEI · A22113344');
  });

  it('adds a saved passenger from the modal', async () => {
    mockAuth('authenticated');
    const create = vi.spyOn(publicSiteApi, 'createSavedPassenger').mockResolvedValue({
      ...SAVED_PASSENGER,
      id: 'sp-2',
      fullName: 'سارا احمدی',
      latinName: 'SARA AHMADI',
      passportNo: 'B99887766',
    });
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-passengers'));
    await userEvent.click(screen.getByTestId('passengers-add-open'));
    await userEvent.type(screen.getByLabelText('نام و نام خانوادگی'), 'سارا احمدی');
    await userEvent.type(screen.getByLabelText('نام لاتین (روی بلیط)'), 'Sara Ahmadi');
    await userEvent.type(screen.getByLabelText('شماره گذرنامه'), 'B99887766');
    await userEvent.click(screen.getByTestId('passengers-form-save'));
    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith({
      fullName: 'سارا احمدی',
      latinName: 'Sara Ahmadi',
      nationalId: undefined,
      passportNo: 'B99887766',
      mobile: undefined,
      isChild: false,
    });
  });

  it('removes a saved passenger', async () => {
    mockAuth('authenticated');
    const remove = vi.spyOn(publicSiteApi, 'removeSavedPassenger').mockResolvedValue({ removed: true });
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-passengers'));
    await screen.findByTestId('account-passenger');
    await userEvent.click(screen.getByLabelText('حذف'));
    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith('sp-1'));
  });

  it('switches to the refunds tab and shows the real refund', async () => {
    mockAuth('authenticated');
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-refunds'));
    expect(await screen.findByTestId('refund-tracking')).toHaveTextContent('در حال بررسی');
  });

  it('switches to the tickets tab and lists support tickets', async () => {
    mockAuth('authenticated');
    vi.spyOn(supportTicketsApi, 'fetchMySupportTickets').mockResolvedValue([TICKET]);
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-tickets'));
    expect(await screen.findByTestId('account-ticket')).toHaveTextContent('مشکل در پرداخت');
    expect(screen.getByText('TKAABBCCDD', { exact: false })).toBeInTheDocument();
  });

  it('switches to the security tab and lists active sessions with revoke', async () => {
    mockAuth('authenticated');
    const revoke = vi.spyOn(publicSiteApi, 'revokeMySession').mockResolvedValue({ revoked: true });
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-security'));
    expect(await screen.findByTestId('account-sessions')).toBeInTheDocument();
    expect(screen.getByTestId('session-current-badge')).toBeInTheDocument();
    expect(screen.getByText('Chrome · Windows')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('session-revoke-sess-2'));
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledWith('sess-2'));
    expect(screen.queryByText('اپلیکیشن blujet · اندروید')).not.toBeInTheDocument();
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

  it('switches to the banks tab and lists saved accounts with default badge', async () => {
    mockAuth('authenticated');
    const create = vi.spyOn(publicSiteApi, 'createBankAccount').mockResolvedValue({
      ...BANK_ACCOUNT,
      id: 'ba-2',
      bankName: 'بانک سامان',
      bankShort: 'سامان',
      brandColor: '#1c7ed6',
      cardMasked: '6219 8619 •••• 7730',
      isDefault: false,
    });
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-banks'));
    expect(await screen.findByTestId('account-banks')).toBeInTheDocument();
    expect(screen.getByText('بانک ملت')).toBeInTheDocument();
    expect(screen.getByTestId('bank-default-badge')).toBeInTheDocument();

    await userEvent.type(screen.getByTestId('bank-input-card'), '6219861977777730');
    await userEvent.type(screen.getByTestId('bank-input-sheba'), 'IR060120000000332211452192');
    await userEvent.click(screen.getByTestId('bank-submit'));
    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith({
      cardNo: '6219861977777730',
      sheba: 'IR060120000000332211452192',
    });
  });

  it('switches to the referral tab and shows code, KPIs, and invite list', async () => {
    mockAuth('authenticated');
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-referral'));
    expect(await screen.findByTestId('account-referral')).toBeInTheDocument();
    expect(screen.getByTestId('referral-code')).toHaveTextContent('NEGAR-4152');
    expect(screen.getByTestId('kpi-invited')).toHaveTextContent('۳');
    expect(screen.getByText('رضا مرادی')).toBeInTheDocument();
    expect(screen.getByText('رزرو انجام شد')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('referral-copy'));
    expect(await screen.findByText('کد معرف کپی شد ✓')).toBeInTheDocument();
  });

  it('switches to the identity tab and shows incomplete steps with profile link', async () => {
    mockAuth('authenticated');
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-identity'));
    expect(await screen.findByTestId('account-identity')).toBeInTheDocument();
    expect(screen.getByText('احراز هویت شما هنوز کامل نشده است')).toBeInTheDocument();
    expect(screen.getByTestId('identity-go-profile')).toBeInTheDocument();
    expect(screen.getAllByTestId('identity-step')).toHaveLength(2);
    expect(screen.queryByTestId('identity-submit')).not.toBeInTheDocument();
  });

  it('submits identity verification when profile and id card are complete', async () => {
    mockAuth('authenticated');
    vi.spyOn(publicSiteApi, 'fetchMyIdentity').mockResolvedValue(IDENTITY_READY);
    const submit = vi
      .spyOn(publicSiteApi, 'submitIdentityVerification')
      .mockResolvedValue({ ...IDENTITY_READY, status: 'SUBMITTED', canSubmit: false });
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-identity'));
    expect(await screen.findByTestId('identity-submit')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('identity-submit'));
    await vi.waitFor(() => expect(submit).toHaveBeenCalled());
  });

  it('shows saved passengers on the profile tab and opens add modal from there', async () => {
    mockAuth('authenticated');
    renderPage();
    await userEvent.click(screen.getByTestId('account-tab-profile'));
    expect(await screen.findByTestId('profile-saved-pax')).toBeInTheDocument();
    expect(screen.getAllByTestId('profile-saved-pax-row')).toHaveLength(1);
    expect(screen.getByText('MOHAMMAD REZAEI · A22113344')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('profile-saved-pax-add'));
    expect(await screen.findByTestId('passengers-form-modal')).toBeInTheDocument();
    expect(screen.getByTestId('account-passengers')).toBeInTheDocument();
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

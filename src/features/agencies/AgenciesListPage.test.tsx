import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AgenciesListPage from './AgenciesListPage';
import * as agenciesApi from '../../api/agencies';
import * as useAuthModule from '../../hooks/useAuth';
import type { AgencyListResult, AgencyMembershipRequest } from '../../types/agencies';
import type { Role } from '../../types/auth';

const LIST: AgencyListResult = {
  agencies: [
    {
      id: 'a1',
      fullName: 'آژانس blujet',
      managerName: 'کامران یوسفی',
      licenseNo: 'AG-10234',
      city: 'تهران',
      tier: 'GOLD',
      isActive: true,
      limitIrr: 1_800_000_000,
      usedIrr: 310_000_000,
      remainingIrr: 1_490_000_000,
      pendingInvoiceCount: 1,
    },
    {
      id: 'a2',
      fullName: 'آژانس پرواز آسیا',
      managerName: 'سارا نجفی',
      licenseNo: 'AG-10891',
      city: 'مشهد',
      tier: 'SILVER',
      isActive: false,
      limitIrr: 900_000_000,
      usedIrr: 1_330_000_000,
      remainingIrr: -430_000_000,
      pendingInvoiceCount: 1,
    },
  ],
  kpis: {
    activeCount: 1,
    totalCreditGrantedIrr: 2_700_000_000,
    totalUsedIrr: 1_640_000_000,
    pendingSettlementCount: 2,
  },
};

const REQUESTS: AgencyMembershipRequest[] = [
  {
    id: 'r1',
    applicantName: 'آژانس ستاره شرق',
    managerName: 'بهرام قاسمی',
    licenseNo: 'AG-20011',
    city: 'اصفهان',
    phone: '+989130000001',
    email: 'info@setareh.example',
    status: 'PENDING',
    referredToId: null,
    reviewNote: null,
    reviewedById: null,
    reviewedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
];

function mockRole(role: Role) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'authenticated',
    user: { id: 'u1', fullName: 'کاربر تست', role },
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AgenciesListPage />
    </MemoryRouter>,
  );
}

describe('AgenciesListPage', () => {
  it('renders the 4 KPI cards, requests panel and agency rows with Persian-formatted money for Senior Manager', async () => {
    mockRole('SENIOR_MANAGER');
    vi.spyOn(agenciesApi, 'fetchAgencies').mockResolvedValue(LIST);
    vi.spyOn(agenciesApi, 'fetchAgencyRequests').mockResolvedValue(REQUESTS);

    renderPage();

    expect(await screen.findByText('آژانس‌های فعال')).toBeInTheDocument();
    expect(screen.getByText('مجموع اعتبار اعطاشده')).toBeInTheDocument();
    expect(screen.getByText('اعتبار مصرف‌شده (بدهی)')).toBeInTheDocument();
    expect(screen.getByText('در انتظار تسویه')).toBeInTheDocument();
    // 2,700,000,000 rial -> ۲۷۰٬۰۰۰٬۰۰۰ toman with ٬ separators + Persian digits
    expect(screen.getByText('۲۷۰٬۰۰۰٬۰۰۰ تومان')).toBeInTheDocument();

    expect(screen.getByText('درخواست‌های جدید عضویت')).toBeInTheDocument();
    expect(screen.getByText('آژانس ستاره شرق')).toBeInTheDocument();
    expect(screen.getByText('بررسی درخواست')).toBeInTheDocument();

    expect(screen.getByText('آژانس blujet')).toBeInTheDocument();
    expect(screen.getByText('فعال')).toBeInTheDocument();
    expect(screen.getByText('تعلیق‌شده')).toBeInTheDocument();

    // Sub-tabs present for Senior
    expect(screen.getByRole('button', { name: 'آژانس‌های همکار' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'اعتبار و تسویه' })).toBeInTheDocument();
  });

  it('Commercial Manager sees the debtors alert panel with notify-all instead of KPI cards and sub-tabs', async () => {
    mockRole('COMMERCIAL_MANAGER');
    vi.spyOn(agenciesApi, 'fetchAgencies').mockResolvedValue(LIST);
    vi.spyOn(agenciesApi, 'fetchAgencyRequests').mockResolvedValue(REQUESTS);

    renderPage();

    expect(await screen.findByText('درخواست‌های همکاری آژانس‌ها')).toBeInTheDocument();
    expect(await screen.findByText('آژانس‌های دارای بدهی یا فاکتور پرداخت‌نشده')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ارسال اعلان به همه' })).toBeInTheDocument();
    expect(screen.getByText('بررسی و اقدام')).toBeInTheDocument();

    expect(screen.queryByText('مجموع اعتبار اعطاشده')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'اعتبار و تسویه' })).not.toBeInTheDocument();
  });

  it('credit sub-tab shows settle buttons and settles an agency', async () => {
    mockRole('FINANCE_MANAGER');
    vi.spyOn(agenciesApi, 'fetchAgencies').mockResolvedValue(LIST);
    vi.spyOn(agenciesApi, 'fetchAgencyRequests').mockResolvedValue(REQUESTS);
    const settle = vi
      .spyOn(agenciesApi, 'settleAgency')
      .mockResolvedValue({ settledIrr: 1_330_000_000, ledgerEntryId: 'l1' });

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();
    await screen.findByText('آژانس blujet');

    await userEvent.click(screen.getByRole('button', { name: 'اعتبار و تسویه' }));
    const settleButtons = await screen.findAllByRole('button', { name: 'ثبت تسویه' });
    expect(settleButtons.length).toBeGreaterThan(0);

    await userEvent.click(settleButtons[0]);
    await waitFor(() => expect(settle).toHaveBeenCalled());
    expect(await screen.findByText(/تسویه حساب .* ثبت شد/)).toBeInTheDocument();
  });

  it('shows the empty-search message when no agency matches', async () => {
    mockRole('SENIOR_MANAGER');
    vi.spyOn(agenciesApi, 'fetchAgencies').mockResolvedValue({ agencies: [], kpis: LIST.kpis });
    vi.spyOn(agenciesApi, 'fetchAgencyRequests').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('آژانسی با این عبارت یافت نشد.')).toBeInTheDocument();
    expect(screen.getByText('درخواست جدیدی در انتظار تأیید نیست.')).toBeInTheDocument();
  });

  it('shows an error message when the API fails', async () => {
    mockRole('SENIOR_MANAGER');
    vi.spyOn(agenciesApi, 'fetchAgencies').mockRejectedValue(new Error('network'));
    vi.spyOn(agenciesApi, 'fetchAgencyRequests').mockRejectedValue(new Error('network'));

    renderPage();

    expect(await screen.findByText('خطا در دریافت فهرست آژانس‌ها.')).toBeInTheDocument();
  });
});

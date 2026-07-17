import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AgencyDetailPage from './AgencyDetailPage';
import * as agenciesApi from '../../api/agencies';
import * as useAuthModule from '../../hooks/useAuth';
import type { AgencyDetail } from '../../types/agencies';
import type { Role } from '../../types/auth';

const DETAIL: AgencyDetail = {
  id: 'a1',
  fullName: 'آژانس blujet',
  managerName: 'کامران یوسفی',
  licenseNo: 'AG-10234',
  phone: '+989120000002',
  email: 'info@blujet-agency.example',
  city: 'تهران',
  address: 'تهران، خیابان ولیعصر، پلاک ۱۲۰',
  tier: 'GOLD',
  isActive: true,
  suspendedAt: null,
  suspendReason: null,
  joinedAt: '2023-04-10T00:00:00.000Z',
  credit: { limitIrr: 1_800_000_000, usedIrr: 310_000_000, remainingIrr: 1_490_000_000 },
  stats: { totalSalesIrr: 1_330_000_000, ticketsIssued: 7, passengers: 0 },
  recentActivity: [],
};

const DETAIL_WITH_SCORE: AgencyDetail = {
  ...DETAIL,
  activityScore: { score: 210, badge: 'BRONZE' },
};

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
    <MemoryRouter initialEntries={['/panel/agencies/a1']}>
      <Routes>
        <Route path="/panel/agencies/:agencyId" element={<AgencyDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AgencyDetailPage', () => {
  it("Senior Manager sees credit + API-key sections and no invoices/messages tabs or activity score", async () => {
    mockRole('SENIOR_MANAGER');
    vi.spyOn(agenciesApi, 'fetchAgencyDetail').mockResolvedValue(DETAIL);
    vi.spyOn(agenciesApi, 'fetchAgencyApiKeys').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('اعتبار آژانس')).toBeInTheDocument();
    expect(screen.getByText('دسترسی API رزرواسیون')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تولید API' })).toBeInTheDocument();
    expect(screen.getByText('کامل (جستجو + رزرو + صدور)')).toBeInTheDocument();

    expect(screen.queryByText('فاکتورهای صادرشده')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'مکاتبه‌ها' })).not.toBeInTheDocument();
    expect(screen.queryByText('امتیاز فعالیت آژانس')).not.toBeInTheDocument();
  });

  it('Finance Manager sees credit + settle and no API-key/invoice-issue/messages', async () => {
    mockRole('FINANCE_MANAGER');
    vi.spyOn(agenciesApi, 'fetchAgencyDetail').mockResolvedValue(DETAIL_WITH_SCORE);

    renderPage();

    expect(await screen.findByText('اعتبار آژانس')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ثبت تسویه' })).toBeInTheDocument();
    expect(screen.getByText('امتیاز فعالیت آژانس')).toBeInTheDocument();

    expect(screen.queryByText('دسترسی API رزرواسیون')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'صدور فاکتور' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'مکاتبه‌ها' })).not.toBeInTheDocument();
  });

  it('Commercial Manager sees the نمای کلی/مالی/مکاتبه‌ها sub-tabs with invoice issuance and chat', async () => {
    mockRole('COMMERCIAL_MANAGER');
    vi.spyOn(agenciesApi, 'fetchAgencyDetail').mockResolvedValue(DETAIL_WITH_SCORE);
    vi.spyOn(agenciesApi, 'fetchAgencyInvoices').mockResolvedValue([
      {
        id: 'inv1',
        agencyId: 'a1',
        invoiceNo: 'INV-1002',
        issuedById: 'u9',
        issuedAt: '2026-06-20T00:00:00.000Z',
        dueAt: '2026-07-05T00:00:00.000Z',
        amountIrr: 800_000_000,
        status: 'UNPAID',
        paidAt: null,
      },
    ]);
    vi.spyOn(agenciesApi, 'fetchAgencyMessages').mockResolvedValue([
      {
        id: 'm1',
        agencyId: 'a1',
        senderId: 'u9',
        senderIsAgency: false,
        body: 'لطفاً فاکتور را تسویه بفرمایید.',
        createdAt: '2026-07-01T10:00:00.000Z',
      },
    ]);

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();

    expect(await screen.findByRole('button', { name: 'نمای کلی' })).toBeInTheDocument();
    expect(screen.getByText('امتیاز فعالیت آژانس')).toBeInTheDocument();
    expect(screen.queryByText('دسترسی API رزرواسیون')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'مالی' }));
    expect(await screen.findByText('فاکتورهای صادرشده')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'صدور فاکتور' })).toBeInTheDocument();
    expect(screen.getByText('INV-1002')).toBeInTheDocument();
    expect(screen.getByText('در انتظار پرداخت')).toBeInTheDocument();
    // Jalali due date rendered with Persian digits, not the raw ISO string
    expect(screen.queryByText('2026-07-05T00:00:00.000Z')).not.toBeInTheDocument();
    // Commercial settles via invoices — no manual settle button
    expect(screen.queryByRole('button', { name: 'ثبت تسویه' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'مکاتبه‌ها' }));
    expect(await screen.findByText('لطفاً فاکتور را تسویه بفرمایید.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('پیام خود را به این آژانس بنویسید…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ارسال' })).toBeInTheDocument();
  });

  it('suspending requires a reason and submits it', async () => {
    mockRole('SENIOR_MANAGER');
    vi.spyOn(agenciesApi, 'fetchAgencyDetail').mockResolvedValue(DETAIL);
    vi.spyOn(agenciesApi, 'fetchAgencyApiKeys').mockResolvedValue([]);
    const suspend = vi.spyOn(agenciesApi, 'suspendAgency').mockResolvedValue(DETAIL);

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();
    await screen.findByRole('button', { name: 'تعلیق حساب' });

    await userEvent.click(screen.getByRole('button', { name: 'تعلیق حساب' }));
    await userEvent.click(screen.getByRole('button', { name: 'تعلیق و ثبت دلیل' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('برای تعلیق حساب، درج دلیل الزامی است.');
    expect(suspend).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('دلیل تعلیق *'), 'بدهی معوق');
    await userEvent.click(screen.getByRole('button', { name: 'تعلیق و ثبت دلیل' }));
    await waitFor(() => expect(suspend).toHaveBeenCalledWith('a1', 'بدهی معوق'));
  });

  it('the credit modal parses a toman amount (Persian digits allowed) into rial', async () => {
    mockRole('FINANCE_MANAGER');
    vi.spyOn(agenciesApi, 'fetchAgencyDetail').mockResolvedValue(DETAIL);
    const update = vi
      .spyOn(agenciesApi, 'updateAgencyCredit')
      .mockResolvedValue({ limitIrr: 2_000_000_000, usedIrr: 310_000_000, remainingIrr: 1_690_000_000 });

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();
    await screen.findByRole('button', { name: 'تعیین اعتبار' });

    await userEvent.click(screen.getByRole('button', { name: 'تعیین اعتبار' }));
    await userEvent.type(screen.getByLabelText('سقف اعتبار جدید (تومان)'), '۲۰۰٬۰۰۰٬۰۰۰');
    await userEvent.click(screen.getByRole('button', { name: 'ثبت اعتبار' }));

    // 200,000,000 toman -> 2,000,000,000 rial
    await waitFor(() => expect(update).toHaveBeenCalledWith('a1', 2_000_000_000));
  });
});

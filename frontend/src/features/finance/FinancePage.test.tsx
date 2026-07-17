import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FinancePage from './FinancePage';
import * as financeApi from '../../api/finance';
import * as reportingApi from '../../api/reporting';
import * as useAuthModule from '../../hooks/useAuth';
import type { FinanceSummary, FinanceTransaction, SettlementsResult } from '../../types/finance';
import type { SalesChartPeriod } from '../../types/reporting';
import type { Role } from '../../types/auth';

const SUMMARY: FinanceSummary = {
  kpis: {
    revenueIrr: 20_000_000_000,
    profitIrr: 6_000_000_000,
    marginPct: 30,
    operatingCostIrr: 10_000_000_000,
    agencyDebtIrr: 1_400_000_000,
    agencyDebtCount: 2,
  },
  seats: { flightCount: 23, totalSeats: 4140, soldSeats: 3220, unsoldSeats: 920 },
  donut: { SYSTEM: 10_000_000_000, CHARTER: 6_000_000_000, AGENCY: 4_000_000_000 },
};

const CHART: SalesChartPeriod[] = [
  {
    periodKey: '2026-07-01',
    startDate: '2026-07-01T00:00:00.000Z',
    endDate: '2026-08-01T00:00:00.000Z',
    systemIrr: 10_000_000_000,
    charterIrr: 6_000_000_000,
    agencyIrr: 4_000_000_000,
  },
];

const TX: FinanceTransaction[] = [
  {
    id: 't1',
    type: 'SETTLEMENT',
    labelFa: 'تسویه حساب دوره‌ای',
    direction: 'IN',
    party: 'آژانس blujet',
    amountIrr: 3_800_000_000,
    signedAmountIrr: -3_800_000_000,
    occurredAt: '2026-07-17T10:00:00.000Z',
  },
  {
    id: 't2',
    type: 'REFUND',
    labelFa: 'استرداد بلیط',
    direction: 'OUT',
    party: 'نگار رضایی · BLJ2K8',
    amountIrr: 41_000_000,
    signedAmountIrr: -41_000_000,
    occurredAt: '2026-07-16T10:00:00.000Z',
  },
];

const SETTLEMENTS: SettlementsResult = {
  rows: [
    {
      id: 's1',
      invoiceNo: 'INV-1',
      agencyName: 'آژانس blujet',
      amountIrr: 3_800_000_000,
      dueAt: '2026-07-30T00:00:00.000Z',
      issuedAt: '2026-07-01T00:00:00.000Z',
      status: 'SETTLED',
      overdueDays: 0,
      paidPct: 100,
    },
    {
      id: 's2',
      invoiceNo: 'INV-2',
      agencyName: 'کیان‌سیر جنوب',
      amountIrr: 5_200_000_000,
      dueAt: '2026-07-01T00:00:00.000Z',
      issuedAt: '2026-06-01T00:00:00.000Z',
      status: 'OVERDUE',
      overdueDays: 16,
      paidPct: 0,
    },
  ],
  outstandingIrr: 5_200_000_000,
};

function mockRole(role: Role) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'authenticated',
    user: { id: 'me', fullName: 'کاربر تست', role },
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    signOut: vi.fn(),
  });
}

function mockCommon() {
  vi.spyOn(financeApi, 'fetchFinanceSummary').mockResolvedValue(SUMMARY);
  vi.spyOn(reportingApi, 'fetchSalesChart').mockResolvedValue(CHART);
  vi.spyOn(financeApi, 'fetchFinanceTransactions').mockResolvedValue(TX);
  vi.spyOn(financeApi, 'fetchSettlements').mockResolvedValue(SETTLEMENTS);
  vi.spyOn(reportingApi, 'fetchLowSalesAlerts').mockResolvedValue([]);
}

describe('FinancePage', () => {
  it('renders the KPI row (toman via faMoney), seats summary and donut with percentages', async () => {
    mockRole('CEO');
    mockCommon();
    render(<FinancePage />);

    // 20B rial → ۲٬۰۰۰٬۰۰۰٬۰۰۰ toman
    expect(await screen.findByText('۲٬۰۰۰٬۰۰۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(screen.getByText(/کل درآمد/)).toBeInTheDocument();
    expect(screen.getByText(/حاشیه/)).toBeInTheDocument();
    expect(screen.getByText('هزینه عملیاتی')).toBeInTheDocument();
    expect(screen.getByText(/مطالبات معوق آژانس‌ها/)).toBeInTheDocument();

    expect(screen.getByText('پروازهای انجام‌شده')).toBeInTheDocument();
    expect(screen.getByText('۳۲۲۰')).toBeInTheDocument(); // sold seats (faDigits — no thousands separator)

    expect(screen.getByText('ترکیب درآمد')).toBeInTheDocument();
    // SYSTEM 10B / 20B → ۵۰٪
    expect(screen.getByText(/۱٬۰۰۰٬۰۰۰٬۰۰۰ تومان · ۵۰٪/)).toBeInTheDocument();
  });

  it('an executive does NOT see the finance-manager-only blocks', async () => {
    mockRole('CEO');
    mockCommon();
    render(<FinancePage />);

    await screen.findByText('ترکیب درآمد');
    expect(screen.queryByText('تراکنش‌های مالی اخیر')).not.toBeInTheDocument();
    expect(screen.queryByText('تسویه‌حساب آژانس‌های همکار')).not.toBeInTheDocument();
  });

  it('the finance manager sees transactions + settlements and can send a reminder', async () => {
    mockRole('FINANCE_MANAGER');
    mockCommon();
    const remind = vi
      .spyOn(financeApi, 'remindSettlement')
      .mockResolvedValue({ reminded: true, agencyName: 'کیان‌سیر جنوب' });

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<FinancePage />);

    expect(await screen.findByText('تراکنش‌های مالی اخیر')).toBeInTheDocument();
    expect(screen.getByText('تسویه حساب دوره‌ای')).toBeInTheDocument();
    expect(screen.getByText('استرداد بلیط')).toBeInTheDocument();

    expect(screen.getByText('تسویه‌حساب آژانس‌های همکار')).toBeInTheDocument();
    expect(screen.getByText('تسویه شد')).toBeInTheDocument();
    expect(screen.getByText('معوق — ۱۶ روز')).toBeInTheDocument();

    // Only the unsettled row has a reminder button.
    const remindButtons = screen.getAllByRole('button', { name: 'ارسال یادآوری' });
    expect(remindButtons).toHaveLength(1);
    await userEvent.click(remindButtons[0]);
    await waitFor(() => expect(remind).toHaveBeenCalledWith('s2'));
    expect(await screen.findByText('یادآوری تسویه برای «کیان‌سیر جنوب» ارسال شد ✓')).toBeInTheDocument();
  });

  it('switching to ماه mode shows Jalali month chips; picking one refetches with its periodStart', async () => {
    mockRole('CEO');
    mockCommon();
    const summarySpy = vi.spyOn(financeApi, 'fetchFinanceSummary');

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<FinancePage />);
    await screen.findByText('ترکیب درآمد');

    await userEvent.click(screen.getByRole('button', { name: 'ماه' }));
    // Chips render Persian Jalali month names, e.g. «خرداد ۱۴۰۵».
    const chips = screen
      .getAllByRole('button')
      .filter((b) => /[۰-۹]{4}$/.test(b.textContent ?? ''));
    expect(chips.length).toBe(6);

    summarySpy.mockClear();
    await userEvent.click(chips[0]);
    await waitFor(() =>
      expect(summarySpy).toHaveBeenCalledWith(
        expect.objectContaining({ granularity: 'month', periodStart: expect.any(String) }),
      ),
    );
  });

  it('روز mode validates the Jalali date and shows the day report box', async () => {
    mockRole('CEO');
    mockCommon();

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<FinancePage />);
    await screen.findByText('ترکیب درآمد');

    await userEvent.click(screen.getByRole('button', { name: 'روز' }));
    await userEvent.type(screen.getByLabelText('تاریخ روز (جلالی)'), 'xx/yy');
    await userEvent.click(screen.getByRole('button', { name: 'نمایش گزارش روز' }));
    expect(await screen.findByText(/تاریخ جلالی معتبر وارد کنید/)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('تاریخ روز (جلالی)'));
    await userEvent.type(screen.getByLabelText('تاریخ روز (جلالی)'), '1405/04/26');
    await userEvent.click(screen.getByRole('button', { name: 'نمایش گزارش روز' }));
    expect(await screen.findByText('گزارش فروش روز')).toBeInTheDocument();
    expect(screen.getByText('مجموع روز')).toBeInTheDocument();
  });
});

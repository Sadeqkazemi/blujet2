import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FinancePage from './FinancePage';
import * as reportingApi from '../../api/reporting';
import * as agenciesApi from '../../api/agencies';
import * as useAuthModule from '../../hooks/useAuth';
import type { Role } from '../../types/auth';
import type {
  AgencySettlementsResult,
  CompletedFlightsSummary,
  KpiResult,
  RecentTransactionsResult,
  RevenueMixResult,
} from '../../types/reporting';

const KPIS: KpiResult = {
  revenueIrr: 5_000_000_000,
  profitIrr: 1_200_000_000,
  marginPct: 24,
  operatingCostIrr: 3_800_000_000,
  agencyDebtIrr: 900_000_000,
  agencyDebtCount: 2,
};

const FLIGHTS: CompletedFlightsSummary = {
  flightCount: 12,
  totalSeats: 2160,
  soldSeats: 1800,
  unsoldSeats: 360,
};

const MIX: RevenueMixResult = {
  totalIrr: 5_000_000_000,
  channels: [
    { channel: 'SYSTEM', labelFa: 'فروش سیستمی', amountIrr: 2_300_000_000, pct: 46 },
    { channel: 'CHARTER', labelFa: 'چارتر', amountIrr: 1_550_000_000, pct: 31 },
    { channel: 'AGENCY', labelFa: 'آژانس همکار', amountIrr: 1_150_000_000, pct: 23 },
  ],
};

const TX: RecentTransactionsResult = {
  totalCount: 42,
  rows: [
    {
      id: 't1',
      type: 'SETTLEMENT',
      titleFa: 'تسویه حساب',
      party: 'آژانس blujet',
      occurredAt: '2026-07-10T10:00:00.000Z',
      signedAmountIrr: -450_000_000,
    },
  ],
};

const SETTLEMENTS: AgencySettlementsResult = {
  outstandingIrr: 900_000_000,
  rows: [
    {
      agencyId: 'ag1',
      agencyName: 'آژانس پرواز آسیا',
      totalIrr: 300_000_000,
      paidIrr: 0,
      paidPct: 0,
      dueAt: '2026-06-05T00:00:00.000Z',
      overdueDays: 42,
      status: 'OVERDUE',
      remindInvoiceId: 'inv3',
    },
  ],
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

describe('FinancePage', () => {
  it('FINANCE_MANAGER gets the finance-ops view: transactions, settlements, remind action', async () => {
    mockRole('FINANCE_MANAGER');
    vi.spyOn(reportingApi, 'fetchKpis').mockResolvedValue(KPIS);
    vi.spyOn(reportingApi, 'fetchLowSalesAlerts').mockResolvedValue([]);
    vi.spyOn(reportingApi, 'fetchCompletedFlightsSummary').mockResolvedValue(FLIGHTS);
    vi.spyOn(reportingApi, 'fetchRecentTransactions').mockResolvedValue(TX);
    vi.spyOn(reportingApi, 'fetchRevenueMix').mockResolvedValue(MIX);
    vi.spyOn(reportingApi, 'fetchAgencySettlements').mockResolvedValue(SETTLEMENTS);
    const remindSpy = vi.spyOn(agenciesApi, 'remindAgencyInvoice').mockResolvedValue({ queued: true });

    render(<FinancePage />);
    expect(await screen.findByText('تراکنش‌های مالی اخیر')).toBeInTheDocument();
    expect(screen.getByText('تسویه حساب')).toBeInTheDocument();
    expect(screen.getByText('تسویه‌حساب آژانس‌های همکار')).toBeInTheDocument();
    expect(screen.getByText(/معوق — ۴۲ روز/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'ارسال یادآوری' }));
    await waitFor(() => expect(remindSpy).toHaveBeenCalledWith('ag1', 'inv3'));
  });

  it('CEO gets the analytic view: sales chart + revenue mix, no transactions/settlements', async () => {
    mockRole('CEO');
    vi.spyOn(reportingApi, 'fetchSalesChart').mockResolvedValue([
      {
        periodKey: '2026-07-01',
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-08-01T00:00:00.000Z',
        systemIrr: 2_300_000_000,
        charterIrr: 1_550_000_000,
        agencyIrr: 1_150_000_000,
      },
    ]);
    vi.spyOn(reportingApi, 'fetchCompletedFlightsSummary').mockResolvedValue(FLIGHTS);
    vi.spyOn(reportingApi, 'fetchRevenueMix').mockResolvedValue(MIX);

    render(<FinancePage />);
    expect(await screen.findByText('نمودار فروش')).toBeInTheDocument();
    expect(screen.getByText('ترکیب درآمد')).toBeInTheDocument();
    expect(screen.queryByText('تراکنش‌های مالی اخیر')).not.toBeInTheDocument();
    expect(screen.queryByText('تسویه‌حساب آژانس‌های همکار')).not.toBeInTheDocument();
  });
});

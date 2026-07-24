import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FinancePage from './FinancePage';
import * as reportingApi from '../../api/reporting';
import * as agenciesApi from '../../api/agencies';
import * as reconciliationApi from '../../api/reconciliation';
import * as useAuthModule from '../../hooks/useAuth';
import type { Role } from '../../types/auth';
import type {
  AgencySettlementsResult,
  CompletedFlightsSummary,
  KpiResult,
  RecentTransactionsResult,
  RevenueMixResult,
} from '../../types/reporting';
import type { ReconciliationItem } from '../../types/reconciliation';

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

const RECONCILIATION_ITEM: ReconciliationItem = {
  id: 'rc1',
  pnr: 'BJ9K2L',
  bookingStatus: 'HELD',
  gatewayRefId: 'GW-88213',
  amountIrr: 420_000_000,
  createdAt: '2026-07-12T09:00:00.000Z',
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
    vi.spyOn(reconciliationApi, 'fetchReconciliationQueue').mockResolvedValue([]);
    const remindSpy = vi.spyOn(agenciesApi, 'remindAgencyInvoice').mockResolvedValue({ queued: true });

    render(<FinancePage />);
    expect(await screen.findByText('تراکنش‌های مالی اخیر')).toBeInTheDocument();
    expect(screen.getByText('تسویه حساب')).toBeInTheDocument();
    expect(screen.getByText('تسویه‌حساب آژانس‌های همکار')).toBeInTheDocument();
    expect(screen.getByText(/معوق — ۴۲ روز/)).toBeInTheDocument();
    expect(screen.getByText('موردی برای بررسی وجود ندارد.')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'ارسال یادآوری' }));
    await waitFor(() => expect(remindSpy).toHaveBeenCalledWith('ag1', 'inv3'));
  });

  it('shows the payment-reconciliation queue and resolves an item with a required note', async () => {
    mockRole('FINANCE_MANAGER');
    vi.spyOn(reportingApi, 'fetchKpis').mockResolvedValue(KPIS);
    vi.spyOn(reportingApi, 'fetchLowSalesAlerts').mockResolvedValue([]);
    vi.spyOn(reportingApi, 'fetchCompletedFlightsSummary').mockResolvedValue(FLIGHTS);
    vi.spyOn(reportingApi, 'fetchRecentTransactions').mockResolvedValue(TX);
    vi.spyOn(reportingApi, 'fetchRevenueMix').mockResolvedValue(MIX);
    vi.spyOn(reportingApi, 'fetchAgencySettlements').mockResolvedValue(SETTLEMENTS);
    vi.spyOn(reconciliationApi, 'fetchReconciliationQueue').mockResolvedValue([RECONCILIATION_ITEM]);
    const resolveSpy = vi
      .spyOn(reconciliationApi, 'resolveReconciliation')
      .mockResolvedValue({ ...RECONCILIATION_ITEM, bookingStatus: 'TICKETED' });

    render(<FinancePage />);
    expect(await screen.findByTestId('reconciliation-item')).toHaveTextContent('BJ9K2L');
    expect(screen.getByTestId('reconciliation-item')).toHaveTextContent('GW-88213');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'رفع مغایرت' }));

    // an empty/too-short note is rejected client-side, without calling the API
    await user.click(screen.getByRole('button', { name: 'ثبت رفع مغایرت' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('حداقل ۳ نویسه');
    expect(resolveSpy).not.toHaveBeenCalled();

    await user.type(screen.getByTestId('reconciliation-note'), 'بلیط دستی صادر شد.');
    await user.click(screen.getByRole('button', { name: 'ثبت رفع مغایرت' }));

    await waitFor(() => expect(resolveSpy).toHaveBeenCalledWith('rc1', 'بلیط دستی صادر شد.'));
    await waitFor(() => expect(screen.queryByTestId('reconciliation-item')).not.toBeInTheDocument());
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

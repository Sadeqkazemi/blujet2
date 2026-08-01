import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ExecutiveDashboardPage from './ExecutiveDashboardPage';
import * as reportingApi from '../../../api/reporting';
import * as cartableApi from '../../../api/cartable';

const STATS = {
  activeAgencies: 12,
  activeAgenciesTrendPct: 8,
  passengersThisMonth: 340,
  passengersTrendPct: 15,
  ticketsSoldThisMonth: 280,
  ticketsTrendPct: 10,
  revenueThisMonthIrr: '4200000000',
  revenueTrendPct: 12,
};

const MIX = {
  totalIrr: '21280000000',
  channels: [
    { channel: 'SYSTEM', labelFa: 'فروش سیستمی', amountIrr: '9120000000', pct: 43 },
    { channel: 'CHARTER', labelFa: 'فروش چارتر', amountIrr: '7600000000', pct: 36 },
    { channel: 'AGENCY', labelFa: 'فروش آژانس', amountIrr: '4560000000', pct: 21 },
  ],
};

describe('ExecutiveDashboardPage', () => {
  it('renders design-aligned KPI cards, revenue mix, and cartable widget', async () => {
    vi.spyOn(reportingApi, 'fetchExecutiveDashboardStats').mockResolvedValue(STATS);
    vi.spyOn(reportingApi, 'fetchRevenueMix').mockResolvedValue(MIX);
    vi.spyOn(reportingApi, 'fetchLowSalesAlerts').mockResolvedValue([]);
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue({
      totalOpen: 2,
      counts: { ADMIN: 0, AGENCY: 0, MANAGER: 2 },
      tasks: [
        {
          id: 't1',
          category: 'MANAGER',
          title: 'بررسی تسویه آژانس',
          description: 'لطفاً بررسی شود.',
          senderLabelFa: 'مدیر بازرگانی',
          sender: null,
          sourceType: 'MANAGER_MESSAGE',
          sourceId: 'm1',
          status: 'OPEN',
          resolutionNote: null,
          createdAt: '2026-07-10T10:00:00.000Z',
        },
      ],
    });

    render(
      <MemoryRouter>
        <ExecutiveDashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('آژانس فعال')).toBeInTheDocument();
    expect(screen.getByText('مسافر این ماه')).toBeInTheDocument();
    expect(screen.getByText('بلیط فروخته‌شده')).toBeInTheDocument();
    expect(screen.getByText('درآمد (تومان)')).toBeInTheDocument();
    expect(screen.getByText('گزارش مالی')).toBeInTheDocument();
    expect(screen.getByText('کارتابل')).toBeInTheDocument();
    expect(screen.getByText('بررسی تسویه آژانس')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'مشاهده جزئیات ←' })).toHaveAttribute('href', '/panel/finance');
  });

  it('shows the low-sales alert banner when alerts exist', async () => {
    vi.spyOn(reportingApi, 'fetchExecutiveDashboardStats').mockResolvedValue(STATS);
    vi.spyOn(reportingApi, 'fetchRevenueMix').mockResolvedValue(MIX);
    vi.spyOn(reportingApi, 'fetchLowSalesAlerts').mockResolvedValue([
      {
        flightNo: 'IR-655',
        originCode: 'THR',
        destCode: 'IST',
        departureAt: '2026-07-13T08:00:00.000Z',
        soldSeats: 75,
        capacity: 146,
      },
    ]);
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue({
      totalOpen: 0,
      counts: { ADMIN: 0, AGENCY: 0, MANAGER: 0 },
      tasks: [],
    });

    render(
      <MemoryRouter>
        <ExecutiveDashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/هشدار فروش ضعیف/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/IR-655/)).toBeInTheDocument());
  });
});

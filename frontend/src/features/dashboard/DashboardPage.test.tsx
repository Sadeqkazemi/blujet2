import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';
import * as reportingApi from '../../api/reporting';
import * as cartableApi from '../../api/cartable';

const STATS = {
  activeAgencies: 12,
  activeAgenciesTrendPct: 8,
  passengersThisMonth: 24890,
  passengersTrendPct: 12,
  ticketsSoldThisMonth: 38210,
  ticketsTrendPct: 5,
  revenueThisMonthIrr: '824000000000',
  revenueTrendPct: 15,
};

const MIX = {
  totalIrr: '21280000000',
  channels: [
    { channel: 'SYSTEM' as const, labelFa: 'سیستمی', amountIrr: '9120000000', pct: 43 },
    { channel: 'CHARTER' as const, labelFa: 'چارتر', amountIrr: '7600000000', pct: 36 },
    { channel: 'AGENCY' as const, labelFa: 'آژانس', amountIrr: '4560000000', pct: 21 },
  ],
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.spyOn(reportingApi, 'fetchFinanceDashboardStats').mockResolvedValue(STATS);
    vi.spyOn(reportingApi, 'fetchRevenueMix').mockResolvedValue(MIX);
    vi.spyOn(reportingApi, 'fetchLowSalesAlerts').mockResolvedValue([]);
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue({
      tasks: [],
      counts: { ADMIN: 0, AGENCY: 0, MANAGER: 0 },
      totalOpen: 0,
    });
  });

  it('renders design KPI cards, channel summary, and cartable with real-shaped data', async () => {
    renderDashboard();

    expect(await screen.findByText('آژانس فعال')).toBeInTheDocument();
    expect(screen.getByText('مسافر این ماه')).toBeInTheDocument();
    expect(screen.getByText('بلیط فروخته‌شده')).toBeInTheDocument();
    expect(screen.getByText('درآمد (تومان)')).toBeInTheDocument();
    expect(screen.getByText('۱۲')).toBeInTheDocument();
    expect(screen.getByText('+۸٪')).toBeInTheDocument();

    expect(screen.getByText('گزارش مالی')).toBeInTheDocument();
    expect(screen.getByText('جمع فروش سال')).toBeInTheDocument();
    expect(screen.getByText('فروش سیستمی')).toBeInTheDocument();
    expect(screen.getByText('کارتابل')).toBeInTheDocument();
    expect(screen.getByText('نمای کلی فروش و کارهای در انتظار اقدام')).toBeInTheDocument();
  });

  it('shows the low-sales alert banner from the reporting API', async () => {
    vi.spyOn(reportingApi, 'fetchLowSalesAlerts').mockResolvedValue([
      {
        flightNo: 'IR-655',
        originCode: 'THR',
        destCode: 'IST',
        departureAt: '2026-07-04T08:00:00.000Z',
        capacity: 146,
        soldSeats: 75,
        occupancyPct: 51,
      },
    ]);

    renderDashboard();

    expect(await screen.findByText('هشدار فروش ضعیف — کمتر از ۷۲ ساعت تا پرواز')).toBeInTheDocument();
    expect(screen.getByText('IR-655')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/۷۵/)).toBeInTheDocument());
  });

  it('shows an error message when the reporting API fails', async () => {
    vi.spyOn(reportingApi, 'fetchFinanceDashboardStats').mockRejectedValue(new Error('network error'));
    vi.spyOn(reportingApi, 'fetchRevenueMix').mockRejectedValue(new Error('network error'));

    renderDashboard();

    expect(await screen.findByText('خطا در دریافت اطلاعات داشبورد.')).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';
import * as reportingApi from '../../api/reporting';
import * as cartableApi from '../../api/cartable';

// Money fields are decimal STRINGs on the wire (BigInt.prototype.toJSON on
// the backend — a JS number can't safely hold IRR amounts above 2^53).
const SALES_CHART = [
  {
    periodKey: '2026-06-01',
    startDate: '2026-06-01T00:00:00.000Z',
    endDate: '2026-07-01T00:00:00.000Z',
    systemIrr: '9120000000',
    charterIrr: '7600000000',
    agencyIrr: '4560000000',
  },
];

const KPIS = {
  revenueIrr: '21280000000',
  profitIrr: '17000000000',
  marginPct: 80,
  operatingCostIrr: '4280000000',
  agencyDebtIrr: '0',
  agencyDebtCount: 0,
  trends: {
    revenuePct: 5,
    profitPct: 4,
    operatingCostPct: 2,
    agencyDebtPct: 0,
  },
};

const FLIGHTS_SUMMARY = { flightCount: 4, totalSeats: 720, soldSeats: 56, unsoldSeats: 664 };

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.spyOn(reportingApi, 'fetchLowSalesAlerts').mockResolvedValue([]);
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue({
      tasks: [],
      counts: { ADMIN: 0, AGENCY: 0, MANAGER: 0 },
      totalOpen: 0,
    });
  });

  it('renders KPI cards, the sales chart and completed-flights summary with real-shaped data', async () => {
    vi.spyOn(reportingApi, 'fetchSalesChart').mockResolvedValue(SALES_CHART);
    vi.spyOn(reportingApi, 'fetchKpis').mockResolvedValue(KPIS);
    vi.spyOn(reportingApi, 'fetchCompletedFlightsSummary').mockResolvedValue(FLIGHTS_SUMMARY);

    renderDashboard();

    expect(await screen.findByText('کل درآمد')).toBeInTheDocument();
    expect(screen.getByText('۲٬۱۲۸٬۰۰۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(screen.getByText('۱٬۷۰۰٬۰۰۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(screen.getByText('حاشیه ۸۰٪')).toBeInTheDocument();
    expect(screen.getByText('گزارش مالی')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('۴')).toBeInTheDocument());
    expect(screen.getByText('۶۶۴')).toBeInTheDocument();
  });

  it('shows the low-sales alert banner from the reporting API', async () => {
    vi.spyOn(reportingApi, 'fetchSalesChart').mockResolvedValue(SALES_CHART);
    vi.spyOn(reportingApi, 'fetchKpis').mockResolvedValue(KPIS);
    vi.spyOn(reportingApi, 'fetchCompletedFlightsSummary').mockResolvedValue(FLIGHTS_SUMMARY);
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
    expect(screen.getByText(/۷۵/)).toBeInTheDocument();
  });

  it('shows an error message when the reporting API fails', async () => {
    vi.spyOn(reportingApi, 'fetchSalesChart').mockRejectedValue(new Error('network error'));
    vi.spyOn(reportingApi, 'fetchKpis').mockRejectedValue(new Error('network error'));
    vi.spyOn(reportingApi, 'fetchCompletedFlightsSummary').mockRejectedValue(new Error('network error'));

    renderDashboard();

    expect(await screen.findByText('خطا در دریافت اطلاعات داشبورد.')).toBeInTheDocument();
  });

  it('loads day granularity with a date parameter', async () => {
    const chartSpy = vi.spyOn(reportingApi, 'fetchSalesChart').mockResolvedValue(SALES_CHART);
    vi.spyOn(reportingApi, 'fetchKpis').mockResolvedValue(KPIS);
    vi.spyOn(reportingApi, 'fetchCompletedFlightsSummary').mockResolvedValue(FLIGHTS_SUMMARY);

    const { default: userEvent } = await import('@testing-library/user-event');
    renderDashboard();
    await screen.findByText('کل درآمد');

    await userEvent.click(screen.getByRole('button', { name: 'روزانه' }));
    expect(await screen.findByTestId('sales-chart-day')).toBeInTheDocument();

    await waitFor(() =>
      expect(chartSpy).toHaveBeenCalledWith(expect.objectContaining({ granularity: 'day', date: expect.any(String) })),
    );
  });

  it('loads month granularity with a periodStart parameter', async () => {
    const chartSpy = vi.spyOn(reportingApi, 'fetchSalesChart').mockResolvedValue(SALES_CHART);
    vi.spyOn(reportingApi, 'fetchKpis').mockResolvedValue(KPIS);
    vi.spyOn(reportingApi, 'fetchCompletedFlightsSummary').mockResolvedValue(FLIGHTS_SUMMARY);

    const { default: userEvent } = await import('@testing-library/user-event');
    renderDashboard();
    await screen.findByText('کل درآمد');

    await userEvent.click(screen.getByRole('button', { name: 'ماهانه' }));
    await waitFor(() =>
      expect(chartSpy).toHaveBeenCalledWith(
        expect.objectContaining({ granularity: 'month', periodStart: expect.any(String) }),
      ),
    );
  });
});

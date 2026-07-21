import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';
import * as reportingApi from '../../api/reporting';

const SALES_CHART = [
  {
    periodKey: '2026-06-01',
    startDate: '2026-06-01T00:00:00.000Z',
    endDate: '2026-07-01T00:00:00.000Z',
    systemIrr: 9_120_000_000,
    charterIrr: 7_600_000_000,
    agencyIrr: 4_560_000_000,
  },
];

const KPIS = {
  revenueIrr: 21_280_000_000,
  profitIrr: 17_000_000_000,
  marginPct: 80,
  operatingCostIrr: 4_280_000_000,
  agencyDebtIrr: 0,
  agencyDebtCount: 0,
};

const FLIGHTS_SUMMARY = { flightCount: 4, totalSeats: 720, soldSeats: 56, unsoldSeats: 664 };

describe('DashboardPage', () => {
  it('renders KPI cards, the sales chart and completed-flights summary with real-shaped data', async () => {
    vi.spyOn(reportingApi, 'fetchSalesChart').mockResolvedValue(SALES_CHART);
    vi.spyOn(reportingApi, 'fetchKpis').mockResolvedValue(KPIS);
    vi.spyOn(reportingApi, 'fetchCompletedFlightsSummary').mockResolvedValue(FLIGHTS_SUMMARY);

    render(<DashboardPage />);

    expect(await screen.findByText('کل درآمد')).toBeInTheDocument();
    expect(screen.getByText('۲٬۱۲۸٬۰۰۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(screen.getByText('۱٬۷۰۰٬۰۰۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(screen.getByText('حاشیه ۸۰٪')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('۴')).toBeInTheDocument());
    expect(screen.getByText('۶۶۴')).toBeInTheDocument(); // unsold seats, Persian digits
  });

  it('shows an error message when the reporting API fails', async () => {
    vi.spyOn(reportingApi, 'fetchSalesChart').mockRejectedValue(new Error('network error'));
    vi.spyOn(reportingApi, 'fetchKpis').mockRejectedValue(new Error('network error'));
    vi.spyOn(reportingApi, 'fetchCompletedFlightsSummary').mockRejectedValue(new Error('network error'));

    render(<DashboardPage />);

    expect(await screen.findByText('خطا در دریافت اطلاعات داشبورد.')).toBeInTheDocument();
  });

  it('disables the day/month/flight modes with a "coming later" message', async () => {
    vi.spyOn(reportingApi, 'fetchSalesChart').mockResolvedValue(SALES_CHART);
    vi.spyOn(reportingApi, 'fetchKpis').mockResolvedValue(KPIS);
    vi.spyOn(reportingApi, 'fetchCompletedFlightsSummary').mockResolvedValue(FLIGHTS_SUMMARY);

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<DashboardPage />);
    await screen.findByText('کل درآمد');

    await userEvent.click(screen.getByRole('button', { name: 'روزانه' }));
    expect(await screen.findByText('این حالت نمایش در فاز بعدی تکمیل می‌شود.')).toBeInTheDocument();
  });
});

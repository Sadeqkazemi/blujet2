import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';
import * as reportingApi from '../../api/reporting';
import type { KpiResult, CompletedFlightsSummary, RevenueMixResult } from '../../types/reporting';

// Money fields are decimal STRINGs on the wire (BigInt.prototype.toJSON on
// the backend — a JS number can't safely hold IRR amounts above 2^53).
const KPIS: KpiResult = {
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

const FLIGHTS_SUMMARY: CompletedFlightsSummary = { flightCount: 4, totalSeats: 720, soldSeats: 56, unsoldSeats: 664 };

const MIX: RevenueMixResult = {
  totalIrr: '5000000000',
  channels: [
    { channel: 'SYSTEM', labelFa: 'فروش سیستمی', amountIrr: '2300000000', pct: 46 },
    { channel: 'CHARTER', labelFa: 'چارتر', amountIrr: '1550000000', pct: 31 },
    { channel: 'AGENCY', labelFa: 'آژانس همکار', amountIrr: '1150000000', pct: 23 },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  it('renders KPI cards, the financial summary card and completed-flights summary with real-shaped data', async () => {
    vi.spyOn(reportingApi, 'fetchRevenueMix').mockResolvedValue(MIX);
    vi.spyOn(reportingApi, 'fetchKpis').mockResolvedValue(KPIS);
    vi.spyOn(reportingApi, 'fetchCompletedFlightsSummary').mockResolvedValue(FLIGHTS_SUMMARY);

    renderPage();

    expect(await screen.findByText('کل درآمد')).toBeInTheDocument();
    expect(screen.getByText('۲٬۱۲۸٬۰۰۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(screen.getByText('۱٬۷۰۰٬۰۰۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(screen.getByText('حاشیه ۸۰٪')).toBeInTheDocument();

    expect(await screen.findByText('گزارش مالی')).toBeInTheDocument();
    expect(screen.getByText('۵۰۰٬۰۰۰٬۰۰۰')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('۴')).toBeInTheDocument());
    expect(screen.getByText('۶۶۴')).toBeInTheDocument();
  });

  it('shows an error message when the reporting API fails', async () => {
    vi.spyOn(reportingApi, 'fetchRevenueMix').mockRejectedValue(new Error('network error'));
    vi.spyOn(reportingApi, 'fetchKpis').mockRejectedValue(new Error('network error'));
    vi.spyOn(reportingApi, 'fetchCompletedFlightsSummary').mockRejectedValue(new Error('network error'));

    renderPage();

    expect(await screen.findByText('خطا در دریافت اطلاعات داشبورد.')).toBeInTheDocument();
  });

  it('requests the yearly channel mix for the summary card', async () => {
    const mixSpy = vi.spyOn(reportingApi, 'fetchRevenueMix').mockResolvedValue(MIX);
    vi.spyOn(reportingApi, 'fetchKpis').mockResolvedValue(KPIS);
    vi.spyOn(reportingApi, 'fetchCompletedFlightsSummary').mockResolvedValue(FLIGHTS_SUMMARY);

    renderPage();
    await screen.findByText('کل درآمد');

    expect(mixSpy).toHaveBeenCalledWith(expect.objectContaining({ granularity: 'year' }));
  });
});

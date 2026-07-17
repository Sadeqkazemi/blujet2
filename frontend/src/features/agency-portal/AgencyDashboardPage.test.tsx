import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AgencyDashboardPage from './AgencyDashboardPage';
import * as portalApi from '../../api/agency-portal';
import type { AgencyDashboard } from '../../types/agency-portal';

const DASHBOARD: AgencyDashboard = {
  credit: { limitIrr: 1_800_000_000, usedIrr: 500_000_000, remainingIrr: 1_300_000_000 },
  kpis: { salesThisMonthIrr: 384_000_000, ticketsIssuedTotal: 142, seatsSoldThisMonth: 12 },
  monthlySales: [
    { month: '2026-02', salesIrr: 100_000_000 },
    { month: '2026-03', salesIrr: 120_000_000 },
    { month: '2026-04', salesIrr: 90_000_000 },
    { month: '2026-05', salesIrr: 200_000_000 },
    { month: '2026-06', salesIrr: 150_000_000 },
    { month: '2026-07', salesIrr: 384_000_000 },
  ],
};

describe('AgencyDashboardPage', () => {
  it('renders real KPI cards and the 6-month sales chart from the API, not fabricated data', async () => {
    vi.spyOn(portalApi, 'fetchDashboard').mockResolvedValue(DASHBOARD);
    render(<AgencyDashboardPage />);

    expect(await screen.findByText('داشبورد')).toBeInTheDocument();
    expect(screen.getByText('۳۸٬۴۰۰٬۰۰۰')).toBeInTheDocument();
    expect(screen.getByText('۱۳۰٬۰۰۰٬۰۰۰')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'نمودار فروش ۶ ماه اخیر' })).toBeInTheDocument();
  });
});

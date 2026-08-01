import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgencyDashboardPage from './AgencyDashboardPage';
import * as portalApi from '../../api/agency-portal';
import * as useLocaleModule from '../../hooks/useLocale';
import type { AgencyDashboard } from '../../types/agency-portal';

function mockLocale(locale: 'fa' | 'en' | 'ar') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

afterEach(() => {
  vi.restoreAllMocks();
});

// Money fields are decimal STRINGs on the wire (BigInt.prototype.toJSON on
// the backend — a JS number can't safely hold IRR amounts above 2^53).
const DASHBOARD: AgencyDashboard = {
  credit: { limitIrr: '1800000000', usedIrr: '500000000', remainingIrr: '1300000000' },
  kpis: { salesThisMonthIrr: '384000000', ticketsIssuedTotal: 142, seatsSoldThisMonth: 12 },
  monthlySales: [
    { month: '2026-02', salesIrr: '100000000' },
    { month: '2026-03', salesIrr: '120000000' },
    { month: '2026-04', salesIrr: '90000000' },
    { month: '2026-05', salesIrr: '200000000' },
    { month: '2026-06', salesIrr: '150000000' },
    { month: '2026-07', salesIrr: '384000000' },
  ],
};

describe('AgencyDashboardPage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <AgencyDashboardPage />
      </MemoryRouter>,
    );
  }

  it('renders real KPI cards and the 6-month sales chart from the API, not fabricated data', async () => {
    vi.spyOn(portalApi, 'fetchDashboard').mockResolvedValue(DASHBOARD);
    renderPage();

    expect(await screen.findByText('داشبورد آژانس')).toBeInTheDocument();
    expect(screen.getByTestId('agency-kpi-sales')).toHaveTextContent('۳۸٬۴۰۰٬۰۰۰');
    expect(screen.getByTestId('agency-credit-card')).toHaveTextContent('۱۳۰٬۰۰۰٬۰۰۰');
    expect(screen.getByRole('img', { name: 'نمودار فروش ۶ ماه اخیر' })).toBeInTheDocument();
  });

  it('renders translated headings and KPI labels in English', async () => {
    mockLocale('en');
    vi.spyOn(portalApi, 'fetchDashboard').mockResolvedValue(DASHBOARD);
    renderPage();

    expect(await screen.findByText('Agency Dashboard')).toBeInTheDocument();
    expect(screen.getByText("Sales this month")).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Last 6 months sales chart' })).toBeInTheDocument();
    expect(screen.getByText('Ordibehesht')).toBeInTheDocument();
  });

  it('renders translated headings and KPI labels in Arabic', async () => {
    mockLocale('ar');
    vi.spyOn(portalApi, 'fetchDashboard').mockResolvedValue(DASHBOARD);
    renderPage();

    expect(await screen.findByText('لوحة تحكم الوكالة')).toBeInTheDocument();
    expect(screen.getByTestId('agency-credit-card')).toHaveTextContent('الرصيد المتبقي');
  });
});

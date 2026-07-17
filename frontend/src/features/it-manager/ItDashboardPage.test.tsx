import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ItDashboardPage from './ItDashboardPage';
import * as itApi from '../../api/it-manager';
import type { ItDashboardData } from '../../types/it-manager';

const DATA: ItDashboardData = {
  kpis: {
    activeEmployees: 4,
    activeSessions: 6,
    servicesUp: 14,
    servicesTotal: 16,
    lastBackupStatus: 'SUCCESS',
    lastBackupAt: '2026-07-17T09:00:00.000Z',
  },
  serviceHealth: [
    { name: 'موتور جستجوی پرواز', uptimePct: 99.99, enabled: true },
    { name: 'استرداد آنلاین', uptimePct: 98.2, enabled: false },
  ],
  resources: { memoryUsedPct: 42.5, loadAvg1m: 0.85, cpuCount: 4, uptimeSeconds: 3600 },
  recentEvents: [
    { id: 'e1', text: 'کارمند «رضا کاظمی» ایجاد شد.', category: 'ACCOUNT', createdAt: '2026-07-17T08:00:00.000Z' },
  ],
};

describe('ItDashboardPage', () => {
  it('renders KPI cards, service health list and real resource metrics', async () => {
    vi.spyOn(itApi, 'fetchItDashboard').mockResolvedValue(DATA);

    render(<ItDashboardPage />);

    expect(await screen.findByText('داشبورد فنی')).toBeInTheDocument();
    expect(screen.getByText('کارمندان فعال')).toBeInTheDocument();
    expect(screen.getByText('موتور جستجوی پرواز')).toBeInTheDocument();
    expect(screen.getByText('استرداد آنلاین')).toBeInTheDocument();
    // Persian-digit KPI value ("کارمندان فعال" -> ۴).
    expect(screen.getAllByText('۴').length).toBeGreaterThan(0);
    expect(screen.getByText('کارمند «رضا کاظمی» ایجاد شد.')).toBeInTheDocument();
  });
});

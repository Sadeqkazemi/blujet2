import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmployeeDashboardPage from './EmployeeDashboardPage';
import * as cartableApi from '../../api/cartable';
import * as panelsApi from '../../api/panels';
import type { PanelNavItem } from '../../types/panels';

function Shell({ nav }: { nav: PanelNavItem[] | null }) {
  return <Outlet context={{ nav, lowSalesAlerts: [] }} />;
}

function renderWithNav(nav: PanelNavItem[] | null) {
  return render(
    <MemoryRouter initialEntries={['/panel']}>
      <Routes>
        <Route path="/panel" element={<Shell nav={nav} />}>
          <Route index element={<EmployeeDashboardPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('EmployeeDashboardPage', () => {
  beforeEach(() => {
    vi.spyOn(panelsApi, 'fetchEmployeeContext').mockResolvedValue({
      dept: 'commercial',
      deptLabelFa: 'بازرگانی',
      rank: 'کارشناس',
      permissionLabelsFa: ['داشبورد', 'آژانس‌ها', 'مدیریت پروازها', 'کارتابل', 'ارجاعات'],
    });
    vi.spyOn(cartableApi, 'fetchMyReferrals').mockResolvedValue({
      referrals: [],
      counts: { total: 0, awaitingMyReport: 2 },
    });
  });

  it('renders a link for each granted section from the real server-computed nav', async () => {
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue({
      tasks: [],
      counts: { ADMIN: 0, AGENCY: 0, MANAGER: 0 },
      totalOpen: 0,
    });
    renderWithNav([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
      { key: 'agencies', labelFa: 'آژانس‌ها', implemented: true },
      { key: 'flights', labelFa: 'مدیریت پروازها', implemented: true },
    ]);

    expect(await screen.findByRole('link', { name: /آژانس‌ها/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /مدیریت پروازها/ })).toHaveAttribute('href', '/panel/flights');
  });

  it('shows KPI cards for cartable count, referrals count, and unit label', async () => {
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue({
      tasks: [],
      counts: { ADMIN: 3, AGENCY: 0, MANAGER: 0 },
      totalOpen: 3,
    });
    renderWithNav([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
      { key: 'cartable', labelFa: 'کارتابل', implemented: true },
      { key: 'referrals', labelFa: 'ارجاعات', implemented: true },
    ]);

    await waitFor(() => {
      expect(screen.getByText('کارهای باز کارتابل')).toBeInTheDocument();
    });
    expect(screen.getByText('۳')).toBeInTheDocument();
    expect(screen.getByText('۲')).toBeInTheDocument();
    expect(screen.getByText('بازرگانی')).toBeInTheDocument();
  });

  it('shows a no-access message when nothing has been granted yet', async () => {
    renderWithNav([{ key: 'dashboard', labelFa: 'داشبورد', implemented: true }]);

    expect(
      await screen.findByText('هنوز هیچ دسترسی برای شما توسط مدیر IT فعال نشده است.'),
    ).toBeInTheDocument();
  });

  it('shows the always-present referrals card alongside the no-access message when no IT permission is granted yet', async () => {
    renderWithNav([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
      { key: 'referrals', labelFa: 'ارجاعات', implemented: true },
    ]);

    expect(await screen.findByText('ارجاعات')).toBeInTheDocument();
    expect(
      screen.getByText('هنوز هیچ دسترسی برای شما توسط مدیر IT فعال نشده است.'),
    ).toBeInTheDocument();
  });

  it('hides the no-access message once a real IT-granted section exists alongside referrals', async () => {
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue({
      tasks: [],
      counts: { ADMIN: 0, AGENCY: 0, MANAGER: 0 },
      totalOpen: 0,
    });
    renderWithNav([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
      { key: 'agencies', labelFa: 'آژانس‌ها', implemented: true },
      { key: 'referrals', labelFa: 'ارجاعات', implemented: true },
    ]);

    expect(await screen.findByText('ارجاعات')).toBeInTheDocument();
    expect(
      screen.queryByText('هنوز هیچ دسترسی برای شما توسط مدیر IT فعال نشده است.'),
    ).not.toBeInTheDocument();
  });
});

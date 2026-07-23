import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import EmployeeDashboardPage from './EmployeeDashboardPage';
import type { PanelNavItem } from '../../types/panels';

// PanelShell passes `nav` down via Outlet context; a minimal Outlet-bearing
// wrapper reproduces that for this page in isolation.
function Shell({ nav }: { nav: PanelNavItem[] | null }) {
  return <Outlet context={{ nav }} />;
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
  it('renders a link for each granted section from the real server-computed nav', async () => {
    renderWithNav([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
      { key: 'agencies', labelFa: 'آژانس‌ها', implemented: true },
      { key: 'flights', labelFa: 'مدیریت پروازها', implemented: true },
    ]);

    expect(await screen.findByText('آژانس‌ها')).toBeInTheDocument();
    expect(screen.getByText('مدیریت پروازها')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /آژانس‌ها/ })).toHaveAttribute('href', '/panel/agencies');
  });

  it('shows a no-access message when nothing has been granted yet', async () => {
    renderWithNav([{ key: 'dashboard', labelFa: 'داشبورد', implemented: true }]);

    expect(
      await screen.findByText('هنوز هیچ دسترسی برای شما توسط مدیر IT فعال نشده است.'),
    ).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PanelShell from './PanelShell';
import * as panelsApi from '../api/panels';
import * as cartableApi from '../api/cartable';
import * as refundsApi from '../api/refunds';
import * as reportingApi from '../api/reporting';
import * as useAuthModule from '../hooks/useAuth';

function renderShell() {
  return render(
    <MemoryRouter>
      <PanelShell />
    </MemoryRouter>,
  );
}

describe('PanelShell', () => {
  it('shows sidebar badges for cartable, refund queue, and new staff events', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', fullName: 'مدیر مالی', role: 'FINANCE_MANAGER', preferredLocale: 'FA' },
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(reportingApi, 'fetchLowSalesAlerts').mockResolvedValue([]);
    vi.spyOn(panelsApi, 'fetchNav').mockResolvedValue([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
      { key: 'cartable', labelFa: 'کارتابل', implemented: true },
      { key: 'refund', labelFa: 'استرداد بلیط', implemented: true },
      { key: 'staff', labelFa: 'گزارش کارمندان', implemented: true },
    ]);
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue({
      totalOpen: 3,
      tasks: [],
      counts: { ADMIN: 1, AGENCY: 1, MANAGER: 1 },
    });
    vi.spyOn(refundsApi, 'fetchRefunds').mockResolvedValue({
      requests: [],
      kpis: { payoutQueue: 2, paid: 0, awaitingAdmin: 0 },
    });
    vi.spyOn(reportingApi, 'fetchStaffReports').mockResolvedValue({
      staff: [],
      reports: [],
      newEmployeeEvents: [{ id: 'e1', detail: 'کارمند جدید', at: '2026-07-01T00:00:00.000Z' }],
    });

    renderShell();

    await waitFor(() => {
      expect(screen.getByTestId('nav-badge-cartable')).toHaveTextContent('۳');
      expect(screen.getByTestId('nav-badge-refund')).toHaveTextContent('۲');
      expect(screen.getByTestId('nav-badge-staff')).toHaveTextContent('۱');
    });
  });

  it('shows a purple referrals badge for SENIOR_MANAGER when reports are awaiting', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'u2', fullName: 'مدیر ارشد', role: 'SENIOR_MANAGER', preferredLocale: 'FA' },
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(reportingApi, 'fetchLowSalesAlerts').mockResolvedValue([]);
    vi.spyOn(panelsApi, 'fetchNav').mockResolvedValue([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
      { key: 'referrals', labelFa: 'ارجاعات', implemented: true },
    ]);
    vi.spyOn(cartableApi, 'fetchReferrals').mockResolvedValue({
      referrals: [],
      kpis: { total: 4, awaitingReport: 2, reported: 1, closed: 1 },
    });

    renderShell();

    expect(screen.getByText('پنل مدیریت')).toBeInTheDocument();
    expect(screen.getByText('نقش این پنل')).toBeInTheDocument();
    expect(screen.getAllByText('مدیر ارشد').length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      const badge = screen.getByTestId('nav-badge-referrals');
      expect(badge).toHaveTextContent('۲');
      expect(badge.className).toContain('a855f7');
    });
  });

  it('shows the IT brand subtitle for IT_MANAGER', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'u4', fullName: 'مدیر IT', role: 'IT_MANAGER', preferredLocale: 'FA' },
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(panelsApi, 'fetchNav').mockResolvedValue([
      { key: 'dashboard', labelFa: 'داشبورد فنی', implemented: true },
    ]);

    renderShell();

    expect(screen.getByText('پنل فناوری اطلاعات')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('داشبورد فنی')).toBeInTheDocument();
    });
  });

  it('IT_MANAGER sidebar shows design brand subtitle and role chip', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'u4', fullName: 'مهندس علی صدر', role: 'IT_MANAGER', preferredLocale: 'FA' },
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(panelsApi, 'fetchNav').mockResolvedValue([
      { key: 'dashboard', labelFa: 'داشبورد فنی', implemented: true },
      { key: 'users', labelFa: 'کاربران و دسترسی‌ها', implemented: true },
    ]);

    renderShell();

    expect(await screen.findByText('پنل فناوری اطلاعات')).toBeInTheDocument();
    expect(screen.getAllByText('مدیر فناوری اطلاعات').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'داشبورد فنی' })).toBeInTheDocument();
  });

  it('shows a purple referrals badge for EMPLOYEE when my report is pending', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'u3', fullName: 'کارمند', role: 'EMPLOYEE', preferredLocale: 'FA' },
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(panelsApi, 'fetchNav').mockResolvedValue([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
      { key: 'referrals', labelFa: 'ارجاعات', implemented: true },
    ]);
    vi.spyOn(cartableApi, 'fetchMyReferrals').mockResolvedValue({
      referrals: [],
      counts: { total: 3, awaitingMyReport: 1 },
    });

    renderShell();

    await waitFor(() => {
      expect(screen.getByTestId('nav-badge-referrals')).toHaveTextContent('۱');
    });
  });
});

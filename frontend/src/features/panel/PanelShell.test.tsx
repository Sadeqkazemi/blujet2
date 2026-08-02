import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PanelShell from './PanelShell';
import * as panelsApi from '../../api/panels';
import * as cartableApi from '../../api/cartable';
import * as refundsApi from '../../api/refunds';
import * as reportingApi from '../../api/reporting';
import * as useAuthModule from '../../hooks/useAuth';

function renderShell() {
  return render(
    <MemoryRouter>
      <PanelShell />
    </MemoryRouter>,
  );
}

describe('PanelShell', () => {
  beforeEach(() => {
    vi.spyOn(panelsApi, 'fetchPanelSelfStatus').mockResolvedValue({
      panelKey: 'FINANCE',
      enabled: true,
    });
  });

  it('shows a blocked screen when the role panel is disabled', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'u5', fullName: 'مدیر عامل', role: 'CEO', preferredLocale: 'FA' },
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(panelsApi, 'fetchNav').mockResolvedValue([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    ]);
    vi.spyOn(panelsApi, 'fetchPanelSelfStatus').mockResolvedValue({
      panelKey: 'CEO',
      enabled: false,
    });

    renderShell();

    expect(await screen.findByTestId('panel-blocked')).toBeInTheDocument();
    expect(screen.getByText(/پنل مدیر عامل غیرفعال است/)).toBeInTheDocument();
    expect(screen.queryByTestId('panel-sidebar')).not.toBeInTheDocument();
  });

  it('shows sidebar badges for cartable, refund queue, and new staff events', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', fullName: 'مدیر مالی', role: 'FINANCE_MANAGER', preferredLocale: 'FA' },
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
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
    vi.spyOn(panelsApi, 'fetchNav').mockResolvedValue([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
      { key: 'referrals', labelFa: 'ارجاعات', implemented: true },
    ]);
    vi.spyOn(cartableApi, 'fetchReferrals').mockResolvedValue({
      referrals: [],
      kpis: { total: 4, awaitingReport: 2, reported: 1, closed: 1 },
    });

    renderShell();

    await waitFor(() => {
      const badge = screen.getByTestId('nav-badge-referrals');
      expect(badge).toHaveTextContent('۲');
      expect(badge.className).toContain('a855f7');
    });
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

  it('falls back to BOARD_CHAIR nav when fetchNav fails', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'u6', fullName: 'رئیس هیئت مدیره', role: 'BOARD_CHAIR', preferredLocale: 'FA' },
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(panelsApi, 'fetchNav').mockRejectedValue(new Error('network'));

    renderShell();

    expect(await screen.findByRole('link', { name: 'مدیران' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'داشبورد' })).toBeInTheDocument();
    expect(screen.getByText('دسترسی کامل')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'مشتریان VIP' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'نظرسنجی مسافران' })).toBeInTheDocument();
    expect(screen.queryByText('تبی برای این نقش تعریف نشده است.')).not.toBeInTheDocument();
  });

  it('renders page title and subtitle from active nav item', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'u4', fullName: 'مدیر عامل', role: 'CEO', preferredLocale: 'FA' },
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(panelsApi, 'fetchNav').mockResolvedValue([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
    ]);

    render(
      <MemoryRouter initialEntries={['/panel']}>
        <PanelShell />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('panel-page-title')).toHaveTextContent('داشبورد');
      expect(screen.getByTestId('panel-page-sub')).toHaveTextContent('نمای کلی فروش و کارهای در انتظار اقدام');
    });
  });
});

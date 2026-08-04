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
    vi.spyOn(reportingApi, 'fetchLowSalesAlerts').mockResolvedValue([]);

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
    vi.spyOn(reportingApi, 'fetchLowSalesAlerts').mockResolvedValue([]);

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

  it('puts leftover low-sales alerts in the notification bell (banner keeps the first)', async () => {
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
      { key: 'finance', labelFa: 'مالی', implemented: true },
    ]);
    vi.spyOn(reportingApi, 'fetchLowSalesAlerts').mockResolvedValue([
      {
        flightNo: 'EP-821',
        originCode: 'THR',
        destCode: 'DXB',
        departureAt: '2026-08-03T08:00:00.000Z',
        capacity: 180,
        soldSeats: 40,
        occupancyPct: 22,
      },
      {
        flightNo: 'BJ-100',
        originCode: 'THR',
        destCode: 'MHD',
        departureAt: '2026-08-03T10:00:00.000Z',
        capacity: 150,
        soldSeats: 30,
        occupancyPct: 20,
      },
      {
        flightNo: 'BJ-101',
        originCode: 'MHD',
        destCode: 'THR',
        departureAt: '2026-08-03T12:00:00.000Z',
        capacity: 150,
        soldSeats: 25,
        occupancyPct: 17,
      },
    ]);

    const { default: userEvent } = await import('@testing-library/user-event');
    renderShell();

    await waitFor(() => {
      expect(screen.getByTestId('notification-bell-count')).toHaveTextContent('۲');
    });
    await userEvent.click(screen.getByRole('button', { name: 'اعلان‌ها' }));
    expect(screen.getByText('BJ-100 THR ← MHD', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('BJ-101 MHD ← THR', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/EP-821/)).not.toBeInTheDocument();
  });

  it('SITE_ADMIN sidebar hides blog, kyc and settings even if the API still returns them', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'sa1', fullName: 'ادمین سایت', role: 'SITE_ADMIN', preferredLocale: 'FA' },
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(panelsApi, 'fetchNav').mockResolvedValue([
      { key: 'dashboard', labelFa: 'داشبورد', implemented: true },
      { key: 'tickets', labelFa: 'تیکت‌ها', implemented: true },
      { key: 'blog', labelFa: 'مدیریت بلاگ', implemented: true },
      { key: 'media', labelFa: 'مدیریت سایت', implemented: true },
      { key: 'jobapps', labelFa: 'درخواست‌های استخدام', implemented: true },
      { key: 'kyc', labelFa: 'احراز هویت مشتریان', implemented: true },
      { key: 'settings', labelFa: 'تنظیمات سامانه', implemented: true },
    ]);
    vi.spyOn(reportingApi, 'fetchLowSalesAlerts').mockResolvedValue([]);
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue({
      totalOpen: 0,
      tasks: [],
      counts: { ADMIN: 0, AGENCY: 0, MANAGER: 0 },
    });

    renderShell();

    expect(await screen.findByText('تیکت‌ها')).toBeInTheDocument();
    expect(screen.getByText('مدیریت سایت')).toBeInTheDocument();
    expect(screen.getByText('درخواست‌های استخدام')).toBeInTheDocument();
    expect(screen.queryByText('مدیریت بلاگ')).not.toBeInTheDocument();
    expect(screen.queryByText('احراز هویت مشتریان')).not.toBeInTheDocument();
    expect(screen.queryByText('تنظیمات سامانه')).not.toBeInTheDocument();
  });
});

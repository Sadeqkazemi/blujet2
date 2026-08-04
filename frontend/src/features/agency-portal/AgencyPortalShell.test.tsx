import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgencyPortalShell from './AgencyPortalShell';
import * as portalApi from '../../api/agency-portal';
import * as useAuthModule from '../../hooks/useAuth';
import * as useLocaleModule from '../../hooks/useLocale';
import * as useIsMobileModule from '../../hooks/useIsMobile';
import { mockAuthUser } from '../../test/mockAuthUser';

function renderShell(initial = '/agency') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/agency" element={<AgencyPortalShell />}>
          <Route index element={<div data-testid="agency-outlet">Dashboard</div>} />
          <Route path="credit" element={<div data-testid="agency-outlet">Credit</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AgencyPortalShell', () => {
  it('renders desktop sidebar with agency profile and navigation', async () => {
    vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(false);
    vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale: 'fa', setLocale: vi.fn() });
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: mockAuthUser({ fullName: 'آژانس پارس', role: 'AGENCY' }),
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
      refreshMe: vi.fn(),
    });
    vi.spyOn(portalApi, 'fetchProfile').mockResolvedValue({
      fullName: 'آژانس پارس',
      managerName: 'مدیر',
      licenseNo: '4471',
      phone: '09120000000',
      email: 'a@example.com',
      city: 'تهران',
      address: '—',
      tier: 'GOLD',
      isActive: true,
      suspendedAt: null,
      suspendReason: null,
      joinedAt: '2023-01-01T00:00:00.000Z',
    });

    renderShell();

    expect(await screen.findByTestId('agency-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('agency-shell-name')).toHaveTextContent('آژانس پارس');
    expect(screen.getByText('● فعال · کد 4471')).toBeInTheDocument();
    expect(screen.getByTestId('agency-outlet')).toBeInTheDocument();
  });

  it('opens and closes the mobile navigation drawer', async () => {
    vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(true);
    vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale: 'fa', setLocale: vi.fn() });
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: mockAuthUser({ role: 'AGENCY' }),
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
      refreshMe: vi.fn(),
    });
    vi.spyOn(portalApi, 'fetchProfile').mockRejectedValue(new Error('offline'));

    renderShell();

    expect(screen.queryByTestId('agency-sidebar')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('agency-mobile-menu-open'));
    expect(screen.getByTestId('agency-mobile-menu')).toBeInTheDocument();
    expect(screen.getByText('اعتبار و مانده')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('agency-mobile-menu-close'));
    expect(screen.queryByTestId('agency-mobile-menu')).not.toBeInTheDocument();
  });
});

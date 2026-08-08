import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgencyPortalShell from './AgencyPortalShell';
import * as useAuthModule from '../../hooks/useAuth';
import * as useLocaleModule from '../../hooks/useLocale';
import * as useIsMobileModule from '../../hooks/useIsMobile';
import * as agencyApi from '../../api/agency-portal';

afterEach(() => vi.restoreAllMocks());

describe('AgencyPortalShell logout', () => {
  it('keeps the agency session until logout is explicitly confirmed', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'a1', fullName: 'آژانس تست', role: 'AGENCY', preferredLocale: 'FA' },
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut,
    });
    vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale: 'fa', setLocale: vi.fn() });
    vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(false);
    vi.spyOn(agencyApi, 'fetchProfile').mockResolvedValue({
      fullName: 'آژانس تست',
      licenseNo: 'AG-100',
      managerName: null,
      email: null,
      city: null,
      address: null,
      tier: null,
      isTemporaryReadOnly: false,
    });
    vi.spyOn(agencyApi, 'fetchInbox').mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/agency']}>
        <Routes>
          <Route path="/agency" element={<AgencyPortalShell />}>
            <Route index element={<div>خانه آژانس</div>} />
          </Route>
          <Route path="/agency/login" element={<div>ورود آژانس</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByTestId('agency-logout'));
    expect(signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('agency-logout-confirm')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('agency-logout-confirm-confirm'));
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(await screen.findByText('ورود آژانس')).toBeInTheDocument();
  });
});

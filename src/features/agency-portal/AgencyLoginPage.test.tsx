import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AgencyLoginPage from './AgencyLoginPage';
import * as useAuthModule from '../../hooks/useAuth';

function mockAuth(agencyLogin = vi.fn()) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'unauthenticated',
    user: null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin,
    signOut: vi.fn(),
  });
}

describe('AgencyLoginPage', () => {
  it('requires phone and password before submitting', async () => {
    const agencyLogin = vi.fn();
    mockAuth(agencyLogin);
    render(
      <MemoryRouter>
        <AgencyLoginPage />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'ورود به پنل آژانس' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('شماره تماس و رمز عبور را وارد کنید.');
    expect(agencyLogin).not.toHaveBeenCalled();
  });

  it('calls agencyLogin with phone+password, no 2FA step', async () => {
    const agencyLogin = vi.fn().mockResolvedValue({ id: 'a1', fullName: 'آژانس تست', role: 'AGENCY' });
    mockAuth(agencyLogin);
    render(
      <MemoryRouter>
        <AgencyLoginPage />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('شماره تماس آژانس'), '+989120000002');
    await user.type(screen.getByLabelText('رمز عبور'), 'Blujet@1404');
    await user.click(screen.getByRole('button', { name: 'ورود به پنل آژانس' }));

    expect(agencyLogin).toHaveBeenCalledWith('+989120000002', 'Blujet@1404');
  });
});

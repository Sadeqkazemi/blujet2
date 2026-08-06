import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage';
import { ApiRequestError } from '../../api/envelope';
import * as useAuthModule from '../../hooks/useAuth';

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

function renderLoginJourney() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/panel" element={<div>temporary panel reached</div>} />
        <Route path="/required-password-change" element={<div>password change reached</div>} />
        <Route path="/two-factor" element={<div>two factor reached</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function continueWithUsername(username: string) {
  await userEvent.type(screen.getByLabelText('نام کاربری'), username);
  await userEvent.click(screen.getByRole('button', { name: 'ادامه' }));
}

const baseAuth = {
  status: 'unauthenticated' as const,
  user: null,
  requestLogin: vi.fn(),
  confirmTwoFactor: vi.fn(),
  agencyLogin: vi.fn(),
  signOut: vi.fn(),
  refreshMe: vi.fn(),
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
  passwordLogin: vi.fn(),
  requestPasswordResetEmail: vi.fn(),
  verifyPasswordResetEmail: vi.fn(),
};

describe('LoginPage', () => {
  it('enters the panel directly only for a temporary password-only response', async () => {
    const requestLogin = vi.fn().mockResolvedValue({
      loginMode: 'TEMPORARY_PASSWORD_ONLY' as const,
      accessToken: 'temporary-access-token',
      temporaryAccessExpiresAt: '2026-08-12T00:00:00.000Z',
      user: {
        id: 'uat-it',
        fullName: 'UAT IT Manager',
        role: 'IT_MANAGER' as const,
        preferredLocale: 'FA' as const,
        mustChangePassword: false,
      },
    });
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      ...baseAuth,
      requestLogin,
    });
    renderLoginJourney();

    await continueWithUsername('uat.it');
    await userEvent.type(screen.getByLabelText('رمز عبور'), 'Strong!Password7');
    await userEvent.click(screen.getByRole('button', { name: 'ورود و ادامه' }));

    expect(await screen.findByText('temporary panel reached')).toBeInTheDocument();
  });

  it('keeps ordinary staff on the 2FA journey', async () => {
    const requestLogin = vi.fn().mockResolvedValue({
      loginMode: 'TWO_FACTOR' as const,
      challengeId: 'challenge-1',
    });
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      ...baseAuth,
      requestLogin,
    });
    renderLoginJourney();

    await continueWithUsername('finance');
    await userEvent.type(screen.getByLabelText('رمز عبور'), 'Strong!Password7');
    await userEvent.click(screen.getByRole('button', { name: 'ورود و ادامه' }));

    expect(await screen.findByText('two factor reached')).toBeInTheDocument();
  });

  it('sends a first-login super admin directly to required password change without OTP', async () => {
    const requestLogin = vi.fn().mockResolvedValue({
      loginMode: 'PASSWORD_ONLY' as const,
      accessToken: 'owner-access-token',
      user: {
        id: 'owner-1',
        fullName: 'مالک سامانه',
        role: 'SITE_ADMIN' as const,
        preferredLocale: 'FA' as const,
        mustChangePassword: true,
        isSuperAdmin: true,
      },
    });
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      ...baseAuth,
      requestLogin,
    });
    renderLoginJourney();

    await continueWithUsername('superadmin');
    await userEvent.type(screen.getByLabelText('رمز عبور'), 'OneTime!Password7');
    await userEvent.click(screen.getByRole('button', { name: 'ورود و ادامه' }));

    expect(await screen.findByText('password change reached')).toBeInTheDocument();
    expect(screen.queryByText('two factor reached')).not.toBeInTheDocument();
  });

  it('renders RTL with Persian labels', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(baseAuth);
    renderLoginPage();

    expect(screen.getByText('به سامانهٔ مدیریت داخلی blujet خوش آمدید')).toBeInTheDocument();
    expect(screen.getByLabelText('نام کاربری')).toBeInTheDocument();
    expect(screen.queryByLabelText('رمز عبور')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ادامه' })).toBeInTheDocument();
  });

  it('does not call the authentication API until the password step is submitted', async () => {
    const requestLogin = vi.fn();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({ ...baseAuth, requestLogin });
    renderLoginPage();

    await continueWithUsername('finance');

    expect(requestLogin).not.toHaveBeenCalled();
    expect(screen.getByText('رمز عبور خود را وارد کنید')).toBeInTheDocument();
    expect(screen.getByText('finance')).toBeInTheDocument();
  });

  it('lets staff edit the username before submitting credentials', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(baseAuth);
    renderLoginPage();

    await continueWithUsername('finance');
    await userEvent.click(screen.getByRole('button', { name: 'ویرایش نام کاربری' }));

    expect(screen.getByLabelText('نام کاربری')).toHaveValue('finance');
    expect(screen.queryByLabelText('رمز عبور')).not.toBeInTheDocument();
  });

  it('shows an inline Persian validation error when submitted empty', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(baseAuth);
    renderLoginPage();

    await userEvent.click(screen.getByRole('button', { name: 'ادامه' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('نام کاربری را وارد کنید.');
  });

  it('shows the server error message when login fails', async () => {
    const requestLogin = vi.fn().mockRejectedValue(new ApiRequestError('UNAUTHORIZED', 'نام کاربری یا رمز عبور نادرست است.', 401));
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({ ...baseAuth, requestLogin });
    renderLoginPage();

    await continueWithUsername('finance');
    await userEvent.type(screen.getByLabelText('رمز عبور'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'ورود و ادامه' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('نام کاربری یا رمز عبور نادرست است.');
  });

  it('"فراموشی رمز عبور؟" shows the contact-IT toast, matching the design', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(baseAuth);
    renderLoginPage();

    await continueWithUsername('finance');
    await userEvent.click(screen.getByTestId('staff-forgot-password'));
    expect(await screen.findByTestId('staff-forgot-toast')).toHaveTextContent(
      'برای بازیابی رمز عبور، با واحد فناوری اطلاعات (مدیر IT) تماس بگیرید',
    );
  });
});

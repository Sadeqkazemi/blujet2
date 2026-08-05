import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoadingProvider, ToastProvider } from '../../components/feedback';
import LoginPage from './LoginPage';
import { ApiRequestError } from '../../api/envelope';
import * as useAuthModule from '../../hooks/useAuth';

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <LoadingProvider>
          <LoginPage />
        </LoadingProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
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
  it('renders RTL with Persian labels', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(baseAuth);
    renderLoginPage();

    expect(screen.getByText('به سامانهٔ مدیریت داخلی blujet خوش آمدید')).toBeInTheDocument();
    expect(screen.getByLabelText('نام کاربری')).toBeInTheDocument();
    expect(screen.getByLabelText('رمز عبور')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ورود به سامانه' })).toBeInTheDocument();
    expect(screen.getByTestId('staff-passenger-link')).toHaveAttribute('href', '/signin');
    expect(screen.getByTestId('staff-agency-link')).toHaveAttribute('href', '/agency/login');
  });

  it('shows an inline Persian validation error when submitted empty', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(baseAuth);
    renderLoginPage();

    await userEvent.click(screen.getByRole('button', { name: 'ورود به سامانه' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('نام کاربری و رمز عبور را وارد کنید.');
  });

  it('shows the server error message when login fails', async () => {
    const requestLogin = vi.fn().mockRejectedValue(new ApiRequestError('UNAUTHORIZED', 'نام کاربری یا رمز عبور نادرست است.', 401));
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({ ...baseAuth, requestLogin });
    renderLoginPage();

    await userEvent.type(screen.getByLabelText('نام کاربری'), 'finance');
    await userEvent.type(screen.getByLabelText('رمز عبور'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'ورود به سامانه' }));

    expect(await screen.findByTestId('toast-error')).toHaveTextContent('نام کاربری یا رمز عبور نادرست است.');
    expect(screen.getByText('نام کاربری یا رمز عبور نادرست است.', { selector: 'p[role="alert"]' })).toBeInTheDocument();
  });

  it('"فراموشی رمز عبور؟" shows the contact-IT toast, matching the design', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(baseAuth);
    renderLoginPage();

    await userEvent.click(screen.getByTestId('staff-forgot-password'));
    expect(await screen.findByTestId('toast-info')).toHaveTextContent(
      'برای بازیابی رمز عبور، با واحد فناوری اطلاعات (مدیر IT) تماس بگیرید',
    );
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage';
import { ApiRequestError } from '../../api/envelope';
import * as useAuthModule from '../../hooks/useAuth';

function mockHealthFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/health')) {
        return Promise.resolve({ ok: true } as Response);
      }
      return Promise.reject(new Error(`unmocked fetch: ${url}`));
    }),
  );
}

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
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
  beforeEach(() => {
    mockHealthFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders RTL with Persian labels', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(baseAuth);
    renderLoginPage();

    expect(screen.getByText('به سامانهٔ مدیریت داخلی blujet خوش آمدید')).toBeInTheDocument();
    expect(screen.getByLabelText('نام کاربری')).toBeInTheDocument();
    expect(screen.getByLabelText('رمز عبور')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ورود به سامانه' })).toBeInTheDocument();
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

    expect(await screen.findByRole('alert')).toHaveTextContent('نام کاربری یا رمز عبور نادرست است.');
  });

  it('"فراموشی رمز عبور؟" shows the contact-IT toast, matching the design', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(baseAuth);
    renderLoginPage();

    await userEvent.click(screen.getByTestId('staff-forgot-password'));
    expect(await screen.findByTestId('staff-forgot-toast')).toHaveTextContent(
      'برای بازیابی رمز عبور، با واحد فناوری اطلاعات (مدیر IT) تماس بگیرید',
    );
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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

describe('LoginPage', () => {
  it('renders RTL with Persian labels', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'unauthenticated',
      user: null,
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    renderLoginPage();

    expect(screen.getByText('به سامانهٔ مدیریت داخلی blujet خوش آمدید')).toBeInTheDocument();
    expect(screen.getByLabelText('نام کاربری')).toBeInTheDocument();
    expect(screen.getByLabelText('رمز عبور')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ورود به پنل من' })).toBeInTheDocument();
  });

  it('shows an inline Persian validation error when submitted empty', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'unauthenticated',
      user: null,
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    renderLoginPage();

    await userEvent.click(screen.getByRole('button', { name: 'ورود به پنل من' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('نام کاربری و رمز عبور را وارد کنید.');
  });

  it('shows the server error message when login fails', async () => {
    const requestLogin = vi.fn().mockRejectedValue(new ApiRequestError('UNAUTHORIZED', 'نام کاربری یا رمز عبور نادرست است.', 401));
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'unauthenticated',
      user: null,
      requestLogin,
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    renderLoginPage();

    await userEvent.type(screen.getByLabelText('نام کاربری'), 'finance.karimi');
    await userEvent.type(screen.getByLabelText('رمز عبور'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'ورود به پنل من' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('نام کاربری یا رمز عبور نادرست است.');
  });

  it('"فراموشی رمز عبور؟" shows the contact-IT notice, matching the design — staff has no self-service reset', async () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'unauthenticated',
      user: null,
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    renderLoginPage();

    await userEvent.click(screen.getByTestId('staff-forgot-password'));
    expect(
      await screen.findByText('برای بازیابی رمز عبور، با واحد فناوری اطلاعات (مدیر IT) تماس بگیرید'),
    ).toBeInTheDocument();
  });
});

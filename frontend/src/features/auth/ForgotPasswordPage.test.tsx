import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ForgotPasswordPage from './ForgotPasswordPage';
import * as useAuthModule from '../../hooks/useAuth';
import * as authApi from '../../api/auth';
import { ApiRequestError } from '../../api/envelope';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockAuth(overrides: Partial<ReturnType<typeof useAuthModule.useAuth>> = {}) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'unauthenticated',
    user: null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
    requestOtp: vi.fn().mockResolvedValue('challenge-1'),
    verifyOtp: vi.fn().mockResolvedValue({ id: 'u1', fullName: 'مشتری تست', role: 'USER' }),
    ...overrides,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

describe('ForgotPasswordPage', () => {
  it('walks phone → OTP → new password, calling the real endpoints, then signs out', async () => {
    const requestOtp = vi.fn().mockResolvedValue('challenge-1');
    const verifyOtp = vi.fn().mockResolvedValue({ id: 'u1', fullName: 'مشتری تست', role: 'USER' });
    const signOut = vi.fn().mockResolvedValue(undefined);
    mockAuth({ requestOtp, verifyOtp, signOut });
    const setPassword = vi.spyOn(authApi, 'setPassword').mockResolvedValue({ changed: true });

    renderPage();
    await userEvent.type(screen.getByTestId('fp-id'), '09121234567');
    await userEvent.click(screen.getByTestId('fp-send'));
    expect(requestOtp).toHaveBeenCalledWith('09121234567');

    await userEvent.type(await screen.findByTestId('fp-code'), '482913');
    await userEvent.click(screen.getByTestId('fp-verify'));
    expect(verifyOtp).toHaveBeenCalledWith('challenge-1', '482913');

    await userEvent.type(await screen.findByTestId('fp-pass1'), 'NewSecret1');
    await userEvent.type(screen.getByTestId('fp-pass2'), 'NewSecret1');
    await userEvent.click(screen.getByTestId('fp-save'));

    expect(setPassword).toHaveBeenCalledWith('NewSecret1');
    expect(await screen.findByTestId('fp-done')).toBeInTheDocument();
    expect(signOut).toHaveBeenCalled();
    expect(screen.getByText('ورود به حساب')).toHaveAttribute('href', '/signin');
  });

  it('rejects a too-short new password before calling the API', async () => {
    mockAuth();
    const setPassword = vi.spyOn(authApi, 'setPassword');
    renderPage();

    await userEvent.type(screen.getByTestId('fp-id'), '09121234567');
    await userEvent.click(screen.getByTestId('fp-send'));
    await userEvent.type(await screen.findByTestId('fp-code'), '482913');
    await userEvent.click(screen.getByTestId('fp-verify'));

    await userEvent.type(await screen.findByTestId('fp-pass1'), 'short1');
    await userEvent.type(screen.getByTestId('fp-pass2'), 'short1');
    await userEvent.click(screen.getByTestId('fp-save'));

    expect(screen.getByText('رمز عبور باید حداقل ۸ کاراکتر باشد.')).toBeInTheDocument();
    expect(setPassword).not.toHaveBeenCalled();
  });

  it('rejects mismatched password confirmation', async () => {
    mockAuth();
    renderPage();

    await userEvent.type(screen.getByTestId('fp-id'), '09121234567');
    await userEvent.click(screen.getByTestId('fp-send'));
    await userEvent.type(await screen.findByTestId('fp-code'), '482913');
    await userEvent.click(screen.getByTestId('fp-verify'));

    await userEvent.type(await screen.findByTestId('fp-pass1'), 'FirstPass1');
    await userEvent.type(screen.getByTestId('fp-pass2'), 'OtherPass2');
    await userEvent.click(screen.getByTestId('fp-save'));

    expect(screen.getByText('تکرار رمز با رمز جدید یکسان نیست.')).toBeInTheDocument();
  });

  it('shows the real error message on a wrong OTP code', async () => {
    const verifyOtp = vi.fn().mockRejectedValue(new ApiRequestError('TWO_FACTOR_INVALID', 'کد وارد شده نادرست است.', 401));
    mockAuth({ verifyOtp });
    renderPage();

    await userEvent.type(screen.getByTestId('fp-id'), '09121234567');
    await userEvent.click(screen.getByTestId('fp-send'));
    await userEvent.type(await screen.findByTestId('fp-code'), '000000');
    await userEvent.click(screen.getByTestId('fp-verify'));

    expect(await screen.findByText('کد وارد شده نادرست است.')).toBeInTheDocument();
  });
});

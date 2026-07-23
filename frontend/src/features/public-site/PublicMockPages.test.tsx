import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomerLoginPage from './CustomerLoginPage';
import AboutPage from './AboutPage';
import NotFoundPage from './NotFoundPage';
import * as useAuthModule from '../../hooks/useAuth';

const requestOtp = vi.fn().mockResolvedValue('challenge-1');
const verifyOtp = vi.fn().mockResolvedValue({ id: 'u1', fullName: 'نگار رضایی', role: 'USER' });
const passwordLogin = vi.fn().mockResolvedValue({ id: 'u1', fullName: 'نگار رضایی', role: 'USER' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'unauthenticated',
    user: null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    requestOtp,
    verifyOtp,
    passwordLogin,
    signOut: vi.fn(),
  });
});

function renderWithRouter(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('CustomerLoginPage', () => {
  it('walks through the two OTP steps with a resend countdown', async () => {
    renderWithRouter(<CustomerLoginPage />);
    expect(screen.getByTestId('signin-tab-login')).toBeInTheDocument();
    expect(screen.getByTestId('signin-acct-agency')).toBeInTheDocument();

    await userEvent.type(screen.getByTestId('signin-phone'), '09121234567');
    await userEvent.click(screen.getByTestId('signin-request'));
    expect(requestOtp).toHaveBeenCalledWith('09121234567');

    expect(await screen.findByTestId('signin-resend-timer')).toHaveTextContent('ارسال مجدد کد');
    await userEvent.type(screen.getByTestId('signin-code'), '123456');
    await userEvent.click(screen.getByTestId('signin-verify'));
    expect(verifyOtp).toHaveBeenCalledWith('challenge-1', '123456');
  });

  it('signup tab requires name and terms; agency signup submits the mock request', async () => {
    renderWithRouter(<CustomerLoginPage />);

    await userEvent.click(screen.getByTestId('signin-tab-signup'));
    expect(screen.getByTestId('signup-name')).toBeInTheDocument();
    expect(screen.getByTestId('signin-request')).toBeDisabled();

    await userEvent.click(screen.getByTestId('signin-acct-agency'));
    await userEvent.type(screen.getByTestId('agency-name'), 'آژانس سفر آبی');
    await userEvent.type(screen.getByTestId('agency-license'), '1234-5678');
    await userEvent.click(screen.getByTestId('agency-signup-btn'));
    expect(screen.getByTestId('agency-signup-done')).toBeInTheDocument();
  });

  it('toggles to real password login and links to forgot-password', async () => {
    renderWithRouter(<CustomerLoginPage />);

    await userEvent.click(screen.getByTestId('signin-use-password'));
    expect(screen.getByText('فراموشی رمز عبور؟')).toHaveAttribute('href', '/forgot-password');

    await userEvent.type(screen.getByTestId('signin-pw-phone'), '09121234567');
    await userEvent.type(screen.getByTestId('signin-pw-password'), 'MyPass1234');
    await userEvent.click(screen.getByTestId('signin-pw-submit'));

    expect(passwordLogin).toHaveBeenCalledWith('09121234567', 'MyPass1234');
  });
});

describe('AboutPage', () => {
  it('renders mission, vision, and values', () => {
    renderWithRouter(<AboutPage />);
    expect(screen.getByText('سفر را ساده، مطمئن و در دسترس می‌کنیم')).toBeInTheDocument();
    expect(screen.getByText('مأموریت ما')).toBeInTheDocument();
    expect(screen.getByText('چشم‌انداز')).toBeInTheDocument();
    expect(screen.getByText('شفافیت')).toBeInTheDocument();
    expect(screen.getByText('مسافر سالانه')).toBeInTheDocument();
  });
});

describe('NotFoundPage', () => {
  it('renders the designed 404 with home and search links', () => {
    renderWithRouter(<NotFoundPage />);
    expect(screen.getByText('صفحه‌ای که دنبالش بودید پیدا نشد')).toBeInTheDocument();
    expect(screen.getByText('بازگشت به صفحهٔ اصلی')).toHaveAttribute('href', '/');
    expect(screen.getByText('جستجوی پرواز')).toHaveAttribute('href', '/destinations');
  });
});

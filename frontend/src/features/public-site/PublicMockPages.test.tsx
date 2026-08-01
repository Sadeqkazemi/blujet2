import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CustomerLoginPage from './CustomerLoginPage';
import AboutPage from './AboutPage';
import NotFoundPage from './NotFoundPage';
import * as useAuthModule from '../../hooks/useAuth';
import * as useLocaleModule from '../../hooks/useLocale';

function mockLocale(locale: 'fa' | 'en' | 'ar') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

const requestOtp = vi.fn().mockResolvedValue('challenge-1');
const verifyOtp = vi.fn().mockResolvedValue({ id: 'u1', fullName: 'نگار رضایی', role: 'USER' });
const agencyLogin = vi.fn().mockResolvedValue({ id: 'a1', fullName: 'آژانس blujet', role: 'AGENCY' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'unauthenticated',
    user: null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin,
    requestOtp,
    verifyOtp,
    passwordLogin: vi.fn(),
    signOut: vi.fn(),
  });
});

afterEach(() => {
  vi.spyOn(useLocaleModule, 'useLocale').mockRestore();
});

function renderWithRouter(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

async function typeOtp(prefix: string, code: string) {
  for (let i = 0; i < code.length; i++) {
    await userEvent.type(screen.getByTestId(`${prefix}-${i}`), code[i]!);
  }
}

describe('CustomerLoginPage', () => {
  it('enables send button on login when phone is valid', async () => {
    renderWithRouter(<CustomerLoginPage />);
    const sendBtn = screen.getByTestId('signin-request');

    await userEvent.type(screen.getByTestId('signin-phone'), '09120000001');
    expect(sendBtn).not.toHaveAttribute('aria-disabled', 'true');
    expect(sendBtn).toHaveStyle({ background: '#1668c4' });

    await userEvent.click(sendBtn);
    expect(requestOtp).toHaveBeenCalledWith('09120000001');
    expect(await screen.findByTestId('signin-code-cell-0')).toBeInTheDocument();
  });

  it('walks through OTP login with resend countdown, site header, footer, and visual panel', async () => {
    renderWithRouter(<CustomerLoginPage />);
    expect(screen.getByTestId('public-lang-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('footer-app-store')).toBeInTheDocument();
    expect(screen.getByTestId('footer-trust-badges')).toBeInTheDocument();
    expect(screen.getByTestId('signin-tab-login')).toBeInTheDocument();
    expect(screen.getByTestId('signin-acct-agency')).toBeInTheDocument();
    expect(screen.getByTestId('signin-visual-panel')).toBeInTheDocument();
    expect(screen.getByTestId('signin-forgot-link')).toHaveAttribute('href', '/forgot-password');

    await userEvent.type(screen.getByTestId('signin-phone'), '09121234567');
    await userEvent.click(screen.getByTestId('signin-request'));
    expect(requestOtp).toHaveBeenCalledWith('09121234567');

    expect(await screen.findByTestId('signin-resend-timer')).toHaveTextContent('ارسال مجدد کد');
    await typeOtp('signin-code-cell', '123456');
    const verifyBtn = screen.getByTestId('signin-verify');
    expect(verifyBtn).not.toBeDisabled();
    await userEvent.click(verifyBtn);
    expect(verifyOtp).toHaveBeenCalledWith('challenge-1', '123456');
  });

  it('signup tab requires name and terms before sending OTP', async () => {
    renderWithRouter(<CustomerLoginPage />);

    await userEvent.click(screen.getByTestId('signin-tab-signup'));
    expect(screen.getByTestId('signup-name')).toBeInTheDocument();

    await userEvent.type(screen.getByTestId('signin-phone'), '09121234567');
    await userEvent.click(screen.getByTestId('signin-request'));
    expect(requestOtp).not.toHaveBeenCalled();
    expect(screen.getByText('نام و نام خانوادگی را کامل وارد کن.')).toBeInTheDocument();

    await userEvent.type(screen.getByTestId('signup-name'), 'نگار رضایی');
    await userEvent.click(screen.getByTestId('signin-request'));
    expect(requestOtp).not.toHaveBeenCalled();
    expect(screen.getByText('برای ادامه باید قوانین و مقررات را بپذیری.')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('signin-acct-agency'));
    await userEvent.type(screen.getByTestId('agency-name'), 'آژانس سفر آبی');
    await userEvent.type(screen.getByTestId('agency-license'), '1234-5678');
    await userEvent.click(screen.getByTestId('agency-signup-btn'));
    expect(screen.getByTestId('agency-signup-done')).toBeInTheDocument();
  });

  it('agency login uses phone and password', async () => {
    renderWithRouter(<CustomerLoginPage />);
    await userEvent.click(screen.getByTestId('signin-acct-agency'));

    await userEvent.type(screen.getByTestId('agency-phone'), '09120000002');
    await userEvent.type(screen.getByTestId('agency-pass'), 'MyPass1234');
    await userEvent.click(screen.getByTestId('agency-login-btn'));

    expect(agencyLogin).toHaveBeenCalledWith('09120000002', 'MyPass1234');
  });

  it('renders translated tabs, EN email section, and forgot-password link in English', async () => {
    mockLocale('en');
    renderWithRouter(<CustomerLoginPage />);
    expect(screen.getByTestId('signin-tab-login')).toHaveTextContent('Log in');
    expect(screen.getByTestId('signin-tab-signup')).toHaveTextContent('Sign up');
    expect(screen.getByTestId('signin-acct-agency')).toHaveTextContent('Partner Agency');
    expect(screen.getByTestId('signin-google')).toBeInTheDocument();
    expect(screen.getByTestId('signin-forgot-link')).toHaveAttribute('href', '/forgot-password');
  });

  it('renders translated tabs and labels in Arabic', () => {
    mockLocale('ar');
    renderWithRouter(<CustomerLoginPage />);
    expect(screen.getByTestId('signin-tab-login')).toHaveTextContent('تسجيل الدخول');
    expect(screen.getByTestId('signin-tab-signup')).toHaveTextContent('إنشاء حساب');
    expect(screen.getByTestId('signin-acct-agency')).toHaveTextContent('وكالة شريكة');
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

  it('renders translated mission, vision, and values in English', () => {
    mockLocale('en');
    renderWithRouter(<AboutPage />);
    expect(screen.getByText('Making air travel simple, reliable, and accessible')).toBeInTheDocument();
    expect(screen.getByText('Our Mission')).toBeInTheDocument();
    expect(screen.getByText('Our Vision')).toBeInTheDocument();
    expect(screen.getByText('Transparency')).toBeInTheDocument();
    expect(screen.getByText('Passengers per year')).toBeInTheDocument();
  });

  it('renders translated mission, vision, and values in Arabic', () => {
    mockLocale('ar');
    renderWithRouter(<AboutPage />);
    expect(screen.getByText('نجعل السفر الجوي بسيطًا وموثوقًا ومتاحًا')).toBeInTheDocument();
    expect(screen.getByText('مهمتنا')).toBeInTheDocument();
    expect(screen.getByText('الرؤية')).toBeInTheDocument();
    expect(screen.getByText('الشفافية')).toBeInTheDocument();
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

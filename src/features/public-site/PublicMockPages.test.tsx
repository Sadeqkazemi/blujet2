import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ManageBookingPage from './ManageBookingPage';
import CustomerLoginPage from './CustomerLoginPage';
import AboutPage from './AboutPage';
import ContactPage from './ContactPage';
import NotFoundPage from './NotFoundPage';
import * as useAuthModule from '../../hooks/useAuth';

const requestOtp = vi.fn().mockResolvedValue('challenge-1');
const verifyOtp = vi.fn().mockResolvedValue({ id: 'u1', fullName: 'نگار رضایی', role: 'USER' });

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
    signOut: vi.fn(),
  });
});

function renderWithRouter(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('ManageBookingPage (mock)', () => {
  it('validates the lookup form', async () => {
    renderWithRouter(<ManageBookingPage />);
    await userEvent.click(screen.getByTestId('mb-lookup'));
    expect(screen.getByText('کد رزرو و نام خانوادگی مسافر را وارد کنید.')).toBeInTheDocument();
  });

  it('shows the mock booking after lookup and echoes the entered PNR', async () => {
    renderWithRouter(<ManageBookingPage />);
    await userEvent.type(screen.getByTestId('mb-pnr'), 'bj4x2k');
    await userEvent.type(screen.getByTestId('mb-lastname'), 'رضایی');
    await userEvent.click(screen.getByTestId('mb-lookup'));

    expect(screen.getByTestId('mb-pnr-show')).toHaveTextContent('BJ4X2K');
    expect(screen.getByText('نگار رضایی')).toBeInTheDocument();
    expect(screen.getByText('آرش رضایی')).toBeInTheDocument();
    expect(screen.getByText('مسافران')).toBeInTheDocument();
  });

  it('runs the mock refund flow with a 30% penalty', async () => {
    renderWithRouter(<ManageBookingPage />);
    await userEvent.type(screen.getByTestId('mb-pnr'), 'BJ4X2K');
    await userEvent.type(screen.getByTestId('mb-lastname'), 'رضایی');
    await userEvent.click(screen.getByTestId('mb-lookup'));

    await userEvent.click(screen.getByTestId('mb-open-refund'));
    const confirm = screen.getByTestId('mb-refund-confirm');
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByTestId('mb-refund-pax-0'));
    // 1,600,000 toman fare → 480,000 penalty → 1,120,000 refundable
    expect(screen.getByTestId('mb-refundable')).toHaveTextContent('۱٬۱۲۰٬۰۰۰');
    await userEvent.click(confirm);

    expect(screen.getByText('درخواست استرداد ثبت شد')).toBeInTheDocument();
    expect(screen.getByText(/RF-BJ4X2K/)).toBeInTheDocument();
  });
});

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

describe('ContactPage', () => {
  it('submits the mock contact form', async () => {
    renderWithRouter(<ContactPage />);
    expect(screen.getByText('تلفن پشتیبانی ۲۴ ساعته')).toBeInTheDocument();

    const submit = screen.getByTestId('contact-submit');
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByTestId('contact-name'), 'نگار رضایی');
    await userEvent.type(screen.getByTestId('contact-msg'), 'سلام، سوال داشتم.');
    await userEvent.click(submit);

    expect(screen.getByTestId('contact-sent')).toBeInTheDocument();
    expect(screen.getByText('پیام شما ارسال شد')).toBeInTheDocument();
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

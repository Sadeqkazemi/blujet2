import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DestinationsPage from './DestinationsPage';
import PublicClubPage from './PublicClubPage';
import SupportPage from './SupportPage';
import TravelInfoPage from './TravelInfoPage';
import * as useAuthModule from '../../hooks/useAuth';
import * as supportTicketsApi from '../../api/support-tickets';

beforeEach(() => {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'unauthenticated',
    user: null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
});

function renderWithRouter(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe('DestinationsPage', () => {
  it('renders the mock destination catalog with Persian prices', () => {
    renderWithRouter(<DestinationsPage />);
    expect(screen.getByText('مقصد بعدی شما کجاست؟')).toBeInTheDocument();
    expect(screen.getByTestId('dest-card-KIH')).toBeInTheDocument();
    expect(screen.getByTestId('dest-card-IST')).toBeInTheDocument();
    expect(screen.getAllByText(/تومان/).length).toBeGreaterThan(0);
    expect(screen.getByText('مسیرهای پرتردد')).toBeInTheDocument();
  });

  it('filters by region tab', async () => {
    renderWithRouter(<DestinationsPage />);
    await userEvent.click(screen.getByText('پروازهای خارجی'));
    expect(screen.getByText('مقاصد بین‌المللی')).toBeInTheDocument();
    expect(screen.queryByTestId('dest-card-MHD')).not.toBeInTheDocument();
    expect(screen.getByTestId('dest-card-DXB')).toBeInTheDocument();
  });

  it('shows the empty state for an unmatched search', async () => {
    renderWithRouter(<DestinationsPage />);
    await userEvent.type(screen.getByPlaceholderText(/نام شهر یا کد فرودگاه/), 'XYZ123');
    expect(screen.getByText('مقصدی با این مشخصات پیدا نشد')).toBeInTheDocument();
  });

  it('links destination cards to the real results page', () => {
    renderWithRouter(<DestinationsPage />);
    const card = screen.getByTestId('dest-card-KIH');
    expect(card).toHaveAttribute('href', expect.stringContaining('/results?origin=THR&dest=KIH'));
  });
});

describe('PublicClubPage', () => {
  it('renders tiers, stats, and card issuance steps', () => {
    renderWithRouter(<PublicClubPage />);
    expect(screen.getByText('هر پرواز، یک قدم به مزایای بیشتر')).toBeInTheDocument();
    expect(screen.getAllByText('نقره‌ای').length).toBeGreaterThan(0);
    expect(screen.getAllByText('طلایی').length).toBeGreaterThan(0);
    expect(screen.getAllByText('پلاتین').length).toBeGreaterThan(0);
    expect(screen.getByText('با رسیدن به حد امتیاز، کارت بگیرید')).toBeInTheDocument();
    expect(screen.getByText('کش‌بک در هر خرید')).toBeInTheDocument();
  });

  it('points the join button at the customer sign-in page when logged out', () => {
    renderWithRouter(<PublicClubPage />);
    expect(screen.getByText('عضویت رایگان')).toHaveAttribute('href', '/signin');
  });
});

describe('SupportPage', () => {
  it('renders FAQ accordion and toggles answers', async () => {
    renderWithRouter(<SupportPage />);
    expect(screen.getByText('چطور می‌توانیم کمک کنیم؟')).toBeInTheDocument();
    expect(screen.getByText(/از بخش «مدیریت رزرو» با وارد کردن کد رزرو/)).toBeInTheDocument();

    await userEvent.click(screen.getByText('میزان بار مجاز هر بلیط چقدر است؟'));
    expect(screen.getByText(/در نرخ اکونومی ۲۰ کیلوگرم/)).toBeInTheDocument();
  });

  it('submits the real ticket form and shows the real tracking code', async () => {
    const submit = vi.spyOn(supportTicketsApi, 'submitSupportTicket').mockResolvedValue({
      id: 't1',
      trackingCode: 'TK1A2B3C4D',
    });
    renderWithRouter(<SupportPage />);
    const submitBtn = screen.getByTestId('ticket-submit');
    expect(submitBtn).toBeDisabled();

    await userEvent.type(screen.getByTestId('ticket-name'), 'نگار رضایی');
    await userEvent.type(screen.getByTestId('ticket-phone'), '09121234567');
    await userEvent.type(screen.getByTestId('ticket-msg'), 'مشکل در پرداخت دارم');
    await userEvent.click(submitBtn);

    expect(await screen.findByText('تیکت شما ثبت شد')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-tracking-code')).toHaveTextContent('TK1A2B3C4D');
    expect(submit).toHaveBeenCalledWith({
      requesterName: 'نگار رضایی',
      requesterPhone: '09121234567',
      subject: 'استرداد و تغییر بلیط',
      body: 'مشکل در پرداخت دارم',
    });
  });
});

describe('TravelInfoPage', () => {
  it('renders all six rule sections with a TOC', () => {
    renderWithRouter(<TravelInfoPage />);
    expect(screen.getAllByText('قوانین و مقررات').length).toBeGreaterThan(0);
    expect(screen.getAllByText('خرید و صدور بلیط').length).toBe(2);
    expect(screen.getAllByText('استرداد و کنسلی').length).toBe(2);
    expect(screen.getAllByText('حریم خصوصی و امنیت').length).toBe(2);
    expect(screen.getByText(/بار مجاز رایگان در نرخ اکونومی ۲۰/)).toBeInTheDocument();
  });
});

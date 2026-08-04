import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PublicHeader from './PublicHeader';
import * as useAuthModule from '../../hooks/useAuth';
import { mockAuthUser, mockAuthUserLocale } from '../../test/mockAuthUser';
import * as useLocaleModule from '../../hooks/useLocale';
import * as useIsMobileModule from '../../hooks/useIsMobile';
import * as publicSiteApi from '../../api/publicSite';

function mockLocale(locale: 'fa' | 'en' | 'ar' = 'fa') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

function renderHeader(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PublicHeader />
    </MemoryRouter>,
  );
}

describe('PublicHeader — logged-in user', () => {
  it('opens the notification dropdown with sample notifications', async () => {
    mockLocale();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: mockAuthUser({ id: 'u1', fullName: 'نگار رضایی', role: 'USER' }),
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({ isMember: true, level: 'GOLD', balance: 12450 });

    renderHeader();
    await userEvent.click(screen.getByTestId('public-notif-toggle'));
    expect(screen.getByText('اعلان‌ها')).toBeInTheDocument();
    expect(screen.getByText('یادآوری سفر')).toBeInTheDocument();
    expect(screen.getByText('جدید')).toBeInTheDocument();
  });

  it('shows the points balance and profile/trips links in the user menu', async () => {
    mockLocale();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: mockAuthUser({ id: 'u1', fullName: 'نگار رضایی', role: 'USER' }),
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({ isMember: true, level: 'GOLD', balance: 12450 });

    renderHeader();
    await userEvent.click(screen.getByTestId('public-user-menu-toggle'));
    expect(await screen.findByText('۱۲۴۵۰')).toBeInTheDocument();
    expect(screen.getByText('مشاهده پروفایل')).toHaveAttribute('href', '/account');
    expect(screen.getAllByText('سفرها و مدیریت رزرو')[0]).toHaveAttribute('href', '/manage-booking');
    expect(screen.getByText('استرداد')).toHaveAttribute('href', '/manage-booking');
  });

  it('shows English notifications and latin points when locale is en', async () => {
    mockLocale('en');
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: mockAuthUserLocale('EN', { id: 'u1', fullName: 'Negar Rezaei', role: 'USER' }),
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({ isMember: true, level: 'GOLD', balance: 12450 });

    renderHeader();
    expect(screen.getByText('Flights')).toBeInTheDocument();
    expect(screen.queryByText('Log in / Sign up')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('public-user-menu-toggle'));
    expect(await screen.findByText('12450')).toBeInTheDocument();
    expect(screen.queryByText('View Profile')).not.toBeInTheDocument();
  });

  it('highlights Flights nav on the results route', () => {
    mockLocale();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'unauthenticated',
      user: null,
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });

    renderHeader('/results?from=THR&to=MHD');
    const flightsLink = screen.getByRole('link', { name: 'پرواز' });
    expect(flightsLink).toHaveStyle({ color: '#1668c4' });
  });

  it('does not show travel info in the nav', () => {
    mockLocale();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'unauthenticated',
      user: null,
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });

    renderHeader();
    expect(screen.queryByText('اطلاعات سفر')).not.toBeInTheDocument();
  });

  it('highlights Flights nav on the results route', () => {
    mockLocale();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'unauthenticated',
      user: null,
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });

    renderHeader('/results?from=THR&to=MHD');
    const flightsLink = screen.getByRole('link', { name: 'پرواز' });
    expect(flightsLink).toHaveStyle({ color: '#1668c4' });
  });

  it('does not show travel info in the nav', () => {
    mockLocale();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'unauthenticated',
      user: null,
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });

    renderHeader();
    expect(screen.queryByText('اطلاعات سفر')).not.toBeInTheDocument();
  });

  it('switches locale via the language dropdown', async () => {
    const setLocale = vi.fn();
    vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale: 'fa', setLocale });
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'unauthenticated',
      user: null,
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });

    renderHeader();
    await userEvent.click(screen.getByTestId('public-lang-toggle'));
    await userEvent.click(screen.getByTestId('public-lang-option-en'));
    expect(setLocale).toHaveBeenCalledWith('en');
  });

  it('shows account panel links in the mobile hamburger menu when logged in', async () => {
    mockLocale();
    vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(true);
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: mockAuthUser({ id: 'u1', fullName: 'نگار رضایی', role: 'USER' }),
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({ isMember: true, level: 'GOLD', balance: 12450 });
    vi.spyOn(publicSiteApi, 'fetchMyProfile').mockResolvedValue({
      fullName: 'نگار رضایی',
      phone: '09121234567',
      email: null,
      emailVerified: false,
      nationalId: null,
      birthDate: null,
      passportNo: null,
      completionPct: 100,
    });

    renderHeader();
    await userEvent.click(screen.getByTestId('public-mobile-menu-toggle'));

    expect(screen.getByTestId('public-mobile-account-profile')).toHaveAttribute('href', '/account?tab=profile');
    expect(screen.getByTestId('public-mobile-account-account-info')).toHaveAttribute('href', '/account?tab=account-info');
    expect(screen.getByTestId('public-mobile-account-trips')).toHaveAttribute('href', '/account?tab=trips');
    expect(screen.getByText('مدیریت پروفایل')).toBeInTheDocument();
    expect(screen.getByText('اطلاعات حساب')).toBeInTheDocument();
    expect(screen.getAllByText('سفرها و مدیریت رزرو').length).toBeGreaterThan(0);
    expect(screen.getByTestId('public-mobile-account-security')).toHaveAttribute('href', '/account?tab=security');
  });
});

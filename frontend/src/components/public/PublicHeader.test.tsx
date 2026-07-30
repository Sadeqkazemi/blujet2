import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PublicHeader from './PublicHeader';
import * as useAuthModule from '../../hooks/useAuth';
import * as useLocaleModule from '../../hooks/useLocale';
import * as publicSiteApi from '../../api/publicSite';

function mockLocale(locale: 'fa' | 'en' | 'ar' = 'fa') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

function renderHeader() {
  return render(
    <MemoryRouter>
      <PublicHeader />
    </MemoryRouter>,
  );
}

describe('PublicHeader — logged-in user', () => {
  it('opens the notification dropdown with sample notifications', async () => {
    mockLocale();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', fullName: 'نگار رضایی', role: 'USER' },
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
  });

  it('shows the points balance and مشاهده پروفایل link in the user menu', async () => {
    mockLocale();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', fullName: 'نگار رضایی', role: 'USER' },
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
    expect(screen.getByText('استرداد')).toHaveAttribute('href', '/manage-booking');
  });

  it('shows English notifications and toman-formatted-as-latin points when locale is en', async () => {
    mockLocale('en');
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: 'u1', fullName: 'Negar Rezaei', role: 'USER' },
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
    expect(screen.getByText('View Profile')).toHaveAttribute('href', '/account');
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
});

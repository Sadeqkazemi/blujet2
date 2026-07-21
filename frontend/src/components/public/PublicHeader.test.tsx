import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PublicHeader from './PublicHeader';
import * as useAuthModule from '../../hooks/useAuth';
import * as publicSiteApi from '../../api/publicSite';

function renderHeader() {
  return render(
    <MemoryRouter>
      <PublicHeader />
    </MemoryRouter>,
  );
}

describe('PublicHeader — logged-in user', () => {
  it('opens the notification dropdown with sample notifications', async () => {
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
});

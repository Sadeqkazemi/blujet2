import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { StaffLoginLayout } from './StaffLoginLayout';
import * as useAuthModule from '../../hooks/useAuth';

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

describe('StaffLoginLayout', () => {
  it('uses the homepage PublicHeader and keeps the desktop visual column', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(baseAuth);

    render(
      <MemoryRouter>
        <StaffLoginLayout>
          <div>form</div>
        </StaffLoginLayout>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('staff-login-shell')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('پرواز')).toBeInTheDocument();
    expect(screen.getByText('مقاصد پروازی')).toBeInTheDocument();
    expect(screen.getByText('باشگاه مشتریان')).toBeInTheDocument();
    expect(screen.getByText('پشتیبانی')).toBeInTheDocument();
    expect(screen.getByTestId('staff-login-visual')).toHaveClass('lg:flex');
    expect(screen.queryByTestId('staff-login-mobile-brand')).not.toBeInTheDocument();
    expect(screen.getByText('به سامانهٔ مدیریت داخلی blujet خوش آمدید')).toBeInTheDocument();
    expect(screen.getByText('form')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { StaffLoginLayout } from './StaffLoginLayout';

describe('StaffLoginLayout', () => {
  it('renders a mobile brand bar and a desktop visual column', () => {
    render(
      <MemoryRouter>
        <StaffLoginLayout>
          <div>form</div>
        </StaffLoginLayout>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('staff-login-shell')).toHaveClass('lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]');
    expect(screen.getByTestId('staff-login-mobile-brand')).toHaveClass('lg:hidden');
    expect(screen.getByTestId('staff-login-visual')).toHaveClass('lg:flex');
    expect(screen.getByTestId('staff-login-mobile-logo')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('staff-login-home-logo')).toHaveAttribute('href', '/');
    expect(screen.getByText('به سامانهٔ مدیریت داخلی blujet خوش آمدید')).toBeInTheDocument();
    expect(screen.getByText('form')).toBeInTheDocument();
  });
});

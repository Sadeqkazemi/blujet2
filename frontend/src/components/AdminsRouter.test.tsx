import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminsRouter from './AdminsRouter';
import * as useAuthModule from '../hooks/useAuth';
import { mockAuthUserWithRole } from '../test/mockAuthUser';

vi.mock('../features/admins/AdminsPage', () => ({
  default: () => <div>LegacyAdminsPage</div>,
}));

vi.mock('../features/admins/BoardChairAdminsPage', () => ({
  default: () => <div>BoardChairAdminsPage</div>,
}));

describe('AdminsRouter', () => {
  it('routes BOARD_CHAIR to the empty design shell', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: mockAuthUserWithRole('BOARD_CHAIR'),
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
      refreshMe: vi.fn(),
    });
    render(<AdminsRouter />);
    expect(screen.getByText('BoardChairAdminsPage')).toBeInTheDocument();
  });

  it('routes other roles to the legacy admins page', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: mockAuthUserWithRole('CEO'),
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
      refreshMe: vi.fn(),
    });
    render(<AdminsRouter />);
    expect(screen.getByText('LegacyAdminsPage')).toBeInTheDocument();
  });
});

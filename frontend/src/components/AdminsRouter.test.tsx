import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminsRouter from './AdminsRouter';
import * as useAuthModule from '../hooks/useAuth';
import { mockAuthUserWithRole } from '../test/mockAuthUser';

vi.mock('../features/admins/AdminsPage', () => ({
  default: () => <div>LegacyAdminsPage</div>,
}));

vi.mock('../features/admins/PanelAdminsPage', () => ({
  default: () => <div>PanelAdminsPage</div>,
}));

describe('AdminsRouter', () => {
  it('routes BOARD_CHAIR to PanelAdminsPage', () => {
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
    expect(screen.getByText('PanelAdminsPage')).toBeInTheDocument();
  });

  it('routes CEO to PanelAdminsPage', () => {
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
    expect(screen.getByText('PanelAdminsPage')).toBeInTheDocument();
  });

  it('routes IT_MANAGER to legacy AdminsPage', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: mockAuthUserWithRole('IT_MANAGER'),
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

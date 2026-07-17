import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PanelsAccessPage from './PanelsAccessPage';
import * as panelsApi from '../../api/panels';
import * as useAuthModule from '../../hooks/useAuth';
import type { PanelAccessFlag } from '../../types/panels';
import type { Role } from '../../types/auth';

const FLAGS: PanelAccessFlag[] = [
  { panelKey: 'FINANCE', enabled: true, updatedAt: null },
  { panelKey: 'IT', enabled: false, updatedAt: '2026-07-15T09:00:00.000Z' },
];

function mockRole(role: Role) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'authenticated',
    user: { id: 'u1', fullName: 'کاربر تست', role },
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
}

describe('PanelsAccessPage', () => {
  it('lists the togglable panels and flips one via the real endpoint', async () => {
    mockRole('SENIOR_MANAGER');
    vi.spyOn(panelsApi, 'fetchAccessFlags').mockResolvedValue(FLAGS);
    const setSpy = vi
      .spyOn(panelsApi, 'setAccessFlag')
      .mockResolvedValue({ panelKey: 'FINANCE', enabled: false, updatedAt: '2026-07-17T00:00:00.000Z' });

    render(<PanelsAccessPage />);
    const financeToggle = await screen.findByRole('switch', { name: 'پنل مدیر مالی' });
    expect(financeToggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'پنل مدیر IT' })).toHaveAttribute('aria-checked', 'false');

    const user = userEvent.setup();
    await user.click(financeToggle);
    await waitFor(() => expect(setSpy).toHaveBeenCalledWith('FINANCE', false));
    expect(screen.getByRole('switch', { name: 'پنل مدیر مالی' })).toHaveAttribute('aria-checked', 'false');
  });

  it('IT_MANAGER gets the read-only view: informational copy + disabled switches', async () => {
    mockRole('IT_MANAGER');
    vi.spyOn(panelsApi, 'fetchAccessFlags').mockResolvedValue(FLAGS);

    render(<PanelsAccessPage />);
    expect(
      await screen.findByText(/تعیین سطح دسترسی ورود در اختیار مدیر عامل است/),
    ).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'پنل مدیر مالی' })).toBeDisabled();
  });
});

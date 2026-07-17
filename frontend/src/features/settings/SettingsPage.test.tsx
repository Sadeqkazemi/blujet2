import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SettingsPage from './SettingsPage';
import * as adminsApi from '../../api/admins';
import * as useAuthModule from '../../hooks/useAuth';
import type { Role } from '../../types/auth';
import type { SettingsResult } from '../../types/admins';

const DATA: SettingsResult = {
  settings: {
    companyName: 'هواپیمایی blujet',
    supportEmail: 'support@blujet.example',
    supportPhone: '021-48000',
    gatewayMellat: true,
    gatewaySaman: true,
    gatewayZarin: false,
    maintenance: false,
    registration: true,
    charterSale: true,
    apiPublic: false,
    sandbox: true,
    brandColor: '#1668c4',
  },
  refundRules: [
    { id: 'r1', minHoursBeforeDeparture: 72, penaltyPct: 30, labelFa: 'بیش از ۷۲ ساعت مانده به پرواز' },
  ],
};

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

describe('SettingsPage', () => {
  it('BOARD_CHAIR sees company/gateways/refund-rules sections and saving persists a toggle', async () => {
    mockRole('BOARD_CHAIR');
    vi.spyOn(adminsApi, 'fetchSettings').mockResolvedValue(DATA);
    const updateSpy = vi.spyOn(adminsApi, 'updateSettings').mockResolvedValue(DATA);

    render(<SettingsPage />);
    expect(await screen.findByText('اطلاعات شرکت')).toBeInTheDocument();
    expect(screen.getByText('قوانین استرداد')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('switch', { name: 'حالت تعمیر و نگهداری' }));
    await user.click(screen.getByRole('button', { name: 'ذخیره تنظیمات' }));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ maintenance: true })),
    );
  });

  it('IT_MANAGER only gets the global toggles (no company/refund sections)', async () => {
    mockRole('IT_MANAGER');
    vi.spyOn(adminsApi, 'fetchSettings').mockResolvedValue(DATA);

    render(<SettingsPage />);
    expect(await screen.findByText('تنظیمات کلی سامانه')).toBeInTheDocument();
    expect(screen.queryByText('اطلاعات شرکت')).not.toBeInTheDocument();
    expect(screen.queryByText('قوانین استرداد')).not.toBeInTheDocument();
  });
});

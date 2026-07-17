import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OwnSecurityPage from './OwnSecurityPage';
import * as adminsApi from '../../api/admins';
import type { AdminRow } from '../../types/admins';

const MANAGED: AdminRow[] = [
  {
    id: 'm1',
    fullName: 'مهندس علی صدر',
    username: 'itadmin',
    email: 'it@blujet.example',
    role: 'IT_MANAGER',
    roleLabelFa: 'مدیر IT',
    lastLoginAt: null,
    isActive: true,
    online: false,
    managedByCaller: true,
  },
];

describe('OwnSecurityPage', () => {
  it('validates the confirm field, then changes the own password via the real endpoint', async () => {
    vi.spyOn(adminsApi, 'fetchAdmins').mockResolvedValue(MANAGED);
    const changeSpy = vi.spyOn(adminsApi, 'changeOwnPassword').mockResolvedValue({ changed: true });

    render(<OwnSecurityPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('رمز عبور فعلی'), 'Blujet@1404');
    await user.type(screen.getByLabelText('رمز عبور جدید'), 'Next@123456');
    await user.type(screen.getByLabelText('تکرار رمز عبور جدید'), 'MISMATCH');
    await user.click(screen.getByRole('button', { name: 'ثبت رمز عبور جدید' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('تکرار رمز عبور جدید مطابقت ندارد.');
    expect(changeSpy).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('تکرار رمز عبور جدید'));
    await user.type(screen.getByLabelText('تکرار رمز عبور جدید'), 'Next@123456');
    await user.click(screen.getByRole('button', { name: 'ثبت رمز عبور جدید' }));
    await waitFor(() => expect(changeSpy).toHaveBeenCalledWith('Blujet@1404', 'Next@123456'));
    expect(await screen.findByText('رمز عبور با موفقیت تغییر کرد ✓')).toBeInTheDocument();
  });

  it('resets a managed manager password and shows the one-time temp password', async () => {
    vi.spyOn(adminsApi, 'fetchAdmins').mockResolvedValue(MANAGED);
    vi.spyOn(adminsApi, 'resetAdminPassword').mockResolvedValue({ tempPassword: 'Zx-9Q1-77' });

    render(<OwnSecurityPage />);
    expect(await screen.findByText('مهندس علی صدر')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'تغییر رمز' }));
    expect(await screen.findByText('Zx-9Q1-77')).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AdminsPage from './AdminsPage';
import * as adminsApi from '../../api/admins';
import type { AdminRow } from '../../types/admins';

const ROWS: AdminRow[] = [
  {
    id: 'a1',
    fullName: 'سحر کاظمی',
    username: 'finance.karimi',
    email: 'finance@blujet.example',
    role: 'FINANCE_MANAGER',
    roleLabelFa: 'مدیر مالی',
    lastLoginAt: '2026-07-17T10:00:00.000Z',
    isActive: true,
    online: true,
    managedByCaller: true,
  },
];

describe('AdminsPage', () => {
  it('renders the list with real online status and opens the detail with block + reset actions', async () => {
    vi.spyOn(adminsApi, 'fetchAdmins').mockResolvedValue(ROWS);
    const resetSpy = vi
      .spyOn(adminsApi, 'resetAdminPassword')
      .mockResolvedValue({ tempPassword: 'Tmp-1234-Xy' });

    render(<AdminsPage />);
    expect(await screen.findByText('سحر کاظمی')).toBeInTheDocument();
    expect(screen.getByText('آنلاین')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText('سحر کاظمی'));
    expect(await screen.findByText('امنیت و دسترسی ورود')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'مسدودسازی ورود به پنل' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'تولید رمز موقت' }));
    await waitFor(() => expect(resetSpy).toHaveBeenCalledWith('a1', {}));
    expect(await screen.findByText('Tmp-1234-Xy')).toBeInTheDocument();
  });

  it('validates the add-admin form (short password) before calling the API', async () => {
    vi.spyOn(adminsApi, 'fetchAdmins').mockResolvedValue(ROWS);
    const createSpy = vi.spyOn(adminsApi, 'createAdmin');

    render(<AdminsPage />);
    await screen.findByText('سحر کاظمی');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'افزودن مدیر / ادمین' }));
    await user.type(screen.getByLabelText('نام و نام خانوادگی'), 'مدیر تازه');
    await user.type(screen.getByLabelText('ایمیل سازمانی'), 'new@blujet.example');
    await user.type(screen.getByLabelText('نام کاربری'), 'new.admin');
    await user.type(screen.getByLabelText('رمز عبور اولیه (حداقل ۶ کاراکتر)'), '123');
    await user.click(screen.getByRole('button', { name: 'ایجاد حساب و ارسال رمز' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });
});

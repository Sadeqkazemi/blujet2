import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PanelAdminsPage from './PanelAdminsPage';
import * as adminsApi from '../../api/admins';
import type { AdminRow } from '../../types/admins';

const ROWS: AdminRow[] = [
  {
    id: 'a1',
    fullName: 'مدیر مالی نمونه',
    username: 'finance.sample',
    email: 'finance@blujet.example',
    role: 'FINANCE_MANAGER',
    roleLabelFa: 'مدیر مالی',
    lastLoginAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    isActive: true,
    online: true,
    managedByCaller: true,
  },
];

describe('PanelAdminsPage', () => {
  it('renders real admin list from API with dark panel layout', async () => {
    vi.spyOn(adminsApi, 'fetchAdmins').mockResolvedValue(ROWS);
    render(<PanelAdminsPage />);

    expect(await screen.findByText('مدیر مالی نمونه')).toBeInTheDocument();
    expect(screen.getByText('آنلاین')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'مدیران' })).toBeInTheDocument();
    expect(screen.queryByText('حسین صادقی')).not.toBeInTheDocument();
  });

  it('shows empty state when no admins exist', async () => {
    vi.spyOn(adminsApi, 'fetchAdmins').mockResolvedValue([]);
    render(<PanelAdminsPage />);
    expect(await screen.findByText('هنوز اطلاعاتی وارد نشده است.')).toBeInTheDocument();
  });

  it('opens detail view with block and password reset actions', async () => {
    vi.spyOn(adminsApi, 'fetchAdmins').mockResolvedValue(ROWS);
    vi.spyOn(adminsApi, 'resetAdminPassword').mockResolvedValue({ tempPassword: 'Tmp-1234-Xy' });
    render(<PanelAdminsPage />);

    await userEvent.click(await screen.findByText('مدیر مالی نمونه'));
    expect(await screen.findByText('امنیت و دسترسی ورود')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'مسدودسازی ورود به پنل' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'تولید رمز موقت' }));
    await waitFor(() => expect(adminsApi.resetAdminPassword).toHaveBeenCalled());
    expect(await screen.findByText('Tmp-1234-Xy')).toBeInTheDocument();
  });

  it('validates add-admin form before calling API', async () => {
    vi.spyOn(adminsApi, 'fetchAdmins').mockResolvedValue([]);
    const createSpy = vi.spyOn(adminsApi, 'createAdmin');
    render(<PanelAdminsPage />);
    await screen.findByText('هنوز اطلاعاتی وارد نشده است.');

    await userEvent.click(screen.getByRole('button', { name: 'افزودن مدیر / ادمین' }));
    await userEvent.type(screen.getByLabelText('نام و نام خانوادگی'), 'مدیر تازه');
    await userEvent.type(screen.getByLabelText('ایمیل سازمانی'), 'new@blujet.example');
    await userEvent.type(screen.getByLabelText('نام کاربری'), 'new.admin');
    await userEvent.type(screen.getByLabelText('رمز عبور اولیه (حداقل ۶ کاراکتر)'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'ایجاد حساب و ارسال رمز' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });
});

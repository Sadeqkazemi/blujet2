import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EmployeesPage from './EmployeesPage';
import * as itApi from '../../api/it-manager';
import type { EmployeeDetail, EmployeeListRow, PermissionCatalog } from '../../types/it-manager';

const EMPLOYEES: EmployeeListRow[] = [
  {
    id: 'e1',
    fullName: 'رضا کاظمی',
    username: 'reza.kazemi',
    dept: 'commercial',
    rank: 'کارشناس',
    isActive: true,
    lastLoginAt: '2026-07-17T08:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z',
  },
];

const DETAIL: EmployeeDetail = {
  ...EMPLOYEES[0],
  referralScope: 'MANAGERS_ONLY',
  mustChangePassword: false,
  permissions: [{ key: 'ag_list', labelFa: 'مشاهدهٔ فهرست آژانس‌ها', sectionLabelFa: 'مدیریت آژانس‌ها' }],
  available: [{ key: 'fl_view', labelFa: 'مشاهدهٔ پروازها' }],
};

const CATALOG: PermissionCatalog = {
  commercial: [
    { sectionKey: 'agencies', sectionLabelFa: 'مدیریت آژانس‌ها', perms: [{ key: 'ag_list', labelFa: 'مشاهدهٔ فهرست آژانس‌ها' }] },
  ],
};

describe('EmployeesPage', () => {
  it('renders the employee list and validates the create form (short password)', async () => {
    vi.spyOn(itApi, 'fetchEmployees').mockResolvedValue(EMPLOYEES);
    vi.spyOn(itApi, 'fetchPermissionCatalog').mockResolvedValue(CATALOG);
    const createSpy = vi.spyOn(itApi, 'createEmployee');

    render(<EmployeesPage />);
    expect(await screen.findByText('رضا کاظمی')).toBeInTheDocument();
    expect(screen.getByText('فعال')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'افزودن کاربر' }));
    await user.type(screen.getByLabelText('نام و نام خانوادگی'), 'کارمند جدید');
    await user.type(screen.getByLabelText('نام کاربری'), 'new.user');
    await user.type(screen.getByLabelText('رمز عبور اولیه'), '123');
    await user.click(screen.getByRole('button', { name: 'ایجاد حساب و اعلان به مدیر' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('رمز عبور باید حداقل ۶ کاراکتر باشد');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('detail modal shows granted + available permissions and grants a new one', async () => {
    vi.spyOn(itApi, 'fetchEmployees').mockResolvedValue(EMPLOYEES);
    vi.spyOn(itApi, 'fetchPermissionCatalog').mockResolvedValue(CATALOG);
    vi.spyOn(itApi, 'fetchEmployee').mockResolvedValue(DETAIL);
    const grantSpy = vi.spyOn(itApi, 'setEmployeePermission').mockResolvedValue({
      ...DETAIL,
      permissions: [...DETAIL.permissions, { key: 'fl_view', labelFa: 'مشاهدهٔ پروازها', sectionLabelFa: 'مدیریت پروازها' }],
      available: [],
    });

    render(<EmployeesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'رضا کاظمی' }));

    expect(await screen.findByText('مشاهدهٔ فهرست آژانس‌ها')).toBeInTheDocument();
    expect(screen.getByText('+ مشاهدهٔ پروازها')).toBeInTheDocument();

    await user.click(screen.getByText('+ مشاهدهٔ پروازها'));
    await waitFor(() => expect(grantSpy).toHaveBeenCalledWith('e1', 'fl_view', true));
  });
});

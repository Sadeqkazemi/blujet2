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
  it('shows a real empty state without a hardcoded manager permission matrix', async () => {
    vi.spyOn(itApi, 'fetchEmployees').mockResolvedValue([]);
    vi.spyOn(itApi, 'fetchPermissionCatalog').mockResolvedValue({});

    render(<EmployeesPage />);

    expect(await screen.findAllByText('کارمندی ثبت نشده است.')).not.toHaveLength(0);
    expect(screen.queryByText('تحت مدیریت IT')).not.toBeInTheDocument();
    expect(screen.queryByText('سطح دسترسی واحد IT')).not.toBeInTheDocument();
  });

  it('renders the employee list and validates the create form (short password)', async () => {
    vi.spyOn(itApi, 'fetchEmployees').mockResolvedValue(EMPLOYEES);
    vi.spyOn(itApi, 'fetchPermissionCatalog').mockResolvedValue(CATALOG);
    const createSpy = vi.spyOn(itApi, 'createEmployee');

    render(<EmployeesPage />);
    expect(await screen.findByRole('button', { name: 'رضا کاظمی' })).toBeInTheDocument();
    expect(screen.getAllByText('فعال').length).toBeGreaterThan(0);

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

  it('shows suspend confirmation before deactivating an employee', async () => {
    vi.spyOn(itApi, 'fetchEmployees').mockResolvedValue(EMPLOYEES);
    vi.spyOn(itApi, 'fetchPermissionCatalog').mockResolvedValue(CATALOG);
    const statusSpy = vi.spyOn(itApi, 'setEmployeeStatus').mockResolvedValue({ id: 'e1', isActive: false });

    render(<EmployeesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'تعلیق' }));
    expect(screen.getByText(/آیا حساب «رضا کاظمی» معلق شود/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'تعلیق حساب' }));
    await waitFor(() => expect(statusSpy).toHaveBeenCalledWith('e1', false));
  });

  it('creates a custom organizational unit in the add-user form', async () => {
    vi.spyOn(itApi, 'fetchEmployees').mockResolvedValue([]);
    vi.spyOn(itApi, 'fetchPermissionCatalog').mockResolvedValue(CATALOG);

    render(<EmployeesPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'افزودن کاربر' }));
    await user.click(screen.getByRole('button', { name: '+ ایجاد واحد سازمانی جدید' }));
    await user.type(screen.getByPlaceholderText('نام واحد جدید (مثلاً بازاریابی)'), 'بازاریابی');
    await user.click(screen.getByRole('button', { name: 'افزودن' }));
    expect(screen.getByRole('button', { name: 'بازاریابی' })).toBeInTheDocument();
  });

  it('shows the reference add-user form inline and then shows the assigned credentials', async () => {
    vi.spyOn(itApi, 'fetchEmployees').mockResolvedValue([]);
    vi.spyOn(itApi, 'fetchPermissionCatalog').mockResolvedValue(CATALOG);
    vi.spyOn(itApi, 'createEmployee').mockResolvedValue({
      ...DETAIL,
      id: 'created-1',
      fullName: 'کارمند تازه',
      username: 'fresh.user',
    });

    render(<EmployeesPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'افزودن کاربر' }));
    expect(screen.getByTestId('inline-create-employee')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'ایجاد کارمند جدید' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('نام و نام خانوادگی'), 'کارمند تازه');
    await user.type(screen.getByLabelText('نام کاربری'), 'fresh.user');
    await user.type(screen.getByLabelText('رمز عبور اولیه'), 'Assigned@1405');
    await user.click(screen.getByRole('button', { name: 'ایجاد حساب و اعلان به مدیر' }));

    expect(await screen.findByRole('dialog', { name: 'اطلاعات ورود کارمند' })).toBeInTheDocument();
    expect(screen.getByText('fresh.user')).toBeInTheDocument();
    expect(screen.getByText('Assigned@1405')).toBeInTheDocument();
  });
});

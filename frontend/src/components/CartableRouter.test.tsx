import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CartableRouter from './CartableRouter';
import * as useAuthModule from '../hooks/useAuth';
import { mockAuthUserWithRole } from '../test/mockAuthUser';

vi.mock('../features/cartable/CartablePage', () => ({ default: () => <div>کارتابل مدیر</div> }));
vi.mock('../features/cartable/EmployeeCartablePage', () => ({ default: () => <div>کارتابل کارمند</div> }));
vi.mock('../features/operations/OperationsCartablePage', () => ({ default: () => <div>کارتابل عملیات</div> }));
vi.mock('../features/support-tickets/SupportTicketsPage', () => ({
  default: ({ assignedMode }: { assignedMode?: boolean }) => (
    <div>{assignedMode ? 'تیکت‌های ارجاع‌شده من' : 'مرکز تیکت مدیریت'}</div>
  ),
}));

function mockRole(role: 'CEO' | 'EMPLOYEE' | 'SITE_ADMIN') {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'authenticated',
    user: mockAuthUserWithRole(role),
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
}

describe('CartableRouter internal workspace', () => {
  it('shows assigned support conversations inside a manager cartable without a second tab', () => {
    mockRole('CEO');
    render(<CartableRouter />);

    expect(screen.getByText('کارتابل مدیر')).toBeInTheDocument();
    expect(screen.getByText('تیکت‌های ارجاع‌شده من')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'تیکت‌های پشتیبانی' })).not.toBeInTheDocument();
  });

  it('shows assigned support conversations inside an employee cartable', () => {
    mockRole('EMPLOYEE');
    render(<CartableRouter />);

    expect(screen.getByText('کارتابل کارمند')).toBeInTheDocument();
    expect(screen.getByText('تیکت‌های ارجاع‌شده من')).toBeInTheDocument();
  });

  it('keeps the site-admin support queue on its dedicated site-admin route', () => {
    mockRole('SITE_ADMIN');
    render(<CartableRouter />);

    expect(screen.getByText('کارتابل مدیر')).toBeInTheDocument();
    expect(screen.queryByText('تیکت‌های ارجاع‌شده من')).not.toBeInTheDocument();
  });
});

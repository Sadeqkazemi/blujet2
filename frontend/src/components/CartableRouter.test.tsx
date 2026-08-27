import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CartableRouter from './CartableRouter';
import * as useAuthModule from '../hooks/useAuth';
import { mockAuthUserWithRole } from '../test/mockAuthUser';

vi.mock('../features/cartable/CartablePage', () => ({ default: () => <div>کارتابل مدیر</div> }));
vi.mock('../features/cartable/EmployeeCartablePage', () => ({ default: () => <div>کارتابل کارمند</div> }));
vi.mock('../features/operations/OperationsCartablePage', () => ({ default: () => <div>کارتابل عملیات</div> }));
vi.mock('../features/support-tickets/SupportTicketsPage', () => ({ default: () => <div>مرکز تیکت مدیریت</div> }));

function mockRole(role: 'CEO' | 'EMPLOYEE') {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'authenticated',
    user: mockAuthUserWithRole(role),
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
}

describe('CartableRouter ticket workspace', () => {
  it('lets management roles open support tickets from their cartable', async () => {
    mockRole('CEO');
    render(<CartableRouter />);

    expect(screen.getByText('کارتابل مدیر')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'تیکت‌های پشتیبانی' }));
    expect(screen.getByText('مرکز تیکت مدیریت')).toBeInTheDocument();
  });

  it('lets employees open assigned support tickets from their cartable', async () => {
    mockRole('EMPLOYEE');
    render(<CartableRouter />);

    expect(screen.getByText('کارتابل کارمند')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'تیکت‌های پشتیبانی' }));
    expect(screen.getByText('مرکز تیکت مدیریت')).toBeInTheDocument();
  });
});

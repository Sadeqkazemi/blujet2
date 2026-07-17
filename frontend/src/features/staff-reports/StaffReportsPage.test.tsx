import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StaffReportsPage from './StaffReportsPage';
import * as reportingApi from '../../api/reporting';
import type { StaffReportsResult } from '../../types/reporting';

const DATA: StaffReportsResult = {
  staff: [
    { id: 's1', fullName: 'مریم حسینی', rank: 'کارشناس مالی', isActive: true, createdAt: '2026-07-01T00:00:00.000Z' },
  ],
  reports: [
    {
      id: 'r1',
      action: 'ثبت تسویه آژانس',
      category: 'FINANCE',
      detail: 'تسویه دوره‌ای آژانس blujet توسط کارشناس مالی ثبت شد.',
      staffId: 's1',
      staffName: 'مریم حسینی',
      at: '2026-07-15T09:00:00.000Z',
    },
  ],
  newEmployeeEvents: [
    { id: 'e1', detail: 'حساب «مریم حسینی» توسط مدیر IT ایجاد شد.', at: '2026-07-01T08:00:00.000Z' },
  ],
};

describe('StaffReportsPage', () => {
  it('renders the staff tabs, real audit feed, and the new-employee banner; filters by employee', async () => {
    const fetchSpy = vi.spyOn(reportingApi, 'fetchStaffReports').mockResolvedValue(DATA);

    render(<StaffReportsPage />);
    expect(await screen.findByText('ثبت تسویه آژانس')).toBeInTheDocument();
    expect(screen.getByText('کارمند جدید توسط مدیر IT اضافه شد')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'مریم حسینی' }));
    await waitFor(() => expect(fetchSpy).toHaveBeenLastCalledWith('s1'));

    await user.click(screen.getByRole('button', { name: 'علامت‌گذاری به‌عنوان خوانده‌شده' }));
    expect(screen.queryByText('کارمند جدید توسط مدیر IT اضافه شد')).not.toBeInTheDocument();
  });
});

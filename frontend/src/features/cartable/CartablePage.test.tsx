import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import CartablePage from './CartablePage';
import * as cartableApi from '../../api/cartable';
import * as useAuthModule from '../../hooks/useAuth';
import type { CartableListResult } from '../../types/cartable';
import type { Role } from '../../types/auth';

const LIST: CartableListResult = {
  tasks: [
    {
      id: 't1',
      category: 'MANAGER',
      title: 'درخواست گزارش فروش سه‌ماهه',
      description: 'گزارش تفکیکی ارسال شود.',
      senderLabelFa: 'محمد رحیمی · مدیر ارشد',
      sender: null,
      sourceType: 'MANAGER_REFERRAL',
      sourceId: 'r1',
      status: 'OPEN',
      resolutionNote: null,
      createdAt: '2026-07-16T10:00:00.000Z',
    },
  ],
  counts: { ADMIN: 2, AGENCY: 1, MANAGER: 1 },
  totalOpen: 4,
};

function mockRole(role: Role) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'authenticated',
    user: { id: 'u1', fullName: 'کاربر تست', role },
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    signOut: vi.fn(),
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CartablePage />
    </MemoryRouter>,
  );
}

describe('CartablePage', () => {
  it('renders KPI filter cards, count pill, task rows and the compose button', async () => {
    mockRole('CEO');
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue(LIST);
    vi.spyOn(cartableApi, 'fetchStaffDirectory').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('درخواست اداری')).toBeInTheDocument();
    expect(screen.getByText('همکاری آژانس')).toBeInTheDocument();
    expect(screen.getByText('درخواست مدیران')).toBeInTheDocument();
    expect(screen.getByText('۴ مورد')).toBeInTheDocument();
    expect(screen.getByText('درخواست گزارش فروش سه‌ماهه')).toBeInTheDocument();
    expect(screen.getByText('ارسال از: محمد رحیمی · مدیر ارشد')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ایجاد پیام' })).toBeInTheDocument();
    // CEO never sees the chairman gate.
    expect(screen.queryByText('ارجاع و ارسال گزارش به رئیس هیئت مدیره')).not.toBeInTheDocument();
  });

  it('Finance Manager sees the chairman-permission gate with the request button', async () => {
    mockRole('FINANCE_MANAGER');
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue(LIST);
    vi.spyOn(cartableApi, 'fetchChairPermission').mockResolvedValue(null);
    vi.spyOn(cartableApi, 'fetchStaffDirectory').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('ارجاع و ارسال گزارش به رئیس هیئت مدیره')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'درخواست مجوز از رئیس هیئت مدیره' })).toBeInTheDocument();
  });

  it('the review modal requires a manager note before deciding', async () => {
    mockRole('CEO');
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue(LIST);
    vi.spyOn(cartableApi, 'fetchStaffDirectory').mockResolvedValue([]);
    const approve = vi.spyOn(cartableApi, 'approveCartableTask').mockResolvedValue(LIST.tasks[0]);

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'بررسی' }));

    await userEvent.click(screen.getByRole('button', { name: 'تأیید' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('برای ثبت تصمیم، درج نظر مدیر الزامی است.');
    expect(approve).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('نظر مدیر *'), 'تأیید می‌شود');
    await userEvent.click(screen.getByRole('button', { name: 'تأیید' }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith('t1', 'تأیید می‌شود'));
    expect(await screen.findByText('درخواست تأیید شد ✓')).toBeInTheDocument();
  });

  it('the transfer button stays disabled until a target manager is picked', async () => {
    mockRole('CEO');
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue(LIST);
    vi.spyOn(cartableApi, 'fetchStaffDirectory').mockResolvedValue([
      { id: 's1', fullName: 'سحر کاظمی', role: 'FINANCE_MANAGER', roleLabelFa: 'مدیر مالی' },
    ]);
    const transfer = vi.spyOn(cartableApi, 'transferCartableTask').mockResolvedValue(LIST.tasks[0]);

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'بررسی' }));

    const transferButton = screen.getByRole('button', { name: 'انتقال' });
    expect(transferButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText('نظر مدیر *'), 'به مالی');
    await userEvent.selectOptions(screen.getByLabelText('انتقال به مدیر دیگر (اختیاری)'), 's1');
    expect(transferButton).toBeEnabled();
    await userEvent.click(transferButton);
    await waitFor(() => expect(transfer).toHaveBeenCalledWith('t1', 's1', 'به مالی'));
  });

  it('shows the empty state when the cartable is empty', async () => {
    mockRole('CEO');
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue({
      tasks: [],
      counts: { ADMIN: 0, AGENCY: 0, MANAGER: 0 },
      totalOpen: 0,
    });
    vi.spyOn(cartableApi, 'fetchStaffDirectory').mockResolvedValue([]);

    renderPage();
    expect(await screen.findByText('کارتابل خالی است ✓')).toBeInTheDocument();
  });

  it('the compose modal validates required fields with the design message', async () => {
    mockRole('CEO');
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue(LIST);
    vi.spyOn(cartableApi, 'fetchStaffDirectory').mockResolvedValue([]);
    const send = vi.spyOn(cartableApi, 'sendManagerMessage');

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'ایجاد پیام' }));

    await userEvent.click(screen.getByRole('button', { name: 'ارسال پیام' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('گیرنده، موضوع و متن پیام الزامی است.');
    expect(send).not.toHaveBeenCalled();
  });
});

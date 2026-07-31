import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmployeeCartablePage from './EmployeeCartablePage';
import * as cartableApi from '../../api/cartable';
import type { CartableListResult } from '../../types/cartable';

const LIST: CartableListResult = {
  tasks: [
    {
      id: 't1',
      category: 'ADMIN',
      title: 'بررسی قرارداد',
      description: 'توضیح',
      senderLabelFa: 'مدیر بازرگانی',
      sender: null,
      sourceType: null,
      sourceId: null,
      status: 'OPEN',
      resolutionNote: null,
      createdAt: '2026-07-31T10:00:00.000Z',
    },
  ],
  counts: { ADMIN: 1, AGENCY: 0, MANAGER: 0 },
  totalOpen: 1,
};

describe('EmployeeCartablePage', () => {
  beforeEach(() => {
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue(LIST);
    vi.spyOn(cartableApi, 'fetchManagerRecipients').mockResolvedValue([
      {
        id: 'mgr1',
        fullName: 'مدیر بازرگانی',
        role: 'COMMERCIAL_MANAGER',
        roleLabelFa: 'مدیر بازرگانی',
        isOwnManager: true,
      },
    ]);
    vi.spyOn(cartableApi, 'fetchSentManagerMessages').mockResolvedValue([]);
  });

  it('renders open tasks with the انجام شد button', async () => {
    render(<EmployeeCartablePage />);
    expect(await screen.findByText('بررسی قرارداد')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'انجام شد ✓' })).toBeInTheDocument();
  });

  it('marks a task done via approve with the design note', async () => {
    const approve = vi.spyOn(cartableApi, 'approveCartableTask').mockResolvedValue(LIST.tasks[0]);
    render(<EmployeeCartablePage />);
    await screen.findByText('بررسی قرارداد');
    await userEvent.click(screen.getByRole('button', { name: 'انجام شد ✓' }));
    await waitFor(() => {
      expect(approve).toHaveBeenCalledWith('t1', 'انجام شد');
    });
  });

  it('sends a manager message when recipient and text are filled', async () => {
    const send = vi.spyOn(cartableApi, 'sendEmployeeManagerMessage').mockResolvedValue({ id: 'x' });
    render(<EmployeeCartablePage />);
    await screen.findByText('ارسال پیام به مدیر');
    await userEvent.selectOptions(screen.getByLabelText('گیرنده'), 'mgr1');
    await userEvent.type(screen.getByLabelText('متن پیام'), 'سلام');
    await userEvent.click(screen.getByRole('button', { name: 'ارسال' }));
    await waitFor(() => {
      expect(send).toHaveBeenCalledWith({ toId: 'mgr1', body: 'سلام' });
    });
  });

  it('shows the empty state when there are no tasks', async () => {
    vi.spyOn(cartableApi, 'fetchCartable').mockResolvedValue({
      tasks: [],
      counts: { ADMIN: 0, AGENCY: 0, MANAGER: 0 },
      totalOpen: 0,
    });
    render(<EmployeeCartablePage />);
    expect(await screen.findByText('کار بازی در کارتابل شما نیست.')).toBeInTheDocument();
  });
});

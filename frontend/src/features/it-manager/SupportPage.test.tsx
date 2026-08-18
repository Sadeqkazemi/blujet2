import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SupportPage from './SupportPage';
import * as supportApi from '../../api/it-support-mock';
import * as useAuthModule from '../../hooks/useAuth';
import { mockAuthUserWithRole } from '../../test/mockAuthUser';
import type { ItSupportTicket } from '../../types/it-support';

const TICKET: ItSupportTicket = {
  id: 'tk_1',
  subject: 'کندی سامانه فروش',
  requesterNameFa: 'مریم یوسفی',
  requesterDeptFa: 'واحد فروش',
  priority: 'HIGH',
  status: 'OPEN',
  body: 'توضیح مشکل',
  createdAt: '2026-08-01T08:00:00.000Z',
  updatedAt: '2026-08-01T08:00:00.000Z',
  messages: [],
};

describe('SupportPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows permission-denied for a non-manager role', async () => {
    vi.spyOn(useAuthModule, 'useOptionalAuth').mockReturnValue({
      status: 'authenticated',
      user: mockAuthUserWithRole('EMPLOYEE'),
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(supportApi, 'fetchItSupportTickets').mockResolvedValue([TICKET]);

    render(<SupportPage />);
    expect(await screen.findByText('دسترسی شما برای مشاهدهٔ تیکت‌های پشتیبانی کافی نیست.')).toBeInTheDocument();
  });

  it('shows the empty state when there are no tickets', async () => {
    vi.spyOn(supportApi, 'fetchItSupportTickets').mockResolvedValue([]);
    render(<SupportPage />);
    expect(await screen.findByText('تیکتی با این فیلترها یافت نشد.')).toBeInTheDocument();
  });

  it('lists tickets, opens detail, and posts a reply', async () => {
    vi.spyOn(supportApi, 'fetchItSupportTickets').mockResolvedValue([TICKET]);
    vi.spyOn(supportApi, 'fetchItSupportTicketDetail').mockResolvedValue(TICKET);
    const replySpy = vi.spyOn(supportApi, 'replyToItSupportTicket').mockResolvedValue({
      ...TICKET,
      status: 'IN_PROGRESS',
      messages: [{ id: 'm1', authorNameFa: 'مدیر فناوری اطلاعات', body: 'در حال بررسی', createdAt: '2026-08-01T09:00:00.000Z' }],
    });

    render(<SupportPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('کندی سامانه فروش'));
    await user.type(screen.getByLabelText('پاسخ'), 'در حال بررسی');
    await user.click(screen.getByRole('button', { name: 'ارسال پاسخ' }));

    await waitFor(() => expect(replySpy).toHaveBeenCalledWith('tk_1', 'در حال بررسی'));
    expect(await screen.findByText('در حال بررسی', { selector: 'div' })).toBeInTheDocument();
  });

  it('requires a non-empty reply before submitting', async () => {
    vi.spyOn(supportApi, 'fetchItSupportTickets').mockResolvedValue([TICKET]);
    vi.spyOn(supportApi, 'fetchItSupportTicketDetail').mockResolvedValue(TICKET);
    const replySpy = vi.spyOn(supportApi, 'replyToItSupportTicket');

    render(<SupportPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('کندی سامانه فروش'));
    await user.click(screen.getByRole('button', { name: 'ارسال پاسخ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('متن پاسخ نمی‌تواند خالی باشد.');
    expect(replySpy).not.toHaveBeenCalled();
  });

  it('confirms before closing a ticket', async () => {
    vi.spyOn(supportApi, 'fetchItSupportTickets').mockResolvedValue([TICKET]);
    vi.spyOn(supportApi, 'fetchItSupportTicketDetail').mockResolvedValue(TICKET);
    const statusSpy = vi.spyOn(supportApi, 'setItSupportTicketStatus').mockResolvedValue({ ...TICKET, status: 'CLOSED' });

    render(<SupportPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByText('کندی سامانه فروش'));
    await user.click(screen.getByRole('button', { name: 'بستن تیکت' }));

    expect(await screen.findByText(/تیکت «کندی سامانه فروش» بسته می‌شود/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'بستن تیکت' })[1]!);

    await waitFor(() => expect(statusSpy).toHaveBeenCalledWith('tk_1', 'CLOSED'));
  });

  it('shows an API-unavailable error banner when the service fails', async () => {
    vi.spyOn(supportApi, 'fetchItSupportTickets').mockRejectedValue(new Error('network'));
    render(<SupportPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('سرویس پشتیبانی در دسترس نیست');
  });
});

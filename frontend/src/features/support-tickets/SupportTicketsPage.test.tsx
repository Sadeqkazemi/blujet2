import { render, screen, within, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SupportTicketsPage from './SupportTicketsPage';
import * as ticketsApi from '../../api/support-tickets';
import type { ForwardTarget, SupportTicketRow } from '../../types/support-tickets';

function row(overrides: Partial<SupportTicketRow> = {}): SupportTicketRow {
  return {
    id: 't1',
    trackingCode: 'TK1A2B3C4D',
    subject: 'مشکل در پرداخت',
    body: 'وجه کسر شد ولی بلیط صادر نشد.',
    requesterName: 'حسین رضوی',
    requesterPhone: '09121230000',
    dept: 'SITE',
    priority: 'MEDIUM',
    status: 'OPEN',
    forwardedTo: null,
    history: [{ step: 'submitted', labelFa: 'ثبت تیکت توسط کاربر', at: '2026-07-20T00:00:00.000Z' }],
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

const TICKET = row();
const TARGETS: ForwardTarget[] = [
  { id: 's1', fullName: 'مریم احمدی', role: 'FINANCE_MANAGER', roleLabelFa: 'مدیر مالی' },
];

function mockList(rows: SupportTicketRow[] = [TICKET]) {
  vi.spyOn(ticketsApi, 'fetchSupportTickets').mockResolvedValue(rows);
  vi.spyOn(ticketsApi, 'fetchForwardTargets').mockResolvedValue(TARGETS);
}

describe('SupportTicketsPage', () => {
  it('renders dark KPIs, table columns, status/priority badges and create button', async () => {
    mockList([
      TICKET,
      row({ id: 't2', trackingCode: 'TK222', status: 'CLOSED', subject: 'بسته', requesterName: 'علی' }),
    ]);
    render(<SupportTicketsPage />);

    expect(await screen.findByText('تیکت‌ها')).toBeInTheDocument();
    expect(screen.getByText('کل تیکت‌ها')).toBeInTheDocument();
    expect(screen.getByText('مشکل در پرداخت')).toBeInTheDocument();
    expect(screen.getByText('TK1A2B3C4D')).toBeInTheDocument();
    expect(screen.getAllByText('باز').length).toBeGreaterThan(0);
    expect(screen.getAllByText('متوسط').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /ایجاد تیکت/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/جستجو بر اساس شماره/)).toBeInTheDocument();
  });

  it('shows the empty state when no tickets exist', async () => {
    mockList([]);
    render(<SupportTicketsPage />);

    expect(await screen.findByText('تیکتی ثبت نشده است.')).toBeInTheDocument();
  });

  it('opening a ticket shows requester info and body', async () => {
    mockList();
    vi.spyOn(ticketsApi, 'fetchSupportTicketDetail').mockResolvedValue(TICKET);

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<SupportTicketsPage />);

    await userEvent.click(await screen.findByText('حسین رضوی'));
    const dialog = await screen.findByRole('dialog', { name: /TK1A2B3C4D/ });

    expect(within(dialog).getByText('حسین رضوی')).toBeInTheDocument();
    expect(within(dialog).getByText('09121230000')).toBeInTheDocument();
    expect(within(dialog).getByText('وجه کسر شد ولی بلیط صادر نشد.')).toBeInTheDocument();
  });

  it('forwards a ticket to a picked staffer and shows the notice', async () => {
    mockList();
    vi.spyOn(ticketsApi, 'fetchSupportTicketDetail').mockResolvedValue(TICKET);
    const forward = vi.spyOn(ticketsApi, 'forwardSupportTicket').mockResolvedValue({
      ...TICKET,
      status: 'IN_PROGRESS',
      forwardedTo: { id: 's1', fullName: 'مریم احمدی', role: 'FINANCE_MANAGER' },
    });

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<SupportTicketsPage />);

    await userEvent.click(await screen.findByText('حسین رضوی'));
    const dialog = await screen.findByRole('dialog', { name: /TK1A2B3C4D/ });

    const submit = within(dialog).getByRole('button', { name: 'ثبت ارجاع' });
    expect(submit).toBeDisabled();

    await userEvent.selectOptions(within(dialog).getByLabelText('گیرنده ارجاع'), 's1');
    await userEvent.click(submit);

    expect(forward).toHaveBeenCalledWith('t1', 's1');
    expect(await screen.findByText('تیکت به مریم احمدی ارجاع شد ✓')).toBeInTheDocument();
  });

  it('changes ticket status from the detail modal', async () => {
    mockList();
    vi.spyOn(ticketsApi, 'fetchSupportTicketDetail').mockResolvedValue(TICKET);
    const updateStatus = vi
      .spyOn(ticketsApi, 'updateSupportTicketStatus')
      .mockResolvedValue({ ...TICKET, status: 'CLOSED' });

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<SupportTicketsPage />);

    await userEvent.click(await screen.findByText('حسین رضوی'));
    const dialog = await screen.findByRole('dialog', { name: /TK1A2B3C4D/ });

    await userEvent.click(within(dialog).getByRole('button', { name: 'بسته شده' }));

    expect(updateStatus).toHaveBeenCalledWith('t1', 'CLOSED');
  });

  it('creates a ticket via the admin modal', async () => {
    mockList([]);
    const create = vi.spyOn(ticketsApi, 'createAdminSupportTicket').mockResolvedValue(
      row({ trackingCode: 'TKNEW1234', subject: 'عدم صدور بلیط' }),
    );

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<SupportTicketsPage />);

    await userEvent.click(await screen.findByRole('button', { name: /ایجاد تیکت/ }));
    const dialog = await screen.findByRole('dialog', { name: 'ایجاد تیکت جدید' });

    await userEvent.type(within(dialog).getByPlaceholderText(/عدم صدور بلیط/), 'عدم صدور بلیط');
    await userEvent.type(within(dialog).getByPlaceholderText(/نام آژانس/), 'آژانس تست');
    await userEvent.type(within(dialog).getByPlaceholderText(/جزئیات مشکل/), 'توضیح کامل مشکل');
    await userEvent.click(within(dialog).getByRole('button', { name: 'ثبت تیکت' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        subject: 'عدم صدور بلیط',
        requesterName: 'آژانس تست',
        dept: 'SITE',
        priority: 'MEDIUM',
        body: 'توضیح کامل مشکل',
      }),
    );
    expect(await screen.findByText(/تیکت TKNEW1234 ثبت شد/)).toBeInTheDocument();
  });

  it('paginates at 10 tickets per page', async () => {
    mockList(
      Array.from({ length: 12 }, (_, i) =>
        row({
          id: `t${i + 1}`,
          trackingCode: `TK${1000 + i}`,
          subject: `موضوع ${i + 1}`,
          requesterName: `کاربر ${i + 1}`,
        }),
      ),
    );
    const { default: userEvent } = await import('@testing-library/user-event');
    render(<SupportTicketsPage />);

    expect(await screen.findByText('موضوع 1')).toBeInTheDocument();
    expect(screen.getByText('موضوع 10')).toBeInTheDocument();
    expect(screen.queryByText('موضوع 11')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'بعدی' }));
    expect(await screen.findByText('موضوع 11')).toBeInTheDocument();
  });
});

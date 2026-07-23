import { render, screen, within } from '@testing-library/react';
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
  it('renders the ticket list with subject, tracking code and status pill', async () => {
    mockList();
    render(<SupportTicketsPage />);

    expect(await screen.findByText('مشکل در پرداخت')).toBeInTheDocument();
    expect(screen.getByText('TK1A2B3C4D')).toBeInTheDocument();
    expect(screen.getByText('باز')).toBeInTheDocument();
    expect(screen.getByText('۱ تیکت')).toBeInTheDocument();
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

    await userEvent.click(await screen.findByRole('button', { name: /حسین رضوی/ }));
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

    await userEvent.click(await screen.findByRole('button', { name: /حسین رضوی/ }));
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

    await userEvent.click(await screen.findByRole('button', { name: /حسین رضوی/ }));
    const dialog = await screen.findByRole('dialog', { name: /TK1A2B3C4D/ });

    await userEvent.click(within(dialog).getByRole('button', { name: 'بسته شده' }));

    expect(updateStatus).toHaveBeenCalledWith('t1', 'CLOSED');
  });
});

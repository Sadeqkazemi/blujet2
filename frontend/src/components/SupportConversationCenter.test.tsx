import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SupportConversationCenter from './SupportConversationCenter';
import type { MySupportTicketRow } from '../types/support-tickets';

const tickets: MySupportTicketRow[] = [
  {
    id: 'ticket-1',
    trackingCode: 'TK123',
    subject: 'مشکل پرداخت',
    body: 'متن اولیه',
    status: 'ANSWERED',
    history: [],
    createdAt: '2026-08-27T08:00:00.000Z',
    updatedAt: '2026-08-27T09:00:00.000Z',
    attachments: [],
    conversation: [
      {
        id: 'initial',
        body: 'متن اولیه',
        senderType: 'REQUESTER',
        senderLabel: 'کاربر آزمون',
        createdAt: '2026-08-27T08:00:00.000Z',
        attachments: [],
      },
      {
        id: 'answer',
        body: 'پاسخ پشتیبانی',
        senderType: 'STAFF',
        senderLabel: 'پشتیبانی blujet',
        createdAt: '2026-08-27T09:00:00.000Z',
        attachments: [],
      },
    ],
  },
];

describe('SupportConversationCenter', () => {
  it('uses the light visual theme inside customer and agency shells', () => {
    render(
      <SupportConversationCenter
        theme="light"
        locale="fa"
        tickets={tickets}
        selectedId="ticket-1"
        onSelect={vi.fn()}
        onReply={vi.fn()}
        onNew={vi.fn()}
      />,
    );

    expect(screen.getByTestId('support-conversation-center')).toHaveAttribute('data-theme', 'light');
    expect(screen.getByTestId('support-conversation-center')).toHaveClass('bg-white');
    expect(screen.getByRole('heading', { name: 'تیکت‌های من' })).toHaveClass('text-[#102a43]');
  });

  it('renders status counters, ticket rows, the conversation, and sends a reply', async () => {
    const onReply = vi.fn().mockResolvedValue(undefined);
    render(
      <SupportConversationCenter
        locale="fa"
        tickets={tickets}
        selectedId="ticket-1"
        onSelect={vi.fn()}
        onReply={onReply}
        onNew={vi.fn()}
      />,
    );

    expect(screen.getByTestId('support-status-ANSWERED')).toHaveTextContent('۱');
    expect(screen.getAllByText('مشکل پرداخت')).toHaveLength(2);
    expect(screen.getByText('متن اولیه')).toBeInTheDocument();
    expect(screen.getByText('پاسخ پشتیبانی')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('پاسخ جدید'), 'سپاسگزارم');
    await userEvent.click(screen.getByRole('button', { name: 'ارسال پیام' }));
    expect(onReply).toHaveBeenCalledWith('ticket-1', 'سپاسگزارم', []);
  });

  it('searches owned tickets by tracking code and subject', async () => {
    render(
      <SupportConversationCenter
        locale="fa"
        tickets={[
          ...tickets,
          { ...tickets[0], id: 'ticket-2', trackingCode: 'TK999', subject: 'مشکل بار' },
        ]}
        selectedId={null}
        onSelect={vi.fn()}
        onReply={vi.fn()}
        onNew={vi.fn()}
      />,
    );

    const search = screen.getByPlaceholderText('جستجو با شماره تیکت یا موضوع…');
    await userEvent.type(search, 'TK999');
    expect(screen.getAllByText('مشکل بار')).toHaveLength(2);
    expect(screen.queryByText('مشکل پرداخت')).not.toBeInTheDocument();
  });

  it('does not render a reply composer for a closed ticket', () => {
    render(
      <SupportConversationCenter
        locale="fa"
        tickets={[{ ...tickets[0], status: 'CLOSED' }]}
        selectedId="ticket-1"
        onSelect={vi.fn()}
        onReply={vi.fn()}
        onNew={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('پاسخ جدید')).not.toBeInTheDocument();
    expect(screen.getByText('این گفتگو بسته شده است.')).toBeInTheDocument();
  });
});

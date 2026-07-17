import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AgencyInboxPage from './AgencyInboxPage';
import * as portalApi from '../../api/agency-portal';
import type { AgencyMessage } from '../../types/agency-portal';

const MESSAGES: AgencyMessage[] = [
  {
    id: 'm1',
    senderId: 'staff1',
    senderIsAgency: false,
    body: 'لطفاً فاکتور را تسویه بفرمایید.',
    createdAt: '2026-07-01T00:00:00.000Z',
  },
];

describe('AgencyInboxPage', () => {
  it('renders the thread and sends a new message', async () => {
    vi.spyOn(portalApi, 'fetchInbox').mockResolvedValue(MESSAGES);
    const postSpy = vi.spyOn(portalApi, 'postInboxMessage').mockResolvedValue({
      id: 'm2',
      senderId: 'agency1',
      senderIsAgency: true,
      body: 'حتماً تا پنجشنبه پرداخت می‌شود.',
      createdAt: '2026-07-02T00:00:00.000Z',
    });

    render(<AgencyInboxPage />);
    expect(await screen.findByText('لطفاً فاکتور را تسویه بفرمایید.')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('پیام خود را بنویسید…'), 'حتماً تا پنجشنبه پرداخت می‌شود.');
    await user.click(screen.getByRole('button', { name: 'ارسال' }));

    await waitFor(() => expect(postSpy).toHaveBeenCalledWith('حتماً تا پنجشنبه پرداخت می‌شود.'));
  });
});

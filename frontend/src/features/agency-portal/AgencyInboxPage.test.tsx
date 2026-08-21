import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgencyInboxPage from './AgencyInboxPage';
import * as portalApi from '../../api/agency-portal';
import * as useLocaleModule from '../../hooks/useLocale';
import type { AgencyMessage } from '../../types/agency-portal';

function mockLocale(locale: 'fa' | 'en' | 'ar') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

afterEach(() => {
  vi.restoreAllMocks();
});

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
    await user.click(screen.getByRole('button', { name: /پیام جدید/ }));
    const dialog = screen.getByRole('dialog', { name: 'پیام جدید' });
    await user.type(screen.getByPlaceholderText('موضوع پیام'), 'تسویه فاکتور');
    await user.type(screen.getByPlaceholderText('پیام خود را بنویسید…'), 'حتماً تا پنجشنبه پرداخت می‌شود.');
    await user.click(within(dialog).getByRole('button', { name: 'ارسال' }));

    await waitFor(() => expect(postSpy).toHaveBeenCalledWith('موضوع: تسویه فاکتور\n\nحتماً تا پنجشنبه پرداخت می‌شود.'));
  });

  it('renders translated heading, placeholder, and send button in English', async () => {
    mockLocale('en');
    vi.spyOn(portalApi, 'fetchInbox').mockResolvedValue(MESSAGES);
    render(<AgencyInboxPage />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /New message/ }));
    const dialog = screen.getByRole('dialog', { name: 'New message' });
    expect(screen.getByPlaceholderText('Write your message…')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('renders translated heading and empty state in Arabic', async () => {
    mockLocale('ar');
    vi.spyOn(portalApi, 'fetchInbox').mockResolvedValue([]);
    render(<AgencyInboxPage />);

    expect(await screen.findByText('لا توجد رسائل بعد.')).toBeInTheDocument();
  });
});

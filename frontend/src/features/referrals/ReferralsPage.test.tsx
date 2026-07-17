import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ReferralsPage from './ReferralsPage';
import * as cartableApi from '../../api/cartable';
import type { Referral, ReferralListResult } from '../../types/cartable';

const REFERRAL: Referral = {
  id: 'r1',
  title: 'درخواست گزارش فروش سه‌ماهه',
  body: 'گزارش تفکیکی ارسال شود.',
  priority: 'HIGH',
  dueAt: '2026-07-25T00:00:00.000Z',
  status: 'REPORTED',
  createdAt: '2026-07-16T08:00:00.000Z',
  recipients: [{ recipientId: 'u2', recipient: { id: 'u2', fullName: 'سحر کاظمی', role: 'FINANCE_MANAGER' } }],
};

const LIST: ReferralListResult = {
  referrals: [REFERRAL],
  kpis: { total: 4, awaitingReport: 2, reported: 1, closed: 1 },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ReferralsPage />
    </MemoryRouter>,
  );
}

describe('ReferralsPage', () => {
  it('renders the 4 KPI cards and the table with status/priority labels and Jalali dates', async () => {
    vi.spyOn(cartableApi, 'fetchReferrals').mockResolvedValue(LIST);
    vi.spyOn(cartableApi, 'fetchStaffDirectory').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('کل ارجاعات')).toBeInTheDocument();
    expect(screen.getByText('در انتظار گزارش')).toBeInTheDocument();
    expect(screen.getByText('گزارش دریافت‌شده')).toBeInTheDocument();
    expect(screen.getByText('بسته‌شده')).toBeInTheDocument();

    expect(screen.getByText('درخواست گزارش فروش سه‌ماهه')).toBeInTheDocument();
    expect(screen.getByText('گزارش دریافت‌شد')).toBeInTheDocument();
    expect(screen.getByText('بالا')).toBeInTheDocument();
    // No raw ISO date leaks into the table.
    expect(screen.queryByText(/2026-07/)).not.toBeInTheDocument();
  });

  it('the creation modal requires title, body and at least one recipient', async () => {
    vi.spyOn(cartableApi, 'fetchReferrals').mockResolvedValue(LIST);
    vi.spyOn(cartableApi, 'fetchStaffDirectory').mockResolvedValue([
      { id: 's1', fullName: 'سحر کاظمی', role: 'FINANCE_MANAGER', roleLabelFa: 'مدیر مالی' },
    ]);
    const create = vi.spyOn(cartableApi, 'createReferral').mockResolvedValue(REFERRAL);

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'ایجاد ارجاع جدید' }));
    await userEvent.click(screen.getByRole('button', { name: 'ارسال ارجاع' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'موضوع، شرح درخواست و حداقل یک مدیر مقصد الزامی است.',
    );
    expect(create).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('موضوع ارجاع *'), 'موضوع تست');
    await userEvent.type(screen.getByLabelText('شرح درخواست *'), 'شرح تست');
    await userEvent.click(screen.getByRole('button', { name: 'سحر کاظمی — مدیر مالی' }));
    await userEvent.click(screen.getByRole('button', { name: 'ارسال ارجاع' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'موضوع تست', body: 'شرح تست', recipientIds: ['s1'] }),
      ),
    );
    expect(await screen.findByText('ارجاع به «سحر کاظمی» ارسال شد ✓')).toBeInTheDocument();
  });

  it('the detail view shows reports and the REPORTED-state sender actions', async () => {
    vi.spyOn(cartableApi, 'fetchReferrals').mockResolvedValue(LIST);
    vi.spyOn(cartableApi, 'fetchStaffDirectory').mockResolvedValue([]);
    vi.spyOn(cartableApi, 'fetchReferralDetail').mockResolvedValue({
      ...REFERRAL,
      reports: [
        {
          id: 'rep1',
          body: 'گزارش پیوست شد.',
          createdAt: '2026-07-17T09:00:00.000Z',
          from: { id: 'u2', fullName: 'سحر کاظمی', role: 'FINANCE_MANAGER' },
        },
      ],
    });
    const close = vi.spyOn(cartableApi, 'closeReferral').mockResolvedValue({ ...REFERRAL, status: 'CLOSED' });

    const { default: userEvent } = await import('@testing-library/user-event');
    renderPage();

    await userEvent.click(await screen.findByText('درخواست گزارش فروش سه‌ماهه'));
    expect(await screen.findByText('گزارش پیوست شد.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'درخواست اصلاح گزارش' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'تأیید دریافت گزارش و بستن' }));
    await waitFor(() => expect(close).toHaveBeenCalledWith('r1'));
  });
});

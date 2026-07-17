import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PassengerReportPage from './PassengerReportPage';
import StaffReportPage from './StaffReportPage';
import * as financeApi from '../../api/finance';
import type { PassengerReportResult, StaffReportResult } from '../../types/finance';

const PASSENGERS: PassengerReportResult = {
  results: [
    {
      id: 'p1',
      fullName: 'نگار رضایی',
      seatCode: '12C',
      pnr: 'BLJ2K8',
      status: 'TICKETED',
      priceIrr: 38_000_000,
      flightNo: 'EP-821',
      originCode: 'THR',
      destCode: 'DXB',
      departureAt: '2026-07-20T08:30:00.000Z',
    },
  ],
  quickNames: ['نگار رضایی', 'رضا کریمی'],
};

const STAFF: StaffReportResult = {
  employees: [
    { id: 'e1', fullName: 'علی احمدی', dept: 'بازرگانی', rank: 'کارشناس' },
    { id: 'e2', fullName: 'مریم کاظمی', dept: 'مالی', rank: 'کارشناس' },
  ],
  reports: [
    {
      id: 'r1',
      employeeId: 'e1',
      category: 'AGENCY',
      action: 'بررسی پرونده آژانس',
      detail: 'پرونده آژانس نمونه بررسی شد.',
      at: '2026-07-17T09:00:00.000Z',
    },
  ],
  notices: [
    { id: 'n1', text: 'کارمند جدید «سارا نادری» توسط مدیر IT اضافه شد.', at: '2026-07-16T09:00:00.000Z' },
  ],
};

describe('PassengerReportPage', () => {
  it('searches and renders the ticket card with LTR PNR/flight and toman amount; empty state otherwise', async () => {
    const fetchSpy = vi
      .spyOn(financeApi, 'fetchPassengerReport')
      .mockResolvedValue({ results: [], quickNames: PASSENGERS.quickNames });

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<PassengerReportPage />);

    // Quick chips from the initial (empty-query) load.
    expect(await screen.findByRole('button', { name: 'رضا کریمی' })).toBeInTheDocument();

    fetchSpy.mockResolvedValue(PASSENGERS);
    await userEvent.type(screen.getByLabelText('جستجوی مسافر'), 'نگار');
    await userEvent.click(screen.getByRole('button', { name: 'جستجو' }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('نگار'));
    expect(await screen.findByText('BLJ2K8')).toBeInTheDocument();
    expect(screen.getByText('EP-821')).toBeInTheDocument();
    expect(screen.getByText('THR ← DXB')).toBeInTheDocument();
    // 38M rial → ۳٬۸۰۰٬۰۰۰ toman
    expect(screen.getByText('۳٬۸۰۰٬۰۰۰ تومان')).toBeInTheDocument();
    expect(screen.getByText('بلیط صادر شده')).toBeInTheDocument();

    fetchSpy.mockResolvedValue({ results: [], quickNames: [] });
    await userEvent.clear(screen.getByLabelText('جستجوی مسافر'));
    await userEvent.type(screen.getByLabelText('جستجوی مسافر'), 'ناموجود');
    await userEvent.click(screen.getByRole('button', { name: 'جستجو' }));
    expect(await screen.findByText('مسافری با این نام یافت نشد.')).toBeInTheDocument();
  });
});

describe('StaffReportPage', () => {
  it('renders the IT notice banner (dismissible), per-employee tabs and filtered reports', async () => {
    vi.spyOn(financeApi, 'fetchStaffReport').mockResolvedValue(STAFF);

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<StaffReportPage />);

    expect(await screen.findByText('کارمند جدید توسط مدیر IT اضافه شد')).toBeInTheDocument();
    expect(screen.getByText(/سارا نادری/)).toBeInTheDocument();

    // Per-employee filter: e2 has no reports.
    await userEvent.click(screen.getByRole('button', { name: /مریم کاظمی/ }));
    expect(await screen.findByText('گزارشی برای این کارمند ثبت نشده است.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /علی احمدی/ }));
    expect(await screen.findByText('بررسی پرونده آژانس')).toBeInTheDocument();
    expect(screen.getByText('آژانس', { exact: true })).toBeInTheDocument(); // category pill

    // Client-side dismissal of the banner.
    await userEvent.click(screen.getByRole('button', { name: 'علامت‌گذاری به‌عنوان خوانده‌شده' }));
    expect(screen.queryByText('کارمند جدید توسط مدیر IT اضافه شد')).not.toBeInTheDocument();
  });
});

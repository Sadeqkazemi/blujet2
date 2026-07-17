import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PassengerReportsPage from './PassengerReportsPage';
import * as reportingApi from '../../api/reporting';
import type { PassengerReportHit } from '../../types/reporting';

const HIT: PassengerReportHit = {
  fullName: 'نگار رضایی',
  maskedNationalId: '049******9',
  pnr: 'BJDEMO1',
  status: 'TICKETED',
  flightNo: 'EP-821',
  originCode: 'THR',
  destCode: 'DXB',
  departureAt: '2026-08-01T05:00:00.000Z',
  seatCode: '4C',
  cabin: 'BUSINESS',
  priceIrr: 420_000_000,
};

describe('PassengerReportsPage', () => {
  it('searches and shows the ticket detail card with a masked national ID', async () => {
    const searchSpy = vi.spyOn(reportingApi, 'searchPassengers').mockResolvedValue([HIT]);

    render(<PassengerReportsPage />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('مثال: نگار رضایی'), 'نگار');
    await user.click(screen.getByRole('button', { name: 'جستجو' }));

    expect(searchSpy).toHaveBeenCalledWith('نگار');
    expect(await screen.findByText('نگار رضایی')).toBeInTheDocument();
    expect(screen.getByText('BJDEMO1')).toBeInTheDocument();
    expect(screen.getByText(/۰۴۹\*+۹/)).toBeInTheDocument();
    expect(screen.getByText(/بیزنس/)).toBeInTheDocument();
  });

  it('shows the design no-result state', async () => {
    vi.spyOn(reportingApi, 'searchPassengers').mockResolvedValue([]);

    render(<PassengerReportsPage />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('مثال: نگار رضایی'), 'ناموجود');
    await user.click(screen.getByRole('button', { name: 'جستجو' }));

    expect(await screen.findByText('مسافری با این نام یافت نشد.')).toBeInTheDocument();
  });
});

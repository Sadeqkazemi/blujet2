import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FinanceReportsPage from './FinanceReportsPage';
import * as api from '../../api/finance-manager';

describe('FinanceReportsPage', () => {
  it('renders real partner rows and refetches when switching to charters', async () => {
    const report = vi.spyOn(api, 'fetchFinanceReport').mockResolvedValue({
      kind: 'partners',
      scope: 'AGENCIES',
      period: 'month',
      rows: [{ id: 'a1', name: 'آژانس سپهر', totalIrr: '3100000000', paidIrr: '2800000000', outstandingIrr: '300000000', soldSeats: 12 }],
      summary: { totalIrr: '3100000000', paidIrr: '2800000000' },
    });

    render(<FinanceReportsPage />);
    expect(await screen.findByText('آژانس سپهر')).toBeInTheDocument();
    expect(screen.getByText('۳۰٬۰۰۰٬۰۰۰ تومان')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'چارترها' }));
    await waitFor(() => expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'CHARTERS' })));
  });

  it('shows the flight-search empty state from a real empty response', async () => {
    vi.spyOn(api, 'fetchFinanceReport').mockResolvedValue({ kind: 'partners', scope: 'AGENCIES', period: 'month', rows: [], summary: { totalIrr: '0', paidIrr: '0' } });
    vi.spyOn(api, 'searchFinanceFlights').mockResolvedValue({ rows: [] });
    render(<FinanceReportsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'جستجوی پرواز' }));
    expect(await screen.findByText('پرواز منطبق پیدا نشد.')).toBeInTheDocument();
  });
});

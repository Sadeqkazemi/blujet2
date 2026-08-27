import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FinanceReportsPage from './FinanceReportsPage';
import * as api from '../../api/finance-manager';
import type { FinanceReportFilters } from '../../api/finance-manager';

describe('FinanceReportsPage', () => {
  it('renders real partner rows and refetches when switching to charters', async () => {
    const report = vi.spyOn(api, 'fetchFinanceReport').mockResolvedValue({
      kind: 'partners',
      scope: 'AGENCIES',
      period: 'month',
      rows: [
        {
          id: 'a1',
          name: 'آژانس سپهر',
          totalIrr: '3100000000',
          paidIrr: '2800000000',
          outstandingIrr: '300000000',
          soldSeats: 12,
        },
      ],
      summary: { totalIrr: '3100000000', paidIrr: '2800000000' },
    });

    render(<FinanceReportsPage />);
    expect(await screen.findByText('آژانس سپهر')).toBeInTheDocument();
    expect(screen.getByText('۳۰٬۰۰۰٬۰۰۰ تومان')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'چارترها' }));
    await waitFor(() =>
      expect(report).toHaveBeenLastCalledWith(
        expect.objectContaining({ scope: 'CHARTERS' }),
      ),
    );
  });

  it('shows the flight-search empty state from a real empty response', async () => {
    vi.spyOn(api, 'fetchFinanceReport').mockResolvedValue({
      kind: 'partners',
      scope: 'AGENCIES',
      period: 'month',
      rows: [],
      summary: { totalIrr: '0', paidIrr: '0' },
    });
    vi.spyOn(api, 'searchFinanceFlights').mockResolvedValue({ rows: [] });
    render(<FinanceReportsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'جستجوی پرواز' }));
    expect(await screen.findByText('پرواز منطبق پیدا نشد.')).toBeInTheDocument();
  });

  it('shows customer report seat split columns from real flight rows', async () => {
    vi.spyOn(api, 'fetchFinanceReport').mockImplementation(
      async (filters: FinanceReportFilters) => {
        if (filters.scope === 'CUSTOMERS') {
          return {
            kind: 'customers' as const,
            scope: 'CUSTOMERS' as const,
            period: filters.period ?? 'month',
            rows: [
              {
                flightInstanceId: 'fi1',
                flightNo: 'BJ-100',
                departureAt: '2026-07-01T05:00:00.000Z',
                originCode: 'THR',
                destCode: 'MHD',
                originCityFa: 'تهران',
                destCityFa: 'مشهد',
                capacity: 180,
                soldSeats: 100,
                unsoldSeats: 80,
                totalIrr: '5000000000',
                agencyCount: 2,
                agencySeats: 40,
              },
            ],
            summary: { totalIrr: '5000000000', soldSeats: 100 },
          };
        }
        return {
          kind: 'partners' as const,
          scope: filters.scope,
          period: 'month' as const,
          rows: [],
          summary: { totalIrr: '0', paidIrr: '0' },
        };
      },
    );

    render(<FinanceReportsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'مشتریان' }));
    expect(await screen.findByText('BJ-100')).toBeInTheDocument();
    expect(screen.getByText('عادی')).toBeInTheDocument();
    expect(screen.getByText('آژانس')).toBeInTheDocument();
    expect(screen.getByText('فروخته‌نشده')).toBeInTheDocument();
  });

  it('offers server-generated PDF alongside Excel and CSV', async () => {
    vi.spyOn(api, 'fetchFinanceReport').mockResolvedValue({
      kind: 'partners',
      scope: 'AGENCIES',
      period: 'month',
      rows: [],
      summary: { totalIrr: '0', paidIrr: '0' },
    });
    vi.spyOn(api, 'downloadFinanceReport').mockResolvedValue(new Blob(['pdf']));

    render(<FinanceReportsPage />);
    expect(await screen.findByRole('button', { name: 'خروجی PDF' })).toBeInTheDocument();
  });

  it('renders server-side detailed sales rows with cabin and fare class', async () => {
    vi.spyOn(api, 'fetchFinanceReport').mockResolvedValue({
      kind: 'partners', scope: 'AGENCIES', period: 'month', rows: [],
      summary: { totalIrr: '0', paidIrr: '0' },
    });
    vi.spyOn(api, 'fetchFinanceSales').mockResolvedValue({
      rows: [{
        bookingId: 'b1', pnr: 'BJTEST', bookedAt: '2026-08-01T00:00:00.000Z',
        bookingStatus: 'TICKETED', paymentStatus: 'PAID', channel: 'SYSTEM',
        flightInstanceId: 'fi1', flightNo: 'XY123', originCode: 'THR', destCode: 'MHD',
        departureAt: '2026-08-02T08:00:00.000Z', arrivalAt: '2026-08-02T09:00:00.000Z',
        cabin: 'ECONOMY', fareClassCode: 'Y', passengerCount: 1,
        baseFareIrr: '1000000', taxIrr: '100000', extrasIrr: '0', totalIrr: '1100000',
        agencyId: null, agencyName: null,
      }],
      summary: { orderCount: 1, passengerCount: 1, grossIrr: '1100000', netRevenueIrr: '1100000', averageOrderIrr: '1100000' },
    });

    render(<FinanceReportsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'گزارش تفصیلی' }));
    expect(await screen.findByText('BJTEST')).toBeInTheDocument();
    expect(screen.getByText('ECONOMY/Y')).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import * as publicSiteApi from '../../../api/publicSite';
import { ApiRequestError } from '../../../api/envelope';
import FlightPriceCalendar from './FlightPriceCalendar';

const DAYS = [
  { date: '2026-07-29', minPriceIrr: '40000000', dateLabelFa: '2026-07-29', isCenter: false },
  { date: '2026-07-30', minPriceIrr: '0', dateLabelFa: '2026-07-30', isCenter: false },
  { date: '2026-07-31', minPriceIrr: '35000000', dateLabelFa: '2026-07-31', isCenter: false },
  { date: '2026-08-01', minPriceIrr: '38000000', dateLabelFa: '2026-08-01', isCenter: true },
  { date: '2026-08-02', minPriceIrr: '42000000', dateLabelFa: '2026-08-02', isCenter: false },
  { date: '2026-08-03', minPriceIrr: '39000000', dateLabelFa: '2026-08-03', isCenter: false },
  { date: '2026-08-04', minPriceIrr: '41000000', dateLabelFa: '2026-08-04', isCenter: false },
];

describe('FlightPriceCalendar', () => {
  it('loads real API days, marks selected + cheapest, and shows empty day as —', async () => {
    const onSelect = vi.fn();
    vi.spyOn(publicSiteApi, 'fetchPriceCalendar').mockResolvedValue(DAYS);

    render(
      <FlightPriceCalendar
        origin="THR"
        dest="MHD"
        selectedDate="2026-08-01"
        locale="fa"
        onSelectDate={onSelect}
      />,
    );

    expect(screen.getByTestId('price-calendar-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('price-calendar-strip')).toBeInTheDocument();
    });

    expect(publicSiteApi.fetchPriceCalendar).toHaveBeenCalledWith('THR', 'MHD', '2026-08-01');
    expect(screen.getByTestId('price-calendar-day-2026-08-01')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('price-calendar-day-2026-07-30')).toHaveAttribute('data-empty', 'true');
    expect(screen.getByTestId('price-calendar-cheapest-2026-07-31')).toBeInTheDocument();
    expect(screen.getByTestId('price-calendar')).toHaveAttribute('dir', 'rtl');

    await userEvent.click(screen.getByTestId('price-calendar-day-2026-08-02'));
    expect(onSelect).toHaveBeenCalledWith('2026-08-02');
  });

  it('shows error state with retry', async () => {
    const spy = vi
      .spyOn(publicSiteApi, 'fetchPriceCalendar')
      .mockRejectedValueOnce(new ApiRequestError('INTERNAL_ERROR', 'fail', 500))
      .mockResolvedValueOnce(DAYS);

    render(
      <FlightPriceCalendar
        origin="THR"
        dest="MHD"
        selectedDate="2026-08-01"
        locale="fa"
        onSelectDate={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('price-calendar-error')).toBeInTheDocument();
    });

    const callsBeforeRetry = spy.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'تلاش مجدد' }));
    await waitFor(() => {
      expect(screen.getByTestId('price-calendar-strip')).toBeInTheDocument();
    });
    expect(spy.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
  });
});

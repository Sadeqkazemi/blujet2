import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FlightSearchDateRangePicker from './FlightSearchDateRangePicker';
import * as useIsMobileModule from '../../../hooks/useIsMobile';

describe('FlightSearchDateRangePicker', () => {
  it('opens dual-month panel on desktop and selects today', async () => {
    vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(false);
    const onDep = vi.fn();
    render(
      <FlightSearchDateRangePicker
        locale="fa"
        trip="oneway"
        onTripChange={vi.fn()}
        depIso={null}
        retIso={null}
        onDepChange={onDep}
        onRetChange={vi.fn()}
        depLabel="تاریخ رفت"
        retLabel="تاریخ برگشت"
        destSelected
        showReturnField={false}
        testIdPrefix="home"
      />,
    );

    await userEvent.click(screen.getByTestId('home-date'));
    expect(screen.getByTestId('home-cal-panel')).toBeInTheDocument();
    expect(screen.getByTestId('home-cal-greg-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('home-cal-oneway-toggle')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('home-date-today'));
    expect(onDep).toHaveBeenCalledTimes(1);
  });

  it('toggles round-trip from calendar one-way checkbox', async () => {
    vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(false);
    const onTrip = vi.fn();
    render(
      <FlightSearchDateRangePicker
        locale="fa"
        trip="round"
        onTripChange={onTrip}
        depIso={null}
        retIso={null}
        onDepChange={vi.fn()}
        onRetChange={vi.fn()}
        depLabel="تاریخ رفت"
        retLabel="تاریخ برگشت"
        destSelected
        showReturnField
        testIdPrefix="home"
      />,
    );

    await userEvent.click(screen.getByTestId('home-date'));
    await userEvent.click(screen.getByTestId('home-cal-oneway-toggle'));
    expect(onTrip).toHaveBeenCalledWith('oneway');
  });
});

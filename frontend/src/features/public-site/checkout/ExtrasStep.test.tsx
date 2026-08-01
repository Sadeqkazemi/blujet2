import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SeatMapCell } from '../../../types/public-site';
import ExtrasStep from './ExtrasStep';
import { defaultExtras } from './checkout-types';

const SEATS: SeatMapCell[] = [
  { seatCode: '3A', row: 3, cabin: 'BUSINESS', status: 'FREE' },
  { seatCode: '3B', row: 3, cabin: 'BUSINESS', status: 'FREE' },
  { seatCode: '3E', row: 3, cabin: 'BUSINESS', status: 'TAKEN' },
  { seatCode: '3F', row: 3, cabin: 'BUSINESS', status: 'FREE' },
  { seatCode: '7A', row: 7, cabin: 'ECONOMY', status: 'FREE' },
  { seatCode: '7B', row: 7, cabin: 'ECONOMY', status: 'FREE' },
  { seatCode: '7D', row: 7, cabin: 'ECONOMY', status: 'FREE' },
  { seatCode: '7E', row: 7, cabin: 'ECONOMY', status: 'TAKEN' },
  { seatCode: '7F', row: 7, cabin: 'ECONOMY', status: 'FREE' },
];

describe('ExtrasStep — design parity', () => {
  it('renders design service titles, descriptions and prices', () => {
    render(
      <ExtrasStep
        locale="fa"
        extras={defaultExtras()}
        onToggleExtra={vi.fn()}
        seats={SEATS}
        selectedSeats={[]}
        onToggleSeat={vi.fn()}
        businessLocked
        bookedCabin="ECONOMY"
        aircraftType="MD-80"
      />,
    );

    expect(screen.getByText('خدمات جانبی سفر')).toBeInTheDocument();
    expect(
      screen.getByText('خدماتی که می‌خواهید انتخاب کنید — هزینه به مجموع شما اضافه می‌شود'),
    ).toBeInTheDocument();
    expect(screen.getByText('بار اضافه (۱۰ کیلوگرم)')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-extra-baggage')).toHaveTextContent('۴۵۰٬۰۰۰');
    expect(screen.getByTestId('checkout-extra-cip')).toHaveTextContent('۹۰۰٬۰۰۰');
  });

  it('renders the MD-80 aircraft seat chart from the PDF layout', () => {
    render(
      <ExtrasStep
        locale="fa"
        extras={defaultExtras()}
        onToggleExtra={vi.fn()}
        seats={SEATS}
        selectedSeats={[]}
        onToggleSeat={vi.fn()}
        businessLocked
        bookedCabin="ECONOMY"
        aircraftType="MD-80"
      />,
    );

    const map = screen.getByTestId('checkout-seat-map');
    expect(map).toHaveAttribute('data-aircraft', 'MD-80');
    expect(screen.getByTestId('checkout-seat-toggle')).toHaveTextContent('MD-80');
    expect(screen.getByText('فرست کلاس')).toBeInTheDocument();
    expect(screen.getByText('اکونومی')).toBeInTheDocument();
    // Rear exit/galley rows omit A/B — amenity labels visible
    expect(screen.getAllByText('خروج').length).toBeGreaterThan(0);
    expect(screen.getAllByText('گالی').length).toBeGreaterThan(0);
    // Visible seat buttons for PDF letters
    expect(screen.getByTestId('checkout-seat-7D')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-seat-3F')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-seat-3A')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-seat-28A')).not.toBeInTheDocument();
  });

  it('still shows all MD-80 seats when the API seat list is empty', () => {
    render(
      <ExtrasStep
        locale="fa"
        extras={defaultExtras()}
        onToggleExtra={vi.fn()}
        seats={[]}
        selectedSeats={[]}
        onToggleSeat={vi.fn()}
        businessLocked={false}
        bookedCabin="ECONOMY"
        aircraftType="MD-80"
      />,
    );

    expect(screen.getByTestId('checkout-seat-map')).toHaveAttribute('data-capacity', '140');
    expect(screen.getByTestId('checkout-seat-7A')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-seat-12F')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-seat-32A')).toBeInTheDocument();
  });

  it('toggles an extra service when the card is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <ExtrasStep
        locale="fa"
        extras={defaultExtras()}
        onToggleExtra={onToggle}
        seats={SEATS}
        selectedSeats={[]}
        onToggleSeat={vi.fn()}
        businessLocked={false}
        bookedCabin="ECONOMY"
        aircraftType="MD-80"
      />,
    );

    await user.click(screen.getByTestId('checkout-extra-insurance'));
    expect(onToggle).toHaveBeenCalledWith('insurance');
  });

  it('only allows selecting seats in the booked cabin', async () => {
    const user = userEvent.setup();
    const onToggleSeat = vi.fn();
    render(
      <ExtrasStep
        locale="fa"
        extras={defaultExtras()}
        onToggleExtra={vi.fn()}
        seats={SEATS}
        selectedSeats={[]}
        onToggleSeat={onToggleSeat}
        businessLocked={false}
        bookedCabin="ECONOMY"
        aircraftType="MD-80"
      />,
    );

    expect(screen.getByTestId('checkout-seat-3A')).toBeDisabled();
    await user.click(screen.getByTestId('checkout-seat-7A'));
    expect(onToggleSeat).toHaveBeenCalledWith('7A');
  });
});

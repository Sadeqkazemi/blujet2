import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SeatMapCell } from '../../../types/public-site';
import ExtrasStep from './ExtrasStep';
import { defaultExtras } from './checkout-types';

const SEATS: SeatMapCell[] = [
  { seatCode: '3A', row: 3, cabin: 'BUSINESS', status: 'FREE' },
  { seatCode: '3B', row: 3, cabin: 'BUSINESS', status: 'FREE' },
  { seatCode: '3C', row: 3, cabin: 'BUSINESS', status: 'TAKEN' },
  { seatCode: '3D', row: 3, cabin: 'BUSINESS', status: 'FREE' },
  { seatCode: '7A', row: 7, cabin: 'ECONOMY', status: 'FREE' },
  { seatCode: '7B', row: 7, cabin: 'ECONOMY', status: 'FREE' },
  { seatCode: '7C', row: 7, cabin: 'ECONOMY', status: 'FREE' },
  { seatCode: '7D', row: 7, cabin: 'ECONOMY', status: 'TAKEN' },
  { seatCode: '7E', row: 7, cabin: 'ECONOMY', status: 'FREE' },
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
        aircraftType="MD-88"
      />,
    );

    expect(screen.getByText('خدمات جانبی سفر')).toBeInTheDocument();
    expect(
      screen.getByText('خدماتی که می‌خواهید انتخاب کنید — هزینه به مجموع شما اضافه می‌شود'),
    ).toBeInTheDocument();
    expect(screen.getByText('بار اضافه (۱۰ کیلوگرم)')).toBeInTheDocument();
    expect(screen.getByText('علاوه بر مجاز ۲۰ کیلوگرمی')).toBeInTheDocument();
    expect(screen.getByText('غذای گرم داخل پرواز')).toBeInTheDocument();
    expect(screen.getByText('بیمه مسافرتی')).toBeInTheDocument();
    expect(screen.getByText('خدمات CIP فرودگاهی')).toBeInTheDocument();
    expect(screen.getByText('پذیرش و گیت اختصاصی')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-extra-baggage')).toHaveTextContent('۴۵۰٬۰۰۰');
    expect(screen.getByTestId('checkout-extra-meal')).toHaveTextContent('۲۸۰٬۰۰۰');
    expect(screen.getByTestId('checkout-extra-insurance')).toHaveTextContent('۱۲۰٬۰۰۰');
    expect(screen.getByTestId('checkout-extra-cip')).toHaveTextContent('۹۰۰٬۰۰۰');
  });

  it('shows optional seat caption, Persian legend and business lock hint', () => {
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
        aircraftType="MD-88"
      />,
    );

    expect(screen.getByTestId('checkout-seat-toggle')).toHaveTextContent(
      'انتخاب صندلی (اختیاری) — MD-88',
    );
    expect(screen.getByText(/انتخاب صندلی بیزنس نیازمند حداقل/)).toBeInTheDocument();
    expect(screen.getByText('بیزنس')).toBeInTheDocument();
    expect(screen.getByText('موجود')).toBeInTheDocument();
    expect(screen.getByText('رزرو شده')).toBeInTheDocument();
    expect(screen.getByText(/مجموع صندلی‌های فروخته‌شده/)).toBeInTheDocument();
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
        aircraftType="MD-88"
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
        aircraftType="MD-88"
      />,
    );

    expect(screen.getByTestId('checkout-seat-3A')).toBeDisabled();
    await user.click(screen.getByTestId('checkout-seat-7A'));
    expect(onToggleSeat).toHaveBeenCalledWith('7A');
  });
});

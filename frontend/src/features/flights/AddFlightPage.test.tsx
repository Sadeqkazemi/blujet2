import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AddFlightPage from './AddFlightPage';
import * as flightsApi from '../../api/flights';
import * as pricingApi from '../../api/pricing';

describe('AddFlightPage', () => {
  beforeEach(() => {
    vi.spyOn(flightsApi, 'fetchAirports').mockResolvedValue([
      { code: 'THR', cityFa: 'تهران', tz: 'Asia/Tehran' },
      { code: 'DXB', cityFa: 'دبی', tz: 'Asia/Dubai' },
    ]);
    vi.spyOn(flightsApi, 'fetchAircraftTypes').mockResolvedValue([
      { aircraftType: 'Airbus A320', capacity: 180 },
    ]);
  });

  it('renders the three design sections and empty fare state', async () => {
    render(<AddFlightPage onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(await screen.findByTestId('add-flight-page')).toBeInTheDocument();
    expect(screen.getByText('افزودن پرواز جدید')).toBeInTheDocument();
    expect(screen.getByText('مشخصات پرواز')).toBeInTheDocument();
    expect(screen.getByText('کلاس‌های نرخی پرواز')).toBeInTheDocument();
    expect(screen.getByText('قیمت‌گذاری')).toBeInTheDocument();
    expect(screen.getByText('هنوز کلاس نرخی برای این پرواز تعریف نشده است.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'ثبت پرواز و ارسال قیمت برای تأیید مدیر عامل' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'پیشنهاد قیمت هوش مصنوعی' })).toBeInTheDocument();
  });

  it('submits create + proposal to the CEO path', async () => {
    const onSuccess = vi.fn();
    vi.spyOn(flightsApi, 'createFlight').mockResolvedValue({
      id: 'inst-1',
      flightNo: 'EP-905',
      originCode: 'THR',
      destCode: 'DXB',
      departureAt: new Date(Date.now() + 86400000).toISOString(),
      capacity: 180,
      charterSeats: 40,
      sold: 0,
      basePriceIrr: '68000000',
      derivedStatus: 'ACTIVE',
    });
    vi.spyOn(pricingApi, 'upsertProposal').mockResolvedValue({} as never);

    render(<AddFlightPage onClose={vi.fn()} onSuccess={onSuccess} />);
    await screen.findByTestId('add-flight-page');
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/شماره پرواز/), 'EP-905');
    await user.click(screen.getByText('انتخاب شهر مبدأ'));
    await user.click(await screen.findByText('تهران'));
    await user.click(screen.getByText('انتخاب شهر مقصد'));
    await user.click(await screen.findByText('دبی'));
    await user.type(screen.getByLabelText(/تاریخ پرواز/), '1405/05/20');
    await user.type(screen.getByLabelText(/ساعت پرواز/), '08:30');
    await user.type(screen.getByLabelText(/تعداد صندلی موجود/), '180');
    await user.type(screen.getByLabelText(/تعهد چارتری/), '40');
    await user.type(screen.getByLabelText(/قیمت پایهٔ شرکت/), '6800000');
    await user.type(screen.getByLabelText(/نرخ پیشنهادی نهایی/), '7200000');

    await user.click(
      screen.getByRole('button', { name: 'ثبت پرواز و ارسال قیمت برای تأیید مدیر عامل' }),
    );

    await waitFor(() =>
      expect(flightsApi.createFlight).toHaveBeenCalledWith(
        expect.objectContaining({
          originCode: 'THR',
          destCode: 'DXB',
          flightNo: 'EP-905',
          capacity: 180,
          charterSeats: 40,
          aircraftType: 'Airbus A320',
        }),
      ),
    );
    await waitFor(() =>
      expect(pricingApi.upsertProposal).toHaveBeenCalledWith(
        'inst-1',
        expect.objectContaining({ proposedPriceIrr: 72_000_000 }),
      ),
    );
    expect(onSuccess).toHaveBeenCalled();
  });
});

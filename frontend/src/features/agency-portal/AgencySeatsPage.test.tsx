import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgencySeatsPage from './AgencySeatsPage';
import * as portalApi from '../../api/agency-portal';
import * as publicApi from '../../api/publicSite';
import * as useLocaleModule from '../../hooks/useLocale';
import type { AgencyAllotmentRow } from '../../types/agency-portal';

const ROWS: AgencyAllotmentRow[] = [
  {
    id: 'al1',
    flightInstanceId: 'fi1',
    route: 'تهران → دبی',
    flightNo: 'BJ-100',
    departureAt: '2026-08-01T05:00:00.000Z',
    aircraftType: 'Airbus A320',
    seatsAllocated: 20,
    seatsUsed: 12,
    type: 'HARD',
    releaseAt: null,
    contractPriceIrr: null,
    active: true,
  },
];

function mockLocale(locale: 'fa' | 'en' | 'ar') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AgencySeatsPage', () => {
  it('renders real per-flight allotment cards with allocated/sold/remaining counts', async () => {
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue(ROWS);
    render(<AgencySeatsPage />);

    expect(await screen.findByTestId('alloc-card')).toBeInTheDocument();
    expect(screen.getByText('تخصیص‌یافته')).toBeInTheDocument();
    expect(screen.getByText('فعال')).toBeInTheDocument();
    expect(screen.getByText('۸')).toBeInTheDocument();
  });

  it('shows the empty state when the agency has no allotments', async () => {
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue([]);
    render(<AgencySeatsPage />);

    expect(await screen.findByText('هنوز سهمیه‌ای برای آژانس شما ثبت نشده است.')).toBeInTheDocument();
  });

  it('renders translated info banner and labels in English', async () => {
    mockLocale('en');
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue(ROWS);
    render(<AgencySeatsPage />);

    expect(await screen.findByText('Allocated')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(/available for you to sell/)).toBeInTheDocument();
  });

  it('renders translated labels in Arabic', async () => {
    mockLocale('ar');
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue(ROWS);
    render(<AgencySeatsPage />);

    expect(await screen.findByText('مخصَّص')).toBeInTheDocument();
    expect(screen.getByText('نشط')).toBeInTheDocument();
  });

  it('submits a real ticket sale from a free seat and refreshes allotments', async () => {
    const user = userEvent.setup();
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue(ROWS);
    vi.spyOn(publicApi, 'fetchSeatMap').mockResolvedValue({
      flightInstanceId: 'fi1',
      seats: [{ seatCode: '4A', row: 4, cabin: 'ECONOMY', status: 'FREE' }],
    });
    const create = vi.spyOn(portalApi, 'createAllotmentBooking').mockResolvedValue({
      id: 'b1',
      pnr: 'BJ123ABC',
      status: 'TICKETED',
      cabin: 'ECONOMY',
      priceIrr: '10000000',
      holdExpiresAt: null,
      flightInstanceId: 'fi1',
      flightNo: 'BJ-100',
      originCode: 'THR',
      destCode: 'DXB',
      departureAt: '2026-08-01T05:00:00.000Z',
      arrivalAt: '2026-08-01T07:00:00.000Z',
      isPriceLocked: false,
      passengers: [{ fullName: 'نگار رضایی', seatCode: '4A' }],
    });
    render(<AgencySeatsPage />);

    await user.click(await screen.findByRole('button', { name: 'ثبت فروش' }));
    await user.type(screen.getByLabelText('نام و نام خانوادگی مسافر'), 'نگار رضایی');
    await user.selectOptions(screen.getByLabelText('صندلی'), '4A');
    await user.click(screen.getByRole('button', { name: 'صدور قطعی بلیت' }));

    expect(await screen.findByText(/BJ123ABC/)).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith(
      'al1',
      expect.objectContaining({
        cabin: 'ECONOMY',
        passengers: [expect.objectContaining({ fullName: 'نگار رضایی', seatCode: '4A' })],
      }),
      expect.any(String),
    );
  });
});

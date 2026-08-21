import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgencySeatsPage from './AgencySeatsPage';
import * as portalApi from '../../api/agency-portal';
import * as publicApi from '../../api/publicSite';
import * as useLocaleModule from '../../hooks/useLocale';
import type { AgencyAllotmentRow, AgencySeatRequestOption } from '../../types/agency-portal';

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

beforeEach(() => {
  vi.spyOn(portalApi, 'fetchSeatRequestOptions').mockResolvedValue([]);
  vi.spyOn(portalApi, 'fetchMySeatRequests').mockResolvedValue([]);
});

describe('AgencySeatsPage', () => {
  it('loads commercial routes and sends the selected seat request to the commercial manager', async () => {
    const user = userEvent.setup();
    const option: AgencySeatRequestOption = {
      flightInstanceId: 'fi-request-1',
      flightNo: 'BJ-210',
      originCode: 'THR',
      destCode: 'DXB',
      departureAt: '2026-09-01T05:00:00.000Z',
      aircraftType: 'Airbus A320',
      capacity: 180,
      agencyAllocated: 30,
      ownAllocated: 10,
      availableToRequest: 150,
      pricePerSeatIrr: '30000000',
      definitionStatus: 'DRAFT',
    };
    vi.mocked(portalApi.fetchSeatRequestOptions).mockResolvedValue([option]);
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue([]);
    const request = vi.spyOn(portalApi, 'requestAgencySeats').mockResolvedValue({
      id: 'request-1',
      status: 'SUBMITTED',
      recipientCount: 1,
      flightInstanceId: option.flightInstanceId,
      seats: 12,
      preferredWeekdays: [],
      termMonths: 3,
    });
    render(<AgencySeatsPage />);

    await user.selectOptions(await screen.findByTestId('agency-request-origin'), 'THR');
    await user.selectOptions(screen.getByTestId('agency-request-destination'), 'DXB');
    expect(await screen.findByTestId('agency-request-flight-detail')).toBeInTheDocument();
    const seats = screen.getByTestId('agency-request-seat-count');
    await user.click(seats);
    await user.keyboard('{Control>}a{/Control}12');
    await user.click(screen.getByTestId('agency-submit-seat-request'));

    expect(request).toHaveBeenCalledWith({
      flightInstanceId: option.flightInstanceId,
      seats: 12,
      preferredWeekdays: [],
      termMonths: 3,
    });
    expect(await screen.findByText('درخواست صندلی با موفقیت برای مدیر بازرگانی ارسال شد.')).toBeInTheDocument();
  });

  it('keeps commercial route options usable when allotment history fails to load', async () => {
    const option: AgencySeatRequestOption = {
      flightInstanceId: 'fi-request-independent',
      flightNo: 'BJ-310',
      originCode: 'THR',
      destCode: 'MHD',
      departureAt: '2026-09-02T05:00:00.000Z',
      aircraftType: 'Airbus A320',
      capacity: 180,
      agencyAllocated: 0,
      ownAllocated: 0,
      availableToRequest: 180,
      pricePerSeatIrr: '30000000',
      definitionStatus: 'PUBLISHED',
    };
    vi.spyOn(portalApi, 'fetchAllotments').mockRejectedValue(new Error('allotments unavailable'));
    vi.mocked(portalApi.fetchSeatRequestOptions).mockResolvedValue([option]);

    render(<AgencySeatsPage />);

    expect(await screen.findByRole('option', { name: /تهران/ })).toBeInTheDocument();
    expect(screen.getByTestId('agency-request-origin')).not.toBeDisabled();
  });

  it('renders real per-flight allotment cards with allocated/sold/remaining counts', async () => {
    const user = userEvent.setup();
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue(ROWS);
    render(<AgencySeatsPage />);

    await user.click(await screen.findByRole('button', { name: /پروازهای فعال/ }));
    expect(await screen.findByTestId('alloc-card')).toBeInTheDocument();
    expect(screen.getByText('تخصیص‌یافته')).toBeInTheDocument();
    expect(screen.getByText('فعال')).toBeInTheDocument();
    expect(screen.getByText('۸')).toBeInTheDocument();
  });

  it('shows the empty state when the agency has no allotments', async () => {
    const user = userEvent.setup();
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue([]);
    render(<AgencySeatsPage />);

    await user.click(await screen.findByRole('button', { name: /پروازهای فعال/ }));
    expect(await screen.findByText('هنوز سهمیه‌ای برای آژانس شما ثبت نشده است.')).toBeInTheDocument();
  });

  it('renders translated info banner and labels in English', async () => {
    const user = userEvent.setup();
    mockLocale('en');
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue(ROWS);
    render(<AgencySeatsPage />);

    await user.click(await screen.findByRole('button', { name: /Active flights/ }));
    expect(await screen.findByText('Allocated')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText(/available for you to sell/)).toBeInTheDocument();
  });

  it('renders translated labels in Arabic', async () => {
    const user = userEvent.setup();
    mockLocale('ar');
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue(ROWS);
    render(<AgencySeatsPage />);

    await user.click(await screen.findByRole('button', { name: /الرحلات النشطة/ }));
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

    await user.click(await screen.findByRole('button', { name: /پروازهای فعال/ }));
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

  it('can pick COMFORT cabin and submit a COMFORT seat sale', async () => {
    const user = userEvent.setup();
    vi.spyOn(portalApi, 'fetchAllotments').mockResolvedValue(ROWS);
    vi.spyOn(publicApi, 'fetchSeatMap').mockResolvedValue({
      flightInstanceId: 'fi1',
      seats: [{ seatCode: '12A', row: 12, cabin: 'COMFORT', status: 'FREE' }],
    });
    const create = vi.spyOn(portalApi, 'createAllotmentBooking').mockResolvedValue({
      id: 'b2',
      pnr: 'BJ456DEF',
      status: 'TICKETED',
      cabin: 'COMFORT',
      priceIrr: '12000000',
      holdExpiresAt: null,
      flightInstanceId: 'fi1',
      flightNo: 'BJ-100',
      originCode: 'THR',
      destCode: 'DXB',
      departureAt: '2026-08-01T05:00:00.000Z',
      arrivalAt: '2026-08-01T07:00:00.000Z',
      isPriceLocked: false,
      passengers: [{ fullName: 'نگار رضایی', seatCode: '12A' }],
    });
    render(<AgencySeatsPage />);

    await user.click(await screen.findByRole('button', { name: /پروازهای فعال/ }));
    await user.click(await screen.findByRole('button', { name: 'ثبت فروش' }));
    await user.selectOptions(screen.getByLabelText('کلاس پروازی'), 'COMFORT');
    await user.type(screen.getByLabelText('نام و نام خانوادگی مسافر'), 'نگار رضایی');
    await user.selectOptions(screen.getByLabelText('صندلی'), '12A');
    await user.click(screen.getByRole('button', { name: 'صدور قطعی بلیت' }));

    expect(create).toHaveBeenCalledWith(
      'al1',
      expect.objectContaining({
        cabin: 'COMFORT',
        passengers: [expect.objectContaining({ fullName: 'نگار رضایی', seatCode: '12A' })],
      }),
      expect.any(String),
    );
  });
});

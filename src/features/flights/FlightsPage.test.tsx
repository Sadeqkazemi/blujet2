import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FlightsPage from './FlightsPage';
import * as flightsApi from '../../api/flights';
import * as pricingApi from '../../api/pricing';
import * as useAuthModule from '../../hooks/useAuth';
import { parseJalaliDateToIso } from '../../lib/jalali';
import type {
  AirportEntry,
  FlightsOverview,
  FlightDetail,
  FutureFlightRow,
} from '../../types/flights';
import type { Role } from '../../types/auth';

const AIRPORTS: AirportEntry[] = [
  { id: 'a1', code: 'THR', cityFa: 'تهران', tz: 'Asia/Tehran' },
  { id: 'a2', code: 'MHD', cityFa: 'مشهد', tz: 'Asia/Tehran' },
  { id: 'a3', code: 'DXB', cityFa: 'دبی', tz: 'Asia/Dubai' },
];

const FUTURE_ROW: FutureFlightRow = {
  id: 'fu1',
  flightNo: 'EP-840',
  originCode: 'THR',
  destCode: 'DXB',
  departureAt: '2026-08-10T08:30:00.000Z',
  capacity: 180,
  charterSeats: 60,
  sold: 0,
  basePriceIrr: null,
  agencySeatsAllocated: null,
  aiSuggestion: {
    priceIrr: 41_000_000,
    reason: 'با توجه به فصل تابستان، نرخ پیشنهادی هم‌تراز رقباست.',
    factors: ['فصل: اوج سفر'],
    season: 'تابستان',
    occasion: 'بدون مناسبت',
    confidence: 0.8,
    modelVersion: 'heuristic-v1.0.0',
    generatedAt: '2026-07-17T00:00:00.000Z',
  },
};

const OVERVIEW: FlightsOverview = {
  kpis: { activeCount: 1, soldSeats: 152, meanOccupancyPct: 84 },
  active: [
    {
      id: 'fi1',
      flightNo: 'EP-821',
      originCode: 'THR',
      destCode: 'DXB',
      departureAt: '2026-07-20T08:30:00.000Z',
      capacity: 180,
      charterSeats: 60,
      sold: 152,
      basePriceIrr: 38_000_000,
      derivedStatus: 'SELLING',
    },
    {
      id: 'fi2',
      flightNo: 'RV-431',
      originCode: 'THR',
      destCode: 'MHD',
      departureAt: '2026-07-21T06:20:00.000Z',
      capacity: 140,
      charterSeats: 0,
      sold: 0,
      basePriceIrr: 15_000_000,
      derivedStatus: 'CANCELLED',
    },
  ],
  completed: {
    rows: [
      {
        id: 'dn1',
        flightNo: 'EP-805',
        originCode: 'THR',
        destCode: 'DXB',
        departureAt: '2026-07-10T08:30:00.000Z',
        tickets: 3,
        basePriceIrr: 30_000_000,
        avgPriceIrr: 40_000_000,
        revenueIrr: 120_000_000,
        channelRevenueIrr: { SYSTEM: 80_000_000, CHARTER: 0, AGENCY: 40_000_000 },
        profitIrr: 30_000_000,
        lossIrr: 0,
      },
    ],
    kpis: {
      totalSalesIrr: 120_000_000,
      totalProfitIrr: 30_000_000,
      totalTickets: 3,
      flightCount: 1,
    },
  },
  future: [FUTURE_ROW],
};

const DETAIL: FlightDetail = {
  ...OVERVIEW.active[0],
  channels: [
    { channel: 'SYSTEM', seats: 80, revenueIrr: 3_040_000_000 },
    { channel: 'CHARTER', seats: 45, revenueIrr: 1_710_000_000 },
    { channel: 'AGENCY', seats: 27, revenueIrr: 1_026_000_000 },
  ],
  totalRevenueIrr: 5_776_000_000,
  occupancyPct: 84,
};

function mockRole(role: Role) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'authenticated',
    user: { id: 'me', fullName: 'کاربر تست', role },
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
}

function mockData(overview: FlightsOverview = OVERVIEW) {
  vi.spyOn(flightsApi, 'fetchFlightsOverview').mockResolvedValue(overview);
  vi.spyOn(flightsApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
}

describe('FlightsPage', () => {
  it('renders KPI cards and the active table with derived statuses, occupancy and toman prices', async () => {
    mockRole('SENIOR_MANAGER');
    mockData();
    render(<FlightsPage />);

    expect(await screen.findByText('مدیریت پروازها و موجودی')).toBeInTheDocument();
    expect(screen.getByText('پرواز فعال')).toBeInTheDocument();
    expect(screen.getByText('۱۵۲')).toBeInTheDocument(); // sold-seats KPI
    expect(screen.getByText('۸۴٪')).toBeInTheDocument();

    expect(screen.getByText('تهران ← دبی')).toBeInTheDocument();
    expect(screen.getByText('EP-821')).toBeInTheDocument();
    expect(screen.getByText('در حال فروش')).toBeInTheDocument();
    expect(screen.getByText('لغو شده')).toBeInTheDocument();
    // 38,000,000 rial → ۳٬۸۰۰٬۰۰۰ toman
    expect(screen.getByText('۳٬۸۰۰٬۰۰۰ تومان')).toBeInTheDocument();
  });

  it('add-flight modal: empty submit shows the design message; a full form converts Jalali+toman and calls the API', async () => {
    mockRole('SENIOR_MANAGER');
    mockData();
    const create = vi.spyOn(flightsApi, 'createFlight').mockResolvedValue({
      ...OVERVIEW.active[0],
      id: 'new1',
      derivedStatus: 'ACTIVE',
    });

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<FlightsPage />);

    await userEvent.click(await screen.findByRole('button', { name: '+ افزودن پرواز' }));
    const dialog = await screen.findByRole('dialog', { name: 'افزودن پرواز جدید' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'افزودن پرواز' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'لطفاً همه فیلدها را تکمیل کنید.',
    );
    expect(create).not.toHaveBeenCalled();

    await userEvent.selectOptions(within(dialog).getByLabelText('مبدأ'), 'THR');
    await userEvent.selectOptions(within(dialog).getByLabelText('مقصد'), 'MHD');
    await userEvent.type(within(dialog).getByLabelText('شماره پرواز'), 'ep-901');
    await userEvent.type(within(dialog).getByLabelText('تاریخ (جلالی)'), '1405/04/25');
    await userEvent.type(within(dialog).getByLabelText('ساعت'), '08:30');
    await userEvent.type(within(dialog).getByLabelText('ظرفیت (صندلی)'), '180');
    await userEvent.type(within(dialog).getByLabelText('قیمت بلیط (تومان)'), '3800000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'افزودن پرواز' }));

    const expectedDeparture = new Date(parseJalaliDateToIso('1405/04/25')!);
    expectedDeparture.setHours(8, 30, 0, 0);
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        originCode: 'THR',
        destCode: 'MHD',
        flightNo: 'EP-901',
        departureAt: expectedDeparture.toISOString(),
        capacity: 180,
        basePriceIrr: 38_000_000, // 3,800,000 toman → rial
      }),
    );
    expect(await screen.findByText('پرواز جدید «تهران ← مشهد» اضافه شد ✓')).toBeInTheDocument();
  });

  it('flight detail modal shows the real channel breakdown and total revenue', async () => {
    mockRole('SENIOR_MANAGER');
    mockData();
    vi.spyOn(flightsApi, 'fetchFlightDetail').mockResolvedValue(DETAIL);

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<FlightsPage />);

    await userEvent.click(await screen.findByText('تهران ← دبی'));
    const dialog = await screen.findByRole('dialog', { name: /EP-821/ });

    expect(within(dialog).getByText('تفکیک کانال فروش صندلی')).toBeInTheDocument();
    expect(within(dialog).getByText('فروش سیستمی')).toBeInTheDocument();
    expect(within(dialog).getByText(/۸۰ صندلی/)).toBeInTheDocument();
    expect(within(dialog).getByText('مجموع درآمد پرواز')).toBeInTheDocument();
    // 5,776,000,000 rial → ۵۷۷٬۶۰۰٬۰۰۰ toman
    expect(within(dialog).getByText('۵۷۷٬۶۰۰٬۰۰۰ تومان')).toBeInTheDocument();
  });

  it('future tab: AI panel renders; the plan modal pre-fills from AI and submits toman→rial + agency cap', async () => {
    mockRole('SENIOR_MANAGER');
    mockData();
    const planSpy = vi.spyOn(flightsApi, 'planFlight').mockResolvedValue({
      id: 'fu1',
      basePriceIrr: 41_000_000,
      agencySeatsAllocated: 50,
      directSeats: 70,
      proposalPending: false,
    });

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<FlightsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'پروازهای آینده' }));
    await userEvent.click(screen.getByRole('button', { name: /تهران ← دبی/ })); // expand card
    expect(screen.getByText('تحلیل هوش مصنوعی — چرا این قیمت؟')).toBeInTheDocument();
    expect(screen.getByText('تعیین نشده')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'نرخ‌گذاری' }));
    const dialog = await screen.findByRole('dialog', { name: /نرخ‌گذاری و تخصیص/ });

    await userEvent.click(within(dialog).getByRole('button', { name: 'استفاده از قیمت AI' }));
    // 41,000,000 rial → 4,100,000 toman in the input
    expect(within(dialog).getByLabelText('نرخ نهایی (تومان)')).toHaveValue('4100000');

    const agencyInput = within(dialog).getByLabelText(/تخصیص صندلی آژانس/);
    await userEvent.clear(agencyInput);
    await userEvent.type(agencyInput, '50');
    await userEvent.click(within(dialog).getByRole('button', { name: 'ثبت نرخ و تخصیص صندلی' }));

    await waitFor(() => expect(planSpy).toHaveBeenCalledWith('fu1', 41_000_000, 50));
    expect(await screen.findByText(/نرخ و تخصیص صندلی تهران ← دبی ثبت شد ✓/)).toBeInTheDocument();
  });

  it('AI analysis outage shows the graceful degradation message', async () => {
    mockRole('SENIOR_MANAGER');
    mockData();
    vi.spyOn(flightsApi, 'runFlightsAiAnalysis').mockResolvedValue({
      analyzed: 0,
      available: false,
    });

    const { default: userEvent } = await import('@testing-library/user-event');
    render(<FlightsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'پروازهای آینده' }));
    await userEvent.click(
      screen.getByRole('button', { name: '✦ تحلیل قیمت‌گذاری با هوش مصنوعی' }),
    );
    expect(
      await screen.findByText(
        'سرویس تحلیل هوش مصنوعی در دسترس نیست؛ نرخ‌گذاری دستی همچنان ممکن است.',
      ),
    ).toBeInTheDocument();
  });

  it('Commercial additionally gets the embedded Phase 6 pricing section', async () => {
    mockRole('COMMERCIAL_MANAGER');
    mockData();
    vi.spyOn(pricingApi, 'fetchCommercialPricing').mockResolvedValue({ flights: [] });

    render(<FlightsPage />);
    expect(
      await screen.findByText('تعیین قیمت پرواز و ارسال به مدیر عامل'),
    ).toBeInTheDocument();
  });

  it('Senior does NOT get the pricing section', async () => {
    mockRole('SENIOR_MANAGER');
    mockData();
    render(<FlightsPage />);
    await screen.findByText('مدیریت پروازها و موجودی');
    expect(screen.queryByText('تعیین قیمت پرواز و ارسال به مدیر عامل')).not.toBeInTheDocument();
  });
});

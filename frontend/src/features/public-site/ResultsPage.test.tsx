import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ResultsPage from './ResultsPage';
import * as publicSiteApi from '../../api/publicSite';
import * as useAuthModule from '../../hooks/useAuth';
import { mockAuthUser } from '../../test/mockAuthUser';
import * as useLocaleModule from '../../hooks/useLocale';
import * as useIsMobileModule from '../../hooks/useIsMobile';
import { ApiRequestError } from '../../api/envelope';
import type { PriceLock, SearchFlightResult, SeatMapResult } from '../../types/public-site';

const SEATMAP: SeatMapResult = {
  flightInstanceId: 'fi-1',
  seats: [
    { seatCode: '12A', row: 12, cabin: 'ECONOMY', status: 'FREE' },
    { seatCode: '12B', row: 12, cabin: 'ECONOMY', status: 'FREE' },
  ],
};

async function confirmDesktopBuyModal() {
  await screen.findByTestId('results-buy-modal');
  await userEvent.click(screen.getByTestId('results-buy-continue'));
}

function mockLocale(locale: 'fa' | 'en' | 'ar') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({
    locale,
    setLocale: vi.fn(),
  });
}

const AIRPORTS = [
  { id: 'a1', code: 'THR', cityFa: 'تهران', tz: 'Asia/Tehran' },
  { id: 'a2', code: 'MHD', cityFa: 'مشهد', tz: 'Asia/Tehran' },
];

const RESULT: SearchFlightResult = {
  flightInstanceId: 'fi-1',
  flightNo: 'BJ-100',
  aircraftType: 'Airbus A320',
  originCode: 'THR',
  destCode: 'MHD',
  departureAt: '2026-08-01T05:00:00.000Z',
  arrivalAt: '2026-08-01T06:30:00.000Z',
  publishStatus: 'PUBLISHED',
  cabins: [
    { cabin: 'ECONOMY', priceIrr: '380000000', seatsLeft: 10 },
    { cabin: 'BUSINESS', priceIrr: '680000000', seatsLeft: 0 },
  ],
};

const RESULT_WITH_COMFORT: SearchFlightResult = {
  ...RESULT,
  cabins: [
    { cabin: 'ECONOMY', priceIrr: '380000000', seatsLeft: 10 },
    { cabin: 'COMFORT', priceIrr: '480000000', seatsLeft: 5 },
    { cabin: 'BUSINESS', priceIrr: '680000000', seatsLeft: 2 },
  ],
};

function mockSearchApis() {
  vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
  vi.spyOn(publicSiteApi, 'fetchPriceCalendar').mockResolvedValue([
    {
      date: '2026-07-29',
      minPriceIrr: '40000000',
      dateLabelFa: '2026-07-29',
      isCenter: false,
    },
    {
      date: '2026-07-30',
      minPriceIrr: '0',
      dateLabelFa: '2026-07-30',
      isCenter: false,
    },
    {
      date: '2026-07-31',
      minPriceIrr: '35000000',
      dateLabelFa: '2026-07-31',
      isCenter: false,
    },
    {
      date: '2026-08-01',
      minPriceIrr: '38000000',
      dateLabelFa: '2026-08-01',
      isCenter: true,
    },
    {
      date: '2026-08-02',
      minPriceIrr: '42000000',
      dateLabelFa: '2026-08-02',
      isCenter: false,
    },
    {
      date: '2026-08-03',
      minPriceIrr: '39000000',
      dateLabelFa: '2026-08-03',
      isCenter: false,
    },
    {
      date: '2026-08-04',
      minPriceIrr: '41000000',
      dateLabelFa: '2026-08-04',
      isCenter: false,
    },
  ]);
  vi.spyOn(publicSiteApi, 'fetchSeatMap').mockResolvedValue(SEATMAP);
  vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({
    isMember: false,
    level: null,
    balance: 0,
  });
}

function renderPage(
  status: 'unauthenticated' | 'authenticated' = 'unauthenticated',
  search = 'origin=THR&dest=MHD&date=2026-08-01',
  isMobile = false,
) {
  vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(isMobile);
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status,
    user:
      status === 'authenticated'
        ? mockAuthUser({ id: 'u1', fullName: 'کاربر تست', role: 'USER' })
        : null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
    requestOtp: vi.fn().mockResolvedValue('challenge-1'),
    verifyOtp: vi.fn().mockResolvedValue(
      mockAuthUser({ id: 'u1', fullName: 'کاربر تست', role: 'USER' }),
    ),
  });
  return render(
    <MemoryRouter initialEntries={[`/results?${search}`]}>
      <Routes>
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/signin" element={<div>صفحه ورود</div>} />
        <Route path="/checkout/new" element={<div data-testid="checkout-page">checkout</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function expandFirstCard(locale: 'fa' | 'en' | 'ar' = 'fa') {
  const label =
    locale === 'en'
      ? /Details & book/i
      : locale === 'ar'
        ? /التفاصيل والحجز/i
        : /جزئیات و رزرو/;
  await userEvent.click(screen.getByRole('button', { name: label }));
}

describe('ResultsPage', () => {
  it('renders the price calendar and updates the search date on day select', async () => {
    mockLocale('fa');
    mockSearchApis();
    const search = vi
      .spyOn(publicSiteApi, 'searchFlights')
      .mockResolvedValue([RESULT]);
    renderPage();

    expect(
      await screen.findByTestId('price-calendar-strip'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('price-calendar-day-2026-08-01')).toHaveAttribute(
      'data-selected',
      'true',
    );
    expect(screen.getByTestId('price-calendar-day-2026-07-30')).toHaveAttribute(
      'data-empty',
      'true',
    );

    await userEvent.click(screen.getByTestId('price-calendar-day-2026-08-02'));
    await waitFor(() => {
      expect(search).toHaveBeenCalledWith('THR', 'MHD', '2026-08-02');
    });
  });

  it('does not render or request the price calendar on mobile results', async () => {
    mockLocale('fa');
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    vi.clearAllMocks();
    renderPage('unauthenticated', 'origin=THR&dest=MHD&date=2026-08-01', true);

    expect(await screen.findByTestId('result-card')).toBeInTheDocument();
    expect(screen.queryByTestId('price-calendar')).not.toBeInTheDocument();
    expect(publicSiteApi.fetchPriceCalendar).not.toHaveBeenCalled();
  });

  it('renders flight cards with per-cabin price and seatsLeft', async () => {
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    renderPage();

    expect(await screen.findByTestId('result-card')).toBeInTheDocument();
    await expandFirstCard();
    expect(screen.getByText('BJ-100')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'خرید بلیط' }),
    ).toBeInTheDocument();
  });

  it('shows origin and destination city names in the search summary', async () => {
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    renderPage();

    expect(await screen.findByTestId('result-card')).toBeInTheDocument();
    expect(screen.getByText('تهران (THR)')).toBeInTheDocument();
    expect(screen.getByText('مشهد (MHD)')).toBeInTheDocument();
  });

  it('disables buying when the primary cabin is sold out', async () => {
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([
      {
        ...RESULT,
        cabins: [{ cabin: 'ECONOMY', priceIrr: '380000000', seatsLeft: 0 }],
      },
    ]);
    renderPage();
    await screen.findByTestId('result-card');
    expect(screen.getByRole('button', { name: 'پیشنهاد بلوجت' })).toBeInTheDocument();
    await expandFirstCard();

    expect(screen.getByRole('button', { name: 'خرید بلیط' })).toBeDisabled();
  });

  it('shows empty state when search returns no flights on an unsupported route', async () => {
    mockSearchApis();
    const spy = vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([]);
    renderPage('unauthenticated', 'origin=THR&dest=DXB&date=2026-08-01');

    expect(await screen.findByTestId('empty-results')).toBeInTheDocument();
    expect(screen.getByText('پروازی یافت نشد')).toBeInTheDocument();
    expect(screen.queryByTestId('result-card')).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith('THR', 'DXB', '2026-08-01');
  });

  it('shows search error banner on search failure', async () => {
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockRejectedValue(
      new Error('429'),
    );
    renderPage();

    expect(await screen.findByTestId('search-error')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-result-card')).not.toBeInTheDocument();
  });

  it('shows empty state for THR→MHD when the API returns no inventory (no demo flights)', async () => {
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([]);
    renderPage();
    expect(await screen.findByTestId('empty-results')).toBeInTheDocument();
    expect(screen.queryByTestId('result-card')).not.toBeInTheDocument();
  });

  it('shows loading state while the search request is still pending', async () => {
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(publicSiteApi, 'searchFlights').mockReturnValue(
      new Promise(() => {}),
    );
    renderPage();
    expect(await screen.findByText('در حال جستجو…')).toBeInTheDocument();
    expect(screen.queryByTestId('result-card')).not.toBeInTheDocument();
  });

  it('shows passenger mix and cabin from the search URL in the summary', async () => {
    mockLocale('fa');
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    renderPage(
      'unauthenticated',
      'origin=THR&dest=MHD&date=2026-08-01&adults=2&children=1&infants=1&cabin=ECONOMY',
    );
    expect(
      await screen.findByTestId('results-pax-cabin-summary'),
    ).toHaveTextContent('۴ مسافر · اکونومی');
  });

  it('scales flight card price by the passenger mix from the URL', async () => {
    mockLocale('fa');
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    // 380_000_000 IRR adult unit → 38_000_000 تومان × 2 adults = 76_000_000
    renderPage(
      'unauthenticated',
      'origin=THR&dest=MHD&date=2026-08-01&adults=2&children=0&infants=0',
    );
    await screen.findByTestId('result-card');
    expect(screen.getAllByText(/۷۶٬۰۰۰٬۰۰۰/).length).toBeGreaterThan(0);
  });

  it('opens edit-search modal with trip type, airport pickers, and inline calendar', async () => {
    mockLocale('fa');
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    renderPage();
    await screen.findByTestId('result-card');

    await userEvent.click(screen.getByRole('button', { name: /ویرایش جستجو/ }));

    expect(screen.getByText('یک‌طرفه')).toBeInTheDocument();
    expect(screen.getByText('رفت و برگشت')).toBeInTheDocument();
    expect(screen.getByTestId('edit-search-origin')).toBeInTheDocument();
    expect(screen.getByTestId('edit-search-dest')).toBeInTheDocument();
    expect(screen.getByTestId('edit-search-date')).toBeInTheDocument();
    expect(screen.getByTestId('edit-search-pax')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-search-pax-adults-inc')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('edit-search-date'));
    expect(screen.getByTestId('edit-search-calendar')).toBeInTheDocument();
  });

  it('applies passenger mix from edit search into the results summary', async () => {
    mockLocale('fa');
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    renderPage(
      'unauthenticated',
      'origin=THR&dest=MHD&date=2026-08-01&adults=1&children=0&infants=0',
    );
    await screen.findByTestId('result-card');
    expect(screen.getByTestId('results-pax-cabin-summary')).toHaveTextContent(
      '۱ مسافر · اکونومی',
    );

    await userEvent.click(screen.getByRole('button', { name: /ویرایش جستجو/ }));
    await userEvent.click(screen.getByTestId('edit-search-pax'));
    await userEvent.click(screen.getByTestId('edit-search-pax-adults-inc'));
    await userEvent.click(screen.getByTestId('edit-search-pax-children-inc'));
    await userEvent.click(screen.getByRole('button', { name: 'جستجوی پرواز' }));

    expect(
      await screen.findByTestId('results-pax-cabin-summary'),
    ).toHaveTextContent('۳ مسافر · اکونومی');
  });

  it('calls advisory API and shows buy recommendation', async () => {
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    const advisorySpy = vi
      .spyOn(publicSiteApi, 'fetchSearchAdvisory')
      .mockResolvedValue({
        available: true,
        recommendation: 'buy',
        reasonFa:
          'قیمت امروز در محدوده مناسب است — برای سفر قطعی همین حالا بخرید.',
        predictedPriceIrr: '380000000',
      });
    renderPage();
    await screen.findByTestId('result-card');

    await userEvent.click(screen.getByTestId('ai-ask'));

    expect(advisorySpy).toHaveBeenCalledWith('THR', 'MHD', '2026-08-01');
    expect(await screen.findByTestId('ai-result')).toHaveTextContent(
      'همین حالا بخرید',
    );
  });

  it('navigates guests to checkout without a seat modal on results', async () => {
    mockLocale('fa');
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    renderPage('unauthenticated');
    await screen.findByTestId('result-card');
    await expandFirstCard();

    await userEvent.click(screen.getByRole('button', { name: 'خرید بلیط' }));

    expect(await screen.findByTestId('checkout-page')).toBeInTheDocument();
    expect(screen.queryByTestId('results-buy-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('desktop-guest-otp-modal')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('blujet_checkout_draft')).toContain('fi-1');
  });

  it('navigates mobile guests straight to checkout when buying a ticket', async () => {
    mockLocale('fa');
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    renderPage(
      'unauthenticated',
      'origin=THR&dest=MHD&date=2026-08-01',
      true,
    );
    await screen.findByTestId('result-card');
    await userEvent.click(screen.getByTestId('mobile-expand-flight'));

    await userEvent.click(screen.getByRole('button', { name: /خرید بلیط/ }));

    expect(await screen.findByTestId('checkout-page')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-guest-otp-modal')).not.toBeInTheDocument();
  });

  it('flips the route airplane in Persian RTL results', async () => {
    mockLocale('fa');
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    renderPage();

    expect(await screen.findByTestId('route-airplane-icon')).toHaveStyle({
      transform: 'scaleX(-1)',
    });
  });

  it('dismisses the AI radar with its close button on mobile results', async () => {
    mockLocale('fa');
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    renderPage('unauthenticated', 'origin=THR&dest=MHD&date=2026-08-01', true);
    await screen.findByTestId('result-card');

    expect(screen.getByTestId('ai-radar')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'بستن رادار هوشمند قیمت' }));
    expect(screen.queryByTestId('ai-radar')).not.toBeInTheDocument();
  });

  describe('real قفل قیمت (price lock)', () => {
    it('redirects an unauthenticated visitor to /signin, remembering the search', async () => {
      mockSearchApis();
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
      renderPage('unauthenticated');
      await screen.findByTestId('result-card');
      await expandFirstCard();

      await userEvent.click(screen.getByTestId('real-lock-fi-1-ECONOMY'));

      expect(await screen.findByText('صفحه ورود')).toBeInTheDocument();
    });

    it('shows the club-membership notice for an authenticated non-gold customer, without calling the API', async () => {
      mockSearchApis();
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
      vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({
        isMember: false,
        level: null,
        balance: 0,
      });
      const createLock = vi.spyOn(publicSiteApi, 'createPriceLock');
      renderPage('authenticated');
      await screen.findByTestId('result-card');
      await expandFirstCard();

      await userEvent.click(screen.getByTestId('real-lock-fi-1-ECONOMY'));

      expect(await screen.findByTestId('real-lock-modal')).toHaveTextContent(
        'قفل قیمت تا ۷۲ ساعت مخصوص اعضای سطح طلایی و بالاتر باشگاه مشتریان است.',
      );
      expect(createLock).not.toHaveBeenCalled();
    });

    it('a gold-tier customer locking a real cabin sees the locked price, fee, and expiry', async () => {
      mockSearchApis();
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
      vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({
        isMember: true,
        level: 'GOLD',
        balance: 500,
      });
      const lock: PriceLock = {
        id: 'pl-1',
        flightInstanceId: 'fi-1',
        cabin: 'ECONOMY',
        lockedPriceIrr: '380000000',
        feeIrr: '1140000',
        status: 'ACTIVE',
        expiresAt: '2026-08-04T05:00:00.000Z',
        createdAt: '2026-08-01T00:00:00.000Z',
        bookingId: null,
        flight: {
          flightNo: 'BJ-100',
          originCode: 'THR',
          destCode: 'MHD',
          departureAt: '2026-08-01T05:00:00.000Z',
        },
      };
      const createLock = vi
        .spyOn(publicSiteApi, 'createPriceLock')
        .mockResolvedValue(lock);
      renderPage('authenticated');
      await screen.findByTestId('result-card');
      await expandFirstCard();

      await userEvent.click(screen.getByTestId('real-lock-fi-1-ECONOMY'));

      expect(await screen.findByText('قیمت شما قفل شد')).toBeInTheDocument();
      expect(createLock).toHaveBeenCalledWith('fi-1', 'ECONOMY');
    });

    it('shows the server error message when locking fails (e.g. an already-active lock)', async () => {
      mockSearchApis();
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
      vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({
        isMember: true,
        level: 'GOLD',
        balance: 500,
      });
      vi.spyOn(publicSiteApi, 'createPriceLock').mockRejectedValue(
        new ApiRequestError(
          'CONFLICT',
          'شما قبلاً برای این پرواز و کلاس، قیمت را قفل کرده‌اید.',
          409,
        ),
      );
      renderPage('authenticated');
      await screen.findByTestId('result-card');
      await expandFirstCard();

      await userEvent.click(screen.getByTestId('real-lock-fi-1-ECONOMY'));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'شما قبلاً برای این پرواز و کلاس، قیمت را قفل کرده‌اید.',
      );
    });
  });

  describe('save flight bookmark', () => {
    it('redirects an unauthenticated visitor to /signin when saving', async () => {
      mockSearchApis();
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
      renderPage('unauthenticated');
      await screen.findByTestId('result-card');
      await expandFirstCard();

      await userEvent.click(screen.getByTestId('real-save-fi-1-ECONOMY'));

      expect(await screen.findByText('صفحه ورود')).toBeInTheDocument();
    });

    it('calls saveFlight for an authenticated user and marks the row saved', async () => {
      mockSearchApis();
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
      vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({
        isMember: false,
        level: null,
        balance: 0,
      });
      vi.spyOn(publicSiteApi, 'fetchSavedFlights').mockResolvedValue([]);
      const save = vi.spyOn(publicSiteApi, 'saveFlight').mockResolvedValue({
        id: 'sf-new',
        flightInstanceId: 'fi-1',
        cabin: 'ECONOMY',
        flightNo: 'BJ-100',
        originCode: 'THR',
        destCode: 'MHD',
        originCityFa: 'تهران',
        destCityFa: 'مشهد',
        departureAt: RESULT.departureAt,
        arrivalAt: RESULT.arrivalAt,
        priceIrr: '380000000',
        bookable: true,
        createdAt: '2026-07-01T00:00:00.000Z',
      });
      renderPage('authenticated');
      await screen.findByTestId('result-card');
      await expandFirstCard();

      await userEvent.click(screen.getByTestId('real-save-fi-1-ECONOMY'));

      expect(save).toHaveBeenCalledWith('fi-1', 'ECONOMY');
      expect(
        await screen.findByTestId('real-save-fi-1-ECONOMY'),
      ).toHaveTextContent('ذخیره شد');
    });
  });

  it('renders translated result cards with Latin-digit toman prices in English', async () => {
    mockLocale('en');
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    renderPage();

    expect(await screen.findByTestId('result-card')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: /Details & book/i }),
    );
    expect(
      screen.getByRole('button', { name: 'Buy ticket' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/38,000,000/)[0]).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Edit search/ }),
    ).toBeInTheDocument();
  });

  it('shows empty state with translated strings in Arabic', async () => {
    mockLocale('ar');
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([]);
    renderPage('unauthenticated', 'origin=THR&dest=DXB&date=2026-08-01');

    expect(await screen.findByTestId('empty-results')).toBeInTheDocument();
    expect(screen.getByText('لم يتم العثور على رحلات')).toBeInTheDocument();
    expect(screen.getByText('رادار الأسعار الذكي')).toBeInTheDocument();
  });

  describe('COMFORT cabin', () => {
    it('allows selecting COMFORT and navigating to checkout with cabin COMFORT', async () => {
      mockLocale('fa');
      mockSearchApis();
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([
        RESULT_WITH_COMFORT,
      ]);
      vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(false);
      vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
        status: 'authenticated',
        user: mockAuthUser({ id: 'u1', fullName: 'کاربر تست', role: 'USER' }),
        requestLogin: vi.fn(),
        confirmTwoFactor: vi.fn(),
        agencyLogin: vi.fn(),
        signOut: vi.fn(),
      });

      render(
        <MemoryRouter
          initialEntries={['/results?origin=THR&dest=MHD&date=2026-08-01']}
        >
          <Routes>
            <Route path="/results" element={<ResultsPage />} />
            <Route
              path="/checkout/new"
              element={<div data-testid="checkout-page">checkout</div>}
            />
          </Routes>
        </MemoryRouter>,
      );

      await screen.findByTestId('result-card');
      await expandFirstCard();

      expect(screen.getByTestId('cabin-selector')).toBeInTheDocument();
      await userEvent.click(screen.getByTestId('cabin-option-COMFORT'));
      await userEvent.click(screen.getByRole('button', { name: 'خرید بلیط' }));
      await confirmDesktopBuyModal();

      expect(await screen.findByTestId('checkout-page')).toBeInTheDocument();
    });

    it('navigates guests to checkout without a seat modal or OTP on results', async () => {
      mockLocale('fa');
      mockSearchApis();
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([
        RESULT_WITH_COMFORT,
      ]);
      renderPage('unauthenticated');

      await screen.findByTestId('result-card');
      await expandFirstCard();
      await userEvent.click(screen.getByRole('button', { name: 'خرید بلیط' }));

      expect(await screen.findByTestId('checkout-page')).toBeInTheDocument();
      expect(screen.queryByTestId('results-buy-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('desktop-guest-otp-modal')).not.toBeInTheDocument();
    });

    it('calls createPriceLock with cabin COMFORT when COMFORT is selected', async () => {
      mockLocale('fa');
      mockSearchApis();
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([
        RESULT_WITH_COMFORT,
      ]);
      vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({
        isMember: true,
        level: 'GOLD',
        balance: 500,
      });
      const createLock = vi
        .spyOn(publicSiteApi, 'createPriceLock')
        .mockResolvedValue({
          id: 'pl-comfort',
          flightInstanceId: 'fi-1',
          cabin: 'COMFORT',
          lockedPriceIrr: '480000000',
          feeIrr: '1440000',
          status: 'ACTIVE',
          expiresAt: '2026-08-04T05:00:00.000Z',
          createdAt: '2026-08-01T00:00:00.000Z',
          bookingId: null,
          flight: {
            flightNo: 'BJ-100',
            originCode: 'THR',
            destCode: 'MHD',
            departureAt: '2026-08-01T05:00:00.000Z',
          },
        });
      renderPage('authenticated');
      await screen.findByTestId('result-card');
      await expandFirstCard();

      await userEvent.click(screen.getByTestId('cabin-option-COMFORT'));
      await userEvent.click(screen.getByTestId('real-lock-fi-1-COMFORT'));

      expect(createLock).toHaveBeenCalledWith('fi-1', 'COMFORT');
    });
  });
});

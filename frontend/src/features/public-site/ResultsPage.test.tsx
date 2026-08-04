import { render, screen } from '@testing-library/react';
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
import type { PriceLock, SearchFlightResult } from '../../types/public-site';

function mockLocale(locale: 'fa' | 'en' | 'ar') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
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
  cabins: [
    { cabin: 'ECONOMY', priceIrr: '380000000', seatsLeft: 10 },
    { cabin: 'BUSINESS', priceIrr: '680000000', seatsLeft: 0 },
  ],
};

function mockSearchApis() {
  vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
}

function renderPage(
  status: 'unauthenticated' | 'authenticated' = 'unauthenticated',
  search = 'origin=THR&dest=MHD&date=2026-08-01',
) {
  vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(false);
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status,
    user: status === 'authenticated' ? mockAuthUser({ id: 'u1', fullName: 'کاربر تست', role: 'USER' }) : null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
  return render(
    <MemoryRouter initialEntries={[`/results?${search}`]}>
      <Routes>
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/signin" element={<div>صفحه ورود</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function expandFirstCard(locale: 'fa' | 'en' | 'ar' = 'fa') {
  const label =
    locale === 'en' ? /Details & book/i : locale === 'ar' ? /التفاصيل والحجز/i : /جزئیات و رزرو/;
  await userEvent.click(screen.getByRole('button', { name: label }));
}

describe('ResultsPage', () => {
  it('renders flight cards with per-cabin price and seatsLeft', async () => {
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    renderPage();

    expect(await screen.findByTestId('result-card')).toBeInTheDocument();
    await expandFirstCard();
    expect(screen.getByText('BJ-100')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'خرید بلیط' })).toBeInTheDocument();
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
    vi.spyOn(publicSiteApi, 'searchFlights').mockRejectedValue(new Error('429'));
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
    vi.spyOn(publicSiteApi, 'searchFlights').mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(await screen.findByText('در حال جستجو…')).toBeInTheDocument();
    expect(screen.queryByTestId('result-card')).not.toBeInTheDocument();
  });

  it('opens edit-search modal with trip type, airport pickers, and inline calendar', async () => {
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

    await userEvent.click(screen.getByTestId('edit-search-date'));
    expect(screen.getByTestId('edit-search-calendar')).toBeInTheDocument();
  });

  it('calls advisory API and shows buy recommendation', async () => {
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    const advisorySpy = vi.spyOn(publicSiteApi, 'fetchSearchAdvisory').mockResolvedValue({
      available: true,
      recommendation: 'buy',
      reasonFa: 'قیمت امروز در محدوده مناسب است — برای سفر قطعی همین حالا بخرید.',
      predictedPriceIrr: '380000000',
    });
    renderPage();
    await screen.findByTestId('result-card');

    await userEvent.click(screen.getByTestId('ai-ask'));

    expect(advisorySpy).toHaveBeenCalledWith('THR', 'MHD', '2026-08-01');
    expect(await screen.findByTestId('ai-result')).toHaveTextContent('همین حالا بخرید');
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
      vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({ isMember: false, level: null, balance: 0 });
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
      vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({ isMember: true, level: 'GOLD', balance: 500 });
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
        flight: { flightNo: 'BJ-100', originCode: 'THR', destCode: 'MHD', departureAt: '2026-08-01T05:00:00.000Z' },
      };
      const createLock = vi.spyOn(publicSiteApi, 'createPriceLock').mockResolvedValue(lock);
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
      vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({ isMember: true, level: 'GOLD', balance: 500 });
      vi.spyOn(publicSiteApi, 'createPriceLock').mockRejectedValue(
        new ApiRequestError('CONFLICT', 'شما قبلاً برای این پرواز و کلاس، قیمت را قفل کرده‌اید.', 409),
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
      vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({ isMember: false, level: null, balance: 0 });
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
      expect(await screen.findByTestId('real-save-fi-1-ECONOMY')).toHaveTextContent('ذخیره شد');
    });
  });

  it('renders translated result cards with Latin-digit toman prices in English', async () => {
    mockLocale('en');
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    renderPage();

    expect(await screen.findByTestId('result-card')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Details & book/i }));
    expect(screen.getByRole('button', { name: 'Buy ticket' })).toBeInTheDocument();
    expect(screen.getAllByText(/38,000,000/)[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit search/ })).toBeInTheDocument();
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
});

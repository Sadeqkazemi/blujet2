import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ResultsPage from './ResultsPage';
import * as publicSiteApi from '../../api/publicSite';
import * as useAuthModule from '../../hooks/useAuth';
import { mockAuthUser } from '../../test/mockAuthUser';
import * as useLocaleModule from '../../hooks/useLocale';
import { ApiRequestError } from '../../api/envelope';
import type { Airport, PriceLock, SearchFlightResult } from '../../types/public-site';

function mockLocale(locale: 'fa' | 'en' | 'ar') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

const AIRPORTS: Airport[] = [
  { id: '1', code: 'THR', cityFa: 'تهران', tz: 'Asia/Tehran' },
  { id: '2', code: 'MHD', cityFa: 'مشهد', tz: 'Asia/Tehran' },
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

async function expandFirstCard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTestId('expand-fi-1'));
}

function renderPage(status: 'unauthenticated' | 'authenticated' = 'unauthenticated') {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status,
    user: status === 'authenticated' ? mockAuthUser({ id: 'u1', fullName: 'کاربر تست', role: 'USER' }) : null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
    refreshMe: vi.fn(),
  });
  return render(
    <MemoryRouter initialEntries={['/results?origin=THR&dest=MHD&date=2026-08-01']}>
      <Routes>
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/signin" element={<div>صفحه ورود</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ResultsPage', () => {
  it('renders collapsed flight cards and expands to show cabin actions', async () => {
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByTestId('result-card')).toBeInTheDocument();
    expect(screen.getByText('BJ-100')).toBeInTheDocument();
    expect(screen.queryByText('خرید بلیط')).not.toBeInTheDocument();

    await expandFirstCard(user);

    expect(screen.getByText('خرید بلیط')).toBeInTheDocument();
    expect(screen.getByText('اکونومی')).toBeInTheDocument();
    expect(screen.getByText('بیزینس')).toBeInTheDocument();
  });

  it('disables buying a sold-out cabin after expand', async () => {
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    const user = userEvent.setup();
    renderPage();
    await expandFirstCard(user);

    await user.click(screen.getByText('بیزینس'));
    expect(screen.getByText('خرید بلیط')).toBeDisabled();
  });

  it('shows skeleton while loading', async () => {
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockImplementation(
      () => new Promise(() => undefined),
    );
    renderPage();

    expect(await screen.findByTestId('results-skeleton')).toBeInTheDocument();
  });

  it('shows empty state when search returns no flights', async () => {
    mockSearchApis();
    const spy = vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([]);
    renderPage();

    expect(await screen.findByTestId('empty-results')).toBeInTheDocument();
    expect(screen.getByText('پروازی یافت نشد')).toBeInTheDocument();
    expect(screen.queryByTestId('result-card')).not.toBeInTheDocument();
    for (const call of spy.mock.calls) {
      expect(call).toEqual(['THR', 'MHD', '2026-08-01']);
    }
  });

  it('shows search error banner on search failure', async () => {
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockRejectedValue(new Error('429'));
    renderPage();

    expect(await screen.findByTestId('search-error')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-result-card')).not.toBeInTheDocument();
  });

  it('opens buy overlay when purchasing from expanded card', async () => {
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    const user = userEvent.setup();
    renderPage();
    await expandFirstCard(user);
    await user.click(screen.getByText('خرید بلیط'));
    expect(await screen.findByTestId('buy-overlay')).toBeInTheDocument();
    expect(screen.getByText('تکمیل خرید')).toBeInTheDocument();
  });

  it('calls advisory API and shows buy recommendation with probability', async () => {
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    const advisorySpy = vi.spyOn(publicSiteApi, 'fetchSearchAdvisory').mockResolvedValue({
      available: true,
      recommendation: 'buy',
      reasonFa: 'قیمت امروز در محدوده مناسب است — برای سفر قطعی همین حالا بخرید.',
      predictedPriceIrr: '380000000',
      priceIncreaseProbPct: 72,
      cheapestDayLabel: '۱۴ مرداد',
    });
    renderPage();
    await screen.findByTestId('result-card');

    await userEvent.click(screen.getByTestId('ai-ask'));

    expect(advisorySpy).toHaveBeenCalledWith('THR', 'MHD', '2026-08-01');
    expect(await screen.findByTestId('ai-result')).toHaveTextContent('پیشنهاد رادار');
    expect(screen.getByText(/احتمال افزایش قیمت/)).toBeInTheDocument();
  });

  describe('real قفل قیمت (price lock)', () => {
    it('redirects an unauthenticated visitor to /signin, remembering the search', async () => {
      mockSearchApis();
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
      const user = userEvent.setup();
      renderPage('unauthenticated');
      await expandFirstCard(user);

      await user.click(screen.getByTestId('real-lock-fi-1-ECONOMY'));

      expect(await screen.findByText('صفحه ورود')).toBeInTheDocument();
    });

    it('shows the club-membership notice for an authenticated non-gold customer, without calling the API', async () => {
      mockSearchApis();
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
      vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({ isMember: false, level: null, balance: 0 });
      const createLock = vi.spyOn(publicSiteApi, 'createPriceLock');
      const user = userEvent.setup();
      renderPage('authenticated');
      await expandFirstCard(user);

      await user.click(screen.getByTestId('real-lock-fi-1-ECONOMY'));

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
      const user = userEvent.setup();
      renderPage('authenticated');
      await expandFirstCard(user);

      await user.click(screen.getByTestId('real-lock-fi-1-ECONOMY'));

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
      const user = userEvent.setup();
      renderPage('authenticated');
      await expandFirstCard(user);

      await user.click(screen.getByTestId('real-lock-fi-1-ECONOMY'));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'شما قبلاً برای این پرواز و کلاس، قیمت را قفل کرده‌اید.',
      );
    });
  });

  describe('save flight bookmark', () => {
    it('redirects an unauthenticated visitor to /signin when saving', async () => {
      mockSearchApis();
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
      const user = userEvent.setup();
      renderPage('unauthenticated');
      await expandFirstCard(user);

      await user.click(screen.getByTestId('real-save-fi-1-ECONOMY'));

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
      const user = userEvent.setup();
      renderPage('authenticated');
      await expandFirstCard(user);

      await user.click(screen.getByTestId('real-save-fi-1-ECONOMY'));

      expect(save).toHaveBeenCalledWith('fi-1', 'ECONOMY');
      expect(await screen.findByTestId('real-save-fi-1-ECONOMY')).toHaveTextContent('ذخیره شد');
    });
  });

  it('renders translated result cards with Latin-digit toman prices in English', async () => {
    mockLocale('en');
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByTestId('result-card')).toBeInTheDocument();
    await expandFirstCard(user);
    expect(screen.getByText('Economy')).toBeInTheDocument();
    expect(screen.getByText('Business')).toBeInTheDocument();
    expect(screen.getByText('Buy ticket')).toBeInTheDocument();
    expect(screen.getAllByText(/38,000,000/)[0]).toBeInTheDocument();
    expect(screen.getByText('Change search')).toBeInTheDocument();
  });

  it('shows empty state with translated strings in Arabic', async () => {
    mockLocale('ar');
    mockSearchApis();
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([]);
    renderPage();

    expect(await screen.findByTestId('empty-results')).toBeInTheDocument();
    expect(screen.getByText('لم يتم العثور على رحلات')).toBeInTheDocument();
    expect(screen.getByText('رادار الأسعار الذكي')).toBeInTheDocument();
  });
});

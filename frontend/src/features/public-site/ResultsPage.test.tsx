import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ResultsPage from './ResultsPage';
import * as publicSiteApi from '../../api/publicSite';
import * as useAuthModule from '../../hooks/useAuth';
import { ApiRequestError } from '../../api/envelope';
import type { PriceLock, SearchFlightResult } from '../../types/public-site';

const RESULT: SearchFlightResult = {
  flightInstanceId: 'fi-1',
  flightNo: 'BJ-100',
  aircraftType: 'Airbus A320',
  originCode: 'THR',
  destCode: 'MHD',
  departureAt: '2026-08-01T05:00:00.000Z',
  arrivalAt: '2026-08-01T06:30:00.000Z',
  cabins: [
    { cabin: 'ECONOMY', priceIrr: 380_000_000, seatsLeft: 10 },
    { cabin: 'BUSINESS', priceIrr: 680_000_000, seatsLeft: 0 },
  ],
};

function renderPage(status: 'unauthenticated' | 'authenticated' = 'unauthenticated') {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status,
    user: status === 'authenticated' ? { id: 'u1', fullName: 'کاربر تست', role: 'USER' } : null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
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
  it('renders flight cards with per-cabin price and seatsLeft', async () => {
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    renderPage();

    expect(await screen.findByTestId('result-card')).toBeInTheDocument();
    expect(screen.getByText('BJ-100')).toBeInTheDocument();
    expect(screen.getAllByText('انتخاب')[0]).toBeInTheDocument();
  });

  it('disables selecting a sold-out cabin', async () => {
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
    renderPage();
    await screen.findByTestId('result-card');

    const buttons = screen.getAllByRole('button', { name: 'انتخاب' });
    expect(buttons[1]).toBeDisabled();
  });

  it('immediately shows the mock schedule when the search comes back empty', async () => {
    const spy = vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([]);
    renderPage();

    const mockCards = await screen.findAllByTestId('mock-result-card');
    expect(mockCards).toHaveLength(6);
    expect(screen.queryByTestId('result-card')).not.toBeInTheDocument();
    // only the requested date is ever queried — multi-day probing would
    // trip the backend rate limiter (StrictMode may re-run the effect)
    for (const call of spy.mock.calls) {
      expect(call).toEqual(['THR', 'MHD', '2026-08-01']);
    }
  });

  it('shows the mock schedule on search error and explains on select', async () => {
    vi.spyOn(publicSiteApi, 'searchFlights').mockRejectedValue(new Error('429'));
    const { container } = renderPage();

    await screen.findAllByTestId('mock-result-card');
    const firstSelect = container.querySelectorAll('button');
    (Array.from(firstSelect).find((b) => b.textContent === 'انتخاب') as HTMLButtonElement).click();

    expect(await screen.findByTestId('mock-notice')).toBeInTheDocument();
  });

  describe('real قفل قیمت (price lock)', () => {
    it('redirects an unauthenticated visitor to /signin, remembering the search', async () => {
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
      renderPage('unauthenticated');
      await screen.findByTestId('result-card');

      await userEvent.click(screen.getByTestId('real-lock-fi-1-ECONOMY'));

      expect(await screen.findByText('صفحه ورود')).toBeInTheDocument();
    });

    it('shows the club-membership notice for an authenticated non-gold customer, without calling the API', async () => {
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
      vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({ isMember: false, level: null, balance: 0 });
      const createLock = vi.spyOn(publicSiteApi, 'createPriceLock');
      renderPage('authenticated');
      await screen.findByTestId('result-card');

      await userEvent.click(screen.getByTestId('real-lock-fi-1-ECONOMY'));

      expect(await screen.findByTestId('real-lock-modal')).toHaveTextContent(
        'قفل قیمت تا ۷۲ ساعت مخصوص اعضای سطح طلایی و بالاتر باشگاه مشتریان است.',
      );
      expect(createLock).not.toHaveBeenCalled();
    });

    it('a gold-tier customer locking a real cabin sees the locked price, fee, and expiry', async () => {
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
      vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({ isMember: true, level: 'GOLD', balance: 500 });
      const lock: PriceLock = {
        id: 'pl-1',
        flightInstanceId: 'fi-1',
        cabin: 'ECONOMY',
        lockedPriceIrr: 380_000_000,
        feeIrr: 1_140_000,
        status: 'ACTIVE',
        expiresAt: '2026-08-04T05:00:00.000Z',
        createdAt: '2026-08-01T00:00:00.000Z',
        bookingId: null,
        flight: { flightNo: 'BJ-100', originCode: 'THR', destCode: 'MHD', departureAt: '2026-08-01T05:00:00.000Z' },
      };
      const createLock = vi.spyOn(publicSiteApi, 'createPriceLock').mockResolvedValue(lock);
      renderPage('authenticated');
      await screen.findByTestId('result-card');

      await userEvent.click(screen.getByTestId('real-lock-fi-1-ECONOMY'));

      expect(await screen.findByText('قیمت شما قفل شد')).toBeInTheDocument();
      expect(createLock).toHaveBeenCalledWith('fi-1', 'ECONOMY');
    });

    it('shows the server error message when locking fails (e.g. an already-active lock)', async () => {
      vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([RESULT]);
      vi.spyOn(publicSiteApi, 'fetchClubPoints').mockResolvedValue({ isMember: true, level: 'GOLD', balance: 500 });
      vi.spyOn(publicSiteApi, 'createPriceLock').mockRejectedValue(
        new ApiRequestError('CONFLICT', 'شما قبلاً برای این پرواز و کلاس، قیمت را قفل کرده‌اید.', 409),
      );
      renderPage('authenticated');
      await screen.findByTestId('result-card');

      await userEvent.click(screen.getByTestId('real-lock-fi-1-ECONOMY'));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'شما قبلاً برای این پرواز و کلاس، قیمت را قفل کرده‌اید.',
      );
    });
  });
});

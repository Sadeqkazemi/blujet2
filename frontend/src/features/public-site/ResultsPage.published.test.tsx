import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ResultsPage from './ResultsPage';
import * as publicSiteApi from '../../api/publicSite';
import * as useAuthModule from '../../hooks/useAuth';
import * as useLocaleModule from '../../hooks/useLocale';
import * as useIsMobileModule from '../../hooks/useIsMobile';
import type { SearchFlightResult } from '../../types/public-site';
import { invalidateSearchResultsCache } from '../../lib/search-cache';

const PUBLISHED: SearchFlightResult = {
  flightInstanceId: 'fi-pub',
  flightNo: 'BJ-200',
  aircraftType: 'MD-80',
  originCode: 'THR',
  destCode: 'MHD',
  departureAt: '2026-08-01T05:00:00.000Z',
  arrivalAt: '2026-08-01T06:30:00.000Z',
  publishStatus: 'PUBLISHED',
  cabins: [{ cabin: 'ECONOMY', priceIrr: '380000000', seatsLeft: 10 }],
};

const PENDING: SearchFlightResult = {
  ...PUBLISHED,
  flightInstanceId: 'fi-pending',
  flightNo: 'BJ-201',
  publishStatus: undefined,
  definitionStatus: 'PENDING_CEO',
};

describe('ResultsPage published flights', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale: 'fa', setLocale: vi.fn() });
    vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(false);
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      status: 'unauthenticated',
      user: null,
      requestLogin: vi.fn(),
      confirmTwoFactor: vi.fn(),
      agencyLogin: vi.fn(),
      signOut: vi.fn(),
    });
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue([
      { id: 'a1', code: 'THR', cityFa: 'تهران', tz: 'Asia/Tehran' },
      { id: 'a2', code: 'MHD', cityFa: 'مشهد', tz: 'Asia/Tehran' },
    ]);
    vi.spyOn(publicSiteApi, 'fetchPriceCalendar').mockResolvedValue([
      { date: '2026-08-01', minPriceIrr: '38000000', dateLabelFa: '2026-08-01', isCenter: true },
    ]);
  });

  it('shows PUBLISHED flights and hides unapproved CEO-pending rows', async () => {
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([PUBLISHED, PENDING]);

    render(
      <MemoryRouter initialEntries={['/results?origin=THR&dest=MHD&date=2026-08-01']}>
        <Routes>
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('result-card')).toBeInTheDocument();
    expect(screen.getAllByTestId('result-card')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /جزئیات و رزرو/ }));
    expect(screen.getByText('BJ-200')).toBeInTheDocument();
    expect(screen.queryByText('BJ-201')).not.toBeInTheDocument();
  });

  it('refetches when search cache is invalidated after CEO publish', async () => {
    const search = vi
      .spyOn(publicSiteApi, 'searchFlights')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([PUBLISHED]);

    render(
      <MemoryRouter initialEntries={['/results?origin=THR&dest=MHD&date=2026-08-01']}>
        <Routes>
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    invalidateSearchResultsCache();
    expect(await screen.findByTestId('result-card')).toBeInTheDocument();
    expect(search).toHaveBeenCalledTimes(2);
  });
});

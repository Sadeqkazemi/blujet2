import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ResultsPage from './ResultsPage';
import * as publicSiteApi from '../../api/publicSite';
import * as useAuthModule from '../../hooks/useAuth';
import type { SearchFlightResult } from '../../types/public-site';

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

function renderPage() {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'unauthenticated',
    user: null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
  return render(
    <MemoryRouter initialEntries={['/results?origin=THR&dest=MHD&date=2026-08-01']}>
      <Routes>
        <Route path="/results" element={<ResultsPage />} />
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

  it('shows an empty state when no flights match', async () => {
    vi.spyOn(publicSiteApi, 'searchFlights').mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('پروازی برای این مسیر و تاریخ یافت نشد.')).toBeInTheDocument();
  });
});

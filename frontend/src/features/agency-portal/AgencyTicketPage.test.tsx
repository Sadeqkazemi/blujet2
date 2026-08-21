import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgencyTicketPage from './AgencyTicketPage';
import * as publicApi from '../../api/publicSite';

vi.mock('../../components/JalaliDatePicker', () => ({
  default: ({ onChange, testId }: { onChange: (value: string) => void; testId: string }) => (
    <button type="button" data-testid={testId} onClick={() => onChange('2026-09-10T00:00:00.000Z')}>date</button>
  ),
}));

function ResultsLocation() {
  const location = useLocation();
  return <div data-testid="results-location">{location.pathname}{location.search}</div>;
}

afterEach(() => vi.restoreAllMocks());

describe('AgencyTicketPage', () => {
  it('uses the public airport catalog and opens the public flight results with the selected search', async () => {
    vi.spyOn(publicApi, 'fetchAirports').mockResolvedValue([
      { code: 'THR', nameFa: 'مهرآباد', cityFa: 'تهران', countryFa: 'ایران', active: true },
      { code: 'MHD', nameFa: 'شهید هاشمی‌نژاد', cityFa: 'مشهد', countryFa: 'ایران', active: true },
    ]);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/agency/tickets']}>
        <Routes>
          <Route path="/agency/tickets" element={<AgencyTicketPage />} />
          <Route path="/results" element={<ResultsLocation />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.selectOptions(await screen.findByTestId('agency-ticket-origin'), 'THR');
    await user.selectOptions(screen.getByTestId('agency-ticket-destination'), 'MHD');
    await user.click(screen.getByTestId('agency-ticket-date'));
    await user.click(screen.getByTestId('agency-ticket-passengers'));
    await user.click(screen.getByTestId('agency-ticket-pax-adults-inc'));
    await user.click(screen.getByTestId('agency-ticket-pax-children-inc'));
    await user.click(screen.getByTestId('agency-ticket-pax-confirm'));
    await user.click(screen.getByTestId('agency-ticket-search'));

    const location = await screen.findByTestId('results-location');
    expect(location).toHaveTextContent('/results?origin=THR&dest=MHD&date=2026-09-10&adults=2&children=1&infants=0&cabin=ECONOMY');
  });

  it('does not navigate until origin, destination, and date are complete', async () => {
    vi.spyOn(publicApi, 'fetchAirports').mockResolvedValue([]);
    const user = userEvent.setup();
    render(<MemoryRouter><AgencyTicketPage /></MemoryRouter>);

    await user.click(screen.getByTestId('agency-ticket-search'));
    expect(screen.getByRole('alert')).toHaveTextContent('مبدا، مقصد و تاریخ رفت را کامل کنید.');
  });
});

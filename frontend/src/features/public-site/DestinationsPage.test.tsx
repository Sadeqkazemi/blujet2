import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DestinationsPage from './DestinationsPage';
import * as siteContentApi from '../../api/site-content';
import * as useAuthModule from '../../hooks/useAuth';
import * as useLocaleModule from '../../hooks/useLocale';

function mockLocale(locale: 'fa' | 'en' | 'ar' = 'fa') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockLocale('en');
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    status: 'unauthenticated',
    user: null,
    requestLogin: vi.fn(),
    confirmTwoFactor: vi.fn(),
    agencyLogin: vi.fn(),
    signOut: vi.fn(),
  });
  vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockResolvedValue({
    blocks: [],
    destinations: [
      { airportCode: 'DXB', cityFa: 'دبی', priceIrr: '45000000', imageUrl: null },
    ],
    routes: [
      {
        fromAirportCode: 'THR',
        toAirportCode: 'DXB',
        fromCityFa: 'تهران',
        toCityFa: 'دبی',
        priceIrr: '52000000',
      },
    ],
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <DestinationsPage />
    </MemoryRouter>,
  );
}

describe('DestinationsPage', () => {
  it('renders the hero heading', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: "Where's your next destination?" })).toBeInTheDocument();
  });

  it('uses CMS destination price on matching cards', async () => {
    renderPage();
    const card = await screen.findByTestId('dest-card-DXB');
    expect(card).toHaveTextContent('4,500,000');
  });

  it('uses CMS route price in the popular routes section', async () => {
    renderPage();
    expect(await screen.findByText('5,200,000')).toBeInTheDocument();
  });
});

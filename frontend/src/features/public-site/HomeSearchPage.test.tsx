import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import HomeSearchPage from './HomeSearchPage';
import * as publicSiteApi from '../../api/publicSite';
import * as useAuthModule from '../../hooks/useAuth';

const AIRPORTS = [
  { id: 'a1', code: 'THR', cityFa: 'تهران', tz: 'Asia/Tehran' },
  { id: 'a2', code: 'MHD', cityFa: 'مشهد', tz: 'Asia/Tehran' },
];

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
    <MemoryRouter>
      <HomeSearchPage />
    </MemoryRouter>,
  );
}

async function pickToday() {
  await userEvent.click(screen.getByTestId('home-date'));
  await userEvent.click(screen.getByTestId('home-date-today'));
}

describe('HomeSearchPage', () => {
  it('renders RTL search form with airports loaded', async () => {
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    renderPage();

    expect(await screen.findAllByText('تهران (THR)')).toHaveLength(2);
    expect(screen.getByTestId('home-search-submit')).toBeInTheDocument();
  });

  it('shows a validation error when submitted without selections', async () => {
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    renderPage();
    await screen.findAllByText('تهران (THR)');

    await userEvent.click(screen.getByTestId('home-search-submit'));
    expect(screen.getByText('مبدأ، مقصد و تاریخ را انتخاب کنید.')).toBeInTheDocument();
  });

  it('rejects identical origin and destination', async () => {
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    renderPage();
    await screen.findAllByText('تهران (THR)');

    await userEvent.selectOptions(screen.getByTestId('home-origin'), 'THR');
    await userEvent.selectOptions(screen.getByTestId('home-dest'), 'THR');
    await pickToday();
    await userEvent.click(screen.getByTestId('home-search-submit'));

    expect(screen.getByText('مبدأ و مقصد نمی‌توانند یکسان باشند.')).toBeInTheDocument();
  });
});

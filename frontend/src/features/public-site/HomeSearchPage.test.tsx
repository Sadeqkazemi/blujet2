import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import HomeSearchPage from './HomeSearchPage';
import * as publicSiteApi from '../../api/publicSite';

const AIRPORTS = [
  { id: 'a1', code: 'THR', cityFa: 'تهران', tz: 'Asia/Tehran' },
  { id: 'a2', code: 'MHD', cityFa: 'مشهد', tz: 'Asia/Tehran' },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <HomeSearchPage />
    </MemoryRouter>,
  );
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
    await userEvent.type(screen.getByTestId('home-date'), '2026-08-01');
    await userEvent.click(screen.getByTestId('home-search-submit'));

    expect(screen.getByText('مبدأ و مقصد نمی‌توانند یکسان باشند.')).toBeInTheDocument();
  });
});

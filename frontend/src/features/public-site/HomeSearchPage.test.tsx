import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import HomeSearchPage from './HomeSearchPage';
import * as publicSiteApi from '../../api/publicSite';
import * as siteContentApi from '../../api/site-content';
import * as settingsApi from '../../api/settings';
import * as useAuthModule from '../../hooks/useAuth';
import * as useLocaleModule from '../../hooks/useLocale';

const AIRPORTS = [
  { id: 'a1', code: 'THR', cityFa: 'تهران', tz: 'Asia/Tehran' },
  { id: 'a2', code: 'MHD', cityFa: 'مشهد', tz: 'Asia/Tehran' },
];

function mockLocale(locale: 'fa' | 'en' | 'ar' = 'fa') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

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

const CMS_HOME = {
  blocks: [
    {
      key: 'HERO_BANNER' as const,
      enabled: true,
      title: 'عنوان CMS',
      subtitle: 'زیرعنوان CMS',
      buttonText: 'جستجو',
      badgeText: 'برچسب CMS',
      imageFileId: null,
      imageUrl: null,
    },
    {
      key: 'ANNOUNCEMENT_BAR' as const,
      enabled: true,
      title: 'اطلاعیه CMS',
      subtitle: '',
      buttonText: 'جزئیات',
      badgeText: '',
      imageFileId: null,
      imageUrl: null,
    },
    {
      key: 'PROMO_BANNER' as const,
      enabled: true,
      title: 'پromo CMS',
      subtitle: 'توضیح promo',
      buttonText: 'رزرو',
      badgeText: 'ویژه CMS',
      imageFileId: null,
      imageUrl: null,
    },
  ],
  destinations: [
    { airportCode: 'DXB', cityFa: 'دبی', priceIrr: '38000000', imageUrl: null },
  ],
  routes: [
    {
      fromAirportCode: 'THR',
      toAirportCode: 'MHD',
      fromCityFa: 'تهران',
      toCityFa: 'مشهد',
      priceIrr: '16000000',
    },
  ],
};

describe('HomeSearchPage', () => {
  it('renders RTL search form with airports loaded', async () => {
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockResolvedValue(CMS_HOME);
    vi.spyOn(settingsApi, 'fetchPublicAppLinks').mockResolvedValue({
      links: [{ id: 'app_store', name: 'App Store', url: 'https://apps.apple.com/blujet' }],
    });
    renderPage();

    expect(await screen.findAllByText('تهران (THR)')).toHaveLength(2);
    expect(screen.getByTestId('home-search-submit')).toBeInTheDocument();
  });

  it('shows a validation error when submitted without selections', async () => {
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockResolvedValue(CMS_HOME);
    vi.spyOn(settingsApi, 'fetchPublicAppLinks').mockResolvedValue({
      links: [{ id: 'app_store', name: 'App Store', url: 'https://apps.apple.com/blujet' }],
    });
    renderPage();
    await screen.findAllByText('تهران (THR)');

    await userEvent.click(screen.getByTestId('home-search-submit'));
    expect(screen.getByText('مبدأ، مقصد و تاریخ را انتخاب کنید.')).toBeInTheDocument();
  });

  it('renders CMS-driven marketing sections when home content loads', async () => {
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockResolvedValue(CMS_HOME);
    vi.spyOn(settingsApi, 'fetchPublicAppLinks').mockResolvedValue({
      links: [{ id: 'app_store', name: 'App Store', url: 'https://apps.apple.com/blujet' }],
    });
    renderPage();
    await screen.findAllByText('تهران (THR)');

    expect(screen.getByText('عنوان CMS')).toBeInTheDocument();
    expect(screen.getByText('اطلاعیه CMS')).toBeInTheDocument();
    expect(screen.getByText('پromo CMS')).toBeInTheDocument();
    expect(screen.getByTestId('popular-dest-DXB')).toBeInTheDocument();
    expect(screen.getByTestId('popular-route-MHD')).toBeInTheDocument();
    expect(screen.getByText('پیشنهادهای ویژه')).toBeInTheDocument();
    expect(screen.getByText('با رسیدن به حد امتیاز، کارت عضویت بگیر')).toBeInTheDocument();
    const appStore = screen.getByTestId('app-link-app_store');
    expect(appStore.tagName).toBe('A');
    expect(appStore).toHaveAttribute('href', 'https://apps.apple.com/blujet');
  });

  it('falls back to static marketing when CMS fetch fails', async () => {
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockRejectedValue(new Error('offline'));
    vi.spyOn(settingsApi, 'fetchPublicAppLinks').mockResolvedValue({ links: [] });
    renderPage();
    await screen.findAllByText('تهران (THR)');

    expect(screen.getByText('پیشنهادهای ویژه')).toBeInTheDocument();
    expect(screen.getByTestId('offer-THR-IST')).toBeInTheDocument();
    expect(screen.getByText('تا ۴۰٪ تخفیف روی پروازهای خارجی')).toBeInTheDocument();
    expect(screen.getByText('مقصدهای محبوب')).toBeInTheDocument();
    expect(screen.getByTestId('popular-dest-DXB')).toBeInTheDocument();
    expect(screen.getByTestId('popular-route-MHD')).toBeInTheDocument();
    expect(screen.getByText('با رسیدن به حد امتیاز، کارت عضویت بگیر')).toBeInTheDocument();
    expect(screen.getByText('سفرت را همراه خودت ببر')).toBeInTheDocument();
  });

  it('rejects identical origin and destination', async () => {
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockResolvedValue(CMS_HOME);
    vi.spyOn(settingsApi, 'fetchPublicAppLinks').mockResolvedValue({
      links: [{ id: 'app_store', name: 'App Store', url: 'https://apps.apple.com/blujet' }],
    });
    renderPage();
    await screen.findAllByText('تهران (THR)');

    await userEvent.selectOptions(screen.getByTestId('home-origin'), 'THR');
    await userEvent.selectOptions(screen.getByTestId('home-dest'), 'THR');
    await pickToday();
    await userEvent.click(screen.getByTestId('home-search-submit'));

    expect(screen.getByText('مبدأ و مقصد نمی‌توانند یکسان باشند.')).toBeInTheDocument();
  });

  it('renders translated marketing sections and Latin-digit toman prices in English', async () => {
    mockLocale('en');
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockResolvedValue({
      ...CMS_HOME,
      blocks: CMS_HOME.blocks.map((b) =>
        b.key === 'HERO_BANNER'
          ? { ...b, title: 'Book your next flight with blujet', badgeText: 'Up to 5% cashback' }
          : b.key === 'PROMO_BANNER'
            ? { ...b, title: 'Up to 40% off international flights', badgeText: 'blujet Summer Sale' }
            : b,
      ),
    });
    renderPage();
    await screen.findAllByText('Tehran (THR)');

    expect(screen.getByText('Book your next flight with blujet')).toBeInTheDocument();
    expect(screen.getByText('Special Offers')).toBeInTheDocument();
    expect(screen.getByText('Up to 40% off international flights')).toBeInTheDocument();
    expect(screen.getByText('Popular Destinations')).toBeInTheDocument();
    expect(screen.getByText('Take your trip with you')).toBeInTheDocument();
    expect(screen.getByTestId('offer-THR-IST')).toHaveTextContent('19% OFF');
    expect(screen.getByTestId('popular-route-MHD')).toHaveTextContent('1,600,000');
  });

  it('renders Arabic marketing sections with Eastern Arabic-Indic digits', async () => {
    mockLocale('ar');
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockResolvedValue({
      ...CMS_HOME,
      blocks: CMS_HOME.blocks.map((b) =>
        b.key === 'HERO_BANNER' ? { ...b, title: 'احجز رحلتك القادمة مع blujet' } : b,
      ),
    });
    renderPage();
    await screen.findAllByText('طهران (THR)');

    expect(screen.getByText('احجز رحلتك القادمة مع blujet')).toBeInTheDocument();
    expect(screen.getByText('عروض خاصة')).toBeInTheDocument();
    expect(screen.getByText('الوجهات الشائعة')).toBeInTheDocument();
    expect(screen.getByTestId('offer-THR-IST')).toHaveTextContent('١٩٪ خصم');
    expect(screen.getByTestId('popular-route-MHD')).toHaveTextContent('١٬٦٠٠٬٠٠٠');
  });
});

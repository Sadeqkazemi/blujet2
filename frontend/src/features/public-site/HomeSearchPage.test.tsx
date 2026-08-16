import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import HomeSearchPage from './HomeSearchPage';
import * as publicSiteApi from '../../api/publicSite';
import * as siteContentApi from '../../api/site-content';
import * as settingsApi from '../../api/settings';
import * as useAuthModule from '../../hooks/useAuth';
import * as useIsMobileModule from '../../hooks/useIsMobile';
import * as useLocaleModule from '../../hooks/useLocale';

const AIRPORTS = [
  { id: 'a1', code: 'THR', cityFa: 'تهران', airportNameFa: 'فرودگاه بین‌المللی مهرآباد', tz: 'Asia/Tehran' },
  { id: 'a2', code: 'MHD', cityFa: 'مشهد', airportNameFa: 'فرودگاه بین‌المللی شهید هاشمی‌نژاد', tz: 'Asia/Tehran' },
];

function mockLocale(locale: 'fa' | 'en' | 'ar' = 'fa') {
  vi.spyOn(useLocaleModule, 'useLocale').mockReturnValue({ locale, setLocale: vi.fn() });
}

function mockDesktop() {
  vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(false);
}

function mockMobile() {
  vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(true);
}

function mockHomeApis() {
  vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
  vi.spyOn(publicSiteApi, 'fetchPriceCalendar').mockResolvedValue([
    { date: '2026-08-01', minPriceIrr: '38000000', dateLabelFa: '2026-08-01', isCenter: true },
    { date: '2026-08-02', minPriceIrr: '0', dateLabelFa: '2026-08-02', isCenter: false },
    { date: '2026-08-03', minPriceIrr: '35000000', dateLabelFa: '2026-08-03', isCenter: false },
  ]);
  vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockResolvedValue(CMS_HOME);
  vi.spyOn(settingsApi, 'fetchPublicAppLinks').mockResolvedValue({
    links: [{ id: 'app_store', name: 'App Store', url: 'https://apps.apple.com/blujet' }],
  });
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

async function pickAirport(testId: 'home-origin' | 'home-dest', code: string) {
  await userEvent.click(screen.getByTestId(testId));
  await userEvent.click(screen.getByTestId(`airport-option-${code}`));
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

    expect(await screen.findByTestId('home-origin')).toBeInTheDocument();
    expect(screen.getByTestId('home-origin')).toHaveTextContent('شهر مبدا');
    expect(screen.getByTestId('home-dest')).toHaveTextContent('شهر مقصد');
    expect(screen.getByTestId('home-search-submit')).toBeInTheDocument();
    expect(document.getElementById('search-card')).toBeInTheDocument();
  });

  it('shows a validation error when submitted without selections', async () => {
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockResolvedValue(CMS_HOME);
    vi.spyOn(settingsApi, 'fetchPublicAppLinks').mockResolvedValue({
      links: [{ id: 'app_store', name: 'App Store', url: 'https://apps.apple.com/blujet' }],
    });
    renderPage();
    await screen.findByTestId('home-origin');

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
    await screen.findByTestId('home-origin');

    expect(screen.getByText('عنوان CMS')).toBeInTheDocument();
    expect(screen.getByText('اطلاعیه CMS')).toBeInTheDocument();
    expect(screen.getByText('پromo CMS')).toBeInTheDocument();
    expect(screen.getByTestId('popular-dest-DXB')).toBeInTheDocument();
    expect(screen.getByTestId('popular-route-MHD')).toBeInTheDocument();
    expect(screen.getByText('با رسیدن به حد امتیاز، کارت عضویت بگیر')).toBeInTheDocument();
    const appStore = screen.getByTestId('app-link-app_store');
    expect(appStore.tagName).toBe('A');
    expect(appStore).toHaveAttribute('href', 'https://apps.apple.com/blujet');
  });

  it('does not fabricate prices, promotions, or notices when CMS fetch fails', async () => {
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockRejectedValue(new Error('offline'));
    vi.spyOn(settingsApi, 'fetchPublicAppLinks').mockResolvedValue({ links: [] });
    renderPage();
    await screen.findByTestId('home-origin');

    expect(screen.queryByText('پیشنهادهای ویژه')).not.toBeInTheDocument();
    expect(screen.queryByText('تا ۴۰٪ تخفیف روی پروازهای خارجی')).not.toBeInTheDocument();
    expect(screen.queryByText('مقصدهای محبوب')).not.toBeInTheDocument();
    expect(screen.queryByText(/اطلاعیه مهم/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('popular-dest-DXB')).not.toBeInTheDocument();
    expect(screen.queryByTestId('popular-route-MHD')).not.toBeInTheDocument();
    expect(screen.getByText('با رسیدن به حد امتیاز، کارت عضویت بگیر')).toBeInTheDocument();
    expect(screen.getByText('سفرت را همراه خودت ببر')).toBeInTheDocument();
  });

  it('shows selected city names in origin and destination fields', async () => {
    mockHomeApis();
    renderPage();
    await screen.findByTestId('home-origin');

    await pickAirport('home-origin', 'THR');
    await pickAirport('home-dest', 'MHD');

    expect(screen.getByTestId('home-origin')).toHaveTextContent('تهران');
    expect(screen.getByTestId('home-dest')).toHaveTextContent('مشهد');
  });

  it('shows real fares inside the mobile departure-date calendar only', async () => {
    mockLocale('fa');
    mockMobile();
    mockHomeApis();
    renderPage();
    await screen.findByTestId('home-origin');

    expect(screen.queryByTestId('home-price-calendar-wrap')).not.toBeInTheDocument();

    await pickAirport('home-origin', 'THR');
    await pickAirport('home-dest', 'MHD');

    expect(screen.queryByTestId('home-price-calendar-wrap')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('home-date'));
    await waitFor(() => {
      expect(screen.getByTestId('home-date-price-2026-08-01')).toBeInTheDocument();
    });
    expect(publicSiteApi.fetchPriceCalendar).toHaveBeenCalled();
    expect(screen.getByTestId('home-date-confirm')).toBeInTheDocument();
  });

  it('does not invent airports while the airports API is pending', async () => {
    vi.spyOn(publicSiteApi, 'fetchAirports').mockReturnValue(new Promise(() => {}));
    vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockResolvedValue(CMS_HOME);
    vi.spyOn(settingsApi, 'fetchPublicAppLinks').mockResolvedValue({ links: [] });
    renderPage();
    await screen.findByTestId('home-origin');

    await userEvent.click(screen.getByTestId('home-origin'));
    expect(screen.queryByTestId('airport-option-THR')).not.toBeInTheDocument();
    expect(screen.queryByTestId('airport-option-MHD')).not.toBeInTheDocument();
  });

  it('blocks destination picker until origin is chosen', async () => {
    mockHomeApis();
    renderPage();
    await screen.findByTestId('home-origin');

    await userEvent.click(screen.getByTestId('home-dest'));
    expect(screen.queryByTestId('airport-option-MHD')).not.toBeInTheDocument();
    expect(screen.getByText('ابتدا مبدا را انتخاب کنید')).toBeInTheDocument();
  });

  it('rejects identical origin and destination', async () => {
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockResolvedValue(CMS_HOME);
    vi.spyOn(settingsApi, 'fetchPublicAppLinks').mockResolvedValue({
      links: [{ id: 'app_store', name: 'App Store', url: 'https://apps.apple.com/blujet' }],
    });
    renderPage();
    await screen.findByTestId('home-origin');

    await pickAirport('home-origin', 'THR');
    await pickAirport('home-dest', 'THR');
    await pickToday();
    await userEvent.click(screen.getByTestId('home-search-submit'));

    expect(screen.getByText('مبدأ و مقصد نمی‌توانند یکسان باشند.')).toBeInTheDocument();
  });

  it('renders translated marketing sections and Latin-digit toman prices in English', async () => {
    mockLocale('en');
    mockDesktop();
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockResolvedValue({
      ...CMS_HOME,
      routes: CMS_HOME.routes.map((route) => ({
        ...route,
        fromAirportCode: 'تهران',
        toAirportCode: 'مشهد',
      })),
      blocks: CMS_HOME.blocks.map((b) =>
        b.key === 'HERO_BANNER'
          ? { ...b, title: 'Book your next flight with blujet', badgeText: 'Up to 5% cashback' }
          : b.key === 'PROMO_BANNER'
            ? { ...b, title: 'Up to 40% off international flights', badgeText: 'blujet Summer Sale' }
            : b,
      ),
    });
    renderPage();
    await screen.findByTestId('home-origin');

    expect(screen.getByText('Book your next flight with blujet')).toBeInTheDocument();
    expect(screen.getByText('Up to 40% off international flights')).toBeInTheDocument();
    expect(screen.getByText('Popular Destinations')).toBeInTheDocument();
    expect(screen.getByText('Take your trip with you')).toBeInTheDocument();
    expect(screen.getByTestId('popular-route-MHD')).toHaveTextContent('1,600,000');
    expect(screen.getByTestId('popular-route-MHD')).toHaveTextContent('Tehran');
    expect(screen.getByTestId('popular-route-MHD')).toHaveTextContent('Mashhad');
    expect(screen.getByTestId('popular-route-MHD')).not.toHaveTextContent('تهران');
    await userEvent.click(screen.getByTestId('home-origin'));
    expect(screen.getByTestId('airport-option-THR')).toHaveTextContent('Mehrabad International Airport');
    expect(screen.getByTestId('airport-option-THR')).not.toHaveTextContent('فرودگاه');
  });

  it('renders Arabic marketing sections with Eastern Arabic-Indic digits', async () => {
    mockLocale('ar');
    mockDesktop();
    vi.spyOn(publicSiteApi, 'fetchAirports').mockResolvedValue(AIRPORTS);
    vi.spyOn(siteContentApi, 'fetchPublicHomeContent').mockResolvedValue({
      ...CMS_HOME,
      routes: CMS_HOME.routes.map((route) => ({
        ...route,
        fromAirportCode: 'تهران',
        toAirportCode: 'مشهد',
      })),
      blocks: CMS_HOME.blocks.map((b) =>
        b.key === 'HERO_BANNER' ? { ...b, title: 'احجز رحلتك القادمة مع blujet' } : b,
      ),
    });
    renderPage();
    await screen.findByTestId('home-origin');

    expect(screen.getByText('احجز رحلتك القادمة مع blujet')).toBeInTheDocument();
    expect(screen.getByText('الوجهات الشائعة')).toBeInTheDocument();
    expect(screen.getByTestId('popular-route-MHD')).toHaveTextContent('١٬٦٠٠٬٠٠٠');
    expect(screen.getByTestId('popular-route-MHD')).toHaveTextContent('طهران');
    expect(screen.getByTestId('popular-route-MHD')).not.toHaveTextContent('تهران');
    await userEvent.click(screen.getByTestId('home-origin'));
    expect(screen.getByTestId('airport-option-THR')).toHaveTextContent('مطار مهرآباد الدولي');
    expect(screen.getByTestId('airport-option-THR')).not.toHaveTextContent('فرودگاه');
  });

  it.each([
    ['fa' as const, 'تهران'],
    ['en' as const, 'tehran'],
    ['ar' as const, 'طهران'],
  ])(
    'opens a keyboard-safe mobile airport search sheet in %s without zooming the page',
    async (locale, query) => {
      const viewport = new EventTarget() as VisualViewport;
      let visualHeight = 458;
      let visualOffsetTop = 24;
      Object.defineProperties(viewport, {
        height: { configurable: true, get: () => visualHeight },
        width: { configurable: true, value: 390 },
        offsetTop: { configurable: true, get: () => visualOffsetTop },
        offsetLeft: { configurable: true, value: 0 },
      });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

      mockLocale(locale);
      mockMobile();
      mockHomeApis();
      renderPage();
      await screen.findByTestId('home-origin');

      await userEvent.click(screen.getByTestId('home-origin'));

      const overlay = screen.getByTestId('home-origin-mobile-overlay');
      const searchInput = screen.getByTestId('home-origin-search');
      expect(overlay.parentElement).toBe(document.body);
      expect(overlay).toHaveStyle({ position: 'fixed', inset: '0' });
      expect(screen.getByRole('dialog')).toHaveStyle({
        position: 'fixed',
        top: '24px',
        height: '458px',
        width: '390px',
      });
      expect(searchInput).toHaveStyle({ fontSize: '16px' });
      expect(searchInput).toHaveAttribute('inputmode', 'search');
      expect(document.body).toHaveStyle({ overflow: 'hidden', position: 'fixed', width: '100%' });

      // iOS pans the visual viewport (not the document) to keep the focused
      // input above the keyboard. The sheet must track that pan — a fixed
      // `top: 0` would drift the header off-screen and clip the sheet, which
      // is the bug being guarded against here.
      visualHeight = 340;
      visualOffsetTop = 286;
      act(() => viewport.dispatchEvent(new Event('resize')));
      expect(screen.getByRole('dialog')).toHaveStyle({ top: '286px', height: '340px' });

      await userEvent.type(searchInput, query);
      expect(screen.getByTestId('airport-option-THR')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('home-origin-mobile-close'));
      expect(document.body).not.toHaveStyle({ position: 'fixed' });
    },
  );

  it('tracks a horizontally panned visual viewport (pinch-zoom / landscape)', async () => {
    const viewport = new EventTarget() as VisualViewport;
    Object.defineProperties(viewport, {
      height: { configurable: true, value: 320 },
      width: { configurable: true, value: 260 },
      offsetTop: { configurable: true, value: 40 },
      offsetLeft: { configurable: true, value: 65 },
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    mockMobile();
    mockHomeApis();
    renderPage();
    await screen.findByTestId('home-origin');

    await userEvent.click(screen.getByTestId('home-origin'));

    // The sheet must sit exactly over the visible (possibly zoomed/panned)
    // slice of the screen, not the full layout viewport, or its edges spill
    // outside what the user can actually see.
    expect(screen.getByRole('dialog')).toHaveStyle({
      position: 'fixed',
      top: '40px',
      left: '65px',
      width: '260px',
      height: '320px',
    });
  });

  it(
    'stays exactly within the visible area through resize + scroll VisualViewport events ' +
      'on an already-scrolled page, then restores the exact scroll position on close',
    async () => {
      // The page was scrolled down before the sheet was ever opened.
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 240 });
      const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

      const viewport = new EventTarget() as VisualViewport;
      let visualHeight = 800;
      let visualOffsetTop = 0;
      Object.defineProperties(viewport, {
        height: { configurable: true, get: () => visualHeight },
        width: { configurable: true, value: 390 },
        offsetTop: { configurable: true, get: () => visualOffsetTop },
        offsetLeft: { configurable: true, value: 0 },
      });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

      mockMobile();
      mockHomeApis();
      renderPage();
      await screen.findByTestId('home-origin');

      await userEvent.click(screen.getByTestId('home-origin'));
      // Body scroll is locked at the pre-open position — the underlying page
      // must not move while the sheet is up.
      expect(document.body).toHaveStyle({ position: 'fixed', top: '-240px' });
      expect(screen.getByRole('dialog')).toHaveStyle({ top: '0px', height: '800px' });

      // Keyboard opens: VisualViewport fires 'resize' (height shrinks).
      visualHeight = 400;
      act(() => viewport.dispatchEvent(new Event('resize')));
      expect(screen.getByRole('dialog')).toHaveStyle({ top: '0px', height: '400px' });
      // Bottom edge of the sheet must never exceed the visible viewport.
      expect(0 + 400).toBeLessThanOrEqual(Number(window.innerHeight));

      // iOS then pans to keep the focused field above the keyboard:
      // VisualViewport fires 'scroll' (offsetTop moves), independent of the
      // 'resize' event above.
      visualOffsetTop = 180;
      act(() => viewport.dispatchEvent(new Event('scroll')));
      expect(screen.getByRole('dialog')).toHaveStyle({ top: '180px', height: '400px' });
      // Still fully within the visible viewport after the pan.
      expect(180 + 400).toBeLessThanOrEqual(Number(window.innerHeight));

      await userEvent.click(screen.getByTestId('home-origin-mobile-close'));

      expect(document.body).not.toHaveStyle({ position: 'fixed' });
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 240, left: 0, behavior: 'auto' });
    },
  );

  it('applies no artificial minimum height — the sheet shrinks to the real space left above the keyboard', async () => {
    // Regression guard for a since-removed `Math.max(180, visibleHeight)`
    // floor: once visible space drops below that floor, clamping to it
    // pushed the sheet's bottom edge back under the keyboard.
    const viewport = new EventTarget() as VisualViewport;
    let visualHeight = 800;
    Object.defineProperties(viewport, {
      height: { configurable: true, get: () => visualHeight },
      width: { configurable: true, value: 390 },
      offsetTop: { configurable: true, value: 0 },
      offsetLeft: { configurable: true, value: 0 },
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    mockMobile();
    mockHomeApis();
    renderPage();
    await screen.findByTestId('home-origin');

    await userEvent.click(screen.getByTestId('home-origin'));

    visualHeight = 96; // well under the old 180px floor
    act(() => viewport.dispatchEvent(new Event('resize')));

    expect(screen.getByRole('dialog')).toHaveStyle({ top: '0px', height: '96px' });
  });

  it('keeps the sheet within bounds in portrait when the keyboard opens', async () => {
    const viewport = new EventTarget() as VisualViewport;
    let visualHeight = 844;
    Object.defineProperties(viewport, {
      height: { configurable: true, get: () => visualHeight },
      width: { configurable: true, value: 390 },
      offsetTop: { configurable: true, value: 0 },
      offsetLeft: { configurable: true, value: 0 },
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    mockMobile();
    mockHomeApis();
    renderPage();
    await screen.findByTestId('home-origin');

    await userEvent.click(screen.getByTestId('home-origin'));
    expect(screen.getByRole('dialog')).toHaveStyle({ width: '390px', height: '844px' });

    visualHeight = 420; // portrait keyboard takes roughly half the screen
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(screen.getByRole('dialog')).toHaveStyle({ top: '0px', width: '390px', height: '420px' });
  });

  it('keeps the sheet within bounds in landscape when the keyboard opens (short viewport)', async () => {
    const viewport = new EventTarget() as VisualViewport;
    let visualHeight = 390;
    Object.defineProperties(viewport, {
      height: { configurable: true, get: () => visualHeight },
      width: { configurable: true, value: 844 },
      offsetTop: { configurable: true, value: 0 },
      offsetLeft: { configurable: true, value: 0 },
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 390 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });

    mockMobile();
    mockHomeApis();
    renderPage();
    await screen.findByTestId('home-origin');

    await userEvent.click(screen.getByTestId('home-origin'));
    expect(screen.getByRole('dialog')).toHaveStyle({ width: '844px', height: '390px' });

    // Landscape keyboards eat a much larger share of the (already short)
    // viewport — this is exactly the case the removed 180px floor broke.
    visualHeight = 120;
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(screen.getByRole('dialog')).toHaveStyle({ top: '0px', width: '844px', height: '120px' });
  });
});

/** Frozen responsive layout — do not change without explicit product approval. */
describe('HomeSearchPage — responsive layout (frozen)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockHomeApis();
  });

  it('desktop: services grid, destinations + loyalty carousel visible, no hscroll', async () => {
    mockDesktop();
    renderPage();
    await screen.findByTestId('home-origin');

    const services = screen.getByTestId('home-services');
    expect(services).not.toHaveClass('hscroll');
    expect(services).toHaveStyle({ display: 'grid' });

    expect(screen.getByText('مقصدهای محبوب')).toBeInTheDocument();
    expect(screen.getByTestId('popular-dest-DXB')).toBeInTheDocument();
    expect(screen.getByText('با رسیدن به حد امتیاز، کارت عضویت بگیر')).toBeInTheDocument();
  });

  it('mobile: horizontal hscroll for services/destinations, carousel hidden', async () => {
    mockMobile();
    renderPage();
    await screen.findByTestId('home-origin');

    const services = screen.getByTestId('home-services');
    expect(services).toHaveClass('hscroll');
    expect(services).toHaveStyle({ display: 'flex', overflowX: 'auto' });

    const serviceButtons = services.querySelectorAll('button');
    expect(serviceButtons.length).toBe(4);
    expect(serviceButtons[0]).toHaveStyle({ flex: '0 0 calc(50% - 6.5px)' });

    expect(screen.getByText('مقصدهای محبوب')).toBeInTheDocument();
    expect(screen.getByTestId('popular-dest-DXB')).toBeInTheDocument();
    expect(screen.queryByText('با رسیدن به حد امتیاز، کارت عضویت بگیر')).not.toBeInTheDocument();
  });
});

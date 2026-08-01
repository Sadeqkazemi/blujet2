import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAirports } from '../../api/publicSite';
import { fetchPublicHomeContent } from '../../api/site-content';
import { fetchPublicAppLinks } from '../../api/settings';
import type { AppLinkId } from '../../types/app-links';
import type { Airport } from '../../types/public-site';
import type { PublicHomeContent } from '../../types/site-content';
import PublicPageShell from '../../components/public/PublicPageShell';
import FlightSearchForm from '../../components/public/flight-search/FlightSearchForm';
import SearchLoadingOverlay from '../../components/public/home/SearchLoadingOverlay';
import HomeManageTab from '../../components/public/home/HomeManageTab';
import HomeStatusTab from '../../components/public/home/HomeStatusTab';
import FeatureQuickLinks from '../../components/public/home/FeatureQuickLinks';
import PromoSlider from '../../components/public/home/PromoSlider';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import { horizontalScrollStyle, useHorizontalDragScroll } from '../../hooks/useHorizontalDragScroll';
import { formatLocalePercent, formatToman } from '../../lib/fa-format';

const TODAY_ISO = new Date().toISOString().slice(0, 10);

// Raw route/airport data: kept locale-neutral (city names + numeric toman
// amounts), formatted per-locale at render time so fa/en/ar all show the
// same real underlying prices — no invented USD conversion like the design
// mock's EN mode, since the real backend always charges in IRR/toman.
const CITY_NAMES: Record<string, Record<StoredLocale, string>> = {
  THR: { fa: 'تهران', en: 'Tehran', ar: 'طهران' },
  MHD: { fa: 'مشهد', en: 'Mashhad', ar: 'مشهد' },
  IST: { fa: 'استانبول', en: 'Istanbul', ar: 'إسطنبول' },
  DXB: { fa: 'دبی', en: 'Dubai', ar: 'دبي' },
  KIH: { fa: 'کیش', en: 'Kish', ar: 'كيش' },
  SYZ: { fa: 'شیراز', en: 'Shiraz', ar: 'شيراز' },
};

const APP_LINK_ORDER: AppLinkId[] = ['app_store', 'google_play', 'bazaar_myket'];

const POPULAR_ROUTES_FALLBACK: { fromCode: string; toCode: string; tomanPrice: number }[] = [
  { fromCode: 'THR', toCode: 'MHD', tomanPrice: 1_600_000 },
  { fromCode: 'THR', toCode: 'IST', tomanPrice: 4_200_000 },
  { fromCode: 'THR', toCode: 'DXB', tomanPrice: 3_800_000 },
  { fromCode: 'MHD', toCode: 'KIH', tomanPrice: 2_100_000 },
  { fromCode: 'SYZ', toCode: 'THR', tomanPrice: 1_450_000 },
];

const OFFERS: { fromCode: string; toCode: string; was: number; now: number; offPct: number; deadlineDays: number | 'today'; grad: string }[] = [
  { fromCode: 'THR', toCode: 'IST', was: 5_200_000, now: 4_200_000, offPct: 19, deadlineDays: 2, grad: 'linear-gradient(160deg,#bcd6f2,#e3eefb)' },
  { fromCode: 'THR', toCode: 'DXB', was: 4_900_000, now: 3_800_000, offPct: 22, deadlineDays: 3, grad: 'linear-gradient(160deg,#c8d9ec,#e8eef6)' },
  { fromCode: 'MHD', toCode: 'KIH', was: 2_800_000, now: 2_100_000, offPct: 25, deadlineDays: 'today', grad: 'linear-gradient(160deg,#bfe0d8,#e6f2ee)' },
  { fromCode: 'THR', toCode: 'MHD', was: 2_100_000, now: 1_600_000, offPct: 24, deadlineDays: 1, grad: 'linear-gradient(160deg,#cdd9ec,#eaeff7)' },
];

const STR: Record<StoredLocale, {
  announcement: string;
  annView: string;
  annClose: string;
  heroBadge: string;
  heroTitle: string;
  heroSub: string;
  heroCta: string;
  economyCabin: string;
  airlineBadge: string;
  airlineTitle: string;
  airlineSub: string;
  airlineBtn: string;
  tripOneWay: string;
  tripRoundTrip: string;
  tripMultiCity: string;
  tabBook: string;
  tabManage: string;
  tabStatus: string;
  lblOrigin: string;
  lblDestination: string;
  lblDepartDate: string;
  selectPlaceholder: string;
  btnSearchFlight: string;
  popularRoutesTitle: string;
  popularRoutesSub: string;
  toman: string;
  quickLinks: string[];
  quickLinkHrefs: string[];
  limitedTime: string;
  specialOffersTitle: string;
  specialOffersSub: string;
  viewAllOffers: string;
  off: string;
  deadlinePrefix: string;
  today: string;
  daySuffix: string;
  book: string;
  saleBadge: string;
  saleTitle: string;
  saleSub: string;
  saleBtn: string;
  loyaltyEyebrow: string;
  loyaltyTitle: string;
  loyaltySub: string;
  loyaltyCta: string;
  tierSilver: string;
  tierSilverRange: string;
  tierGold: string;
  tierGoldRange: string;
  tierPlatinum: string;
  tierPlatinumRange: string;
  appEyebrow: string;
  appTitle: string;
  appSub: string;
  appStore: string;
  googlePlay: string;
  bazaarMyket: string;
}> = {
  fa: {
    announcement: 'اطلاعیه مهم: برخی پروازهای امروز به‌دلیل شرایط جوی با تأخیر انجام می‌شوند — آخرین وضعیت پروازها را بررسی کنید',
    annView: 'مشاهده',
    annClose: 'بستن',
    heroBadge: 'در هر پرواز تا ۵٪ کش‌بک بگیرید',
    heroTitle: 'پرواز بعدی‌ات را با blujet رزرو کن',
    heroSub: 'بیش از ۲۰۰ مقصد داخلی و بین‌المللی، با بهترین قیمت، پشتیبانی شبانه‌روزی و امتیاز در هر سفر.',
    heroCta: 'مشاهده پیشنهادهای ویژه',
    economyCabin: 'اکونومی',
    airlineBadge: 'ایرلاین‌های شریک',
    airlineTitle: 'پرواز با ۴۵+ ایرلاین معتبر بین‌المللی',
    airlineSub: 'تمام پروازها با ایرلاین‌های دارای مجوز رسمی و پوشش بیمه مسافرتی رزرو می‌شوند.',
    airlineBtn: 'مشاهده ایرلاین‌ها',
    tripOneWay: 'یک‌طرفه',
    tripRoundTrip: 'رفت و برگشت',
    tripMultiCity: 'چندمسیره',
    tabBook: 'رزرو پرواز',
    tabManage: 'مدیریت رزرو',
    tabStatus: 'وضعیت پرواز',
    lblOrigin: 'مبدا',
    lblDestination: 'مقصد',
    lblDepartDate: 'تاریخ رفت',
    selectPlaceholder: 'انتخاب کنید',
    btnSearchFlight: 'جستجوی پرواز',
    popularRoutesTitle: 'مسیرهای پرتردد',
    popularRoutesSub: 'ارزان‌ترین نرخ در پرطرفدارترین مسیرها',
    toman: 'تومان',
    quickLinks: ['انتخاب صندلی', 'خرید بار اضافه', 'تغییر و استرداد بلیط', 'استعلام وضعیت پرواز'],
    quickLinkHrefs: ['/results', '/results', '/ticket', '/flight-status'],
    limitedTime: 'زمان محدود',
    specialOffersTitle: 'پیشنهادهای ویژه',
    specialOffersSub: 'تخفیف‌های مدت‌دار روی پرطرفدارترین مسیرها — تا اتمام ظرفیت',
    viewAllOffers: 'مشاهده همه پیشنهادها',
    off: 'تخفیف',
    deadlinePrefix: 'مهلت: ',
    today: 'امروز',
    daySuffix: ' روز',
    book: 'رزرو',
    saleBadge: 'حراج تابستانه blujet',
    saleTitle: 'تا ۴۰٪ تخفیف روی پروازهای خارجی',
    saleSub: 'رزرو تا پایان مرداد برای سفرهای تابستان — صندلی‌ها محدودند، فرصت را از دست نده.',
    saleBtn: 'مشاهده پروازها',
    loyaltyEyebrow: 'کارت عضویت باشگاه',
    loyaltyTitle: 'با رسیدن به حد امتیاز، کارت عضویت بگیر',
    loyaltySub: 'از ۵٬۰۰۰ امتیاز واجد شرایط دریافت کارت می‌شوی؛ درخواست برای ادمین ارسال و پس از تأیید مدیران، کارت برایت صادر می‌شود.',
    loyaltyCta: 'مشاهده شرایط و سطوح',
    tierSilver: 'نقره‌ای',
    tierSilverRange: '۰ تا ۵٬۰۰۰ امتیاز',
    tierGold: 'طلایی',
    tierGoldRange: '۵٬۰۰۰ تا ۱۵٬۰۰۰',
    tierPlatinum: 'پلاتین',
    tierPlatinumRange: 'بالای ۱۵٬۰۰۰',
    appEyebrow: 'اپلیکیشن blujet',
    appTitle: 'سفرت را همراه خودت ببر',
    appSub: 'رزرو سریع‌تر، مدیریت بلیط، کارت پرواز دیجیتال و دریافت آخرین تخفیف‌ها — همه در اپلیکیشن موبایل (نسخه PWA همین سایت قابل نصب است).',
    appStore: 'App Store',
    googlePlay: 'Google Play',
    bazaarMyket: 'بازار / مایکت',
  },
  en: {
    announcement: 'Important notice: some flights today are delayed due to weather conditions — check the latest flight status',
    annView: 'View',
    annClose: 'Close',
    heroBadge: 'Up to 5% cashback on every flight',
    heroTitle: 'Book your next flight with blujet',
    heroSub: 'Over 200 domestic and international destinations, the best prices, 24/7 support, and rewards on every trip.',
    heroCta: 'See offers',
    economyCabin: 'Economy',
    airlineBadge: 'Partner Airlines',
    airlineTitle: 'Fly with 45+ trusted international airlines',
    airlineSub: 'All flights are booked with officially licensed airlines and travel insurance coverage.',
    airlineBtn: 'View Airlines',
    tripOneWay: 'One-way',
    tripRoundTrip: 'Round-trip',
    tripMultiCity: 'Multi-city',
    tabBook: 'Book Flight',
    tabManage: 'Manage Booking',
    tabStatus: 'Flight Status',
    lblOrigin: 'From',
    lblDestination: 'To',
    lblDepartDate: 'Departure date',
    selectPlaceholder: 'Select',
    btnSearchFlight: 'Search Flights',
    popularRoutesTitle: 'Popular Routes',
    popularRoutesSub: 'The best fares on the most popular routes',
    toman: 'Toman',
    quickLinks: ['Seat Selection', 'Extra Baggage', 'Change & Refund', 'Flight Status'],
    quickLinkHrefs: ['/results', '/results', '/ticket', '/flight-status'],
    limitedTime: 'Limited Time',
    specialOffersTitle: 'Special Offers',
    specialOffersSub: 'Time-limited discounts on the most popular routes — while seats last',
    viewAllOffers: 'View all offers',
    off: 'OFF',
    deadlinePrefix: 'Deadline: ',
    today: 'Today',
    daySuffix: ' days',
    book: 'Book',
    saleBadge: 'blujet Summer Sale',
    saleTitle: 'Up to 40% off international flights',
    saleSub: "Book before summer ends — seats are limited, don't miss out.",
    saleBtn: 'View Flights',
    loyaltyEyebrow: 'Loyalty Club Card',
    loyaltyTitle: 'Reach the points threshold, get your membership card',
    loyaltySub: 'You qualify for a card from 5,000 points; your request is sent to the admin and the card is issued once approved.',
    loyaltyCta: 'View Tiers & Terms',
    tierSilver: 'Silver',
    tierSilverRange: '0 to 5,000 points',
    tierGold: 'Gold',
    tierGoldRange: '5,000 to 15,000',
    tierPlatinum: 'Platinum',
    tierPlatinumRange: 'Above 15,000',
    appEyebrow: 'blujet App',
    appTitle: 'Take your trip with you',
    appSub: 'Faster booking, ticket management, digital boarding pass, and the latest deals — all in the mobile app (this site is installable as a PWA).',
    appStore: 'App Store',
    googlePlay: 'Google Play',
    bazaarMyket: 'Bazaar / Myket',
  },
  ar: {
    announcement: 'إشعار هام: قد تتأخر بعض رحلات اليوم بسبب الأحوال الجوية — تحقق من آخر حالة للرحلات',
    annView: 'عرض',
    annClose: 'إغلاق',
    heroBadge: 'احصل على استرداد نقدي حتى ٥٪ في كل رحلة',
    heroTitle: 'احجز رحلتك القادمة مع blujet',
    heroSub: 'أكثر من ٢٠٠ وجهة داخلية ودولية بأفضل الأسعار، مع دعم على مدار الساعة ونقاط في كل رحلة.',
    heroCta: 'عرض العروض',
    economyCabin: 'اقتصادية',
    airlineBadge: 'شركات الطيران الشريكة',
    airlineTitle: 'طيران مع أكثر من ٤٥ شركة طيران دولية موثوقة',
    airlineSub: 'جميع الرحلات محجوزة مع شركات طيران مرخصة رسمياً وتغطية تأمين السفر.',
    airlineBtn: 'عرض شركات الطيران',
    tripOneWay: 'ذهاب فقط',
    tripRoundTrip: 'ذهاب وإياب',
    tripMultiCity: 'متعدد المدن',
    tabBook: 'حجز الرحلة',
    tabManage: 'إدارة الحجز',
    tabStatus: 'حالة الرحلة',
    lblOrigin: 'من',
    lblDestination: 'إلى',
    lblDepartDate: 'تاريخ المغادرة',
    selectPlaceholder: 'اختر',
    btnSearchFlight: 'البحث عن رحلات',
    popularRoutesTitle: 'المسارات الأكثر طلبًا',
    popularRoutesSub: 'أرخص الأسعار على أكثر المسارات طلبًا',
    toman: 'تومان',
    quickLinks: ['اختيار المقعد', 'شراء أمتعة إضافية', 'تغيير واسترداد التذكرة', 'الاستعلام عن حالة الرحلة'],
    quickLinkHrefs: ['/results', '/results', '/ticket', '/flight-status'],
    limitedTime: 'وقت محدود',
    specialOffersTitle: 'عروض خاصة',
    specialOffersSub: 'خصومات لفترة محدودة على أكثر المسارات طلبًا — حتى نفاد المقاعد',
    viewAllOffers: 'عرض كل العروض',
    off: 'خصم',
    deadlinePrefix: 'الموعد النهائي: ',
    today: 'اليوم',
    daySuffix: ' يوم',
    book: 'حجز',
    saleBadge: 'تخفيضات blujet الصيفية',
    saleTitle: 'خصم حتى ٤٠٪ على الرحلات الدولية',
    saleSub: 'احجز قبل نهاية الموسم لرحلات الصيف — المقاعد محدودة، لا تفوّت الفرصة.',
    saleBtn: 'عرض الرحلات',
    loyaltyEyebrow: 'بطاقة عضوية النادي',
    loyaltyTitle: 'احصل على بطاقة العضوية عند بلوغ حد النقاط',
    loyaltySub: 'عند بلوغ ٥٬٠٠٠ نقطة تصبح مؤهلاً للحصول على البطاقة؛ يُرسل الطلب إلى الإدارة وتُصدر بطاقتك بعد الموافقة.',
    loyaltyCta: 'عرض الشروط والمستويات',
    tierSilver: 'فضي',
    tierSilverRange: 'من ٠ إلى ٥٬٠٠٠ نقطة',
    tierGold: 'ذهبي',
    tierGoldRange: 'من ٥٬٠٠٠ إلى ١٥٬٠٠٠ نقطة',
    tierPlatinum: 'بلاتيني',
    tierPlatinumRange: 'أكثر من ١٥٬٠٠٠',
    appEyebrow: 'تطبيق blujet',
    appTitle: 'خذ رحلتك معك',
    appSub: 'حجز أسرع، إدارة التذاكر، بطاقة صعود رقمية وأحدث الخصومات — كل ذلك في تطبيق الهاتف.',
    appStore: 'App Store',
    googlePlay: 'Google Play',
    bazaarMyket: 'بازار / مايكت',
  },
};

const APP_LINK_LABELS: Record<AppLinkId, 'appStore' | 'googlePlay' | 'bazaarMyket'> = {
  app_store: 'appStore',
  google_play: 'googlePlay',
  bazaar_myket: 'bazaarMyket',
};

function photoTag(city: string, locale: StoredLocale): string {
  if (locale === 'en') return `[ ${city} photo ]`;
  if (locale === 'ar') return `[ صورة ${city} ]`;
  return `[ عکس ${city} ]`;
}

const ERR: Record<StoredLocale, { airports: string; missing: string; sameCity: string }> = {
  fa: {
    airports: 'خطا در دریافت فهرست فرودگاه‌ها.',
    missing: 'مبدأ، مقصد و تاریخ را انتخاب کنید.',
    sameCity: 'مبدأ و مقصد نمی‌توانند یکسان باشند.',
  },
  en: {
    airports: 'Error loading the airport list.',
    missing: 'Select an origin, destination, and date.',
    sameCity: 'Origin and destination cannot be the same.',
  },
  ar: {
    airports: 'خطأ في تحميل قائمة المطارات.',
    missing: 'اختر المبدأ والمقصد والتاريخ.',
    sameCity: 'لا يمكن أن يتطابق المبدأ والمقصد.',
  },
};

export default function HomeSearchPage() {
  const navigate = useNavigate();
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const { containerRef: offersScrollRef, dragScrollProps: offersDragScrollProps } = useHorizontalDragScroll();
  const t = STR[locale];
  const e = ERR[locale];
  const [airports, setAirports] = useState<Airport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [annClosed, setAnnClosed] = useState(false);
  const [homeContent, setHomeContent] = useState<PublicHomeContent | null>(null);
  const [appLinks, setAppLinks] = useState<{ id: AppLinkId; url: string }[]>([]);
  const [topTab, setTopTab] = useState<'book' | 'manage' | 'status'>('book');
  const [searching, setSearching] = useState(false);
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');

  function scrollToOffers() {
    const el = document.getElementById('offers');
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  function handleSearchSubmit(url: string, meta?: { origin: string; dest: string }) {
    if (meta) {
      setSearchFrom(meta.origin);
      setSearchTo(meta.dest);
    }
    setSearching(true);
    window.setTimeout(() => {
      setSearching(false);
      navigate(url);
    }, 1600);
  }

  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch(() => setError(e.airports));
    fetchPublicHomeContent(locale)
      .then(setHomeContent)
      .catch(() => {
        /* keep static fallbacks */
      });
    fetchPublicAppLinks()
      .then((res) => setAppLinks(res.links.map((l) => ({ id: l.id, url: l.url }))))
      .catch(() => {
        /* static labels without links */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const blockMap = useMemo(
    () => new Map((homeContent?.blocks ?? []).map((b) => [b.key, b])),
    [homeContent],
  );
  const annBlock = blockMap.get('ANNOUNCEMENT_BAR');
  const heroBlock = blockMap.get('HERO_BANNER');
  const promoBlock = blockMap.get('PROMO_BANNER');

  const popularRoutes = useMemo(() => {
    if (homeContent?.routes?.length) {
      return homeContent.routes.map((r) => ({
        fromCode: r.fromAirportCode,
        toCode: r.toAirportCode,
        tomanPrice: Math.round(Number(r.priceIrr) / 10),
      }));
    }
    return POPULAR_ROUTES_FALLBACK;
  }, [homeContent]);

  const cityName = useMemo(
    () => (code: string, cityFa?: string) =>
      CITY_NAMES[code]?.[locale] ?? cityFa ?? code,
    [locale],
  );

  const gridColsRoutes = isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))';

  const loyaltySlide = (
    <div
      dir={locale === 'en' ? 'ltr' : 'rtl'}
      style={{
        flex: 1,
        minHeight: 220,
        boxSizing: 'border-box',
        background: 'linear-gradient(120deg,#1668c4,#0d3b66)',
        padding: '26px 46px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <div style={{ position: 'absolute', top: -80, left: -40, width: 280, height: 280, borderRadius: '50%', background: '#ffffff14' }} />
      <div style={{ position: 'relative', maxWidth: 440 }}>
        <div style={{ display: 'inline-block', background: '#ffffff22', color: '#fff', padding: '5px 11px', borderRadius: 20, fontSize: '11.5px', fontWeight: 600, marginBottom: 14 }}>
          {t.loyaltyEyebrow}
        </div>
        <h2 style={{ fontSize: '22.5px', fontWeight: 800, color: '#fff', margin: '0 0 10px', letterSpacing: '-.5px' }}>{t.loyaltyTitle}</h2>
        <p style={{ fontSize: 13, color: '#dce8f6', margin: '0 0 16px', lineHeight: 1.75 }}>{t.loyaltySub}</p>
        <button type="button" onClick={() => navigate('/club')} style={{ display: 'inline-block', padding: '10px 21px', background: '#fff', color: '#1668c4', borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
          {t.loyaltyCta}
        </button>
      </div>
      <div style={{ position: 'relative', flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, width: 290 }}>
        {[
          ['#cbd5e1', t.tierSilver, t.tierSilverRange],
          ['#e7c66b', t.tierGold, t.tierGoldRange],
          ['#9fd2ff', t.tierPlatinum, t.tierPlatinumRange],
        ].map(([dot, name, range]) => (
          <div key={String(name)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff14', border: '1px solid #ffffff26', borderRadius: 12, padding: '9px 13px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#fff', fontWeight: 800, fontSize: '12.5px' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: dot }} />
              {name}
            </span>
            <span style={{ color: '#cdd9ec', fontSize: '11.5px', fontWeight: 600 }}>{range}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const appSlide = (
    <div
      dir={locale === 'en' ? 'ltr' : 'rtl'}
      style={{
        flex: 1,
        minHeight: 220,
        boxSizing: 'border-box',
        background: '#fff',
        padding: '28px 46px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 30,
        flexWrap: 'wrap',
        width: '100%',
      }}
    >
      <div style={{ flex: 1, minWidth: 300 }}>
        <div style={{ fontSize: '11.5px', color: '#1668c4', fontWeight: 700, marginBottom: 10 }}>{t.appEyebrow}</div>
        <h2 style={{ fontSize: '22.5px', fontWeight: 800, margin: '0 0 12px', color: '#0d2640', letterSpacing: '-.5px' }}>{t.appTitle}</h2>
        <p style={{ fontSize: 13, color: '#3f546b', lineHeight: 1.8, margin: '0 0 20px', maxWidth: 460 }}>{t.appSub}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {APP_LINK_ORDER.map((id) => {
            const link = appLinks.find((l) => l.id === id);
            const label = t[APP_LINK_LABELS[id]];
            const isBazaar = id === 'bazaar_myket';
            const style: React.CSSProperties = {
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: isBazaar ? '#fff' : '#0d2640',
              color: isBazaar ? '#0d2640' : '#fff',
              padding: '9px 16px',
              borderRadius: 12,
              fontSize: '12.5px',
              fontWeight: 600,
              border: isBazaar ? '1.5px solid #d5e1f0' : 'none',
              textDecoration: 'none',
              fontFamily: 'inherit',
              cursor: link ? 'pointer' : 'default',
              opacity: link ? 1 : 0.85,
            };
            if (link) {
              return (
                <a key={id} href={link.url} target="_blank" rel="noopener noreferrer" data-testid={`app-link-${id}`} style={style}>
                  {!isBazaar && <span style={{ fontSize: '14.5px' }}>⬇</span>}
                  {label}
                </a>
              );
            }
            return (
              <span key={id} data-testid={`app-link-${id}`} style={style}>
                {!isBazaar && <span style={{ fontSize: '14.5px' }}>⬇</span>}
                {label}
              </span>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 'none', width: 230, height: 172, borderRadius: 18, background: 'linear-gradient(160deg,#cfe0f5,#e8eef6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5e7fa8', fontFamily: "'Roboto Mono',monospace", fontSize: 11 }}>
        App mockup
      </div>
    </div>
  );

  return (
    <PublicPageShell>
      {!annClosed && (annBlock?.enabled !== false) && (
        <div style={{ background: 'linear-gradient(90deg,#0a1f36,#0d2640 40%,#123457)', color: '#fff', position: 'relative', zIndex: 40 }}>
          <div style={{ maxWidth: 1320, margin: '0 auto', padding: isMobile ? '8px 44px 8px 14px' : '11px 26px', display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'center', gap: 14, flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
            <span style={{ fontSize: isMobile ? '11.5px' : '13.5px', fontWeight: 800, textAlign: isMobile ? 'right' : 'center' }}>{annBlock?.title || t.announcement}</span>
            <button
              type="button"
              onClick={() => navigate('/flight-status')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f2c94c', color: '#0d2640', padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer', flex: 'none', fontFamily: 'inherit' }}
            >
              {annBlock?.buttonText || t.annView} <span style={{ fontSize: 12 }}>{locale === 'en' ? '→' : '←'}</span>
            </button>
            <button
              type="button"
              data-testid="ann-close"
              onClick={() => setAnnClosed(true)}
              aria-label={t.annClose}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'rgba(255,255,255,.12)',
                color: '#cfe0f2',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <section style={{ background: '#f6f8fb' }}>
        <div
          style={{
            position: 'relative',
            height: isMobile ? 380 : 500,
            overflow: 'hidden',
            background: heroBlock?.imageUrl
              ? `linear-gradient(110deg,rgba(11,33,56,.8) 0%,rgba(11,33,56,.45) 50%,rgba(11,33,56,.1) 100%), url(${heroBlock.imageUrl}) center/cover no-repeat`
              : 'linear-gradient(110deg,#0d2640 0%,#123a63 50%,#1668c4 100%)',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
            <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 26px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ maxWidth: 600 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    background: '#ffffffe6',
                    border: '1px solid #fff',
                    padding: '6px 11px',
                    borderRadius: 30,
                    fontSize: '11.5px',
                    color: '#0d3b66',
                    fontWeight: 600,
                    marginBottom: 20,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1f8a5b' }} /> {heroBlock?.badgeText || t.heroBadge}
                </div>
                <h1 style={{ fontSize: isMobile ? '26px' : '41.5px', lineHeight: 1.18, fontWeight: 900, margin: '0 0 16px', letterSpacing: '-1px', color: '#fff', textShadow: '0 2px 18px rgba(11,33,56,.55)' }}>
                  {heroBlock?.title || t.heroTitle}
                </h1>
                <p style={{ fontSize: isMobile ? '13.5px' : 16, lineHeight: 1.75, color: '#eaf1fb', margin: '0 0 24px', maxWidth: 500, textShadow: '0 1px 10px rgba(11,33,56,.55)' }}>
                  {heroBlock?.subtitle || t.heroSub}
                </p>
                <button
                  type="button"
                  data-testid="hero-cta"
                  onClick={scrollToOffers}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    background: '#ffffff',
                    color: '#0d2640',
                    padding: '11px 23px',
                    borderRadius: 11,
                    fontSize: '13.5px',
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: '0 12px 28px -14px rgba(11,33,56,.5)',
                  }}
                >
                  {heroBlock?.buttonText || t.heroCta}{' '}
                  <span style={{ fontSize: '15.5px' }}>{locale === 'en' ? '→' : '←'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 26px 38px', position: 'relative' }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 34px 74px -26px rgba(13,38,102,.45)',
              border: '1px solid #eef1f5',
              marginTop: isMobile ? -46 : -72,
              position: 'relative',
              zIndex: 30,
            }}
          >
            <div style={{ display: 'flex', borderBottom: '1px solid #eef1f5', borderRadius: '18px 18px 0 0', overflow: 'hidden' }}>
              {([
                ['book', t.tabBook],
                ['manage', t.tabManage],
                ['status', t.tabStatus],
              ] as const).map(([key, label]) => {
                const active = topTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    data-testid={`top-tab-${key}`}
                    onClick={() => setTopTab(key)}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '15px 6px 12px',
                      fontSize: 13,
                      fontWeight: active ? 800 : 600,
                      cursor: 'pointer',
                      color: active ? '#0d2640' : '#8a96a6',
                      border: 'none',
                      borderBottom: active ? '3px solid #1668c4' : '3px solid transparent',
                      background: 'transparent',
                      fontFamily: 'inherit',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div
              style={{
                padding: '16px 16px 16px',
                background: isMobile ? 'linear-gradient(135deg,#0d2640,#16406e)' : '#fff',
                borderRadius: '0 0 17px 17px',
              }}
            >
              {error && topTab === 'book' && (
                <p style={{ marginBottom: 12, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>{error}</p>
              )}

              {topTab === 'book' && (
                <FlightSearchForm
                  airports={airports}
                  locale={locale}
                  onError={setError}
                  onSubmit={handleSearchSubmit}
                />
              )}
              {topTab === 'manage' && <HomeManageTab locale={locale} />}
              {topTab === 'status' && <HomeStatusTab locale={locale} />}
            </div>
          </div>

          {!isMobile && (
          <div style={{ marginTop: 36 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 15 }}>
              <span style={{ fontSize: '14.5px', color: '#0d2640', fontWeight: 800 }}>{t.popularRoutesTitle}</span>
              <span style={{ fontSize: '11.5px', color: '#5a6678' }}>{t.popularRoutesSub}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: gridColsRoutes, gap: 10 }}>
              {popularRoutes.map((r) => (
                <button
                  type="button"
                  key={`${r.fromCode}-${r.toCode}`}
                  data-testid={`popular-route-${r.toCode}`}
                  onClick={() => navigate(`/results?origin=${r.fromCode}&dest=${r.toCode}&date=${TODAY_ISO}`)}
                  style={{
                    textAlign: locale === 'en' ? 'left' : 'right',
                    background: '#fff',
                    border: '1px solid #e8eef6',
                    borderRadius: 12,
                    padding: '10px 11px',
                    boxShadow: '0 12px 28px -20px rgba(13,38,102,.45)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#16202e', marginBottom: 3 }}>
                    {cityName(r.fromCode)} <span style={{ color: '#b9c2cf', fontWeight: 600 }}>{locale === 'en' ? '→' : '←'}</span> {cityName(r.toCode)}
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#1668c4', fontWeight: 800 }}>
                    {formatToman(r.tomanPrice, locale)} <span style={{ fontSize: 9, fontWeight: 400, color: '#8a96a6' }}>{t.toman}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          )}

          {isMobile && (
            <div
              data-testid="mobile-airline-banner"
              style={{
                marginTop: 30,
                position: 'relative',
                borderRadius: 18,
                overflow: 'hidden',
                minHeight: 150,
                boxShadow: '0 14px 34px -22px rgba(13,38,102,.4)',
                background: 'linear-gradient(100deg,#0d2666 0%,#1668c4 60%,#3f8ede 100%)',
              }}
            >
              <div style={{ position: 'relative', zIndex: 2, padding: 20 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ffffff22', color: '#fff', padding: '4px 10px', borderRadius: 20, fontSize: '10.5px', fontWeight: 700, marginBottom: 11 }}>
                  {t.airlineBadge}
                </div>
                <div style={{ fontSize: '16.5px', fontWeight: 800, color: '#fff', marginBottom: 7, lineHeight: 1.5 }}>{t.airlineTitle}</div>
                <p style={{ fontSize: 12, color: '#cfe0f5', margin: '0 0 15px', lineHeight: 1.8, maxWidth: 280 }}>{t.airlineSub}</p>
                <button
                  type="button"
                  onClick={() => navigate('/destinations')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', color: '#0d2640', padding: '9px 18px', borderRadius: 11, fontSize: '12.5px', fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {t.airlineBtn} <span>{locale === 'en' ? '→' : '←'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <FeatureQuickLinks locale={locale} labels={t.quickLinks} hrefs={t.quickLinkHrefs} />

      {/* SPECIAL OFFERS */}
      <section id="offers" style={{ maxWidth: 1180, margin: '0 auto', padding: '44px 26px 7px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eaf6ef', color: '#1f8a5b', padding: '4px 10px', borderRadius: 20, fontSize: '11.5px', fontWeight: 700, marginBottom: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1f8a5b' }} />
              {t.limitedTime}
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-.5px', color: '#16202e' }}>{t.specialOffersTitle}</h2>
            <p style={{ fontSize: 12, color: '#6b7585', margin: 0 }}>{t.specialOffersSub}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/destinations')}
            style={{ fontSize: '12.5px', color: '#1668c4', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', fontFamily: 'inherit' }}
          >
            <span>{locale === 'en' ? '→' : '←'}</span>{t.viewAllOffers}
          </button>
        </div>
        <div
          ref={isMobile ? offersScrollRef : undefined}
          className={isMobile ? 'hscroll' : undefined}
          {...(isMobile ? offersDragScrollProps : {})}
          style={{
            display: isMobile ? 'flex' : 'grid',
            gridTemplateColumns: isMobile ? undefined : 'repeat(4, 1fr)',
            gap: 18,
            ...(isMobile ? horizontalScrollStyle : {}),
            paddingBottom: isMobile ? 8 : 0,
          }}
        >
          {OFFERS.map((o) => (
            <button
              type="button"
              key={`${o.fromCode}-${o.toCode}`}
              data-testid={`offer-${o.fromCode}-${o.toCode}`}
              onClick={() => navigate(`/results?origin=${o.fromCode}&dest=${o.toCode}&date=${TODAY_ISO}`)}
              style={{
                textAlign: locale === 'en' ? 'left' : 'right',
                background: '#fff',
                border: '1px solid #e8eef6',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 14px 34px -22px rgba(13,38,102,.4)',
                display: 'flex',
                flexDirection: 'column',
                flex: isMobile ? '0 0 calc(50% - 9px)' : undefined,
                touchAction: isMobile ? 'pan-x' : undefined,
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: 0,
              }}
            >
              <div style={{ position: 'relative', height: 100, background: o.grad, display: 'flex', alignItems: 'flex-end', padding: 8, width: '100%', boxSizing: 'border-box' }}>
                <span style={{ position: 'absolute', top: 12, right: 12, background: '#1f8a5b', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 9 }}>
                  {formatLocalePercent(o.offPct, locale)} {t.off}
                </span>
                <span style={{ position: 'absolute', top: 13, left: 13, fontFamily: "'Roboto Mono',monospace", fontSize: '8.5px', color: '#5e7fa8' }}>
                  {photoTag(CITY_NAMES[o.toCode]?.[locale] ?? o.toCode, locale)}
                </span>
                <span style={{ background: '#0d2640', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>{t.economyCabin}</span>
              </div>
              <div style={{ padding: 11, width: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#16202e', marginBottom: 9 }}>
                  {CITY_NAMES[o.fromCode]?.[locale]} <span style={{ color: '#b9c2cf', fontWeight: 600 }}>{locale === 'en' ? '→' : '←'}</span> {CITY_NAMES[o.toCode]?.[locale]}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 13 }}>
                  <span style={{ fontSize: '11.5px', color: '#6b7787', textDecoration: 'line-through' }}>{formatToman(o.was, locale)}</span>
                  <span style={{ fontSize: '14.5px', fontWeight: 900, color: '#1668c4' }}>{formatToman(o.now, locale)}</span>
                  <span style={{ fontSize: 11, color: '#6b7585' }}>{t.toman}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '10.5px', color: '#e5484d', fontWeight: 700 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e5484d' }} />
                    {t.deadlinePrefix}{o.deadlineDays === 'today' ? t.today : `${formatToman(o.deadlineDays, locale)}${t.daySuffix}`}
                  </span>
                  <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#fff', background: '#1668c4', padding: '6px 13px', borderRadius: 9 }}>{t.book}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {(promoBlock?.enabled !== false) && (
      <section style={{ maxWidth: 1180, margin: '44px auto 0', padding: '0 26px' }}>
        <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', minHeight: isMobile ? 175 : 208, boxShadow: '0 18px 44px -28px rgba(13,38,102,.4)', background: 'linear-gradient(100deg,#0d2666 0%,#1668c4 60%,#3f8ede 100%)' }}>
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 26, padding: isMobile ? '22px 20px' : '34px 46px', flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 560 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#ffffff22', color: '#fff', padding: '5px 11px', borderRadius: 20, fontSize: '11.5px', fontWeight: 600, marginBottom: 14 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7ee0b0' }} />
                {promoBlock?.badgeText || t.saleBadge}
              </div>
              <h2 style={{ fontSize: isMobile ? 19 : 25, fontWeight: 800, color: '#fff', margin: '0 0 10px', letterSpacing: '-.5px' }}>{promoBlock?.title || t.saleTitle}</h2>
              <p style={{ fontSize: '13.5px', color: '#e7eefb', margin: 0, lineHeight: 1.7, maxWidth: 480 }}>
                {promoBlock?.subtitle || t.saleSub}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/destinations')}
              style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 25px', background: '#fff', color: '#1668c4', borderRadius: 12, fontSize: '13.5px', fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 12px 28px -14px rgba(11,33,56,.5)' }}
            >
              {promoBlock?.buttonText || t.saleBtn} <span style={{ fontSize: '15.5px' }}>{locale === 'en' ? '→' : '←'}</span>
            </button>
          </div>
        </div>
      </section>
      )}

      {!isMobile && (
        <PromoSlider locale={locale} loyaltySlide={loyaltySlide} appSlide={appSlide} />
      )}

      <SearchLoadingOverlay
        locale={locale}
        visible={searching}
        originCode={searchFrom}
        destCode={searchTo}
        airports={airports}
      />
    </PublicPageShell>
  );
}

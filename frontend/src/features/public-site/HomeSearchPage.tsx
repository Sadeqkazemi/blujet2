import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAirports } from '../../api/publicSite';
import { fetchPublicHomeContent } from '../../api/site-content';
import { fetchPublicAppLinks } from '../../api/settings';
import type { AppLinkId } from '../../types/app-links';
import type { Airport } from '../../types/public-site';
import type { PublicHomeContent } from '../../types/site-content';
import PublicPageShell from '../../components/public/PublicPageShell';
import JalaliDatePicker from '../../components/JalaliDatePicker';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import { formatLocalePercent, formatToman } from '../../lib/fa-format';
import { destinationGradient } from './site-content-shared';

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

const COUNTRY_NAMES: Record<string, Record<StoredLocale, string>> = {
  IST: { fa: 'ترکیه', en: 'Turkey', ar: 'تركيا' },
  DXB: { fa: 'امارات', en: 'UAE', ar: 'الإمارات' },
  MHD: { fa: 'ایران', en: 'Iran', ar: 'إيران' },
  KIH: { fa: 'ایران', en: 'Iran', ar: 'إيران' },
};

const APP_LINK_ORDER: AppLinkId[] = ['app_store', 'google_play', 'bazaar_myket'];

const DEST_HOURS: Record<string, number> = {
  IST: 3,
  DXB: 2,
  MHD: 1.5,
  KIH: 1.5,
  SYZ: 1.5,
  THR: 1,
};

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

const POPULAR_DESTS_FALLBACK: { code: string; hours: number; tomanPrice: number; grad: string }[] = [
  { code: 'IST', hours: 3, tomanPrice: 4_200_000, grad: 'linear-gradient(160deg,#bcd6f2,#e3eefb)' },
  { code: 'DXB', hours: 2, tomanPrice: 3_800_000, grad: 'linear-gradient(160deg,#c8d9ec,#e8eef6)' },
  { code: 'MHD', hours: 1.5, tomanPrice: 1_600_000, grad: 'linear-gradient(160deg,#bfe0d8,#e6f2ee)' },
  { code: 'KIH', hours: 1.5, tomanPrice: 2_100_000, grad: 'linear-gradient(160deg,#cdd9ec,#eaeff7)' },
];

const STR: Record<StoredLocale, {
  announcement: string;
  annView: string;
  annClose: string;
  heroBadge: string;
  heroTitle: string;
  heroSub: string;
  tripOneWay: string;
  tripRoundTrip: string;
  tripMultiCity: string;
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
  popularDestTitle: string;
  popularDestSub: string;
  viewAllDest: string;
  flightHours: (h: number) => string;
  from: string;
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
    tripOneWay: 'یک‌طرفه',
    tripRoundTrip: 'رفت و برگشت',
    tripMultiCity: 'چندمسیره',
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
    popularDestTitle: 'مقصدهای محبوب',
    popularDestSub: 'پرطرفدارترین پروازها با بهترین قیمت',
    viewAllDest: 'مشاهده همه مقصدها',
    flightHours: (h) => `${formatToman(h, 'fa')} ساعت پرواز`,
    from: 'از',
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
    tripOneWay: 'One-way',
    tripRoundTrip: 'Round-trip',
    tripMultiCity: 'Multi-city',
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
    popularDestTitle: 'Popular Destinations',
    popularDestSub: 'The most popular flights at the best prices',
    viewAllDest: 'View all destinations',
    flightHours: (h) => `${formatToman(h, 'en')}h flight`,
    from: 'From',
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
    tripOneWay: 'ذهاب فقط',
    tripRoundTrip: 'ذهاب وإياب',
    tripMultiCity: 'متعدد المدن',
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
    popularDestTitle: 'الوجهات الشائعة',
    popularDestSub: 'أكثر الرحلات طلبًا بأفضل الأسعار',
    viewAllDest: 'عرض جميع الوجهات',
    flightHours: (h) => `${formatToman(h, 'ar')} ساعة طيران`,
    from: 'من',
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
  const t = STR[locale];
  const e = ERR[locale];
  const [airports, setAirports] = useState<Airport[]>([]);
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [dateIso, setDateIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [annClosed, setAnnClosed] = useState(false);
  const [homeContent, setHomeContent] = useState<PublicHomeContent | null>(null);
  const [appLinks, setAppLinks] = useState<{ id: AppLinkId; url: string }[]>([]);

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

  const popularDests = useMemo(() => {
    if (homeContent?.destinations?.length) {
      return homeContent.destinations.map((d, i) => ({
        code: d.airportCode,
        hours: DEST_HOURS[d.airportCode] ?? 2,
        tomanPrice: Math.round(Number(d.priceIrr) / 10),
        grad: destinationGradient(i),
        imageUrl: d.imageUrl,
      }));
    }
    return POPULAR_DESTS_FALLBACK;
  }, [homeContent]);

  const cityName = useMemo(
    () => (code: string, cityFa?: string) =>
      CITY_NAMES[code]?.[locale] ?? cityFa ?? code,
    [locale],
  );

  const cityLabel = useMemo(
    () => (code: string) => {
      const airport = airports.find((a) => a.code === code);
      return airport ? `${CITY_NAMES[code]?.[locale] ?? airport.cityFa} (${code})` : code;
    },
    [airports, locale],
  );

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!origin || !dest || !dateIso) {
      setError(e.missing);
      return;
    }
    if (origin === dest) {
      setError(e.sameCity);
      return;
    }
    navigate(`/results?origin=${origin}&dest=${dest}&date=${dateIso.slice(0, 10)}`);
  }

  function swap() {
    setOrigin(dest);
    setDest(origin);
  }

  const gridCols4 = isMobile ? 'repeat(2, 1fr)' : 'repeat(4,1fr)';
  const gridColsRoutes = isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))';

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
        <div style={{ position: 'relative', height: isMobile ? 380 : 420, overflow: 'hidden', background: 'linear-gradient(110deg,#0d2640 0%,#123a63 50%,#1668c4 100%)' }}>
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
                <h1 style={{ fontSize: isMobile ? '26px' : '41.5px', lineHeight: 1.18, fontWeight: 900, margin: '0 0 16px', letterSpacing: '-1px', color: '#fff' }}>
                  {heroBlock?.title || t.heroTitle}
                </h1>
                <p style={{ fontSize: isMobile ? '13.5px' : 16, lineHeight: 1.75, color: '#eaf1fb', margin: '0 0 24px', maxWidth: 500 }}>
                  {heroBlock?.subtitle || t.heroSub}
                </p>
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
            <form onSubmit={onSubmit} style={{ padding: '13px 16px 16px' }}>
              {error && (
                <p style={{ marginBottom: 12, borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>{error}</p>
              )}

              <div style={{ display: 'flex', gap: isMobile ? 14 : 25, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#16202e', fontWeight: 700, fontSize: 13 }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #1668c4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1668c4' }} />
                  </span>
                  {t.tripOneWay}
                </span>
                <span title="Coming soon" style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#c5cedb', fontWeight: 500, fontSize: 13, cursor: 'not-allowed' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #dfe3e9' }} />
                  {t.tripRoundTrip}
                </span>
                <span title="Coming soon" style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#c5cedb', fontWeight: 500, fontSize: 13, cursor: 'not-allowed' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #dfe3e9' }} />
                  {t.tripMultiCity}
                </span>
              </div>

              <div style={{ display: isMobile ? 'grid' : 'flex', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'none', alignItems: 'stretch', position: 'relative', border: isMobile ? 'none' : '1.5px solid #e3e9f1', borderRadius: 14, background: isMobile ? 'transparent' : '#fff', flexWrap: 'wrap', gap: isMobile ? 10 : 0 }}>
                <div style={{ flex: '1.5 1 165px', minWidth: 165, padding: '5px 20px 5px 13px', gridColumn: isMobile ? '1' : 'auto', background: isMobile ? '#fff' : 'transparent', borderRadius: isMobile ? 12 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b7787', fontWeight: 600, marginBottom: 3 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
                      <circle cx="12" cy="11" r="2" />
                    </svg>
                    {t.lblOrigin}
                  </div>
                  <select
                    id="origin"
                    data-testid="home-origin"
                    value={origin}
                    onChange={(ev) => setOrigin(ev.target.value)}
                    style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14.5px', fontWeight: 800, color: origin ? '#0d2640' : '#6b7787', background: 'transparent', fontFamily: 'inherit' }}
                  >
                    <option value="">{t.selectPlaceholder}</option>
                    {airports.map((a) => (
                      <option key={a.id} value={a.code}>
                        {cityLabel(a.code)}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  onClick={swap}
                  style={{
                    alignSelf: 'center',
                    width: 40,
                    height: 40,
                    flex: 'none',
                    borderRadius: '50%',
                    background: '#fff',
                    border: '1.5px solid #e3e9f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1668c4',
                    fontSize: '15.5px',
                    cursor: 'pointer',
                    zIndex: 3,
                    margin: isMobile ? '6px auto' : '0 -20px',
                    boxShadow: '0 3px 10px rgba(13,38,102,.12)',
                    gridColumn: isMobile ? '1 / -1' : 'auto',
                  }}
                >
                  ⇄
                </div>

                <div style={{ flex: '1.5 1 165px', minWidth: 165, padding: '5px 20px', borderRight: isMobile ? 'none' : '1px solid #eef1f5', gridColumn: isMobile ? '2' : 'auto', background: isMobile ? '#fff' : 'transparent', borderRadius: isMobile ? 12 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b7787', fontWeight: 600, marginBottom: 3 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" />
                      <circle cx="12" cy="11" r="2" />
                    </svg>
                    {t.lblDestination}
                  </div>
                  <select
                    id="dest"
                    data-testid="home-dest"
                    value={dest}
                    onChange={(ev) => setDest(ev.target.value)}
                    style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14.5px', fontWeight: 800, color: dest ? '#0d2640' : '#6b7787', background: 'transparent', fontFamily: 'inherit' }}
                  >
                    <option value="">{t.selectPlaceholder}</option>
                    {airports.map((a) => (
                      <option key={a.id} value={a.code}>
                        {cityLabel(a.code)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: '1.1 1 120px', minWidth: 120, borderRight: isMobile ? 'none' : '1px solid #eef1f5', gridColumn: isMobile ? '1 / -1' : 'auto' }}>
                  <JalaliDatePicker label={t.lblDepartDate} value={dateIso} onChange={setDateIso} minDate={TODAY_ISO} testId="home-date" />
                </div>

                <button
                  type="submit"
                  data-testid="home-search-submit"
                  style={{
                    flex: 'none',
                    margin: 8,
                    border: 'none',
                    borderRadius: 11,
                    background: '#1668c4',
                    color: '#fff',
                    padding: '0 28px',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    gridColumn: isMobile ? '1 / -1' : 'auto',
                    height: isMobile ? 44 : 'auto',
                  }}
                >
                  {t.btnSearchFlight}
                </button>
              </div>

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
            </form>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 26px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols4, gap: 13 }}>
          {t.quickLinks.map((label, i) => (
            <button
              type="button"
              key={label}
              onClick={() => navigate(t.quickLinkHrefs[i])}
              style={{
                textAlign: 'center',
                background: '#fff',
                border: '1px solid #eef2f7',
                borderRadius: 16,
                padding: '18px 11px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 9,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#10243d' }}>{label}</div>
            </button>
          ))}
        </div>
      </section>

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
        <div style={{ display: 'grid', gridTemplateColumns: gridCols4, gap: 18 }}>
          {OFFERS.map((o) => (
            <button
              type="button"
              key={`${o.fromCode}-${o.toCode}`}
              data-testid={`offer-${o.fromCode}-${o.toCode}`}
              onClick={() => navigate(`/results?origin=${o.fromCode}&dest=${o.toCode}&date=${TODAY_ISO}`)}
              style={{ textAlign: locale === 'en' ? 'left' : 'right', background: '#fff', border: '1px solid #e8eef6', borderRadius: 16, overflow: 'hidden', boxShadow: '0 14px 34px -22px rgba(13,38,102,.4)', display: 'flex', flexDirection: 'column', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
            >
              <div style={{ position: 'relative', height: 100, background: o.grad, display: 'flex', alignItems: 'flex-end', padding: 8, width: '100%', boxSizing: 'border-box' }}>
                <span style={{ position: 'absolute', top: 12, right: 12, background: '#1f8a5b', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 9 }}>
                  {formatLocalePercent(o.offPct, locale)} {t.off}
                </span>
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

      {/* POPULAR DESTINATIONS */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '39px 26px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 26 }}>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-.5px', color: '#16202e' }}>{t.popularDestTitle}</h2>
            <p style={{ fontSize: 12, color: '#6b7585', margin: 0 }}>{t.popularDestSub}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/destinations')}
            style={{ fontSize: '12.5px', color: '#1668c4', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', fontFamily: 'inherit' }}
          >
            <span>{locale === 'en' ? '→' : '←'}</span>{t.viewAllDest}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols4, gap: 18 }}>
          {popularDests.map((d) => (
            <button
              type="button"
              key={d.code}
              data-testid={`popular-dest-${d.code}`}
              onClick={() => navigate(`/results?origin=THR&dest=${d.code}&date=${TODAY_ISO}`)}
              style={{ textAlign: locale === 'en' ? 'left' : 'right', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 10px 30px -18px rgba(13,38,102,.25)', cursor: 'pointer', border: 'none', fontFamily: 'inherit', padding: 0 }}
            >
              <div
                style={{
                  height: 150,
                  background: d.grad,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: 11,
                  ...(('imageUrl' in d && d.imageUrl)
                    ? {
                        backgroundImage: `linear-gradient(180deg, transparent 20%, rgba(13,38,64,.75)), url(${d.imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : {}),
                }}
              >
                <span style={{ background: '#ffffffe6', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#0d3b66' }}>{t.flightHours(d.hours)}</span>
              </div>
              <div style={{ padding: '11px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#16202e' }}>{cityName(d.code)}</span>
                  <span style={{ fontSize: 11, color: '#6b7787' }}>{COUNTRY_NAMES[d.code]?.[locale]}</span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#6b7585' }}>
                  {t.from}{' '}
                  <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#1668c4' }}>
                    {formatToman(d.tomanPrice, locale)}
                  </span>{' '}
                  {t.toman}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* CLUB MEMBERSHIP BAND */}
      <section style={{ maxWidth: 1180, margin: '28px auto 0', padding: '0 26px' }}>
        <div style={{ borderRadius: 24, overflow: 'hidden', boxShadow: '0 18px 44px -28px rgba(13,38,102,.4)', background: 'linear-gradient(120deg,#1668c4,#0d3b66)', padding: isMobile ? '24px 22px' : '26px 46px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 33, flexWrap: 'wrap', position: 'relative' }}>
          <div style={{ maxWidth: 440 }}>
            <div style={{ display: 'inline-block', background: '#ffffff22', color: '#fff', padding: '5px 11px', borderRadius: 20, fontSize: '11.5px', fontWeight: 600, marginBottom: 14 }}>
              {t.loyaltyEyebrow}
            </div>
            <h2 style={{ fontSize: '22.5px', fontWeight: 800, color: '#fff', margin: '0 0 10px', letterSpacing: '-.5px' }}>{t.loyaltyTitle}</h2>
            <p style={{ fontSize: 13, color: '#dce8f6', margin: '0 0 16px', lineHeight: 1.75 }}>
              {t.loyaltySub}
            </p>
            <button
              type="button"
              onClick={() => navigate('/club')}
              style={{ display: 'inline-block', padding: '10px 21px', background: '#fff', color: '#1668c4', borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}
            >
              {t.loyaltyCta}
            </button>
          </div>
          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, width: isMobile ? '100%' : 290 }}>
            {[
              ['#cbd5e1', t.tierSilver, t.tierSilverRange],
              ['#e7c66b', t.tierGold, t.tierGoldRange],
              ['#9fd2ff', t.tierPlatinum, t.tierPlatinumRange],
            ].map(([dot, name, range]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff14', border: '1px solid #ffffff26', borderRadius: 12, padding: '9px 13px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#fff', fontWeight: 800, fontSize: '12.5px' }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', background: dot }} />
                  {name}
                </span>
                <span style={{ color: '#cdd9ec', fontSize: '11.5px', fontWeight: 600 }}>{range}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APP BAND */}
      <section style={{ maxWidth: 1180, margin: '28px auto 0', padding: '0 26px 49px' }}>
        <div style={{ borderRadius: 24, overflow: 'hidden', boxShadow: '0 18px 44px -28px rgba(13,38,102,.2)', background: '#fff', border: '1px solid #eef1f5', padding: isMobile ? '22px 20px' : '28px 46px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 30, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ fontSize: '11.5px', color: '#1668c4', fontWeight: 700, marginBottom: 10 }}>{t.appEyebrow}</div>
            <h2 style={{ fontSize: '22.5px', fontWeight: 800, margin: '0 0 12px', color: '#0d2640', letterSpacing: '-.5px' }}>{t.appTitle}</h2>
            <p style={{ fontSize: 13, color: '#3f546b', lineHeight: 1.8, margin: '0 0 20px', maxWidth: 460 }}>
              {t.appSub}
            </p>
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
                    <a
                      key={id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`app-link-${id}`}
                      style={style}
                    >
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
        </div>
      </section>
    </PublicPageShell>
  );
}

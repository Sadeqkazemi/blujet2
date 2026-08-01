import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAirports } from '../../api/publicSite';
import { fetchPublicHomeContent } from '../../api/site-content';
import { fetchPublicAppLinks } from '../../api/settings';
import type { AppLinkId } from '../../types/app-links';
import type { Airport } from '../../types/public-site';
import type { PublicHomeContent } from '../../types/site-content';
import PublicPageShell from '../../components/public/PublicPageShell';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import { formatLocalePercent, formatToman } from '../../lib/fa-format';
import { destinationGradient } from './site-content-shared';
import HomeSearchCard from './home/HomeSearchCard';
import HomePromoCarousel from './home/HomePromoCarousel';
import { QUICK_LINK_ICONS } from './home/home-icons';
import { HOME_EXTRA, buildSearchCopy } from './home/home-copy';

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
  const isRTL = locale !== 'en';
  const t = STR[locale];
  const extra = HOME_EXTRA[locale];
  const e = ERR[locale];
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [annClosed, setAnnClosed] = useState(false);
  const [homeContent, setHomeContent] = useState<PublicHomeContent | null>(null);
  const [appLinks, setAppLinks] = useState<{ id: AppLinkId; url: string }[]>([]);

  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch(() => setLoadError(e.airports));
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

  const searchCopy = buildSearchCopy(locale, {
    tripOneWay: t.tripOneWay,
    tripRoundTrip: t.tripRoundTrip,
    tripMultiCity: t.tripMultiCity,
    lblOrigin: t.lblOrigin,
    lblDestination: t.lblDestination,
    lblDepartDate: t.lblDepartDate,
    selectPlaceholder: t.selectPlaceholder,
    cityListLabel: locale === 'en' ? 'Cities with an airport' : locale === 'ar' ? 'مدن بها مطار' : 'شهرهای دارای فرودگاه',
    popularRoutesTitle: t.popularRoutesTitle,
    popularRoutesSub: t.popularRoutesSub,
    toman: t.toman,
    missing: e.missing,
    sameCity: e.sameCity,
  });

  const announcementBar =
    !annClosed && annBlock?.enabled !== false ? (
      <div style={{ background: 'linear-gradient(90deg,#0a1f36,#0d2640 40%,#123457)', color: '#fff', position: 'relative', zIndex: 60 }}>
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: isMobile ? '8px 44px 8px 14px' : '11px 26px', display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'center', gap: 10, flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
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
    ) : null;

  const heroImage = heroBlock?.imageUrl;
  const promoImage = promoBlock?.imageUrl;

  return (
    <PublicPageShell beforeHeader={announcementBar}>
      {loadError && (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '12px 26px 0', color: '#e5484d', fontSize: 13 }}>{loadError}</div>
      )}

      <section style={{ background: '#f6f8fb' }}>
        <div style={{ position: 'relative', height: isMobile ? 380 : 500, overflow: 'hidden', background: heroImage ? undefined : 'linear-gradient(110deg,#0d2640 0%,#123a63 50%,#1668c4 100%)' }}>
          {heroImage && (
            <img src={heroImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(110deg,rgba(11,33,56,.8) 0%,rgba(11,33,56,.45) 50%,rgba(11,33,56,.1) 100%)', zIndex: 1, pointerEvents: 'none' }} />
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
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <span style={{ flex: 'none', width: 7, height: 7, borderRadius: '50%', background: '#1f8a5b' }} /> {heroBlock?.badgeText || t.heroBadge}
                </div>
                <h1 style={{ fontSize: isMobile ? '26px' : '41.5px', lineHeight: 1.18, fontWeight: 900, margin: '0 0 16px', letterSpacing: '-1px', color: '#fff', textShadow: '0 2px 18px rgba(11,33,56,.55)' }}>
                  {heroBlock?.title || t.heroTitle}
                </h1>
                <p style={{ fontSize: isMobile ? '13.5px' : 16, lineHeight: 1.75, color: '#eaf1fb', margin: '0 0 24px', maxWidth: 500, textShadow: '0 1px 10px rgba(11,33,56,.55)' }}>
                  {heroBlock?.subtitle || t.heroSub}
                </p>
                <button
                  type="button"
                  onClick={() => document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth' })}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#ffffff', color: '#0d2640', padding: '11px 23px', borderRadius: 11, fontSize: '13.5px', fontWeight: 800, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 12px 28px -14px rgba(11,33,56,.5)' }}
                >
                  {extra.heroCta} <span style={{ fontSize: '15.5px' }}>{locale === 'en' ? '→' : '←'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <HomeSearchCard locale={locale} isMobile={isMobile} isRTL={isRTL} copy={searchCopy} airports={airports} cityName={cityName} popularRoutes={popularRoutes} />
      </section>

      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '49px 26px 23px' }}>
        <div
          className={isMobile ? 'hscroll' : undefined}
          style={{
            display: isMobile ? 'flex' : 'grid',
            gridTemplateColumns: isMobile ? undefined : 'repeat(4, 1fr)',
            background: '#fff',
            border: '1px solid #eef2f7',
            borderRadius: 16,
            overflowX: isMobile ? 'auto' : 'visible',
            scrollSnapType: isMobile ? 'x mandatory' : undefined,
          }}
        >
          {t.quickLinks.map((label, i) => {
            const Icon = QUICK_LINK_ICONS[i];
            return (
              <button
                type="button"
                key={label}
                onClick={() => navigate(t.quickLinkHrefs[i])}
                style={{
                  textAlign: 'center',
                  padding: '22px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: 'transparent',
                  border: 'none',
                  flex: isMobile ? '0 0 calc(50% - 6.5px)' : undefined,
                  scrollSnapAlign: isMobile ? 'start' : undefined,
                  ...(!isMobile && i > 0 ? { borderLeft: '1px solid #eef2f7' } : {}),
                }}
              >
                <Icon />
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#3b4554', textDecoration: 'underline', textUnderlineOffset: 3 }}>{label}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* SPECIAL OFFERS */}
      <section id="offers" style={{ maxWidth: 1180, margin: '0 auto', padding: '44px 26px 7px', scrollMarginTop: 96 }}>
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
          data-testid="special-offers-scroll"
          className={isMobile ? 'hscroll' : undefined}
          style={{
            display: isMobile ? 'flex' : 'grid',
            gridTemplateColumns: isMobile ? undefined : 'repeat(4, 1fr)',
            gap: 18,
            overflowX: isMobile ? 'auto' : 'visible',
            scrollSnapType: isMobile ? 'x mandatory' : undefined,
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
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: 0,
                flex: isMobile ? '0 0 calc(50% - 9px)' : undefined,
                scrollSnapAlign: isMobile ? 'start' : undefined,
              }}
            >
              <div style={{ position: 'relative', height: 100, background: o.grad, display: 'flex', alignItems: 'flex-end', padding: 8, width: '100%', boxSizing: 'border-box' }}>
                <span style={{ position: 'absolute', top: 12, right: 12, background: '#1f8a5b', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 9 }}>
                  {formatLocalePercent(o.offPct, locale)} {t.off}
                </span>
                <span style={{ position: 'absolute', top: 13, left: 13, fontFamily: 'Roboto Mono, monospace', fontSize: '8.5px', color: '#5e7fa8' }}>
                  {extra.offerImgTags[`${o.fromCode}-${o.toCode}`] ?? ''}
                </span>
                <span style={{ background: '#0d2640', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>{extra.cabinOffer}</span>
              </div>
              <div style={{ padding: 11, width: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#16202e', marginBottom: 9 }}>
                  {CITY_NAMES[o.fromCode]?.[locale]} <span style={{ color: '#b9c2cf', fontWeight: 600 }}>{locale === 'en' ? '→' : '←'}</span> {CITY_NAMES[o.toCode]?.[locale]}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 13 }}>
                  <span style={{ fontSize: '11.5px', color: '#9aa4b2', textDecoration: 'line-through' }}>{formatToman(o.was, locale)}</span>
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
        <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', minHeight: isMobile ? 175 : 208, boxShadow: '0 18px 44px -28px rgba(13,38,102,.4)' }}>
          {promoImage && (
            <img src={promoImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: promoImage ? 'linear-gradient(100deg,rgba(13,38,102,.9) 0%,rgba(22,104,196,.66) 48%,rgba(22,104,196,.12) 100%)' : 'linear-gradient(100deg,#0d2666 0%,#1668c4 60%,#3f8ede 100%)' }} />
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
        <div
          className={isMobile ? 'hscroll' : undefined}
          style={{
            display: isMobile ? 'flex' : 'grid',
            gridTemplateColumns: isMobile ? undefined : 'repeat(4, 1fr)',
            gap: 18,
            overflowX: isMobile ? 'auto' : 'visible',
            scrollSnapType: isMobile ? 'x mandatory' : undefined,
            paddingBottom: isMobile ? 8 : 0,
          }}
        >
          {popularDests.map((d) => (
            <button
              type="button"
              key={d.code}
              data-testid={`popular-dest-${d.code}`}
              onClick={() => navigate(`/results?origin=THR&dest=${d.code}&date=${TODAY_ISO}`)}
              style={{
                textAlign: locale === 'en' ? 'left' : 'right',
                background: '#fff',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 10px 30px -18px rgba(13,38,102,.25)',
                cursor: 'pointer',
                border: 'none',
                fontFamily: 'inherit',
                padding: 0,
                flex: isMobile ? '0 0 calc(50% - 9px)' : undefined,
                scrollSnapAlign: isMobile ? 'start' : undefined,
              }}
            >
              <div
                style={{
                  height: 190,
                  background: d.grad,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: 13,
                  ...(('imageUrl' in d && d.imageUrl)
                    ? {
                        backgroundImage: `linear-gradient(180deg, transparent 20%, rgba(13,38,64,.75)), url(${d.imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : {}),
                }}
              >
                <span style={{ position: 'absolute', top: 14, right: 16, fontFamily: 'Roboto Mono, monospace', fontSize: 10, color: '#5e7fa8' }}>
                  {extra.destImgTags[d.code] ?? ''}
                </span>
                <span style={{ background: '#ffffffe6', padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#0d3b66' }}>{t.flightHours(d.hours)}</span>
              </div>
              <div style={{ padding: '14px 15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#16202e' }}>{cityName(d.code)}</span>
                  <span style={{ fontSize: 12, color: '#9aa4b2' }}>{COUNTRY_NAMES[d.code]?.[locale]}</span>
                </div>
                <div style={{ fontSize: '12.5px', color: '#6b7585' }}>
                  {t.from}{' '}
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#1668c4' }}>
                    {formatToman(d.tomanPrice, locale)}
                  </span>{' '}
                  {t.toman}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {!isMobile && (
        <HomePromoCarousel locale={locale} copy={{ ...t, appMockup: extra.appMockup }} appLinks={appLinks} onLoyaltyClick={() => navigate('/club')} />
      )}
    </PublicPageShell>
  );
}

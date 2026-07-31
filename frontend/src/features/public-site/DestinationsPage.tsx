import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPublicHomeContent } from '../../api/site-content';
import PublicPageShell from '../../components/public/PublicPageShell';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import { formatToman } from '../../lib/fa-format';
import type { PublicHomeContent } from '../../types/site-content';

// Mock catalog matching design-reference/مقاصد.dc.html — presentational
// metadata (duration, badges, map pins) stays static; destination prices,
// cover images, and popular routes read CMS highlights via GET /site-content/home
// with static fallbacks when the API is unavailable.
interface Dest {
  name: Record<StoredLocale, string>;
  code: string;
  region: 'dom' | 'intl';
  tomanPrice: number;
  dur: Record<StoredLocale, string>;
  perWeek: Record<StoredLocale, string>;
  badge?: Record<StoredLocale, string>;
  feat?: boolean;
  hue: [string, string];
  imageUrl?: string | null;
}

const CITY_NAMES: Record<string, Record<StoredLocale, string>> = {
  THR: { fa: 'تهران', en: 'Tehran', ar: 'طهران' },
  MHD: { fa: 'مشهد', en: 'Mashhad', ar: 'مشهد' },
  IST: { fa: 'استانبول', en: 'Istanbul', ar: 'إسطنبول' },
  DXB: { fa: 'دبی', en: 'Dubai', ar: 'دبي' },
  KIH: { fa: 'کیش', en: 'Kish', ar: 'كيش' },
  SYZ: { fa: 'شیراز', en: 'Shiraz', ar: 'شيراز' },
};

const ROUTE_FREQ_FALLBACK: Record<StoredLocale, string> = {
  fa: 'پروازهای هفتگی',
  en: 'Weekly flights',
  ar: 'رحلات أسبوعية',
};

function cityLabel(code: string, cityFa?: string): Record<StoredLocale, string> {
  if (CITY_NAMES[code]) return CITY_NAMES[code];
  const fa = cityFa ?? code;
  return { fa, en: fa, ar: fa };
}

const DESTS: Dest[] = [
  { name: { fa: 'کیش', en: 'Kish', ar: 'كيش' }, code: 'KIH', region: 'dom', tomanPrice: 1_480_000, dur: { fa: '۱ ساعت ۴۵ دقیقه', en: '1h 45m', ar: '١ ساعة و٤٥ دقيقة' }, perWeek: { fa: '۲۸ پرواز در هفته', en: '28 flights/week', ar: '٢٨ رحلة أسبوعيًا' }, badge: { fa: 'پرفروش این فصل', en: 'Popular this season', ar: 'الأكثر مبيعًا هذا الموسم' }, feat: true, hue: ['#1668c4', '#0d3b66'] },
  { name: { fa: 'مشهد', en: 'Mashhad', ar: 'مشهد' }, code: 'MHD', region: 'dom', tomanPrice: 980_000, dur: { fa: '۱ ساعت ۲۵ دقیقه', en: '1h 25m', ar: '١ ساعة و٢٥ دقيقة' }, perWeek: { fa: '۴۲ پرواز در هفته', en: '42 flights/week', ar: '٤٢ رحلة أسبوعيًا' }, hue: ['#caa53a', '#7d651e'] },
  { name: { fa: 'استانبول', en: 'Istanbul', ar: 'إسطنبول' }, code: 'IST', region: 'intl', tomanPrice: 6_800_000, dur: { fa: '۳ ساعت ۱۵ دقیقه', en: '3h 15m', ar: '٣ ساعة و١٥ دقيقة' }, perWeek: { fa: '۱۴ پرواز در هفته', en: '14 flights/week', ar: '١٤ رحلة أسبوعيًا' }, badge: { fa: 'پرواز مستقیم', en: 'Direct flight', ar: 'رحلة مباشرة' }, feat: true, hue: ['#d64545', '#7a2626'] },
  { name: { fa: 'دبی', en: 'Dubai', ar: 'دبي' }, code: 'DXB', region: 'intl', tomanPrice: 5_200_000, dur: { fa: '۲ ساعت ۱۰ دقیقه', en: '2h 10m', ar: '٢ ساعة و١٠ دقيقة' }, perWeek: { fa: '۱۸ پرواز در هفته', en: '18 flights/week', ar: '١٨ رحلة أسبوعيًا' }, hue: ['#1f8a5b', '#0e4a30'] },
  { name: { fa: 'شیراز', en: 'Shiraz', ar: 'شيراز' }, code: 'SYZ', region: 'dom', tomanPrice: 1_150_000, dur: { fa: '۱ ساعت ۲۰ دقیقه', en: '1h 20m', ar: '١ ساعة و٢٠ دقيقة' }, perWeek: { fa: '۲۴ پرواز در هفته', en: '24 flights/week', ar: '٢٤ رحلة أسبوعيًا' }, hue: ['#8a5bc4', '#4a2d70'] },
  { name: { fa: 'اصفهان', en: 'Isfahan', ar: 'أصفهان' }, code: 'IFN', region: 'dom', tomanPrice: 890_000, dur: { fa: '۵۵ دقیقه', en: '55m', ar: '٥٥ دقيقة' }, perWeek: { fa: '۲۱ پرواز در هفته', en: '21 flights/week', ar: '٢١ رحلة أسبوعيًا' }, hue: ['#12809c', '#0a4655'] },
  { name: { fa: 'تبریز', en: 'Tabriz', ar: 'تبريز' }, code: 'TBZ', region: 'dom', tomanPrice: 1_050_000, dur: { fa: '۱ ساعت ۱۰ دقیقه', en: '1h 10m', ar: '١ ساعة و١٠ دقيقة' }, perWeek: { fa: '۱۶ پرواز در هفته', en: '16 flights/week', ar: '١٦ رحلة أسبوعيًا' }, hue: ['#c46a16', '#6e3a0a'] },
  { name: { fa: 'تفلیس', en: 'Tbilisi', ar: 'تبليسي' }, code: 'TBS', region: 'intl', tomanPrice: 5_900_000, dur: { fa: '۲ ساعت ۳۰ دقیقه', en: '2h 30m', ar: '٢ ساعة و٣٠ دقيقة' }, perWeek: { fa: '۶ پرواز در هفته', en: '6 flights/week', ar: '٦ رحلة أسبوعيًا' }, hue: ['#4a6e8a', '#243d50'] },
  { name: { fa: 'اهواز', en: 'Ahvaz', ar: 'الأهواز' }, code: 'AWZ', region: 'dom', tomanPrice: 950_000, dur: { fa: '۱ ساعت ۵ دقیقه', en: '1h 5m', ar: '١ ساعة و٥ دقائق' }, perWeek: { fa: '۱۹ پرواز در هفته', en: '19 flights/week', ar: '١٩ رحلة أسبوعيًا' }, hue: ['#9c6a12', '#553a08'] },
  { name: { fa: 'نجف', en: 'Najaf', ar: 'النجف' }, code: 'NJF', region: 'intl', tomanPrice: 4_900_000, dur: { fa: '۱ ساعت ۵۰ دقیقه', en: '1h 50m', ar: '١ ساعة و٥٠ دقيقة' }, perWeek: { fa: '۱۰ پرواز در هفته', en: '10 flights/week', ar: '١٠ رحلة أسبوعيًا' }, hue: ['#6a8a4a', '#3a5026'] },
  { name: { fa: 'بندرعباس', en: 'Bandar Abbas', ar: 'بندر عباس' }, code: 'BND', region: 'dom', tomanPrice: 1_320_000, dur: { fa: '۱ ساعت ۵۰ دقیقه', en: '1h 50m', ar: '١ ساعة و٥٠ دقيقة' }, perWeek: { fa: '۱۲ پرواز در هفته', en: '12 flights/week', ar: '١٢ رحلة أسبوعيًا' }, hue: ['#12809c', '#083945'] },
  { name: { fa: 'قشم', en: 'Qeshm', ar: 'قشم' }, code: 'GSM', region: 'dom', tomanPrice: 1_390_000, dur: { fa: '۱ ساعت ۵۵ دقیقه', en: '1h 55m', ar: '١ ساعة و٥٥ دقيقة' }, perWeek: { fa: '۸ پرواز در هفته', en: '8 flights/week', ar: '٨ رحلة أسبوعيًا' }, hue: ['#1668c4', '#123a66'] },
];

interface Route {
  fromName: Record<StoredLocale, string>;
  fromCode: string;
  toName: Record<StoredLocale, string>;
  toCode: string;
  tomanPrice: number;
  freq: Record<StoredLocale, string>;
}

const ROUTES: Route[] = [
  { fromName: { fa: 'تهران', en: 'Tehran', ar: 'طهران' }, fromCode: 'THR', toName: { fa: 'مشهد', en: 'Mashhad', ar: 'مشهد' }, toCode: 'MHD', tomanPrice: 980_000, freq: { fa: 'روزانه ۶ پرواز', en: '6 daily flights', ar: '٦ رحلة يوميًا' } },
  { fromName: { fa: 'تهران', en: 'Tehran', ar: 'طهران' }, fromCode: 'THR', toName: { fa: 'کیش', en: 'Kish', ar: 'كيش' }, toCode: 'KIH', tomanPrice: 1_480_000, freq: { fa: 'روزانه ۴ پرواز', en: '4 daily flights', ar: '٤ رحلة يوميًا' } },
  { fromName: { fa: 'تهران', en: 'Tehran', ar: 'طهران' }, fromCode: 'THR', toName: { fa: 'استانبول', en: 'Istanbul', ar: 'إسطنبول' }, toCode: 'IST', tomanPrice: 6_800_000, freq: { fa: 'روزانه ۲ پرواز', en: '2 daily flights', ar: '٢ رحلة يوميًا' } },
  { fromName: { fa: 'تهران', en: 'Tehran', ar: 'طهران' }, fromCode: 'THR', toName: { fa: 'دبی', en: 'Dubai', ar: 'دبي' }, toCode: 'DXB', tomanPrice: 5_200_000, freq: { fa: 'روزانه ۲ پرواز', en: '2 daily flights', ar: '٢ رحلة يوميًا' } },
  { fromName: { fa: 'مشهد', en: 'Mashhad', ar: 'مشهد' }, fromCode: 'MHD', toName: { fa: 'کیش', en: 'Kish', ar: 'كيش' }, toCode: 'KIH', tomanPrice: 2_100_000, freq: { fa: 'هفته‌ای ۸ پرواز', en: '8 flights/week', ar: '٨ رحلة أسبوعيًا' } },
  { fromName: { fa: 'تهران', en: 'Tehran', ar: 'طهران' }, fromCode: 'THR', toName: { fa: 'نجف', en: 'Najaf', ar: 'النجف' }, toCode: 'NJF', tomanPrice: 4_900_000, freq: { fa: 'هفته‌ای ۱۰ پرواز', en: '10 flights/week', ar: '١٠ رحلة أسبوعيًا' } },
];

const PINS: Record<StoredLocale, string>[] = [
  { fa: 'تهران', en: 'Tehran', ar: 'طهران' },
  { fa: 'مشهد', en: 'Mashhad', ar: 'مشهد' },
  { fa: 'تبریز', en: 'Tabriz', ar: 'تبريز' },
  { fa: 'شیراز', en: 'Shiraz', ar: 'شيراز' },
  { fa: 'اصفهان', en: 'Isfahan', ar: 'أصفهان' },
  { fa: 'کیش', en: 'Kish', ar: 'كيش' },
  { fa: 'اهواز', en: 'Ahvaz', ar: 'الأهواز' },
];
const PIN_POS = [
  { top: '40%', right: '52%' },
  { top: '30%', right: '22%' },
  { top: '20%', right: '72%' },
  { top: '70%', right: '55%' },
  { top: '50%', right: '56%' },
  { top: '82%', right: '46%' },
  { top: '60%', right: '74%' },
];

const STR: Record<StoredLocale, {
  heroEyebrow: string;
  heroTitle: string;
  heroSub: string;
  searchPlaceholder: string;
  destUnit: string;
  tabs: [string, string, string];
  gridTitleSearch: (q: string) => string;
  gridTitleDom: string;
  gridTitleIntl: string;
  gridTitleAll: string;
  gridHint: string;
  domestic: string;
  international: string;
  startingFrom: string;
  toman: string;
  noResultsTitle: string;
  noResultsSub: string;
  mapEyebrow: string;
  mapTitleL1: string;
  mapTitleL2: string;
  mapSub: string;
  statAirports: string;
  statIntl: string;
  statFlightsPerWeek: string;
  routesTitle: string;
  routesSub: string;
}> = {
  fa: {
    heroEyebrow: 'شبکه پروازی blujet · ۱۲ مقصد فعال',
    heroTitle: 'مقصد بعدی شما کجاست؟',
    heroSub: 'از پروازهای روزانه داخلی تا مسیرهای مستقیم بین‌المللی — جستجو کنید و مستقیم به رزرو بروید.',
    searchPlaceholder: 'نام شهر یا کد فرودگاه را بنویسید… مثلاً کیش یا IST',
    destUnit: 'مقصد',
    tabs: ['همه مقاصد', 'پروازهای داخلی', 'پروازهای خارجی'],
    gridTitleSearch: (q) => `نتایج جستجوی «${q}»`,
    gridTitleDom: 'مقاصد داخلی',
    gridTitleIntl: 'مقاصد بین‌المللی',
    gridTitleAll: 'همه مقاصد',
    gridHint: 'با کلیک روی هر مقصد، مستقیم به نتایج پرواز همان مسیر می‌روید',
    domestic: 'داخلی',
    international: 'بین‌المللی',
    startingFrom: 'شروع از',
    toman: 'تومان',
    noResultsTitle: 'مقصدی با این مشخصات پیدا نشد',
    noResultsSub: 'نام شهر یا کد فرودگاه دیگری را امتحان کنید',
    mapEyebrow: 'پوشش پروازی داخلی',
    mapTitleL1: 'از هر جای ایران،',
    mapTitleL2: 'به هر جای ایران',
    mapSub: '۸ فرودگاه داخلی با پروازهای روزانه به هم متصل‌اند. روی هر شهر نقشه کلیک کنید تا مقاصد همان شهر را ببینید.',
    statAirports: 'فرودگاه داخلی',
    statIntl: 'مقصد بین‌المللی',
    statFlightsPerWeek: 'پرواز در هفته',
    routesTitle: 'مسیرهای پرتردد',
    routesSub: 'ارزان‌ترین نرخ در پرطرفدارترین مسیرها',
  },
  en: {
    heroEyebrow: 'blujet flight network · 12 active destinations',
    heroTitle: "Where's your next destination?",
    heroSub: 'From daily domestic flights to direct international routes — search and go straight to booking.',
    searchPlaceholder: 'Type a city name or airport code… e.g. Kish or IST',
    destUnit: 'destinations',
    tabs: ['All destinations', 'Domestic flights', 'International flights'],
    gridTitleSearch: (q) => `Results for "${q}"`,
    gridTitleDom: 'Domestic destinations',
    gridTitleIntl: 'International destinations',
    gridTitleAll: 'All destinations',
    gridHint: "Click any destination to go straight to that route's flight results",
    domestic: 'Domestic',
    international: 'International',
    startingFrom: 'From',
    toman: 'Toman',
    noResultsTitle: 'No destination matches these criteria',
    noResultsSub: 'Try another city name or airport code',
    mapEyebrow: 'Domestic flight coverage',
    mapTitleL1: 'From anywhere in Iran,',
    mapTitleL2: 'to anywhere in Iran',
    mapSub: '8 domestic airports connected by daily flights. Click any city on the map to see its destinations.',
    statAirports: 'Domestic airports',
    statIntl: 'International destinations',
    statFlightsPerWeek: 'Flights per week',
    routesTitle: 'Popular routes',
    routesSub: 'The cheapest fares on the most popular routes',
  },
  ar: {
    heroEyebrow: 'شبكة رحلات blujet · ١٢ وجهة نشطة',
    heroTitle: 'ما هي وجهتك القادمة؟',
    heroSub: 'من الرحلات الداخلية اليومية إلى المسارات الدولية المباشرة — ابحث واذهب مباشرة إلى الحجز.',
    searchPlaceholder: 'اكتب اسم مدينة أو رمز مطار… مثلاً كيش أو IST',
    destUnit: 'وجهة',
    tabs: ['جميع الوجهات', 'الرحلات الداخلية', 'الرحلات الدولية'],
    gridTitleSearch: (q) => `نتائج البحث عن «${q}»`,
    gridTitleDom: 'الوجهات الداخلية',
    gridTitleIntl: 'الوجهات الدولية',
    gridTitleAll: 'جميع الوجهات',
    gridHint: 'انقر على أي وجهة للانتقال مباشرة إلى نتائج رحلات ذلك المسار',
    domestic: 'داخلي',
    international: 'دولي',
    startingFrom: 'يبدأ من',
    toman: 'تومان',
    noResultsTitle: 'لم يتم العثور على وجهة بهذه المواصفات',
    noResultsSub: 'جرّب اسم مدينة أو رمز مطار آخر',
    mapEyebrow: 'تغطية الرحلات الداخلية',
    mapTitleL1: 'من أي مكان في إيران،',
    mapTitleL2: 'إلى أي مكان في إيران',
    mapSub: 'مطارات داخلية متصلة برحلات يومية. انقر على أي مدينة على الخريطة لعرض وجهاتها.',
    statAirports: 'مطار داخلي',
    statIntl: 'وجهة دولية',
    statFlightsPerWeek: 'رحلة أسبوعيًا',
    routesTitle: 'المسارات الأكثر طلبًا',
    routesSub: 'أرخص الأسعار على أكثر المسارات طلبًا',
  },
};

const TODAY_ISO = new Date().toISOString().slice(0, 10);

export default function DestinationsPage() {
  const navigate = useNavigate();
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const [tab, setTab] = useState<'all' | 'dom' | 'intl'>('all');
  const [q, setQ] = useState('');
  const [homeContent, setHomeContent] = useState<PublicHomeContent | null>(null);

  useEffect(() => {
    fetchPublicHomeContent()
      .then(setHomeContent)
      .catch(() => {
        /* static fallbacks */
      });
  }, []);

  const destinations = useMemo(() => {
    const cmsByCode = new Map(
      (homeContent?.destinations ?? []).map((d) => [
        d.airportCode,
        { tomanPrice: Math.round(Number(d.priceIrr) / 10), imageUrl: d.imageUrl },
      ]),
    );
    return DESTS.map((d) => {
      const cms = cmsByCode.get(d.code);
      if (!cms) return d;
      return { ...d, tomanPrice: cms.tomanPrice, imageUrl: cms.imageUrl };
    });
  }, [homeContent]);

  const routes = useMemo(() => {
    if (!homeContent?.routes?.length) return ROUTES;
    const staticByKey = new Map(
      ROUTES.map((r) => [`${r.fromCode}-${r.toCode}`, r]),
    );
    return homeContent.routes.map((r) => {
      const key = `${r.fromAirportCode}-${r.toAirportCode}`;
      const fallback = staticByKey.get(key);
      return {
        fromName: fallback?.fromName ?? cityLabel(r.fromAirportCode, r.fromCityFa),
        fromCode: r.fromAirportCode,
        toName: fallback?.toName ?? cityLabel(r.toAirportCode, r.toCityFa),
        toCode: r.toAirportCode,
        tomanPrice: Math.round(Number(r.priceIrr) / 10),
        freq: fallback?.freq ?? ROUTE_FREQ_FALLBACK,
      };
    });
  }, [homeContent]);

  const query = q.trim();
  const filtered = destinations.filter(
    (d) =>
      (tab === 'all' || d.region === tab) &&
      (!query || d.name[locale].includes(query) || d.code.toUpperCase().includes(query.toUpperCase())),
  );
  const filterActive = tab !== 'all' || !!query;
  const gridTitle = query ? t.gridTitleSearch(query) : tab === 'dom' ? t.gridTitleDom : tab === 'intl' ? t.gridTitleIntl : t.gridTitleAll;

  const goToResults = (destCode: string) =>
    navigate(`/results?origin=THR&dest=${destCode}&date=${TODAY_ISO}`);

  const tabKeys: Array<'all' | 'dom' | 'intl'> = ['all', 'dom', 'intl'];

  return (
    <PublicPageShell>
      {/* HERO + SEARCH */}
      <section style={{ background: 'linear-gradient(160deg,#0d2640 30%,#124a86)', color: '#fff', padding: '53px 22px 49px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -120, left: -80, width: 340, height: 340, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />
        <div style={{ position: 'absolute', bottom: -160, right: '30%', width: 420, height: 420, borderRadius: '50%', background: 'rgba(22,104,196,.25)' }} />
        <div style={{ maxWidth: 1320, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#9fc0e8', marginBottom: 12, letterSpacing: 2 }}>
            {t.heroEyebrow}
          </div>
          <h1 style={{ fontSize: isMobile ? 28 : 42, fontWeight: 900, margin: '0 0 10px', letterSpacing: '-.8px' }}>{t.heroTitle}</h1>
          <p style={{ fontSize: '14.5px', color: '#c9dcf3', margin: '0 auto 27px', maxWidth: 520, lineHeight: 1.9 }}>
            {t.heroSub}
          </p>
          <div style={{ maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 16, boxShadow: '0 26px 60px -20px rgba(0,0,0,.45)', padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7787" strokeWidth="2.2" strokeLinecap="round" style={{ marginRight: 9, flex: 'none' }}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.searchPlaceholder}
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: '13.5px', color: '#16202e', minWidth: 0 }}
            />
            <span style={{ flex: 'none', whiteSpace: 'nowrap', background: '#1668c4', color: '#fff', fontSize: '12.5px', fontWeight: 800, padding: '11px 21px', borderRadius: 11 }}>
              {formatToman(filtered.length, locale)} {t.destUnit}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 15, flexWrap: 'wrap' }}>
            {tabKeys.map((key, i) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  padding: '8px 19px',
                  borderRadius: 22,
                  border: `1.5px solid ${tab === key ? '#fff' : 'rgba(255,255,255,.22)'}`,
                  background: tab === key ? '#fff' : 'rgba(255,255,255,.08)',
                  color: tab === key ? '#1668c4' : '#c9dcf3',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t.tabs[i]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* DESTINATION MOSAIC */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '37px 22px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 17 }}>
          <h2 style={{ fontSize: 21, fontWeight: 900, color: '#0d2640', margin: 0, whiteSpace: 'nowrap' }}>{gridTitle}</h2>
          <span style={{ fontSize: '11.5px', color: '#8a96a6' }}>{t.gridHint}</span>
        </div>
        {filtered.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gridAutoRows: 128, gridAutoFlow: 'dense', gap: 14 }}>
            {filtered.map((d) => (
              <a
                key={d.code}
                data-testid={`dest-card-${d.code}`}
                onClick={(e) => {
                  e.preventDefault();
                  goToResults(d.code);
                }}
                href={`/results?origin=THR&dest=${d.code}&date=${TODAY_ISO}`}
                style={{
                  position: 'relative',
                  gridColumn: `span ${!isMobile && !filterActive && d.feat ? 2 : 1}`,
                  gridRow: 'span 2',
                  borderRadius: 18,
                  overflow: 'hidden',
                  display: 'block',
                  textDecoration: 'none',
                  background: `linear-gradient(135deg,${d.hue[0]},${d.hue[1]})`,
                  backgroundImage: d.imageUrl ? `url(${d.imageUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(13,38,64,0) 40%,rgba(13,38,64,.82))', pointerEvents: 'none' }} />
                {d.badge && (
                  <span style={{ position: 'absolute', top: 12, right: 12, whiteSpace: 'nowrap', background: '#caa53a', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 11px', borderRadius: 14 }}>
                    {d.badge[locale]}
                  </span>
                )}
                <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: '9.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 12, pointerEvents: 'none' }}>
                  {d.region === 'dom' ? t.domestic : t.international}
                </span>
                <div style={{ position: 'absolute', right: 0, left: 0, bottom: 0, padding: '13px 15px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, pointerEvents: 'none' }}>
                  <span style={{ lineHeight: 1.6 }}>
                    <span style={{ display: 'block', color: '#fff', fontSize: '16.5px', fontWeight: 900, textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>
                      {d.name[locale]}{' '}
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#c9dcf3' }} dir="ltr">
                        {d.code}
                      </span>
                    </span>
                    <span style={{ display: 'block', color: '#c9dcf3', fontSize: '10.5px' }}>
                      {d.dur[locale]} · {d.perWeek[locale]}
                    </span>
                  </span>
                  <span style={{ textAlign: 'left', lineHeight: 1.5, whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'block', color: '#9fc0e8', fontSize: 9 }}>{t.startingFrom}</span>
                    <span style={{ display: 'block', color: '#fff', fontSize: 14, fontWeight: 900 }}>
                      {formatToman(d.tomanPrice, locale)} <span style={{ fontSize: 9, fontWeight: 400, color: '#c9dcf3' }}>{t.toman}</span>
                    </span>
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 16, padding: '42px 20px', textAlign: 'center' }}>
            <div style={{ width: 54, height: 54, margin: '0 auto 12px', borderRadius: '50%', background: '#f1f5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              🔍
            </div>
            <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0d2640', marginBottom: 5 }}>{t.noResultsTitle}</div>
            <div style={{ fontSize: 12, color: '#8a96a6' }}>{t.noResultsSub}</div>
          </div>
        )}
      </section>

      {/* MAP BAND */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '33px 22px 8px' }}>
        <div style={{ background: 'linear-gradient(135deg,#0d2640,#123a66)', borderRadius: 22, padding: isMobile ? 20 : 29, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.2fr', gap: 29, alignItems: 'center', color: '#fff' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9fc0e8', marginBottom: 10, letterSpacing: 1.5 }}>{t.mapEyebrow}</div>
            <h2 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 13px', lineHeight: 1.5 }}>
              {t.mapTitleL1}
              <br />
              {t.mapTitleL2}
            </h2>
            <p style={{ fontSize: 13, color: '#c9dcf3', lineHeight: 2, margin: '0 0 21px' }}>
              {t.mapSub}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                [formatToman(8, locale), t.statAirports],
                [formatToman(4, locale), t.statIntl],
                [`+${formatToman(320, locale)}`, t.statFlightsPerWeek],
              ].map(([value, label]) => (
                <div key={label} style={{ background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 13, padding: '11px 17px' }}>
                  <div style={{ fontSize: 19, fontWeight: 900 }}>{value}</div>
                  <div style={{ fontSize: 10, color: '#9fc0e8' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative', background: '#fff', borderRadius: 16, padding: 10 }}>
            <div style={{ position: 'relative', width: '100%', height: 390, background: 'linear-gradient(150deg,#eaf2fb,#d7e6f7)', borderRadius: 12 }}>
              {PINS.map((p, i) => (
                <div
                  key={p.fa}
                  onClick={() => {
                    setQ(p[locale]);
                    setTab('all');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{ position: 'absolute', top: PIN_POS[i].top, right: PIN_POS[i].right, transform: 'translate(50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}
                >
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#1668c4', border: '3px solid #fff', boxShadow: '0 2px 7px rgba(13,38,102,.45)' }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#0d2640', background: '#fff', padding: '2px 7px', borderRadius: 9, whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(13,38,102,.12)' }}>
                    {p[locale]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* POPULAR ROUTES */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '33px 22px 47px' }}>
        <h2 style={{ fontSize: 21, fontWeight: 900, color: '#0d2640', margin: '0 0 5px' }}>{t.routesTitle}</h2>
        <p style={{ fontSize: '12.5px', color: '#6b7585', margin: '0 0 18px' }}>{t.routesSub}</p>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 13 }}>
          {routes.map((r) => (
            <a
              key={`${r.fromCode}-${r.toCode}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`/results?origin=${r.fromCode}&dest=${r.toCode}&date=${TODAY_ISO}`);
              }}
              href={`/results?origin=${r.fromCode}&dest=${r.toCode}&date=${TODAY_ISO}`}
              style={{ textDecoration: 'none', background: '#fff', border: '1px solid #eef1f5', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}
            >
              <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ lineHeight: 1.6 }}>
                  <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 800, color: '#0d2640' }}>
                    {r.fromName[locale]}{' '}
                    <span style={{ fontSize: 10, color: '#8a96a6' }} dir="ltr">
                      {r.fromCode}
                    </span>
                  </span>
                  <span style={{ display: 'block', fontSize: '10.5px', color: '#8a96a6' }}>{r.freq[locale]}</span>
                </span>
                <span style={{ color: '#1668c4', fontSize: 15 }}>✈</span>
                <span style={{ lineHeight: 1.6, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 800, color: '#0d2640' }}>
                    {r.toName[locale]}{' '}
                    <span style={{ fontSize: 10, color: '#8a96a6' }} dir="ltr">
                      {r.toCode}
                    </span>
                  </span>
                  <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#1668c4' }}>
                    {formatToman(r.tomanPrice, locale)} <span style={{ fontSize: 9, fontWeight: 400, color: '#8a96a6' }}>{t.toman}</span>
                  </span>
                </span>
              </span>
            </a>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}

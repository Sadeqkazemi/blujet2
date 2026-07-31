import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPriceLock, fetchClubPoints, fetchSavedFlights, saveFlight, searchFlights } from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import { useAuth } from '../../hooks/useAuth';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import { faDigits, formatToman, localeMoney } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import type { CabinClass, PriceLock, SearchFlightResult } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';
import FlowStepper from '../../components/public/FlowStepper';

// نتایج پرواز — rebuilt to follow design-reference/نتایج پرواز.dc.html:
// search summary bar, 7-day Jalali price calendar, stops/time/airline
// filters, sort tabs, رادار هوشمند قیمت, and قفل قیمت. Real search results
// stay bookable; when the route/date has none, the design's mock schedule
// renders instead (per the mock-only scope — no backend calls beyond the
// single existing search request).

const CABIN_LABEL: Record<string, Record<StoredLocale, string>> = {
  ECONOMY: { fa: 'اکونومی', en: 'Economy', ar: 'اقتصادية' },
  BUSINESS: { fa: 'بیزینس', en: 'Business', ar: 'درجة الأعمال' },
};

interface MockFlight {
  airline: string;
  dep: string;
  arr: string;
  stop: 'direct' | 'one';
  seats: number;
  tomanPrice: number;
}

// Design's own sample flights (from نتایج پرواز.dc.html).
const MOCK_FLIGHTS: MockFlight[] = [
  { airline: 'کاسپین', dep: '۱۶:۴۵', arr: '۱۹:۲۰', stop: 'one', seats: 4, tomanPrice: 3_650_000 },
  { airline: 'blujet', dep: '۰۸:۳۰', arr: '۱۰:۴۵', stop: 'direct', seats: 7, tomanPrice: 3_800_000 },
  { airline: 'قشم‌ایر', dep: '۰۶:۱۵', arr: '۰۸:۳۰', stop: 'direct', seats: 3, tomanPrice: 3_950_000 },
  { airline: 'وارش', dep: '۱۱:۰۰', arr: '۱۳:۱۵', stop: 'direct', seats: 9, tomanPrice: 4_400_000 },
  { airline: 'ماهان', dep: '۱۳:۱۰', arr: '۱۶:۰۰', stop: 'one', seats: 5, tomanPrice: 4_250_000 },
  { airline: 'ایران‌ایر', dep: '۲۰:۰۰', arr: '۲۲:۱۵', stop: 'direct', seats: 6, tomanPrice: 4_100_000 },
];

// Design's 7-day price calendar (هزارتومان), day 12 selected.
const CAL_DAYS = [
  { d: '۱۰ تیر', p: 3650, cheap: true },
  { d: '۱۱ تیر', p: 3950, cheap: false },
  { d: '۱۲ تیر', p: 3800, cheap: false, sel: true },
  { d: '۱۳ تیر', p: 4100, cheap: false },
  { d: '۱۴ تیر', p: 4400, cheap: false },
  { d: '۱۵ تیر', p: 3750, cheap: true },
  { d: '۱۶ تیر', p: 3900, cheap: false },
];

function depHourBucket(dep: string): 'morning' | 'noon' | 'evening' {
  const h = parseInt(dep.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))), 10);
  if (h < 11) return 'morning';
  if (h < 16) return 'noon';
  return 'evening';
}

const GOLD_TIER_LEVELS = ['GOLD', 'PLATINUM'];

type RealLockResult =
  | { kind: 'success'; lock: PriceLock }
  | { kind: 'not-gold' }
  | { kind: 'error'; message: string };

const STR: Record<StoredLocale, {
  changeSearch: string;
  onePassengerEconomy: string;
  emptyTitle: string;
  emptySub: string;
  goToSearch: string;
  stopsLabel: string;
  all: string;
  direct: string;
  oneStop: string;
  timeLabel: string;
  morning: string;
  noon: string;
  evening: string;
  airlineLabel: string;
  aiTitle: string;
  aiSub: string;
  aiAnalyze: string;
  aiAnalyzing: string;
  aiRecommendation: string;
  aiExplain: (flightTime: string, dayLabel: string) => string;
  sortCheap: string;
  sortEarly: string;
  flightsCount: string;
  searching: string;
  mockNotice: string;
  noFlightsForFilters: string;
  seatsLeft: string;
  select: string;
  toman: string;
  priceLock: string;
  saveFlight: string;
  savedFlight: string;
  smartFareLock: string;
  fareLockIntro: (airline: string, dep: string) => string;
  learnAboutClub: string;
  close: string;
  fareLockGoldOnly: string;
  yourPriceLocked: string;
  lockRateUntil: (price: string, until: string) => string;
  fee: string;
  gotIt: string;
  lockFailedTitle: string;
}> = {
  fa: {
    changeSearch: 'تغییر جستجو',
    onePassengerEconomy: '۱ مسافر · اکونومی',
    emptyTitle: 'جستجوی پرواز',
    emptySub: 'برای دیدن نتایج، ابتدا مبدأ، مقصد و تاریخ سفر را انتخاب کنید.',
    goToSearch: 'رفتن به جستجو',
    stopsLabel: 'توقف',
    all: 'همه',
    direct: 'مستقیم',
    oneStop: 'یک توقف',
    timeLabel: 'ساعت حرکت',
    morning: 'صبح',
    noon: 'بعدازظهر',
    evening: 'عصر و شب',
    airlineLabel: 'ایرلاین',
    aiTitle: 'رادار هوشمند قیمت',
    aiSub: 'همین حالا بخرم یا صبر کنم؟ رادار روند قیمت این مسیر را تحلیل می‌کند.',
    aiAnalyze: 'تحلیل کن',
    aiAnalyzing: 'در حال تحلیل…',
    aiRecommendation: 'توصیه: همین حالا بخرید',
    aiExplain: (flightTime, dayLabel) =>
      `احتمال گرانی تا ۴۸ ساعت آینده حدود ۸۰٪ است؛ ارزان‌ترین گزینه، پرواز کاسپین ساعت ${flightTime} است. اگر انعطاف دارید، ${dayLabel} ارزان‌تر است.`,
    sortCheap: 'ارزان‌ترین',
    sortEarly: 'زودترین حرکت',
    flightsCount: 'پرواز',
    searching: 'در حال جستجو…',
    mockNotice: 'این پرواز نمایشی است و ظرفیت آنلاین ندارد — برای رزرو واقعی، مسیر تهران ← مشهد را جستجو کنید یا با پشتیبانی (۰۲۱ — ۹۱۰۰۰۰۰۰) تماس بگیرید.',
    noFlightsForFilters: 'با این فیلترها پروازی نمانده — فیلترها را بازنشانی کنید.',
    seatsLeft: 'صندلی باقی‌مانده',
    select: 'انتخاب',
    toman: 'تومان',
    priceLock: 'قفل قیمت',
    saveFlight: 'ذخیره',
    savedFlight: 'ذخیره شد',
    smartFareLock: 'قفل قیمت هوشمند',
    fareLockIntro: (airline, dep) => `پرواز ${airline} ساعت ${dep} — قفل قیمت تا ۷۲ ساعت مخصوص اعضای سطح طلایی باشگاه مشتریان است.`,
    learnAboutClub: 'آشنایی با باشگاه',
    close: 'بستن',
    fareLockGoldOnly: 'قفل قیمت تا ۷۲ ساعت مخصوص اعضای سطح طلایی و بالاتر باشگاه مشتریان است.',
    yourPriceLocked: 'قیمت شما قفل شد',
    lockRateUntil: (price, until) => `نرخ ${price} تومان تا ${until} برای شما ثابت می‌ماند.`,
    fee: 'کارمزد',
    gotIt: 'متوجه شدم',
    lockFailedTitle: 'قفل قیمت ثبت نشد',
  },
  en: {
    changeSearch: 'Change search',
    onePassengerEconomy: '1 passenger · Economy',
    emptyTitle: 'Search Flights',
    emptySub: 'Select an origin, destination, and travel date first to see results.',
    goToSearch: 'Go to Search',
    stopsLabel: 'Stops',
    all: 'All',
    direct: 'Direct',
    oneStop: '1 stop',
    timeLabel: 'Departure Time',
    morning: 'Morning',
    noon: 'Afternoon',
    evening: 'Evening & night',
    airlineLabel: 'Airline',
    aiTitle: 'Smart Price Radar',
    aiSub: "Buy now or wait? The radar analyzes this route's price trend.",
    aiAnalyze: 'Analyze price',
    aiAnalyzing: 'Analyzing…',
    aiRecommendation: 'Recommendation: Buy now',
    aiExplain: (flightTime, dayLabel) =>
      `There's roughly an 80% chance of a price increase over the next 48 hours; the cheapest option is the Caspian flight at ${flightTime}. If you're flexible, ${dayLabel} is cheaper.`,
    sortCheap: 'Cheapest',
    sortEarly: 'Earliest flight',
    flightsCount: 'flights',
    searching: 'Searching…',
    mockNotice: 'This is a demo flight with no live capacity — search Tehran ← Mashhad for a real booking, or call support (021 — 91000000).',
    noFlightsForFilters: 'No flights left with these filters — try resetting them.',
    seatsLeft: 'seats left',
    select: 'Select',
    toman: 'Toman',
    priceLock: 'Price Lock',
    saveFlight: 'Save',
    savedFlight: 'Saved',
    smartFareLock: 'AI Fare Lock',
    fareLockIntro: (airline, dep) => `${airline} flight at ${dep} — Price Lock for up to 72 hours is exclusive to Gold-tier loyalty club members.`,
    learnAboutClub: 'Learn about the Club',
    close: 'Close',
    fareLockGoldOnly: 'Price Lock for up to 72 hours is exclusive to Gold-tier and above loyalty club members.',
    yourPriceLocked: 'Your price is locked',
    lockRateUntil: (price, until) => `Your fare of ${price} Toman is fixed until ${until}.`,
    fee: 'Fee',
    gotIt: 'Got it',
    lockFailedTitle: 'Price Lock failed',
  },
  ar: {
    changeSearch: 'تغيير البحث',
    onePassengerEconomy: '1 مسافر · اقتصادية',
    emptyTitle: 'البحث عن رحلات',
    emptySub: 'اختر المبدأ والمقصد وتاريخ السفر أولاً لعرض النتائج.',
    goToSearch: 'الذهاب إلى البحث',
    stopsLabel: 'التوقف',
    all: 'الكل',
    direct: 'مباشر',
    oneStop: 'توقف واحد',
    timeLabel: 'وقت المغادرة',
    morning: 'صباحًا',
    noon: 'بعد الظهر',
    evening: 'مساءً وليلاً',
    airlineLabel: 'شركة الطيران',
    aiTitle: 'رادار الأسعار الذكي',
    aiSub: 'هل أشتري الآن أم أنتظر؟ يحلل الرادار اتجاه أسعار هذا المسار.',
    aiAnalyze: 'تحليل السعر',
    aiAnalyzing: 'جارٍ التحليل…',
    aiRecommendation: 'التوصية: اشترِ الآن',
    aiExplain: (flightTime, dayLabel) =>
      `احتمال ارتفاع السعر خلال الـ ٤٨ ساعة القادمة نحو ٨٠٪؛ أرخص خيار هو رحلة كاسپين الساعة ${flightTime}. إذا كان لديك مرونة، فإن ${dayLabel} أرخص.`,
    sortCheap: 'الأرخص',
    sortEarly: 'أبكر رحلة',
    flightsCount: 'رحلة',
    searching: 'جارٍ البحث…',
    mockNotice: 'هذه رحلة تجريبية بدون سعة حقيقية — ابحث عن مسار طهران ← مشهد لحجز حقيقي، أو اتصل بالدعم (٠٢١ — ٩١٠٠٠٠٠٠).',
    noFlightsForFilters: 'لا توجد رحلات بهذه الفلاتر — حاول إعادة ضبطها.',
    seatsLeft: 'مقاعد متبقية',
    select: 'اختيار',
    toman: 'تومان',
    priceLock: 'قفل السعر',
    saveFlight: 'حفظ',
    savedFlight: 'محفوظ',
    smartFareLock: 'قفل السعر الذكي',
    fareLockIntro: (airline, dep) => `رحلة ${airline} الساعة ${dep} — قفل السعر حتى ٧٢ ساعة حصري لأعضاء الفئة الذهبية في نادي العملاء.`,
    learnAboutClub: 'تعرف على النادي',
    close: 'إغلاق',
    fareLockGoldOnly: 'قفل السعر حتى ٧٢ ساعة حصري لأعضاء الفئة الذهبية فما فوق في نادي العملاء.',
    yourPriceLocked: 'تم قفل سعرك',
    lockRateUntil: (price, until) => `سعرك ${price} تومان ثابت حتى ${until}.`,
    fee: 'رسوم',
    gotIt: 'حسنًا',
    lockFailedTitle: 'تعذّر تسجيل قفل السعر',
  },
};

const ERR: Record<StoredLocale, string> = {
  fa: 'خطا در ثبت قفل قیمت.',
  en: 'Could not save the price lock.',
  ar: 'تعذّر حفظ قفل السعر.',
};

export default function ResultsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { status } = useAuth();
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const origin = params.get('origin') ?? '';
  const dest = params.get('dest') ?? '';
  const date = params.get('date') ?? '';

  const [results, setResults] = useState<SearchFlightResult[] | null>(null);
  const [showMock, setShowMock] = useState(false);
  const [mockNotice, setMockNotice] = useState(false);

  // filters / sort / AI radar / price lock
  const [fStops, setFStops] = useState<'all' | 'direct' | 'one'>('all');
  const [fTime, setFTime] = useState<'all' | 'morning' | 'noon' | 'evening'>('all');
  const [fAirline, setFAirline] = useState('all');
  const [sort, setSort] = useState<'cheap' | 'early'>('cheap');
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [lockFor, setLockFor] = useState<MockFlight | null>(null);

  // real قفل قیمت (real bookable results only — see docs/features/wallet-price-lock.md)
  const [club, setClub] = useState<{ isMember: boolean; level: string | null } | null>(null);
  const [lockBusyKey, setLockBusyKey] = useState<string | null>(null);
  const [saveBusyKey, setSaveBusyKey] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [realLockResult, setRealLockResult] = useState<RealLockResult | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') {
      setClub(null);
      setSavedKeys(new Set());
      return;
    }
    fetchClubPoints()
      .then((c) => setClub({ isMember: c.isMember, level: c.level }))
      .catch(() => setClub(null));
    fetchSavedFlights()
      .then((rows) =>
        setSavedKeys(new Set(rows.map((r) => `${r.flightInstanceId}:${r.cabin}`))),
      )
      .catch(() => setSavedKeys(new Set()));
  }, [status]);

  async function onSaveClick(flightInstanceId: string, cabin: CabinClass) {
    if (status !== 'authenticated') {
      navigate('/signin', { state: { from: `/results?${params.toString()}` } });
      return;
    }
    const key = `${flightInstanceId}:${cabin}`;
    if (savedKeys.has(key)) return;
    setSaveBusyKey(key);
    try {
      await saveFlight(flightInstanceId, cabin);
      setSavedKeys((prev) => new Set(prev).add(key));
    } catch (err) {
      setRealLockResult({
        kind: 'error',
        message: err instanceof ApiRequestError ? err.message : ERR[locale],
      });
    } finally {
      setSaveBusyKey(null);
    }
  }

  async function onRealLockClick(flightInstanceId: string, cabin: CabinClass) {
    if (status !== 'authenticated') {
      navigate('/signin', { state: { from: `/results?${params.toString()}` } });
      return;
    }
    if (!club?.isMember || !GOLD_TIER_LEVELS.includes(club.level ?? '')) {
      setRealLockResult({ kind: 'not-gold' });
      return;
    }
    const key = `${flightInstanceId}:${cabin}`;
    setLockBusyKey(key);
    try {
      const lock = await createPriceLock(flightInstanceId, cabin);
      setRealLockResult({ kind: 'success', lock });
    } catch (err) {
      setRealLockResult({
        kind: 'error',
        message: err instanceof ApiRequestError ? err.message : ERR[locale],
      });
    } finally {
      setLockBusyKey(null);
    }
  }

  useEffect(() => {
    if (!origin || !dest || !date) return;
    let cancelled = false;
    setResults(null);
    setShowMock(false);
    setMockNotice(false);

    searchFlights(origin, dest, date)
      .then((found) => {
        if (cancelled) return;
        if (found.length > 0) setResults(found);
        else setShowMock(true);
      })
      .catch(() => {
        if (!cancelled) setShowMock(true);
      });

    return () => {
      cancelled = true;
    };
  }, [origin, dest, date]);

  function askAi() {
    setAiState('loading');
    setTimeout(() => setAiState('done'), 900);
  }

  const mockShown = useMemo(() => {
    let list = [...MOCK_FLIGHTS];
    if (fStops !== 'all') list = list.filter((f) => f.stop === fStops);
    if (fTime !== 'all') list = list.filter((f) => depHourBucket(f.dep) === fTime);
    if (fAirline !== 'all') list = list.filter((f) => f.airline === fAirline);
    list.sort((a, b) => (sort === 'cheap' ? a.tomanPrice - b.tomanPrice : a.dep.localeCompare(b.dep)));
    return list;
  }, [fStops, fTime, fAirline, sort]);

  if (!origin || !dest || !date) {
    return (
      <PublicPageShell>
        <div className="mx-auto max-w-3xl p-10 text-center">
          <h1 className="mb-2 text-lg font-black text-[#0d2640]">{t.emptyTitle}</h1>
          <p className="mb-6 text-sm text-[#6b7b94]">{t.emptySub}</p>
          <button onClick={() => navigate('/')} className="rounded-lg bg-[#1668c4] px-6 py-2.5 text-sm font-bold text-white">
            {t.goToSearch}
          </button>
        </div>
      </PublicPageShell>
    );
  }

  const chip = (on: boolean): string =>
    `cursor-pointer rounded-lg px-3 py-1.5 text-[11.5px] font-bold ${on ? 'bg-[#1668c4] text-white' : 'bg-[#f1f4f8] text-[#5a6678]'}`;

  return (
    <PublicPageShell>
      {/* SEARCH SUMMARY BAR */}
      <div style={{ background: 'linear-gradient(120deg,#0d2640,#124a86)' }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3 text-white">
            <span className="text-base font-black" dir="ltr">
              {origin} {locale === 'en' ? '→' : '←'} {dest}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">
              {formatJalaliDate(`${date}T12:00:00Z`)}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">{t.onePassengerEconomy}</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-xs font-bold text-white"
          >
            {t.changeSearch}
          </button>
        </div>
      </div>

      <FlowStepper current="results" onBack={() => navigate('/')} />

      {/* PRICE CALENDAR STRIP */}
      <div className="border-b border-[#e8eef6] bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-7 px-4" data-testid="price-calendar">
          {CAL_DAYS.map((c) => (
            <div
              key={c.d}
              className={`cursor-pointer border-b-2 px-1 py-2.5 text-center ${c.sel ? 'border-[#1668c4] bg-[#f2f7fd]' : 'border-transparent'}`}
            >
              <div className={`text-[11px] font-bold ${c.sel ? 'text-[#1668c4]' : 'text-[#5a6678]'}`}>{c.d}</div>
              <div className={`font-num mt-0.5 text-[11px] font-extrabold ${c.cheap ? 'text-[#1f8a5b]' : c.sel ? 'text-[#0d2640]' : 'text-[#8a96a6]'}`}>
                {formatToman(c.p, locale)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`mx-auto flex max-w-5xl gap-5 p-5 ${isMobile ? 'flex-col' : 'flex-row'}`}>
        {/* FILTER SIDEBAR */}
        <aside className={isMobile ? 'w-full flex-none' : 'w-56 flex-none'}>
          <div className="rounded-2xl border border-[#e8eef6] bg-white p-4">
            <div className="mb-2 text-xs font-black text-[#0d2640]">{t.stopsLabel}</div>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {(
                [
                  ['all', t.all],
                  ['direct', t.direct],
                  ['one', t.oneStop],
                ] as const
              ).map(([k, l]) => (
                <span key={k} data-testid={`f-stops-${k}`} onClick={() => setFStops(k)} className={chip(fStops === k)}>
                  {l}
                </span>
              ))}
            </div>
            <div className="mb-2 text-xs font-black text-[#0d2640]">{t.timeLabel}</div>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {(
                [
                  ['all', t.all],
                  ['morning', t.morning],
                  ['noon', t.noon],
                  ['evening', t.evening],
                ] as const
              ).map(([k, l]) => (
                <span key={k} onClick={() => setFTime(k)} className={chip(fTime === k)}>
                  {l}
                </span>
              ))}
            </div>
            <div className="mb-2 text-xs font-black text-[#0d2640]">{t.airlineLabel}</div>
            <div className="flex flex-wrap gap-1.5">
              <span onClick={() => setFAirline('all')} className={chip(fAirline === 'all')}>
                {t.all}
              </span>
              {MOCK_FLIGHTS.map((f) => (
                <span key={f.airline} onClick={() => setFAirline(f.airline)} className={chip(fAirline === f.airline)}>
                  {f.airline}
                </span>
              ))}
            </div>
          </div>

          {/* AI PRICE RADAR */}
          <div className="mt-4 rounded-2xl border border-[#d6e4f8] bg-gradient-to-b from-[#f2f7fd] to-white p-4" data-testid="ai-radar">
            <div className="mb-1 flex items-center gap-2 text-xs font-black text-[#0d2640]">
              <span>📡</span> {t.aiTitle}
            </div>
            <p className="mb-3 text-[11px] leading-6 text-[#5a6678]">{t.aiSub}</p>
            {aiState === 'idle' && (
              <button onClick={askAi} data-testid="ai-ask" className="w-full rounded-lg bg-[#1668c4] py-2 text-xs font-bold text-white">
                {t.aiAnalyze}
              </button>
            )}
            {aiState === 'loading' && <div className="text-center text-[11px] text-[#8a96a6]">{t.aiAnalyzing}</div>}
            {aiState === 'done' && (
              <div data-testid="ai-result">
                <div className="mb-1.5 inline-block rounded-full bg-[#e8f5ee] px-2.5 py-1 text-[11px] font-extrabold text-[#1f8a5b]">
                  ✓ {t.aiRecommendation}
                </div>
                <p className="text-[11px] leading-6 text-[#3f546b]">
                  {t.aiExplain('۱۶:۴۵', locale === 'fa' ? 'دوشنبه ۱۵ تیر' : locale === 'ar' ? 'يوم الاثنين ١٥ تير' : 'Monday, 15 Tir')}
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* MAIN COLUMN */}
        <main className="min-w-0 flex-1">
          {/* SORT TABS */}
          <div className="mb-3 flex items-center gap-2">
            {(
              [
                ['cheap', t.sortCheap],
                ['early', t.sortEarly],
              ] as const
            ).map(([k, l]) => (
              <span key={k} onClick={() => setSort(k)} className={chip(sort === k)}>
                {l}
              </span>
            ))}
            <span className="mr-auto text-[11px] text-[#8a96a6]">
              {formatToman(showMock ? mockShown.length : (results?.length ?? 0), locale)} {t.flightsCount}
            </span>
          </div>

          {results === null && !showMock && <p className="text-sm text-[#6b7b94]">{t.searching}</p>}

          {mockNotice && (
            <div data-testid="mock-notice" className="mb-3 rounded-xl border border-[#fde3c4] bg-[#fff7ed] p-3 text-xs font-semibold text-[#9a5b16]">
              {t.mockNotice}
            </div>
          )}

          {/* MOCK CARDS (design schedule) */}
          {showMock && (
            <div className="flex flex-col gap-3">
              {mockShown.map((f) => (
                <div key={f.airline + f.dep} data-testid="mock-result-card" className="rounded-2xl border border-[#e8eef6] bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex w-28 items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f2f7fd] text-sm">✈</span>
                      <span className="text-xs font-extrabold text-[#0d2640]">{f.airline}</span>
                    </div>
                    <div className="flex flex-1 items-center justify-center gap-3">
                      <div className="text-center">
                        <div className="font-num text-base font-black text-[#0d2640]">{f.dep}</div>
                        <div className="text-[10px] text-[#8a96a6]" dir="ltr">{origin}</div>
                      </div>
                      <div className="w-24 text-center text-[10px] text-[#8a96a6]">
                        <div>{f.stop === 'direct' ? t.direct : t.oneStop}</div>
                        <div className="relative my-1 border-t border-dashed border-[#cdd9ec]">
                          <span className="absolute -top-2 right-1/2 translate-x-1/2 bg-white px-1 text-[#1668c4]">✈</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-num text-base font-black text-[#0d2640]">{f.arr}</div>
                        <div className="text-[10px] text-[#8a96a6]" dir="ltr">{dest}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="text-[10px] font-bold text-[#d64545]">{formatToman(f.seats, locale)} {t.seatsLeft}</div>
                      <div className="font-num text-sm font-black text-[#1668c4]">{formatToman(f.tomanPrice, locale)} <span className="text-[10px] font-normal text-[#8a96a6]">{t.toman}</span></div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setLockFor(f)}
                          className="rounded-lg border border-[#d5e1f0] px-3 py-1.5 text-[11px] font-bold text-[#1668c4]"
                        >
                          🔒 {t.priceLock}
                        </button>
                        <button onClick={() => setMockNotice(true)} className="rounded-lg bg-[#1668c4] px-4 py-1.5 text-[11px] font-bold text-white">
                          {t.select}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {mockShown.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#e5e9f0] p-8 text-center text-sm text-[#6b7b94]">
                  {t.noFlightsForFilters}
                </div>
              )}
            </div>
          )}

          {/* REAL RESULTS (bookable) */}
          <div className="flex flex-col gap-3">
            {results?.map((r) => (
              <div key={r.flightInstanceId} data-testid="result-card" className="rounded-2xl border border-[#e5e9f0] bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="font-num text-sm font-extrabold text-[#0d2640]">{r.flightNo}</div>
                    <div className="mt-1 text-xs text-[#6b7b94]">{formatJalaliDateTime(r.departureAt)}</div>
                  </div>
                  <div className="text-xs text-[#6b7b94]">{r.aircraftType}</div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {r.cabins.map((c) => (
                    <div key={c.cabin} className="flex min-w-[160px] flex-1 items-center justify-between rounded-xl border border-[#e5e9f0] p-3">
                      <div>
                        <div className="text-[11px] text-[#6b7b94]">{CABIN_LABEL[c.cabin][locale]}</div>
                        <div className="font-num text-sm font-extrabold text-[#1668c4]">{localeMoney(c.priceIrr, locale)} {t.toman}</div>
                        <div className="text-[10px] text-[#6b7b94]">{faDigits(c.seatsLeft)} {t.seatsLeft}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <button
                          disabled={c.seatsLeft === 0}
                          onClick={() => navigate(`/book/${r.flightInstanceId}?cabin=${c.cabin}`)}
                          className="rounded-lg bg-[#1668c4] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                        >
                          {t.select}
                        </button>
                        <button
                          disabled={lockBusyKey === `${r.flightInstanceId}:${c.cabin}`}
                          onClick={() => void onRealLockClick(r.flightInstanceId, c.cabin)}
                          data-testid={`real-lock-${r.flightInstanceId}-${c.cabin}`}
                          className="rounded-lg border border-[#d5e1f0] px-3 py-1 text-[10.5px] font-bold text-[#1668c4] disabled:opacity-40"
                        >
                          {lockBusyKey === `${r.flightInstanceId}:${c.cabin}` ? t.aiAnalyzing : `🔒 ${t.priceLock}`}
                        </button>
                        <button
                          disabled={
                            saveBusyKey === `${r.flightInstanceId}:${c.cabin}` ||
                            savedKeys.has(`${r.flightInstanceId}:${c.cabin}`)
                          }
                          onClick={() => void onSaveClick(r.flightInstanceId, c.cabin)}
                          data-testid={`real-save-${r.flightInstanceId}-${c.cabin}`}
                          className="rounded-lg border border-[#d5e1f0] px-3 py-1 text-[10.5px] font-bold text-[#5a6678] disabled:opacity-60"
                        >
                          {saveBusyKey === `${r.flightInstanceId}:${c.cabin}`
                            ? t.aiAnalyzing
                            : savedKeys.has(`${r.flightInstanceId}:${c.cabin}`)
                              ? `✓ ${t.savedFlight}`
                              : `🔖 ${t.saveFlight}`}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* PRICE LOCK MODAL (mock, gated) */}
      {lockFor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0d2640]/55 p-5" onClick={() => setLockFor(null)}>
          <div onClick={(e) => e.stopPropagation()} data-testid="lock-modal" className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mb-2 text-2xl">🔒</div>
            <h2 className="mb-1 text-sm font-black text-[#0d2640]">{t.smartFareLock}</h2>
            <p className="mb-3 text-[11.5px] leading-6 text-[#5a6678]">
              {t.fareLockIntro(lockFor.airline, lockFor.dep)}
            </p>
            <div className="flex gap-2">
              <button onClick={() => navigate('/club')} className="flex-1 rounded-lg bg-[#1668c4] py-2.5 text-xs font-bold text-white">
                {t.learnAboutClub}
              </button>
              <button onClick={() => setLockFor(null)} className="flex-none rounded-lg border border-[#d5e1f0] px-5 py-2.5 text-xs font-bold text-[#5a6678]">
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REAL PRICE LOCK RESULT MODAL */}
      {realLockResult && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0d2640]/55 p-5" onClick={() => setRealLockResult(null)}>
          <div onClick={(e) => e.stopPropagation()} data-testid="real-lock-modal" className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            {realLockResult.kind === 'not-gold' && (
              <>
                <div className="mb-2 text-2xl">🔒</div>
                <h2 className="mb-1 text-sm font-black text-[#0d2640]">{t.smartFareLock}</h2>
                <p className="mb-3 text-[11.5px] leading-6 text-[#5a6678]">
                  {t.fareLockGoldOnly}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => navigate('/club')} className="flex-1 rounded-lg bg-[#1668c4] py-2.5 text-xs font-bold text-white">
                    {t.learnAboutClub}
                  </button>
                  <button onClick={() => setRealLockResult(null)} className="flex-none rounded-lg border border-[#d5e1f0] px-5 py-2.5 text-xs font-bold text-[#5a6678]">
                    {t.close}
                  </button>
                </div>
              </>
            )}
            {realLockResult.kind === 'success' && (
              <>
                <div className="mb-2 text-2xl">✓</div>
                <h2 className="mb-1 text-sm font-black text-[#0d2640]">{t.yourPriceLocked}</h2>
                <p className="mb-1 text-[11.5px] leading-6 text-[#5a6678]">
                  {t.lockRateUntil(localeMoney(realLockResult.lock.lockedPriceIrr, locale), formatJalaliDateTime(realLockResult.lock.expiresAt))}
                </p>
                <p className="mb-3 text-[11px] leading-6 text-[#8a96a6]">{t.fee}: {localeMoney(realLockResult.lock.feeIrr, locale)} {t.toman}</p>
                <button onClick={() => setRealLockResult(null)} className="w-full rounded-lg bg-[#1668c4] py-2.5 text-xs font-bold text-white">
                  {t.gotIt}
                </button>
              </>
            )}
            {realLockResult.kind === 'error' && (
              <>
                <div className="mb-2 text-2xl">⚠</div>
                <h2 className="mb-1 text-sm font-black text-[#0d2640]">{t.lockFailedTitle}</h2>
                <p role="alert" className="mb-3 text-[11.5px] leading-6 text-[#5a6678]">
                  {realLockResult.message}
                </p>
                <button onClick={() => setRealLockResult(null)} className="w-full rounded-lg border border-[#d5e1f0] py-2.5 text-xs font-bold text-[#5a6678]">
                  {t.close}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </PublicPageShell>
  );
}

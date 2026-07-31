import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  createPriceLock,
  fetchClubPoints,
  fetchSavedFlights,
  fetchSearchAdvisory,
  fetchPriceCalendar,
  saveFlight,
  searchFlights,
} from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import { useAuth } from '../../hooks/useAuth';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import { faDigits, formatToman, localeMoney } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import type {
  CabinClass,
  PriceCalendarDay,
  PriceLock,
  SearchAdvisoryResult,
  SearchFlightResult,
} from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';
import FlowStepper from '../../components/public/FlowStepper';

const CABIN_LABEL: Record<string, Record<StoredLocale, string>> = {
  ECONOMY: { fa: 'اکونومی', en: 'Economy', ar: 'اقتصادية' },
  BUSINESS: { fa: 'بیزینس', en: 'Business', ar: 'درجة الأعمال' },
};

function depHourBucket(iso: string): 'morning' | 'noon' | 'evening' {
  const h = new Date(iso).getUTCHours();
  if (h < 11) return 'morning';
  if (h < 16) return 'noon';
  return 'evening';
}

function flightAirlineLabel(flightNo: string): string {
  return flightNo.split('-')[0] ?? flightNo;
}

const GOLD_TIER_LEVELS = ['GOLD', 'PLATINUM'];

type RealLockResult =
  | { kind: 'success'; lock: PriceLock }
  | { kind: 'not-gold' }
  | { kind: 'error'; message: string };

const ADVISORY_REASON: Record<string, Record<StoredLocale, string>> = {
  wait_nearby_cheaper: {
    fa: 'قیمت این مسیر در روزهای نزدیک پایین‌تر است — اگر انعطاف دارید کمی صبر کنید.',
    en: 'Prices on this route are lower on nearby days — if you are flexible, wait a bit.',
    ar: 'أسعار هذا المسار أقل في الأيام القريبة — إذا كان لديك مرونة، انتظر قليلاً.',
  },
  buy_good_price: {
    fa: 'قیمت امروز در محدوده مناسب است — برای سفر قطعی همین حالا بخرید.',
    en: "Today's price is in a good range — buy now if your travel dates are fixed.",
    ar: 'سعر اليوم في نطاق جيد — اشترِ الآن إذا كانت تواريخ سفرك ثابتة.',
  },
};

function translateAdvisoryReason(reasonFa: string | undefined, locale: StoredLocale): string {
  if (!reasonFa) return '';
  if (locale === 'fa') return reasonFa;
  if (reasonFa.includes('روزهای نزدیک پایین‌تر')) return ADVISORY_REASON.wait_nearby_cheaper[locale];
  if (reasonFa.includes('محدوده مناسب')) return ADVISORY_REASON.buy_good_price[locale];
  return reasonFa;
}

const STR: Record<StoredLocale, {
  changeSearch: string;
  onePassengerEconomy: string;
  emptyTitle: string;
  emptySub: string;
  goToSearch: string;
  noResultsTitle: string;
  noResultsSub: string;
  searchError: string;
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
  aiUnavailable: string;
  aiRecommendationBuy: string;
  aiRecommendationWait: string;
  aiPredictedPrice: string;
  sortCheap: string;
  sortEarly: string;
  flightsCount: string;
  searching: string;
  noFlightsForFilters: string;
  seatsLeft: string;
  select: string;
  toman: string;
  priceLock: string;
  saveFlight: string;
  savedFlight: string;
  smartFareLock: string;
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
    noResultsTitle: 'پروازی یافت نشد',
    noResultsSub: 'برای این مسیر و تاریخ پروازی موجود نیست — تاریخ یا مقصد را تغییر دهید.',
    searchError: 'خطا در جستجو — لطفاً دوباره تلاش کنید.',
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
    aiUnavailable: 'برای این مسیر و تاریخ، دادهٔ کافی برای تحلیل وجود ندارد.',
    aiRecommendationBuy: 'توصیه: همین حالا بخرید',
    aiRecommendationWait: 'توصیه: کمی صبر کنید',
    aiPredictedPrice: 'قیمت پیش‌بینی‌شده',
    sortCheap: 'ارزان‌ترین',
    sortEarly: 'زودترین حرکت',
    flightsCount: 'پرواز',
    searching: 'در حال جستجو…',
    noFlightsForFilters: 'با این فیلترها پروازی نمانده — فیلترها را بازنشانی کنید.',
    seatsLeft: 'صندلی باقی‌مانده',
    select: 'انتخاب',
    toman: 'تومان',
    priceLock: 'قفل قیمت',
    saveFlight: 'ذخیره',
    savedFlight: 'ذخیره شد',
    smartFareLock: 'قفل قیمت هوشمند',
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
    noResultsTitle: 'No flights found',
    noResultsSub: 'No flights are available for this route and date — try a different date or destination.',
    searchError: 'Search failed — please try again.',
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
    aiUnavailable: 'Not enough data to analyze this route and date.',
    aiRecommendationBuy: 'Recommendation: Buy now',
    aiRecommendationWait: 'Recommendation: Wait',
    aiPredictedPrice: 'Predicted price',
    sortCheap: 'Cheapest',
    sortEarly: 'Earliest flight',
    flightsCount: 'flights',
    searching: 'Searching…',
    noFlightsForFilters: 'No flights left with these filters — try resetting them.',
    seatsLeft: 'seats left',
    select: 'Select',
    toman: 'Toman',
    priceLock: 'Price Lock',
    saveFlight: 'Save',
    savedFlight: 'Saved',
    smartFareLock: 'AI Fare Lock',
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
    noResultsTitle: 'لم يتم العثور على رحلات',
    noResultsSub: 'لا توجد رحلات متاحة لهذا المسار والتاريخ — جرّب تاريخًا أو وجهة مختلفة.',
    searchError: 'فشل البحث — يرجى المحاولة مرة أخرى.',
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
    aiUnavailable: 'لا توجد بيانات كافية لتحليل هذا المسار والتاريخ.',
    aiRecommendationBuy: 'التوصية: اشترِ الآن',
    aiRecommendationWait: 'التوصية: انتظر قليلاً',
    aiPredictedPrice: 'السعر المتوقع',
    sortCheap: 'الأرخص',
    sortEarly: 'أبكر رحلة',
    flightsCount: 'رحلة',
    searching: 'جارٍ البحث…',
    noFlightsForFilters: 'لا توجد رحلات بهذه الفلاتر — حاول إعادة ضبطها.',
    seatsLeft: 'مقاعد متبقية',
    select: 'اختيار',
    toman: 'تومان',
    priceLock: 'قفل السعر',
    saveFlight: 'حفظ',
    savedFlight: 'محفوظ',
    smartFareLock: 'قفل السعر الذكي',
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
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { status } = useAuth();
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const t = STR[locale];
  const origin = params.get('origin') ?? '';
  const dest = params.get('dest') ?? '';
  const date = params.get('date') ?? '';

  const [results, setResults] = useState<SearchFlightResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [calendarDays, setCalendarDays] = useState<PriceCalendarDay[] | null>(null);

  const [fStops, setFStops] = useState<'all' | 'direct' | 'one'>('all');
  const [fTime, setFTime] = useState<'all' | 'morning' | 'noon' | 'evening'>('all');
  const [fAirline, setFAirline] = useState('all');
  const [sort, setSort] = useState<'cheap' | 'early'>('cheap');
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'done' | 'unavailable' | 'error'>('idle');
  const [advisory, setAdvisory] = useState<SearchAdvisoryResult | null>(null);

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

  useEffect(() => {
    if (!origin || !dest || !date) return;
    let cancelled = false;
    setResults(null);
    setSearchError(null);
    setAiState('idle');
    setAdvisory(null);

    searchFlights(origin, dest, date)
      .then((found) => {
        if (!cancelled) setResults(found);
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setSearchError(t.searchError);
        }
      });

    fetchPriceCalendar(origin, dest, date)
      .then((days) => {
        if (!cancelled) setCalendarDays(days);
      })
      .catch(() => {
        if (!cancelled) setCalendarDays([]);
      });

    return () => {
      cancelled = true;
    };
  }, [origin, dest, date, t.searchError]);

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

  async function askAi() {
    setAiState('loading');
    try {
      const data = await fetchSearchAdvisory(origin, dest, date);
      if (!data.available) {
        setAdvisory(null);
        setAiState('unavailable');
        return;
      }
      setAdvisory(data);
      setAiState('done');
    } catch {
      setAiState('error');
    }
  }

  const airlines = useMemo(() => {
    const set = new Set<string>();
    for (const r of results ?? []) set.add(flightAirlineLabel(r.flightNo));
    return Array.from(set).sort();
  }, [results]);

  const filteredResults = useMemo(() => {
    let list = [...(results ?? [])];
    if (fStops === 'direct') list = list.filter((f) => !f.connection);
    if (fStops === 'one') list = list.filter((f) => Boolean(f.connection));
    if (fTime !== 'all') list = list.filter((f) => depHourBucket(f.departureAt) === fTime);
    if (fAirline !== 'all') list = list.filter((f) => flightAirlineLabel(f.flightNo) === fAirline);
    list.sort((a, b) => {
      if (sort === 'early') return a.departureAt.localeCompare(b.departureAt);
      const pa = BigInt(
        a.cabins.find((c) => c.cabin === 'ECONOMY')?.priceIrr ?? a.cabins[0]?.priceIrr ?? '0',
      );
      const pb = BigInt(
        b.cabins.find((c) => c.cabin === 'ECONOMY')?.priceIrr ?? b.cabins[0]?.priceIrr ?? '0',
      );
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
    return list;
  }, [results, fStops, fTime, fAirline, sort]);

  const calendarMinPrice = useMemo(() => {
    const prices = (calendarDays ?? [])
      .map((d) => BigInt(d.minPriceIrr))
      .filter((p) => p > 0n);
    if (prices.length === 0) return null;
    return prices.reduce((min, p) => (p < min ? p : min));
  }, [calendarDays]);

  function onCalendarDayClick(dayDate: string) {
    if (dayDate === date) return;
    const next = new URLSearchParams(params);
    next.set('date', dayDate);
    setParams(next);
  }

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

      <div className="border-b border-[#e8eef6] bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-7 px-4" data-testid="price-calendar">
          {(calendarDays ?? []).map((c) => {
            const price = BigInt(c.minPriceIrr);
            const cheap = calendarMinPrice !== null && price > 0n && price === calendarMinPrice;
            const sel = c.date === date;
            const toman = price > 0n ? Math.round(Number(price) / 10) : 0;
            return (
              <div
                key={c.date}
                role="button"
                tabIndex={0}
                onClick={() => onCalendarDayClick(c.date)}
                onKeyDown={(e) => e.key === 'Enter' && onCalendarDayClick(c.date)}
                className={`cursor-pointer border-b-2 px-1 py-2.5 text-center ${sel ? 'border-[#1668c4] bg-[#f2f7fd]' : 'border-transparent'}`}
              >
                <div className={`text-[11px] font-bold ${sel ? 'text-[#1668c4]' : 'text-[#5a6678]'}`}>
                  {locale === 'en'
                    ? new Date(`${c.date}T12:00:00Z`).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : formatJalaliDate(`${c.date}T12:00:00Z`)}
                </div>
                <div className={`font-num mt-0.5 text-[11px] font-extrabold ${cheap ? 'text-[#1f8a5b]' : sel ? 'text-[#0d2640]' : 'text-[#8a96a6]'}`}>
                  {toman > 0 ? formatToman(toman, locale) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`mx-auto flex max-w-5xl gap-5 p-5 ${isMobile ? 'flex-col' : 'flex-row'}`}>
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
              {airlines.map((a) => (
                <span key={a} onClick={() => setFAirline(a)} className={chip(fAirline === a)}>
                  {a}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[#d6e4f8] bg-gradient-to-b from-[#f2f7fd] to-white p-4" data-testid="ai-radar">
            <div className="mb-1 flex items-center gap-2 text-xs font-black text-[#0d2640]">
              <span>📡</span> {t.aiTitle}
            </div>
            <p className="mb-3 text-[11px] leading-6 text-[#5a6678]">{t.aiSub}</p>
            {aiState === 'idle' && (
              <button onClick={() => void askAi()} data-testid="ai-ask" className="w-full rounded-lg bg-[#1668c4] py-2 text-xs font-bold text-white">
                {t.aiAnalyze}
              </button>
            )}
            {aiState === 'loading' && <div className="text-center text-[11px] text-[#8a96a6]">{t.aiAnalyzing}</div>}
            {aiState === 'unavailable' && (
              <div data-testid="ai-unavailable" className="text-[11px] leading-6 text-[#8a96a6]">
                {t.aiUnavailable}
              </div>
            )}
            {aiState === 'error' && (
              <div data-testid="ai-error" className="text-[11px] leading-6 text-[#d64545]">
                {t.searchError}
              </div>
            )}
            {aiState === 'done' && advisory && (
              <div data-testid="ai-result">
                <div
                  className={`mb-1.5 inline-block rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                    advisory.recommendation === 'wait'
                      ? 'bg-[#fff7ed] text-[#9a5b16]'
                      : 'bg-[#e8f5ee] text-[#1f8a5b]'
                  }`}
                >
                  ✓ {advisory.recommendation === 'wait' ? t.aiRecommendationWait : t.aiRecommendationBuy}
                </div>
                <p className="text-[11px] leading-6 text-[#3f546b]">
                  {translateAdvisoryReason(advisory.reasonFa, locale)}
                </p>
                {advisory.predictedPriceIrr && BigInt(advisory.predictedPriceIrr) > 0n && (
                  <p className="mt-1 text-[11px] font-bold text-[#1668c4]">
                    {t.aiPredictedPrice}: {localeMoney(advisory.predictedPriceIrr, locale)} {t.toman}
                  </p>
                )}
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
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
              {formatToman(filteredResults.length, locale)} {t.flightsCount}
            </span>
          </div>

          {results === null && <p className="text-sm text-[#6b7b94]">{t.searching}</p>}

          {searchError && (
            <div data-testid="search-error" className="mb-3 rounded-xl border border-[#fde3c4] bg-[#fff7ed] p-3 text-xs font-semibold text-[#9a5b16]">
              {searchError}
            </div>
          )}

          {results !== null && results.length === 0 && !searchError && (
            <div data-testid="empty-results" className="rounded-2xl border border-dashed border-[#e5e9f0] p-10 text-center">
              <h2 className="mb-2 text-base font-black text-[#0d2640]">{t.noResultsTitle}</h2>
              <p className="text-sm text-[#6b7b94]">{t.noResultsSub}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {filteredResults.map((r) => (
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
            {results !== null && results.length > 0 && filteredResults.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#e5e9f0] p-8 text-center text-sm text-[#6b7b94]">
                {t.noFlightsForFilters}
              </div>
            )}
          </div>
        </main>
      </div>

      {realLockResult && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0d2640]/55 p-5" onClick={() => setRealLockResult(null)}>
          <div onClick={(e) => e.stopPropagation()} data-testid="real-lock-modal" className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            {realLockResult.kind === 'not-gold' && (
              <>
                <div className="mb-2 text-2xl">🔒</div>
                <h2 className="mb-1 text-sm font-black text-[#0d2640]">{t.smartFareLock}</h2>
                <p className="mb-3 text-[11.5px] leading-6 text-[#5a6678]">{t.fareLockGoldOnly}</p>
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

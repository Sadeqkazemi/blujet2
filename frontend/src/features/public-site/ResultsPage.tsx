import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  createPriceLock,
  fetchAirports,
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
import { formatJalaliDateTime } from '../../lib/jalali';
import type {
  Airport,
  CabinClass,
  PriceCalendarDay,
  PriceLock,
  SearchAdvisoryResult,
  SearchFlightResult,
} from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';
import ResultsSearchSummary from '../../components/public/results/ResultsSearchSummary';
import ResultsMobileSubHeader from '../../components/public/results/ResultsMobileSubHeader';
import ResultsPriceCalendarStrip from '../../components/public/results/ResultsPriceCalendarStrip';
import ResultsAiRadarBanner from '../../components/public/results/ResultsAiRadarBanner';
import ResultsFilterBar from '../../components/public/results/ResultsFilterBar';
import ResultsFlightCard from '../../components/public/results/ResultsFlightCard';
import ResultsSkeletonCards from '../../components/public/results/ResultsSkeletonCards';
import ResultsEditSearchModal from '../../components/public/results/ResultsEditSearchModal';
import {
  depHourBucket,
  flightAirlineLabel,
  flightDurationMs,
} from '../../components/public/results/results-utils';

const CABIN_LABEL: Record<string, Record<StoredLocale, string>> = {
  ECONOMY: { fa: 'اکونومی', en: 'Economy', ar: 'اقتصادية' },
  BUSINESS: { fa: 'بیزینس', en: 'Business', ar: 'درجة الأعمال' },
};

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

function cityName(airports: Airport[], code: string, locale: StoredLocale): string | undefined {
  const a = airports.find((ap) => ap.code === code);
  if (!a) return undefined;
  if (locale === 'en') {
    const enNames: Record<string, string> = {
      THR: 'Tehran',
      MHD: 'Mashhad',
      IST: 'Istanbul',
      DXB: 'Dubai',
      KIH: 'Kish',
      SYZ: 'Shiraz',
    };
    return enNames[code] ?? a.cityFa;
  }
  return a.cityFa;
}

const STR: Record<
  StoredLocale,
  {
    changeSearch: string;
    editShort: string;
    selectDeparture: string;
    emptyTitle: string;
    emptySub: string;
    goToSearch: string;
    noResultsTitle: string;
    noResultsSub: string;
    searchError: string;
    filterLabel: string;
    all: string;
    direct: string;
    oneStop: string;
    morning: string;
    noon: string;
    evening: string;
    airlineLabel: string;
    aiTitle: string;
    aiSub: string;
    aiAnalyze: string;
    aiAnalyzing: string;
    aiReanalyze: string;
    aiUnavailable: string;
    aiRecommendationBuy: string;
    aiRecommendationWait: string;
    aiPredictedPrice: string;
    sortCheap: string;
    sortFast: string;
    sortEarly: string;
    flightsCount: string;
    noFlightsForFilters: string;
    noFlightsFiltersTitle: string;
    clearFilters: string;
    seatsLeft: string;
    select: string;
    buyTicket: string;
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
    detailsBook: string;
    flightDetails: string;
    flightNo: string;
    aircraft: string;
    lowSeats: string;
    priceDetails: string;
    adultPax: string;
    total: string;
    seatsRemaining: string;
    outbound: string;
    originAirport: string;
    destAirport: string;
  }
> = {
  fa: {
    changeSearch: 'تغییر جستجو',
    editShort: 'ویرایش',
    selectDeparture: 'انتخاب پرواز رفت',
    emptyTitle: 'جستجوی پرواز',
    emptySub: 'برای دیدن نتایج، ابتدا مبدأ، مقصد و تاریخ سفر را انتخاب کنید.',
    goToSearch: 'رفتن به جستجو',
    noResultsTitle: 'پروازی یافت نشد',
    noResultsSub: 'برای این مسیر و تاریخ پروازی موجود نیست — تاریخ یا مقصد را تغییر دهید.',
    searchError: 'خطا در جستجو — لطفاً دوباره تلاش کنید.',
    filterLabel: 'فیلتر',
    all: 'همه',
    direct: 'مستقیم',
    oneStop: 'یک توقف',
    morning: 'صبح',
    noon: 'بعدازظهر',
    evening: 'عصر و شب',
    airlineLabel: 'ایرلاین',
    aiTitle: 'رادار هوشمند قیمت',
    aiSub: 'همین حالا بخرم یا صبر کنم؟ رادار روند قیمت این مسیر را تحلیل می‌کند.',
    aiAnalyze: 'تحلیل کن',
    aiAnalyzing: 'در حال تحلیل…',
    aiReanalyze: 'تحلیل مجدد',
    aiUnavailable: 'برای این مسیر و تاریخ، دادهٔ کافی برای تحلیل وجود ندارد.',
    aiRecommendationBuy: 'توصیه: همین حالا بخرید',
    aiRecommendationWait: 'توصیه: کمی صبر کنید',
    aiPredictedPrice: 'قیمت پیش‌بینی‌شده',
    sortCheap: 'ارزان‌ترین',
    sortFast: 'سریع‌ترین',
    sortEarly: 'زودترین پرواز',
    flightsCount: 'پرواز',
    noFlightsForFilters: 'با این فیلترها پروازی نمانده — فیلترها را بازنشانی کنید.',
    noFlightsFiltersTitle: 'پروازی با این فیلترها نیست',
    clearFilters: 'بازنشانی فیلترها',
    seatsLeft: 'صندلی باقی‌مانده',
    select: 'انتخاب',
    buyTicket: 'خرید بلیط',
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
    detailsBook: 'جزئیات و رزرو',
    flightDetails: 'جزئیات پرواز',
    flightNo: 'شماره پرواز',
    aircraft: 'هواپیما',
    lowSeats: 'فقط {n} صندلی باقی مانده',
    priceDetails: 'جزئیات قیمت',
    adultPax: 'بزرگسال',
    total: 'جمع کل',
    seatsRemaining: 'صندلی باقی‌مانده',
    outbound: 'پرواز رفت',
    originAirport: 'فرودگاه مبدأ',
    destAirport: 'فرودگاه مقصد',
  },
  en: {
    changeSearch: 'Change search',
    editShort: 'Edit',
    selectDeparture: 'Select outbound flight',
    emptyTitle: 'Search Flights',
    emptySub: 'Select an origin, destination, and travel date first to see results.',
    goToSearch: 'Go to Search',
    noResultsTitle: 'No flights found',
    noResultsSub: 'No flights are available for this route and date — try a different date or destination.',
    searchError: 'Search failed — please try again.',
    filterLabel: 'Filters',
    all: 'All',
    direct: 'Direct',
    oneStop: '1 stop',
    morning: 'Morning',
    noon: 'Afternoon',
    evening: 'Evening & night',
    airlineLabel: 'Airline',
    aiTitle: 'Smart Price Radar',
    aiSub: "Buy now or wait? The radar analyzes this route's price trend.",
    aiAnalyze: 'Analyze price',
    aiAnalyzing: 'Analyzing…',
    aiReanalyze: 'Re-analyze',
    aiUnavailable: 'Not enough data to analyze this route and date.',
    aiRecommendationBuy: 'Recommendation: Buy now',
    aiRecommendationWait: 'Recommendation: Wait',
    aiPredictedPrice: 'Predicted price',
    sortCheap: 'Cheapest',
    sortFast: 'Fastest',
    sortEarly: 'Earliest flight',
    flightsCount: 'flights',
    noFlightsForFilters: 'No flights left with these filters — try resetting them.',
    noFlightsFiltersTitle: 'No flights match these filters',
    clearFilters: 'Clear filters',
    seatsLeft: 'seats left',
    select: 'Select',
    buyTicket: 'Buy ticket',
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
    detailsBook: 'Details & book',
    flightDetails: 'Flight details',
    flightNo: 'Flight no.',
    aircraft: 'Aircraft',
    lowSeats: 'Only {n} seats left',
    priceDetails: 'Price details',
    adultPax: 'Adult',
    total: 'Total',
    seatsRemaining: 'Seats remaining',
    outbound: 'Outbound',
    originAirport: 'Origin airport',
    destAirport: 'Destination airport',
  },
  ar: {
    changeSearch: 'تغيير البحث',
    editShort: 'تعديل',
    selectDeparture: 'اختر رحلة الذهاب',
    emptyTitle: 'البحث عن رحلات',
    emptySub: 'اختر المبدأ والمقصد وتاريخ السفر أولاً لعرض النتائج.',
    goToSearch: 'الذهاب إلى البحث',
    noResultsTitle: 'لم يتم العثور على رحلات',
    noResultsSub: 'لا توجد رحلات متاحة لهذا المسار والتاريخ — جرّب تاريخًا أو وجهة مختلفة.',
    searchError: 'فشل البحث — يرجى المحاولة مرة أخرى.',
    filterLabel: 'تصفية',
    all: 'الكل',
    direct: 'مباشر',
    oneStop: 'توقف واحد',
    morning: 'صباحًا',
    noon: 'بعد الظهر',
    evening: 'مساءً وليلاً',
    airlineLabel: 'شركة الطيران',
    aiTitle: 'رادار الأسعار الذكي',
    aiSub: 'هل أشتري الآن أم أنتظر؟ يحلل الرادار اتجاه أسعار هذا المسار.',
    aiAnalyze: 'تحليل السعر',
    aiAnalyzing: 'جارٍ التحليل…',
    aiReanalyze: 'إعادة التحليل',
    aiUnavailable: 'لا توجد بيانات كافية لتحليل هذا المسار والتاريخ.',
    aiRecommendationBuy: 'التوصية: اشترِ الآن',
    aiRecommendationWait: 'التوصية: انتظر قليلاً',
    aiPredictedPrice: 'السعر المتوقع',
    sortCheap: 'الأرخص',
    sortFast: 'الأسرع',
    sortEarly: 'أبكر رحلة',
    flightsCount: 'رحلة',
    noFlightsForFilters: 'لا توجد رحلات بهذه الفلاتر — حاول إعادة ضبطها.',
    noFlightsFiltersTitle: 'لا توجد رحلات بهذه الفلاتر',
    clearFilters: 'إعادة ضبط الفلاتر',
    seatsLeft: 'مقاعد متبقية',
    select: 'اختيار',
    buyTicket: 'شراء التذكرة',
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
    detailsBook: 'التفاصيل والحجز',
    flightDetails: 'تفاصيل الرحلة',
    flightNo: 'رقم الرحلة',
    aircraft: 'الطائرة',
    lowSeats: 'متبقي {n} مقاعد فقط',
    priceDetails: 'تفاصيل السعر',
    adultPax: 'بالغ',
    total: 'الإجمالي',
    seatsRemaining: 'المقاعد المتبقية',
    outbound: 'رحلة الذهاب',
    originAirport: 'مطار المغادرة',
    destAirport: 'مطار الوصول',
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
  const adults = Math.max(1, Number(params.get('adults') ?? '1') || 1);
  const cabinRaw = params.get('cabin') ?? 'ECONOMY';
  const preferredCabin: CabinClass = cabinRaw === 'BUSINESS' ? 'BUSINESS' : 'ECONOMY';

  const [airports, setAirports] = useState<Airport[]>([]);
  const [results, setResults] = useState<SearchFlightResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [calendarDays, setCalendarDays] = useState<PriceCalendarDay[] | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [fStops, setFStops] = useState<'all' | 'direct' | 'one'>('all');
  const [fTime, setFTime] = useState<'all' | 'morning' | 'noon' | 'evening'>('all');
  const [fAirline, setFAirline] = useState('all');
  const [sort, setSort] = useState<'cheap' | 'fast' | 'early'>('cheap');
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'done' | 'unavailable' | 'error'>('idle');
  const [advisory, setAdvisory] = useState<SearchAdvisoryResult | null>(null);

  const [club, setClub] = useState<{ isMember: boolean; level: string | null } | null>(null);
  const [lockBusyKey, setLockBusyKey] = useState<string | null>(null);
  const [saveBusyKey, setSaveBusyKey] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [realLockResult, setRealLockResult] = useState<RealLockResult | null>(null);

  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch(() => setAirports([]));
  }, []);

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
      .then((rows) => setSavedKeys(new Set(rows.map((r) => `${r.flightInstanceId}:${r.cabin}`))))
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
      if (sort === 'fast') {
        return (
          flightDurationMs(a.departureAt, a.arrivalAt) - flightDurationMs(b.departureAt, b.arrivalAt)
        );
      }
      const pa = BigInt(
        a.cabins.find((c) => c.cabin === preferredCabin)?.priceIrr ??
          a.cabins.find((c) => c.cabin === 'ECONOMY')?.priceIrr ??
          a.cabins[0]?.priceIrr ??
          '0',
      );
      const pb = BigInt(
        b.cabins.find((c) => c.cabin === preferredCabin)?.priceIrr ??
          b.cabins.find((c) => c.cabin === 'ECONOMY')?.priceIrr ??
          b.cabins[0]?.priceIrr ??
          '0',
      );
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
    return list;
  }, [results, fStops, fTime, fAirline, sort, preferredCabin]);

  const calendarMinPrice = useMemo(() => {
    const prices = (calendarDays ?? []).map((d) => BigInt(d.minPriceIrr)).filter((p) => p > 0n);
    if (prices.length === 0) return null;
    return prices.reduce((min, p) => (p < min ? p : min));
  }, [calendarDays]);

  function onCalendarDayClick(dayDate: string) {
    if (dayDate === date) return;
    const next = new URLSearchParams(params);
    next.set('date', dayDate);
    setParams(next);
  }

  function clearFilters() {
    setFStops('all');
    setFTime('all');
    setFAirline('all');
  }

  function onEditSearchSubmit(newOrigin: string, newDest: string, newDate: string) {
    const next = new URLSearchParams(params);
    next.set('origin', newOrigin);
    next.set('dest', newDest);
    next.set('date', newDate);
    setParams(next);
  }

  const cabinLabels = useMemo(
    () => ({
      ECONOMY: CABIN_LABEL.ECONOMY[locale],
      BUSINESS: CABIN_LABEL.BUSINESS[locale],
    }),
    [locale],
  );

  const cardLabels = useMemo(
    () => ({
      direct: t.direct,
      oneStop: t.oneStop,
      seatsLeft: t.seatsLeft,
      select: t.select,
      buyTicket: t.buyTicket,
      toman: t.toman,
      priceLock: t.priceLock,
      saveFlight: t.saveFlight,
      savedFlight: t.savedFlight,
      analyzing: t.aiAnalyzing,
      detailsBook: t.detailsBook,
      flightDetails: t.flightDetails,
      flightNo: t.flightNo,
      aircraft: t.aircraft,
      lowSeats: t.lowSeats,
      priceDetails: t.priceDetails,
      adultPax: t.adultPax,
      total: t.total,
      seatsRemaining: t.seatsRemaining,
      outbound: t.outbound,
      originAirport: t.originAirport,
      destAirport: t.destAirport,
    }),
    [t],
  );

  if (!origin || !dest || !date) {
    return (
      <PublicPageShell>
        <div className="mx-auto max-w-3xl p-10 text-center">
          <h1 className="mb-2 text-lg font-black text-[#0d2640]">{t.emptyTitle}</h1>
          <p className="mb-6 text-sm text-[#6b7b94]">{t.emptySub}</p>
          <button
            onClick={() => navigate('/')}
            className="rounded-lg bg-[#1668c4] px-6 py-2.5 text-sm font-bold text-white"
          >
            {t.goToSearch}
          </button>
        </div>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      {isMobile && <ResultsMobileSubHeader locale={locale} onBack={() => navigate('/')} />}

      <ResultsSearchSummary
        locale={locale}
        origin={origin}
        dest={dest}
        originCity={cityName(airports, origin, locale)}
        destCity={cityName(airports, dest, locale)}
        date={date}
        adults={adults}
        cabinLabel={CABIN_LABEL[preferredCabin][locale]}
        title={t.selectDeparture}
        changeSearchLabel={t.changeSearch}
        editShortLabel={t.editShort}
        isMobile={isMobile}
        onEdit={() => setEditOpen(true)}
      />

      {calendarDays && calendarDays.length > 0 && (
        <ResultsPriceCalendarStrip
          days={calendarDays}
          selectedDate={date}
          calendarMinPrice={calendarMinPrice}
          locale={locale}
          isMobile={isMobile}
          onDayClick={onCalendarDayClick}
        />
      )}

      <ResultsAiRadarBanner
        locale={locale}
        isMobile={isMobile}
        aiState={aiState}
        advisory={advisory}
        title={t.aiTitle}
        sub={t.aiSub}
        analyzeLabel={t.aiAnalyze}
        analyzingLabel={t.aiAnalyzing}
        reanalyzeLabel={t.aiReanalyze}
        unavailableLabel={t.aiUnavailable}
        errorLabel={t.searchError}
        recommendationBuy={t.aiRecommendationBuy}
        recommendationWait={t.aiRecommendationWait}
        predictedPriceLabel={t.aiPredictedPrice}
        tomanLabel={t.toman}
        reasonText={translateAdvisoryReason(advisory?.reasonFa, locale)}
        onAsk={() => void askAi()}
      />

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: isMobile ? '12px 16px 32px' : '16px 26px 39px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 13.5, color: '#5a6678' }}>
            {formatToman(filteredResults.length, locale)} {t.flightsCount}
          </span>
          <div
            style={{
              display: 'flex',
              background: '#fff',
              border: '1px solid #eef1f5',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {(
              [
                ['cheap', t.sortCheap],
                ['fast', t.sortFast],
                ['early', t.sortEarly],
              ] as const
            ).map(([k, l], i) => (
              <button
                key={k}
                type="button"
                onClick={() => setSort(k)}
                style={{
                  padding: '9px 14px',
                  fontSize: 13,
                  fontWeight: sort === k ? 700 : 600,
                  background: sort === k ? '#1668c4' : '#fff',
                  color: sort === k ? '#fff' : '#5a6678',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  borderRight: i < 2 ? '1px solid #eef1f5' : undefined,
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {!isMobile && (
          <ResultsFilterBar
            locale={locale}
            fStops={fStops}
            fTime={fTime}
            fAirline={fAirline}
            airlines={airlines}
            labels={{
              filterLabel: t.filterLabel,
              stopsLabel: t.filterLabel,
              all: t.all,
              direct: t.direct,
              oneStop: t.oneStop,
              morning: t.morning,
              noon: t.noon,
              evening: t.evening,
              airlineLabel: t.airlineLabel,
            }}
            onStops={setFStops}
            onTime={setFTime}
            onAirline={setFAirline}
          />
        )}

        {results === null && <ResultsSkeletonCards />}

        {searchError && (
          <div
            data-testid="search-error"
            style={{
              marginBottom: 12,
              borderRadius: 12,
              border: '1px solid #fde3c4',
              background: '#fff7ed',
              padding: 12,
              fontSize: 12,
              fontWeight: 600,
              color: '#9a5b16',
            }}
          >
            {searchError}
          </div>
        )}

        {results !== null && results.length === 0 && !searchError && (
          <div
            data-testid="empty-results"
            style={{
              background: '#fff',
              border: '1px solid #eef1f5',
              borderRadius: 18,
              padding: '64px 24px 56px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                left: 0,
                height: 4,
                background: 'linear-gradient(90deg,#1668c4,#5ea3e8,#eef4fb)',
              }}
            />
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0d2640', marginBottom: 9 }}>
              {t.noResultsTitle}
            </div>
            <p style={{ fontSize: 13.5, color: '#8a96a6', maxWidth: 380, lineHeight: 2, margin: 0 }}>
              {t.noResultsSub}
            </p>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              style={{
                marginTop: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '12px 26px',
                background: '#1668c4',
                color: '#fff',
                borderRadius: 11,
                fontSize: 13.5,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t.changeSearch}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {filteredResults.map((r) => (
            <ResultsFlightCard
              key={r.flightInstanceId}
              flight={r}
              locale={locale}
              isMobile={isMobile}
              preferredCabin={preferredCabin}
              labels={cardLabels}
              cabinLabels={cabinLabels}
              lockBusyKey={lockBusyKey}
              saveBusyKey={saveBusyKey}
              savedKeys={savedKeys}
              onSelect={(id, cabin) => navigate(`/book/${id}?cabin=${cabin}`)}
              onLock={(id, cabin) => void onRealLockClick(id, cabin)}
              onSave={(id, cabin) => void onSaveClick(id, cabin)}
            />
          ))}

          {results !== null && results.length > 0 && filteredResults.length === 0 && (
            <div
              data-testid="filter-empty"
              style={{
                background: '#fff',
                border: '1px solid #eef1f5',
                borderRadius: 14,
                padding: '54px 24px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  background: '#eef4fb',
                  color: '#1668c4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 33,
                  margin: '0 auto 18px',
                }}
              >
                ⇄
              </div>
              <h3 style={{ fontSize: 17.5, fontWeight: 800, color: '#0d2640', margin: '0 0 8px' }}>
                {t.noFlightsFiltersTitle}
              </h3>
              <p
                style={{
                  fontSize: 13.5,
                  color: '#5a6678',
                  lineHeight: 1.9,
                  margin: '0 auto 22px',
                  maxWidth: 380,
                }}
              >
                {t.noFlightsForFilters}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    height: 46,
                    padding: '0 22px',
                    borderRadius: 12,
                    background: '#1668c4',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t.clearFilters}
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  style={{
                    height: 46,
                    padding: '0 22px',
                    borderRadius: 12,
                    border: '1.5px solid #e6eaf0',
                    color: '#5a6678',
                    fontSize: 14,
                    fontWeight: 700,
                    background: '#fff',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t.changeSearch}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ResultsEditSearchModal
        open={editOpen}
        locale={locale}
        origin={origin}
        dest={dest}
        date={date}
        onClose={() => setEditOpen(false)}
        onSubmit={onEditSearchSubmit}
      />

      {realLockResult && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0d2640]/55 p-5"
          onClick={() => setRealLockResult(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            data-testid="real-lock-modal"
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
          >
            {realLockResult.kind === 'not-gold' && (
              <>
                <div className="mb-2 text-2xl">🔒</div>
                <h2 className="mb-1 text-sm font-black text-[#0d2640]">{t.smartFareLock}</h2>
                <p className="mb-3 text-[11.5px] leading-6 text-[#5a6678]">{t.fareLockGoldOnly}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate('/club')}
                    className="flex-1 rounded-lg bg-[#1668c4] py-2.5 text-xs font-bold text-white"
                  >
                    {t.learnAboutClub}
                  </button>
                  <button
                    onClick={() => setRealLockResult(null)}
                    className="flex-none rounded-lg border border-[#d5e1f0] px-5 py-2.5 text-xs font-bold text-[#5a6678]"
                  >
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
                  {t.lockRateUntil(
                    localeMoney(realLockResult.lock.lockedPriceIrr, locale),
                    formatJalaliDateTime(realLockResult.lock.expiresAt),
                  )}
                </p>
                <p className="mb-3 text-[11px] leading-6 text-[#8a96a6]">
                  {t.fee}: {localeMoney(realLockResult.lock.feeIrr, locale)} {t.toman}
                </p>
                <button
                  onClick={() => setRealLockResult(null)}
                  className="w-full rounded-lg bg-[#1668c4] py-2.5 text-xs font-bold text-white"
                >
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
                <button
                  onClick={() => setRealLockResult(null)}
                  className="w-full rounded-lg border border-[#d5e1f0] py-2.5 text-xs font-bold text-[#5a6678]"
                >
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

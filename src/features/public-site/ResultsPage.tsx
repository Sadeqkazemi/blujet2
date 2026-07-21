import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchFlights } from '../../api/publicSite';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import type { SearchFlightResult } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';

// نتایج پرواز — rebuilt to follow design-reference/نتایج پرواز.dc.html:
// search summary bar, 7-day Jalali price calendar, stops/time/airline
// filters, sort tabs, رادار هوشمند قیمت, and قفل قیمت. Real search results
// stay bookable; when the route/date has none, the design's mock schedule
// renders instead (per the mock-only scope — no backend calls beyond the
// single existing search request).

const CABIN_LABEL: Record<string, string> = { ECONOMY: 'اکونومی', BUSINESS: 'بیزینس' };

interface MockFlight {
  airline: string;
  dep: string;
  arr: string;
  stop: 'direct' | 'one';
  seats: number;
  priceStr: string;
  priceNum: number;
}

// Design's own sample flights (from نتایج پرواز.dc.html).
const MOCK_FLIGHTS: MockFlight[] = [
  { airline: 'کاسپین', dep: '۱۶:۴۵', arr: '۱۹:۲۰', stop: 'one', seats: 4, priceStr: '۳٬۶۵۰٬۰۰۰', priceNum: 3650 },
  { airline: 'blujet', dep: '۰۸:۳۰', arr: '۱۰:۴۵', stop: 'direct', seats: 7, priceStr: '۳٬۸۰۰٬۰۰۰', priceNum: 3800 },
  { airline: 'قشم‌ایر', dep: '۰۶:۱۵', arr: '۰۸:۳۰', stop: 'direct', seats: 3, priceStr: '۳٬۹۵۰٬۰۰۰', priceNum: 3950 },
  { airline: 'وارش', dep: '۱۱:۰۰', arr: '۱۳:۱۵', stop: 'direct', seats: 9, priceStr: '۴٬۴۰۰٬۰۰۰', priceNum: 4400 },
  { airline: 'ماهان', dep: '۱۳:۱۰', arr: '۱۶:۰۰', stop: 'one', seats: 5, priceStr: '۴٬۲۵۰٬۰۰۰', priceNum: 4250 },
  { airline: 'ایران‌ایر', dep: '۲۰:۰۰', arr: '۲۲:۱۵', stop: 'direct', seats: 6, priceStr: '۴٬۱۰۰٬۰۰۰', priceNum: 4100 },
];

// Design's 7-day price calendar (هزارتومان), day 12 selected.
const CAL_DAYS = [
  { d: '۱۰ تیر', p: '۳٬۶۵۰', cheap: true },
  { d: '۱۱ تیر', p: '۳٬۹۵۰', cheap: false },
  { d: '۱۲ تیر', p: '۳٬۸۰۰', cheap: false, sel: true },
  { d: '۱۳ تیر', p: '۴٬۱۰۰', cheap: false },
  { d: '۱۴ تیر', p: '۴٬۴۰۰', cheap: false },
  { d: '۱۵ تیر', p: '۳٬۷۵۰', cheap: true },
  { d: '۱۶ تیر', p: '۳٬۹۰۰', cheap: false },
];

function depHourBucket(dep: string): 'morning' | 'noon' | 'evening' {
  const h = parseInt(dep.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))), 10);
  if (h < 11) return 'morning';
  if (h < 16) return 'noon';
  return 'evening';
}

export default function ResultsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
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
    list.sort((a, b) => (sort === 'cheap' ? a.priceNum - b.priceNum : a.dep.localeCompare(b.dep)));
    return list;
  }, [fStops, fTime, fAirline, sort]);

  if (!origin || !dest || !date) {
    return (
      <PublicPageShell>
        <div className="mx-auto max-w-3xl p-10 text-center">
          <h1 className="mb-2 text-lg font-black text-[#0d2640]">جستجوی پرواز</h1>
          <p className="mb-6 text-sm text-[#6b7b94]">برای دیدن نتایج، ابتدا مبدأ، مقصد و تاریخ سفر را انتخاب کنید.</p>
          <button onClick={() => navigate('/')} className="rounded-lg bg-[#1668c4] px-6 py-2.5 text-sm font-bold text-white">
            رفتن به جستجو
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
              {origin} ← {dest}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">
              {formatJalaliDate(`${date}T12:00:00Z`)}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">۱ مسافر · اکونومی</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-xs font-bold text-white"
          >
            تغییر جستجو
          </button>
        </div>
      </div>

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
                {c.p}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl flex-col gap-5 p-5 md:flex-row">
        {/* FILTER SIDEBAR */}
        <aside className="w-full flex-none md:w-56">
          <div className="rounded-2xl border border-[#e8eef6] bg-white p-4">
            <div className="mb-2 text-xs font-black text-[#0d2640]">توقف</div>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'همه'],
                  ['direct', 'مستقیم'],
                  ['one', 'یک توقف'],
                ] as const
              ).map(([k, l]) => (
                <span key={k} data-testid={`f-stops-${k}`} onClick={() => setFStops(k)} className={chip(fStops === k)}>
                  {l}
                </span>
              ))}
            </div>
            <div className="mb-2 text-xs font-black text-[#0d2640]">ساعت حرکت</div>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'همه'],
                  ['morning', 'صبح'],
                  ['noon', 'ظهر'],
                  ['evening', 'عصر و شب'],
                ] as const
              ).map(([k, l]) => (
                <span key={k} onClick={() => setFTime(k)} className={chip(fTime === k)}>
                  {l}
                </span>
              ))}
            </div>
            <div className="mb-2 text-xs font-black text-[#0d2640]">ایرلاین</div>
            <div className="flex flex-wrap gap-1.5">
              <span onClick={() => setFAirline('all')} className={chip(fAirline === 'all')}>
                همه
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
              <span>📡</span> رادار هوشمند قیمت
            </div>
            <p className="mb-3 text-[11px] leading-6 text-[#5a6678]">الان بخرم یا صبر کنم؟ رادار روند قیمت این مسیر را تحلیل می‌کند.</p>
            {aiState === 'idle' && (
              <button onClick={askAi} data-testid="ai-ask" className="w-full rounded-lg bg-[#1668c4] py-2 text-xs font-bold text-white">
                تحلیل کن
              </button>
            )}
            {aiState === 'loading' && <div className="text-center text-[11px] text-[#8a96a6]">در حال تحلیل…</div>}
            {aiState === 'done' && (
              <div data-testid="ai-result">
                <div className="mb-1.5 inline-block rounded-full bg-[#e8f5ee] px-2.5 py-1 text-[11px] font-extrabold text-[#1f8a5b]">
                  ✓ توصیه: همین حالا بخرید
                </div>
                <p className="text-[11px] leading-6 text-[#3f546b]">
                  احتمال گرانی تا ۴۸ ساعت آینده حدود ۸۰٪ است؛ ارزان‌ترین گزینه، پرواز کاسپین ساعت ۱۶:۴۵ است. اگر انعطاف دارید، دوشنبه ۱۵ تیر ارزان‌تر است.
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
                ['cheap', 'ارزان‌ترین'],
                ['early', 'زودترین حرکت'],
              ] as const
            ).map(([k, l]) => (
              <span key={k} onClick={() => setSort(k)} className={chip(sort === k)}>
                {l}
              </span>
            ))}
            <span className="mr-auto text-[11px] text-[#8a96a6]">
              {faDigits(showMock ? mockShown.length : (results?.length ?? 0))} پرواز
            </span>
          </div>

          {results === null && !showMock && <p className="text-sm text-[#6b7b94]">در حال جستجو…</p>}

          {mockNotice && (
            <div data-testid="mock-notice" className="mb-3 rounded-xl border border-[#fde3c4] bg-[#fff7ed] p-3 text-xs font-semibold text-[#9a5b16]">
              این پرواز نمایشی است و ظرفیت آنلاین ندارد — برای رزرو واقعی، مسیر تهران ← مشهد را جستجو کنید یا با پشتیبانی (۰۲۱ — ۹۱۰۰۰۰۰۰) تماس بگیرید.
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
                        <div>{f.stop === 'direct' ? 'مستقیم' : 'یک توقف'}</div>
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
                      <div className="text-[10px] font-bold text-[#d64545]">{faDigits(f.seats)} صندلی باقی‌مانده</div>
                      <div className="font-num text-sm font-black text-[#1668c4]">{f.priceStr} <span className="text-[10px] font-normal text-[#8a96a6]">تومان</span></div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setLockFor(f)}
                          className="rounded-lg border border-[#d5e1f0] px-3 py-1.5 text-[11px] font-bold text-[#1668c4]"
                        >
                          🔒 قفل قیمت
                        </button>
                        <button onClick={() => setMockNotice(true)} className="rounded-lg bg-[#1668c4] px-4 py-1.5 text-[11px] font-bold text-white">
                          انتخاب
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {mockShown.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#e5e9f0] p-8 text-center text-sm text-[#6b7b94]">
                  با این فیلترها پروازی نمانده — فیلترها را بازنشانی کنید.
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
                        <div className="text-[11px] text-[#6b7b94]">{CABIN_LABEL[c.cabin]}</div>
                        <div className="font-num text-sm font-extrabold text-[#1668c4]">{faMoney(c.priceIrr)} تومان</div>
                        <div className="text-[10px] text-[#6b7b94]">{faDigits(c.seatsLeft)} صندلی باقی‌مانده</div>
                      </div>
                      <button
                        disabled={c.seatsLeft === 0}
                        onClick={() => navigate(`/book/${r.flightInstanceId}?cabin=${c.cabin}`)}
                        className="rounded-lg bg-[#1668c4] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                      >
                        انتخاب
                      </button>
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
            <h2 className="mb-1 text-sm font-black text-[#0d2640]">قفل هوشمند قیمت</h2>
            <p className="mb-3 text-[11.5px] leading-6 text-[#5a6678]">
              پرواز {lockFor.airline} ساعت {lockFor.dep} — قفل قیمت تا ۷۲ ساعت مخصوص اعضای سطح طلایی باشگاه مشتریان است.
            </p>
            <div className="flex gap-2">
              <button onClick={() => navigate('/club')} className="flex-1 rounded-lg bg-[#1668c4] py-2.5 text-xs font-bold text-white">
                آشنایی با باشگاه
              </button>
              <button onClick={() => setLockFor(null)} className="flex-none rounded-lg border border-[#d5e1f0] px-5 py-2.5 text-xs font-bold text-[#5a6678]">
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </PublicPageShell>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchFlights } from '../../api/publicSite';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import type { SearchFlightResult } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';

const CABIN_LABEL: Record<string, string> = { ECONOMY: 'اکونومی', BUSINESS: 'بیزینس' };

// Sample data only schedules flight instances on certain future dates, so
// when the requested date is empty the page walks forward day by day to the
// nearest REAL, bookable flight on the same route instead of dead-ending.
const PROBE_DAYS = 30;

// Display-only mock schedule (design placeholder figures) for routes with no
// scheduled instance at all — keeps the page alive without pretending a
// non-existent flight is bookable.
const MOCK_FALLBACK = [
  { flightNo: 'BJ-201', dep: '۰۷:۳۰', economy: '۱٬۶۰۰٬۰۰۰', business: '۲٬۹۰۰٬۰۰۰' },
  { flightNo: 'BJ-305', dep: '۱۲:۴۵', economy: '۱٬۷۵۰٬۰۰۰', business: '۳٬۱۰۰٬۰۰۰' },
  { flightNo: 'BJ-410', dep: '۱۸:۲۰', economy: '۱٬۵۲۰٬۰۰۰', business: '۲٬۷۵۰٬۰۰۰' },
];

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function ResultsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const origin = params.get('origin') ?? '';
  const dest = params.get('dest') ?? '';
  const date = params.get('date') ?? '';

  const [results, setResults] = useState<SearchFlightResult[] | null>(null);
  const [effectiveDate, setEffectiveDate] = useState<string | null>(null);
  const [noneFound, setNoneFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!origin || !dest || !date) return;
    let cancelled = false;
    setResults(null);
    setEffectiveDate(null);
    setNoneFound(false);
    setError(null);

    (async () => {
      try {
        const first = await searchFlights(origin, dest, date);
        if (cancelled) return;
        if (first.length > 0) {
          setResults(first);
          setEffectiveDate(date);
          return;
        }
        for (let i = 1; i <= PROBE_DAYS; i++) {
          const found = await searchFlights(origin, dest, addDaysIso(date, i));
          if (cancelled) return;
          if (found.length > 0) {
            setResults(found);
            setEffectiveDate(addDaysIso(date, i));
            return;
          }
        }
        if (!cancelled) setNoneFound(true);
      } catch {
        if (!cancelled) setError('خطا در جستجوی پرواز.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [origin, dest, date]);

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

  return (
    <PublicPageShell>
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-black text-[#0d2640]">
        {origin} ← {dest}
      </h1>
      <p className="mb-6 text-xs text-[#6b7b94]">{date}</p>

      {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}

      {results === null && !error && !noneFound && <p className="text-sm text-[#6b7b94]">در حال جستجو…</p>}

      {effectiveDate && effectiveDate !== date && (
        <div data-testid="nearest-date-notice" className="mb-4 rounded-xl border border-[#fde3c4] bg-[#fff7ed] p-3 text-xs font-semibold text-[#9a5b16]">
          برای تاریخ انتخابی پروازی نبود — نزدیک‌ترین پروازهای همین مسیر در تاریخ{' '}
          <b>{formatJalaliDate(`${effectiveDate}T12:00:00Z`)}</b> را می‌بینید.
        </div>
      )}

      {noneFound && (
        <div>
          <div className="mb-4 rounded-xl border border-[#fde3c4] bg-[#fff7ed] p-3 text-xs font-semibold text-[#9a5b16]">
            در حال حاضر ظرفیت آنلاین برای این مسیر تعریف نشده — برنامهٔ زمانی نمونهٔ زیر جنبهٔ نمایشی دارد؛ برای خرید با پشتیبانی (۰۲۱ — ۹۱۰۰۰۰۰۰) تماس بگیرید.
          </div>
          <div className="flex flex-col gap-3">
            {MOCK_FALLBACK.map((m) => (
              <div key={m.flightNo} data-testid="mock-result-card" className="rounded-2xl border border-[#e5e9f0] bg-white p-5 shadow-sm opacity-90">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="font-num text-sm font-extrabold text-[#0d2640]" dir="ltr">{m.flightNo}</div>
                    <div className="mt-1 text-xs text-[#6b7b94]">ساعت حرکت {m.dep}</div>
                  </div>
                  <div className="text-xs text-[#6b7b94]">ایرباس A320</div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: 'اکونومی', price: m.economy },
                    { label: 'بیزینس', price: m.business },
                  ].map((c) => (
                    <div key={c.label} className="flex flex-1 min-w-[160px] items-center justify-between rounded-xl border border-[#e5e9f0] p-3">
                      <div>
                        <div className="text-[11px] text-[#6b7b94]">{c.label}</div>
                        <div className="font-num text-sm font-extrabold text-[#1668c4]">{c.price} تومان</div>
                      </div>
                      <span className="rounded-lg bg-[#eef1f5] px-4 py-2 text-xs font-bold text-[#8a96a6]">تکمیل ظرفیت آنلاین</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <div key={c.cabin} className="flex flex-1 min-w-[160px] items-center justify-between rounded-xl border border-[#e5e9f0] p-3">
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
    </div>
    </PublicPageShell>
  );
}

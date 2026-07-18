import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchFlights } from '../../api/publicSite';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { SearchFlightResult } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';

const CABIN_LABEL: Record<string, string> = { ECONOMY: 'اکونومی', BUSINESS: 'بیزینس' };

// Mock schedule (design placeholder figures) shown whenever the real search
// has nothing for the requested route/date — a single real attempt, then
// straight to mock. (NO multi-day probing: rapid sequential searches trip
// the backend's per-IP rate limit and turn into a 429 error page.)
const MOCK_FALLBACK = [
  { flightNo: 'BJ-201', dep: '۰۷:۳۰', arr: '۰۹:۰۰', economy: '۱٬۶۰۰٬۰۰۰', business: '۲٬۹۰۰٬۰۰۰', seats: '۱۲' },
  { flightNo: 'BJ-305', dep: '۱۲:۴۵', arr: '۱۴:۱۵', economy: '۱٬۷۵۰٬۰۰۰', business: '۳٬۱۰۰٬۰۰۰', seats: '۷' },
  { flightNo: 'BJ-410', dep: '۱۸:۲۰', arr: '۱۹:۵۰', economy: '۱٬۵۲۰٬۰۰۰', business: '۲٬۷۵۰٬۰۰۰', seats: '۴' },
];

export default function ResultsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const origin = params.get('origin') ?? '';
  const dest = params.get('dest') ?? '';
  const date = params.get('date') ?? '';

  const [results, setResults] = useState<SearchFlightResult[] | null>(null);
  const [showMock, setShowMock] = useState(false);
  const [mockNotice, setMockNotice] = useState(false);

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

      {results === null && !showMock && <p className="text-sm text-[#6b7b94]">در حال جستجو…</p>}

      {showMock && (
        <div>
          {mockNotice && (
            <div data-testid="mock-notice" className="mb-4 rounded-xl border border-[#fde3c4] bg-[#fff7ed] p-3 text-xs font-semibold text-[#9a5b16]">
              این پرواز نمایشی است و ظرفیت آنلاین ندارد — برای رزرو واقعی، مسیر تهران ← مشهد را جستجو کنید یا با پشتیبانی (۰۲۱ — ۹۱۰۰۰۰۰۰) تماس بگیرید.
            </div>
          )}
          <div className="flex flex-col gap-3">
            {MOCK_FALLBACK.map((m) => (
              <div key={m.flightNo} data-testid="mock-result-card" className="rounded-2xl border border-[#e5e9f0] bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="font-num text-sm font-extrabold text-[#0d2640]" dir="ltr">{m.flightNo}</div>
                    <div className="mt-1 text-xs text-[#6b7b94]">
                      حرکت {m.dep} — رسیدن {m.arr}
                    </div>
                  </div>
                  <div className="text-xs text-[#6b7b94]">ایرباس A320</div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: 'اکونومی', price: m.economy, seats: m.seats },
                    { label: 'بیزینس', price: m.business, seats: '۲' },
                  ].map((c) => (
                    <div key={c.label} className="flex flex-1 min-w-[160px] items-center justify-between rounded-xl border border-[#e5e9f0] p-3">
                      <div>
                        <div className="text-[11px] text-[#6b7b94]">{c.label}</div>
                        <div className="font-num text-sm font-extrabold text-[#1668c4]">{c.price} تومان</div>
                        <div className="text-[10px] text-[#6b7b94]">{c.seats} صندلی باقی‌مانده</div>
                      </div>
                      <button
                        onClick={() => setMockNotice(true)}
                        className="rounded-lg bg-[#1668c4] px-4 py-2 text-xs font-bold text-white"
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

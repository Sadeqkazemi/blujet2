import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchFlights } from '../../api/publicSite';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { SearchFlightResult } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';

const CABIN_LABEL: Record<string, string> = { ECONOMY: 'اکونومی', BUSINESS: 'بیزینس' };

export default function ResultsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const origin = params.get('origin') ?? '';
  const dest = params.get('dest') ?? '';
  const date = params.get('date') ?? '';

  const [results, setResults] = useState<SearchFlightResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!origin || !dest || !date) return;
    setResults(null);
    searchFlights(origin, dest, date)
      .then(setResults)
      .catch(() => setError('خطا در جستجوی پرواز.'));
  }, [origin, dest, date]);

  return (
    <PublicPageShell>
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-black text-[#0d2640]">
        {origin} ← {dest}
      </h1>
      <p className="mb-6 text-xs text-[#6b7b94]">{date}</p>

      {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}

      {results === null && !error && <p className="text-sm text-[#6b7b94]">در حال جستجو…</p>}

      {results && results.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#e5e9f0] p-8 text-center text-sm text-[#6b7b94]">
          پروازی برای این مسیر و تاریخ یافت نشد.
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

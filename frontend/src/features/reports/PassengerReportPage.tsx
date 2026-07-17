import { useEffect, useState } from 'react';
import { fetchPassengerReport } from '../../api/finance';
import { faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { PassengerReportResult } from '../../types/finance';

const STATUS_FA: Record<string, string> = {
  TICKETED: 'بلیط صادر شده',
  PAID: 'پرداخت‌شده',
  REFUNDED: 'استرداد شده',
  CANCELLED: 'لغو شده',
};

export default function PassengerReportPage() {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<PassengerReportResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(q: string) {
    setError(null);
    try {
      setData(await fetchPassengerReport(q));
      setSearched(q.trim().length > 0);
    } catch {
      setError('خطا در جستجوی مسافر.');
    }
  }

  useEffect(() => {
    void search('');
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-xl font-black text-ink">جستجوی مسافر</h1>
      <p className="mt-1 text-sm text-muted">
        نام و نام خانوادگی مسافر (یا کد ملی) را وارد کنید تا جزئیات بلیط، پرواز و تاریخ نمایش داده شود.
      </p>

      {error && <p className="my-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <div className="mt-5 flex max-w-xl gap-2">
        <input
          aria-label="جستجوی مسافر"
          placeholder="مثال: نگار رضایی"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search(query)}
          className="h-11 flex-1 rounded-xl border border-border bg-white px-4 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={() => void search(query)}
          className="rounded-xl bg-accent px-6 text-sm font-black text-white transition hover:bg-accent/90"
        >
          جستجو
        </button>
      </div>

      {data && data.quickNames.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-muted">جستجوی سریع:</span>
          {data.quickNames.map((n) => (
            <button
              key={n}
              onClick={() => {
                setQuery(n);
                void search(n);
              }}
              className="rounded-full border border-border bg-white px-3 py-1 text-muted"
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {searched && data && data.results.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted">
          مسافری با این نام یافت نشد.
        </p>
      )}

      {data?.results.map((r) => (
        <div key={r.id} className="mt-6 max-w-2xl overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex items-center justify-between bg-surface px-4 py-3">
            <div>
              <div className="text-sm font-black text-ink">{r.fullName}</div>
            </div>
            <span className="rounded-full bg-[#10b98124] px-3 py-1 text-[11px] font-bold text-[#059669]">
              {STATUS_FA[r.status] ?? r.status}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3 p-4 text-xs">
            <div>
              <dt className="text-[10px] text-muted">کد رزرو (PNR)</dt>
              <dd className="ltr font-num font-bold text-ink">{r.pnr}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted">شماره پرواز</dt>
              <dd className="ltr font-num font-bold text-ink">{r.flightNo}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted">مسیر</dt>
              <dd className="font-bold text-ink">
                {r.originCode} ← {r.destCode}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted">ایرلاین</dt>
              <dd className="font-bold text-ink">blujet</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted">تاریخ و ساعت پرواز</dt>
              <dd className="font-num font-bold text-ink">{formatJalaliDateTime(r.departureAt)}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted">صندلی / کلاس</dt>
              <dd className="ltr font-num font-bold text-ink">{r.seatCode ?? '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] text-muted">مبلغ بلیط</dt>
              <dd className="font-num font-black text-[#059669]">{faMoney(r.priceIrr)} تومان</dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );
}

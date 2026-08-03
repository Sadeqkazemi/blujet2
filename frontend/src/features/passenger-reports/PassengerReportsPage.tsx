import { useState, type FormEvent } from 'react';
import { searchPassengers } from '../../api/reporting';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import type { PassengerReportHit } from '../../types/reporting';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  HELD: 'رزرو موقت',
  PAID: 'پرداخت‌شده',
  TICKETED: 'صادرشده',
  CANCELLED: 'لغوشده',
  EXPIRED: 'منقضی‌شده',
  REFUNDED: 'مستردشده',
};

const QUICK_PASSENGER_NAMES = ['نگار رضایی', 'رضا کریمی', 'سارا محمدی'];

export default function PassengerReportsPage() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PassengerReportHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hitsPager = usePagination(hits ?? []);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    try {
      setHits(await searchPassengers(query.trim()));
    } catch {
      setError('خطا در جستجوی مسافر.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="p-8">
      <h1 className="mb-1 text-xl font-black text-panel-ink">گزارش مسافران</h1>
      <p className="mb-6 text-sm text-panel-muted">جستجوی مسافر و مشاهده‌ی جزئیات بلیط</p>

      <div className="rounded-xl border border-panel-border bg-panel-surface p-5">
        <div className="mb-1 text-sm font-bold text-panel-ink">جستجوی مسافر</div>
        <p className="mb-4 text-[11.5px] text-panel-muted">
          نام و نام خانوادگی مسافر (یا کد ملی) را وارد کنید تا جزئیات بلیط، پرواز و تاریخ نمایش داده شود.
        </p>
        <form onSubmit={onSearch} className="flex max-w-xl gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="مثال: نگار رضایی"
            className="flex-1 rounded-lg border border-panel-border-2 bg-panel-canvas px-3.5 py-2.5 text-sm text-panel-ink outline-none placeholder:text-panel-muted focus:border-accent"
          />
          <button
            type="submit"
            disabled={searching || query.trim().length < 2}
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {searching ? 'در حال جستجو…' : 'جستجو'}
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_PASSENGER_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setQuery(name);
                void searchPassengers(name).then(setHits).catch(() => setError('خطا در جستجوی مسافر.'));
              }}
              className="rounded-full border border-panel-border bg-panel-canvas px-3 py-1 text-[11px] text-panel-muted transition hover:border-accent/40 hover:text-panel-ink"
            >
              {name}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-xs text-danger">
            {error}
          </p>
        )}

        {hits !== null && hits.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-panel-border p-5 text-center text-xs text-panel-muted">
            مسافری با این نام یافت نشد.
          </div>
        )}

        {hits !== null && hits.length > 0 && (
          <div className="mt-6 flex flex-col gap-4">
            {hitsPager.pageItems.map((h) => (
              <div key={`${h.pnr}-${h.fullName}`} className="overflow-hidden rounded-xl border border-panel-border">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-panel-canvas px-4 py-3">
                  <div>
                    <div className="text-sm font-extrabold text-panel-ink">{h.fullName}</div>
                    {h.maskedNationalId && (
                      <div className="ltr font-num mt-0.5 text-[11px] text-panel-muted">
                        کد ملی: {faDigits(h.maskedNationalId)}
                      </div>
                    )}
                  </div>
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-[11px] font-bold text-accent">
                    {STATUS_LABEL[h.status] ?? h.status}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-5 gap-y-4 p-4 text-xs md:grid-cols-4">
                  <div>
                    <dt className="text-[10px] text-panel-muted">کد رزرو (PNR)</dt>
                    <dd className="ltr font-num mt-1 font-bold text-panel-ink">{h.pnr}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-panel-muted">شماره پرواز</dt>
                    <dd className="ltr font-num mt-1 font-bold text-panel-ink">{h.flightNo}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-panel-muted">مسیر</dt>
                    <dd className="ltr font-num mt-1 font-bold text-panel-ink">
                      {h.originCode} → {h.destCode}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-panel-muted">ایرلاین</dt>
                    <dd className="mt-1 font-bold text-panel-ink">blujet</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-panel-muted">تاریخ پرواز</dt>
                    <dd className="font-num mt-1 font-bold text-panel-ink">{formatJalaliDate(h.departureAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-panel-muted">ساعت</dt>
                    <dd className="font-num mt-1 font-bold text-panel-ink">
                      {formatJalaliDateTime(h.departureAt).split(' ')[1] ?? ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-panel-muted">صندلی / کلاس</dt>
                    <dd className="mt-1 font-bold text-panel-ink">
                      {h.seatCode ? `${faDigits(h.seatCode)} · ` : ''}
                      {h.cabin === 'BUSINESS' ? 'بیزنس' : h.cabin === 'ECONOMY' ? 'اکونومی' : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-panel-muted">مبلغ بلیط</dt>
                    <dd className="font-num mt-1 font-bold text-[#059669]">{faMoney(h.priceIrr)} تومان</dd>
                  </div>
                </dl>
              </div>
            ))}
            <Pagination
              page={hitsPager.page}
              totalPages={hitsPager.totalPages}
              onChange={hitsPager.setPage}
              variant="dark"
            />
          </div>
        )}
      </div>
    </div>
  );
}

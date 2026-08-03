import { useState, type FormEvent } from 'react';
import { searchPassengers } from '../../api/reporting';
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
    <div className="px-[21px] pb-[34px] pt-[18px]">
      <h1 className="mb-1 text-[20.5px] font-black text-white">گزارش مسافران</h1>
      <p className="mb-6 text-sm text-[#6b7b94]">جستجوی مسافر و مشاهده‌ی جزئیات بلیط</p>

      <div className="rounded-[14px] border border-[#1f2a3d] bg-[#141d2e] p-5">
        <div className="mb-1 text-[14.5px] font-extrabold text-white">جستجوی مسافر</div>
        <p className="mb-4 text-[11.5px] text-[#6b7b94]">
          نام و نام خانوادگی مسافر (یا کد ملی) را وارد کنید تا جزئیات بلیط، پرواز و تاریخ نمایش داده شود.
        </p>
        <form onSubmit={onSearch} className="flex max-w-xl gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="مثال: نگار رضایی"
            className="flex-1 rounded-[10px] border border-[#28344c] bg-[#0f1726] px-3.5 py-2.5 text-sm text-[#e7ecf3] outline-none placeholder:text-[#6b7b94] focus:border-[#3b82f6]"
          />
          <button
            type="submit"
            disabled={searching || query.trim().length < 2}
            className="rounded-[10px] bg-[#3b82f6] px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
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
              className="rounded-full border border-[#28344c] bg-[#18223a] px-3 py-1 text-[11px] text-[#9fb0c7] transition hover:border-[#3b82f666] hover:text-white"
            >
              {name}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-xs text-[#f87171]">
            {error}
          </p>
        )}

        {hits !== null && hits.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-[#28344c] p-5 text-center text-xs text-[#6b7b94]">
            مسافری با این نام یافت نشد.
          </div>
        )}

        {hits !== null && hits.length > 0 && (
          <div className="mt-6 flex flex-col gap-4">
            {hits.map((h) => (
              <div
                key={`${h.pnr}-${h.fullName}`}
                className="overflow-hidden rounded-[14px] border border-[#22304a] bg-[#0f1726]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1a2436] bg-[#18223a] px-4 py-3">
                  <div>
                    <div className="text-sm font-extrabold text-[#e7ecf3]">{h.fullName}</div>
                    {h.maskedNationalId && (
                      <div className="ltr font-num mt-0.5 text-[11px] text-[#6b7b94]">
                        کد ملی: {faDigits(h.maskedNationalId)}
                      </div>
                    )}
                  </div>
                  <span className="rounded-full bg-[rgba(59,130,246,.14)] px-3 py-1 text-[11px] font-bold text-[#60a5fa]">
                    {STATUS_LABEL[h.status] ?? h.status}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-5 gap-y-4 p-4 text-xs md:grid-cols-4">
                  <div>
                    <dt className="text-[10px] text-[#6b7b94]">کد رزرو (PNR)</dt>
                    <dd className="ltr font-num mt-1 font-bold text-[#e7ecf3]">{h.pnr}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-[#6b7b94]">شماره پرواز</dt>
                    <dd className="ltr font-num mt-1 font-bold text-[#e7ecf3]">{h.flightNo}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-[#6b7b94]">مسیر</dt>
                    <dd className="ltr font-num mt-1 font-bold text-[#e7ecf3]">
                      {h.originCode} → {h.destCode}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-[#6b7b94]">ایرلاین</dt>
                    <dd className="mt-1 font-bold text-[#e7ecf3]">blujet</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-[#6b7b94]">تاریخ پرواز</dt>
                    <dd className="font-num mt-1 font-bold text-[#e7ecf3]">{formatJalaliDate(h.departureAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-[#6b7b94]">ساعت</dt>
                    <dd className="font-num mt-1 font-bold text-[#e7ecf3]">
                      {formatJalaliDateTime(h.departureAt).split(' ')[1] ?? ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-[#6b7b94]">صندلی / کلاس</dt>
                    <dd className="mt-1 font-bold text-[#e7ecf3]">
                      {h.seatCode ? `${faDigits(h.seatCode)} · ` : ''}
                      {h.cabin === 'BUSINESS' ? 'بیزنس' : h.cabin === 'ECONOMY' ? 'اکونومی' : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-[#6b7b94]">مبلغ بلیط</dt>
                    <dd className="font-num mt-1 font-bold text-[#34d399]">{faMoney(h.priceIrr)} تومان</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

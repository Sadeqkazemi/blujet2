import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchBookingByPnr, submitRefund } from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { BookingDetail } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';

export default function TicketPage() {
  const { pnr } = useParams<{ pnr: string }>();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [iban, setIban] = useState('');
  const [refundResult, setRefundResult] = useState<string | null>(null);

  useEffect(() => {
    if (!pnr) return;
    fetchBookingByPnr(pnr)
      .then(setBooking)
      .catch(() => setError('بلیط یافت نشد.'));
  }, [pnr]);

  async function onSubmitRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!booking) return;
    setError(null);
    try {
      const r = await submitRefund(booking.id, iban);
      setRefundResult(
        `درخواست استرداد ثبت شد — مبلغ قابل استرداد: ${faMoney(r.refundableIrr)} تومان (جریمه ${faDigits(r.penaltyPct)}٪)`,
      );
      setShowRefundForm(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در ثبت درخواست استرداد.');
    }
  }

  if (error) {
    return (
      <PublicPageShell>
        <p className="p-8 text-sm text-red-600">{error}</p>
      </PublicPageShell>
    );
  }
  if (!booking) {
    return (
      <PublicPageShell>
        <p className="p-8 text-sm text-[#6b7b94]">در حال بارگذاری…</p>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
    <div className="mx-auto max-w-[640px] p-6">
      <h1 className="mb-4 text-lg font-extrabold text-[#0d2640]">بلیط الکترونیکی</h1>

      {/* Boarding-pass card per the design's ticket visual */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_24px_54px_-28px_rgba(13,38,102,.35)]">
        <div className="flex items-center justify-between px-6 py-4" style={{ background: 'linear-gradient(120deg,#1668c4,#0d3b66)' }}>
          <span className="flex items-center gap-2 text-sm font-black text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">✈</span> blujet
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[10.5px] font-bold text-white">
            {booking.status === 'TICKETED' ? 'کارت پرواز · صادر شده' : booking.status}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 px-6 py-5">
          <div className="text-center">
            <div className="font-num text-2xl font-black text-[#0d2640]" dir="ltr">{booking.originCode}</div>
            <div className="mt-1 text-[10.5px] text-[#8a96a6]">مبدأ</div>
          </div>
          <div className="flex-1 text-center text-[10.5px] text-[#8a96a6]">
            <div className="font-num mb-1 font-bold text-[#1668c4]" dir="ltr">{booking.flightNo}</div>
            <div className="relative border-t-2 border-dashed border-[#d5e1f0]">
              <span className="absolute -top-2.5 right-1/2 translate-x-1/2 bg-white px-1.5 text-sm text-[#1668c4]">✈</span>
            </div>
            <div className="mt-1.5">{formatJalaliDateTime(booking.departureAt)}</div>
          </div>
          <div className="text-center">
            <div className="font-num text-2xl font-black text-[#0d2640]" dir="ltr">{booking.destCode}</div>
            <div className="mt-1 text-[10.5px] text-[#8a96a6]">مقصد</div>
          </div>
        </div>

        {/* perforation */}
        <div className="relative border-t-2 border-dashed border-[#e3e9f1]">
          <span className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-[#f6f8fb]" />
          <span className="absolute -top-3 -left-3 h-6 w-6 rounded-full bg-[#f6f8fb]" />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-6 py-4">
          <div>
            <div className="text-[10px] text-[#8a96a6]">کد رزرو (PNR)</div>
            <div className="font-num text-base font-black tracking-widest text-[#1668c4]" dir="ltr">{booking.pnr}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#8a96a6]">کلاس پروازی</div>
            <div className="text-xs font-extrabold text-[#0d2640]">{booking.cabin === 'BUSINESS' ? 'بیزینس' : 'اکونومی'}</div>
          </div>
        </div>

        <div className="border-t border-[#f2f4f7] px-6 py-4">
          <div className="mb-2 text-[11px] font-black text-[#0d2640]">مسافران</div>
          <div className="flex flex-col gap-2">
            {booking.passengers.map((p) => (
              <div key={p.seatCode} className="flex items-center justify-between rounded-xl bg-[#fafbfd] px-3.5 py-2.5 text-xs">
                <span className="font-bold text-[#16202e]">{p.fullName}</span>
                <span className="font-num rounded-lg bg-[#eef4fb] px-2.5 py-1 font-extrabold text-[#1668c4]" dir="ltr">
                  {p.seatCode}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#f2f4f7] bg-[#fafbfd] px-6 py-3.5">
          <span className="text-[10px] text-[#8a96a6]">این کارت را هنگام پذیرش نشان دهید</span>
          <span className="font-num text-lg tracking-[3px] text-[#0d2640]" aria-hidden>
            ▮▯▮▮▯▮▯▮▮▯▮▮
          </span>
        </div>
      </div>

      <button onClick={() => window.print()} className="mt-4 w-full rounded-xl border border-[#d5e1f0] bg-white py-2.5 text-xs font-bold text-[#1668c4]">
        دانلود / چاپ بلیط
      </button>

      {booking.status === 'TICKETED' && (
        <div className="mt-6">
          {refundResult && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">{refundResult}</p>}
          {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}
          {!refundResult &&
            (showRefundForm ? (
              <form onSubmit={onSubmitRefund} className="rounded-2xl border border-[#e5e9f0] bg-white p-4">
                <label htmlFor="iban" className="mb-1.5 block text-xs text-[#6b7b94]">
                  شماره شبا
                </label>
                <input
                  id="iban"
                  data-testid="refund-iban"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="IR820170000000332211009900"
                  className="font-num mb-3 w-full rounded-lg border border-[#e5e9f0] px-3.5 py-2.5 text-sm outline-none focus:border-[#1668c4]"
                />
                <button type="submit" data-testid="submit-refund" className="rounded-lg bg-[#1668c4] px-5 py-2.5 text-xs font-bold text-white">
                  ثبت درخواست استرداد
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowRefundForm(true)}
                data-testid="open-refund-form"
                className="text-xs font-bold text-red-600 underline decoration-dotted"
              >
                درخواست استرداد بلیط
              </button>
            ))}
        </div>
      )}
    </div>
    </PublicPageShell>
  );
}

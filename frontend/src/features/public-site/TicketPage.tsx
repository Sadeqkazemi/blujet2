import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchBookingByPnr, submitRefund } from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { BookingDetail } from '../../types/public-site';

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

  if (error) return <p className="p-8 text-sm text-red-600">{error}</p>;
  if (!booking) return <p className="p-8 text-sm text-[#6b7b94]">در حال بارگذاری…</p>;

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-lg font-extrabold text-[#0d2640]">بلیط الکترونیکی</h1>
      <div className="rounded-2xl border-2 border-dashed border-[#1668c4] bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-[#6b7b94]">کد رزرو (PNR)</span>
          <span className="font-num text-lg font-black tracking-widest text-[#1668c4]">{booking.pnr}</span>
        </div>
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="font-bold text-[#0d2640]">{booking.flightNo}</span>
          <span className="text-[#6b7b94]">
            {booking.originCode} ← {booking.destCode}
          </span>
        </div>
        <div className="mb-4 text-xs text-[#6b7b94]">{formatJalaliDateTime(booking.departureAt)}</div>
        <div className="mb-4 flex flex-col gap-1">
          {booking.passengers.map((p) => (
            <div key={p.seatCode} className="flex justify-between text-xs text-[#6b7b94]">
              <span>{p.fullName}</span>
              <span className="font-num">{p.seatCode}</span>
            </div>
          ))}
        </div>
        <div className="rounded-full bg-[#10b98124] px-3 py-1 text-center text-xs font-bold text-[#059669]">
          {booking.status === 'TICKETED' ? 'صادر شده' : booking.status}
        </div>
      </div>

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
  );
}

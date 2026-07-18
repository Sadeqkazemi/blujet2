import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchMyBooking, payBooking } from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import { faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { BookingDetail } from '../../types/public-site';

export default function CheckoutPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [priceChange, setPriceChange] = useState<{ previousPriceIrr: number; currentPriceIrr: number } | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    fetchMyBooking(bookingId)
      .then(setBooking)
      .catch(() => setError('رزرو یافت نشد.'));
  }, [bookingId]);

  async function onPay(confirmedPriceIrr?: number) {
    if (!bookingId) return;
    setError(null);
    setPaying(true);
    try {
      const result = await payBooking(bookingId, confirmedPriceIrr);
      if (result.priceChanged) {
        setPriceChange(result);
        return;
      }
      navigate(`/ticket/${result.booking.pnr}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'خطا در پرداخت.');
    } finally {
      setPaying(false);
    }
  }

  if (error) return <p className="p-8 text-sm text-red-600">{error}</p>;
  if (!booking) return <p className="p-8 text-sm text-[#6b7b94]">در حال بارگذاری…</p>;

  if (booking.status === 'EXPIRED') {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="mb-4 text-sm text-red-600">مهلت نگهداری این رزرو به پایان رسیده است.</p>
        <button onClick={() => navigate('/')} className="rounded-lg bg-[#1668c4] px-6 py-2.5 text-sm font-bold text-white">
          جستجوی مجدد
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-lg font-extrabold text-[#0d2640]">تکمیل خرید</h1>
      <div className="mb-4 rounded-2xl border border-[#e5e9f0] bg-white p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-bold text-[#0d2640]">{booking.flightNo}</span>
          <span className="text-[#6b7b94]">
            {booking.originCode} ← {booking.destCode}
          </span>
        </div>
        <div className="mb-3 text-xs text-[#6b7b94]">{formatJalaliDateTime(booking.departureAt)}</div>
        <div className="flex flex-col gap-1">
          {booking.passengers.map((p) => (
            <div key={p.seatCode} className="flex justify-between text-xs text-[#6b7b94]">
              <span>{p.fullName}</span>
              <span className="font-num">{p.seatCode}</span>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}

      {priceChange ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <p className="mb-2 text-xs text-amber-800">قیمت این پرواز تغییر کرده است.</p>
          <p className="font-num mb-4 text-sm font-extrabold text-amber-900">
            قیمت جدید: {faMoney(priceChange.currentPriceIrr)} تومان
          </p>
          <button
            disabled={paying}
            onClick={() => onPay(priceChange.currentPriceIrr)}
            data-testid="confirm-new-price"
            className="rounded-lg bg-[#1668c4] px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            تأیید قیمت جدید و پرداخت
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#e5e9f0] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs text-[#6b7b94]">مبلغ قابل پرداخت</span>
            <span className="font-num text-lg font-black text-[#1668c4]">{faMoney(booking.priceIrr)} تومان</span>
          </div>
          <button
            disabled={paying}
            onClick={() => onPay()}
            data-testid="pay-submit"
            className="w-full rounded-lg bg-[#1668c4] px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {paying ? 'در حال پرداخت…' : 'پرداخت و صدور بلیط'}
          </button>
        </div>
      )}
    </div>
  );
}

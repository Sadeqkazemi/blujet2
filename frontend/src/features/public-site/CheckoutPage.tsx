import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchMyBooking } from '../../api/publicSite';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { localeMoney } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import type { BookingDetail } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';
import FlowStepper from '../../components/public/FlowStepper';

const CABIN_LABEL: Record<string, Record<StoredLocale, string>> = {
  ECONOMY: { fa: 'اکونومی', en: 'Economy', ar: 'اقتصادية' },
  BUSINESS: { fa: 'بیزینس', en: 'Business', ar: 'درجة الأعمال' },
};

const STR: Record<
  StoredLocale,
  {
    loading: string;
    notFound: string;
    expired: string;
    searchAgain: string;
    title: string;
    continueToPayment: string;
    payable: string;
    toman: string;
    passengers: string;
  }
> = {
  fa: {
    loading: 'در حال بارگذاری…',
    notFound: 'رزرو یافت نشد.',
    expired: 'مهلت نگهداری این رزرو به پایان رسیده است.',
    searchAgain: 'جستجوی مجدد',
    title: 'تکمیل خرید',
    continueToPayment: 'ادامه به پرداخت',
    payable: 'مبلغ قابل پرداخت',
    toman: 'تومان',
    passengers: 'مسافران',
  },
  en: {
    loading: 'Loading…',
    notFound: 'Booking not found.',
    expired: 'The hold on this booking has expired.',
    searchAgain: 'Search again',
    title: 'Review booking',
    continueToPayment: 'Continue to payment',
    payable: 'Amount due',
    toman: 'Toman',
    passengers: 'Passengers',
  },
  ar: {
    loading: 'جارٍ التحميل…',
    notFound: 'لم يُعثر على الحجز.',
    expired: 'انتهت مهلة الاحتفاظ بهذا الحجز.',
    searchAgain: 'بحث مجدداً',
    title: 'إتمام الشراء',
    continueToPayment: 'المتابعة إلى الدفع',
    payable: 'المبلغ المستحق',
    toman: 'تومان',
    passengers: 'المسافرون',
  },
};

function formatBookingDateTime(value: string, locale: StoredLocale) {
  if (locale === 'en') {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  }
  return formatJalaliDateTime(value);
}

function formatBookingDate(value: string, locale: StoredLocale) {
  if (locale === 'en') {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
  }
  return formatJalaliDate(value);
}

export default function CheckoutPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const t = STR[locale];

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    fetchMyBooking(bookingId)
      .then(setBooking)
      .catch(() => setError(t.notFound));
  }, [bookingId, t.notFound]);

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
        <p className="p-8 text-sm text-[#6b7b94]">{t.loading}</p>
      </PublicPageShell>
    );
  }

  if (booking.status === 'EXPIRED') {
    return (
      <PublicPageShell>
        <div className="mx-auto max-w-md p-8 text-center">
          <p className="mb-4 text-sm text-red-600">{t.expired}</p>
          <button
            onClick={() => navigate('/')}
            className="rounded-lg bg-[#1668c4] px-6 py-2.5 text-sm font-bold text-white"
          >
            {t.searchAgain}
          </button>
        </div>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <FlowStepper current="checkout" onBack={() => navigate(-1)} />
      <div className="mx-auto max-w-lg p-6">
        <h1 className="mb-4 text-lg font-extrabold text-[#0d2640]">{t.title}</h1>

        <div className="mb-4 rounded-2xl border border-[#eef1f5] bg-white p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-bold text-[#0d2640]" dir="ltr">
              {booking.flightNo}
            </span>
            <span className="text-[#6b7b94]" dir="ltr">
              {booking.originCode} ← {booking.destCode}
            </span>
          </div>
          <div className="mb-1 text-xs text-[#6b7b94]">
            {formatBookingDate(booking.departureAt, locale)} ·{' '}
            {CABIN_LABEL[booking.cabin]?.[locale] ?? booking.cabin}
          </div>
          <div className="mb-3 text-xs text-[#6b7b94]">{formatBookingDateTime(booking.departureAt, locale)}</div>

          <div className="mb-3 text-[11px] font-black text-[#0d2640]">{t.passengers}</div>
          <div className="flex flex-col gap-1">
            {booking.passengers.map((p) => (
              <div key={p.seatCode} className="flex justify-between text-xs text-[#6b7b94]">
                <span>{p.fullName}</span>
                <span className="font-num" dir="ltr">
                  {p.seatCode}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[#eef1f5] pt-3">
            <span className="text-xs text-[#6b7b94]">{t.payable}</span>
            <span className="font-num text-lg font-black text-[#1668c4]">
              {localeMoney(booking.priceIrr, locale)} {t.toman}
            </span>
          </div>
        </div>

        <button
          onClick={() => navigate(`/payment/${bookingId}`)}
          data-testid="continue-to-payment"
          className="w-full rounded-xl bg-[#1668c4] px-6 py-3 text-sm font-bold text-white"
        >
          {t.continueToPayment}
        </button>
      </div>
    </PublicPageShell>
  );
}

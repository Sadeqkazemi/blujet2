import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchBookingByPnr } from '../../api/publicSite';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { formatJalaliDateTime } from '../../lib/jalali';
import type { BookingDetail } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';
import FlightPathPlane from '../../components/public/FlightPathPlane';
import TicketBarcode from '../../components/public/TicketBarcode';

const CABIN_LABEL: Record<string, Record<StoredLocale, string>> = {
  ECONOMY: { fa: 'اکونومی', en: 'Economy', ar: 'اقتصادية' },
  BUSINESS: { fa: 'بیزینس', en: 'Business', ar: 'درجة الأعمال' },
};

const STR: Record<
  StoredLocale,
  {
    loading: string;
    notFound: string;
    title: string;
    ticketIssued: string;
    origin: string;
    dest: string;
    pnrLabel: string;
    cabinLabel: string;
    passengers: string;
    showAtCheckin: string;
    downloadPrint: string;
  }
> = {
  fa: {
    loading: 'در حال بارگذاری…',
    notFound: 'بلیط یافت نشد.',
    title: 'بلیط الکترونیکی',
    ticketIssued: 'کارت پرواز · صادر شده',
    origin: 'مبدأ',
    dest: 'مقصد',
    pnrLabel: 'کد رزرو (PNR)',
    cabinLabel: 'کلاس پروازی',
    passengers: 'مسافران',
    showAtCheckin: 'این کارت را هنگام پذیرش نشان دهید',
    downloadPrint: 'دانلود / چاپ بلیط',
  },
  en: {
    loading: 'Loading…',
    notFound: 'Ticket not found.',
    title: 'E-ticket',
    ticketIssued: 'Boarding pass · issued',
    origin: 'Origin',
    dest: 'Destination',
    pnrLabel: 'Booking code (PNR)',
    cabinLabel: 'Cabin class',
    passengers: 'Passengers',
    showAtCheckin: 'Show this card at check-in',
    downloadPrint: 'Download / print ticket',
  },
  ar: {
    loading: 'جارٍ التحميل…',
    notFound: 'لم تُعثر على التذكرة.',
    title: 'التذكرة الإلكترونية',
    ticketIssued: 'بطاقة الصعود · صادرة',
    origin: 'المبدأ',
    dest: 'الوجهة',
    pnrLabel: 'رمز الحجز (PNR)',
    cabinLabel: 'درجة السفر',
    passengers: 'المسافرون',
    showAtCheckin: 'اعرض هذه البطاقة عند تسجيل الوصول',
    downloadPrint: 'تنزيل / طباعة التذكرة',
  },
};

function formatDeparture(value: string, locale: StoredLocale) {
  if (locale === 'en') {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  }
  return formatJalaliDateTime(value);
}

export default function TicketPage() {
  const { pnr } = useParams<{ pnr: string }>();
  const { locale } = useLocale();
  const t = STR[locale];

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pnr) return;
    fetchBookingByPnr(pnr)
      .then(setBooking)
      .catch(() => setError(t.notFound));
  }, [pnr, t.notFound]);

  if (error && !booking) {
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

  const statusLabel =
    booking.status === 'TICKETED'
      ? t.ticketIssued
      : booking.status;

  return (
    <PublicPageShell>
      <div className="mx-auto max-w-[640px] p-6">
        <h1 className="mb-4 text-lg font-extrabold text-[#0d2640]">{t.title}</h1>

        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_24px_54px_-28px_rgba(13,38,102,.35)]">
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ background: 'linear-gradient(120deg,#1668c4,#0d3b66)' }}
          >
            <span className="flex items-center gap-2 text-sm font-black text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">✈</span>{' '}
              blujet
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[10.5px] font-bold text-white">
              {statusLabel}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 px-6 py-5">
            <div className="text-center">
              <div className="font-num text-2xl font-black text-[#0d2640]" dir="ltr">
                {booking.originCode}
              </div>
              <div className="mt-1 text-[10.5px] text-[#8a96a6]">{t.origin}</div>
            </div>
            <div className="flex-1 text-center text-[10.5px] text-[#8a96a6]">
              <div className="font-num mb-1 font-bold text-[#1668c4]" dir="ltr">
                {booking.flightNo}
              </div>
              <div className="relative border-t-2 border-dashed border-[#d5e1f0]">
                <span className="absolute -top-2.5 right-1/2 translate-x-1/2 bg-white px-1.5 text-sm text-[#1668c4]">
                  <FlightPathPlane rtl={locale !== 'en'} size={14} />
                </span>
              </div>
              <div className="mt-1.5">{formatDeparture(booking.departureAt, locale)}</div>
            </div>
            <div className="text-center">
              <div className="font-num text-2xl font-black text-[#0d2640]" dir="ltr">
                {booking.destCode}
              </div>
              <div className="mt-1 text-[10.5px] text-[#8a96a6]">{t.dest}</div>
            </div>
          </div>

          <div className="relative border-t-2 border-dashed border-[#e3e9f1]">
            <span className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-[#f6f8fb]" />
            <span className="absolute -top-3 -left-3 h-6 w-6 rounded-full bg-[#f6f8fb]" />
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-6 py-4">
            <div>
              <div className="text-[10px] text-[#8a96a6]">{t.pnrLabel}</div>
              <div className="font-num text-base font-black tracking-widest text-[#1668c4]" dir="ltr">
                {booking.pnr}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#8a96a6]">{t.cabinLabel}</div>
              <div className="text-xs font-extrabold text-[#0d2640]">
                {CABIN_LABEL[booking.cabin]?.[locale] ?? booking.cabin}
              </div>
            </div>
          </div>

          <div className="border-t border-[#f2f4f7] px-6 py-4">
            <div className="mb-2 text-[11px] font-black text-[#0d2640]">{t.passengers}</div>
            <div className="flex flex-col gap-2">
              {booking.passengers.map((p) => (
                <div
                  key={p.seatCode}
                  className="flex items-center justify-between rounded-xl bg-[#fafbfd] px-3.5 py-2.5 text-xs"
                >
                  <span className="font-bold text-[#16202e]">{p.fullName}</span>
                  <span
                    className="font-num rounded-lg bg-[#eef4fb] px-2.5 py-1 font-extrabold text-[#1668c4]"
                    dir="ltr"
                  >
                    {p.seatCode}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3.5 border-t border-[#f2f4f7] bg-[#fafbfd] px-6 py-3.5">
            <TicketBarcode value={booking.pnr} />
            <div className="min-w-0 text-left" dir="ltr">
              <div className="text-[10px] leading-relaxed text-[#9aa4b2]">
                {booking.pnr} · {booking.flightNo}
              </div>
              <div className="mt-1 text-[10px] text-[#8a96a6]">{t.showAtCheckin}</div>
            </div>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="mt-4 w-full rounded-xl border border-[#d5e1f0] bg-white py-2.5 text-xs font-bold text-[#1668c4]"
        >
          {t.downloadPrint}
        </button>
      </div>
    </PublicPageShell>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchMyBooking } from '../../api/publicSite';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { BookingDetail } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';
import FlowStepper from '../../components/public/FlowStepper';
import CheckoutFlightSummary from '../../components/public/checkout/CheckoutFlightSummary';
import CheckoutReviewSection from '../../components/public/checkout/CheckoutReviewSection';
import CheckoutPriceSidebar from '../../components/public/checkout/CheckoutPriceSidebar';
import CheckoutHoldBanner from '../../components/public/checkout/CheckoutHoldBanner';

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
    confirmDetails: string;
    passenger: string;
    seat: string;
    nameChangeWarning: string;
    paymentDetails: string;
    description: string;
    amountToman: string;
    ticketPrice: string;
    adult: string;
    taxesFees: string;
    total: string;
    toman: string;
    securePayment: string;
    agreeTermsPrefix: string;
    siteTerms: string;
    agreeTermsSuffix: string;
    continueToPayment: string;
    holdLabel: string;
    holdLowLabel: string;
  }
> = {
  fa: {
    loading: 'در حال بارگذاری…',
    notFound: 'رزرو یافت نشد.',
    expired: 'مهلت نگهداری این رزرو به پایان رسیده است.',
    searchAgain: 'جستجوی مجدد',
    confirmDetails: 'تأیید اطلاعات',
    passenger: 'مسافر',
    seat: 'صندلی',
    nameChangeWarning:
      'پس از صدور بلیط، تغییر نام مسافر فقط با پرداخت جریمه و تأیید ایرلاین امکان‌پذیر است.',
    paymentDetails: 'جزئیات پرداخت',
    description: 'شرح',
    amountToman: 'مبلغ (تومان)',
    ticketPrice: 'قیمت بلیط',
    adult: 'بزرگسال',
    taxesFees: 'مالیات و عوارض',
    total: 'جمع کل',
    toman: 'تومان',
    securePayment: 'پرداخت امن با رمزنگاری SSL',
    agreeTermsPrefix: 'با ادامه،',
    siteTerms: 'قوانین و مقررات',
    agreeTermsSuffix: 'سایت را می‌پذیرم.',
    continueToPayment: 'ادامه به پرداخت',
    holdLabel: 'صندلی رزرو شده ·',
    holdLowLabel: 'زمان باقی‌مانده ·',
  },
  en: {
    loading: 'Loading…',
    notFound: 'Booking not found.',
    expired: 'The hold on this booking has expired.',
    searchAgain: 'Search again',
    confirmDetails: 'Confirm details',
    passenger: 'Passenger',
    seat: 'Seat',
    nameChangeWarning:
      'After ticketing, name changes require airline approval and a penalty fee.',
    paymentDetails: 'Payment details',
    description: 'Description',
    amountToman: 'Amount (Toman)',
    ticketPrice: 'Ticket price',
    adult: 'adult',
    taxesFees: 'Taxes & fees',
    total: 'Total',
    toman: 'Toman',
    securePayment: 'Secure SSL-encrypted payment',
    agreeTermsPrefix: 'By continuing, I accept the',
    siteTerms: 'Terms & Conditions',
    agreeTermsSuffix: 'of this site.',
    continueToPayment: 'Continue to payment',
    holdLabel: 'Seat held ·',
    holdLowLabel: 'Time remaining ·',
  },
  ar: {
    loading: 'جارٍ التحميل…',
    notFound: 'لم يُعثر على الحجز.',
    expired: 'انتهت مهلة الاحتفاظ بهذا الحجز.',
    searchAgain: 'بحث مجدداً',
    confirmDetails: 'تأكيد البيانات',
    passenger: 'المسافر',
    seat: 'المقعد',
    nameChangeWarning: 'بعد إصدار التذكرة، تغيير الاسم يتطلب موافقة شركة الطيران ورسوماً.',
    paymentDetails: 'تفاصيل الدفع',
    description: 'الوصف',
    amountToman: 'المبلغ (تومان)',
    ticketPrice: 'سعر التذكرة',
    adult: 'بالغ',
    taxesFees: 'الضرائب والرسوم',
    total: 'الإجمالي',
    toman: 'تومان',
    securePayment: 'دفع آمن مشفر SSL',
    agreeTermsPrefix: 'بالمتابعة، أوافق على',
    siteTerms: 'الشروط والأحكام',
    agreeTermsSuffix: 'الموقع.',
    continueToPayment: 'المتابعة إلى الدفع',
    holdLabel: 'المقعد محجوز ·',
    holdLowLabel: 'الوقت المتبقي ·',
  },
};

export default function CheckoutPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const isMobile = useIsMobile();
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

  const sidebarLabels = {
    paymentDetails: t.paymentDetails,
    description: t.description,
    amountToman: t.amountToman,
    ticketPrice: t.ticketPrice,
    adult: t.adult,
    taxesFees: t.taxesFees,
    total: t.total,
    toman: t.toman,
    securePayment: t.securePayment,
    agreeTermsPrefix: t.agreeTermsPrefix,
    siteTerms: t.siteTerms,
    agreeTermsSuffix: t.agreeTermsSuffix,
    continueToPayment: t.continueToPayment,
  };

  return (
    <PublicPageShell>
      <FlowStepper current="checkout" onBack={() => navigate(-1)} />

      {booking.holdExpiresAt && booking.status === 'HELD' && (
        <CheckoutHoldBanner
          holdExpiresAt={booking.holdExpiresAt}
          locale={locale}
          label={t.holdLabel}
          lowTimeLabel={t.holdLowLabel}
        />
      )}

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 1180,
          margin: '0 auto',
          padding: isMobile ? '12px 16px 88px' : '16px 26px 39px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 340px',
          gap: 10,
          alignItems: 'stretch',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15, minWidth: 0 }}>
          <CheckoutFlightSummary
            booking={booking}
            locale={locale}
            cabinLabel={CABIN_LABEL[booking.cabin]?.[locale] ?? booking.cabin}
            isMobile={isMobile}
          />

          <CheckoutReviewSection
            passengers={booking.passengers}
            labels={{
              title: t.confirmDetails,
              passenger: t.passenger,
              seat: t.seat,
              nameChangeWarning: t.nameChangeWarning,
            }}
          />
        </div>

        {!isMobile && (
          <CheckoutPriceSidebar
            locale={locale}
            isMobile={false}
            priceIrr={booking.priceIrr}
            passengerCount={booking.passengers.length}
            labels={sidebarLabels}
            onContinue={() => navigate(`/payment/${bookingId}`)}
          />
        )}
      </main>

      {isMobile && (
        <CheckoutPriceSidebar
          locale={locale}
          isMobile
          priceIrr={booking.priceIrr}
          passengerCount={booking.passengers.length}
          labels={sidebarLabels}
          onContinue={() => navigate(`/payment/${bookingId}`)}
        />
      )}
    </PublicPageShell>
  );
}

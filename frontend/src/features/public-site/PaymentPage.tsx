import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchClubPoints, fetchMyBooking, fetchWallet, payBooking } from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { faDigits, localeMoney } from '../../lib/fa-format';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/jalali';
import type { BookingDetail, PayResultPriceChanged } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';
import FlowStepper from '../../components/public/FlowStepper';

type PaymentMethod = 'GATEWAY' | 'WALLET' | 'POINTS';

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
    paymentMethods: string;
    gatewayTitle: string;
    gatewaySub: string;
    walletTitle: string;
    walletBalance: (amount: string) => string;
    pointsTitle: string;
    pointsBalance: (amount: string) => string;
    promoPlaceholder: string;
    applyPromo: string;
    holdRemaining: string;
    orderSummary: string;
    ticketPrice: string;
    taxes: string;
    payable: string;
    toman: string;
    payFinal: string;
    payTerms: string;
    paying: string;
    payError: string;
    priceChanged: string;
    newPrice: (amount: string) => string;
    confirmNewPrice: string;
    clubCalc: string;
    currentPoints: string;
    earnPoints: string;
    pointsAfter: string;
    pointsUnit: string;
    passengerCount: (n: number) => string;
    passengerInfo: string;
    seatLabel: string;
  }
> = {
  fa: {
    loading: 'در حال بارگذاری…',
    notFound: 'رزرو یافت نشد.',
    expired: 'مهلت نگهداری این رزرو به پایان رسیده است.',
    searchAgain: 'جستجوی مجدد',
    paymentMethods: 'روش پرداخت',
    gatewayTitle: 'درگاه پرداخت اینترنتی (شتاب)',
    gatewaySub: 'پرداخت امن با کلیه کارت‌های بانکی عضو شتاب',
    walletTitle: 'کیف پول blujet',
    walletBalance: (amount) => `موجودی: ${amount} تومان`,
    pointsTitle: 'پرداخت با امتیاز باشگاه',
    pointsBalance: (amount) => `موجودی: ${amount} امتیاز`,
    promoPlaceholder: 'کد تخفیف دارید؟',
    applyPromo: 'اعمال',
    holdRemaining: '⏱ زمان باقی‌مانده رزرو',
    orderSummary: 'خلاصه سفارش',
    ticketPrice: 'قیمت بلیط',
    taxes: 'مالیات و عوارض',
    payable: 'مبلغ قابل پرداخت',
    toman: 'تومان',
    payFinal: 'پرداخت نهایی',
    payTerms: 'با کلیک روی پرداخت، قوانین و مقررات blujet را می‌پذیرید.',
    paying: 'در حال پرداخت…',
    payError: 'خطا در پرداخت.',
    priceChanged: 'قیمت این پرواز تغییر کرده است.',
    newPrice: (amount) => `قیمت جدید: ${amount} تومان`,
    confirmNewPrice: 'تأیید قیمت جدید و پرداخت',
    clubCalc: '🏅 محاسبه امتیاز باشگاه',
    currentPoints: 'موجودی فعلی',
    earnPoints: 'امتیاز قابل کسب از این خرید',
    pointsAfter: 'موجودی بعد از خرید',
    pointsUnit: 'امتیاز',
    passengerCount: (n) => `${faDigits(n)} مسافر`,
    passengerInfo: 'اطلاعات مسافر',
    seatLabel: 'صندلی',
  },
  en: {
    loading: 'Loading…',
    notFound: 'Booking not found.',
    expired: 'The hold on this booking has expired.',
    searchAgain: 'Search again',
    paymentMethods: 'Payment method',
    gatewayTitle: 'Online payment gateway (Shetab)',
    gatewaySub: 'Secure payment with all Shetab member bank cards',
    walletTitle: 'blujet wallet',
    walletBalance: (amount) => `Balance: ${amount} Toman`,
    pointsTitle: 'Pay with club points',
    pointsBalance: (amount) => `Balance: ${amount} points`,
    promoPlaceholder: 'Have a promo code?',
    applyPromo: 'Apply',
    holdRemaining: '⏱ Hold time remaining',
    orderSummary: 'Order summary',
    ticketPrice: 'Ticket price',
    taxes: 'Taxes & fees',
    payable: 'Amount due',
    toman: 'Toman',
    payFinal: 'Pay now',
    payTerms: 'By clicking pay, you accept blujet terms and conditions.',
    paying: 'Processing payment…',
    payError: 'Payment failed.',
    priceChanged: 'The price for this flight has changed.',
    newPrice: (amount) => `New price: ${amount} Toman`,
    confirmNewPrice: 'Confirm new price and pay',
    clubCalc: '🏅 Club points calculation',
    currentPoints: 'Current balance',
    earnPoints: 'Points earned from this purchase',
    pointsAfter: 'Balance after purchase',
    pointsUnit: 'points',
    passengerCount: (n) => `${n} passenger${n === 1 ? '' : 's'}`,
    passengerInfo: 'Passenger information',
    seatLabel: 'Seat',
  },
  ar: {
    loading: 'جارٍ التحميل…',
    notFound: 'لم يُعثر على الحجز.',
    expired: 'انتهت مهلة الاحتفاظ بهذا الحجز.',
    searchAgain: 'بحث مجدداً',
    paymentMethods: 'طريقة الدفع',
    gatewayTitle: 'بوابة الدفع الإلكتروني (شتاب)',
    gatewaySub: 'دفع آمن بجميع بطاقات البنوك الأعضاء في شتاب',
    walletTitle: 'محفظة blujet',
    walletBalance: (amount) => `الرصيد: ${amount} تومان`,
    pointsTitle: 'الدفع بنقاط النادي',
    pointsBalance: (amount) => `الرصيد: ${amount} نقطة`,
    promoPlaceholder: 'هل لديك رمز خصم؟',
    applyPromo: 'تطبيق',
    holdRemaining: '⏱ الوقت المتبقي للحجز',
    orderSummary: 'ملخص الطلب',
    ticketPrice: 'سعر التذكرة',
    taxes: 'الضرائب والرسوم',
    payable: 'المبلغ المستحق',
    toman: 'تومان',
    payFinal: 'الدفع النهائي',
    payTerms: 'بالنقر على الدفع، فإنك تقبل شروط وأحكام blujet.',
    paying: 'جارٍ الدفع…',
    payError: 'فشل الدفع.',
    priceChanged: 'تغيّر سعر هذه الرحلة.',
    newPrice: (amount) => `السعر الجديد: ${amount} تومان`,
    confirmNewPrice: 'تأكيد السعر الجديد والدفع',
    clubCalc: '🏅 حساب نقاط النادي',
    currentPoints: 'الرصيد الحالي',
    earnPoints: 'النقاط المكتسبة من هذا الشراء',
    pointsAfter: 'الرصيد بعد الشراء',
    pointsUnit: 'نقطة',
    passengerCount: (n) => `${faDigits(n)} مسافر`,
    passengerInfo: 'بيانات المسافر',
    seatLabel: 'المقعد',
  },
};

function formatBookingDate(value: string, locale: StoredLocale) {
  if (locale === 'en') {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
  }
  return formatJalaliDate(value);
}

function formatBookingDateTime(value: string, locale: StoredLocale) {
  if (locale === 'en') {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  }
  return formatJalaliDateTime(value);
}

function holdSecondsLeft(holdExpiresAt: string | null): number {
  if (!holdExpiresAt) return 0;
  return Math.max(0, Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000));
}

function formatHoldClock(seconds: number, locale: StoredLocale): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const raw = `${mm}:${ss}`;
  return locale === 'en' ? raw : faDigits(raw);
}

function CardIcon({ kind }: { kind: 'gateway' | 'wallet' | 'points' }) {
  if (kind === 'gateway') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M6 15h4" />
      </svg>
    );
  }
  if (kind === 'wallet') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 7V5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
        <path d="M16 13.5h.01" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6L12 16.8l-5.4 2.8 1-6L3.3 9.4l6-.9z" />
    </svg>
  );
}

function PaymentMethodCard({
  selected,
  disabled,
  onSelect,
  iconKind,
  title,
  subtitle,
  testId,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  iconKind: 'gateway' | 'wallet' | 'points';
  title: string;
  subtitle: string;
  testId: string;
}) {
  const iconBg = selected
    ? iconKind === 'points'
      ? 'bg-[#caa53a]'
      : 'bg-[#1668c4]'
    : 'bg-[#f3f5f8] text-[#8a96a6]';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      data-testid={testId}
      className={`flex w-full items-center gap-3 rounded-xl p-3 text-start transition-colors ${
        disabled
          ? 'cursor-not-allowed border border-[#e6eaf0] opacity-50'
          : selected
            ? 'cursor-pointer border-2 border-[#1668c4] bg-[#f3f7fc]'
            : 'cursor-pointer border border-[#e6eaf0] bg-white hover:border-[#1668c4]/40'
      }`}
    >
      <span
        className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${
          selected ? 'border-[#1668c4]' : 'border-[#ccd3dd]'
        }`}
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-[#1668c4]" />}
      </span>
      <span className={`flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[11px] text-white ${iconBg}`}>
        <CardIcon kind={iconKind} />
      </span>
      <div className="min-w-0 leading-snug">
        <div className={`text-[13px] ${selected ? 'font-bold text-[#16202e]' : 'font-semibold text-[#5a6678]'}`}>
          {title}
        </div>
        <div className="text-[10.5px] text-[#8a96a6]">{subtitle}</div>
      </div>
    </button>
  );
}

export default function PaymentPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const t = STR[locale];

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [walletBalanceIrr, setWalletBalanceIrr] = useState<string | null>(null);
  const [clubBalance, setClubBalance] = useState(0);
  const [isClubMember, setIsClubMember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceChange, setPriceChange] = useState<PayResultPriceChanged | null>(null);
  const [paying, setPaying] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('GATEWAY');
  const [holdSecs, setHoldSecs] = useState(0);

  useEffect(() => {
    if (!bookingId) return;
    fetchMyBooking(bookingId)
      .then((b) => {
        setBooking(b);
        setHoldSecs(holdSecondsLeft(b.holdExpiresAt));
      })
      .catch(() => setError(t.notFound));
    fetchWallet()
      .then((w) => setWalletBalanceIrr(w.balanceIrr))
      .catch(() => undefined);
    fetchClubPoints()
      .then((p) => {
        setIsClubMember(p.isMember);
        setClubBalance(p.balance);
      })
      .catch(() => undefined);
  }, [bookingId, t.notFound]);

  useEffect(() => {
    if (!booking?.holdExpiresAt) return;
    const id = setInterval(() => setHoldSecs(holdSecondsLeft(booking.holdExpiresAt)), 1000);
    return () => clearInterval(id);
  }, [booking?.holdExpiresAt]);

  const earnPoints = useMemo(() => {
    if (!booking) return 0;
    return Math.floor(Number(booking.priceIrr) / 10 / 20_000);
  }, [booking]);

  async function onPay(confirmedPriceIrr?: string | number) {
    if (!bookingId) return;
    if (booking.status === 'HELD' && holdSecs <= 0 && booking.holdExpiresAt) return;
    setError(null);
    setPaying(true);
    try {
      const result = await payBooking(bookingId, {
        confirmedPriceIrr,
        promoCode: promoCode.trim() || undefined,
        paymentMethod,
      });
      if (result.priceChanged) {
        setPriceChange(result);
        return;
      }
      navigate(`/ticket/${result.booking.pnr}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.payError);
    } finally {
      setPaying(false);
    }
  }

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

  if (booking.status === 'EXPIRED' || (booking.status === 'HELD' && holdSecs <= 0 && booking.holdExpiresAt)) {
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

  const holdExpired =
    booking.status === 'HELD' && holdSecs <= 0 && Boolean(booking.holdExpiresAt);

  const holdUrgent = holdSecs <= 120;
  const holdBg = holdUrgent ? 'bg-[#fdecec]' : 'bg-[#e8f5ee]';
  const holdColor = holdUrgent ? 'text-[#e5484d]' : 'text-[#1f8a5b]';
  const taxesIrr = Math.round(Number(booking.priceIrr) * 0.084);
  const ticketIrr = Number(booking.priceIrr) - taxesIrr;
  const priceDisplay = localeMoney(booking.priceIrr, locale);
  const walletDisplay =
    walletBalanceIrr !== null ? localeMoney(walletBalanceIrr, locale) : '—';
  const clubDisplay = locale === 'en' ? String(clubBalance) : faDigits(clubBalance);
  const earnDisplay = locale === 'en' ? String(earnPoints) : faDigits(earnPoints);
  const afterDisplay =
    locale === 'en' ? String(clubBalance + earnPoints) : faDigits(clubBalance + earnPoints);

  const orderAside = (
    <aside className="rounded-[14px] border border-[#eef1f5] bg-white p-[15px] lg:sticky lg:top-[130px] lg:w-[380px] lg:flex-none">
      <div className={`mb-3.5 flex items-center justify-between rounded-[11px] px-3 py-2.5 ${holdBg}`}>
        <span className={`text-[11.5px] font-bold ${holdColor}`}>{t.holdRemaining}</span>
        <span className={`font-num text-sm font-black ${holdColor}`} dir="ltr" data-testid="hold-timer">
          {formatHoldClock(holdSecs, locale)}
        </span>
      </div>

      <h4 className="mb-4 text-[14.5px] font-extrabold text-[#0d2640]">{t.orderSummary}</h4>

      <div className="mb-4 rounded-xl bg-[#f6f8fb] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12.5px] font-bold text-[#0d2640]">
            {booking.originCode} ← {booking.destCode}
          </span>
          <span className="text-[11px] text-[#9aa4b2]">{formatBookingDate(booking.departureAt, locale)}</span>
        </div>
        <div className="text-[11px] leading-relaxed text-[#9aa4b2]">
          {booking.flightNo} · {formatBookingDateTime(booking.departureAt, locale)}
          <br />
          {CABIN_LABEL[booking.cabin]?.[locale] ?? booking.cabin} · {t.passengerCount(booking.passengers.length)}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 text-[11.5px]">
        <div className="flex justify-between">
          <span className="text-[#9aa4b2]">{t.ticketPrice}</span>
          <span className="font-semibold">{localeMoney(ticketIrr, locale)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#9aa4b2]">{t.taxes}</span>
          <span className="font-semibold">{localeMoney(taxesIrr, locale)}</span>
        </div>
      </div>

      {isClubMember && (
        <div className="mb-4 rounded-[11px] border border-[#f3e3b8] bg-[#fffaf0] p-3">
          <div className="mb-2 text-[11.5px] font-extrabold text-[#8a6d1f]">{t.clubCalc}</div>
          <div className="mb-1 flex justify-between text-[11px] text-[#7d8ba0]">
            <span>{t.currentPoints}</span>
            <span className="font-bold text-[#16202e]">
              {clubDisplay} {t.pointsUnit}
            </span>
          </div>
          <div className="mb-1 flex justify-between text-[11px] text-[#7d8ba0]">
            <span>{t.earnPoints}</span>
            <span className="font-bold text-[#1f8a5b]">+ {earnDisplay} {t.pointsUnit}</span>
          </div>
          <div className="flex justify-between border-t border-dashed border-[#ecdba0] pt-2 text-[11.5px]">
            <span className="font-bold text-[#0d2640]">{t.pointsAfter}</span>
            <span className="font-extrabold text-[#8a6d1f]">
              {afterDisplay} {t.pointsUnit}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-[#eef1f5] pt-3">
        <span className="font-bold text-[#0d2640]">{t.payable}</span>
        <span className="font-num text-[17px] font-black text-[#1668c4]">
          {priceDisplay}{' '}
          <span className="text-[10px] font-normal text-[#9aa4b2]">{t.toman}</span>
        </span>
      </div>

      {priceChange ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="mb-2 text-xs text-amber-800">{t.priceChanged}</p>
          <p className="font-num mb-3 text-sm font-extrabold text-amber-900">
            {t.newPrice(localeMoney(priceChange.currentPriceIrr, locale))}
          </p>
          <button
            disabled={paying || holdExpired}
            onClick={() => onPay(priceChange.currentPriceIrr)}
            data-testid="confirm-new-price"
            className="w-full rounded-xl bg-[#1668c4] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {t.confirmNewPrice}
          </button>
        </div>
      ) : (
        <>
          <button
            disabled={paying || holdExpired}
            onClick={() => onPay()}
            data-testid="pay-submit"
            className="mt-[18px] flex h-[52px] w-full items-center justify-center rounded-xl bg-[#1668c4] text-[14.5px] font-extrabold text-white disabled:opacity-60"
          >
            {paying ? t.paying : t.payFinal}
          </button>
          <p className="mt-3 text-center text-[10.5px] leading-relaxed text-[#9aa4b2]">{t.payTerms}</p>
        </>
      )}
    </aside>
  );

  return (
    <PublicPageShell>
      <FlowStepper current="payment" onBack={() => navigate(-1)} />
      <div className="mx-auto max-w-[1320px] px-[22px] pb-11 pt-5 lg:pb-[44px]">
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <main className="flex min-w-0 flex-1 flex-col gap-4">
            <section
              className="rounded-[14px] border border-[#eef1f5] bg-white p-4"
              data-testid="payment-passengers"
            >
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#eef4fb] text-[#1668c4]">
                  👤
                </span>
                <h3 className="m-0 text-[15.5px] font-extrabold text-[#0d2640]">{t.passengerInfo}</h3>
              </div>
              <div className="flex flex-col gap-2">
                {booking.passengers.map((p, i) => (
                  <div
                    key={`${p.fullName}-${p.seatCode}-${i}`}
                    className="flex items-center justify-between rounded-[13px] border border-[#eef1f5] px-3.5 py-3"
                  >
                    <div>
                      <div className="text-[12.5px] font-extrabold text-[#0d2640]">{p.fullName}</div>
                      <div className="mt-0.5 text-[10.5px] text-[#8a96a6]">
                        {t.seatLabel}:{' '}
                        <span className="font-bold text-[#1668c4]" dir="ltr">
                          {p.seatCode ?? '—'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-[#8a96a6]">
                      {locale === 'en' ? `${i + 1}. Adult` : `${faDigits(i + 1)}. بزرگسال`}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[14px] border border-[#eef1f5] bg-white p-4">
              <h3 className="mb-[18px] text-[15.5px] font-extrabold text-[#0d2640]">{t.paymentMethods}</h3>
              <div className="flex flex-col gap-2.5">
                <PaymentMethodCard
                  selected={paymentMethod === 'GATEWAY'}
                  onSelect={() => setPaymentMethod('GATEWAY')}
                  iconKind="gateway"
                  title={t.gatewayTitle}
                  subtitle={t.gatewaySub}
                  testId="payment-method-GATEWAY"
                />
                <PaymentMethodCard
                  selected={paymentMethod === 'WALLET'}
                  onSelect={() => setPaymentMethod('WALLET')}
                  iconKind="wallet"
                  title={t.walletTitle}
                  subtitle={t.walletBalance(walletDisplay)}
                  testId="payment-method-WALLET"
                />
                <PaymentMethodCard
                  selected={paymentMethod === 'POINTS'}
                  disabled={!isClubMember}
                  onSelect={() => setPaymentMethod('POINTS')}
                  iconKind="points"
                  title={t.pointsTitle}
                  subtitle={t.pointsBalance(clubDisplay)}
                  testId="payment-method-POINTS"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  id="promo-code"
                  data-testid="promo-code-input"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder={t.promoPlaceholder}
                  className="h-12 flex-1 rounded-[10px] border border-[#e2e7ee] bg-[#fafbfd] px-3 text-[12.5px] outline-none focus:border-[#1668c4]"
                />
                <button
                  type="button"
                  className="flex h-12 items-center rounded-[10px] border border-[#1668c4] px-5 text-[12.5px] font-semibold text-[#1668c4]"
                  onClick={() => undefined}
                >
                  {t.applyPromo}
                </button>
              </div>
            </section>
          </main>

          <div className="w-full lg:w-[380px] lg:flex-none">{orderAside}</div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-[80] flex items-center justify-between gap-3 border-t border-[#e6eaf0] bg-white px-4 py-2.5 shadow-[0_-8px_24px_-14px_rgba(13,38,102,.3)] lg:hidden">
        <div className="min-w-0">
          <div className="text-[10.5px] text-[#9aa4b2]">{t.payable}</div>
          <div className="font-num whitespace-nowrap text-[15px] font-black text-[#1668c4]">
            {priceDisplay} {t.toman}
          </div>
        </div>
        {!priceChange && (
          <button
            disabled={paying || holdExpired}
            onClick={() => onPay()}
            data-testid="pay-submit-mobile"
            className="flex h-12 max-w-[200px] flex-1 items-center justify-center rounded-xl bg-[#1668c4] text-[12.5px] font-extrabold text-white disabled:opacity-60"
          >
            {paying ? t.paying : t.payFinal}
          </button>
        )}
      </div>
    </PublicPageShell>
  );
}

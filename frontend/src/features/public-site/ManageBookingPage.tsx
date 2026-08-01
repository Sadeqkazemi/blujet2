import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PublicPageShell from '../../components/public/PublicPageShell';
import ManageBookingActionGrid from '../../components/public/manage-booking/ManageBookingActionGrid';
import ManageBookingDiscoverSection, {
  type DiscoverDestination,
} from '../../components/public/manage-booking/ManageBookingDiscoverSection';
import ManageBookingLookupForm from '../../components/public/manage-booking/ManageBookingLookupForm';
import ManageBookingNotFound from '../../components/public/manage-booking/ManageBookingNotFound';
import ManageBookingPassengersCard from '../../components/public/manage-booking/ManageBookingPassengersCard';
import ManageBookingTicketCard from '../../components/public/manage-booking/ManageBookingTicketCard';
import { CITY_NAMES } from '../../components/public/manage-booking/manage-booking-utils';
import {
  changeSeatByPnr,
  fetchSeatMap,
  lookupBookingByPnrAndLastName,
  submitAnonymousRefund,
} from '../../api/publicSite';
import { fetchPublicHomeContent } from '../../api/site-content';
import { ApiRequestError } from '../../api/envelope';
import { useIsMobile } from '../../hooks/useIsMobile';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { destinationGradient } from './site-content-shared';
import type { BookingDetail, SeatMapCell } from '../../types/public-site';

interface Tr {
  fa: string;
  en: string;
  ar: string;
}

const CABIN_LABEL: Record<string, Tr> = {
  ECONOMY: { fa: 'اکونومی', en: 'Economy', ar: 'اقتصادية' },
  BUSINESS: { fa: 'بیزینس', en: 'Business', ar: 'درجة الأعمال' },
};

const DEST_META: Record<string, { hours: number; tag?: Tr; intl?: boolean }> = {
  KIH: { hours: 1.75, tag: { fa: 'پرفروش', en: 'Bestseller', ar: 'الأكثر مبيعًا' } },
  MHD: { hours: 1.42 },
  DXB: { hours: 2.17, intl: true },
  IST: { hours: 3.25, tag: { fa: 'پرواز مستقیم', en: 'Direct flight', ar: 'رحلة مباشرة' }, intl: true },
};

const FALLBACK_DESTS = ['KIH', 'MHD', 'DXB', 'IST'] as const;

const STR: Record<
  StoredLocale,
  {
    title: string;
    subtitle: string;
    pnrLabel: string;
    pnrPlaceholder: string;
    lastNameLabel: string;
    lastNamePlaceholder: string;
    lookupBtn: string;
    lookingUpBtn: string;
    emailSmsNote: string;
    lookupValidationError: string;
    lookupErrorFallback: string;
    notFoundTitle: string;
    notFoundSub: string;
    searchAgainBtn: string;
    confirmedLabel: string;
    dateLabel: string;
    terminalLabel: string;
    gateLabel: string;
    cabinFieldLabel: string;
    airlineName: string;
    terminalTba: string;
    gateTba: string;
    passengersHeading: string;
    seatLabel: string;
    issuedLabel: string;
    seatConfirmed: string;
    changeSeatBtn: string;
    openRefundBtn: string;
    downloadTicketBtn: string;
    seatModalTitle: string;
    seatModalSub: string;
    seatChangedMsg: string;
    seatLegendFree: string;
    seatLegendTaken: string;
    seatLegendCurrent: string;
    seatChangeErrorFallback: string;
    seatMapLoading: string;
    refundDoneHeading: string;
    refundDoneSub: string;
    penaltyLabel: string;
    refundableLabel: string;
    toman: string;
    searchAnotherLink: string;
    refundModalTitle: string;
    refundModalSub: string;
    ibanLabel: string;
    confirmRefundBtn: string;
    cancelBtn: string;
    refundSubmitErrorFallback: string;
    popularDestTitle: string;
    popularDestSub: string;
    viewAllDest: string;
    startsFrom: string;
    destDomestic: string;
    destIntl: string;
    flightsPerWeek: string;
    bannerBadge: string;
    bannerTitle: string;
    bannerSub: string;
    bannerBtn: string;
  }
> = {
  fa: {
    title: 'مدیریت رزرو',
    subtitle: 'رزرو خود را با کد رزرو مشاهده، تغییر صندلی، دانلود بلیط یا استرداد کنید.',
    pnrLabel: 'کد رزرو',
    pnrPlaceholder: 'مثلاً BJ4X2K',
    lastNameLabel: 'نام خانوادگی مسافر',
    lastNamePlaceholder: 'مثلاً رضایی',
    lookupBtn: 'مشاهده رزرو',
    lookingUpBtn: 'در حال جستجو…',
    emailSmsNote: 'کد رزرو در ایمیل/پیامک تأیید خرید برای شما ارسال شده است.',
    lookupValidationError: 'کد رزرو و نام خانوادگی مسافر را وارد کنید.',
    lookupErrorFallback: 'رزرو یافت نشد.',
    notFoundTitle: 'رزروی یافت نشد',
    notFoundSub: 'کد رزرو و نام خانوادگی وارد‌شده با هیچ رزروی مطابقت ندارد.',
    searchAgainBtn: 'جستجوی دوباره',
    confirmedLabel: 'تأییدشده',
    dateLabel: 'تاریخ',
    terminalLabel: 'ترمینال',
    gateLabel: 'گیت',
    cabinFieldLabel: 'کلاس',
    airlineName: 'blujet',
    terminalTba: 'اعلام می‌شود',
    gateTba: 'اعلام می‌شود',
    passengersHeading: 'مسافران',
    seatLabel: 'صندلی',
    issuedLabel: 'صادرشده',
    seatConfirmed: 'تأییدشده',
    changeSeatBtn: 'تغییر صندلی',
    openRefundBtn: 'استرداد بلیط',
    downloadTicketBtn: 'دانلود بلیط',
    seatModalTitle: 'تغییر صندلی',
    seatModalSub: 'یک صندلی آزاد در همان کلاس بلیط انتخاب کنید — صندلی مسافرِ تطبیق‌داده‌شده با نام خانوادگی تغییر می‌کند.',
    seatChangedMsg: 'صندلی با موفقیت تغییر کرد ✓',
    seatLegendFree: 'آزاد',
    seatLegendTaken: 'پر',
    seatLegendCurrent: 'صندلی فعلی',
    seatChangeErrorFallback: 'خطا در تغییر صندلی.',
    seatMapLoading: 'در حال دریافت نقشه صندلی…',
    refundDoneHeading: 'درخواست استرداد ثبت شد',
    refundDoneSub: 'مبلغ قابل استرداد پس از کسر جریمه، طی ۳ تا ۷ روز کاری به کارت پرداخت‌کننده بازگردانده می‌شود.',
    penaltyLabel: 'جریمه',
    refundableLabel: 'بازگشتی',
    toman: 'تومان',
    searchAnotherLink: '‹ جستجوی رزرو دیگر',
    refundModalTitle: 'استرداد بلیط',
    refundModalSub: 'شماره شبا حساب خود را وارد کنید. جریمه بر اساس قوانین نرخی بلیط و فاصله تا زمان پرواز محاسبه و نمایش داده می‌شود.',
    ibanLabel: 'شماره شبا',
    confirmRefundBtn: 'تأیید و ثبت استرداد',
    cancelBtn: 'انصراف',
    refundSubmitErrorFallback: 'خطا در ثبت درخواست استرداد.',
    popularDestTitle: 'مقاصد محبوب',
    popularDestSub: 'پرطرفدارترین مسیرهای این فصل با بهترین قیمت',
    viewAllDest: 'مشاهده همه مقاصد ‹',
    startsFrom: 'شروع از',
    destDomestic: 'داخلی',
    destIntl: 'بین‌المللی',
    flightsPerWeek: 'پرواز در هفته',
    bannerBadge: 'باشگاه مشتریان blujet',
    bannerTitle: 'با هر پرواز، امتیاز بگیرید',
    bannerSub: 'عضویت رایگان در باشگاه مشتریان blujet — امتیازها را به بلیط و ارتقای کلاس پروازی تبدیل کنید.',
    bannerBtn: 'عضویت در باشگاه',
  },
  en: {
    title: 'Manage Your Booking',
    subtitle: 'Look up your booking by reservation code, change seats, download your ticket, or request a refund.',
    pnrLabel: 'Booking code',
    pnrPlaceholder: 'e.g. BJ4X2K',
    lastNameLabel: 'Passenger last name',
    lastNamePlaceholder: 'e.g. Rezaei',
    lookupBtn: 'View Booking',
    lookingUpBtn: 'Searching…',
    emailSmsNote: 'The booking code was sent to you by email/SMS at purchase confirmation.',
    lookupValidationError: "Enter the booking code and passenger's last name.",
    lookupErrorFallback: 'Booking not found.',
    notFoundTitle: 'Booking not found',
    notFoundSub: "The booking code and last name entered don't match any booking.",
    searchAgainBtn: 'Search again',
    confirmedLabel: 'Confirmed',
    dateLabel: 'Date',
    terminalLabel: 'Terminal',
    gateLabel: 'Gate',
    cabinFieldLabel: 'Cabin',
    airlineName: 'blujet',
    terminalTba: 'TBA',
    gateTba: 'TBA',
    passengersHeading: 'Passengers',
    seatLabel: 'Seat',
    issuedLabel: 'Issued',
    seatConfirmed: 'confirmed',
    changeSeatBtn: 'Change Seat',
    openRefundBtn: 'Refund Ticket',
    downloadTicketBtn: 'Download Ticket',
    seatModalTitle: 'Change Seat',
    seatModalSub: 'Pick a free seat in the same cabin — the seat of the passenger matching the last name will change.',
    seatChangedMsg: 'Seat changed successfully ✓',
    seatLegendFree: 'Free',
    seatLegendTaken: 'Taken',
    seatLegendCurrent: 'Current seat',
    seatChangeErrorFallback: 'Error changing the seat.',
    seatMapLoading: 'Loading seat map…',
    refundDoneHeading: 'Refund request submitted',
    refundDoneSub: 'The refundable amount after penalty will be returned to your card within 3–7 business days.',
    penaltyLabel: 'Penalty',
    refundableLabel: 'Refundable',
    toman: 'Toman',
    searchAnotherLink: '‹ Search another booking',
    refundModalTitle: 'Refund Ticket',
    refundModalSub: 'Enter your IBAN. The penalty is calculated and shown based on the fare rules and time to departure.',
    ibanLabel: 'IBAN',
    confirmRefundBtn: 'Confirm & Submit Refund',
    cancelBtn: 'Cancel',
    refundSubmitErrorFallback: 'Error submitting the refund request.',
    popularDestTitle: 'Popular Destinations',
    popularDestSub: 'The most in-demand routes this season, at the best prices.',
    viewAllDest: 'View all destinations ‹',
    startsFrom: 'From',
    destDomestic: 'Domestic',
    destIntl: 'International',
    flightsPerWeek: 'flights/week',
    bannerBadge: 'blujet Loyalty Club',
    bannerTitle: 'Earn points with every flight',
    bannerSub: 'Free membership in the blujet loyalty club — turn points into tickets and cabin upgrades.',
    bannerBtn: 'Join the club',
  },
  ar: {
    title: 'إدارة الحجز',
    subtitle: 'اعرض حجزك برمز الحجز، غيّر المقعد، نزّل التذكرة أو اطلب استرداد المبلغ.',
    pnrLabel: 'رمز الحجز',
    pnrPlaceholder: 'مثلاً BJ4X2K',
    lastNameLabel: 'اسم عائلة المسافر',
    lastNamePlaceholder: 'مثلاً رضايي',
    lookupBtn: 'عرض الحجز',
    lookingUpBtn: 'جارٍ البحث…',
    emailSmsNote: 'تم إرسال رمز الحجز إليك عبر البريد الإلكتروني/الرسائل عند تأكيد الشراء.',
    lookupValidationError: 'أدخل رمز الحجز واسم عائلة المسافر.',
    lookupErrorFallback: 'لم يتم العثور على الحجز.',
    notFoundTitle: 'لم يتم العثور على الحجز',
    notFoundSub: 'رمز الحجز واسم العائلة المدخلان لا يطابقان أي حجز.',
    searchAgainBtn: 'البحث مرة أخرى',
    confirmedLabel: 'مؤكد',
    dateLabel: 'التاريخ',
    terminalLabel: 'الصالة',
    gateLabel: 'البوابة',
    cabinFieldLabel: 'الدرجة',
    airlineName: 'blujet',
    terminalTba: 'يُعلَن لاحقًا',
    gateTba: 'يُعلَن لاحقًا',
    passengersHeading: 'المسافرون',
    seatLabel: 'المقعد',
    issuedLabel: 'صادر',
    seatConfirmed: 'مؤكد',
    changeSeatBtn: 'تغيير المقعد',
    openRefundBtn: 'استرداد التذكرة',
    downloadTicketBtn: 'تنزيل التذكرة',
    seatModalTitle: 'تغيير المقعد',
    seatModalSub: 'اختر مقعدًا شاغرًا في نفس الدرجة — سيتغير مقعد المسافر المطابق لاسم العائلة.',
    seatChangedMsg: 'تم تغيير المقعد بنجاح ✓',
    seatLegendFree: 'شاغر',
    seatLegendTaken: 'محجوز',
    seatLegendCurrent: 'المقعد الحالي',
    seatChangeErrorFallback: 'خطأ في تغيير المقعد.',
    seatMapLoading: 'جارٍ تحميل خريطة المقاعد…',
    refundDoneHeading: 'تم تسجيل طلب الاسترداد',
    refundDoneSub: 'سيتم إرجاع المبلغ القابل للاسترداد بعد خصم الغرامة إلى بطاقة الدفع خلال ٣ إلى ٧ أيام عمل.',
    penaltyLabel: 'الغرامة',
    refundableLabel: 'المبلغ المسترد',
    toman: 'تومان',
    searchAnotherLink: '‹ البحث عن حجز آخر',
    refundModalTitle: 'استرداد التذكرة',
    refundModalSub: 'أدخل رقم الآيبان الخاص بحسابك. تُحسب الغرامة وتُعرض بناءً على قواعد التسعيرة والوقت المتبقي حتى موعد الرحلة.',
    ibanLabel: 'رقم الآيبان',
    confirmRefundBtn: 'تأكيد وتسجيل الاسترداد',
    cancelBtn: 'إلغاء',
    refundSubmitErrorFallback: 'خطأ في تسجيل طلب الاسترداد.',
    popularDestTitle: 'الوجهات الشائعة',
    popularDestSub: 'أكثر المسارات طلبًا هذا الموسم بأفضل الأسعار',
    viewAllDest: 'عرض كل الوجهات ‹',
    startsFrom: 'يبدأ من',
    destDomestic: 'داخلي',
    destIntl: 'دولي',
    flightsPerWeek: 'رحلة/أسبوع',
    bannerBadge: 'نادي ولاء blujet',
    bannerTitle: 'اكسب نقاطًا مع كل رحلة',
    bannerSub: 'عضوية مجانية في نادي العملاء — حوّل النقاط إلى تذاكر وترقيات.',
    bannerBtn: 'انضم إلى النادي',
  },
};

function formatDestMeta(code: string, locale: StoredLocale): string {
  const meta = DEST_META[code] ?? { hours: 2 };
  const h = Math.floor(meta.hours);
  const m = Math.round((meta.hours - h) * 60);
  const duration =
    locale === 'en'
      ? m
        ? `${h}h ${m}m`
        : `${h}h`
      : m
        ? `${h} ساعت ${m} دقیقه`
        : `${h} ساعت`;
  const flights = locale === 'en' ? '28' : locale === 'ar' ? '٢٨' : '۲۸';
  return `${duration} · ${flights} ${STR[locale].flightsPerWeek}`;
}

export default function ManageBookingPage() {
  const { locale } = useLocale();
  const isMobile = useIsMobile();
  const location = useLocation();
  const t = STR[locale];
  const [pnr, setPnr] = useState('');
  const [lastName, setLastName] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [homeDests, setHomeDests] = useState<DiscoverDestination[]>([]);

  const [refundOpen, setRefundOpen] = useState(false);
  const [iban, setIban] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundResult, setRefundResult] = useState<{
    penaltyPct: number;
    refundableIrr: string;
    penaltyAmountIrr: string;
  } | null>(null);

  const [seatOpen, setSeatOpen] = useState(false);
  const [seatMap, setSeatMap] = useState<SeatMapCell[] | null>(null);
  const [seatError, setSeatError] = useState<string | null>(null);
  const [seatBusy, setSeatBusy] = useState(false);
  const [seatChanged, setSeatChanged] = useState(false);

  useEffect(() => {
    const st = location.state as { pnr?: string; lastName?: string } | null;
    if (st?.pnr) setPnr(st.pnr);
    if (st?.lastName) setLastName(st.lastName);
  }, [location.state]);

  useEffect(() => {
    fetchPublicHomeContent()
      .then((content) => {
        const fromApi =
          content.destinations?.slice(0, 4).map((d, i) => {
            const code = d.airportCode;
            const meta = DEST_META[code];
            return {
              code,
              city: CITY_NAMES[code]?.[locale] ?? d.cityFa,
              category: meta?.intl ? t.destIntl : t.destDomestic,
              meta: formatDestMeta(code, locale),
              tomanPrice: Math.round(Number(d.priceIrr) / 10),
              grad: destinationGradient(i),
              imageUrl: d.imageUrl,
              tag: meta?.tag?.[locale] ?? null,
            } satisfies DiscoverDestination;
          }) ?? [];
        if (fromApi.length >= 4) {
          setHomeDests(fromApi);
          return;
        }
        setHomeDests(
          FALLBACK_DESTS.map((code, i) => {
            const meta = DEST_META[code];
            const prices: Record<string, number> = { KIH: 1_480_000, MHD: 980_000, DXB: 5_200_000, IST: 6_800_000 };
            return {
              code,
              city: (CITY_NAMES[code]?.[locale] ?? code).split(' — ')[0],
              category: meta?.intl ? t.destIntl : t.destDomestic,
              meta: formatDestMeta(code, locale),
              tomanPrice: prices[code] ?? 1_000_000,
              grad: destinationGradient(i),
              tag: meta?.tag?.[locale] ?? null,
            };
          }),
        );
      })
      .catch(() => {
        setHomeDests(
          FALLBACK_DESTS.map((code, i) => {
            const meta = DEST_META[code];
            const prices: Record<string, number> = { KIH: 1_480_000, MHD: 980_000, DXB: 5_200_000, IST: 6_800_000 };
            return {
              code,
              city: (CITY_NAMES[code]?.[locale] ?? code).split(' — ')[0],
              category: meta?.intl ? t.destIntl : t.destDomestic,
              meta: formatDestMeta(code, locale),
              tomanPrice: prices[code] ?? 1_000_000,
              grad: destinationGradient(i),
              tag: meta?.tag?.[locale] ?? null,
            };
          }),
        );
      });
  }, [locale, t.destDomestic, t.destIntl]);

  const cabinLabel = booking ? (CABIN_LABEL[booking.cabin]?.[locale] ?? booking.cabin) : '';

  const discoverDestinations = useMemo(() => homeDests, [homeDests]);

  function resetLookup() {
    setBooking(null);
    setNotFound(false);
    setLookupError(null);
    setPnr('');
    setLastName('');
    setRefundResult(null);
    setRefundOpen(false);
    setSeatChanged(false);
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
    setNotFound(false);
    if (pnr.trim().length < 4 || !lastName.trim()) {
      setLookupError(t.lookupValidationError);
      return;
    }
    setLoading(true);
    try {
      const data = await lookupBookingByPnrAndLastName(pnr.trim(), lastName.trim());
      setBooking(data);
      setRefundResult(null);
      setRefundOpen(false);
      setSeatChanged(false);
    } catch (err) {
      setBooking(null);
      if (err instanceof ApiRequestError && err.code === 'NOT_FOUND') {
        setNotFound(true);
        setLookupError(null);
      } else {
        setLookupError(err instanceof ApiRequestError ? err.message : t.lookupErrorFallback);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!booking) return;
    setRefundError(null);
    try {
      const r = await submitAnonymousRefund(booking.pnr, lastName.trim(), iban);
      setRefundResult({
        penaltyPct: r.penaltyPct,
        penaltyAmountIrr: r.penaltyAmountIrr,
        refundableIrr: r.refundableIrr,
      });
      setRefundOpen(false);
    } catch (err) {
      setRefundError(err instanceof ApiRequestError ? err.message : t.refundSubmitErrorFallback);
    }
  }

  function openSeatModal() {
    if (!booking) return;
    setSeatOpen(true);
    setSeatError(null);
    setSeatMap(null);
    fetchSeatMap(booking.flightInstanceId)
      .then((res) => setSeatMap(res.seats))
      .catch(() => setSeatError(t.seatChangeErrorFallback));
  }

  async function onPickSeat(seatCode: string) {
    if (!booking || seatBusy) return;
    setSeatBusy(true);
    setSeatError(null);
    try {
      const updated = await changeSeatByPnr(booking.pnr, lastName.trim(), seatCode);
      setBooking(updated);
      setSeatOpen(false);
      setSeatChanged(true);
    } catch (err) {
      setSeatError(err instanceof ApiRequestError ? err.message : t.seatChangeErrorFallback);
    } finally {
      setSeatBusy(false);
    }
  }

  function downloadTicket() {
    if (!booking) return;
    const w = window.open('', '_blank', 'width=840,height=640');
    if (!w) return;
    const dir = locale === 'en' ? 'ltr' : 'rtl';
    const paxRows = booking.passengers
      .map(
        (p) =>
          `<tr><td style="padding:7px 10px;border-bottom:1px solid #eef1f5;font-weight:700;">${p.fullName}</td><td dir="ltr" style="padding:7px 10px;border-bottom:1px solid #eef1f5;text-align:center;">${p.seatCode ?? '—'}</td></tr>`,
      )
      .join('');
    w.document.write(`<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>blujet — ${booking.pnr}</title></head>
<body style="font-family:Vazirmatn,Tahoma,sans-serif;background:#f6f8fb;margin:0;padding:24px;color:#16202e;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e6eaf0;border-radius:18px;overflow:hidden;">
    <div style="background:linear-gradient(120deg,#1668c4,#0d3b66);color:#fff;padding:16px 22px;display:flex;justify-content:space-between;align-items:center;">
      <b style="font-size:16px;">✈ blujet</b>
      <span>${t.pnrLabel}: <b dir="ltr" style="letter-spacing:1px;">${booking.pnr}</b></span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:22px;gap:14px;">
      <div style="text-align:center;"><div style="font-size:24px;font-weight:900;" dir="ltr">${booking.originCode}</div><div style="color:#1668c4;font-weight:800;margin-top:4px;">${formatJalaliDateTime(booking.departureAt)}</div></div>
      <div style="flex:1;text-align:center;color:#8a96a6;font-size:12px;border-top:2px dashed #d5e1f0;padding-top:8px;" dir="ltr">${booking.flightNo}</div>
      <div style="text-align:center;"><div style="font-size:24px;font-weight:900;" dir="ltr">${booking.destCode}</div><div style="color:#1668c4;font-weight:800;margin-top:4px;">${formatJalaliDateTime(booking.arrivalAt)}</div></div>
    </div>
    <div style="display:flex;border-top:1px solid #f2f4f7;">
      <div style="flex:1;padding:11px 14px;text-align:center;border-inline-end:1px solid #f2f4f7;"><div style="font-size:11px;color:#8a96a6;">${t.cabinFieldLabel}</div><b>${cabinLabel}</b></div>
      <div style="flex:1;padding:11px 14px;text-align:center;"><div style="font-size:11px;color:#8a96a6;">${t.pnrLabel}</div><b dir="ltr">${booking.pnr}</b></div>
    </div>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #f2f4f7;font-size:13px;">
      <thead><tr><th style="text-align:start;padding:9px 10px;color:#8a96a6;font-size:11px;">${t.passengersHeading}</th><th style="padding:9px 10px;color:#8a96a6;font-size:11px;">${t.seatLabel}</th></tr></thead>
      <tbody>${paxRows}</tbody>
    </table>
  </div>
  <script>window.onload = function(){ window.print(); };</script>
</body></html>`);
    w.document.close();
  }

  const showLookup = !booking && !notFound;

  return (
    <PublicPageShell>
      <section
        style={{
          background: 'linear-gradient(135deg,#0d2640,#16406e)',
          color: '#fff',
          padding: isMobile ? '34px 22px 40px' : '34px 22px 40px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: isMobile ? 27 : 30, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-.5px' }}>{t.title}</h1>
        <p style={{ fontSize: 13, color: '#aac4e2', margin: 0 }}>{t.subtitle}</p>
      </section>

      <section style={{ maxWidth: 1180, margin: '32px auto 56px', padding: '0 26px', position: 'relative' }}>
        {showLookup && (
          <>
            <ManageBookingLookupForm
              pnr={pnr}
              lastName={lastName}
              loading={loading}
              error={lookupError}
              labels={{
                pnrLabel: t.pnrLabel,
                pnrPlaceholder: t.pnrPlaceholder,
                lastNameLabel: t.lastNameLabel,
                lastNamePlaceholder: t.lastNamePlaceholder,
                lookupBtn: t.lookupBtn,
                lookingUpBtn: t.lookingUpBtn,
                emailSmsNote: t.emailSmsNote,
              }}
              onPnrChange={setPnr}
              onLastNameChange={setLastName}
              onSubmit={lookup}
            />
            {discoverDestinations.length > 0 && (
              <ManageBookingDiscoverSection
                locale={locale}
                isMobile={isMobile}
                destinations={discoverDestinations}
                labels={{
                  title: t.popularDestTitle,
                  subtitle: t.popularDestSub,
                  viewAll: t.viewAllDest,
                  startsFrom: t.startsFrom,
                  toman: t.toman,
                  bannerBadge: t.bannerBadge,
                  bannerTitle: t.bannerTitle,
                  bannerSub: t.bannerSub,
                  bannerBtn: t.bannerBtn,
                }}
              />
            )}
          </>
        )}

        {notFound && (
          <ManageBookingNotFound
            title={t.notFoundTitle}
            subtitle={t.notFoundSub}
            btnLabel={t.searchAgainBtn}
            onReset={resetLookup}
          />
        )}

        {booking && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15, maxWidth: 880, margin: '0 auto' }}>
            <ManageBookingTicketCard
              booking={booking}
              locale={locale}
              isMobile={isMobile}
              cabinLabel={cabinLabel}
              labels={{
                pnrLabel: t.pnrLabel,
                confirmedLabel: t.confirmedLabel,
                dateLabel: t.dateLabel,
                terminalLabel: t.terminalLabel,
                gateLabel: t.gateLabel,
                cabinLabel: t.cabinFieldLabel,
                airlineName: t.airlineName,
                terminalValue: t.terminalTba,
                gateValue: t.gateTba,
              }}
            />

            <ManageBookingPassengersCard
              passengers={booking.passengers}
              locale={locale}
              ticketed={booking.status === 'TICKETED'}
              labels={{
                heading: t.passengersHeading,
                seatLabel: t.seatLabel,
                issuedLabel: t.issuedLabel,
                seatConfirmed: (seat) =>
                  locale === 'en'
                    ? `Seat ${seat} ${t.seatConfirmed}`
                    : locale === 'ar'
                      ? `المقعد ${seat} ${t.seatConfirmed}`
                      : `صندلی ${seat} ${t.seatConfirmed}`,
              }}
            />

            <ManageBookingActionGrid
              isMobile={isMobile}
              labels={{
                changeSeat: t.changeSeatBtn,
                refund: t.openRefundBtn,
                download: t.downloadTicketBtn,
              }}
              canChangeSeat={booking.status === 'TICKETED' || booking.status === 'PAID'}
              canRefund={booking.status === 'TICKETED' && !refundResult}
              canDownload={booking.status === 'TICKETED'}
              refundDone={!!refundResult}
              onChangeSeat={openSeatModal}
              onRefund={() => setRefundOpen(true)}
              onDownload={downloadTicket}
            />

            {seatChanged && (
              <div
                data-testid="mb-seat-changed"
                style={{
                  background: '#eef9f1',
                  border: '1px solid #bfe6cc',
                  borderRadius: 12,
                  padding: '11px 15px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#1f8a5b',
                }}
              >
                {t.seatChangedMsg}
              </div>
            )}

            {refundResult && (
              <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 14, padding: '24px 21px', textAlign: 'center' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: '#eef9f1',
                    color: '#1f8a5b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 27,
                    margin: '0 auto 14px',
                  }}
                >
                  ✓
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>{t.refundDoneHeading}</div>
                <p style={{ fontSize: 12, color: '#8a96a6', margin: '0 0 18px', lineHeight: 1.9 }}>{t.refundDoneSub}</p>
                <div style={{ display: 'inline-flex', background: '#f6f8fb', borderRadius: 12, padding: '13px 22px', gap: 26, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10.5, color: '#9aa4b2', marginBottom: 3 }}>
                      {t.penaltyLabel} ({faDigits(refundResult.penaltyPct)}٪)
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#d64545' }}>
                      −{faMoney(refundResult.penaltyAmountIrr)} {t.toman}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10.5, color: '#9aa4b2', marginBottom: 3 }}>{t.refundableLabel}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#1f8a5b' }} data-testid="mb-refundable-result">
                      {faMoney(refundResult.refundableIrr)} {t.toman}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={resetLookup}
              style={{
                textAlign: 'center',
                background: 'none',
                border: 'none',
                color: '#8a96a6',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t.searchAnotherLink}
            </button>
          </div>
        )}
      </section>

      {refundOpen && booking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(13,38,64,.55)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setRefundOpen(false)}
        >
          <form
            onSubmit={onSubmitRefund}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 18,
              width: '100%',
              maxWidth: 420,
              padding: '22px 22px 18px',
              boxShadow: '0 30px 70px -20px rgba(0,0,0,.45)',
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0d2640', margin: '0 0 6px' }}>{t.refundModalTitle}</h2>
            <p style={{ fontSize: 11.5, color: '#6b7585', margin: '0 0 14px', lineHeight: 1.8 }}>{t.refundModalSub}</p>
            <label htmlFor="mb-iban" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
              {t.ibanLabel}
            </label>
            <input
              id="mb-iban"
              data-testid="mb-iban"
              dir="ltr"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="IR820170000000332211009900"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '11px 13px',
                border: '1.5px solid #e3e9f1',
                borderRadius: 11,
                fontFamily: 'inherit',
                fontSize: 13,
                outline: 'none',
                marginBottom: 14,
              }}
            />
            {refundError && (
              <div
                data-testid="mb-refund-error"
                style={{ borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d', marginBottom: 14 }}
              >
                {refundError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                data-testid="mb-refund-confirm"
                disabled={iban.trim().length !== 26}
                style={{
                  flex: 1,
                  border: 'none',
                  borderRadius: 11,
                  background: iban.trim().length === 26 ? '#d64545' : '#aab8c8',
                  color: '#fff',
                  padding: '12px 0',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: iban.trim().length === 26 ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                {t.confirmRefundBtn}
              </button>
              <button
                type="button"
                onClick={() => setRefundOpen(false)}
                style={{
                  flex: 'none',
                  border: '1.5px solid #d5e1f0',
                  borderRadius: 11,
                  background: '#fff',
                  color: '#5a6678',
                  padding: '12px 22px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t.cancelBtn}
              </button>
            </div>
          </form>
        </div>
      )}

      {seatOpen && booking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(13,38,64,.55)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setSeatOpen(false)}
        >
          <div
            data-testid="mb-seat-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 18,
              width: '100%',
              maxWidth: 460,
              maxHeight: '86vh',
              overflowY: 'auto',
              padding: '22px 22px 18px',
              boxShadow: '0 30px 70px -20px rgba(0,0,0,.45)',
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0d2640', margin: '0 0 6px' }}>{t.seatModalTitle}</h2>
            <p style={{ fontSize: 11.5, color: '#6b7585', margin: '0 0 14px', lineHeight: 1.8 }}>{t.seatModalSub}</p>

            <div style={{ display: 'flex', gap: 14, marginBottom: 12, fontSize: 11, color: '#5a6678', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#eef4fb', border: '1.5px solid #1668c4' }} />{' '}
                {t.seatLegendFree}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#e3e9f1' }} /> {t.seatLegendTaken}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#1668c4' }} /> {t.seatLegendCurrent}
              </span>
            </div>

            {seatError && (
              <div
                data-testid="mb-seat-error"
                style={{ borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d', marginBottom: 12 }}
              >
                {seatError}
              </div>
            )}

            {seatMap === null && !seatError && (
              <p style={{ fontSize: 12, color: '#8a96a6', textAlign: 'center', padding: '18px 0' }}>{t.seatMapLoading}</p>
            )}

            {seatMap !== null &&
              (() => {
                const cabinSeats = seatMap.filter((s) => s.cabin === booking.cabin);
                const currentSeats = new Set(booking.passengers.map((p) => p.seatCode).filter(Boolean) as string[]);
                const rows = Array.from(new Set(cabinSeats.map((s) => s.row))).sort((a, b) => a - b);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {rows.map((row) => (
                      <div key={row} style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        {cabinSeats
                          .filter((s) => s.row === row)
                          .map((s) => {
                            const mine = currentSeats.has(s.seatCode);
                            const free = s.status === 'FREE';
                            return (
                              <button
                                key={s.seatCode}
                                type="button"
                                data-testid={`mb-seat-${s.seatCode}`}
                                disabled={!free || seatBusy}
                                onClick={() => void onPickSeat(s.seatCode)}
                                dir="ltr"
                                style={{
                                  width: 44,
                                  height: 34,
                                  borderRadius: 7,
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  fontFamily: 'inherit',
                                  cursor: free && !seatBusy ? 'pointer' : 'not-allowed',
                                  border: mine ? 'none' : free ? '1.5px solid #1668c4' : 'none',
                                  background: mine ? '#1668c4' : free ? '#eef4fb' : '#e3e9f1',
                                  color: mine ? '#fff' : free ? '#1668c4' : '#aab8c8',
                                }}
                              >
                                {s.seatCode}
                              </button>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                );
              })()}

            <button
              type="button"
              onClick={() => setSeatOpen(false)}
              style={{
                marginTop: 16,
                width: '100%',
                border: '1.5px solid #d5e1f0',
                borderRadius: 11,
                background: '#fff',
                color: '#5a6678',
                padding: '11px 0',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t.cancelBtn}
            </button>
          </div>
        </div>
      )}
    </PublicPageShell>
  );
}

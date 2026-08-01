import { useState } from 'react';
import PublicPageShell from '../../components/public/PublicPageShell';
import {
  changeSeatByPnr,
  fetchSeatMap,
  lookupBookingByPnrAndLastName,
  submitAnonymousRefund,
} from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { BookingDetail, SeatMapCell } from '../../types/public-site';

// مدیریت رزرو — real PNR + last-name self-service (no login), matching
// مدیریت رزرو.dc.html's anonymous lookup UX. تغییر صندلی uses the real
// POST /manage-booking/change-seat endpoint (same-cabin free seat picked
// off the live seat map); دانلود بلیط opens a print-ready boarding-pass
// window (print → save as PDF). Refund uses the same real
// IBAN-then-submit flow as TicketPage.tsx's authenticated refund form.
//
// Most labels below reuse design-reference-v2/مدیریت رزرو.dc.html's own
// isEN vocabulary for this exact page (heroTitle, lblPnr, lblLastName,
// lookupBtn, noteEmailSms, hdrPassengers, lblSeat,
// btnRefundTicket/btnChangeSeat/btnDownloadTicket, hdrRefundSubmitted,
// lblPenalty/lblRefundAmount, btnConfirmRefund/btnCancel,
// linkSearchAnother). That design file only has an isEN toggle (no AR),
// so all Arabic text here is hand-translated.

interface Tr {
  fa: string;
  en: string;
  ar: string;
}

const CABIN_LABEL: Record<string, Tr> = {
  ECONOMY: { fa: 'اکونومی', en: 'Economy', ar: 'اقتصادية' },
  BUSINESS: { fa: 'بیزینس', en: 'Business', ar: 'درجة الأعمال' },
};

const STR: Record<StoredLocale, {
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
  classLabel: string;
  statusLabel: string;
  priceLabel: string;
  toman: string;
  passengersHeading: string;
  seatLabel: string;
  openRefundBtn: string;
  changeSeatBtn: string;
  downloadTicketBtn: string;
  soonSuffix: string;
  soonTooltip: string;
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
  searchAnotherLink: string;
  refundModalTitle: string;
  refundModalSub: string;
  ibanLabel: string;
  confirmRefundBtn: string;
  cancelBtn: string;
  refundSubmitErrorFallback: string;
}> = {
  fa: {
    title: 'مدیریت رزرو',
    subtitle: 'با کد رزرو و نام خانوادگی، بلیط خود را ببینید و در صورت نیاز استرداد کنید.',
    pnrLabel: 'کد رزرو',
    pnrPlaceholder: 'مثلاً BJ4X2K',
    lastNameLabel: 'نام خانوادگی مسافر',
    lastNamePlaceholder: 'مثلاً رضایی',
    lookupBtn: 'مشاهده رزرو',
    lookingUpBtn: 'در حال جستجو…',
    emailSmsNote: 'کد رزرو در ایمیل/پیامک تأیید خرید برای شما ارسال شده است.',
    lookupValidationError: 'کد رزرو و نام خانوادگی مسافر را وارد کنید.',
    lookupErrorFallback: 'رزرو یافت نشد.',
    classLabel: 'کلاس',
    statusLabel: 'وضعیت',
    priceLabel: 'قیمت',
    toman: 'تومان',
    passengersHeading: 'مسافران',
    seatLabel: 'صندلی',
    openRefundBtn: 'استرداد بلیط',
    changeSeatBtn: 'تغییر صندلی',
    downloadTicketBtn: 'دانلود بلیط',
    soonSuffix: '(به‌زودی)',
    soonTooltip: 'این قابلیت به‌زودی اضافه می‌شود.',
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
    searchAnotherLink: '‹ جستجوی رزرو دیگر',
    refundModalTitle: 'استرداد بلیط',
    refundModalSub: 'شماره شبا حساب خود را وارد کنید. جریمه بر اساس قوانین نرخی بلیط و فاصله تا زمان پرواز محاسبه و نمایش داده می‌شود.',
    ibanLabel: 'شماره شبا',
    confirmRefundBtn: 'تأیید و ثبت استرداد',
    cancelBtn: 'انصراف',
    refundSubmitErrorFallback: 'خطا در ثبت درخواست استرداد.',
  },
  en: {
    title: 'Manage Your Booking',
    subtitle: 'View your ticket with your booking code and last name, and request a refund if needed.',
    pnrLabel: 'Booking code',
    pnrPlaceholder: 'e.g. BJ4X2K',
    lastNameLabel: 'Passenger last name',
    lastNamePlaceholder: 'e.g. Rezaei',
    lookupBtn: 'View Booking',
    lookingUpBtn: 'Searching…',
    emailSmsNote: 'The booking code was sent to you by email/SMS at purchase confirmation.',
    lookupValidationError: "Enter the booking code and passenger's last name.",
    lookupErrorFallback: 'Booking not found.',
    classLabel: 'Cabin',
    statusLabel: 'Status',
    priceLabel: 'Price',
    toman: 'Toman',
    passengersHeading: 'Passengers',
    seatLabel: 'Seat',
    openRefundBtn: 'Refund Ticket',
    changeSeatBtn: 'Change Seat',
    downloadTicketBtn: 'Download Ticket',
    soonSuffix: '(coming soon)',
    soonTooltip: 'This feature will be added soon.',
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
    searchAnotherLink: '‹ Search another booking',
    refundModalTitle: 'Refund Ticket',
    refundModalSub: 'Enter your IBAN. The penalty is calculated and shown based on the fare rules and time to departure.',
    ibanLabel: 'IBAN',
    confirmRefundBtn: 'Confirm & Submit Refund',
    cancelBtn: 'Cancel',
    refundSubmitErrorFallback: 'Error submitting the refund request.',
  },
  ar: {
    title: 'إدارة الحجز',
    subtitle: 'اعرض تذكرتك برمز الحجز واسم العائلة، واطلب استرداد المبلغ عند الحاجة.',
    pnrLabel: 'رمز الحجز',
    pnrPlaceholder: 'مثلاً BJ4X2K',
    lastNameLabel: 'اسم عائلة المسافر',
    lastNamePlaceholder: 'مثلاً رضايي',
    lookupBtn: 'عرض الحجز',
    lookingUpBtn: 'جارٍ البحث…',
    emailSmsNote: 'تم إرسال رمز الحجز إليك عبر البريد الإلكتروني/الرسائل عند تأكيد الشراء.',
    lookupValidationError: 'أدخل رمز الحجز واسم عائلة المسافر.',
    lookupErrorFallback: 'لم يتم العثور على الحجز.',
    classLabel: 'الدرجة',
    statusLabel: 'الحالة',
    priceLabel: 'السعر',
    toman: 'تومان',
    passengersHeading: 'المسافرون',
    seatLabel: 'المقعد',
    openRefundBtn: 'استرداد التذكرة',
    changeSeatBtn: 'تغيير المقعد',
    downloadTicketBtn: 'تنزيل التذكرة',
    soonSuffix: '(قريبًا)',
    soonTooltip: 'ستتم إضافة هذه الميزة قريبًا.',
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
    searchAnotherLink: '‹ البحث عن حجز آخر',
    refundModalTitle: 'استرداد التذكرة',
    refundModalSub: 'أدخل رقم الآيبان الخاص بحسابك. تُحسب الغرامة وتُعرض بناءً على قواعد التسعيرة والوقت المتبقي حتى موعد الرحلة.',
    ibanLabel: 'رقم الآيبان',
    confirmRefundBtn: 'تأكيد وتسجيل الاسترداد',
    cancelBtn: 'إلغاء',
    refundSubmitErrorFallback: 'خطأ في تسجيل طلب الاسترداد.',
  },
};

export default function ManageBookingPage() {
  const { locale } = useLocale();
  const t = STR[locale];
  const [pnr, setPnr] = useState('');
  const [lastName, setLastName] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<BookingDetail | null>(null);

  const [refundOpen, setRefundOpen] = useState(false);
  const [iban, setIban] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundResult, setRefundResult] = useState<{ penaltyPct: number; refundableIrr: string; penaltyAmountIrr: string } | null>(null);

  const [seatOpen, setSeatOpen] = useState(false);
  const [seatMap, setSeatMap] = useState<SeatMapCell[] | null>(null);
  const [seatError, setSeatError] = useState<string | null>(null);
  const [seatBusy, setSeatBusy] = useState(false);
  const [seatChanged, setSeatChanged] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
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
      setLookupError(err instanceof ApiRequestError ? err.message : t.lookupErrorFallback);
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

  /** «دانلود بلیط» — opens a print-ready boarding-pass window; the browser's
   * print dialog covers save-as-PDF. All values come from the looked-up
   * booking, no extra endpoint needed. */
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
      <div style="flex:1;padding:11px 14px;text-align:center;border-inline-end:1px solid #f2f4f7;"><div style="font-size:11px;color:#8a96a6;">${t.classLabel}</div><b>${CABIN_LABEL[booking.cabin]?.[locale] ?? booking.cabin}</b></div>
      <div style="flex:1;padding:11px 14px;text-align:center;border-inline-end:1px solid #f2f4f7;"><div style="font-size:11px;color:#8a96a6;">${t.statusLabel}</div><b>${booking.status}</b></div>
      <div style="flex:1;padding:11px 14px;text-align:center;"><div style="font-size:11px;color:#8a96a6;">${t.priceLabel}</div><b>${faMoney(booking.priceIrr)} ${t.toman}</b></div>
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

  return (
    <PublicPageShell>
      <section style={{ background: 'linear-gradient(150deg,#0d2640,#124a86)', color: '#fff', padding: '41px 22px 65px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 10px', letterSpacing: '-.5px' }}>{t.title}</h1>
        <p style={{ fontSize: 13, color: '#c9dcf3', margin: 0 }}>{t.subtitle}</p>
      </section>

      <div style={{ maxWidth: 720, margin: '-34px auto 0', padding: '0 22px 60px', position: 'relative' }}>
        {/* LOOKUP CARD */}
        <form
          onSubmit={lookup}
          style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, boxShadow: '0 24px 54px -28px rgba(13,38,102,.35)', padding: 20, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}
        >
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="mb-pnr" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
              {t.pnrLabel}
            </label>
            <input
              id="mb-pnr"
              data-testid="mb-pnr"
              dir="ltr"
              value={pnr}
              onChange={(e) => setPnr(e.target.value)}
              placeholder={t.pnrPlaceholder}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, outline: 'none', textTransform: 'uppercase' }}
            />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="mb-lastname" style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#5a6678', marginBottom: 6 }}>
              {t.lastNameLabel}
            </label>
            <input
              id="mb-lastname"
              data-testid="mb-lastname"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={t.lastNamePlaceholder}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, outline: 'none' }}
            />
          </div>
          <button
            type="submit"
            data-testid="mb-lookup"
            disabled={loading}
            style={{ flex: 'none', border: 'none', borderRadius: 11, background: '#1668c4', color: '#fff', padding: '12px 26px', fontSize: 13.5, fontWeight: 800, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? t.lookingUpBtn : t.lookupBtn}
          </button>
          <div style={{ flexBasis: '100%', fontSize: 11, color: '#8a96a6' }}>{t.emailSmsNote}</div>
          {lookupError && (
            <div data-testid="mb-lookup-error" style={{ flexBasis: '100%', borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d' }}>
              {lookupError}
            </div>
          )}
        </form>

        {/* BOOKING CARD */}
        {booking && (
          <div style={{ marginTop: 22 }}>
            <div style={{ background: '#fff', border: '1px solid #eef1f5', borderRadius: 18, overflow: 'hidden', boxShadow: '0 18px 44px -28px rgba(13,38,102,.3)' }}>
              <div style={{ background: 'linear-gradient(120deg,#1668c4,#0d3b66)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14 }}>
                  <span>✈</span> blujet
                </span>
                <span style={{ fontSize: 12 }}>
                  {t.pnrLabel}{' '}
                  <b dir="ltr" data-testid="mb-pnr-show" style={{ fontSize: 14, letterSpacing: 1 }}>
                    {booking.pnr}
                  </b>
                </span>
              </div>

              <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 21, fontWeight: 900, color: '#0d2640' }} dir="ltr">
                    {booking.originCode}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1668c4', marginTop: 4 }}>{formatJalaliDateTime(booking.departureAt)}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', color: '#8a96a6', fontSize: 11 }}>
                  <div style={{ borderTop: '2px dashed #d5e1f0', margin: '8px 20px', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: -10, right: '50%', transform: 'translateX(50%)', background: '#fff', padding: '0 8px', color: '#1668c4' }}>✈</span>
                  </div>
                  <div dir="ltr">{booking.flightNo}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 21, fontWeight: 900, color: '#0d2640' }} dir="ltr">
                    {booking.destCode}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1668c4', marginTop: 4 }}>{formatJalaliDateTime(booking.arrivalAt)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderTop: '1px solid #f2f4f7' }}>
                {[
                  [t.classLabel, CABIN_LABEL[booking.cabin]?.[locale] ?? booking.cabin],
                  [t.statusLabel, booking.status],
                  [t.priceLabel, `${faMoney(booking.priceIrr)} ${t.toman}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: '11px 14px', textAlign: 'center', borderLeft: '1px solid #f2f4f7' }}>
                    <div style={{ fontSize: 10.5, color: '#8a96a6', marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640' }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid #f2f4f7', padding: '15px 20px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0d2640', marginBottom: 11 }}>{t.passengersHeading}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {booking.passengers.map((p) => (
                    <div key={p.seatCode ?? p.fullName} style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#f7faff', border: '1px solid #e6eefb', borderRadius: 12, padding: '10px 13px' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#1668c4,#0d3b66)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>
                        {p.fullName.split(/\s+/).map((w) => w[0]).join('')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#16202e' }}>{p.fullName}</div>
                        {p.seatCode && (
                          <div style={{ fontSize: 11, color: '#8a96a6' }}>
                            {t.seatLabel} <span dir="ltr">{p.seatCode}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f2f4f7', padding: '14px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setRefundOpen(true)}
                  data-testid="mb-open-refund"
                  disabled={!!refundResult || booking.status !== 'TICKETED'}
                  style={{ border: '1.5px solid #f3d1d3', background: refundResult ? '#f6f8fb' : '#fff', color: refundResult ? '#aab8c8' : '#d64545', padding: '10px 18px', borderRadius: 11, fontSize: 12.5, fontWeight: 800, cursor: refundResult ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >
                  {t.openRefundBtn}
                </button>
                <button
                  type="button"
                  data-testid="mb-change-seat"
                  onClick={openSeatModal}
                  disabled={booking.status !== 'TICKETED' && booking.status !== 'PAID'}
                  style={{
                    border: '1.5px solid #d5e1f0',
                    background: booking.status === 'TICKETED' || booking.status === 'PAID' ? '#fff' : '#f6f8fb',
                    color: booking.status === 'TICKETED' || booking.status === 'PAID' ? '#1668c4' : '#aab8c8',
                    padding: '10px 18px',
                    borderRadius: 11,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: booking.status === 'TICKETED' || booking.status === 'PAID' ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                  }}
                >
                  {t.changeSeatBtn}
                </button>
                <button
                  type="button"
                  data-testid="mb-download-ticket"
                  onClick={downloadTicket}
                  disabled={booking.status !== 'TICKETED'}
                  style={{
                    marginRight: 'auto',
                    border: 'none',
                    background: booking.status === 'TICKETED' ? '#1668c4' : '#e3e9f1',
                    color: booking.status === 'TICKETED' ? '#fff' : '#8a96a6',
                    padding: '10px 20px',
                    borderRadius: 11,
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: booking.status === 'TICKETED' ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                  }}
                >
                  {t.downloadTicketBtn}
                </button>
              </div>
            </div>

            {seatChanged && (
              <div data-testid="mb-seat-changed" style={{ marginTop: 12, background: '#eef9f1', border: '1px solid #bfe6cc', borderRadius: 12, padding: '11px 15px', fontSize: 12.5, fontWeight: 700, color: '#1f8a5b' }}>
                {t.seatChangedMsg}
              </div>
            )}

            {/* REFUND DONE */}
            {refundResult && (
              <div style={{ marginTop: 16, background: '#eef9f1', border: '1px solid #bfe6cc', borderRadius: 16, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#1f8a5b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✓</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#0d2640' }}>{t.refundDoneHeading}</span>
                </div>
                <p style={{ fontSize: 12, color: '#3b5548', margin: '0 0 12px', lineHeight: 1.9 }}>{t.refundDoneSub}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                  <div style={{ background: '#fff', border: '1px solid #d9eee0', borderRadius: 12, padding: '10px 13px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10.5, color: '#7a8696', marginBottom: 3 }}>
                      {t.penaltyLabel} ({faDigits(refundResult.penaltyPct)}٪)
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#0d2640' }}>
                      −{faMoney(refundResult.penaltyAmountIrr)} <span style={{ fontSize: 9, fontWeight: 400 }}>{t.toman}</span>
                    </div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #d9eee0', borderRadius: 12, padding: '10px 13px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10.5, color: '#7a8696', marginBottom: 3 }}>{t.refundableLabel}</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#0d2640' }} data-testid="mb-refundable-result">
                      {faMoney(refundResult.refundableIrr)} <span style={{ fontSize: 9, fontWeight: 400 }}>{t.toman}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setBooking(null);
                setPnr('');
                setLastName('');
                setRefundResult(null);
              }}
              style={{ marginTop: 16, background: 'none', border: 'none', color: '#1668c4', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {t.searchAnotherLink}
            </button>
          </div>
        )}
      </div>

      {/* REFUND MODAL */}
      {refundOpen && booking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,38,64,.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setRefundOpen(false)}>
          <form
            onSubmit={onSubmitRefund}
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 420, padding: '22px 22px 18px', boxShadow: '0 30px 70px -20px rgba(0,0,0,.45)' }}
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
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1.5px solid #e3e9f1', borderRadius: 11, fontFamily: 'inherit', fontSize: 13, outline: 'none', marginBottom: 14 }}
            />
            {refundError && (
              <div data-testid="mb-refund-error" style={{ borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d', marginBottom: 14 }}>
                {refundError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                data-testid="mb-refund-confirm"
                disabled={iban.trim().length !== 26}
                style={{ flex: 1, border: 'none', borderRadius: 11, background: iban.trim().length === 26 ? '#d64545' : '#aab8c8', color: '#fff', padding: '12px 0', fontSize: 13, fontWeight: 800, cursor: iban.trim().length === 26 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >
                {t.confirmRefundBtn}
              </button>
              <button
                type="button"
                onClick={() => setRefundOpen(false)}
                style={{ flex: 'none', border: '1.5px solid #d5e1f0', borderRadius: 11, background: '#fff', color: '#5a6678', padding: '12px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {t.cancelBtn}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SEAT-CHANGE MODAL */}
      {seatOpen && booking && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,38,64,.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setSeatOpen(false)}
        >
          <div
            data-testid="mb-seat-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 460, maxHeight: '86vh', overflowY: 'auto', padding: '22px 22px 18px', boxShadow: '0 30px 70px -20px rgba(0,0,0,.45)' }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0d2640', margin: '0 0 6px' }}>{t.seatModalTitle}</h2>
            <p style={{ fontSize: 11.5, color: '#6b7585', margin: '0 0 14px', lineHeight: 1.8 }}>{t.seatModalSub}</p>

            <div style={{ display: 'flex', gap: 14, marginBottom: 12, fontSize: 11, color: '#5a6678' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#eef4fb', border: '1.5px solid #1668c4' }} /> {t.seatLegendFree}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#e3e9f1' }} /> {t.seatLegendTaken}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#1668c4' }} /> {t.seatLegendCurrent}
              </span>
            </div>

            {seatError && (
              <div data-testid="mb-seat-error" style={{ borderRadius: 10, background: '#fef2f2', padding: 10, fontSize: 12, color: '#e5484d', marginBottom: 12 }}>
                {seatError}
              </div>
            )}

            {seatMap === null && !seatError && (
              <p style={{ fontSize: 12, color: '#8a96a6', textAlign: 'center', padding: '18px 0' }}>{t.seatMapLoading}</p>
            )}

            {seatMap !== null && (() => {
              const cabinSeats = seatMap.filter((s) => s.cabin === booking.cabin);
              const currentSeats = new Set(
                booking.passengers.map((p) => p.seatCode).filter(Boolean) as string[],
              );
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
              style={{ marginTop: 16, width: '100%', border: '1.5px solid #d5e1f0', borderRadius: 11, background: '#fff', color: '#5a6678', padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {t.cancelBtn}
            </button>
          </div>
        </div>
      )}
    </PublicPageShell>
  );
}

import { useState } from 'react';
import PublicPageShell from '../../components/public/PublicPageShell';
import { lookupBookingByPnrAndLastName, submitAnonymousRefund } from '../../api/publicSite';
import { ApiRequestError } from '../../api/envelope';
import { faDigits, faMoney } from '../../lib/fa-format';
import { formatJalaliDateTime } from '../../lib/jalali';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import type { BookingDetail } from '../../types/public-site';

// مدیریت رزرو — real PNR + last-name self-service (no login), matching
// مدیریت رزرو.dc.html's anonymous lookup UX. تغییر صندلی/دانلود بلیط stay
// disabled this phase (see docs/API.md's Phase 19 for the deferral
// reasoning); refund uses the same real IBAN-then-submit flow as
// TicketPage.tsx's authenticated refund form, not a pre-submission
// per-passenger preview.
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
                  disabled
                  title={t.soonTooltip}
                  style={{ border: '1.5px solid #e3e9f1', background: '#f6f8fb', color: '#aab8c8', padding: '10px 18px', borderRadius: 11, fontSize: 12.5, fontWeight: 700, cursor: 'not-allowed', fontFamily: 'inherit' }}
                >
                  {t.changeSeatBtn} <span style={{ fontSize: 10 }}>{t.soonSuffix}</span>
                </button>
                <button
                  type="button"
                  disabled
                  title={t.soonTooltip}
                  style={{ marginRight: 'auto', border: 'none', background: '#e3e9f1', color: '#8a96a6', padding: '10px 20px', borderRadius: 11, fontSize: 12.5, fontWeight: 800, cursor: 'not-allowed', fontFamily: 'inherit' }}
                >
                  {t.downloadTicketBtn} <span style={{ fontSize: 10 }}>{t.soonSuffix}</span>
                </button>
              </div>
            </div>

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
    </PublicPageShell>
  );
}

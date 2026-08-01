import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLocale, type StoredLocale } from '../../hooks/useLocale';
import { createBooking, fetchClubPoints, fetchSavedPassengers, fetchSeatMap } from '../../api/publicSite';
import { fetchDevLastOtp } from '../../api/auth';
import { ApiRequestError } from '../../api/envelope';
import { faDigits, isValidIranMobile, normalizeIranMobile } from '../../lib/fa-format';
import type { CabinClass, SavedPassenger, SeatMapCell } from '../../types/public-site';
import PublicPageShell from '../../components/public/PublicPageShell';
import FlowStepper from '../../components/public/FlowStepper';
import SavedPassengerAutofill, { savedPassengerToDraft } from './SavedPassengerAutofill';

const BUSINESS_SEAT_MIN_POINTS = 15_000;

const STR: Record<
  StoredLocale,
  {
    loading: string;
    otpTitle: string;
    otpSub: string;
    otpRequest: string;
    otpVerify: string;
    otpPhonePlaceholder: string;
    otpCodePlaceholder: string;
    otpSendError: string;
    otpInvalid: string;
    otpPhoneInvalid: string;
    otpSent: (phone: string) => string;
    otpRequesting: string;
    otpResend: string;
    otpDevHint: (code: string) => string;
    title: string;
    businessLock: string;
    seatMapLoading: string;
    seatMapError: string;
    passengerSeat: (seat: string) => string;
    namePlaceholder: string;
    nationalIdPlaceholder: string;
    mobilePlaceholder: string;
    noSeat: string;
    noName: string;
    submit: string;
    submitting: string;
    bookError: string;
  }
> = {
  fa: {
    loading: 'در حال بارگذاری…',
    otpTitle: 'ورود با شماره موبایل',
    otpSub: 'برای ادامه رزرو، شماره موبایل خود را تأیید کنید.',
    otpRequest: 'دریافت کد',
    otpVerify: 'تأیید و ورود',
    otpPhonePlaceholder: '09121234567',
    otpCodePlaceholder: 'کد ۶ رقمی',
    otpSendError: 'خطا در ارسال کد.',
    otpInvalid: 'کد نامعتبر است.',
    otpPhoneInvalid: 'شماره موبایل معتبر نیست (مثال: 09121234567).',
    otpSent: (phone) => `کد تأیید به ${faDigits(phone)} ارسال شد.`,
    otpRequesting: 'در حال ارسال…',
    otpResend: 'ارسال مجدد کد',
    otpDevHint: (code) => `محیط توسعه — کد: ${faDigits(code)}`,
    title: 'انتخاب صندلی و اطلاعات مسافران',
    businessLock: '🔒 انتخاب صندلی بیزینس نیازمند حداقل ۱۵٬۰۰۰ امتیاز باشگاه است',
    seatMapLoading: 'در حال بارگذاری نقشه صندلی…',
    seatMapError: 'خطا در دریافت نقشه صندلی.',
    passengerSeat: (seat) => `مسافر صندلی ${seat}`,
    namePlaceholder: 'نام و نام خانوادگی',
    nationalIdPlaceholder: 'کد ملی (اختیاری)',
    mobilePlaceholder: 'موبایل (اختیاری)',
    noSeat: 'حداقل یک صندلی انتخاب کنید.',
    noName: 'نام همه مسافران را وارد کنید.',
    submit: 'ادامه به تکمیل خرید',
    submitting: 'در حال ثبت…',
    bookError: 'خطا در ثبت رزرو.',
  },
  en: {
    loading: 'Loading…',
    otpTitle: 'Sign in with mobile',
    otpSub: 'Verify your mobile number to continue booking.',
    otpRequest: 'Send code',
    otpVerify: 'Verify & sign in',
    otpPhonePlaceholder: '09121234567',
    otpCodePlaceholder: '6-digit code',
    otpSendError: 'Failed to send code.',
    otpInvalid: 'Invalid code.',
    otpPhoneInvalid: 'Enter a valid mobile number (e.g. 09121234567).',
    otpSent: (phone) => `Verification code sent to ${phone}.`,
    otpRequesting: 'Sending…',
    otpResend: 'Resend code',
    otpDevHint: (code) => `Dev — code: ${code}`,
    title: 'Seat selection & passenger details',
    businessLock: '🔒 Business seat selection requires at least 15,000 club points',
    seatMapLoading: 'Loading seat map…',
    seatMapError: 'Failed to load seat map.',
    passengerSeat: (seat) => `Passenger — seat ${seat}`,
    namePlaceholder: 'Full name',
    nationalIdPlaceholder: 'National ID (optional)',
    mobilePlaceholder: 'Mobile (optional)',
    noSeat: 'Select at least one seat.',
    noName: 'Enter a name for every passenger.',
    submit: 'Continue to checkout',
    submitting: 'Saving…',
    bookError: 'Failed to create booking.',
  },
  ar: {
    loading: 'جارٍ التحميل…',
    otpTitle: 'تسجيل الدخول برقم الجوال',
    otpSub: 'تحقق من رقم جوالك لمتابعة الحجز.',
    otpRequest: 'إرسال الرمز',
    otpVerify: 'تأكيد وتسجيل الدخول',
    otpPhonePlaceholder: '09121234567',
    otpCodePlaceholder: 'رمز من ٦ أرقام',
    otpSendError: 'فشل إرسال الرمز.',
    otpInvalid: 'رمز غير صالح.',
    otpPhoneInvalid: 'رقم جوال غير صالح (مثال: 09121234567).',
    otpSent: (phone) => `تم إرسال الرمز إلى ${phone}.`,
    otpRequesting: 'جارٍ الإرسال…',
    otpResend: 'إعادة إرسال الرمز',
    otpDevHint: (code) => `بيئة التطوير — الرمز: ${code}`,
    title: 'اختيار المقعد وبيانات المسافرين',
    businessLock: '🔒 اختيار مقعد درجة الأعمال يتطلب ١٥٬٠٠٠ نقطة على الأقل',
    seatMapLoading: 'جارٍ تحميل خريطة المقاعد…',
    seatMapError: 'فشل تحميل خريطة المقاعد.',
    passengerSeat: (seat) => `مسافر — مقعد ${seat}`,
    namePlaceholder: 'الاسم الكامل',
    nationalIdPlaceholder: 'الرقم الوطني (اختياري)',
    mobilePlaceholder: 'الجوال (اختياري)',
    noSeat: 'اختر مقعداً واحداً على الأقل.',
    noName: 'أدخل اسم كل مسافر.',
    submit: 'المتابعة إلى إتمام الشراء',
    submitting: 'جارٍ الحفظ…',
    bookError: 'فشل إنشاء الحجز.',
  },
};

function OtpLoginInline() {
  const { requestOtp, verifyOtp } = useAuth();
  const { locale } = useLocale();
  const t = STR[locale];
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  const normalizedPhone = normalizeIranMobile(phone);
  const phoneReady = isValidIranMobile(normalizedPhone);

  async function sendOtp() {
    setError(null);
    setDevCode(null);
    if (!phoneReady) {
      setError(t.otpPhoneInvalid);
      return;
    }
    if (!requestOtp) {
      setError(t.otpSendError);
      return;
    }
    setBusy(true);
    try {
      const id = await requestOtp(normalizedPhone);
      setChallengeId(id);
      setCode('');
      if (import.meta.env.DEV) {
        try {
          const { code: mockCode } = await fetchDevLastOtp(normalizedPhone);
          setDevCode(mockCode);
        } catch {
          /* mock endpoint unavailable in production builds */
        }
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.otpSendError);
    } finally {
      setBusy(false);
    }
  }

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    await sendOtp();
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!verifyOtp) {
      setError(t.otpInvalid);
      return;
    }
    setBusy(true);
    try {
      await verifyOtp(challengeId!, normalizeIranMobile(code));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.otpInvalid);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-[#eef1f5] bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-extrabold text-[#0d2640]">{t.otpTitle}</h2>
      <p className="mb-4 text-xs text-[#6b7b94]">{t.otpSub}</p>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-600">{error}</p>}
      {!challengeId ? (
        <form onSubmit={onRequest} className="flex flex-col gap-3">
          <input
            data-testid="otp-phone"
            type="tel"
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(normalizeIranMobile(e.target.value))}
            placeholder={t.otpPhonePlaceholder}
            className="rounded-lg border border-[#eef1f5] px-3.5 py-2.5 text-sm outline-none focus:border-[#1668c4]"
          />
          <button
            type="submit"
            disabled={busy || !phoneReady}
            className="rounded-lg bg-[#1668c4] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? t.otpRequesting : t.otpRequest}
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#059669]" data-testid="otp-sent-notice">
            {t.otpSent(normalizedPhone)}
          </p>
          {devCode && (
            <p className="rounded-lg bg-[#eff6ff] p-2.5 text-xs font-semibold text-[#1668c4]" data-testid="otp-dev-hint">
              {t.otpDevHint(devCode)}
            </p>
          )}
          <input
            data-testid="otp-code"
            type="tel"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(normalizeIranMobile(e.target.value).slice(0, 6))}
            placeholder={t.otpCodePlaceholder}
            className="font-num rounded-lg border border-[#eef1f5] px-3.5 py-2.5 text-sm outline-none focus:border-[#1668c4]"
          />
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className="rounded-lg bg-[#1668c4] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? t.otpRequesting : t.otpVerify}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void sendOtp()}
            className="text-xs font-bold text-[#1668c4] disabled:opacity-60"
          >
            {t.otpResend}
          </button>
        </form>
      )}
    </div>
  );
}

interface PassengerDraft {
  fullName: string;
  nationalId: string;
  mobile: string;
}

export default function BookPage() {
  const { flightInstanceId } = useParams<{ flightInstanceId: string }>();
  const [params] = useSearchParams();
  const cabin = (params.get('cabin') as CabinClass) ?? 'ECONOMY';
  const { status } = useAuth();
  const { locale } = useLocale();
  const t = STR[locale];
  const navigate = useNavigate();

  const [seats, setSeats] = useState<SeatMapCell[] | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengers, setPassengers] = useState<PassengerDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clubBalance, setClubBalance] = useState<number | null>(null);
  const [savedPassengers, setSavedPassengers] = useState<SavedPassenger[]>([]);
  const [activePassengerIndex, setActivePassengerIndex] = useState(0);
  const [passengerSourceIds, setPassengerSourceIds] = useState<(string | null)[]>([]);

  useEffect(() => {
    if (!flightInstanceId) return;
    fetchSeatMap(flightInstanceId)
      .then((m) => setSeats(m.seats.filter((s) => s.cabin === cabin)))
      .catch(() => setError(t.seatMapError));
  }, [flightInstanceId, cabin, t.seatMapError]);

  useEffect(() => {
    if (status !== 'authenticated' || cabin !== 'BUSINESS') return;
    fetchClubPoints()
      .then((c) => setClubBalance(c.balance))
      .catch(() => setClubBalance(0));
  }, [status, cabin]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchSavedPassengers()
      .then(setSavedPassengers)
      .catch(() => setSavedPassengers([]));
  }, [status]);

  const usedSavedIds = useMemo(
    () => new Set(passengerSourceIds.filter((id): id is string => Boolean(id))),
    [passengerSourceIds],
  );

  const businessLocked = cabin === 'BUSINESS' && (clubBalance ?? 0) < BUSINESS_SEAT_MIN_POINTS;

  function toggleSeat(seatCode: string) {
    setSelectedSeats((prev) => {
      const next = prev.includes(seatCode) ? prev.filter((s) => s !== seatCode) : [...prev, seatCode];
      setPassengers((p) => {
        const arr = [...p];
        while (arr.length < next.length) arr.push({ fullName: '', nationalId: '', mobile: '' });
        while (arr.length > next.length) arr.pop();
        return arr;
      });
      setPassengerSourceIds((ids) => {
        const arr = [...ids];
        while (arr.length < next.length) arr.push(null);
        while (arr.length > next.length) arr.pop();
        return arr;
      });
      if (next.length > 0 && activePassengerIndex >= next.length) {
        setActivePassengerIndex(next.length - 1);
      }
      return next;
    });
  }

  function applySavedPassenger(saved: SavedPassenger, index: number) {
    const draft = savedPassengerToDraft(saved);
    setPassengers((arr) => arr.map((x, j) => (j === index ? draft : x)));
    setPassengerSourceIds((arr) => arr.map((id, j) => (j === index ? saved.id : id)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedSeats.length === 0) {
      setError(t.noSeat);
      return;
    }
    if (passengers.some((p) => !p.fullName.trim())) {
      setError(t.noName);
      return;
    }
    setSubmitting(true);
    try {
      const booking = await createBooking({
        flightInstanceId: flightInstanceId!,
        cabin,
        passengers: passengers.map((p, i) => ({
          fullName: p.fullName,
          nationalId: p.nationalId || undefined,
          mobile: p.mobile || undefined,
          seatCode: selectedSeats[i],
        })),
      });
      navigate(`/checkout/${booking.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.bookError);
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <PublicPageShell>
        <p className="p-8 text-sm text-[#6b7b94]">{t.loading}</p>
      </PublicPageShell>
    );
  }
  if (status === 'unauthenticated') {
    return (
      <PublicPageShell>
        <div className="p-6">
          <OtpLoginInline />
        </div>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell>
      <FlowStepper current="seat" onBack={() => navigate(-1)} />
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="mb-1 text-lg font-extrabold text-[#0d2640]">{t.title}</h1>
        {cabin === 'BUSINESS' && businessLocked && (
          <p data-testid="business-seat-lock" className="mb-4 text-[10.5px] font-semibold text-[#96701a]">
            {t.businessLock}
          </p>
        )}
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</p>}

        {seats === null ? (
          <p className="text-sm text-[#6b7b94]">{t.seatMapLoading}</p>
        ) : (
          <div
            className="mb-6 rounded-2xl border border-[#eef1f5] bg-white p-4"
            data-testid="seat-grid"
          >
            <div className="flex flex-wrap gap-2">
              {seats.map((s) => (
                <button
                  key={s.seatCode}
                  type="button"
                  disabled={s.status === 'TAKEN' || businessLocked}
                  onClick={() => toggleSeat(s.seatCode)}
                  data-testid={`seat-${s.seatCode}`}
                  className={`font-num h-10 w-10 rounded-lg text-xs font-bold ${
                    s.status === 'TAKEN'
                      ? 'cursor-not-allowed bg-[#e5e9f0] text-[#9fb0c7]'
                      : selectedSeats.includes(s.seatCode)
                        ? 'bg-[#1668c4] text-white'
                        : 'border border-[#eef1f5] bg-white text-[#0d2640] hover:border-[#1668c4]'
                  }`}
                >
                  {s.seatCode}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedSeats.length > 0 && (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <SavedPassengerAutofill
              passengers={savedPassengers}
              activeIndex={activePassengerIndex}
              usedIds={usedSavedIds}
              onSelect={applySavedPassenger}
            />
            {passengers.map((p, i) => (
              <div
                key={selectedSeats[i]}
                className="rounded-2xl border border-[#eef1f5] bg-white p-4"
                style={
                  activePassengerIndex === i
                    ? { borderColor: '#1668c4', boxShadow: '0 0 0 1px #1668c4' }
                    : undefined
                }
                onFocusCapture={() => setActivePassengerIndex(i)}
              >
                <div className="mb-2 text-xs font-bold text-[#6b7b94]">
                  {t.passengerSeat(selectedSeats[i])}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    data-testid={`pax-name-${i}`}
                    value={p.fullName}
                    onChange={(e) => {
                      setPassengers((arr) =>
                        arr.map((x, j) => (j === i ? { ...x, fullName: e.target.value } : x)),
                      );
                      setPassengerSourceIds((arr) => arr.map((id, j) => (j === i ? null : id)));
                    }}
                    placeholder={t.namePlaceholder}
                    className="rounded-lg border border-[#eef1f5] px-3 py-2 text-sm outline-none focus:border-[#1668c4]"
                  />
                  <input
                    data-testid={`pax-national-id-${i}`}
                    value={p.nationalId}
                    onChange={(e) => {
                      setPassengers((arr) =>
                        arr.map((x, j) => (j === i ? { ...x, nationalId: e.target.value } : x)),
                      );
                      setPassengerSourceIds((arr) => arr.map((id, j) => (j === i ? null : id)));
                    }}
                    placeholder={t.nationalIdPlaceholder}
                    className="font-num rounded-lg border border-[#eef1f5] px-3 py-2 text-sm outline-none focus:border-[#1668c4]"
                  />
                  <input
                    data-testid={`pax-mobile-${i}`}
                    value={p.mobile}
                    onChange={(e) => {
                      setPassengers((arr) =>
                        arr.map((x, j) => (j === i ? { ...x, mobile: e.target.value } : x)),
                      );
                      setPassengerSourceIds((arr) => arr.map((id, j) => (j === i ? null : id)));
                    }}
                    placeholder={t.mobilePlaceholder}
                    className="font-num rounded-lg border border-[#eef1f5] px-3 py-2 text-sm outline-none focus:border-[#1668c4]"
                  />
                </div>
              </div>
            ))}
            <button
              type="submit"
              disabled={submitting}
              data-testid="book-submit"
              className="rounded-xl bg-[#1668c4] px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {submitting ? t.submitting : t.submit}
            </button>
          </form>
        )}
      </div>
    </PublicPageShell>
  );
}
